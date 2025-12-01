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
 * @typedef {Object} Project
 * @property {string} id - Unique identifier
 * @property {string} userId - Owner user ID
 * @property {string} name - Project name
 * @property {string} description - Project description
 * @property {string} instructions - Custom system prompt for this project
 * @property {string} visibility - 'private' | 'shared'
 * @property {ProjectFile[]} files - Array of project files
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} ProjectFile
 * @property {string} id - Unique identifier
 * @property {string} projectId - Parent project ID
 * @property {string} name - File name
 * @property {string} type - MIME type
 * @property {string} data - Base64 encoded file data
 * @property {number} size - File size in bytes
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} [limit=20] - Maximum number of items to return
 * @property {number} [offset=0] - Number of items to skip
 * @property {string} [projectId] - Optional project ID filter for chats
 */

/**
 * @typedef {Object} PaginatedChatsResult
 * @property {Chat[]} chats - Array of chats
 * @property {boolean} hasMore - Whether there are more chats to load
 * @property {number} total - Total number of chats
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
     * Get chats for a user with pagination support
     * @param {string} [userId] - Optional user ID filter
     * @param {PaginationOptions} [options] - Pagination options
     * @returns {Promise<PaginatedChatsResult>} - Paginated result with chats, hasMore flag, and total count
     */
    async getChats(userId, options = {}) {
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
     * Search chats by title or message content (server-side for Neon, client-side for localStorage)
     * @param {string} query - Search query string
     * @param {string} [userId] - Optional user ID filter
     * @param {PaginationOptions} [options] - Pagination options
     * @returns {Promise<PaginatedChatsResult>} - Paginated search results
     */
    async searchChats(query, userId, options = {}) {
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
    // Project Operations
    // ==================

    /**
     * Get all projects for a user
     * @param {string} [userId] - Optional user ID filter
     * @returns {Promise<Project[]>}
     */
    async getProjects(userId) {
        throw new Error('Method not implemented');
    }

    /**
     * Get a single project by ID
     * @param {string} projectId
     * @returns {Promise<Project|null>}
     */
    async getProjectById(projectId) {
        throw new Error('Method not implemented');
    }

    /**
     * Create a new project
     * @param {Partial<Project>} projectData
     * @returns {Promise<Project>}
     */
    async createProject(projectData) {
        throw new Error('Method not implemented');
    }

    /**
     * Update an existing project
     * @param {string} projectId
     * @param {Partial<Project>} updates
     * @returns {Promise<Project>}
     */
    async updateProject(projectId, updates) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a project
     * @param {string} projectId
     * @returns {Promise<boolean>}
     */
    async deleteProject(projectId) {
        throw new Error('Method not implemented');
    }

    /**
     * Add a file to a project
     * @param {string} projectId
     * @param {Partial<ProjectFile>} fileData
     * @returns {Promise<ProjectFile>}
     */
    async addProjectFile(projectId, fileData) {
        throw new Error('Method not implemented');
    }

    /**
     * Remove a file from a project
     * @param {string} projectId
     * @param {string} fileId
     * @returns {Promise<boolean>}
     */
    async removeProjectFile(projectId, fileId) {
        throw new Error('Method not implemented');
    }

    /**
     * Get chats for a specific project
     * @param {string} projectId
     * @returns {Promise<Chat[]>}
     */
    async getProjectChats(projectId) {
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

