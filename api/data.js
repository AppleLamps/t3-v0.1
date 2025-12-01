// Vercel Serverless Function - Data Operations
// =============================================
// Handles CRUD operations for chats, messages, and settings
// All operations require valid JWT authentication

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// JWT secret - MUST be set in environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable');
}
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Extract token from request (cookies or Authorization header)
 * @param {Object} req - Request object
 * @returns {string|null} Token or null
 */
function getTokenFromRequest(req) {
    // First check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }

    // Then check cookies
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenMatch = cookies.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }
    }

    return null;
}

/**
 * Verify JWT and extract user ID
 * @param {Object} req - Request object
 * @returns {Object} - { userId } or { error }
 */
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

// ==================
// Chat Operations
// ==================

async function getChats(userId, options = {}) {
    try {
        const { projectId = null, limit = 20, offset = 0 } = options;

        let chats;
        let totalCount;

        if (projectId) {
            // Get total count for hasMore calculation
            const countResult = await sql`
                SELECT COUNT(*) as count FROM chats
                WHERE user_id = ${userId} AND project_id = ${projectId}
            `;
            totalCount = parseInt(countResult[0]?.count || 0, 10);

            // Filter by project with pagination (metadata only)
            chats = await sql`
                SELECT
                    c.id,
                    c.title,
                    c.project_id as "projectId",
                    c.created_at as "createdAt",
                    c.updated_at as "updatedAt",
                    ${userId} as "userId"
                FROM chats c
                WHERE c.user_id = ${userId} AND c.project_id = ${projectId}
                ORDER BY c.updated_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        } else {
            // Get total count for hasMore calculation
            const countResult = await sql`
                SELECT COUNT(*) as count FROM chats WHERE user_id = ${userId}
            `;
            totalCount = parseInt(countResult[0]?.count || 0, 10);

            // Get all chats (no project filter) with pagination (metadata only)
            chats = await sql`
                SELECT
                    c.id,
                    c.title,
                    c.project_id as "projectId",
                    c.created_at as "createdAt",
                    c.updated_at as "updatedAt",
                    ${userId} as "userId"
                FROM chats c
                WHERE c.user_id = ${userId}
                ORDER BY c.updated_at DESC
                LIMIT ${limit}
                OFFSET ${offset}
            `;
        }

        const hasMore = offset + chats.length < totalCount;

        return { data: { chats, hasMore, total: totalCount }, status: 200 };
    } catch (error) {
        console.error('Get chats error:', error);
        return { error: 'Failed to fetch chats', status: 500 };
    }
}

async function getChatById(userId, chatId) {
    try {
        const chats = await sql`
            SELECT
                c.id,
                c.title,
                c.project_id as "projectId",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'role', m.role,
                            'content', m.content,
                            'model', m.model,
                            'stats', m.stats,
                            'generatedImages', m.generated_images,
                            'createdAt', m.created_at
                        ) ORDER BY m.created_at ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'
                ) as messages
            FROM chats c
            LEFT JOIN messages m ON m.chat_id = c.id
            WHERE c.id = ${chatId} AND c.user_id = ${userId}
            GROUP BY c.id
        `;

        if (chats.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        return { data: chats[0], status: 200 };
    } catch (error) {
        console.error('Get chat error:', error);
        return { error: 'Failed to fetch chat', status: 500 };
    }
}

async function createChat(userId, chatData = {}) {
    try {
        const title = chatData.title || 'New Chat';
        const projectId = chatData.projectId || null;

        const newChat = await sql`
            INSERT INTO chats (user_id, title, project_id)
            VALUES (${userId}, ${title}, ${projectId})
            RETURNING id, title, project_id as "projectId", created_at as "createdAt", updated_at as "updatedAt"
        `;

        const chat = {
            ...newChat[0],
            userId,
            messages: [],
        };

        return { data: chat, status: 201 };
    } catch (error) {
        console.error('Create chat error:', error);
        return { error: 'Failed to create chat', status: 500 };
    }
}

async function updateChat(userId, chatId, updates) {
    try {
        // Verify ownership
        const ownership = await sql`
            SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        await sql`
            UPDATE chats
            SET title = COALESCE(${updates.title}, title),
                project_id = COALESCE(${updates.projectId}, project_id),
                updated_at = NOW()
            WHERE id = ${chatId}
        `;

        // Fetch full chat with messages
        return await getChatById(userId, chatId);
    } catch (error) {
        console.error('Update chat error:', error);
        return { error: 'Failed to update chat', status: 500 };
    }
}

