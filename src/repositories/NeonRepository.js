// Neon Repository Implementation
// ===============================
// This implements the BaseRepository interface using Neon PostgreSQL via API calls.
// Used when user is authenticated; all data is stored in the cloud.

import { BaseRepository } from './BaseRepository.js';
import { authService } from '../services/auth.js';
import { DEFAULT_MODEL, MODELS } from '../config/models.js';

/**
 * Neon PostgreSQL implementation of BaseRepository
 * All operations are proxied through Vercel serverless functions
 */
export class NeonRepository extends BaseRepository {
    constructor() {
        super();
    }

    /**
     * Make an authenticated API request to the data endpoint
     * @private
     * @param {string} action - The action to perform
     * @param {Object} [params={}] - Additional parameters
     * @returns {Promise<any>}
     */
    async _request(action, params = {}) {
        return authService.apiRequest('/api/data', {
            action,
            ...params,
        });
    }

    // ==================
    // Chat Operations
    // ==================

    async getChats(userId, options = {}) {
        try {
            const { limit = 20, offset = 0, projectId = null } = options;
            const result = await this._request('getChats', {
                data: { projectId, limit, offset },
            });
            // API now returns { chats, hasMore, total }
            return {
                chats: result?.chats || [],
                hasMore: result?.hasMore || false,
                total: result?.total || 0,
            };
        } catch (error) {
            console.error('NeonRepository.getChats error:', error);
            return { chats: [], hasMore: false, total: 0 };
        }
    }

    async getChatById(chatId) {
        try {
            const chat = await this._request('getChatById', { chatId });
            return chat || null;
        } catch (error) {
            console.error('NeonRepository.getChatById error:', error);
            return null;
        }
    }

    async createChat(chatData) {
        try {
            const chat = await this._request('createChat', { data: chatData });
            return chat;
        } catch (error) {
            console.error('NeonRepository.createChat error:', error);
            throw error;
        }
    }

    async updateChat(chatId, updates) {
        try {
            const chat = await this._request('updateChat', { chatId, data: updates });
            return chat;
        } catch (error) {
            console.error('NeonRepository.updateChat error:', error);
            throw error;
        }
    }

    async deleteChat(chatId) {
        try {
            await this._request('deleteChat', { chatId });
            return true;
        } catch (error) {
            console.error('NeonRepository.deleteChat error:', error);
            return false;
        }
    }

