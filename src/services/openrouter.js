// OpenRouter API Service
// ======================
// Handles all communication with the OpenRouter API

import { OPENROUTER_API_URL, APP_NAME } from '../config/constants.js';

/**
 * @typedef {Object} ChatMessage
 * @property {string} role - 'user' | 'assistant' | 'system'
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} StreamCallbacks
 * @property {function(string): void} onToken - Called for each token
 * @property {function(string): void} onComplete - Called when stream completes
 * @property {function(Error): void} onError - Called on error
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
     * @returns {Promise<void>}
     */
    async chatStream(model, messages, callbacks, options = {}) {
        if (!this.apiKey) {
            callbacks.onError(new Error('API key not configured'));
            return;
        }
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    ...options,
                }),
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
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                callbacks.onToken(content);
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }
            
            callbacks.onComplete(fullContent);
            
        } catch (error) {
            callbacks.onError(error);
        }
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

