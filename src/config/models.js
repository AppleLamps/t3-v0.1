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
    // OpenAI - Chat
    {
        id: 'openai/gpt-5.1',
        name: 'GPT-5.1',
        provider: 'OpenAI',
        capabilities: ['vision', 'tools', 'chat'],
        description: 'Next-generation multimodal chat model from OpenAI (high-capacity, vision + tools)'
    },
    {
        id: 'openai/gpt-5.1-chat',
        name: 'GPT-5.1 Chat',
        provider: 'OpenAI',
        capabilities: ['vision', 'chat'],
        description: 'Chat-optimized variant of GPT-5.1 for conversational use-cases'
    },

    // xAI
    {
        id: 'x-ai/grok-4-fast',
        name: 'Grok 4 (Fast)',
        provider: 'xAI',
        capabilities: ['fast', 'chat'],
        description: 'xAI Grok 4 - tuned for fast conversational responses'
    },
    {
        id: 'x-ai/grok-code-fast-1',
        name: 'Grok Code (Fast)',
        provider: 'xAI',
        capabilities: ['fast', 'code'],
        description: 'xAI Grok family model optimized for code understanding and generation'
    },

    // Anthropic
    {
        id: 'anthropic/claude-opus-4.5',
        name: 'Claude Opus 4.5',
        provider: 'Anthropic',
        capabilities: ['vision', 'chat'],
        description: 'Anthropic Claude Opus — high-capacity multimodal chat model'
    },
    {
        id: 'anthropic/claude-haiku-4.5',
        name: 'Claude Haiku 4.5',
        provider: 'Anthropic',
        capabilities: ['vision', 'chat', 'fast'],
        description: 'Anthropic Claude Haiku — lightweight, low-latency variant'
    },
    {
        id: 'anthropic/claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        provider: 'Anthropic',
        capabilities: ['vision', 'chat', 'balanced'],
        description: 'Anthropic Claude Sonnet — balanced model for quality and speed'
    },

    // Google - Chat
    {
        id: 'google/gemini-3-pro-preview',
        name: 'Gemini 3 Pro (Preview)',
        provider: 'Google',
        capabilities: ['vision', 'chat', 'tools'],
        description: 'Google Gemini 3 Pro preview — multimodal and tools-enabled'
    },
    {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        capabilities: ['vision', 'chat'],
        description: 'Gemini 2.5 Pro — capable multimodal conversational model'
    },
    {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        capabilities: ['fast', 'chat'],
        description: 'Gemini Flash — lightweight and fast conversational model'
    },
    {
        id: 'google/gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash (Lite)',
        provider: 'Google',
        capabilities: ['fast', 'chat', 'lightweight'],
        description: 'Flash (Lite) — ultra-lightweight low-latency variant'
    },

    // OpenAI - Image generation
    {
        id: 'openai/gpt-5-image',
        name: 'GPT-5 Image',
        provider: 'OpenAI',
        capabilities: ['image', 'vision'],
        description: 'OpenAI GPT-5 image model — high-quality image generation'
    },
    {
        id: 'openai/gpt-5-image-mini',
        name: 'GPT-5 Image (Mini)',
        provider: 'OpenAI',
        capabilities: ['image', 'fast'],
        description: 'Smaller/faster image generation model for lower-latency use'
    },

    // Google - Image generation
    {
        id: 'google/gemini-2.5-flash-preview-image-generation',
        name: 'Gemini 2.5 Flash Image (Preview)',
        provider: 'Google',
        capabilities: ['image', 'vision', 'fast'],
        description: 'Google Gemini 2.5 Flash image generation (preview)'
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
export const DEFAULT_MODEL = 'openai/gpt-5.1';

/**
 * Image generation model IDs
 * These models support the modalities: ['image', 'text'] parameter
 */
export const IMAGE_GENERATION_MODELS = [
    'openai/gpt-5-image',
    'openai/gpt-5-image-mini',
    'google/gemini-2.5-flash-preview-image-generation',
];

/**
 * Check if a model is an image generation model
 * @param {string} modelId 
 * @returns {boolean}
 */
export function isImageGenerationModel(modelId) {
    return IMAGE_GENERATION_MODELS.includes(modelId);
}

/**
 * Get models with vision capability
 * @returns {Model[]}
 */
export function getVisionModels() {
    return MODELS.filter(m => m.capabilities?.includes('vision'));
}

/**
 * Get models with image generation capability
 * @returns {Model[]}
 */
export function getImageGenerationModels() {
    return MODELS.filter(m => m.capabilities?.includes('image'));
}

