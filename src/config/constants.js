// Application Constants
// =====================

export const APP_NAME = 'LampChat';
export const APP_VERSION = '1.0.0';

// API Configuration
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_IMAGE_GEN_URL = 'https://openrouter.ai/api/v1/images/generations';

// Storage Keys (for localStorage, will map to table names for DB)
export const STORAGE_KEYS = {
    STATE: 'lampchat_state',
    CHATS: 'lampchat_chats',
    SETTINGS: 'lampchat_settings',
    USER: 'lampchat_user',
};

// UI Constants
export const MAX_TEXTAREA_HEIGHT = 200;
export const SIDEBAR_WIDTH = 288; // 72 * 4 = 288px (w-72 in Tailwind)

// Date grouping thresholds
export const DATE_GROUPS = {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    LAST_WEEK: 'Previous 7 Days',
    OLDER: 'Older',
};

