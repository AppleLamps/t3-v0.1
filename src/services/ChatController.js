// Chat Controller Service
// =======================
// Handles message sending, regeneration, and streaming logic.
// Extracted from main.js to reduce monolithic code and improve testability.

import { stateManager } from './state.js';
import { isImageGenerationModel } from '../config/models.js';

/**
 * Chat controller - handles message operations
 */
export class ChatController {
    /**
     * @param {Object} options
     * @param {Object} options.openRouterService - OpenRouter service instance
     * @param {Object} options.chatArea - ChatArea component for typing indicator
     * @param {Object} options.settings - Settings component for opening settings
     */
    constructor({ openRouterService, chatArea, settings }) {
        this.openRouter = openRouterService;
        this.chatArea = chatArea;
        this.settings = settings;
    }

    /**
     * Update the OpenRouter service instance
     * @param {Object} service - New OpenRouter service
     */
    setOpenRouterService(service) {
        this.openRouter = service;
    }

    /**
     * Extract text content from multimodal content
     * @param {string|Array} content
     * @returns {string}
     */
    extractTextContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
        }
        return '';
    }

    /**
     * Send a message
     * @param {string} message - The text message
     * @param {Array} attachments - File attachments
     */
    async sendMessage(message, attachments = []) {
        // Allow sending if there's a message OR attachments
        if (!message.trim() && attachments.length === 0) return;

        // Check for API key
        if (!this.openRouter.hasApiKey()) {
            alert('Please set your OpenRouter API key in Settings first.');
            this.settings.open();
            return;
        }

        const settings = stateManager.settings;
        const selectedModel = settings.selectedModel;
        const isImageGen = isImageGenerationModel(selectedModel);

        try {
            // Build user message content
            const userMessageData = {
                role: 'user',
                content: message,
                attachments: attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    type: att.type,
                    mimeType: att.mimeType,
                    size: att.size,
                    dataUrl: att.dataUrl,
                })),
            };

            // Add user message
            await stateManager.addMessage(userMessageData);

            // Show typing indicator
            this.chatArea.showTypingIndicator();
            stateManager.setStreaming(true);

            // Add placeholder for assistant message
            const assistantMsg = await stateManager.addMessage({
                role: 'assistant',
                content: '',
            });

            // Get conversation history
            const chat = stateManager.currentChat;
            const messages = chat.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
                ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
            }));

            if (isImageGen) {
                await this._handleImageGeneration(message, selectedModel, assistantMsg.id);
            } else {
                await this._handleChatStream(messages, selectedModel, assistantMsg.id, attachments);
            }

        } catch (error) {
            console.error('Send message error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
            alert('Failed to send message: ' + error.message);
        }
    }

    /**
     * Regenerate a response
     * @param {string} messageId - The message ID to regenerate
     */
    async regenerateResponse(messageId) {
        if (stateManager.isStreaming) return;

        const chat = stateManager.currentChat;
        if (!chat) return;

        // Find the message index
        const msgIndex = chat.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // Get messages up to (but not including) this assistant message
        const messagesForContext = chat.messages.slice(0, msgIndex).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
            ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
        }));

        if (messagesForContext.length === 0) return;

        // Find the last user message before this assistant message to get its attachments
        const lastUserMsg = chat.messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
        const attachments = lastUserMsg?.attachments || [];

        try {
            // Show typing indicator
            this.chatArea.showTypingIndicator();
            stateManager.setStreaming(true);

            // Clear the existing message content
            await stateManager.updateMessage(messageId, { content: '', stats: null, generatedImages: null });

            const settings = stateManager.settings;
            const selectedModel = settings.selectedModel;
            const isImageGen = isImageGenerationModel(selectedModel);

            if (isImageGen) {
                // Get the original user message for image regeneration
                const userMessage = messagesForContext[messagesForContext.length - 1]?.content || '';
                await this._handleImageGeneration(userMessage, selectedModel, messageId);
            } else {
                await this._handleRegenerateStream(messagesForContext, selectedModel, messageId, attachments);
            }

        } catch (error) {
            console.error('Regenerate error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
        }
    }

    /**
     * Handle image generation (non-streaming)
     * @private
     */
    async _handleImageGeneration(prompt, model, messageId) {
        try {
            const result = await this.openRouter.generateImage(prompt, model);

            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);

            const updateData = {
                content: result.text || 'Image generated successfully.',
                stats: { model },
            };

            if (result.images && result.images.length > 0) {
                updateData.generatedImages = result.images;
            }

            await stateManager.updateMessage(messageId, updateData);
        } catch (error) {
            console.error('Image generation error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);

            await stateManager.updateMessage(messageId, {
                content: `Error: ${error.message}`,
            });
        }
    }

    /**
     * Handle chat streaming for new messages
     * @private
     */
    async _handleChatStream(messages, model, messageId, attachments) {
        let streamedContent = '';

        await this.openRouter.chatStream(
            model,
            messages,
            {
                onToken: (token) => {
                    streamedContent += token;
                    stateManager.updateStreamingMessage(messageId, streamedContent);
                },
                onComplete: async (fullContent, stats, extra) => {
                    this.chatArea.hideTypingIndicator();

                    const updateData = {
                        content: fullContent,
                        stats: {
                            model,
                            completionTokens: stats.completionTokens,
                            promptTokens: stats.promptTokens,
                            tokensPerSecond: stats.tokensPerSecond,
                            timeToFirstToken: stats.timeToFirstToken,
                        },
                    };

                    if (extra?.images && extra.images.length > 0) {
                        updateData.generatedImages = extra.images;
                    }

                    await stateManager.updateMessage(messageId, updateData);
                    stateManager.setStreaming(false);
                },
                onError: async (error) => {
                    console.error('Stream error:', error);
                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    await stateManager.updateMessage(messageId, {
                        content: `Error: ${error.message}`,
                    });
                },
            },
            {},
            attachments
        );
    }

    /**
     * Handle chat streaming for regeneration
     * @private
     */
    async _handleRegenerateStream(messages, model, messageId, attachments) {
        let streamedContent = '';

        await this.openRouter.chatStream(
            model,
            messages,
            {
                onToken: (token) => {
                    streamedContent += token;
                    stateManager.updateStreamingMessage(messageId, streamedContent);
                },
                onComplete: async (fullContent, stats, extra) => {
                    this.chatArea.hideTypingIndicator();

                    const updateData = {
                        content: fullContent,
                        stats: {
                            model,
                            completionTokens: stats.completionTokens,
                            promptTokens: stats.promptTokens,
                            tokensPerSecond: stats.tokensPerSecond,
                            timeToFirstToken: stats.timeToFirstToken,
                        },
                    };

                    if (extra?.images && extra.images.length > 0) {
                        updateData.generatedImages = extra.images;
                    }

                    await stateManager.updateMessage(messageId, updateData);
                    stateManager.setStreaming(false);
                },
                onError: async (error) => {
                    console.error('Regenerate error:', error);
                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    await stateManager.updateMessage(messageId, {
                        content: `Error: ${error.message}`,
                    });
                },
            },
            {},
            attachments
        );
    }
}
