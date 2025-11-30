// LampChat - Main Entry Point
// ============================

// Import CSS (processed by Vite + Tailwind)
import './src/style.css';

import { stateManager, getOpenRouterService, ChatController } from './src/services/index.js';
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
        this.chatController = null;
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

            // Initialize chat controller (after components are ready)
            this.chatController = new ChatController({
                openRouterService: this.openRouter,
                chatArea: this.chatArea,
                settings: this.settings,
            });

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
            onRegenerate: (messageId) => this.chatController.regenerateResponse(messageId),
        });

        // Message input handlers - delegate to chat controller
        this.messageInput.setHandlers({
            onSubmit: (message, attachments) => this.chatController.sendMessage(message, attachments),
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new LampChat();
    app.init();

    // Expose for debugging
    window.lampChat = app;
});
