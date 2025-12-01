// LocalStorage Repository Implementation
// ======================================
// This implements the BaseRepository interface using localStorage.
// File data and messages are stored in IndexedDB to avoid localStorage quota limits.
// Can be swapped out for NeonRepository when migrating to database.

import { BaseRepository } from './BaseRepository.js';
import { STORAGE_KEYS } from '../config/constants.js';
import { DEFAULT_MODEL, MODELS } from '../config/models.js';
import * as fileStorage from '../utils/fileStorage.js';

// Keys for tracking migrations
const MESSAGES_MIGRATION_KEY = 'lampchat_messages_migrated';
const CHATS_MIGRATION_KEY = 'lampchat_chat_metadata_migrated';

/**
 * Generate a unique ID using crypto.randomUUID()
 * @param {string} prefix 
 * @returns {string}
 */
function generateId(prefix = '') {
    return `${prefix}${crypto.randomUUID()}`;
}

function stripMessages(chat) {
    if (!chat) return chat;
    const { messages, ...rest } = chat;
    return { ...rest };
}

/**
 * LocalStorage implementation of BaseRepository
 * Messages are stored in IndexedDB while metadata remains in localStorage
 */
export class LocalStorageRepository extends BaseRepository {
    constructor() {
        super();
        this._migrationPromise = null;
        this._initializeStorage();
    }

