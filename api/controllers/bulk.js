import { sql } from '../lib/sql.js';
import { createChat } from './chats.js';
import { addMessage } from './messages.js';
import { getUser } from './users.js';
import { getSettings, saveSettings, DEFAULT_MODELS } from './settings.js';

const DEFAULT_EXPORT_BATCH_SIZE = 50;
const MIN_EXPORT_BATCH_SIZE = 10;
const MAX_EXPORT_BATCH_SIZE = 250;

function normalizeBatchSize(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return DEFAULT_EXPORT_BATCH_SIZE;
    }
    return Math.max(MIN_EXPORT_BATCH_SIZE, Math.min(MAX_EXPORT_BATCH_SIZE, parsed));
}

async function fetchChatBatch(userId, limit, offset) {
    const chats = await sql`
        SELECT
            c.id,
            c.title,
            c.project_id as "projectId",
            c.created_at as "createdAt",
            c.updated_at as "updatedAt"
        FROM chats c
        WHERE c.user_id = ${userId}
        ORDER BY c.updated_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
    `;

    if (chats.length === 0) {
        return [];
    }

    const chatIds = chats.map(chat => chat.id);
    if (chatIds.length === 0) {
        return chats;
    }

    const messages = await sql`
        SELECT
            m.id,
            m.chat_id as "chatId",
            m.role,
            m.content,
            m.model,
            m.stats,
            m.generated_images as "generatedImages",
            m.created_at as "createdAt"
        FROM messages m
        WHERE m.chat_id = ANY(${chatIds}::uuid[])
        ORDER BY m.created_at ASC
    `;

    const messagesByChat = new Map();
    for (const message of messages) {
        if (!messagesByChat.has(message.chatId)) {
            messagesByChat.set(message.chatId, []);
        }
        const { chatId, ...rest } = message;
        messagesByChat.get(message.chatId).push(rest);
    }

    return chats.map(chat => ({
        ...chat,
        messages: messagesByChat.get(chat.id) || [],
    }));
}

async function collectAllChats(userId, batchSize) {
    const chats = {};
    let offset = 0;
    let totalChats = 0;

    while (true) {
        const batch = await fetchChatBatch(userId, batchSize, offset);
        if (batch.length === 0) {
            break;
        }

        for (const chat of batch) {
            chats[chat.id] = chat;
        }

        totalChats += batch.length;
        offset += batch.length;
    }

    return { chats, totalChats };
}

// Stream the export payload in small JSON chunks to keep memory usage low.
async function streamChatsResponse({
    res,
    user,
    settings,
    userId,
    batchSize,
    exportedAt,
}) {
    let streamStarted = false;
    let totalChats = 0;

    try {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Transfer-Encoding', 'chunked');

        res.write(
            `{"version":"1.1","exportedAt":${JSON.stringify(exportedAt)},` +
            `"user":${JSON.stringify(user)},` +
            `"settings":${JSON.stringify(settings)},` +
            '"chats":{'
        );

        streamStarted = true;
        let offset = 0;
        let firstChat = true;

        while (true) {
            const batch = await fetchChatBatch(userId, batchSize, offset);
            if (batch.length === 0) {
                break;
            }

            for (const chat of batch) {
                const serialized = `${JSON.stringify(chat.id)}:${JSON.stringify(chat)}`;
                res.write(firstChat ? serialized : `,${serialized}`);
                firstChat = false;
            }

            totalChats += batch.length;
            offset += batch.length;
        }

        res.write(
            `},"meta":${JSON.stringify({
                chunkSize: batchSize,
                totalChats,
                streamed: true,
            })}}`
        );
        res.end();

        return { streamed: true, status: 200 };
    } catch (error) {
        console.error('Export stream error:', error);

        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to export data' });
        } else if (streamStarted) {
            res.write('},"error":"Failed to export data"}');
            res.end();
        } else {
            res.end();
        }

        return { streamed: true, status: 500 };
    }
}

export async function exportAll(userId, options = {}) {
    try {
        const { res = null, batchSize } = options;
        const normalizedBatchSize = normalizeBatchSize(batchSize);
        const exportedAt = new Date().toISOString();

        const [userResult, settingsResult] = await Promise.all([
            getUser(userId),
            getSettings(userId),
        ]);

        if (userResult.error) {
            return userResult;
        }

        if (settingsResult.error) {
            return settingsResult;
        }

        if (!res) {
            const { chats, totalChats } = await collectAllChats(userId, normalizedBatchSize);
            return {
                data: {
                    chats,
                    user: userResult.data || null,
                    settings: settingsResult.data || null,
                    exportedAt,
                    version: '1.1',
                    meta: {
                        chunkSize: normalizedBatchSize,
                        totalChats,
                        streamed: false,
                    },
                },
                status: 200,
            };
        }

        return await streamChatsResponse({
            res,
            user: userResult.data || null,
            settings: settingsResult.data || null,
            userId,
            batchSize: normalizedBatchSize,
            exportedAt,
        });
    } catch (error) {
        console.error('Export error:', error);
        return { error: 'Failed to export data', status: 500 };
    }
}

export async function importAll(userId, data = {}) {
    try {
        await sql`BEGIN`;
        try {
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

            if (data.settings) {
                await saveSettings(userId, {
                    selectedModel: data.settings.selectedModel,
                    enabledModels: data.settings.enabledModels,
                    webSearchEnabled: data.settings.webSearchEnabled,
                });
            }

            await sql`COMMIT`;
            return { data: { success: true }, status: 200 };
        } catch (inner) {
            await sql`ROLLBACK`;
            throw inner;
        }
    } catch (error) {
        console.error('Import error:', error);
        return { error: 'Failed to import data', status: 500 };
    }
}

export async function clearAll(userId) {
    try {
        await sql`DELETE FROM chats WHERE user_id = ${userId}`;

        await sql`
            UPDATE user_settings
            SET api_key = '',
                selected_model = ${DEFAULT_MODELS[0]},
                enabled_models = ${DEFAULT_MODELS},
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
