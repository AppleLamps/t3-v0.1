// LampChat - Main Entry Point
// ============================

// Import CSS (processed by Vite + Tailwind)
import './src/style.css';

import { stateManager, getOpenRouterService, ChatController } from './src/services/index.js';
import { authService } from './src/services/auth.js';
import { Sidebar, ChatArea, MessageInput, Settings, AuthModal } from './src/components/index.js';
import { ProjectModal } from './src/components/ProjectModal.js';
import { ProjectDashboard } from './src/components/ProjectDashboard.js';
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
        this.authModal = new AuthModal();
        this.projectModal = new ProjectModal();
        this.projectDashboard = new ProjectDashboard();

        // Services
        this.openRouter = null;
        this.chatController = null;

        // Track auth state for reinitialization
        this._lastAuthState = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Configure markdown renderer
            configureMarked();

            // Initialize auth service first
            await authService.initialize();
            this._lastAuthState = authService.isLoggedIn();

            // Initialize state (will use correct repository based on auth)
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

            // Subscribe to auth state changes for reinitialization
            authService.subscribe(async (state) => {
                await this._handleAuthChange(state);
            });

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

            console.log('LampChat initialized', authService.isLoggedIn() ? '(authenticated)' : '(local mode)');

        } catch (error) {
            console.error('Failed to initialize LampChat:', error);
        }
    }

    /**
     * Handle auth state changes
     * @private
     */
    async _handleAuthChange(state) {
        const currentAuthState = state.isLoggedIn;

        // Only reinitialize if auth state actually changed
        if (currentAuthState !== this._lastAuthState) {
            console.log('Auth state changed:', currentAuthState ? 'logged in' : 'logged out');
            this._lastAuthState = currentAuthState;

            // Reinitialize state manager with new repository
            // This will fetch data from the appropriate source (Neon or localStorage)
            stateManager._initialized = false;
            await stateManager.initialize();

            // Update OpenRouter with new settings
            const settings = stateManager.settings;
            this.openRouter.setApiKey(settings?.apiKey || '');

            // Refresh sidebar to show updated chats
            this.sidebar.refresh();

            // Update chat area - renderMessages handles both chat and welcome states
            this.chatArea.renderMessages();
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

        // Auth modal
        this.authModal.init('authContainer');

        // Project modal
        this.projectModal.init('projectModalContainer');

        // Project dashboard
        this.projectDashboard.init('projectDashboardContainer');
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
            onAuthClick: () => this._handleAuthClick(),
            onNewProject: () => this._createNewProject(),
            onSelectProject: (projectId) => this._selectProject(projectId),
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

        // Project dashboard handlers
        this.projectDashboard.setHandlers({
            onEditProject: (project) => this.projectModal.showEdit(project),
            onSelectChat: (chatId) => this._selectChat(chatId),
            onNewChat: () => this._createNewChat(),
        });

        // Subscribe to project selection changes
        stateManager.subscribe('projectSelected', (state, projectId) => {
            this._handleProjectSelection(projectId);
        });
    }

    /**
     * Handle auth button click
     * @private
     */
    async _handleAuthClick() {
        if (authService.isLoggedIn()) {
            // Show confirmation before logging out
            const confirmed = await showConfirm(
                'Your cloud-synced chats will no longer be accessible until you sign in again. Local chats will still be available.',
                {
                    title: 'Sign Out',
                    confirmText: 'Sign Out',
                    cancelText: 'Cancel',
                    danger: true,
                }
            );

            if (confirmed) {
                authService.logout();
            }
        } else {
            // Show auth modal for login/signup
            this.authModal.open('login', (user) => {
                console.log('Successfully authenticated:', user.email);
            });
        }
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
     * Create a new project
     * @private
     */
    _createNewProject() {
        this.projectModal.show((project) => {
            // After project creation, select it
            stateManager.selectProject(project.id);
        });
    }

    /**
     * Select a project (or deselect if empty string)
     * @private
     */
    async _selectProject(projectId) {
        await stateManager.selectProject(projectId || null);
    }

    /**
     * Handle project selection changes
     * @private
     */
    _handleProjectSelection(projectId) {
        if (projectId) {
            // Show project dashboard, hide chat area
            this.projectDashboard.show();
            document.getElementById('chatContainer')?.classList.add('hidden');
            document.getElementById('inputContainer')?.classList.add('hidden');
        } else {
            // Hide project dashboard, show chat area
            this.projectDashboard.hide();
            document.getElementById('chatContainer')?.classList.remove('hidden');
            document.getElementById('inputContainer')?.classList.remove('hidden');

            // Refresh chat area - renderMessages handles both chat and welcome states
            this.chatArea.renderMessages();
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
