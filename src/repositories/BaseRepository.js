// Base Repository Interface
// =========================
// This defines the contract that all repositories must implement.
// When migrating to Neon, create a NeonRepository that implements these methods.

/**
 * @typedef {Object} Chat
 * @property {string} id - Unique identifier
 * @property {string} title - Chat title
 * @property {Message[]} messages - Array of messages
 * @property {string} userId - Owner user ID (for multi-user support later)
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Message
 * @property {string} id - Unique identifier
 * @property {string} role - 'user' | 'assistant' | 'system'
 * @property {string} content - Message content
 * @property {string} [model] - Model used for assistant messages
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} User
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} [email] - Email (for future auth)
 * @property {Object} settings - User settings
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Settings
 * @property {string} apiKey - OpenRouter API key
 * @property {string} selectedModel - Currently selected model ID
 * @property {string[]} enabledModels - List of enabled model IDs
 * @property {boolean} webSearchEnabled - Web search toggle
 */

/**
 * Base repository class - defines the interface for data access
 * @abstract
 */
export class BaseRepository {
    // ==================
    // Chat Operations
    // ==================
    
    /**
     * Get all chats for a user
     * @param {string} [userId] - Optional user ID filter
     * @returns {Promise<Chat[]>}
     */
    async getChats(userId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Get a single chat by ID
     * @param {string} chatId 
     * @returns {Promise<Chat|null>}
     */
    async getChatById(chatId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Create a new chat
     * @param {Partial<Chat>} chatData 
     * @returns {Promise<Chat>}
     */
    async createChat(chatData) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Update an existing chat
     * @param {string} chatId 
     * @param {Partial<Chat>} updates 
     * @returns {Promise<Chat>}
     */
    async updateChat(chatId, updates) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Delete a chat
     * @param {string} chatId 
     * @returns {Promise<boolean>}
     */
    async deleteChat(chatId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Search chats by title or content
     * @param {string} query 
     * @param {string} [userId] 
     * @returns {Promise<Chat[]>}
     */
    async searchChats(query, userId) {
        throw new Error('Method not implemented');
    }
    
    // ==================
    // Message Operations
    // ==================
    
    /**
     * Add a message to a chat
     * @param {string} chatId 
     * @param {Partial<Message>} messageData 
     * @returns {Promise<Message>}
     */
    async addMessage(chatId, messageData) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Update a message
     * @param {string} chatId 
     * @param {string} messageId 
     * @param {Partial<Message>} updates 
     * @returns {Promise<Message>}
     */
    async updateMessage(chatId, messageId, updates) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Get messages for a chat
     * @param {string} chatId 
     * @returns {Promise<Message[]>}
     */
    async getMessages(chatId) {
        throw new Error('Method not implemented');
    }
    
    // ==================
    // User Operations
    // ==================
    
    /**
     * Get user by ID
     * @param {string} userId 
     * @returns {Promise<User|null>}
     */
    async getUser(userId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Create or update user
     * @param {Partial<User>} userData 
     * @returns {Promise<User>}
     */
    async saveUser(userData) {
        throw new Error('Method not implemented');
    }
    
    // ==================
    // Settings Operations
    // ==================
    
    /**
     * Get settings for a user
     * @param {string} [userId] 
     * @returns {Promise<Settings>}
     */
    async getSettings(userId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Save settings
     * @param {Partial<Settings>} settings 
     * @param {string} [userId] 
     * @returns {Promise<Settings>}
     */
    async saveSettings(settings, userId) {
        throw new Error('Method not implemented');
    }
    
    // ==================
    // Bulk Operations
    // ==================
    
    /**
     * Export all data
     * @param {string} [userId] 
     * @returns {Promise<Object>}
     */
    async exportAll(userId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Import data
     * @param {Object} data 
     * @param {string} [userId] 
     * @returns {Promise<boolean>}
     */
    async importAll(data, userId) {
        throw new Error('Method not implemented');
    }
    
    /**
     * Clear all data
     * @param {string} [userId] 
     * @returns {Promise<boolean>}
     */
    async clearAll(userId) {
        throw new Error('Method not implemented');
    }
}

