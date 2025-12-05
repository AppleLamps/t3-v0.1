// Vercel Serverless Function - Data Operations
// =============================================
// Routes data-layer actions to modular controllers

import jwt from 'jsonwebtoken';
import { isValidUUID } from './lib/sql.js';
import { getChats, getChatById, createChat, updateChat, deleteChat, searchChats } from './controllers/chats.js';
import { addMessage, updateMessage, getMessages } from './controllers/messages.js';
import {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    addProjectFile,
    removeProjectFile,
    getProjectChats,
} from './controllers/projects.js';
import { getUser, updateUser } from './controllers/users.js';
import { getSettings, saveSettings } from './controllers/settings.js';
import { exportAll, importAll, clearAll } from './controllers/bulk.js';
import { createRateLimitMiddleware } from './utils/rateLimiter.js';

if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable');
}
const JWT_SECRET = process.env.JWT_SECRET;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

// High-ceiling limiter for data operations
const dataRateLimit = createRateLimitMiddleware('data');

// Basic payload constraints
const MAX_MESSAGE_LENGTH = 16000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_INSTRUCTIONS_LENGTH = 20000;
const MAX_MODEL_ID_LENGTH = 200;
const MAX_FILE_NAME_LENGTH = 120;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = new Set([
    'text/plain',
    'application/pdf',
    'text/markdown',
    'application/json',
]);

