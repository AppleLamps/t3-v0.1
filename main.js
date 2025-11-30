// LampChat - Main Entry Point
// ============================

// Import CSS (processed by Vite + Tailwind)
import './src/style.css';

import { stateManager, getOpenRouterService } from './src/services/index.js';
import { Sidebar, ChatArea, MessageInput, Settings } from './src/components/index.js';
import { configureMarked } from './src/utils/markdown.js';
import { showConfirm } from './src/utils/dom.js';

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

        // Message input handlers
        this.messageInput.setHandlers({
            onSubmit: (message) => this._sendMessage(message),
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
        const messagesForContext = chat.messages.slice(0, msgIndex).map(m => ({
            role: m.role,
            content: m.content,
        }));
        
        if (messagesForContext.length === 0) return;
        
        try {
            // Show typing indicator
            this.chatArea.showTypingIndicator();
            stateManager.setStreaming(true);
            
            // Clear the existing message content
            await stateManager.updateMessage(messageId, { content: '', stats: null });
            
            let streamedContent = '';
            const settings = stateManager.settings;
            
            await this.openRouter.chatStream(
                settings.selectedModel,
                messagesForContext,
                {
                    onToken: async (token) => {
                        streamedContent += token;
                        await stateManager.updateMessage(messageId, {
                            content: streamedContent,
                        });
                    },
                    onComplete: async (fullContent, stats) => {
                        this.chatArea.hideTypingIndicator();
                        stateManager.setStreaming(false);
                        
                        await stateManager.updateMessage(messageId, {
                            content: fullContent,
                            stats: {
                                model: settings.selectedModel,
                                completionTokens: stats.completionTokens,
                                promptTokens: stats.promptTokens,
                                tokensPerSecond: stats.tokensPerSecond,
                                timeToFirstToken: stats.timeToFirstToken,
                            },
                        });
                    },
                    onError: async (error) => {
                        console.error('Regenerate error:', error);
                        this.chatArea.hideTypingIndicator();
                        stateManager.setStreaming(false);
                        
                        await stateManager.updateMessage(messageId, {
                            content: `Error: ${error.message}`,
                        });
                    },
                }
            );
        } catch (error) {
            console.error('Regenerate error:', error);
            this.chatArea.hideTypingIndicator();
            stateManager.setStreaming(false);
        }
    }

    /**
     * Send a message
     * @private
     */
    async _sendMessage(message) {
        if (!message.trim()) return;

        // Check for API key
        if (!this.openRouter.hasApiKey()) {
            alert('Please set your OpenRouter API key in Settings first.');
            this.settings.open();
            return;
        }

        try {
            // Add user message
            await stateManager.addMessage({
                role: 'user',
                content: message,
            });

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
                content: m.content,
            }));

            // Stream response
            const settings = stateManager.settings;
            
            // Use local accumulator to avoid race condition with state updates
            let streamedContent = '';

            await this.openRouter.chatStream(
                settings.selectedModel,
                messages,
                {
                    onToken: async (token) => {
                        // Accumulate locally to avoid race condition
                        streamedContent += token;
                        await stateManager.updateMessage(assistantMsg.id, {
                            content: streamedContent,
                        });
                    },
                    onComplete: async (fullContent, stats) => {
                        this.chatArea.hideTypingIndicator();
                        stateManager.setStreaming(false);
                        
                        // Save stats with the message
                        await stateManager.updateMessage(assistantMsg.id, {
                            content: fullContent,
                            stats: {
                                model: settings.selectedModel,
                                completionTokens: stats.completionTokens,
                                promptTokens: stats.promptTokens,
                                tokensPerSecond: stats.tokensPerSecond,
                                timeToFirstToken: stats.timeToFirstToken,
                            },
                        });
                    },
                    onError: async (error) => {
                        console.error('Stream error:', error);
                        this.chatArea.hideTypingIndicator();
                        stateManager.setStreaming(false);

                        await stateManager.updateMessage(assistantMsg.id, {
                            content: `Error: ${error.message}`,
                        });
                    },
                }
            );

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

