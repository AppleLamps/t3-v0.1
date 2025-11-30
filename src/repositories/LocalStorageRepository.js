// LocalStorage Repository Implementation
// ======================================
// This implements the BaseRepository interface using localStorage.
// Can be swapped out for NeonRepository when migrating to database.

import { BaseRepository } from './BaseRepository.js';
import { STORAGE_KEYS } from '../config/constants.js';
import { DEFAULT_MODEL, MODELS } from '../config/models.js';

/**
 * Generate a unique ID
 * @param {string} prefix 
 * @returns {string}
 */
function generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * LocalStorage implementation of BaseRepository
 */
export class LocalStorageRepository extends BaseRepository {
    constructor() {
        super();
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

    async getChats(userId) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};
        return Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getChatById(chatId) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};
        return chats[chatId] || null;
    }

    async createChat(chatData) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};
        const now = Date.now();

        const chat = {
            id: generateId('chat_'),
            title: 'New Chat',
            messages: [],
            userId: 'local_user',
            createdAt: now,
            updatedAt: now,
            ...chatData,
        };

        chats[chat.id] = chat;
        this._set(STORAGE_KEYS.CHATS, chats);

        return chat;
    }

    async updateChat(chatId, updates) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
            throw new Error(`Chat ${chatId} not found`);
        }

        chats[chatId] = {
            ...chats[chatId],
            ...updates,
            updatedAt: Date.now(),
        };

        this._set(STORAGE_KEYS.CHATS, chats);
        return chats[chatId];
    }

    async deleteChat(chatId) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (chats[chatId]) {
            delete chats[chatId];
            this._set(STORAGE_KEYS.CHATS, chats);
            return true;
        }

        return false;
    }

    async searchChats(query, userId) {
        const chats = await this.getChats(userId);
        const lowerQuery = query.toLowerCase();

        return chats.filter(chat =>
            chat.title.toLowerCase().includes(lowerQuery) ||
            chat.messages.some(m => m.content.toLowerCase().includes(lowerQuery))
        );
    }

    // ==================
    // Message Operations
    // ==================

    async addMessage(chatId, messageData) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
            throw new Error(`Chat ${chatId} not found`);
        }

        const message = {
            id: generateId('msg_'),
            role: 'user',
            content: '',
            createdAt: Date.now(),
            ...messageData,
        };

        chats[chatId].messages.push(message);
        chats[chatId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.CHATS, chats);
        return message;
    }

    async updateMessage(chatId, messageId, updates) {
        const chats = this._get(STORAGE_KEYS.CHATS) || {};

        if (!chats[chatId]) {
            throw new Error(`Chat ${chatId} not found`);
        }

        const messageIndex = chats[chatId].messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
            throw new Error(`Message ${messageId} not found`);
        }

        chats[chatId].messages[messageIndex] = {
            ...chats[chatId].messages[messageIndex],
            ...updates,
        };
        chats[chatId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.CHATS, chats);
        return chats[chatId].messages[messageIndex];
    }

    async getMessages(chatId) {
        const chat = await this.getChatById(chatId);
        return chat ? chat.messages : [];
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
        return projects[projectId] || null;
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

        const file = {
            id: generateId('file_'),
            projectId,
            name: '',
            type: '',
            data: '',
            size: 0,
            createdAt: Date.now(),
            ...fileData,
        };

        projects[projectId].files = projects[projectId].files || [];
        projects[projectId].files.push(file);
        projects[projectId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.PROJECTS, projects);
        return file;
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

        projects[projectId].files.splice(fileIndex, 1);
        projects[projectId].updatedAt = Date.now();

        this._set(STORAGE_KEYS.PROJECTS, projects);
        return true;
    }

    async getProjectChats(projectId) {
        const chats = await this.getChats();
        return chats.filter(chat => chat.projectId === projectId);
    }

    // ==================
    // Bulk Operations
    // ==================

    async exportAll(userId) {
        return {
            chats: this._get(STORAGE_KEYS.CHATS) || {},
            projects: this._get(STORAGE_KEYS.PROJECTS) || {},
            user: this._get(STORAGE_KEYS.USER),
            settings: this._get(STORAGE_KEYS.SETTINGS),
            exportedAt: new Date().toISOString(),
            version: '1.1',
        };
    }

    async importAll(data, userId) {
        try {
            if (data.chats) {
                this._set(STORAGE_KEYS.CHATS, data.chats);
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
        localStorage.removeItem(STORAGE_KEYS.CHATS);
        localStorage.removeItem(STORAGE_KEYS.PROJECTS);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        this._initializeStorage();
        return true;
    }
}

