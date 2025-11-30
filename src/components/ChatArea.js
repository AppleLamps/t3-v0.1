// Chat Area Component
// ===================

import { stateManager } from '../services/state.js';
import { $, escapeHtml, setHtml, scrollToBottom } from '../utils/dom.js';
import { renderMarkdown, processMessageContent } from '../utils/markdown.js';

/**
 * Chat area component - displays messages and welcome screen
 */
export class ChatArea {
    constructor() {
        this.elements = {
            chatArea: null,
            welcomeScreen: null,
            messagesContainer: null,
            chatTitle: null,
            welcomeName: null,
        };
        
        this._unsubscribers = [];
    }
    
    /**
     * Initialize the chat area
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = $(containerId);
        if (!container) {
            console.error('Chat area container not found');
            return;
        }
        
        container.innerHTML = this._render();
        this._cacheElements();
        this._bindEvents();
        this._subscribeToState();
        this.refresh();
    }
    
    /**
     * Render chat area HTML
     * @private
     */
    _render() {
        return `
            <!-- Top Bar -->
            <header class="h-14 border-b border-lamp-border flex items-center justify-between px-4 bg-lamp-card">
                <div class="flex items-center gap-2">
                    <button id="toggleSidebarBtn" class="p-2 hover:bg-lamp-input rounded-lg transition-colors lg:hidden">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                    </button>
                    <h1 id="chatTitle" class="font-medium truncate">New Chat</h1>
                </div>
                <div class="flex items-center gap-2">
                    <button id="headerSettingsBtn" class="p-2 hover:bg-lamp-input rounded-lg transition-colors" title="Settings">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </button>
                </div>
            </header>
            
            <!-- Chat Area -->
            <div id="chatArea" class="flex-1 overflow-y-auto">
                <!-- Welcome Screen -->
                <div id="welcomeScreen" class="h-full flex flex-col items-center justify-center p-8">
                    <h2 class="text-3xl font-semibold mb-6">How can I help you<span id="welcomeName"></span>?</h2>
                    
                    <!-- Quick Action Buttons -->
                    <div class="flex flex-wrap justify-center gap-3 mb-8">
                        <button data-category="create" class="category-btn flex items-center gap-2 px-4 py-2.5 bg-lamp-card border border-lamp-border rounded-full hover:border-lamp-accent transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            Create
                        </button>
                        <button data-category="explore" class="category-btn flex items-center gap-2 px-4 py-2.5 bg-lamp-card border border-lamp-border rounded-full hover:border-lamp-accent transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            Explore
                        </button>
                        <button data-category="code" class="category-btn flex items-center gap-2 px-4 py-2.5 bg-lamp-card border border-lamp-border rounded-full hover:border-lamp-accent transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                            </svg>
                            Code
                        </button>
                        <button data-category="learn" class="category-btn flex items-center gap-2 px-4 py-2.5 bg-lamp-card border border-lamp-border rounded-full hover:border-lamp-accent transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            </svg>
                            Learn
                        </button>
                    </div>
                    
                    <!-- Suggested Prompts -->
                    <div id="suggestedPrompts" class="w-full max-w-2xl space-y-2">
                        <button data-prompt="How does AI work?" class="prompt-btn w-full text-left p-4 bg-lamp-card border border-lamp-border rounded-xl hover:border-lamp-accent transition-colors">
                            How does AI work?
                        </button>
                        <button data-prompt="Explain quantum computing in simple terms" class="prompt-btn w-full text-left p-4 bg-lamp-card border border-lamp-border rounded-xl hover:border-lamp-accent transition-colors">
                            Explain quantum computing in simple terms
                        </button>
                        <button data-prompt="Write a Python function to sort a list" class="prompt-btn w-full text-left p-4 bg-lamp-card border border-lamp-border rounded-xl hover:border-lamp-accent transition-colors">
                            Write a Python function to sort a list
                        </button>
                        <button data-prompt="What are the best practices for web development?" class="prompt-btn w-full text-left p-4 bg-lamp-card border border-lamp-border rounded-xl hover:border-lamp-accent transition-colors">
                            What are the best practices for web development?
                        </button>
                    </div>
                </div>
                
                <!-- Messages Container -->
                <div id="messagesContainer" class="hidden max-w-4xl mx-auto p-4 space-y-6">
                    <!-- Messages will be rendered here -->
                </div>
            </div>
        `;
    }
    
    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.chatArea = $('chatArea');
        this.elements.welcomeScreen = $('welcomeScreen');
        this.elements.messagesContainer = $('messagesContainer');
        this.elements.chatTitle = $('chatTitle');
        this.elements.welcomeName = $('welcomeName');
        this.elements.suggestedPrompts = $('suggestedPrompts');
    }
    
    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Toggle sidebar button
        $('toggleSidebarBtn')?.addEventListener('click', () => {
            stateManager.toggleSidebar();
        });
        
        // Settings button
        $('headerSettingsBtn')?.addEventListener('click', () => {
            if (this.onSettingsClick) this.onSettingsClick();
        });
        
        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._setPromptCategory(btn.dataset.category);
            });
        });
        
        // Prompt buttons (delegated)
        this.elements.suggestedPrompts?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-prompt]');
            if (btn && this.onPromptSelect) {
                this.onPromptSelect(btn.dataset.prompt);
            }
        });
    }
    
    /**
     * Subscribe to state changes
     * @private
     */
    _subscribeToState() {
        this._unsubscribers.push(
            stateManager.subscribe('currentChatChanged', () => this.refresh()),
            stateManager.subscribe('messageAdded', () => this.renderMessages()),
            stateManager.subscribe('messageUpdated', () => this.renderMessages()),
            stateManager.subscribe('userUpdated', () => this._updateWelcomeName()),
        );
    }
    
    /**
     * Refresh the chat area
     */
    refresh() {
        this._updateTitle();
        this._updateWelcomeName();
        this.renderMessages();
    }
    
    /**
     * Update chat title
     * @private
     */
    _updateTitle() {
        const chat = stateManager.currentChat;
        if (this.elements.chatTitle) {
            this.elements.chatTitle.textContent = chat?.title || 'New Chat';
        }
    }
    
    /**
     * Update welcome name
     * @private
     */
    _updateWelcomeName() {
        const user = stateManager.user;
        if (this.elements.welcomeName) {
            this.elements.welcomeName.textContent = user?.name ? `, ${user.name}` : '';
        }
    }
    
    /**
     * Render messages
     */
    renderMessages() {
        const chat = stateManager.currentChat;
        const user = stateManager.user;
        
        if (!chat || chat.messages.length === 0) {
            this.elements.welcomeScreen?.classList.remove('hidden');
            this.elements.messagesContainer?.classList.add('hidden');
            return;
        }
        
        this.elements.welcomeScreen?.classList.add('hidden');
        this.elements.messagesContainer?.classList.remove('hidden');
        
        const userInitial = (user?.name || 'U').charAt(0).toUpperCase();
        
        let html = '';
        for (const msg of chat.messages) {
            const isUser = msg.role === 'user';
            html += `
                <div class="flex gap-4 animate-fade-in ${isUser ? 'justify-end' : ''}">
                    ${!isUser ? `
                        <div class="w-8 h-8 rounded-lg bg-lamp-accent flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                            </svg>
                        </div>
                    ` : ''}
                    <div class="${isUser ? 'bg-lamp-accent text-white' : 'bg-lamp-card border border-lamp-border'} rounded-2xl px-4 py-3 max-w-[80%]">
                        <div class="message-content ${isUser ? '' : 'prose prose-sm max-w-none'}">${isUser ? escapeHtml(msg.content) : renderMarkdown(msg.content)}</div>
                    </div>
                    ${isUser ? `
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-medium">
                            ${userInitial}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        setHtml(this.elements.messagesContainer, html);
        
        // Process markdown content (code highlighting, copy buttons)
        processMessageContent(this.elements.messagesContainer);
        
        // Scroll to bottom
        scrollToBottom(this.elements.chatArea);
    }
    
    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        const html = `
            <div id="typingIndicator" class="flex gap-4 animate-fade-in">
                <div class="w-8 h-8 rounded-lg bg-lamp-accent flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                </div>
                <div class="bg-lamp-card border border-lamp-border rounded-2xl px-4 py-3">
                    <div class="flex gap-1">
                        <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                        <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                        <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.messagesContainer?.insertAdjacentHTML('beforeend', html);
        scrollToBottom(this.elements.chatArea);
    }
    
    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        $('typingIndicator')?.remove();
    }
    
    /**
     * Set prompt category
     * @private
     */
    _setPromptCategory(category) {
        const prompts = {
            create: [
                'Write a poem about technology',
                'Create a short story about adventure',
                'Design a logo concept for a coffee shop',
                'Write a song about friendship',
            ],
            explore: [
                'What are the latest trends in AI?',
                'Explain the history of the internet',
                'What causes northern lights?',
                'How do black holes form?',
            ],
            code: [
                'Write a Python function to sort a list',
                'Create a React component for a button',
                'Explain recursion with an example',
                'How do I use async/await in JavaScript?',
            ],
            learn: [
                'Teach me about machine learning',
                'Explain quantum computing simply',
                'What is blockchain technology?',
                'How does the stock market work?',
            ],
        };
        
        const categoryPrompts = prompts[category] || prompts.explore;
        
        if (this.elements.suggestedPrompts) {
            setHtml(this.elements.suggestedPrompts, categoryPrompts.map(p => `
                <button data-prompt="${escapeHtml(p)}" class="prompt-btn w-full text-left p-4 bg-lamp-card border border-lamp-border rounded-xl hover:border-lamp-accent transition-colors">
                    ${escapeHtml(p)}
                </button>
            `).join(''));
        }
    }
    
    /**
     * Set event handlers
     * @param {Object} handlers 
     */
    setHandlers(handlers) {
        this.onSettingsClick = handlers.onSettingsClick;
        this.onPromptSelect = handlers.onPromptSelect;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}

