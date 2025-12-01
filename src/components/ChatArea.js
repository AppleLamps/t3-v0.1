// Chat Area Component
// ===================

import { stateManager } from '../services/state.js';
import { $, setHtml, scrollToBottom } from '../utils/dom.js';
import { renderMarkdown, processMessageContent } from '../utils/markdown.js';
import { MessageRenderer } from './chat/MessageRenderer.js';
import { TypingIndicator } from './chat/TypingIndicator.js';
import { WelcomeScreen } from './chat/WelcomeScreen.js';
import { PromptSelector } from './chat/PromptSelector.js';
import { mixinComponentLifecycle } from './Component.js';

/**
 * Chat area component - displays messages and welcome screen
 */
export class ChatArea {
    constructor() {
        this.elements = {
            chatArea: null,
            welcomeScreen: null,
            messagesContainer: null,
            welcomeName: null,
        };

        this._unsubscribers = [];
        this._streamingMessageId = null;
        this._streamingElement = null;

        // Performance: Buffer for streaming content updates
        this._pendingStreamContent = null;
        this._rafId = null;

        // Add lifecycle management for automatic cleanup
        mixinComponentLifecycle(this);

        // Sub-components
        this._messageRenderer = null;
        this._typingIndicator = null;
        this._welcomeScreen = null;
        this._promptSelector = null;
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
        this._initSubComponents();
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
            <!-- Top Bar - Hidden in empty state, visible when chat has messages -->
            <header id="chatHeader" style="display: none;" class="flex-shrink-0 h-14 flex items-center justify-between px-6 bg-transparent z-10">
                <div class="flex items-center">
                    <button id="toggleSidebarBtn" class="p-2 text-lamp-muted hover:text-lamp-text transition-colors" title="Toggle Sidebar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                    </button>
                </div>
                <div class="flex items-center">
                    <button id="headerSettingsBtn" class="p-2 text-lamp-muted hover:text-lamp-text transition-colors" title="Settings">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                    </button>
                </div>
            </header>
            
            <!-- Chat Area -->
            <div id="chatArea" class="flex-1 overflow-y-auto relative">
                <!-- Floating Settings Button (visible in empty state) -->
                <button id="floatingSettingsBtn" class="absolute top-4 right-4 p-2 hover:bg-lamp-input rounded-lg transition-colors z-10" title="Settings">
                    <svg class="w-5 h-5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                </button>
                
                <!-- Welcome Screen -->
                <div id="welcomeScreen" class="h-full flex flex-col items-center justify-center p-8">
                    <!-- Content will be rendered by WelcomeScreen component -->
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
        this.elements.chatHeader = $('chatHeader');
        this.elements.welcomeScreen = $('welcomeScreen');
        this.elements.messagesContainer = $('messagesContainer');
        this.elements.welcomeName = $('welcomeName');
        this.elements.suggestedPrompts = $('suggestedPrompts');
        this.elements.floatingSettingsBtn = $('floatingSettingsBtn');
    }

    /**
     * Initialize sub-components
     * @private
     */
    _initSubComponents() {
        // Initialize message renderer
        this._messageRenderer = new MessageRenderer();

        // Initialize typing indicator
        this._typingIndicator = new TypingIndicator(
            this.elements.messagesContainer,
            this.elements.chatArea
        );

        // Initialize welcome screen
        this._welcomeScreen = new WelcomeScreen(
            this.elements.welcomeScreen,
            this.elements.welcomeName,
            this.elements.suggestedPrompts
        );

        // Render welcome screen content
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.innerHTML = this._welcomeScreen.render();
            // Re-cache welcomeName and suggestedPrompts after rendering
            this.elements.welcomeName = $('welcomeName');
            this.elements.suggestedPrompts = $('suggestedPrompts');
        }

