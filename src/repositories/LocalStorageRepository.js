// LocalStorage Repository Implementation
// ======================================
// This implements the BaseRepository interface using localStorage.
// File data and messages are stored in IndexedDB to avoid localStorage quota limits.
// Can be swapped out for NeonRepository when migrating to database.

import { BaseRepository } from './BaseRepository.js';
import { STORAGE_KEYS } from '../config/constants.js';
import { DEFAULT_MODEL, MODELS } from '../config/models.js';
import * as fileStorage from '../utils/fileStorage.js';

// Key for tracking if migration has been done
const MIGRATION_KEY = 'lampchat_messages_migrated';

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
        if (!localStorage.getItem(STORAGE_KEYS.CHATS)) {
            localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify({}));
        }
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

        // Run migration from localStorage messages to IndexedDB (once)
        this._migrationPromise = this._migrateMessagesToIndexedDB();
    }

    /**
     * Migrate messages from localStorage to IndexedDB
     * This only runs once and removes messages from localStorage after migration
     * @private
     */
    async _migrateMessagesToIndexedDB() {
        // Check if migration has already been done
        if (localStorage.getItem(MIGRATION_KEY)) {
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
            localStorage.setItem(MIGRATION_KEY, 'true');
        } catch (error) {
            console.error('Failed to migrate messages to IndexedDB:', error);
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
        const allChats = this._get(STORAGE_KEYS.CHATS) || {};

        // Filter and sort all chats
        let filteredChats = Object.values(allChats);
        if (projectId) {
            filteredChats = filteredChats.filter(chat => chat.projectId === projectId);
        }
        filteredChats.sort((a, b) => b.updatedAt - a.updatedAt);

        // Calculate pagination
        const total = filteredChats.length;
        const paginatedChats = filteredChats.slice(offset, offset + limit).map(stripMessages);
        const hasMore = offset + paginatedChats.length < total;

        return { chats: paginatedChats, hasMore, total };
    }

    async getChatById(chatId) {
        await this._ensureMigrated();
        const chats = this._get(STORAGE_KEYS.CHATS) || {};
        const chatMeta = chats[chatId];

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
        const chats = this._get(STORAGE_KEYS.CHATS) || {};
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
        chats[chat.id] = chatMeta;
        this._set(STORAGE_KEYS.CHATS, chats);

        // Return full chat with messages for immediate use
        return { ...chatMeta, messages: messages || [] };
    }

    async updateChat(chatId, updates) {
        await this._ensureMigrated();
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
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

        chats[chatId] = {
            ...chats[chatId],
            ...metaUpdates,
            updatedAt: Date.now(),
        };

        this._set(STORAGE_KEYS.CHATS, chats);

        // Return full chat with messages
        const allMessages = await fileStorage.getMessagesByChat(chatId);
        return { ...chats[chatId], messages: allMessages };
    }

    async deleteChat(chatId) {
        await this._ensureMigrated();
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (chats[chatId]) {
            // Delete messages from IndexedDB
            await fileStorage.deleteMessagesByChat(chatId);

            delete chats[chatId];
            this._set(STORAGE_KEYS.CHATS, chats);
            return true;
        }

        return false;
    }

    async searchChats(query, userId, options = {}) {
        await this._ensureMigrated();
        const { limit = 20, offset = 0 } = options;
        const allChats = this._get(STORAGE_KEYS.CHATS) || {};
        const lowerQuery = query.toLowerCase();

        // Search through chats and their messages
        const matchingChatPromises = Object.values(allChats).map(async (chatMeta) => {
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
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
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
        chats[chatId].messageCount = (chats[chatId].messageCount || 0) + 1;
        chats[chatId].updatedAt = Date.now();
        this._set(STORAGE_KEYS.CHATS, chats);

        return message;
    }

    async updateMessage(chatId, messageId, updates) {
        await this._ensureMigrated();
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
            throw new Error(`Chat ${chatId} not found`);
        }

        // Update message in IndexedDB
        const updatedMessage = await fileStorage.updateMessage(messageId, updates);

        if (!updatedMessage) {
            throw new Error(`Message ${messageId} not found`);
        }

        // Update chat timestamp
        chats[chatId].updatedAt = Date.now();
        this._set(STORAGE_KEYS.CHATS, chats);

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
            const chats = this._get(STORAGE_KEYS.CHATS) || {};
            let updated = false;
            for (const chatId in chats) {
                if (chats[chatId].projectId === projectId) {
                    chats[chatId].projectId = null;
                    updated = true;
                }
            }
            if (updated) {
                this._set(STORAGE_KEYS.CHATS, chats);
            }

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
        const result = await this.getChats(null, { projectId, limit: 1000, offset: 0 });
        return result.chats;
    }

    // ==================
    // Bulk Operations
    // ==================

    async exportAll(userId) {
        await this._ensureMigrated();
        const chatsMeta = this._get(STORAGE_KEYS.CHATS) || {};

        // Reconstruct full chats with messages from IndexedDB for export
        const fullChats = {};
        for (const chatId in chatsMeta) {
            const messages = await fileStorage.getMessagesByChat(chatId);
            fullChats[chatId] = {
                ...chatsMeta[chatId],
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
                const chatsMeta = {};
                for (const chatId in data.chats) {
                    const { messages, ...meta } = data.chats[chatId];
                    chatsMeta[chatId] = {
                        ...meta,
                        messageCount: messages ? messages.length : 0,
                    };

                    // Store messages in IndexedDB
                    if (messages && messages.length > 0) {
                        const messagesWithChatId = messages.map(msg => ({
                            ...msg,
                            chatId: chatId,
                        }));
                        await fileStorage.storeMessages(messagesWithChatId);
                    }
                }
                this._set(STORAGE_KEYS.CHATS, chatsMeta);
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

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.CHATS);
        localStorage.removeItem(STORAGE_KEYS.PROJECTS);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        localStorage.removeItem(MIGRATION_KEY);
        this._initializeStorage();
        return true;
    }
}