    /**
     * Initialize storage with default values if empty
     * @private
     */
    _initializeStorage() {
        if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify({}));
        }
        if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
                apiKey: '',
                selectedModel: DEFAULT_MODEL,
                enabledModels: MODELS.map(m => m.id),
                webSearchEnabled: false,
            }));
        }
        if (!localStorage.getItem(STORAGE_KEYS.USER)) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({
                id: 'local_user',
                name: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }));
        }

        // Run migrations from localStorage to IndexedDB (once)
        this._migrationPromise = this._runMigrations();
    }

    async _runMigrations() {
        await this._migrateMessagesToIndexedDB();
        await this._migrateChatsToIndexedDB();
    }

    /**
     * Migrate messages from localStorage to IndexedDB
     * This only runs once and removes messages from localStorage after migration
     * @private
     */
    async _migrateMessagesToIndexedDB() {
        // Check if migration has already been done
        if (localStorage.getItem(MESSAGES_MIGRATION_KEY)) {
            return;
        }

        try {
            const chats = this._get(STORAGE_KEYS.CHATS) || {};
            const migrated = await fileStorage.migrateMessagesToIndexedDB(chats);

            if (migrated) {
                // Remove messages from localStorage chats to save space
                const strippedChats = {};
                for (const chatId in chats) {
                    const { messages, ...metadata } = chats[chatId];
                    strippedChats[chatId] = {
                        ...metadata,
                        messageCount: messages ? messages.length : 0,
                    };
                }
                this._set(STORAGE_KEYS.CHATS, strippedChats);
                console.log('Messages migrated to IndexedDB successfully');
            }

            // Mark migration as complete
            localStorage.setItem(MESSAGES_MIGRATION_KEY, 'true');
        } catch (error) {
            console.error('Failed to migrate messages to IndexedDB:', error);
        }
    }

    async _migrateChatsToIndexedDB() {
        if (localStorage.getItem(CHATS_MIGRATION_KEY)) {
            return;
        }

        try {
            const chats = this._get(STORAGE_KEYS.CHATS);
            if (chats && Object.keys(chats).length > 0) {
                await fileStorage.migrateChatMetadataToIndexedDB(chats);
            }
            localStorage.removeItem(STORAGE_KEYS.CHATS);
            localStorage.setItem(CHATS_MIGRATION_KEY, 'true');
        } catch (error) {
            console.error('Failed to migrate chat metadata to IndexedDB:', error);
        }
    }

    /**
     * Ensure migration is complete before operations
     * @private
     */
    async _ensureMigrated() {
        if (this._migrationPromise) {
            await this._migrationPromise;
        }
    }

    /**
     * Get data from localStorage
     * @private
     * @param {string} key 
     * @returns {any}
     */
    _get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Set data in localStorage
     * @private
     * @param {string} key 
     * @param {any} value 
     */
    _set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    // ==================
    // Chat Operations
    // ==================

    async getChats(userId, options = {}) {
        await this._ensureMigrated();
        const { limit = 20, offset = 0, projectId = null } = options;
        const { items, total } = await fileStorage.paginateChatMetadata({
            limit,
            offset,
            projectId,
        });
        const chats = items.map(stripMessages);
        const hasMore = offset + chats.length < total;
        return { chats, hasMore, total };
    }

    async getChatById(chatId) {
        await this._ensureMigrated();
        const chatMeta = await fileStorage.getChatMetadata(chatId);

        if (!chatMeta) return null;

        // Load messages from IndexedDB
        const messages = await fileStorage.getMessagesByChat(chatId);

        return {
            ...chatMeta,
            messages: messages || [],
        };
    }

    async createChat(chatData) {
        await this._ensureMigrated();
        const now = Date.now();

        const chat = {
            id: generateId('chat_'),
            title: 'New Chat',
            userId: 'local_user',
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
            ...chatData,
        };

        // Extract messages if provided (for imports)
        const { messages, ...chatMeta } = chat;

        // Store messages in IndexedDB if provided
        if (messages && messages.length > 0) {
            const messagesWithChatId = messages.map(msg => ({
                ...msg,
                chatId: chat.id,
            }));
            await fileStorage.storeMessages(messagesWithChatId);
            chatMeta.messageCount = messages.length;
        }

        // Only store metadata in localStorage
        await fileStorage.saveChatMetadata(chatMeta);

        // Return full chat with messages for immediate use
        return { ...chatMeta, messages: messages || [] };
    }

    async updateChat(chatId, updates) {
        await this._ensureMigrated();
        const existing = await fileStorage.getChatMetadata(chatId);

        if (!existing) {
            throw new Error(`Chat ${chatId} not found`);
        }

        // Handle messages separately if included in updates
        const { messages, ...metaUpdates } = updates;

        if (messages !== undefined) {
            // Replace all messages in IndexedDB
            await fileStorage.deleteMessagesByChat(chatId);
            if (messages.length > 0) {
                const messagesWithChatId = messages.map(msg => ({
                    ...msg,
                    chatId: chatId,
                }));
                await fileStorage.storeMessages(messagesWithChatId);
            }
            metaUpdates.messageCount = messages.length;
        }

        const updatedMeta = {
            ...existing,
            ...metaUpdates,
            updatedAt: Date.now(),
        };

        await fileStorage.saveChatMetadata(updatedMeta);

        // Return full chat with messages
        const allMessages = await fileStorage.getMessagesByChat(chatId);
        return { ...updatedMeta, messages: allMessages };
    }

    async deleteChat(chatId) {
        await this._ensureMigrated();
        const existing = await fileStorage.getChatMetadata(chatId);

        if (existing) {
            // Delete messages from IndexedDB
            await fileStorage.deleteMessagesByChat(chatId);
            await fileStorage.deleteChatMetadata(chatId);
            return true;
        }

        return false;
    }

    async searchChats(query, userId, options = {}) {
        await this._ensureMigrated();
        const { limit = 20, offset = 0 } = options;
        const allChats = await fileStorage.getAllChatMetadata();
        const lowerQuery = query.toLowerCase();

        // Search through chats and their messages
        const matchingChatPromises = allChats.map(async (chatMeta) => {
            // Check title first
            if (chatMeta.title.toLowerCase().includes(lowerQuery)) {
                return chatMeta;
            }

            // Then check messages in IndexedDB
            const messages = await fileStorage.getMessagesByChat(chatMeta.id);
            const hasMatchingMessage = messages.some(m =>
                m.content && m.content.toLowerCase().includes(lowerQuery)
            );

            return hasMatchingMessage ? chatMeta : null;
        });

        const matchResults = await Promise.all(matchingChatPromises);
        const matchingChats = matchResults
            .filter(chat => chat !== null)
            .sort((a, b) => b.updatedAt - a.updatedAt);

        // Calculate pagination
        const total = matchingChats.length;
        const paginatedChats = matchingChats.slice(offset, offset + limit).map(stripMessages);
        const hasMore = offset + paginatedChats.length < total;

        return { chats: paginatedChats, hasMore, total };
    }

    // ==================
    // Message Operations (stored in IndexedDB)
    // ==================

    async addMessage(chatId, messageData) {
        await this._ensureMigrated();
        const chatMeta = await fileStorage.getChatMetadata(chatId);

        if (!chatMeta) {
            throw new Error(`Chat ${chatId} not found`);
        }

        const message = {
            id: generateId('msg_'),
            chatId: chatId,
            role: 'user',
            content: '',
            createdAt: Date.now(),
            ...messageData,
        };

        // Store message in IndexedDB
        await fileStorage.storeMessage(message);

        // Update metadata in localStorage
        const updatedMeta = {
            ...chatMeta,
            messageCount: (chatMeta.messageCount || 0) + 1,
            updatedAt: Date.now(),
        };
        await fileStorage.saveChatMetadata(updatedMeta);

        return message;
    }

    async updateMessage(chatId, messageId, updates) {
        await this._ensureMigrated();
        const chatMeta = await fileStorage.getChatMetadata(chatId);

        if (!chatMeta) {
            throw new Error(`Chat ${chatId} not found`);
        }

        // Update message in IndexedDB
        const updatedMessage = await fileStorage.updateMessage(messageId, updates);

        if (!updatedMessage) {
            throw new Error(`Message ${messageId} not found`);
        }

        // Update chat timestamp
        await fileStorage.saveChatMetadata({
            ...chatMeta,
            updatedAt: Date.now(),
        });

        return updatedMessage;
    }

    async getMessages(chatId) {
        await this._ensureMigrated();
        return await fileStorage.getMessagesByChat(chatId);
    }

    // ==================
    // User Operations
    // ==================

    async getUser(userId) {
        return this._get(STORAGE_KEYS.USER);
    }

    async saveUser(userData) {
        const currentUser = this._get(STORAGE_KEYS.USER) || {};

        const user = {
            ...currentUser,
            ...userData,
            updatedAt: Date.now(),
        };

        this._set(STORAGE_KEYS.USER, user);
        return user;
    }

    // ==================
    // Settings Operations
    // ==================

    async getSettings(userId) {
        return this._get(STORAGE_KEYS.SETTINGS) || {
            apiKey: '',
            selectedModel: DEFAULT_MODEL,
            enabledModels: MODELS.map(m => m.id),
            webSearchEnabled: false,
        };
    }

    async saveSettings(settings, userId) {
        const currentSettings = await this.getSettings(userId);

        const newSettings = {
            ...currentSettings,
            ...settings,
        };

        this._set(STORAGE_KEYS.SETTINGS, newSettings);
        return newSettings;
    }

    // ==================
    // Project Operations
    // ==================

    async getProjects(userId) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};
        return Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getProjectById(projectId) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};
        const project = projects[projectId] || null;

        if (project && project.files && project.files.length > 0) {
            // Load file data from IndexedDB
            const filesWithData = await Promise.all(
                project.files.map(async (file) => {
                    const storedFile = await fileStorage.getFile(file.id);
                    return storedFile ? { ...file, data: storedFile.data } : file;
                })
            );
            return { ...project, files: filesWithData };
        }

        return project;
    }

    async createProject(projectData) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};
        const now = Date.now();

        const project = {
            id: generateId('proj_'),
            userId: 'local_user',
            name: 'New Project',
            description: '',
            instructions: '',
            visibility: 'private',
            files: [],
            createdAt: now,
            updatedAt: now,
            ...projectData,
        };

        projects[project.id] = project;
        this._set(STORAGE_KEYS.PROJECTS, projects);

        return project;
    }

    async updateProject(projectId, updates) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};

        if (!projects[projectId]) {
            throw new Error(`Project ${projectId} not found`);
        }

        projects[projectId] = {
            ...projects[projectId],
            ...updates,
            updatedAt: Date.now(),
        };

        this._set(STORAGE_KEYS.PROJECTS, projects);
        return projects[projectId];
    }

    async deleteProject(projectId) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};

        if (projects[projectId]) {
            // Delete associated files from IndexedDB
            await fileStorage.deleteFilesByProject(projectId);

            delete projects[projectId];
            this._set(STORAGE_KEYS.PROJECTS, projects);

            // Also unlink any chats associated with this project
            await fileStorage.unlinkProjectFromChats(projectId);

            return true;
        }

        return false;
    }

    async addProjectFile(projectId, fileData) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};

        if (!projects[projectId]) {
            throw new Error(`Project ${projectId} not found`);
        }

        const fileId = generateId('file_');
        const { data, ...metadata } = fileData;

        // Store file data in IndexedDB (avoids localStorage quota limits)
        if (data) {
            await fileStorage.storeFile(fileId, projectId, data, {
                name: metadata.name,
                type: metadata.type,
                size: metadata.size,
            });
        }

        // Store metadata in localStorage (without the large data blob)
        const file = {
            id: fileId,
            projectId,
            name: '',
            type: '',
            size: 0,
            createdAt: Date.now(),
            ...metadata,
            // Don't store data in localStorage - it's in IndexedDB
        };

        projects[projectId].files = projects[projectId].files || [];
        projects[projectId].files.push(file);
        projects[projectId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.PROJECTS, projects);

        // Return file with data for immediate use
        return { ...file, data };
    }

    async removeProjectFile(projectId, fileId) {
        const projects = this._get(STORAGE_KEYS.PROJECTS) || {};

        if (!projects[projectId]) {
            throw new Error(`Project ${projectId} not found`);
        }

        const fileIndex = projects[projectId].files?.findIndex(f => f.id === fileId);
        if (fileIndex === -1 || fileIndex === undefined) {
            return false;
        }

        // Remove from IndexedDB
        await fileStorage.deleteFile(fileId);

        // Remove from localStorage
        projects[projectId].files.splice(fileIndex, 1);
        projects[projectId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.PROJECTS, projects);
        return true;
    }

    async getProjectChats(projectId) {
        await this._ensureMigrated();
        const chats = await fileStorage.getChatsByProject(projectId);
        return chats.map(stripMessages);
    }

    // ==================
    // Bulk Operations
    // ==================

    async exportAll(userId) {
        await this._ensureMigrated();
        const metaList = await fileStorage.getAllChatMetadata();
        const fullChats = {};
        for (const chatMeta of metaList) {
            const messages = await fileStorage.getMessagesByChat(chatMeta.id);
            fullChats[chatMeta.id] = {
                ...chatMeta,
                messages: messages || [],
            };
        }

        return {
            chats: fullChats,
            projects: this._get(STORAGE_KEYS.PROJECTS) || {},
            user: this._get(STORAGE_KEYS.USER),
            settings: this._get(STORAGE_KEYS.SETTINGS),
            exportedAt: new Date().toISOString(),
            version: '1.2', // Bumped version for IndexedDB messages
        };
    }

    async importAll(data, userId) {
        try {
            if (data.chats) {
                // Separate messages and metadata
                const metaList = [];
                for (const chatId in data.chats) {
                    const { messages, ...meta } = data.chats[chatId];
                    const chatMeta = {
                        ...meta,
                        messageCount: messages ? messages.length : 0,
                    };
                    metaList.push(chatMeta);

                    // Store messages in IndexedDB
                    if (messages && messages.length > 0) {
                        const messagesWithChatId = messages.map(msg => ({
                            ...msg,
                            chatId: chatId,
                        }));
                        await fileStorage.storeMessages(messagesWithChatId);
                    }
                }
                await fileStorage.saveChatMetadataBatch(metaList);
            }
            if (data.projects) {
                this._set(STORAGE_KEYS.PROJECTS, data.projects);
            }
            if (data.user) {
                this._set(STORAGE_KEYS.USER, data.user);
            }
            if (data.settings) {
                this._set(STORAGE_KEYS.SETTINGS, data.settings);
            }
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }

    async clearAll(userId) {
        // Clear files and messages from IndexedDB
        await fileStorage.clearAllFiles();
        await fileStorage.clearAllMessages();
        await fileStorage.clearAllChatMetadata();

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.PROJECTS);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        localStorage.removeItem(MESSAGES_MIGRATION_KEY);
        localStorage.removeItem(CHATS_MIGRATION_KEY);
        this._initializeStorage();
        return true;
    }
}

