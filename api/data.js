// Vercel Serverless Function - Data Operations
// =============================================
// Routes data-layer actions to modular controllers

import jwt from 'jsonwebtoken';
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

if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable');
}
const JWT_SECRET = process.env.JWT_SECRET;

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
    getMessages: ({ userId, chatId }) => getMessages(userId, chatId),

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
    exportAll: ({ userId }) => exportAll(userId),
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const auth = verifyToken(req);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }

    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const payload = req.body;
    const { action, chatId, messageId, projectId, fileId, data: bodyData } = payload;

    const result = await routeAction(action, {
        userId: auth.userId,
        chatId,
        messageId,
        projectId,
        fileId,
        data: bodyData,
    });

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }

    return res.status(result.status).json(result.data);
}

