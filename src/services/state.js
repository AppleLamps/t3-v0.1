// State Management Service
// ========================
// Centralized state management with pub/sub pattern for UI updates

import { repository } from '../repositories/index.js';
import { DEFAULT_MODEL } from '../config/models.js';

/**
 * @typedef {Object} AppState
 * @property {string|null} currentChatId - Currently active chat ID
 * @property {string|null} currentProjectId - Currently active project ID
 * @property {boolean} isStreaming - Whether a response is being streamed
 * @property {boolean} sidebarOpen - Sidebar visibility
 * @property {Object} user - Current user data
 * @property {Object} settings - User settings
 * @property {Object<string, Object>} chats - Cached chats
 * @property {Object<string, Object>} projects - Cached projects
 * @property {boolean} hasMoreChats - Whether there are more chats to load
 * @property {boolean} isLoadingChats - Whether chats are currently being loaded
 * @property {number} chatOffset - Current pagination offset
 * @property {number} chatLimit - Number of chats to load per page
 */

/** @constant {number} */
const DEFAULT_CHAT_LIMIT = 20;

/**
 * State manager with reactive updates
 */
class StateManager {
    constructor() {
        /** @type {AppState} */
        this.state = {
            currentChatId: null,
            currentProjectId: null,
            isStreaming: false,
            sidebarOpen: true,
            user: null,
            settings: null,
            chats: {},
            projects: {},
            // Chat message caches
            messagesByChatId: {},
            messagesLoadingByChatId: {},
            messagesErrorByChatId: {},
            // Pagination state
            hasMoreChats: false,
            isLoadingChats: false,
            chatOffset: 0,
            chatLimit: DEFAULT_CHAT_LIMIT,
        };

        /** @type {Map<string, Set<Function>>} */
        this.listeners = new Map();

        this._initialized = false;

        // Track pending chat creation promises for optimistic updates
        // Maps temp chat ID → Promise that resolves with real server chat ID
        /** @type {Map<string, Promise<string>>} */
        this._pendingChatCreations = new Map();

        // Track in-flight message loading operations per chat
        /** @type {Map<string, Promise<Object[]>>} */
        this._messageLoadPromises = new Map();
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

        // Reset message caches on fresh init
        this.state.messagesByChatId = {};
        this.state.messagesLoadingByChatId = {};
        this.state.messagesErrorByChatId = {};
        this._messageLoadPromises.clear();

        // Load chats with pagination (first page)
        this.state.isLoadingChats = true;
        const chatsResult = await repository.getChats(null, {
            limit: this.state.chatLimit,
            offset: 0,
        });

        // Store chats and pagination state
        this.state.chats = {};
        for (const chat of chatsResult.chats) {
            this._storeChatMetadata(chat);
        }
        this.state.hasMoreChats = chatsResult.hasMore;
        this.state.chatOffset = chatsResult.chats.length;
        this.state.isLoadingChats = false;

        // Load projects
        const projects = await repository.getProjects();
        this.state.projects = projects.reduce((acc, project) => {
            acc[project.id] = project;
            return acc;
        }, {});

        // Set current chat to most recent, or create new one
        if (chatsResult.chats.length > 0) {
            this.state.currentChatId = chatsResult.chats[0].id;
        } else {
            const newChat = await this.createChat();
            this.state.currentChatId = newChat.id;
        }

        if (this.state.currentChatId) {
            this.loadMessages(this.state.currentChatId).catch(error => {
                console.error('Failed to preload messages for initial chat:', error);
            });
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

    get currentProject() {
        return this.state.currentProjectId ? this.state.projects[this.state.currentProjectId] : null;
    }

    get allChats() {
        // Filter by current project if one is selected
        const chats = Object.values(this.state.chats);
        if (this.state.currentProjectId) {
            return chats
                .filter(chat => chat.projectId === this.state.currentProjectId)
                .sort((a, b) => b.updatedAt - a.updatedAt);
        }
        // Return non-project chats when no project is selected
        return chats
            .filter(chat => !chat.projectId)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    get allProjects() {
        return Object.values(this.state.projects).sort((a, b) => b.updatedAt - a.updatedAt);
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

    get hasMoreChats() {
        return this.state.hasMoreChats;
    }

    get isLoadingChats() {
        return this.state.isLoadingChats;
    }

    isChatMessagesLoaded(chatId) {
        if (!chatId) return false;
        return Array.isArray(this.state.messagesByChatId[chatId]);
    }

    isChatMessagesLoading(chatId) {
        if (!chatId) return false;
        return !!this.state.messagesLoadingByChatId[chatId];
    }

    hasChatMessagesError(chatId) {
        if (!chatId) return false;
        return !!this.state.messagesErrorByChatId[chatId];
    }

    // ==================
    // Chat Operations
    // ==================

    /**
     * Generate a temporary ID for optimistic updates
     * Uses crypto.randomUUID() for collision-proof IDs
     * @private
     * @returns {string}
     */
    _generateTempId() {
        return `temp_${crypto.randomUUID()}`;
    }

    /**
     * Ensure chat metadata references the cached messages array if available
     * @private
     * @param {Object} chat
     * @returns {Object}
     */
    _storeChatMetadata(chat) {
        if (!chat || !chat.id) return chat;

        // If messages came down with the payload (e.g. optimistic chat), cache them
        if (Array.isArray(chat.messages)) {
            this._setChatMessages(chat.id, chat.messages);
        }

        const normalized = { ...chat };
        const cachedMessages = this.state.messagesByChatId[chat.id];
        if (cachedMessages) {
            normalized.messages = cachedMessages;
        } else {
            delete normalized.messages;
        }

        if (typeof this.state.messagesLoadingByChatId[chat.id] === 'undefined') {
            this.state.messagesLoadingByChatId[chat.id] = false;
        }

        this.state.chats[chat.id] = normalized;
        return normalized;
    }

    /**
     * Cache the messages array for a chat and keep references in sync
     * @private
     * @param {string} chatId
     * @param {Object[]} messages
     */
    _setChatMessages(chatId, messages = []) {
        this.state.messagesByChatId[chatId] = Array.isArray(messages) ? [...messages] : [];
        if (this.state.chats[chatId]) {
            this.state.chats[chatId].messages = this.state.messagesByChatId[chatId];
        }
    }

    /**
     * Ensure a chat has a mutable messages array in cache
     * @private
     * @param {string} chatId
     * @returns {Object[]}
     */
    _ensureMessageCache(chatId) {
        if (!chatId) return [];
        if (!this.state.messagesByChatId[chatId]) {
            this.state.messagesByChatId[chatId] = [];
            if (this.state.chats[chatId]) {
                this.state.chats[chatId].messages = this.state.messagesByChatId[chatId];
            }
        }
        delete this.state.messagesErrorByChatId[chatId];
        return this.state.messagesByChatId[chatId];
    }

    /**
     * Create a new chat
     * Uses optimistic updates for instant UI response
     * @param {Object} [options={}] - Options for chat creation
     * @param {string} [options.projectId] - Project ID to associate with the chat
     * @returns {Promise<Object>}
     */
    async createChat(options = {}) {
        const { projectId = this.state.currentProjectId } = options;
        const now = Date.now();
        const tempId = this._generateTempId();

        // Create optimistic chat immediately for instant UI feedback
        const optimisticChat = {
            id: tempId,
            title: 'New Chat',
            messages: [],
            projectId: projectId || null,
            createdAt: now,
            updatedAt: now,
            _isOptimistic: true, // Flag to track optimistic state
        };

        // Update UI immediately
        this.state.chats[tempId] = optimisticChat;
        this.state.messagesByChatId[tempId] = optimisticChat.messages;
        this.state.messagesLoadingByChatId[tempId] = false;
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
                projectId: projectId || null,
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
            this._setChatMessages(serverChat.id, pendingMessages);

            // Replace optimistic chat with server chat
            delete this.state.chats[tempId];
            delete this.state.messagesByChatId[tempId];
            delete this.state.messagesLoadingByChatId[tempId];
            delete this.state.messagesErrorByChatId[tempId];
            this._storeChatMetadata(serverChat);

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
            // Lazily load messages for the selected chat
            this.loadMessages(chatId).catch(error => {
                console.error('Failed to load chat messages:', error);
            });
        }
    }

    /**
     * Ensure messages for a chat are loaded and cached
     * @param {string} chatId
     * @param {{ force?: boolean }} [options]
     * @returns {Promise<Object[]>}
     */
    async loadMessages(chatId, options = {}) {
        const { force = false } = options;
        if (!chatId) return [];

        const chat = this.state.chats[chatId];
        if (!chat) {
            return [];
        }

        if (chatId.startsWith('temp_')) {
            return this._ensureMessageCache(chatId);
        }

        if (!force && this.isChatMessagesLoaded(chatId)) {
            return this.state.messagesByChatId[chatId];
        }

        if (this._messageLoadPromises.has(chatId)) {
            return this._messageLoadPromises.get(chatId);
        }

        const loadPromise = (async () => {
            this.state.messagesLoadingByChatId[chatId] = true;
            delete this.state.messagesErrorByChatId[chatId];
            this._notify('messagesLoading', { chatId, isLoading: true });
            try {
                const messages = await repository.getMessages(chatId);
                this._setChatMessages(chatId, messages || []);
                const cached = this.state.messagesByChatId[chatId];
                this._notify('messagesLoaded', { chatId, messages: cached });
                return cached;
            } catch (error) {
                console.error('Failed to load messages:', error);
                this.state.messagesErrorByChatId[chatId] = true;
                this._notify('messagesError', { chatId, error });
                throw error;
            } finally {
                this.state.messagesLoadingByChatId[chatId] = false;
                this._notify('messagesLoading', { chatId, isLoading: false });
                this._messageLoadPromises.delete(chatId);
            }
        })();

        this._messageLoadPromises.set(chatId, loadPromise);
        return loadPromise;
    }

    /**
     * Load more chats for infinite scroll/pagination
     * @returns {Promise<{chats: Object[], hasMore: boolean}>}
     */
    async loadMoreChats() {
        if (this.state.isLoadingChats || !this.state.hasMoreChats) {
            return { chats: [], hasMore: this.state.hasMoreChats };
        }

        this.state.isLoadingChats = true;
        this._notify('chatsLoading', true);

        try {
            const result = await repository.getChats(null, {
                limit: this.state.chatLimit,
                offset: this.state.chatOffset,
                projectId: this.state.currentProjectId,
            });

            // Append new chats to existing ones
            for (const chat of result.chats) {
                this._storeChatMetadata(chat);
            }

            // Update pagination state
            this.state.chatOffset += result.chats.length;
            this.state.hasMoreChats = result.hasMore;
            this.state.isLoadingChats = false;

            this._notify('chatsLoaded', result);
            this._notify('chatsLoading', false);

            return result;
        } catch (error) {
            console.error('Failed to load more chats:', error);
            this.state.isLoadingChats = false;
            this._notify('chatsLoading', false);
            return { chats: [], hasMore: this.state.hasMoreChats };
        }
    }

    /**
     * Reset chat pagination and reload from beginning
     * Used when switching projects or after searching
     * @param {Object} [options] - Options for reloading
     * @param {string} [options.projectId] - Project ID to filter by
     * @returns {Promise<void>}
     */
    async reloadChats(options = {}) {
        const { projectId = this.state.currentProjectId } = options;

        this.state.isLoadingChats = true;
        this._notify('chatsLoading', true);

        try {
            const result = await repository.getChats(null, {
                limit: this.state.chatLimit,
                offset: 0,
                projectId,
            });

            // Replace existing chats (clear non-project chats when filtering by project)
            this.state.chats = {};
            for (const chat of result.chats) {
                this._storeChatMetadata(chat);
            }

            // Reset pagination state
            this.state.chatOffset = result.chats.length;
            this.state.hasMoreChats = result.hasMore;
            this.state.isLoadingChats = false;

            this._notify('chatsReloaded', result);
            this._notify('chatsLoading', false);
        } catch (error) {
            console.error('Failed to reload chats:', error);
            this.state.isLoadingChats = false;
            this._notify('chatsLoading', false);
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
        if (this.state.messagesByChatId[chatId]) {
            updatedChat.messages = this.state.messagesByChatId[chatId];
        }
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
        delete this.state.messagesByChatId[chatId];
        delete this.state.messagesLoadingByChatId[chatId];
        delete this.state.messagesErrorByChatId[chatId];
        this._messageLoadPromises.delete(chatId);

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

        const messageStore = this._ensureMessageCache(chatId);

        // Generate UUID client-side for instant optimistic updates
        const messageId = messageData.id || crypto.randomUUID();
        const optimisticMessage = {
            ...messageData,
            id: messageId,
            createdAt: Date.now(),
        };

        // IMMEDIATELY update local state (optimistic update)
        messageStore.push(optimisticMessage);
        chat.messages = messageStore;
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

        const messages = this.state.messagesByChatId[chatId];
        if (!messages) {
            console.error('Messages not loaded in local state');
            return null;
        }

        // Find the message in the local array
        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) {
            console.error('Message not found in local state');
            return null;
        }

        // IMMEDIATELY update local state (optimistic update)
        const updatedMessage = {
            ...messages[msgIndex],
            ...updates,
        };
        messages[msgIndex] = updatedMessage;
        chat.messages = messages;
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

        const messages = this.state.messagesByChatId[this.state.currentChatId];
        if (!messages) return null;

        // Find and update the message in memory
        const message = messages.find(m => m.id === messageId);
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
    // Project Operations
    // ==================

    /**
     * Create a new project
     * @param {Object} projectData
     * @returns {Promise<Object>}
     */
    async createProject(projectData = {}) {
        const project = await repository.createProject(projectData);
        this.state.projects[project.id] = project;
        this._notify('projectCreated', project);
        return project;
    }

    /**
     * Select a project (or deselect by passing null)
     * @param {string|null} projectId
     */
    async selectProject(projectId) {
        this.state.currentProjectId = projectId;
        // Clear current chat when switching projects
        this.state.currentChatId = null;

        // Reload chats with the new project filter
        await this.reloadChats({ projectId });

        // Select the first chat if available
        const projectChats = this.allChats;
        if (projectChats.length > 0) {
            this.state.currentChatId = projectChats[0].id;
            this.loadMessages(this.state.currentChatId).catch(error => {
                console.error('Failed to load messages after project select:', error);
            });
        }

        this._notify('projectSelected', projectId);
        this._notify('currentChatChanged', this.currentChat);
    }

    /**
     * Update a project
     * @param {string} projectId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateProject(projectId, updates) {
        const project = await repository.updateProject(projectId, updates);
        this.state.projects[projectId] = project;
        this._notify('projectUpdated', project);
        return project;
    }

    /**
     * Delete a project
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async deleteProject(projectId) {
        const success = await repository.deleteProject(projectId);
        if (success) {
            delete this.state.projects[projectId];
            if (this.state.currentProjectId === projectId) {
                this.state.currentProjectId = null;
                this._notify('projectSelected', null);
            }
            this._notify('projectDeleted', projectId);
        }
        return success;
    }

    /**
     * Add a file to a project
     * @param {string} projectId
     * @param {Object} fileData
     * @returns {Promise<Object>}
     */
    async addProjectFile(projectId, fileData) {
        const file = await repository.addProjectFile(projectId, fileData);
        // Update the local project with the new file
        if (this.state.projects[projectId]) {
            this.state.projects[projectId].files = this.state.projects[projectId].files || [];
            this.state.projects[projectId].files.push(file);
            this._notify('projectUpdated', this.state.projects[projectId]);
        }
        return file;
    }

    /**
     * Remove a file from a project
     * @param {string} projectId
     * @param {string} fileId
     * @returns {Promise<boolean>}
     */
    async removeProjectFile(projectId, fileId) {
        const success = await repository.removeProjectFile(projectId, fileId);
        if (success && this.state.projects[projectId]) {
            this.state.projects[projectId].files =
                (this.state.projects[projectId].files || []).filter(f => f.id !== fileId);
            this._notify('projectUpdated', this.state.projects[projectId]);
        }
        return success;
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
            this.state.messagesByChatId = {};
            this.state.messagesLoadingByChatId = {};
            this.state.messagesErrorByChatId = {};
            this._messageLoadPromises.clear();
            this.state.currentChatId = null;
            const newChat = await this.createChat();
            this.state.currentChatId = newChat.id;
            this._notify('dataCleared');
        }
        return success;
    }

    /**
     * Search chats with server-side pagination
     * @param {string} query - Search query
     * @param {Object} [options] - Search options
     * @param {number} [options.limit] - Number of results to return
     * @param {number} [options.offset] - Offset for pagination
     * @returns {Promise<{chats: Object[], hasMore: boolean, total: number}>}
     */
    async searchChats(query, options = {}) {
        const { limit = this.state.chatLimit, offset = 0 } = options;

        if (!query.trim()) {
            // Return cached chats if no search query
            return {
                chats: this.allChats,
                hasMore: this.state.hasMoreChats,
                total: Object.keys(this.state.chats).length,
            };
        }

        try {
            const result = await repository.searchChats(query, null, { limit, offset });
            return result;
        } catch (error) {
            console.error('Search failed:', error);
            return { chats: [], hasMore: false, total: 0 };
        }
    }
}

// Singleton instance
export const stateManager = new StateManager();