    async searchChats(query, userId, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;
            const result = await this._request('searchChats', {
                data: { query, limit, offset },
            });
            // API now returns { chats, hasMore, total }
            return {
                chats: result?.chats || [],
                hasMore: result?.hasMore || false,
                total: result?.total || 0,
            };
        } catch (error) {
            console.error('NeonRepository.searchChats error:', error);
            return { chats: [], hasMore: false, total: 0 };
        }
    }

    // ==================
    // Message Operations
    // ==================

    async addMessage(chatId, messageData) {
        try {
            // Generate UUID client-side for optimistic updates
            // This allows the UI to update immediately without waiting for server response
            const clientId = messageData.id || crypto.randomUUID();
            const dataWithId = { ...messageData, id: clientId };

            const message = await this._request('addMessage', { chatId, data: dataWithId });
            return message;
        } catch (error) {
            console.error('NeonRepository.addMessage error:', error);
            throw error;
        }
    }

    async updateMessage(chatId, messageId, updates) {
        try {
            const message = await this._request('updateMessage', { chatId, messageId, data: updates });
            return message;
        } catch (error) {
            console.error('NeonRepository.updateMessage error:', error);
            throw error;
        }
    }

    async getMessages(chatId) {
        try {
            const messages = await this._request('getMessages', { chatId });
            return messages || [];
        } catch (error) {
            console.error('NeonRepository.getMessages error:', error);
            return [];
        }
    }

    // ==================
    // User Operations
    // ==================

    async getUser(userId) {
        try {
            // Return the authenticated user from auth service
            const user = authService.currentUser;
            if (user) {
                return {
                    id: user.id,
                    name: user.name || '',
                    email: user.email,
                    createdAt: new Date(user.createdAt).getTime(),
                    updatedAt: user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now(),
                };
            }
            return null;
        } catch (error) {
            console.error('NeonRepository.getUser error:', error);
            return null;
        }
    }

    async saveUser(userData) {
        try {
            const result = await authService.updateName(userData.name);
            if (result.success) {
                return {
                    id: result.user.id,
                    name: result.user.name || '',
                    email: result.user.email,
                    createdAt: new Date(result.user.createdAt).getTime(),
                    updatedAt: Date.now(),
                };
            }
            throw new Error(result.error);
        } catch (error) {
            console.error('NeonRepository.saveUser error:', error);
            throw error;
        }
    }

    // ==================
    // Settings Operations
    // ==================

    async getSettings(userId) {
        try {
            const settings = await this._request('getSettings');
            return {
                apiKey: settings.apiKey || '',
                selectedModel: settings.selectedModel || DEFAULT_MODEL,
                enabledModels: settings.enabledModels || MODELS.map(m => m.id),
                webSearchEnabled: settings.webSearchEnabled || false,
            };
        } catch (error) {
            console.error('NeonRepository.getSettings error:', error);
            // Return defaults on error
            return {
                apiKey: '',
                selectedModel: DEFAULT_MODEL,
                enabledModels: MODELS.map(m => m.id),
                webSearchEnabled: false,
            };
        }
    }

    async saveSettings(settings, userId) {
        try {
            const result = await this._request('saveSettings', { data: settings });
            return {
                apiKey: result.apiKey || '',
                selectedModel: result.selectedModel || DEFAULT_MODEL,
                enabledModels: result.enabledModels || MODELS.map(m => m.id),
                webSearchEnabled: result.webSearchEnabled || false,
            };
        } catch (error) {
            console.error('NeonRepository.saveSettings error:', error);
            throw error;
        }
    }

    // ==================
    // Project Operations
    // ==================

    async getProjects(userId) {
        try {
            const projects = await this._request('getProjects');
            return projects || [];
        } catch (error) {
            console.error('NeonRepository.getProjects error:', error);
            return [];
        }
    }

    async getProjectById(projectId) {
        try {
            const project = await this._request('getProjectById', { projectId });
            return project || null;
        } catch (error) {
            console.error('NeonRepository.getProjectById error:', error);
            return null;
        }
    }

    async createProject(projectData) {
        try {
            const project = await this._request('createProject', { data: projectData });
            return project;
        } catch (error) {
            console.error('NeonRepository.createProject error:', error);
            throw error;
        }
    }

    async updateProject(projectId, updates) {
        try {
            const project = await this._request('updateProject', { projectId, data: updates });
            return project;
        } catch (error) {
            console.error('NeonRepository.updateProject error:', error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            await this._request('deleteProject', { projectId });
            return true;
        } catch (error) {
            console.error('NeonRepository.deleteProject error:', error);
            return false;
        }
    }

    async addProjectFile(projectId, fileData) {
        try {
            const file = await this._request('addProjectFile', { projectId, data: fileData });
            return file;
        } catch (error) {
            console.error('NeonRepository.addProjectFile error:', error);
            throw error;
        }
    }

    async removeProjectFile(projectId, fileId) {
        try {
            await this._request('removeProjectFile', { projectId, fileId });
            return true;
        } catch (error) {
            console.error('NeonRepository.removeProjectFile error:', error);
            return false;
        }
    }

    async getProjectChats(projectId) {
        try {
            const chats = await this._request('getProjectChats', { projectId });
            return chats || [];
        } catch (error) {
            console.error('NeonRepository.getProjectChats error:', error);
            return [];
        }
    }

    // ==================
    // Bulk Operations
    // ==================

    async exportAll(userId) {
        try {
            const data = await this._request('exportAll');
            return data;
        } catch (error) {
            console.error('NeonRepository.exportAll error:', error);
            return {
                chats: {},
                projects: {},
                user: null,
                settings: null,
                exportedAt: new Date().toISOString(),
                version: '1.1',
            };
        }
    }

    async importAll(data, userId) {
        try {
            await this._request('importAll', { data });
            return true;
        } catch (error) {
            console.error('NeonRepository.importAll error:', error);
            return false;
        }
    }

    async clearAll(userId) {
        try {
            await this._request('clearAll');
            return true;
        } catch (error) {
            console.error('NeonRepository.clearAll error:', error);
            return false;
        }
    }
}

