// OpenRouter API Service
// ======================
// Handles all communication with the OpenRouter API

import { OPENROUTER_API_URL, OPENROUTER_IMAGE_GEN_URL, APP_NAME } from '../config/constants.js';
import { IMAGE_GENERATION_MODELS } from '../config/models.js';

/**
 * @typedef {Object} ChatMessage
 * @property {string} role - 'user' | 'assistant' | 'system'
 * @property {string|Array} content - Message content (string or multimodal array)
 */

/**
 * @typedef {Object} Attachment
 * @property {string} id - Unique identifier
 * @property {string} name - File name
 * @property {string} type - 'image' or 'pdf'
 * @property {string} mimeType - MIME type
 * @property {number} size - File size in bytes
 * @property {string} dataUrl - Base64 data URL
 */

/**
 * @typedef {Object} StreamStats
 * @property {number} completionTokens - Number of completion tokens
 * @property {number} promptTokens - Number of prompt tokens  
 * @property {number} totalTokens - Total tokens used
 * @property {number} timeToFirstToken - Time to first token in seconds
 * @property {number} tokensPerSecond - Tokens per second
 * @property {number} totalTime - Total generation time in seconds
 */

/**
 * @typedef {Object} StreamCallbacks
 * @property {function(string): void} onToken - Called for each token
 * @property {function(string, StreamStats, Object): void} onComplete - Called when stream completes with stats and optional images
 * @property {function(Error): void} onError - Called on error
 */

/**
 * @typedef {Object} ImageGenerationResult
 * @property {string} text - Any text content in the response
 * @property {Array<{url: string}>} images - Generated images (base64 data URLs)
 */

/**
 * OpenRouter API client
 */