async function deleteChat(userId, chatId) {
    try {
        const result = await sql`
            DELETE FROM chats
            WHERE id = ${chatId} AND user_id = ${userId}
            RETURNING id
        `;

        if (result.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Delete chat error:', error);
        return { error: 'Failed to delete chat', status: 500 };
    }
}

async function searchChats(userId, query, options = {}) {
    try {
        const { limit = 20, offset = 0 } = options;
        const searchQuery = `%${query.toLowerCase()}%`;

        // Get total count of matching chats for hasMore calculation
        const countResult = await sql`
            SELECT COUNT(*) as count
            FROM chats c
            WHERE c.user_id = ${userId}
                AND (
                    LOWER(c.title) LIKE ${searchQuery}
                    OR EXISTS (
                        SELECT 1 FROM messages m
                        WHERE m.chat_id = c.id
                            AND LOWER(m.content) LIKE ${searchQuery}
                    )
                )
        `;
        const totalCount = parseInt(countResult[0]?.count || 0, 10);

        // Get paginated search results (metadata only)
        const chats = await sql`
            SELECT
                c.id,
                c.title,
                c.project_id as "projectId",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                ${userId} as "userId"
            FROM chats c
            WHERE c.user_id = ${userId}
                AND (
                    LOWER(c.title) LIKE ${searchQuery}
                    OR EXISTS (
                        SELECT 1 FROM messages m
                        WHERE m.chat_id = c.id
                            AND LOWER(m.content) LIKE ${searchQuery}
                    )
                )
            ORDER BY c.updated_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        const hasMore = offset + chats.length < totalCount;

        return { data: { chats, hasMore, total: totalCount }, status: 200 };
    } catch (error) {
        console.error('Search chats error:', error);
        return { error: 'Failed to search chats', status: 500 };
    }
}

// ==================
// Message Operations
// ==================

async function addMessage(userId, chatId, messageData) {
    try {
        // Verify chat ownership
        const ownership = await sql`
            SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        // Accept client-provided UUID or let the database generate one
        const clientId = messageData.id || null;

        // Accept client-provided timestamp for proper ordering with optimistic updates
        // Convert from milliseconds to ISO string if it's a number
        let clientCreatedAt = null;
        if (messageData.createdAt) {
            clientCreatedAt = typeof messageData.createdAt === 'number'
                ? new Date(messageData.createdAt).toISOString()
                : messageData.createdAt;
        }

        let newMessage;
        if (clientId && clientCreatedAt) {
            // Use client-provided UUID and timestamp for optimistic updates
            newMessage = await sql`
                INSERT INTO messages (id, chat_id, role, content, model, created_at)
                VALUES (${clientId}, ${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null}, ${clientCreatedAt})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        } else if (clientId) {
            // Use client-provided UUID only
            newMessage = await sql`
                INSERT INTO messages (id, chat_id, role, content, model)
                VALUES (${clientId}, ${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        } else {
            // Let database generate UUID and timestamp
            newMessage = await sql`
                INSERT INTO messages (chat_id, role, content, model)
                VALUES (${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        }

        // Update chat's updated_at
        await sql`UPDATE chats SET updated_at = NOW() WHERE id = ${chatId}`;

        return { data: newMessage[0], status: 201 };
    } catch (error) {
        console.error('Add message error:', error);
        return { error: 'Failed to add message', status: 500 };
    }
}

async function updateMessage(userId, chatId, messageId, updates) {
    try {
        // Verify chat ownership
        const ownership = await sql`
            SELECT c.id FROM chats c
            JOIN messages m ON m.chat_id = c.id
            WHERE c.id = ${chatId} AND c.user_id = ${userId} AND m.id = ${messageId}
        `;

        if (ownership.length === 0) {
            return { error: 'Message not found', status: 404 };
        }

        // Convert stats and generatedImages to JSON string if provided
        const statsJson = updates.stats ? JSON.stringify(updates.stats) : null;
        const imagesJson = updates.generatedImages ? JSON.stringify(updates.generatedImages) : null;

        const updatedMessage = await sql`
            UPDATE messages
            SET content = COALESCE(${updates.content}, content),
                model = COALESCE(${updates.model}, model),
                stats = COALESCE(${statsJson}::jsonb, stats),
                generated_images = COALESCE(${imagesJson}::jsonb, generated_images)
            WHERE id = ${messageId}
            RETURNING id, role, content, model, stats, generated_images as "generatedImages", created_at as "createdAt"
        `;

        // Update chat's updated_at
        await sql`UPDATE chats SET updated_at = NOW() WHERE id = ${chatId}`;

        return { data: updatedMessage[0], status: 200 };
    } catch (error) {
        console.error('Update message error:', error);
        return { error: 'Failed to update message', status: 500 };
    }
}

async function getMessages(userId, chatId) {
    try {
        // Verify chat ownership
        const ownership = await sql`
            SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        const messages = await sql`
            SELECT id, role, content, model, stats, generated_images as "generatedImages", created_at as "createdAt"
            FROM messages
            WHERE chat_id = ${chatId}
            ORDER BY created_at ASC
        `;

        return { data: messages, status: 200 };
    } catch (error) {
        console.error('Get messages error:', error);
        return { error: 'Failed to fetch messages', status: 500 };
    }
}

// ==================
// User Operations
// ==================

async function getUser(userId) {
    try {
        const users = await sql`
            SELECT id, email, name, created_at as "createdAt", updated_at as "updatedAt"
            FROM users WHERE id = ${userId}
        `;

        if (users.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        return { data: users[0], status: 200 };
    } catch (error) {
        console.error('Get user error:', error);
        return { error: 'Failed to fetch user', status: 500 };
    }
}

async function updateUser(userId, updates) {
    try {
        const updatedUser = await sql`
            UPDATE users
            SET name = COALESCE(${updates.name}, name),
                updated_at = NOW()
            WHERE id = ${userId}
            RETURNING id, email, name, created_at as "createdAt", updated_at as "updatedAt"
        `;

        if (updatedUser.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        return { data: updatedUser[0], status: 200 };
    } catch (error) {
        console.error('Update user error:', error);
        return { error: 'Failed to update user', status: 500 };
    }
}

// ==================
// Settings Operations
// ==================

async function getSettings(userId) {
    try {
        const settings = await sql`
            SELECT 
                api_key as "apiKey",
                selected_model as "selectedModel",
                enabled_models as "enabledModels",
                web_search_enabled as "webSearchEnabled"
            FROM user_settings
            WHERE user_id = ${userId}
        `;

        if (settings.length === 0) {
            // Create default settings if not exists
            await sql`
                INSERT INTO user_settings (user_id)
                VALUES (${userId})
                ON CONFLICT (user_id) DO NOTHING
            `;

            return {
                data: {
                    apiKey: '',
                    selectedModel: 'openai/gpt-5.1',
                    enabledModels: [
                        'openai/gpt-5.1',
                        'openai/gpt-5.1-chat',
                        'x-ai/grok-4-fast',
                        'x-ai/grok-code-fast-1',
                        'anthropic/claude-opus-4.5',
                        'anthropic/claude-haiku-4.5',
                        'anthropic/claude-sonnet-4.5',
                        'google/gemini-3-pro-preview',
                        'google/gemini-2.5-pro',
                        'google/gemini-2.5-flash',
                        'google/gemini-2.5-flash-lite',
                        'openai/gpt-5-image',
                        'openai/gpt-5-image-mini',
                        'google/gemini-2.5-flash-preview-image-generation'
                    ],
                    webSearchEnabled: false,
                },
                status: 200,
            };
        }

        return { data: settings[0], status: 200 };
    } catch (error) {
        console.error('Get settings error:', error);
        return { error: 'Failed to fetch settings', status: 500 };
    }
}

async function saveSettings(userId, updates) {
    try {
        const defaultModels = [
            'openai/gpt-5.1',
            'openai/gpt-5.1-chat',
            'x-ai/grok-4-fast',
            'x-ai/grok-code-fast-1',
            'anthropic/claude-opus-4.5',
            'anthropic/claude-haiku-4.5',
            'anthropic/claude-sonnet-4.5',
            'google/gemini-3-pro-preview',
            'google/gemini-2.5-pro',
            'google/gemini-2.5-flash',
            'google/gemini-2.5-flash-lite',
            'openai/gpt-5-image',
            'openai/gpt-5-image-mini',
            'google/gemini-2.5-flash-preview-image-generation'
        ];
        const updatedSettings = await sql`
            INSERT INTO user_settings (user_id, api_key, selected_model, enabled_models, web_search_enabled)
            VALUES (
                ${userId},
                ${updates.apiKey || ''},
                ${updates.selectedModel || 'openai/gpt-5.1'},
                ${updates.enabledModels || defaultModels},
                ${updates.webSearchEnabled || false}
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                api_key = COALESCE(${updates.apiKey}, user_settings.api_key),
                selected_model = COALESCE(${updates.selectedModel}, user_settings.selected_model),
                enabled_models = COALESCE(${updates.enabledModels}, user_settings.enabled_models),
                web_search_enabled = COALESCE(${updates.webSearchEnabled}, user_settings.web_search_enabled),
                updated_at = NOW()
            RETURNING 
                api_key as "apiKey",
                selected_model as "selectedModel",
                enabled_models as "enabledModels",
                web_search_enabled as "webSearchEnabled"
        `;

        return { data: updatedSettings[0], status: 200 };
    } catch (error) {
        console.error('Save settings error:', error);
        return { error: 'Failed to save settings', status: 500 };
    }
}

// ==================
// Project Operations
// ==================

async function getProjects(userId) {
    try {
        const projects = await sql`
            SELECT
                p.id,
                p.name,
                p.description,
                p.instructions,
                p.visibility,
                p.created_at as "createdAt",
                p.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pf.id,
                            'name', pf.name,
                            'type', pf.type,
                            'size', pf.size,
                            'createdAt', pf.created_at
                        ) ORDER BY pf.created_at ASC
                    ) FILTER (WHERE pf.id IS NOT NULL),
                    '[]'
                ) as files
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            WHERE p.user_id = ${userId}
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        `;

        return { data: projects, status: 200 };
    } catch (error) {
        console.error('Get projects error:', error);
        return { error: 'Failed to fetch projects', status: 500 };
    }
}

async function getProjectById(userId, projectId) {
    try {
        const projects = await sql`
            SELECT
                p.id,
                p.name,
                p.description,
                p.instructions,
                p.visibility,
                p.created_at as "createdAt",
                p.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pf.id,
                            'name', pf.name,
                            'type', pf.type,
                            'data', pf.data,
                            'size', pf.size,
                            'createdAt', pf.created_at
                        ) ORDER BY pf.created_at ASC
                    ) FILTER (WHERE pf.id IS NOT NULL),
                    '[]'
                ) as files
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            WHERE p.id = ${projectId} AND p.user_id = ${userId}
            GROUP BY p.id
        `;

        if (projects.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        return { data: projects[0], status: 200 };
    } catch (error) {
        console.error('Get project error:', error);
        return { error: 'Failed to fetch project', status: 500 };
    }
}

async function createProject(userId, projectData = {}) {
    try {
        const name = projectData.name || 'New Project';
        const description = projectData.description || '';
        const instructions = projectData.instructions || '';
        const visibility = projectData.visibility || 'private';

        const newProject = await sql`
            INSERT INTO projects (user_id, name, description, instructions, visibility)
            VALUES (${userId}, ${name}, ${description}, ${instructions}, ${visibility})
            RETURNING id, name, description, instructions, visibility, created_at as "createdAt", updated_at as "updatedAt"
        `;

        const project = {
            ...newProject[0],
            userId,
            files: [],
        };

        return { data: project, status: 201 };
    } catch (error) {
        console.error('Create project error:', error);
        return { error: 'Failed to create project', status: 500 };
    }
}

async function updateProject(userId, projectId, updates) {
    try {
        // Verify ownership
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        await sql`
            UPDATE projects
            SET name = COALESCE(${updates.name}, name),
                description = COALESCE(${updates.description}, description),
                instructions = COALESCE(${updates.instructions}, instructions),
                visibility = COALESCE(${updates.visibility}, visibility),
                updated_at = NOW()
            WHERE id = ${projectId}
        `;

        // Fetch full project with files
        return await getProjectById(userId, projectId);
    } catch (error) {
        console.error('Update project error:', error);
        return { error: 'Failed to update project', status: 500 };
    }
}

async function deleteProject(userId, projectId) {
    try {
        const result = await sql`
            DELETE FROM projects
            WHERE id = ${projectId} AND user_id = ${userId}
            RETURNING id
        `;

        if (result.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Delete project error:', error);
        return { error: 'Failed to delete project', status: 500 };
    }
}

async function addProjectFile(userId, projectId, fileData) {
    try {
        // Verify project ownership
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        const newFile = await sql`
            INSERT INTO project_files (project_id, name, type, data, size)
            VALUES (${projectId}, ${fileData.name || ''}, ${fileData.type || ''}, ${fileData.data || ''}, ${fileData.size || 0})
            RETURNING id, name, type, size, created_at as "createdAt"
        `;

        // Update project's updated_at
        await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

        return { data: newFile[0], status: 201 };
    } catch (error) {
        console.error('Add project file error:', error);
        return { error: 'Failed to add file', status: 500 };
    }
}

async function removeProjectFile(userId, projectId, fileId) {
    try {
        // Verify project ownership
        const ownership = await sql`
            SELECT p.id FROM projects p
            JOIN project_files pf ON pf.project_id = p.id
            WHERE p.id = ${projectId} AND p.user_id = ${userId} AND pf.id = ${fileId}
        `;

        if (ownership.length === 0) {
            return { error: 'File not found', status: 404 };
        }

        await sql`DELETE FROM project_files WHERE id = ${fileId}`;

        // Update project's updated_at
        await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Remove project file error:', error);
        return { error: 'Failed to remove file', status: 500 };
    }
}

async function getProjectChats(userId, projectId) {
    try {
        // Verify project ownership
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        const chats = await sql`
            SELECT
                c.id,
                c.title,
                c.project_id as "projectId",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'role', m.role,
                            'content', m.content,
                            'model', m.model,
                            'stats', m.stats,
                            'generatedImages', m.generated_images,
                            'createdAt', m.created_at
                        ) ORDER BY m.created_at ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'
                ) as messages
            FROM chats c
            LEFT JOIN messages m ON m.chat_id = c.id
            WHERE c.user_id = ${userId} AND c.project_id = ${projectId}
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        `;

        return { data: chats, status: 200 };
    } catch (error) {
        console.error('Get project chats error:', error);
        return { error: 'Failed to fetch project chats', status: 500 };
    }
}

// ==================
// Bulk Operations
// ==================

async function exportAll(userId) {
    try {
        const chatsResult = await getChats(userId);
        const userResult = await getUser(userId);
        const settingsResult = await getSettings(userId);

        return {
            data: {
                chats: chatsResult.data?.reduce((acc, chat) => {
                    acc[chat.id] = chat;
                    return acc;
                }, {}) || {},
                user: userResult.data || null,
                settings: settingsResult.data || null,
                exportedAt: new Date().toISOString(),
                version: '1.0',
            },
            status: 200,
        };
    } catch (error) {
        console.error('Export error:', error);
        return { error: 'Failed to export data', status: 500 };
    }
}

async function importAll(userId, data) {
    try {
        // Import chats and messages
        if (data.chats) {
            for (const chat of Object.values(data.chats)) {
                const createResult = await createChat(userId, { title: chat.title });
                if (createResult.data && chat.messages) {
                    for (const message of chat.messages) {
                        await addMessage(userId, createResult.data.id, {
                            role: message.role,
                            content: message.content,
                            model: message.model,
                        });
                    }
                }
            }
        }

        // Import settings (excluding user-specific data like API key for security)
        if (data.settings) {
            await saveSettings(userId, {
                selectedModel: data.settings.selectedModel,
                enabledModels: data.settings.enabledModels,
                webSearchEnabled: data.settings.webSearchEnabled,
            });
        }

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Import error:', error);
        return { error: 'Failed to import data', status: 500 };
    }
}

async function clearAll(userId) {
    try {
        // Delete all chats (cascades to messages)
        await sql`DELETE FROM chats WHERE user_id = ${userId}`;

        // Reset settings to defaults
        await sql`
            UPDATE user_settings
            SET api_key = '',
                selected_model = 'openai/gpt-5.1',
                enabled_models = ARRAY[
                    'openai/gpt-5.1',
                    'openai/gpt-5.1-chat',
                    'x-ai/grok-4-fast',
                    'x-ai/grok-code-fast-1',
                    'anthropic/claude-opus-4.5',
                    'anthropic/claude-haiku-4.5',
                    'anthropic/claude-sonnet-4.5',
                    'google/gemini-3-pro-preview',
                    'google/gemini-2.5-pro',
                    'google/gemini-2.5-flash',
                    'google/gemini-2.5-flash-lite',
                    'openai/gpt-5-image',
                    'openai/gpt-5-image-mini',
                    'google/gemini-2.5-flash-preview-image-generation'
                ],
                web_search_enabled = false,
                updated_at = NOW()
            WHERE user_id = ${userId}
        `;

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Clear all error:', error);
        return { error: 'Failed to clear data', status: 500 };
    }
}

/**
 * Vercel serverless handler
 */
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify authentication (checks both cookies and Authorization header)
    const auth = verifyToken(req);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }

    const { userId } = auth;
    const { action, chatId, messageId, projectId, fileId, data: bodyData } = req.body || {};

    let result;

    // Route to appropriate handler
    switch (action) {
        // Chat operations
        case 'getChats':
            result = await getChats(userId, {
                projectId: bodyData?.projectId,
                limit: bodyData?.limit || 20,
                offset: bodyData?.offset || 0,
            });
            break;
        case 'getChatById':
            result = await getChatById(userId, chatId);
            break;
        case 'createChat':
            result = await createChat(userId, bodyData);
            break;
        case 'updateChat':
            result = await updateChat(userId, chatId, bodyData);
            break;
        case 'deleteChat':
            result = await deleteChat(userId, chatId);
            break;
        case 'searchChats':
            result = await searchChats(userId, bodyData?.query || '', {
                limit: bodyData?.limit || 20,
                offset: bodyData?.offset || 0,
            });
            break;

        // Message operations
        case 'addMessage':
            result = await addMessage(userId, chatId, bodyData);
            break;
        case 'updateMessage':
            result = await updateMessage(userId, chatId, messageId, bodyData);
            break;
        case 'getMessages':
            result = await getMessages(userId, chatId);
            break;

        // Project operations
        case 'getProjects':
            result = await getProjects(userId);
            break;
        case 'getProjectById':
            result = await getProjectById(userId, projectId);
            break;
        case 'createProject':
            result = await createProject(userId, bodyData);
            break;
        case 'updateProject':
            result = await updateProject(userId, projectId, bodyData);
            break;
        case 'deleteProject':
            result = await deleteProject(userId, projectId);
            break;
        case 'addProjectFile':
            result = await addProjectFile(userId, projectId, bodyData);
            break;
        case 'removeProjectFile':
            result = await removeProjectFile(userId, projectId, fileId);
            break;
        case 'getProjectChats':
            result = await getProjectChats(userId, projectId);
            break;

        // User operations
        case 'getUser':
            result = await getUser(userId);
            break;
        case 'updateUser':
            result = await updateUser(userId, bodyData);
            break;

        // Settings operations
        case 'getSettings':
            result = await getSettings(userId);
            break;
        case 'saveSettings':
            result = await saveSettings(userId, bodyData);
            break;

        // Bulk operations
        case 'exportAll':
            result = await exportAll(userId);
            break;
        case 'importAll':
            result = await importAll(userId, bodyData);
            break;
        case 'clearAll':
            result = await clearAll(userId);
            break;

        default:
            return res.status(400).json({ error: 'Invalid action' });
    }

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }

    return res.status(result.status).json(result.data);
}

