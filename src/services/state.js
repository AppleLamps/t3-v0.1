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
     * Create a new chat
     * @returns {Promise<Object>}
     */
    async createChat() {
        const chat = await repository.createChat({
            title: 'New Chat',
            messages: [],
        });
        
        this.state.chats[chat.id] = chat;
        this.state.currentChatId = chat.id;
        
        this._notify('chatCreated', chat);
        this._notify('currentChatChanged', chat);
        
        return chat;
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
     * @param {Object} updates 
     * @returns {Promise<Object>}
     */
    async updateCurrentChat(updates) {
        if (!this.state.currentChatId) return null;
        
        const chat = await repository.updateChat(this.state.currentChatId, updates);
        this.state.chats[chat.id] = chat;
        
        this._notify('chatUpdated', chat);
        return chat;
    }
    
    /**
     * Delete a chat
     * @param {string} chatId 
     */
    async deleteChat(chatId) {
        await repository.deleteChat(chatId);
        delete this.state.chats[chatId];
        
        // If deleted current chat, switch to another
        if (this.state.currentChatId === chatId) {
            const remaining = this.allChats;
            if (remaining.length > 0) {
                this.state.currentChatId = remaining[0].id;
            } else {
                const newChat = await this.createChat();
                this.state.currentChatId = newChat.id;
            }
        }
        
        this._notify('chatDeleted', chatId);
        this._notify('currentChatChanged', this.currentChat);
    }
    
    /**
     * Add message to current chat
     * @param {Object} messageData 
     * @returns {Promise<Object>}
     */
    async addMessage(messageData) {
        if (!this.state.currentChatId) return null;
        
        const message = await repository.addMessage(this.state.currentChatId, messageData);
        
        // Refresh chat from repo to get updated messages
        const chat = await repository.getChatById(this.state.currentChatId);
        this.state.chats[chat.id] = chat;
        
        // Auto-generate title from first user message
        if (chat.messages.length === 1 && messageData.role === 'user') {
            const title = this._generateTitle(messageData.content);
            await this.updateCurrentChat({ title });
        }
        
        this._notify('messageAdded', { chat, message });
        return message;
    }
    
    /**
     * Update a message in current chat
     * @param {string} messageId 
     * @param {Object} updates 
     * @returns {Promise<Object>}
     */
    async updateMessage(messageId, updates) {
        if (!this.state.currentChatId) return null;
        
        const message = await repository.updateMessage(this.state.currentChatId, messageId, updates);
        
        // Refresh chat
        const chat = await repository.getChatById(this.state.currentChatId);
        this.state.chats[chat.id] = chat;
        
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
     * Update settings
     * @param {Object} updates 
     * @returns {Promise<Object>}
     */
    async updateSettings(updates) {
        this.state.settings = await repository.saveSettings(updates);
        this._notify('settingsUpdated', this.state.settings);
        return this.state.settings;
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

