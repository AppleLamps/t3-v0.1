// LampChat - Main Entry Point
// ============================

import { stateManager, getOpenRouterService } from './src/services/index.js';
import { Sidebar, ChatArea, MessageInput, Settings } from './src/components/index.js';
import { configureMarked } from './src/utils/markdown.js';

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
        if (confirm('Delete this chat?')) {
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
            
            await this.openRouter.chatStream(
                settings.selectedModel,
                messages,
                {
                    onToken: async (token) => {
                        // Update message content
                        const currentContent = stateManager.currentChat.messages[stateManager.currentChat.messages.length - 1].content;
                        await stateManager.updateMessage(assistantMsg.id, {
                            content: currentContent + token,
                        });
                    },
                    onComplete: (fullContent) => {
                        this.chatArea.hideTypingIndicator();
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