function isNonEmptyString(value, maxLength) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function optionalString(value, maxLength) {
    return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function validateFileData(fileData = {}) {
    if (fileData.name && !optionalString(fileData.name, MAX_FILE_NAME_LENGTH)) {
        return { error: 'File name too long', status: 400 };
    }
    if (fileData.size && Number(fileData.size) > MAX_FILE_BYTES) {
        return { error: 'File too large (max 2MB)', status: 400 };
    }
    if (fileData.type && !ALLOWED_FILE_TYPES.has(fileData.type)) {
        return { error: 'Unsupported file type', status: 400 };
    }
    if (fileData.data) {
        try {
            const decodedSize = Buffer.from(fileData.data, 'base64').byteLength;
            if (decodedSize > MAX_FILE_BYTES) {
                return { error: 'File data exceeds allowed size', status: 400 };
            }
        } catch (e) {
            return { error: 'Invalid file data encoding', status: 400 };
        }
    }
    return null;
}

function validateActionPayload(action, payload) {
    switch (action) {
        case 'createChat':
            if (payload.data?.projectId && !isValidUUID(payload.data.projectId)) {
                return { error: 'Invalid project ID', status: 400 };
            }
            return { data: payload };
        case 'getChats': {
            const data = payload.data || {};
            if (data.projectId && !isValidUUID(data.projectId)) {
                return { error: 'Invalid project ID', status: 400 };
            }
            return { data: payload };
        }
        case 'getChatById':
        case 'deleteChat':
        case 'getMessages':
            if (!isValidUUID(payload.chatId)) {
                return { error: 'Invalid chat ID', status: 400 };
            }
            return { data: payload };
        case 'updateChat':
            if (!isValidUUID(payload.chatId)) {
                return { error: 'Invalid chat ID', status: 400 };
            }
            if (payload.data?.title && !optionalString(payload.data.title, MAX_TITLE_LENGTH)) {
                return { error: 'Title too long', status: 400 };
            }
            return { data: payload };
        case 'addMessage': {
            if (!isValidUUID(payload.chatId)) {
                return { error: 'Invalid chat ID', status: 400 };
            }
            const role = payload.data?.role || 'user';
            const hasContent = typeof (payload.data?.content || '') === 'string' && (payload.data?.content || '').length > 0;
            const attachments = Array.isArray(payload.data?.attachments) ? payload.data.attachments : [];
            if (role === 'user') {
                if (!hasContent && attachments.length === 0) {
                    return { error: 'Message content or attachment is required', status: 400 };
                }
                if (hasContent && !optionalString(payload.data?.content, MAX_MESSAGE_LENGTH)) {
                    return { error: 'Message content is too long', status: 400 };
                }
            }
            if (role !== 'user' && hasContent && !optionalString(payload.data?.content, MAX_MESSAGE_LENGTH)) {
                return { error: 'Message content is too long', status: 400 };
            }
            if (payload.data?.model && !optionalString(payload.data.model, MAX_MODEL_ID_LENGTH)) {
                return { error: 'Model id too long', status: 400 };
            }
            return { data: payload };
        }
        case 'updateMessage': {
            if (!isValidUUID(payload.chatId) || !isValidUUID(payload.messageId)) {
                return { error: 'Invalid chat or message ID', status: 400 };
            }
            if (payload.data?.content && !optionalString(payload.data.content, MAX_MESSAGE_LENGTH)) {
                return { error: 'Message content too long', status: 400 };
            }
            if (payload.data?.model && !optionalString(payload.data.model, MAX_MODEL_ID_LENGTH)) {
                return { error: 'Model id too long', status: 400 };
            }
            return { data: payload };
        }
        case 'searchChats':
            if (payload.data?.query && !optionalString(payload.data.query, MAX_TITLE_LENGTH)) {
                return { error: 'Search query too long', status: 400 };
            }
            return { data: payload };
        case 'createProject':
        case 'updateProject': {
            if (payload.projectId && !isValidUUID(payload.projectId)) {
                return { error: 'Invalid project ID', status: 400 };
            }
            const { name, description, instructions, visibility } = payload.data || {};
            if (name && !optionalString(name, MAX_TITLE_LENGTH)) {
                return { error: 'Project name too long', status: 400 };
            }
            if (description && !optionalString(description, MAX_DESCRIPTION_LENGTH)) {
                return { error: 'Project description too long', status: 400 };
            }
            if (instructions && !optionalString(instructions, MAX_INSTRUCTIONS_LENGTH)) {
                return { error: 'Project instructions too long', status: 400 };
            }
            if (visibility && !['private', 'shared', 'public'].includes(visibility)) {
                return { error: 'Invalid visibility', status: 400 };
            }
            return { data: payload };
        }
        case 'deleteProject':
        case 'getProjectById':
        case 'getProjectChats':
            if (!isValidUUID(payload.projectId)) {
                return { error: 'Invalid project ID', status: 400 };
            }
            return { data: payload };
        case 'addProjectFile': {
            if (!isValidUUID(payload.projectId)) {
                return { error: 'Invalid project ID', status: 400 };
            }
            const fileError = validateFileData(payload.data);
            if (fileError) return fileError;
            return { data: payload };
        }
        case 'removeProjectFile':
            if (!isValidUUID(payload.projectId) || !isValidUUID(payload.fileId)) {
                return { error: 'Invalid project or file ID', status: 400 };
            }
            return { data: payload };
        case 'getUser':
        case 'getProjects':
        case 'getSettings':
        case 'clearAll':
            return { data: payload };
        case 'saveSettings': {
            const { apiKey, selectedModel, enabledModels, webSearchEnabled } = payload.data || {};
            if (apiKey && typeof apiKey !== 'string') {
                return { error: 'Invalid apiKey', status: 400 };
            }
            if (selectedModel && !optionalString(selectedModel, MAX_MODEL_ID_LENGTH)) {
                return { error: 'Invalid selected model', status: 400 };
            }
            if (enabledModels && !Array.isArray(enabledModels)) {
                return { error: 'enabledModels must be an array', status: 400 };
            }
            if (webSearchEnabled !== undefined && typeof webSearchEnabled !== 'boolean') {
                return { error: 'webSearchEnabled must be boolean', status: 400 };
            }
            return { data: payload };
        }
        case 'exportAll':
            return { data: payload };
        case 'importAll':
            return { data: payload };
        default:
            return { error: 'Invalid action', status: 400 };
    }
}

function isOriginAllowed(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.length === 0) return true;
    return ALLOWED_ORIGINS.includes(origin);
}

