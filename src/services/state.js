// State Management Service
// ========================
// Centralized state management with pub/sub pattern for UI updates

import { repository } from '../repositories/index.js';
import { DEFAULT_MODEL } from '../config/models.js';

/**
 * @typedef {Object} AppState
 * @property {string|null} currentChatId - Currently active chat ID
 * @property {boolean} isStreaming - Whether a response is being streamed
 * @property {boolean} sidebarOpen - Sidebar visibility
 * @property {Object} user - Current user data
 * @property {Object} settings - User settings
 * @property {Object<string, Object>} chats - Cached chats
 */

/**
 * State manager with reactive updates
 */
class StateManager {
    constructor() {
        /** @type {AppState} */
        this.state = {
            currentChatId: null,
            isStreaming: false,
            sidebarOpen: true,
            user: null,
            settings: null,
            chats: {},
        };

        /** @type {Map<string, Set<Function>>} */
        this.listeners = new Map();

        this._initialized = false;

        // Track pending chat creation promises for optimistic updates
        // Maps temp chat ID → Promise that resolves with real server chat ID
        /** @type {Map<string, Promise<string>>} */
        this._pendingChatCreations = new Map();
    }

    /**
     * Initialize state from repository
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) return;

        // Load user and settings
        this.state.user = await repository.getUser();
        this.state.settings = await repository.getSettings();

        // Load chats
        const chats = await repository.getChats();
        this.state.chats = chats.reduce((acc, chat) => {
            acc[chat.id] = chat;
            return acc;
        }, {});

        // Set current chat to most recent, or create new one
        if (chats.length > 0) {
            this.state.currentChatId = chats[0].id;
        } else {
            const newChat = await this.createChat();
            this.state.currentChatId = newChat.id;
        }

        this._initialized = true;
        this._notify('initialized');
    }

    /**
     * Subscribe to state changes
     * @param {string} event - Event name ('*' for all)
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Notify listeners of state change
     * @private
     * @param {string} event - Event name
     * @param {any} [data] - Optional data
     */
    _notify(event, data) {
        // Notify specific listeners
        this.listeners.get(event)?.forEach(cb => cb(this.state, data));
        // Notify wildcard listeners
        this.listeners.get('*')?.forEach(cb => cb(this.state, event, data));
    }

    // ==================
    // Getters
    // ==================

    get currentChat() {
        return this.state.currentChatId ? this.state.chats[this.state.currentChatId] : null;
    }

