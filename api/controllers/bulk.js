import { sql } from '../lib/sql.js';
import { getChats, createChat } from './chats.js';
import { addMessage } from './messages.js';
import { getUser } from './users.js';
import { getSettings, saveSettings, DEFAULT_MODELS } from './settings.js';

export async function exportAll(userId) {
    try {
        const chatsResult = await getChats(userId);
        const userResult = await getUser(userId);
        const settingsResult = await getSettings(userId);

        return {
            data: {
                chats: chatsResult.data?.chats?.reduce((acc, chat) => {
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

export async function importAll(userId, data = {}) {
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

        return { data: { success: true }, status: 200 };
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