function setCors(res, origin) {
    if (origin && isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function validateCsrf(req, res) {
    const origin = req.headers.origin || req.headers.referer;
    if (origin && !isOriginAllowed(origin)) {
        res.status(403).json({ error: 'Origin not allowed' });
        return false;
    }
    return true;
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenMatch = cookies.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }
    }

    return null;
}

function verifyToken(req) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return { error: 'No token provided', status: 401 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { userId: decoded.userId };
    } catch (error) {
        return { error: 'Invalid or expired token', status: 401 };
    }
}

const actionHandlers = {
    // Chat operations
    getChats: ({ userId, data }) => getChats(userId, {
        projectId: data?.projectId,
        limit: data?.limit || 20,
        offset: data?.offset || 0,
    }),
    getChatById: ({ userId, chatId }) => getChatById(userId, chatId),
    createChat: ({ userId, data }) => createChat(userId, data),
    updateChat: ({ userId, chatId, data }) => updateChat(userId, chatId, data),
    deleteChat: ({ userId, chatId }) => deleteChat(userId, chatId),
    searchChats: ({ userId, data }) => searchChats(userId, data?.query || '', {
        limit: data?.limit || 20,
        offset: data?.offset || 0,
    }),

    // Message operations
    addMessage: ({ userId, chatId, data }) => addMessage(userId, chatId, data),
    updateMessage: ({ userId, chatId, messageId, data }) => updateMessage(userId, chatId, messageId, data),
    getMessages: ({ userId, chatId, data }) => getMessages(userId, chatId, {
        limit: data?.limit,
        offset: data?.offset,
    }),

    // Project operations
    getProjects: ({ userId }) => getProjects(userId),
    getProjectById: ({ userId, projectId }) => getProjectById(userId, projectId),
    createProject: ({ userId, data }) => createProject(userId, data),
    updateProject: ({ userId, projectId, data }) => updateProject(userId, projectId, data),
    deleteProject: ({ userId, projectId }) => deleteProject(userId, projectId),
    addProjectFile: ({ userId, projectId, data }) => addProjectFile(userId, projectId, data),
    removeProjectFile: ({ userId, projectId, fileId }) => removeProjectFile(userId, projectId, fileId),
    getProjectChats: ({ userId, projectId }) => getProjectChats(userId, projectId),

    // User operations
    getUser: ({ userId }) => getUser(userId),
    updateUser: ({ userId, data }) => updateUser(userId, data),

    // Settings operations
    getSettings: ({ userId }) => getSettings(userId),
    saveSettings: ({ userId, data }) => saveSettings(userId, data),

    // Bulk operations
    exportAll: ({ userId, res, data }) => exportAll(userId, {
        res,
        batchSize: data?.batchSize,
    }),
    importAll: ({ userId, data }) => importAll(userId, data),
    clearAll: ({ userId }) => clearAll(userId),
};

async function routeAction(action, context) {
    const handler = actionHandlers[action];
    if (!handler) {
        return { error: 'Invalid action', status: 400 };
    }

    return handler(context);
}

export default async function handler(req, res) {
    const origin = req.headers.origin || req.headers.referer;
    setCors(res, origin);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!validateCsrf(req, res)) {
        return;
    }

    // Apply rate limiting (high ceiling to avoid throttling normal use)
    await new Promise((resolve, reject) => {
        dataRateLimit(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    const auth = verifyToken(req);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }

    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const payload = req.body;
    const { action, chatId, messageId, projectId, fileId, data: bodyData } = payload;

    const validated = validateActionPayload(action, {
        action,
        chatId,
        messageId,
        projectId,
        fileId,
        data: bodyData,
        req,
        res,
    });

    if (validated.error) {
        return res.status(validated.status).json({ error: validated.error });
    }

    let result;
    try {
        result = await routeAction(action, {
            userId: auth.userId,
            chatId: validated.data.chatId,
            messageId: validated.data.messageId,
            projectId: validated.data.projectId,
            fileId: validated.data.fileId,
            data: validated.data.data,
            req,
            res,
        });
    } catch (error) {
        console.error('Route handler error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }

    if (result?.streamed) {
        return;
    }

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }

    return res.status(result.status).json(result.data);
}

