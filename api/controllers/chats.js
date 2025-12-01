import { sql } from '../lib/sql.js';

export async function getChats(userId, options = {}) {
    try {
        const { projectId = null, limit = 20, offset = 0 } = options;

        let chats;
        let totalCount;

        if (projectId) {
            const countResult = await sql`
                SELECT COUNT(*) as count FROM chats
                WHERE user_id = ${userId} AND project_id = ${projectId}
            `;
            totalCount = parseInt(countResult[0]?.count || 0, 10);

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
            const countResult = await sql`
                SELECT COUNT(*) as count FROM chats WHERE user_id = ${userId}
            `;
            totalCount = parseInt(countResult[0]?.count || 0, 10);

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

export async function getChatById(userId, chatId) {
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

export async function createChat(userId, chatData = {}) {
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

export async function updateChat(userId, chatId, updates = {}) {
    try {
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

        return await getChatById(userId, chatId);
    } catch (error) {
        console.error('Update chat error:', error);
        return { error: 'Failed to update chat', status: 500 };
    }
}

export async function deleteChat(userId, chatId) {
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

export async function searchChats(userId, query, options = {}) {
    try {
        const { limit = 20, offset = 0 } = options;
        const searchQuery = `%${query.toLowerCase()}%`;

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
