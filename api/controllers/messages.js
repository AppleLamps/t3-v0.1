import { sql } from '../lib/sql.js';

export async function addMessage(userId, chatId, messageData = {}) {
    try {
        const ownership = await sql`
            SELECT id FROM chats WHERE id = ${chatId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Chat not found', status: 404 };
        }

        const clientId = messageData.id || null;

        let clientCreatedAt = null;
        if (messageData.createdAt) {
            clientCreatedAt = typeof messageData.createdAt === 'number'
                ? new Date(messageData.createdAt).toISOString()
                : messageData.createdAt;
        }

        let newMessage;
        if (clientId && clientCreatedAt) {
            newMessage = await sql`
                INSERT INTO messages (id, chat_id, role, content, model, created_at)
                VALUES (${clientId}, ${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null}, ${clientCreatedAt})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        } else if (clientId) {
            newMessage = await sql`
                INSERT INTO messages (id, chat_id, role, content, model)
                VALUES (${clientId}, ${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        } else {
            newMessage = await sql`
                INSERT INTO messages (chat_id, role, content, model)
                VALUES (${chatId}, ${messageData.role || 'user'}, ${messageData.content || ''}, ${messageData.model || null})
                RETURNING id, role, content, model, created_at as "createdAt"
            `;
        }

        await sql`UPDATE chats SET updated_at = NOW() WHERE id = ${chatId}`;

        return { data: newMessage[0], status: 201 };
    } catch (error) {
        console.error('Add message error:', error);
        return { error: 'Failed to add message', status: 500 };
    }
}

export async function updateMessage(userId, chatId, messageId, updates = {}) {
    try {
        const ownership = await sql`
            SELECT c.id FROM chats c
            JOIN messages m ON m.chat_id = c.id
            WHERE c.id = ${chatId} AND c.user_id = ${userId} AND m.id = ${messageId}
        `;

        if (ownership.length === 0) {
            return { error: 'Message not found', status: 404 };
        }

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

        await sql`UPDATE chats SET updated_at = NOW() WHERE id = ${chatId}`;

        return { data: updatedMessage[0], status: 200 };
    } catch (error) {
        console.error('Update message error:', error);
        return { error: 'Failed to update message', status: 500 };
    }
}

export async function getMessages(userId, chatId) {
    try {
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
