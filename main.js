// LampChat - Main Entry Point
// ============================

// Import CSS (processed by Vite + Tailwind)
import './src/style.css';

import { stateManager, getOpenRouterService } from './src/services/index.js';
import { Sidebar, ChatArea, MessageInput, Settings } from './src/components/index.js';
import { configureMarked } from './src/utils/markdown.js';
import { showConfirm } from './src/utils/dom.js';
import { isImageGenerationModel } from './src/config/models.js';

/**
 * Main application class
 */
class LampChat {
    constructor() {
        // Components
        this.sidebar = new Sidebar();
        this.chatArea = new ChatArea();
        this.messageInput = new MessageInput();
        this.settings = new Settings();

        // Services
        this.openRouter = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Configure markdown renderer
            configureMarked();

            // Initialize state
            await stateManager.initialize();

            // Initialize OpenRouter service with API key from settings
            const settings = stateManager.settings;
            this.openRouter = getOpenRouterService(settings?.apiKey);

            // Initialize components
            this._initComponents();

            // Set up event handlers
            this._setupHandlers();

            // Subscribe to settings changes to update API key
            stateManager.subscribe('settingsUpdated', (state) => {
                this.openRouter.setApiKey(state.settings?.apiKey || '');
            });

            // Check for API key
            if (!settings?.apiKey) {
                setTimeout(() => {
                    this.settings.open();
                }, 500);
            }

            console.log('LampChat initialized');

        } catch (error) {
            console.error('Failed to initialize LampChat:', error);
        }
    }

    /**
     * Initialize UI components
     * @private
     */
    _initComponents() {
        // Sidebar
        this.sidebar.init('sidebarContainer');

        // Chat area
        this.chatArea.init('chatContainer');

        // Message input
        this.messageInput.init('inputContainer');

        // Settings modal
        this.settings.init('settingsContainer');
    }

    /**
     * Set up event handlers
     * @private
     */
    _setupHandlers() {
        // Sidebar handlers
        this.sidebar.setHandlers({
            onNewChat: () => this._createNewChat(),
            onSelectChat: (chatId) => this._selectChat(chatId),
            onDeleteChat: (chatId) => this._deleteChat(chatId),
            onSearch: (query) => this._searchChats(query),
            onSettingsClick: () => this.settings.open(),
        });

        // Chat area handlers
        this.chatArea.setHandlers({
            onSettingsClick: () => this.settings.open(),
            onPromptSelect: (prompt) => this._usePrompt(prompt),
            onRegenerate: (messageId) => this._regenerateResponse(messageId),
        });

        // Message input handlers - now receives both message and attachments
        this.messageInput.setHandlers({
            onSubmit: (message, attachments) => this._sendMessage(message, attachments),
        });
    }

    /**
     * Create a new chat
     * @private
     */
    async _createNewChat() {
        await stateManager.createChat();
    }

    /**
     * Select a chat
     * @private
     */
    async _selectChat(chatId) {
        await stateManager.selectChat(chatId);
    }

    /**
     * Delete a chat
     * @private
     */
    async _deleteChat(chatId) {
        const confirmed = await showConfirm('Are you sure you want to delete this chat?', {
            title: 'Delete Chat',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
        });
        if (confirmed) {
            await stateManager.deleteChat(chatId);
        }
    }

    /**
     * Search chats
     * @private
     */
    async _searchChats(query) {
        // The sidebar component handles filtering internally
        // This could be extended for more complex search
    }

    /**
     * Use a suggested prompt
     * @private
     */
    _usePrompt(prompt) {
        this.messageInput.setValue(prompt);
        this.messageInput.focus();
    }

    /**
     * Regenerate a response
     * @private
     */
    async _regenerateResponse(messageId) {
        if (stateManager.isStreaming) return;

        const chat = stateManager.currentChat;
        if (!chat) return;

        // Find the message index
        const msgIndex = chat.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // Get messages up to (but not including) this assistant message
        // Preserve attachments for user messages so they can be rehydrated in chatStream
        const messagesForContext = chat.messages.slice(0, msgIndex).map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : this._extractTextContent(m.content),
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

            let streamedContent = '';
            const settings = stateManager.settings;
            const selectedModel = settings.selectedModel;
            const isImageGen = isImageGenerationModel(selectedModel);

            await this.openRouter.chatStream(
                selectedModel,
                messagesForContext,
                {
                    onToken: (token) => {
                        streamedContent += token;
                        // Use memory-only update during streaming (no disk write)
                        stateManager.updateStreamingMessage(messageId, streamedContent);
                    },
                    onComplete: async (fullContent, stats, extra) => {
                        this.chatArea.hideTypingIndicator();

                        const updateData = {
                            content: fullContent,
                            stats: {
                                model: selectedModel,
                                completionTokens: stats.completionTokens,
                                promptTokens: stats.promptTokens,
                                tokensPerSecond: stats.tokensPerSecond,
                                timeToFirstToken: stats.timeToFirstToken,
                            },
                        };

                        // Add generated images if present
                        if (extra?.images && extra.images.length > 0) {
                            updateData.generatedImages = extra.images;
                        }

                        // Persist final content + stats BEFORE ending streaming
                        // This ensures the single render triggered by setStreaming(false) has all data
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
                attachments // Pass attachments from the original user message
            );
        } catch (error) {
            console.error('Regenerate error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
        }
    }

    /**
     * Extract text content from multimodal content
     * @private
     * @param {string|Array} content
     * @returns {string}
     */
    _extractTextContent(content) {
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
     * @private
     * @param {string} message - The text message
     * @param {Array} attachments - File attachments
     */
    async _sendMessage(message, attachments = []) {
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
            // For storage, we store both the text and attachment references
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

            // Get conversation history - preserve attachments for multimodal context
            const chat = stateManager.currentChat;
            const messages = chat.messages.slice(0, -1).map(m => ({
                role: m.role,
                content: typeof m.content === 'string' ? m.content : this._extractTextContent(m.content),
                // Preserve attachments for user messages so they can be rehydrated in chatStream
                ...(m.role === 'user' && m.attachments?.length > 0 ? { attachments: m.attachments } : {}),
            }));

            // Use different approach for image generation vs chat
            if (isImageGen) {
                // Use non-streaming image generation for better compatibility
                try {
                    const result = await this.openRouter.generateImage(message, selectedModel);

                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    // Build update data
                    const updateData = {
                        content: result.text || 'Image generated successfully.',
                        stats: {
                            model: selectedModel,
                        },
                    };

                    // Add generated images
                    if (result.images && result.images.length > 0) {
                        updateData.generatedImages = result.images;
                    }

                    await stateManager.updateMessage(assistantMsg.id, updateData);
                } catch (error) {
                    console.error('Image generation error:', error);
                    this.chatArea.hideTypingIndicator();
                    stateManager.setStreaming(false);

                    await stateManager.updateMessage(assistantMsg.id, {
                        content: `Error: ${error.message}`,
                    });
                }
            } else {
                // Stream response for regular chat
                // Use local accumulator to avoid race condition with state updates
                let streamedContent = '';

                await this.openRouter.chatStream(
                    selectedModel,
                    messages,
                    {
                        onToken: (token) => {
                            // Accumulate locally to avoid race condition
                            streamedContent += token;
                            // Use memory-only update during streaming (no disk write)
                            stateManager.updateStreamingMessage(assistantMsg.id, streamedContent);
                        },
                        onComplete: async (fullContent, stats, extra) => {
                            this.chatArea.hideTypingIndicator();

                            // Build update data
                            const updateData = {
                                content: fullContent,
                                stats: {
                                    model: selectedModel,
                                    completionTokens: stats.completionTokens,
                                    promptTokens: stats.promptTokens,
                                    tokensPerSecond: stats.tokensPerSecond,
                                    timeToFirstToken: stats.timeToFirstToken,
                                },
                            };

                            // Add generated images if present (from image generation models)
                            if (extra?.images && extra.images.length > 0) {
                                updateData.generatedImages = extra.images;
                            }

                            // Persist final content + stats BEFORE ending streaming
                            // This ensures the single render triggered by setStreaming(false) has all data
                            await stateManager.updateMessage(assistantMsg.id, updateData);
                            stateManager.setStreaming(false);
                        },
                        onError: async (error) => {
                            console.error('Stream error:', error);
                            this.chatArea.hideTypingIndicator();
                            stateManager.setStreaming(false);

                            await stateManager.updateMessage(assistantMsg.id, {
                                content: `Error: ${error.message}`,
                            });
                        },
                    },
                    {},
                    attachments // Pass attachments to the service
                );
            }

        } catch (error) {
            console.error('Send message error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
            alert('Failed to send message: ' + error.message);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new LampChat();
    app.init();

    // Expose for debugging
    window.lampChat = app;
});