    get allChats() {
        return Object.values(this.state.chats).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    get user() {
        return this.state.user;
    }

    get settings() {
        return this.state.settings;
    }

    get isStreaming() {
        return this.state.isStreaming;
    }

    get sidebarOpen() {
        return this.state.sidebarOpen;
    }

    // ==================
    // Chat Operations
    // ==================

    /**
     * Generate a temporary ID for optimistic updates
     * @private
     * @returns {string}
     */
    _generateTempId() {
        return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a new chat
     * Uses optimistic updates for instant UI response
     * @returns {Promise<Object>}
     */
    async createChat() {
        const now = Date.now();
        const tempId = this._generateTempId();

        // Create optimistic chat immediately for instant UI feedback
        const optimisticChat = {
            id: tempId,
            title: 'New Chat',
            messages: [],
            createdAt: now,
            updatedAt: now,
            _isOptimistic: true, // Flag to track optimistic state
        };

        // Update UI immediately
        this.state.chats[tempId] = optimisticChat;
        this.state.currentChatId = tempId;
        this._notify('chatCreated', optimisticChat);
        this._notify('currentChatChanged', optimisticChat);

        // Create a promise that resolves with the real chat ID
        // This allows addMessage to wait for the real ID if needed
        let resolveRealId;
        const realIdPromise = new Promise(resolve => {
            resolveRealId = resolve;
        });
        this._pendingChatCreations.set(tempId, realIdPromise);

        // Sync with server in background
        try {
            const serverChat = await repository.createChat({
                title: 'New Chat',
                messages: [],
            });

            if (!serverChat || !serverChat.id) {
                console.error('Failed to create chat on server');
                this._pendingChatCreations.delete(tempId);
                resolveRealId(tempId); // Resolve with temp ID as fallback
                return optimisticChat;
            }

            // Migrate any messages that were added while waiting
            const pendingMessages = optimisticChat.messages || [];
            serverChat.messages = pendingMessages;

            // Replace optimistic chat with server chat
            delete this.state.chats[tempId];
            this.state.chats[serverChat.id] = serverChat;

            // Update currentChatId if it was still pointing to temp
            if (this.state.currentChatId === tempId) {
                this.state.currentChatId = serverChat.id;
            }

            // Resolve the pending promise with the real ID
            this._pendingChatCreations.delete(tempId);
            resolveRealId(serverChat.id);

            // Notify about the update (subtle, no need to re-render completely)
            this._notify('chatUpdated', serverChat);

            return serverChat;
        } catch (error) {
            console.error('Background chat sync failed:', error);
            this._pendingChatCreations.delete(tempId);
            resolveRealId(tempId); // Resolve with temp ID as fallback
            // Keep the optimistic chat - user can still use it
            return optimisticChat;
        }
    }

    /**
     * Select a chat
     * @param {string} chatId 
     */
    async selectChat(chatId) {
        if (this.state.chats[chatId]) {
            this.state.currentChatId = chatId;
            this._notify('currentChatChanged', this.state.chats[chatId]);
        }
    }

    /**
     * Update current chat
     * Uses optimistic updates for instant UI response
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateCurrentChat(updates) {
        if (!this.state.currentChatId) return null;

        const chatId = this.state.currentChatId;
        const existingChat = this.state.chats[chatId];
        if (!existingChat) return null;

        // IMMEDIATELY update local state (optimistic update)
        const updatedChat = {
            ...existingChat,
            ...updates,
            updatedAt: Date.now(),
        };
        this.state.chats[chatId] = updatedChat;

        // Notify UI immediately
        this._notify('chatUpdated', updatedChat);

        // Sync with server in background (only for non-temp chats)
        if (!chatId.startsWith('temp_')) {
            repository.updateChat(chatId, updates).catch(error => {
                console.error('Failed to update chat on server:', error);
            });
        }

        return updatedChat;
    }

    /**
     * Delete a chat
     * Uses optimistic updates for instant UI response
     * @param {string} chatId
     */
    async deleteChat(chatId) {
        // Store chat for potential rollback
        const deletedChat = this.state.chats[chatId];

        // IMMEDIATELY remove from local state (optimistic update)
        delete this.state.chats[chatId];

        // If deleted current chat, switch to another immediately
        if (this.state.currentChatId === chatId) {
            const remaining = this.allChats;
            if (remaining.length > 0) {
                this.state.currentChatId = remaining[0].id;
            } else {
                // Create new chat (also uses optimistic updates)
                await this.createChat();
            }
        }

        // Notify UI immediately
        this._notify('chatDeleted', chatId);
        this._notify('currentChatChanged', this.currentChat);

        // Delete from server in background (fire and forget)
        // Only delete from server if it's not an optimistic-only chat
        if (!chatId.startsWith('temp_')) {
            repository.deleteChat(chatId).catch(error => {
                console.error('Failed to delete chat from server:', error);
                // Could implement rollback here if needed:
                // this.state.chats[chatId] = deletedChat;
                // this._notify('chatCreated', deletedChat);
            });
        }
    }

    /**
     * Add message to current chat with optimistic updates
     * @param {Object} messageData
     * @param {Object} [options={}] - Options for the operation
     * @param {boolean} [options.waitForPersist=false] - Whether to wait for server persistence
     * @returns {Promise<Object>}
     */
    async addMessage(messageData, options = {}) {
        const { waitForPersist = false } = options;

        if (!this.state.currentChatId) return null;

        const chatId = this.state.currentChatId;
        const chat = this.state.chats[chatId];
        if (!chat) {
            console.error('Chat not found in local state');
            return null;
        }

        // Generate UUID client-side for instant optimistic updates
        const messageId = messageData.id || crypto.randomUUID();
        const optimisticMessage = {
            ...messageData,
            id: messageId,
            createdAt: Date.now(),
        };

        // IMMEDIATELY update local state (optimistic update)
        chat.messages.push(optimisticMessage);
        chat.updatedAt = Date.now();

        // Notify listeners IMMEDIATELY so UI updates instantly
        this._notify('messageAdded', { chat, message: optimisticMessage });

        // Auto-generate title from first user message (fire and forget)
        if (chat.messages.length === 1 && messageData.role === 'user') {
            const title = this._generateTitle(messageData.content);
            this.updateCurrentChat({ title }).catch(err =>
                console.error('Failed to update chat title:', err)
            );
        }

        // Persist to server in background
        // If chat is still optimistic (temp ID), wait for real ID first
        const persistPromise = (async () => {
            let realChatId = chatId;

            // Check if this is a pending optimistic chat
            if (this._pendingChatCreations.has(chatId)) {
                realChatId = await this._pendingChatCreations.get(chatId);
            }

            // Only persist if we have a real (non-temp) chat ID
            if (!realChatId.startsWith('temp_')) {
                return repository.addMessage(realChatId, {
                    ...messageData,
                    id: messageId,
                    createdAt: optimisticMessage.createdAt, // Pass client timestamp for proper ordering
                }).catch(error => {
                    console.error('Failed to persist message:', error);
                    return null;
                });
            }
            return null;
        })();

        // Only await if caller explicitly needs to wait for persistence
        if (waitForPersist) {
            await persistPromise;
        }

        return optimisticMessage;
    }

    /**
     * Update a message in current chat
     * Uses optimistic updates for instant UI response
     * @param {string} messageId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateMessage(messageId, updates) {
        if (!this.state.currentChatId) return null;

        const chatId = this.state.currentChatId;
        const chat = this.state.chats[chatId];
        if (!chat) {
            console.error('Chat not found in local state');
            return null;
        }

        // Find the message in the local array
        const msgIndex = chat.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) {
            console.error('Message not found in local state');
            return null;
        }

        // IMMEDIATELY update local state (optimistic update)
        const updatedMessage = {
            ...chat.messages[msgIndex],
            ...updates,
        };
        chat.messages[msgIndex] = updatedMessage;
        chat.updatedAt = Date.now();

        // Notify UI immediately
        this._notify('messageUpdated', { chat, message: updatedMessage });

        // Sync with server in background (only for non-temp chats)
        if (!chatId.startsWith('temp_')) {
            repository.updateMessage(chatId, messageId, updates).catch(error => {
                console.error('Failed to update message on server:', error);
            });
        }

        return updatedMessage;
    }

    /**
     * Update a streaming message in memory only (no disk write)
     * Used during streaming to avoid blocking the main thread with localStorage writes
     * @param {string} messageId 
     * @param {string} content - The streaming content
     * @returns {Object|null} - The updated message or null
     */
    updateStreamingMessage(messageId, content) {
        if (!this.state.currentChatId) return null;

        const chat = this.state.chats[this.state.currentChatId];
        if (!chat) return null;

        // Find and update the message in memory
        const message = chat.messages.find(m => m.id === messageId);
        if (!message) return null;

        message.content = content;

        // Notify listeners without persisting to storage
        this._notify('messageUpdated', { chat, message });
        return message;
    }

    /**
     * Generate title from message content
     * @private
     * @param {string} content 
     * @returns {string}
     */
    _generateTitle(content) {
        const cleaned = content.replace(/[#*`]/g, '').trim();
        const words = cleaned.split(/\s+/).slice(0, 6);
        let title = words.join(' ');
        if (title.length > 40) {
            title = title.substring(0, 40) + '...';
        }
        return title || 'New Chat';
    }

    // ==================
    // User Operations
    // ==================

    /**
     * Update user data
     * @param {Object} updates 
     * @returns {Promise<Object>}
     */
    async updateUser(updates) {
        this.state.user = await repository.saveUser(updates);
        this._notify('userUpdated', this.state.user);
        return this.state.user;
    }

    // ==================
    // Settings Operations
    // ==================

    /**
     * Update settings with optimistic updates for instant UI response
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateSettings(updates) {
        // Store previous state for potential rollback
        const previousSettings = { ...this.state.settings };

        // IMMEDIATELY update local state (optimistic update)
        this.state.settings = { ...this.state.settings, ...updates };

        // Notify listeners IMMEDIATELY so UI updates instantly
        this._notify('settingsUpdated', this.state.settings);

        // Sync with server in background
        try {
            const serverSettings = await repository.saveSettings(updates);
            // Update with server response (may include additional fields)
            this.state.settings = serverSettings;
            // Only notify again if server response differs
            if (JSON.stringify(serverSettings) !== JSON.stringify({ ...previousSettings, ...updates })) {
                this._notify('settingsUpdated', this.state.settings);
            }
            return this.state.settings;
        } catch (error) {
            console.error('Failed to save settings to server:', error);
            // Rollback on error
            this.state.settings = previousSettings;
            this._notify('settingsUpdated', this.state.settings);
            throw error;
        }
    }

    // ==================
    // UI State
    // ==================

    /**
     * Set streaming state
     * @param {boolean} isStreaming 
     */
    setStreaming(isStreaming) {
        this.state.isStreaming = isStreaming;
        this._notify('streamingChanged', isStreaming);
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        this._notify('sidebarToggled', this.state.sidebarOpen);
    }

    /**
     * Set sidebar state
     * @param {boolean} open 
     */
    setSidebar(open) {
        this.state.sidebarOpen = open;
        this._notify('sidebarToggled', open);
    }

    // ==================
    // Data Operations
    // ==================

    /**
     * Export all data
     * @returns {Promise<Object>}
     */
    async exportData() {
        return repository.exportAll();
    }

    /**
     * Import data
     * @param {Object} data 
     * @returns {Promise<boolean>}
     */
    async importData(data) {
        const success = await repository.importAll(data);
        if (success) {
            // Reinitialize state
            this._initialized = false;
            await this.initialize();
        }
        return success;
    }

    /**
     * Clear all data
     * @returns {Promise<boolean>}
     */
    async clearAllData() {
        const success = await repository.clearAll();
        if (success) {
            this.state.chats = {};
            this.state.currentChatId = null;
            const newChat = await this.createChat();
            this.state.currentChatId = newChat.id;
            this._notify('dataCleared');
        }
        return success;
    }

    /**
     * Search chats
     * @param {string} query 
     * @returns {Promise<Object[]>}
     */
    async searchChats(query) {
        if (!query.trim()) {
            return this.allChats;
        }
        return repository.searchChats(query);
    }
}

// Singleton instance
export const stateManager = new StateManager();

