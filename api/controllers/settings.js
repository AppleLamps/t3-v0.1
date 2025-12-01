import { sql } from '../lib/sql.js';

export const DEFAULT_MODELS = [
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

export async function getSettings(userId) {
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
            await sql`
                INSERT INTO user_settings (user_id)
                VALUES (${userId})
                ON CONFLICT (user_id) DO NOTHING
            `;

            return {
                data: {
                    apiKey: '',
                    selectedModel: DEFAULT_MODELS[0],
                    enabledModels: DEFAULT_MODELS,
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

export async function saveSettings(userId, updates = {}) {
    try {
        const updatedSettings = await sql`
            INSERT INTO user_settings (user_id, api_key, selected_model, enabled_models, web_search_enabled)
            VALUES (
                ${userId},
                ${updates.apiKey || ''},
                ${updates.selectedModel || DEFAULT_MODELS[0]},
                ${updates.enabledModels || DEFAULT_MODELS},
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
