// AI Model Definitions
// ====================

/**
 * @typedef {Object} Model
 * @property {string} id - OpenRouter model ID
 * @property {string} name - Display name
 * @property {string} provider - Provider name (OpenAI, Anthropic, etc.)
 * @property {string[]} capabilities - Model capabilities (vision, tools, etc.)
 * @property {string} [description] - Optional description
 */

/** @type {Model[]} */
export const MODELS = [
    // OpenAI
    { 
        id: 'openai/gpt-4o', 
        name: 'GPT-4o', 
        provider: 'OpenAI', 
        capabilities: ['vision', 'tools'],
        description: 'Most capable GPT-4 model with vision'
    },
    { 
        id: 'openai/gpt-4o-mini', 
        name: 'GPT-4o Mini', 
        provider: 'OpenAI', 
        capabilities: ['vision', 'tools'],
        description: 'Smaller, faster, cheaper GPT-4o'
    },
    { 
        id: 'openai/gpt-4-turbo', 
        name: 'GPT-4 Turbo', 
        provider: 'OpenAI', 
        capabilities: ['vision', 'tools'],
        description: 'GPT-4 Turbo with vision'
    },
    { 
        id: 'openai/o1-preview', 
        name: 'o1 Preview', 
        provider: 'OpenAI', 
        capabilities: ['reasoning'],
        description: 'Advanced reasoning model'
    },
    
    // Anthropic
    { 
        id: 'anthropic/claude-3.5-sonnet', 
        name: 'Claude 3.5 Sonnet', 
        provider: 'Anthropic', 
        capabilities: ['vision', 'tools'],
        description: 'Best balance of intelligence and speed'
    },
    { 
        id: 'anthropic/claude-3-opus', 
        name: 'Claude 3 Opus', 
        provider: 'Anthropic', 
        capabilities: ['vision'],
        description: 'Most powerful Claude model'
    },
    { 
        id: 'anthropic/claude-3-haiku', 
        name: 'Claude 3 Haiku', 
        provider: 'Anthropic', 
        capabilities: ['vision'],
        description: 'Fastest Claude model'
    },
    
    // Google
    { 
        id: 'google/gemini-pro-1.5', 
        name: 'Gemini Pro 1.5', 
        provider: 'Google', 
        capabilities: ['vision'],
        description: 'Google\'s most capable model'
    },
    { 
        id: 'google/gemini-flash-1.5', 
        name: 'Gemini Flash 1.5', 
        provider: 'Google', 
        capabilities: ['vision'],
        description: 'Fast and efficient Gemini'
    },
    
    // Meta
    { 
        id: 'meta-llama/llama-3.1-405b-instruct', 
        name: 'Llama 3.1 405B', 
        provider: 'Meta', 
        capabilities: [],
        description: 'Largest open-source model'
    },
    { 
        id: 'meta-llama/llama-3.1-70b-instruct', 
        name: 'Llama 3.1 70B', 
        provider: 'Meta', 
        capabilities: [],
        description: 'Powerful open-source model'
    },
    
    // Mistral
    { 
        id: 'mistralai/mistral-large', 
        name: 'Mistral Large', 
        provider: 'Mistral', 
        capabilities: ['tools'],
        description: 'Mistral\'s flagship model'
    },
    { 
        id: 'mistralai/mixtral-8x22b-instruct', 
        name: 'Mixtral 8x22B', 
        provider: 'Mistral', 
        capabilities: [],
        description: 'Mixture of experts model'
    },
    
    // Others
    { 
        id: 'deepseek/deepseek-chat', 
        name: 'DeepSeek Chat', 
        provider: 'DeepSeek', 
        capabilities: [],
        description: 'Cost-effective chat model'
    },
    { 
        id: 'qwen/qwen-2.5-72b-instruct', 
        name: 'Qwen 2.5 72B', 
        provider: 'Qwen', 
        capabilities: [],
        description: 'Alibaba\'s advanced model'
    },
];

/**
 * Get a model by ID
 * @param {string} modelId 
 * @returns {Model|undefined}
 */
export function getModelById(modelId) {
    return MODELS.find(m => m.id === modelId);
}

/**
 * Get models by provider
 * @param {string} provider 
 * @returns {Model[]}
 */
export function getModelsByProvider(provider) {
    return MODELS.filter(m => m.provider === provider);
}

/**
 * Get unique providers
 * @returns {string[]}
 */
export function getProviders() {
    return [...new Set(MODELS.map(m => m.provider))];
}

/**
 * Default model ID
 */
export const DEFAULT_MODEL = 'openai/gpt-4o';