        // Initialize prompt selector
        this._promptSelector = new PromptSelector(
            this.elements.suggestedPrompts,
            (prompt) => {
                if (this.onPromptSelect) {
                    this.onPromptSelect(prompt);
                }
            }
        );
    }

    /**
     * Bind event handlers
     * Uses this.on() for automatic cleanup on destroy
     * @private
     */
    _bindEvents() {
        // Toggle sidebar button
        const toggleSidebarBtn = $('toggleSidebarBtn');
        if (toggleSidebarBtn) {
            this.on(toggleSidebarBtn, 'click', () => {
                stateManager.toggleSidebar();
            });
        }

        // Settings button (header)
        const headerSettingsBtn = $('headerSettingsBtn');
        if (headerSettingsBtn) {
            this.on(headerSettingsBtn, 'click', () => {
                if (this.onSettingsClick) this.onSettingsClick();
            });
        }

        // Floating settings button (welcome screen)
        const floatingSettingsBtn = $('floatingSettingsBtn');
        if (floatingSettingsBtn) {
            this.on(floatingSettingsBtn, 'click', () => {
                if (this.onSettingsClick) this.onSettingsClick();
            });
        }

        // Category buttons (delegated)
        if (this.elements.welcomeScreen) {
            this.on(this.elements.welcomeScreen, 'click', (e) => {
                const btn = e.target.closest('[data-category]');
                if (btn && this._promptSelector) {
                    this._promptSelector.setCategory(btn.dataset.category);
                }
            });
        }

        // Prompt buttons (delegated)
        if (this._promptSelector) {
            this._promptSelector.bindPromptSelection(this.elements.suggestedPrompts);
        }

        // Message actions (delegated)
        if (this.elements.messagesContainer) {
            this.on(this.elements.messagesContainer, 'click', (e) => {
                const copyBtn = e.target.closest('[data-copy-msg]');
                const regenBtn = e.target.closest('[data-regen-msg]');
                const imageEl = e.target.closest('[data-image-url]');
                const downloadBtn = e.target.closest('.download-btn');

                if (copyBtn) {
                    this._copyMessage(copyBtn.dataset.copyMsg);
                } else if (regenBtn) {
                    if (this.onRegenerate) {
                        this.onRegenerate(regenBtn.dataset.regenMsg);
                    }
                } else if (imageEl && !downloadBtn) {
                    // Open image in lightbox (unless clicking download button)
                    const url = imageEl.dataset.imageUrl;
                    if (url) {
                        this._openImageLightbox(url);
                    }
                }
            });
        }
    }

    /**
     * Copy message content to clipboard
     * @private
     */
    async _copyMessage(messageId) {
        const chat = stateManager.currentChat;
        if (!chat) return;

        const msg = chat.messages.find(m => m.id === messageId);
        if (!msg) return;

        // Get text content (handle both string and multimodal array)
        const textContent = this._messageRenderer.extractTextContent(msg.content);

        try {
            await navigator.clipboard.writeText(textContent);
            // Show brief feedback
            const btn = document.querySelector(`[data-copy-msg="${messageId}"]`);
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `<svg class="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
                setTimeout(() => { btn.innerHTML = originalHTML; }, 1500);
            }
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    /**
     * Subscribe to state changes
     * @private
     */
    _subscribeToState() {
        this._unsubscribers.push(
            stateManager.subscribe('currentChatChanged', () => this.refresh()),
            stateManager.subscribe('messageAdded', (state, data) => this._onMessageAdded(data)),
            stateManager.subscribe('messageUpdated', (state, data) => this._onMessageUpdated(data)),
            stateManager.subscribe('userUpdated', () => this._updateWelcomeName()),
            stateManager.subscribe('streamingChanged', (state, isStreaming) => {
                if (!isStreaming) {
                    // Streaming ended - cleanup and do a full re-render to show stats
                    this._streamingMessageId = null;
                    this._streamingElement = null;
                    this._pendingStreamContent = null;

                    // Cancel any pending animation frame
                    if (this._rafId) {
                        cancelAnimationFrame(this._rafId);
                        this._rafId = null;
                    }

                    this.renderMessages();
                }
            }),
        );
    }

    /**
     * Handle message added
     * @private
     */
    _onMessageAdded(data) {
        const msg = data?.message;

        // For streaming assistant messages, render all messages EXCEPT the streaming one,
        // then append the streaming placeholder
        if (msg?.role === 'assistant' && stateManager.isStreaming) {
            this._streamingMessageId = msg.id;
            // Render all messages except the last one (the empty assistant placeholder)
            this._renderMessagesExceptLast();
            // Then append the streaming placeholder
            this._appendStreamingMessage(msg);
            return;
        }

        // For all other cases (user messages, etc.), do a full render
        this.renderMessages();
    }

    /**
     * Render all messages except the last one (used during streaming)
     * @private
     */
    _renderMessagesExceptLast() {
        const chat = stateManager.currentChat;

        if (!chat || chat.messages.length === 0) {
            return;
        }

        // Show header, hide welcome screen
        if (this._welcomeScreen) this._welcomeScreen.hide();
        if (this.elements.messagesContainer) this.elements.messagesContainer.style.display = 'block';
        if (this.elements.chatHeader) this.elements.chatHeader.style.display = 'flex';
        if (this.elements.floatingSettingsBtn) this.elements.floatingSettingsBtn.style.display = 'none';

        // Render all messages except the last one
        const messagesToRender = chat.messages.slice(0, -1);

        let html = '';
        for (const msg of messagesToRender) {
            const isUser = msg.role === 'user';

            if (isUser) {
                html += `
                    <div class="flex animate-fade-in justify-end">
                        <div class="bg-lamp-accent text-white rounded-2xl px-4 py-2.5 max-w-[80%]">
                            ${this._messageRenderer.renderUserMessageContent(msg)}
                        </div>
                    </div>
                `;
            } else {
                const stats = msg.stats;
                html += `
                    <div class="group flex flex-col animate-fade-in">
                        <div class="max-w-[80%]">
                            ${this._messageRenderer.renderAssistantMessageContent(msg)}
                        </div>
                        <div class="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button data-copy-msg="${msg.id}" class="p-1.5 hover:bg-lamp-input rounded-md transition-colors" title="Copy">
                                <svg class="w-3.5 h-3.5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                            </button>
                            <button data-regen-msg="${msg.id}" class="p-1.5 hover:bg-lamp-input rounded-md transition-colors" title="Regenerate">
                                <svg class="w-3.5 h-3.5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                            </button>
                            ${this._messageRenderer.renderMessageStats(stats)}
                        </div>
                    </div>
                `;
            }
        }

        setHtml(this.elements.messagesContainer, html);
        processMessageContent(this.elements.messagesContainer);
        scrollToBottom(this.elements.chatArea);
    }

    /**
     * Handle message updated  
     * @private
     */
    _onMessageUpdated(data) {
        const msg = data?.message;

        // If we're currently streaming, only update the streaming element
        // DO NOT call renderMessages() which would rebuild the entire DOM
        if (this._streamingMessageId) {
            if (msg?.id === this._streamingMessageId && this._streamingElement) {
                // Streaming update - just update the content efficiently
                this._updateStreamingContent(msg.content);
            }
            // Ignore updates to other messages during streaming
            return;
        }

        // Not streaming - do full render
        this.renderMessages();
    }

    /**
     * Append a user message without full re-render
     * @private
     */
    _appendUserMessage(msg) {
        // Ensure messages container is visible (hide welcome screen if needed)
        if (this.elements.welcomeScreen) this.elements.welcomeScreen.style.display = 'none';
        if (this.elements.messagesContainer) this.elements.messagesContainer.style.display = 'block';
        if (this.elements.chatHeader) this.elements.chatHeader.style.display = 'flex';
        if (this.elements.floatingSettingsBtn) this.elements.floatingSettingsBtn.style.display = 'none';

        const html = `
            <div class="flex animate-fade-in justify-end">
                <div class="bg-lamp-accent text-white rounded-2xl px-4 py-2.5 max-w-[80%]">
                    ${this._messageRenderer.renderUserMessageContent(msg)}
                </div>
            </div>
        `;
        this.elements.messagesContainer?.insertAdjacentHTML('beforeend', html);
        scrollToBottom(this.elements.chatArea);
    }

    /**
     * Append a new streaming message element
     * @private
     */
    _appendStreamingMessage(msg) {
        // Hide typing indicator when streaming starts
        this.hideTypingIndicator();

        const html = `
            <div id="streaming-msg" class="group flex flex-col animate-fade-in">
                <div class="max-w-[80%]">
                    <div class="message-content prose prose-sm max-w-none text-lamp-text"></div>
                </div>
            </div>
        `;
        this.elements.messagesContainer?.insertAdjacentHTML('beforeend', html);
        this._streamingElement = document.querySelector('#streaming-msg .message-content');
        scrollToBottom(this.elements.chatArea);
    }

    /**
     * Update streaming message content efficiently using requestAnimationFrame
     * Buffers content and only renders during animation frames to prevent UI blocking
     * @private
     */
    _updateStreamingContent(content) {
        if (!this._streamingElement || !content) return;

        // Buffer the content for the next animation frame
        this._pendingStreamContent = content;

        // If we already have a pending animation frame, skip scheduling another
        if (this._rafId) return;

        // Schedule the DOM update for the next animation frame
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;

            if (this._pendingStreamContent && this._streamingElement) {
                this._streamingElement.innerHTML = renderMarkdown(this._pendingStreamContent);
                scrollToBottom(this.elements.chatArea);
            }
        });
    }

    /**
     * Refresh the chat area
     */
    refresh() {
        this._updateWelcomeName();
        this.renderMessages();
    }

    /**
     * Update welcome name
     * @private
     */
    _updateWelcomeName() {
        const user = stateManager.user;
        if (this._welcomeScreen) {
            this._welcomeScreen.updateName(user?.name);
        }
    }

    /**
     * Render messages
     */
    renderMessages() {
        const chat = stateManager.currentChat;
        const user = stateManager.user;

        if (!chat || chat.messages.length === 0) {
            // Show welcome screen, hide header (T3-style: no header in empty state)
            if (this._welcomeScreen) this._welcomeScreen.show();
            if (this.elements.messagesContainer) this.elements.messagesContainer.style.display = 'none';
            if (this.elements.chatHeader) this.elements.chatHeader.style.display = 'none';
            if (this.elements.floatingSettingsBtn) this.elements.floatingSettingsBtn.style.display = 'block';
            return;
        }

        // Show header, hide welcome screen (active chat mode)
        if (this._welcomeScreen) this._welcomeScreen.hide();
        if (this.elements.messagesContainer) this.elements.messagesContainer.style.display = 'block';
        if (this.elements.chatHeader) this.elements.chatHeader.style.display = 'flex';
        if (this.elements.floatingSettingsBtn) this.elements.floatingSettingsBtn.style.display = 'none';

        let html = '';
        for (const msg of chat.messages) {
            const isUser = msg.role === 'user';

            if (isUser) {
                html += `
                    <div class="flex animate-fade-in justify-end">
                        <div class="bg-lamp-accent text-white rounded-2xl px-4 py-2.5 max-w-[80%]">
                            ${this._messageRenderer.renderUserMessageContent(msg)}
                        </div>
                    </div>
                `;
            } else {
                // Assistant message with hover actions
                const stats = msg.stats;

                html += `
                    <div class="group flex flex-col animate-fade-in">
                        <div class="max-w-[80%]">
                            ${this._messageRenderer.renderAssistantMessageContent(msg)}
                        </div>
                        <div class="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button data-copy-msg="${msg.id}" class="p-1.5 hover:bg-lamp-input rounded-md transition-colors" title="Copy">
                                <svg class="w-3.5 h-3.5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                            </button>
                            <button data-regen-msg="${msg.id}" class="p-1.5 hover:bg-lamp-input rounded-md transition-colors" title="Regenerate">
                                <svg class="w-3.5 h-3.5 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                            </button>
                            ${this._messageRenderer.renderMessageStats(stats)}
                        </div>
                    </div>
                `;
            }
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
        if (this._typingIndicator) {
            this._typingIndicator.show();
        }
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        if (this._typingIndicator) {
            this._typingIndicator.hide();
        }
    }

    /**
     * Show image generation shimmer placeholder
     */
    showImageGenerationShimmer() {
        // Remove any existing shimmer first
        this.hideImageGenerationShimmer();

        const html = `
            <div id="imageGenShimmer" class="flex animate-fade-in justify-start">
                <div class="image-gen-shimmer-container">
                    <div class="image-gen-shimmer">
                        <div class="shimmer-icon">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                        </div>
                        <div class="shimmer-text">Generating image...</div>
                    </div>
                </div>
            </div>
        `;

        this.elements.messagesContainer?.insertAdjacentHTML('beforeend', html);
        scrollToBottom(this.elements.chatArea);
    }

    /**
     * Hide image generation shimmer
     */
    hideImageGenerationShimmer() {
        const shimmer = document.getElementById('imageGenShimmer');
        shimmer?.remove();
    }

    /**
     * Open image in lightbox modal
     * @param {string} url - Image URL
     * @private
     */
    _openImageLightbox(url) {
        // Remove any existing lightbox
        document.getElementById('imageLightbox')?.remove();

        const lightbox = document.createElement('div');
        lightbox.id = 'imageLightbox';
        lightbox.className = 'image-lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-backdrop"></div>
            <div class="lightbox-content">
                <img src="${url}" alt="Full size image" class="lightbox-image">
                <div class="lightbox-controls">
                    <a href="${url}" download="image.png" class="lightbox-btn" title="Download">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                    </a>
                    <a href="${url}" target="_blank" class="lightbox-btn" title="Open in new tab">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </a>
                    <button class="lightbox-btn lightbox-close" title="Close">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Close on backdrop click or close button
        const closeLightbox = () => {
            lightbox.classList.add('closing');
            setTimeout(() => lightbox.remove(), 200);
        };

        lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
        lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

        // Close on Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);

        document.body.appendChild(lightbox);
        document.body.style.overflow = 'hidden';

        // Restore scroll when closed
        const observer = new MutationObserver(() => {
            if (!document.getElementById('imageLightbox')) {
                document.body.style.overflow = '';
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    }

    /**
     * Set event handlers
     * @param {Object} handlers
     */
    setHandlers(handlers) {
        this.onSettingsClick = handlers.onSettingsClick;
        this.onPromptSelect = handlers.onPromptSelect;
        this.onRegenerate = handlers.onRegenerate;
    }

    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());

        // Cancel any pending animation frame
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}
