// IndexedDB File Storage
// ======================
// Uses IndexedDB for storing large files (images, PDFs) and messages to avoid localStorage quota limits
// localStorage has ~5MB limit, while IndexedDB allows significantly larger storage

const DB_NAME = 'LampChatFileStorage';
const DB_VERSION = 2; // Bumped version for messages store
const FILE_STORE = 'files';
const MESSAGE_STORE = 'messages';

let dbPromise = null;

/**
 * Open/create the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create file store if it doesn't exist
            if (!db.objectStoreNames.contains(FILE_STORE)) {
                const store = db.createObjectStore(FILE_STORE, { keyPath: 'id' });
                store.createIndex('projectId', 'projectId', { unique: false });
            }

            // Create message store if it doesn't exist
            if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
                const msgStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
                msgStore.createIndex('chatId', 'chatId', { unique: false });
            }
        };
    });

    return dbPromise;
}

/**
 * Store a file in IndexedDB
 * @param {string} id - Unique file ID
 * @param {string} projectId - Associated project ID
 * @param {string} data - Base64 data URL
 * @param {Object} metadata - Additional file metadata (name, type, size, etc.)
 * @returns {Promise<void>}
 */
export async function storeFile(id, projectId, data, metadata = {}) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readwrite');
        const store = transaction.objectStore(FILE_STORE);

        const fileRecord = {
            id,
            projectId,
            data,
            ...metadata,
            storedAt: Date.now(),
        };

        const request = store.put(fileRecord);

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to store file:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Retrieve a file from IndexedDB
 * @param {string} id - File ID
 * @returns {Promise<Object|null>} - File record with data, or null if not found
 */
export async function getFile(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readonly');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
            console.error('Failed to get file:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all files for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object[]>} - Array of file records
 */
export async function getFilesByProject(projectId) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readonly');
        const store = transaction.objectStore(FILE_STORE);
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
            console.error('Failed to get files by project:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete a file from IndexedDB
 * @param {string} id - File ID
 * @returns {Promise<void>}
 */
export async function deleteFile(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readwrite');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to delete file:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete all files for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
export async function deleteFilesByProject(projectId) {
    const files = await getFilesByProject(projectId);
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readwrite');
        const store = transaction.objectStore(FILE_STORE);

        let completed = 0;
        const total = files.length;

        if (total === 0) {
            resolve();
            return;
        }

        for (const file of files) {
            const request = store.delete(file.id);
            request.onsuccess = () => {
                completed++;
                if (completed === total) resolve();
            };
            request.onerror = () => {
                console.error('Failed to delete file:', request.error);
                reject(request.error);
            };
        }
    });
}

/**
 * Clear all files from IndexedDB
 * @returns {Promise<void>}
 */
export async function clearAllFiles() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([FILE_STORE], 'readwrite');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear files:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get storage usage estimate
 * @returns {Promise<{used: number, quota: number, percentage: number}>}
 */
export async function getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            used: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
        };
    }
    return { used: 0, quota: 0, percentage: 0 };
}

// ==================
// Message Storage Operations
// ==================

/**
 * Store a message in IndexedDB
 * @param {Object} message - Message object with id and chatId
 * @returns {Promise<void>}
 */
export async function storeMessage(message) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readwrite');
        const store = transaction.objectStore(MESSAGE_STORE);

        const request = store.put(message);

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to store message:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Store multiple messages in IndexedDB (batch operation)
 * @param {Object[]} messages - Array of message objects
 * @returns {Promise<void>}
 */
export async function storeMessages(messages) {
    if (!messages || messages.length === 0) return;

    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readwrite');
        const store = transaction.objectStore(MESSAGE_STORE);

        let completed = 0;
        const total = messages.length;

        for (const message of messages) {
            const request = store.put(message);
            request.onsuccess = () => {
                completed++;
                if (completed === total) resolve();
            };
            request.onerror = () => {
                console.error('Failed to store message:', request.error);
                reject(request.error);
            };
        }
    });
}

/**
 * Get all messages for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<Object[]>} - Array of message objects
 */
export async function getMessagesByChat(chatId) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readonly');
        const store = transaction.objectStore(MESSAGE_STORE);
        const index = store.index('chatId');
        const request = index.getAll(chatId);

        request.onsuccess = () => {
            // Sort messages by createdAt to maintain order
            const messages = request.result || [];
            messages.sort((a, b) => a.createdAt - b.createdAt);
            resolve(messages);
        };
        request.onerror = () => {
            console.error('Failed to get messages by chat:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a single message by ID
 * @param {string} messageId - Message ID
 * @returns {Promise<Object|null>} - Message object or null
 */
export async function getMessage(messageId) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readonly');
        const store = transaction.objectStore(MESSAGE_STORE);
        const request = store.get(messageId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
            console.error('Failed to get message:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Update a message in IndexedDB
 * @param {string} messageId - Message ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} - Updated message or null
 */
export async function updateMessage(messageId, updates) {
    const existing = await getMessage(messageId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    await storeMessage(updated);
    return updated;
}

/**
 * Delete all messages for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<void>}
 */
export async function deleteMessagesByChat(chatId) {
    const messages = await getMessagesByChat(chatId);
    if (messages.length === 0) return;

    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readwrite');
        const store = transaction.objectStore(MESSAGE_STORE);

        let completed = 0;
        const total = messages.length;

        for (const message of messages) {
            const request = store.delete(message.id);
            request.onsuccess = () => {
                completed++;
                if (completed === total) resolve();
            };
            request.onerror = () => {
                console.error('Failed to delete message:', request.error);
                reject(request.error);
            };
        }
    });
}

/**
 * Clear all messages from IndexedDB
 * @returns {Promise<void>}
 */
export async function clearAllMessages() {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([MESSAGE_STORE], 'readwrite');
        const store = transaction.objectStore(MESSAGE_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear messages:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Migrate existing messages from localStorage chats to IndexedDB
 * This should be called once on app initialization to migrate old data
 * @param {Object} chats - Chats object from localStorage
 * @returns {Promise<boolean>} - True if migration occurred
 */
export async function migrateMessagesToIndexedDB(chats) {
    if (!chats || Object.keys(chats).length === 0) return false;

    let migrated = false;

    for (const chatId in chats) {
        const chat = chats[chatId];
        if (chat.messages && chat.messages.length > 0) {
            // Add chatId to each message if not present
            const messagesWithChatId = chat.messages.map(msg => ({
                ...msg,
                chatId: chatId,
            }));
            await storeMessages(messagesWithChatId);
            migrated = true;
        }
    }

    return migrated;
}
