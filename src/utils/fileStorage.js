// IndexedDB File Storage
// ======================
// Uses IndexedDB for storing large files (images, PDFs) and messages to avoid localStorage quota limits
// localStorage has ~5MB limit, while IndexedDB allows significantly larger storage

const DB_NAME = 'LampChatFileStorage';
const DB_VERSION = 3; // Bumped version for chat metadata store
const FILE_STORE = 'files';
const MESSAGE_STORE = 'messages';
const CHAT_STORE = 'chats';
const CHAT_UPDATED_INDEX = 'updatedAt';
const CHAT_PROJECT_INDEX = 'projectId';
const CHAT_PROJECT_UPDATED_INDEX = 'projectIdUpdatedAt';

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

            if (!db.objectStoreNames.contains(CHAT_STORE)) {
                const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
                chatStore.createIndex(CHAT_UPDATED_INDEX, 'updatedAt', { unique: false });
                chatStore.createIndex(CHAT_PROJECT_INDEX, 'projectId', { unique: false });
                chatStore.createIndex(CHAT_PROJECT_UPDATED_INDEX, ['projectId', 'updatedAt'], { unique: false });
            } else {
                const chatStore = event.target.transaction?.objectStore(CHAT_STORE);
                if (chatStore) {
                    if (!chatStore.indexNames.contains(CHAT_UPDATED_INDEX)) {
                        chatStore.createIndex(CHAT_UPDATED_INDEX, 'updatedAt', { unique: false });
                    }
                    if (!chatStore.indexNames.contains(CHAT_PROJECT_INDEX)) {
                        chatStore.createIndex(CHAT_PROJECT_INDEX, 'projectId', { unique: false });
                    }
                    if (!chatStore.indexNames.contains(CHAT_PROJECT_UPDATED_INDEX)) {
                        chatStore.createIndex(CHAT_PROJECT_UPDATED_INDEX, ['projectId', 'updatedAt'], { unique: false });
                    }
                }
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

// ==================
// Chat Metadata Operations
// ==================

function getProjectKeyRange(projectId) {
    if (!projectId) return null;
    return IDBKeyRange.bound(
        [projectId, Number.NEGATIVE_INFINITY],
        [projectId, Number.POSITIVE_INFINITY]
    );
}

export async function saveChatMetadata(chatMeta) {
    if (!chatMeta?.id) {
        throw new Error('Chat metadata must include an id');
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_STORE);
        const request = store.put(chatMeta);
        request.onsuccess = () => resolve(chatMeta);
        request.onerror = () => {
            console.error('Failed to store chat metadata:', request.error);
            reject(request.error);
        };
    });
}

export async function saveChatMetadataBatch(chats) {
    if (!Array.isArray(chats) || chats.length === 0) {
        return;
    }
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_STORE);
        let completed = 0;
        const total = chats.length;
        for (const chat of chats) {
            const request = store.put(chat);
            request.onsuccess = () => {
                completed++;
                if (completed === total) resolve();
            };
            request.onerror = () => {
                console.error('Failed to batch store chat metadata:', request.error);
                reject(request.error);
            };
        }
    });
}

export async function getChatMetadata(chatId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_STORE);
        const request = store.get(chatId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
            console.error('Failed to get chat metadata:', request.error);
            reject(request.error);
        };
    });
}

export async function deleteChatMetadata(chatId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_STORE);
        const request = store.delete(chatId);
        request.onsuccess = () => resolve(true);
        request.onerror = () => {
            console.error('Failed to delete chat metadata:', request.error);
            reject(request.error);
        };
    });
}

export async function paginateChatMetadata(options = {}) {
    const { limit = 20, offset = 0, projectId = null } = options;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_STORE);
        const index = projectId
            ? store.index(CHAT_PROJECT_UPDATED_INDEX)
            : store.index(CHAT_UPDATED_INDEX);
        const keyRange = projectId ? getProjectKeyRange(projectId) : null;

        const countRequest = index.count(keyRange);
        countRequest.onerror = () => {
            console.error('Failed to count chats:', countRequest.error);
            reject(countRequest.error);
        };

        countRequest.onsuccess = () => {
            const total = countRequest.result || 0;
            if (total === 0) {
                resolve({ items: [], total: 0 });
                return;
            }

            const cursorRequest = index.openCursor(keyRange, 'prev');
            const items = [];
            let skipped = 0;
            let settled = false;

            cursorRequest.onerror = () => {
                if (!settled) {
                    console.error('Failed to iterate chats:', cursorRequest.error);
                    settled = true;
                    reject(cursorRequest.error);
                }
            };

            cursorRequest.onsuccess = () => {
                if (settled) return;
                const cursor = cursorRequest.result;
                if (!cursor) {
                    settled = true;
                    resolve({ items, total });
                    return;
                }

                if (skipped < offset) {
                    skipped++;
                    cursor.continue();
                    return;
                }

                if (items.length < limit) {
                    items.push(cursor.value);
                }

                if (items.length >= limit) {
                    settled = true;
                    resolve({ items, total });
                    return;
                }

                cursor.continue();
            };
        };
    });
}

export async function getAllChatMetadata() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
            console.error('Failed to get chats:', request.error);
            reject(request.error);
        };
    });
}

export async function getChatsByProject(projectId) {
    if (!projectId) return [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_STORE);
        const index = store.index(CHAT_PROJECT_UPDATED_INDEX);
        const keyRange = getProjectKeyRange(projectId);
        const request = index.openCursor(keyRange, 'prev');
        const items = [];

        request.onerror = () => {
            console.error('Failed to get project chats:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve(items);
                return;
            }
            items.push(cursor.value);
            cursor.continue();
        };
    });
}

export async function clearAllChatMetadata() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear chat metadata:', request.error);
            reject(request.error);
        };
    });
}

export async function unlinkProjectFromChats(projectId) {
    if (!projectId) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CHAT_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_STORE);
        const index = store.index(CHAT_PROJECT_INDEX);
        const request = index.openCursor(IDBKeyRange.only(projectId));

        request.onerror = () => {
            console.error('Failed to unlink project from chats:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve();
                return;
            }
            const chat = { ...cursor.value, projectId: null };
            cursor.update(chat);
            cursor.continue();
        };
    });
}

export async function migrateChatMetadataToIndexedDB(chats) {
    if (!chats || Object.keys(chats).length === 0) return false;
    const chatArray = Object.values(chats).map(chat => {
        const { messages, ...meta } = chat;
        return meta;
    });
    if (chatArray.length === 0) return false;
    await saveChatMetadataBatch(chatArray);
    return true;
}