export class OpenRouterService {
    /**
     * @param {string} apiKey - OpenRouter API key
     */
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = OPENROUTER_API_URL;
        this.imageGenUrl = OPENROUTER_IMAGE_GEN_URL;
    }
    
    /**
     * Update the API key
     * @param {string} apiKey 
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    
    /**
     * Check if API key is configured
     * @returns {boolean}
     */
    hasApiKey() {
        return !!this.apiKey;
    }
    
    /**
     * Build request headers
     * @private
     * @returns {Object}
     */
    _getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': APP_NAME,
        };
    }

    /**
     * Build multimodal message content
     * @private
     * @param {string} text - The text message
     * @param {Attachment[]} attachments - File attachments
     * @returns {string|Array} - String for text-only, array for multimodal
     */
    _buildMessageContent(text, attachments = []) {
        // If no attachments, return plain text
        if (!attachments || attachments.length === 0) {
            return text;
        }

        // Build multimodal content array
        const content = [];

        // Add text first (as recommended by OpenRouter docs)
        if (text) {
            content.push({
                type: 'text',
                text: text,
            });
        }

        // Add attachments
        for (const attachment of attachments) {
            if (attachment.type === 'image') {
                // Image attachment - use image_url format
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: attachment.dataUrl,
                    },
                });
            } else if (attachment.type === 'pdf') {
                // PDF attachment - use file format per OpenRouter docs
                content.push({
                    type: 'file',
                    file: {
                        filename: attachment.name,
                        file_data: attachment.dataUrl,
                    },
                });
            }
        }

        return content;
    }
    
    /**
     * Send a chat completion request (non-streaming)
     * @param {string} model - Model ID
     * @param {ChatMessage[]} messages - Conversation messages
     * @param {Object} [options] - Additional options
     * @returns {Promise<string>} - Assistant response
     */
    async chat(model, messages, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                ...options,
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
    
    /**
     * Send a streaming chat completion request
     * @param {string} model - Model ID
     * @param {ChatMessage[]} messages - Conversation messages
     * @param {StreamCallbacks} callbacks - Streaming callbacks
     * @param {Object} [options] - Additional options
     * @param {Attachment[]} [attachments] - Attachments for the latest user message
     * @returns {Promise<void>}
     */
    async chatStream(model, messages, callbacks, options = {}, attachments = []) {
        if (!this.apiKey) {
            callbacks.onError(new Error('API key not configured'));
            return;
        }
        
        // Process messages - convert the last user message to multimodal if it has attachments
        const processedMessages = messages.map((msg, index) => {
            // Only process the last user message for attachments
            if (index === messages.length - 1 && msg.role === 'user' && attachments?.length > 0) {
                return {
                    ...msg,
                    content: this._buildMessageContent(msg.content, attachments),
                };
            }
            return msg;
        });

        // Check if this is an image generation model
        const isImageGenModel = IMAGE_GENERATION_MODELS.includes(model);

        // Timing tracking
        const startTime = performance.now();
        let firstTokenTime = null;
        let tokenCount = 0;
        let usageStats = null;
        let generatedImages = [];
        
        try {
            const requestBody = {
                model,
                messages: processedMessages,
                stream: true,
                usage: { include: true },
                ...options,
            };

            // Add modalities for image generation models
            if (isImageGenModel) {
                requestBody.modalities = ['image', 'text'];
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(requestBody),
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API request failed: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            // Check for usage stats (comes in final chunk)
                            if (parsed.usage) {
                                usageStats = parsed.usage;
                            }
                            
                            // Handle text content
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                // Track first token time
                                if (firstTokenTime === null) {
                                    firstTokenTime = performance.now();
                                }
                                tokenCount++;
                                fullContent += content;
                                callbacks.onToken(content);
                            }

                            // Handle generated images (for image generation models)
                            const images = parsed.choices?.[0]?.delta?.images || 
                                          parsed.choices?.[0]?.message?.images;
                            if (images && images.length > 0) {
                                for (const img of images) {
                                    const imgUrl = img.image_url?.url || img.imageUrl?.url || img.url;
                                    if (imgUrl) {
                                        generatedImages.push({ url: imgUrl });
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }
            
            const endTime = performance.now();
            const totalTimeMs = endTime - startTime;
            const timeToFirstMs = firstTokenTime ? firstTokenTime - startTime : totalTimeMs;
            const generationTimeMs = firstTokenTime ? endTime - firstTokenTime : totalTimeMs;
            
            // Build stats object
            const stats = {
                completionTokens: usageStats?.completion_tokens || tokenCount,
                promptTokens: usageStats?.prompt_tokens || 0,
                totalTokens: usageStats?.total_tokens || tokenCount,
                timeToFirstToken: timeToFirstMs / 1000,
                tokensPerSecond: generationTimeMs > 0 ? ((usageStats?.completion_tokens || tokenCount) / (generationTimeMs / 1000)) : 0,
                totalTime: totalTimeMs / 1000,
            };
            
            // Pass images in the completion callback
            callbacks.onComplete(fullContent, stats, { images: generatedImages });
            
        } catch (error) {
            callbacks.onError(error);
        }
    }

    /**
     * Generate images using an image generation model
     * Note: OpenRouter uses the chat completions endpoint with modalities for image generation
     * @param {string} prompt - The image generation prompt
     * @param {string} model - The image generation model ID
     * @param {Object} [options] - Additional options (aspect_ratio, etc.)
     * @returns {Promise<ImageGenerationResult>}
     */
    async generateImage(prompt, model, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const requestBody = {
            model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            modalities: ['image', 'text'],
            stream: false,
        };

        // Add image config if provided (e.g., aspect_ratio)
        if (options.aspectRatio) {
            requestBody.image_config = {
                aspect_ratio: options.aspectRatio,
            };
        }

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Image generation failed: ${response.status}`);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;

        const result = {
            text: message?.content || '',
            images: [],
        };

        // Extract generated images
        if (message?.images && message.images.length > 0) {
            for (const img of message.images) {
                const imgUrl = img.image_url?.url || img.imageUrl?.url;
                if (imgUrl) {
                    result.images.push({ url: imgUrl });
                }
            }
        }

        return result;
    }
    
    /**
     * Test the API connection
     * @returns {Promise<boolean>}
     */
    async testConnection() {
        try {
            await this.chat('openai/gpt-4o-mini', [
                { role: 'user', content: 'Say "ok" and nothing else.' }
            ]);
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

// Singleton instance (will be configured with API key from settings)
let serviceInstance = null;

/**
 * Get or create the OpenRouter service instance
 * @param {string} [apiKey] - Optional API key to set
 * @returns {OpenRouterService}
 */
export function getOpenRouterService(apiKey) {
    if (!serviceInstance) {
        serviceInstance = new OpenRouterService(apiKey || '');
    } else if (apiKey) {
        serviceInstance.setApiKey(apiKey);
    }
    return serviceInstance;
}
