// Chat Area Component
// ===================

import { stateManager } from '../services/state.js';
import { $, escapeHtml, setHtml, scrollToBottom } from '../utils/dom.js';
import { renderMarkdown, processMessageContent } from '../utils/markdown.js';
import { getModelById } from '../config/models.js';
import { formatFileSize } from '../utils/files.js';

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
                    <h2 class="text-3xl font-semibold mb-8">How can I help you<span id="welcomeName"></span>?</h2>
                    
                    <!-- Quick Action Buttons - T3 Style Pills -->
                    <div class="flex flex-wrap justify-center gap-2 mb-10">
                        <button data-category="create" class="category-btn flex items-center gap-2 px-5 py-2.5 bg-lamp-input/50 border border-lamp-border rounded-full hover:bg-lamp-input hover:border-lamp-muted/30 transition-all duration-200">
                            <svg class="w-4 h-4 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            <span class="text-sm font-medium text-lamp-text">Create</span>
                        </button>
                        <button data-category="explore" class="category-btn flex items-center gap-2 px-5 py-2.5 bg-lamp-input/50 border border-lamp-border rounded-full hover:bg-lamp-input hover:border-lamp-muted/30 transition-all duration-200">
                            <svg class="w-4 h-4 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                            <span class="text-sm font-medium text-lamp-text">Explore</span>
                        </button>
                        <button data-category="code" class="category-btn flex items-center gap-2 px-5 py-2.5 bg-lamp-input/50 border border-lamp-border rounded-full hover:bg-lamp-input hover:border-lamp-muted/30 transition-all duration-200">
                            <svg class="w-4 h-4 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                            </svg>
                            <span class="text-sm font-medium text-lamp-text">Code</span>
                        </button>
                        <button data-category="learn" class="category-btn flex items-center gap-2 px-5 py-2.5 bg-lamp-input/50 border border-lamp-border rounded-full hover:bg-lamp-input hover:border-lamp-muted/30 transition-all duration-200">
                            <svg class="w-4 h-4 text-lamp-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            </svg>
                            <span class="text-sm font-medium text-lamp-text">Learn</span>
                        </button>
                    </div>
                    
                    <!-- Suggested Prompts - T3 Style with left accent -->
                    <div id="suggestedPrompts" class="w-full max-w-xl space-y-1">
                        <button data-prompt="How does AI work?" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
                            How does AI work?
                        </button>
                        <button data-prompt="Are black holes real?" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
                            Are black holes real?
                        </button>
                        <button data-prompt="How many Rs are in the word 'strawberry'?" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
                            How many Rs are in the word "strawberry"?
                        </button>
                        <button data-prompt="What is the meaning of life?" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
                            What is the meaning of life?
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
        this.elements.chatHeader = $('chatHeader');
        this.elements.welcomeScreen = $('welcomeScreen');
        this.elements.messagesContainer = $('messagesContainer');
        this.elements.welcomeName = $('welcomeName');
        this.elements.suggestedPrompts = $('suggestedPrompts');
        this.elements.floatingSettingsBtn = $('floatingSettingsBtn');
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
        
        // Settings button (header)
        $('headerSettingsBtn')?.addEventListener('click', () => {
            if (this.onSettingsClick) this.onSettingsClick();
        });
        
        // Floating settings button (welcome screen)
        $('floatingSettingsBtn')?.addEventListener('click', () => {
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
        
        // Message actions (delegated)
        this.elements.messagesContainer?.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('[data-copy-msg]');
            const regenBtn = e.target.closest('[data-regen-msg]');
            
            if (copyBtn) {
                this._copyMessage(copyBtn.dataset.copyMsg);
            } else if (regenBtn) {
                if (this.onRegenerate) {
                    this.onRegenerate(regenBtn.dataset.regenMsg);
                }
            }
        });
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
        const textContent = this._extractTextContent(msg.content);
        
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
     * Extract text content from message content (handles string or multimodal array)
     * @private
     * @param {string|Array} content
     * @returns {string}
     */
    _extractTextContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
        }
        return '';
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
        const chat = stateManager.currentChat;
        
        // If this is the first message, we need to switch from welcome screen to chat view
        if (chat && chat.messages.length === 1) {
            this.renderMessages();
            return;
        }
        
        if (msg?.role === 'assistant' && stateManager.isStreaming) {
            // New assistant message during streaming - append it and track for updates
            this._streamingMessageId = msg.id;
            this._appendStreamingMessage(msg);
        } else if (msg?.role === 'user') {
            // User message - append without full re-render
            this._appendUserMessage(msg);
        } else {
            // Fallback - full render
            this.renderMessages();
        }
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
                    ${this._renderUserMessageContent(msg)}
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
        if (this.elements.welcomeName) {
            this.elements.welcomeName.textContent = user?.name ? `, ${user.name}` : '';
        }
    }

    /**
     * Render user message content (handles multimodal)
     * @private
     * @param {Object} msg - The message object
     * @returns {string} - HTML string
     */
    _renderUserMessageContent(msg) {
        const content = msg.content;
        const attachments = msg.attachments || [];

        // If content is a string (legacy or no attachments)
        if (typeof content === 'string') {
            let html = `<div class="message-content">${escapeHtml(content)}</div>`;
            
            // Render attachments if present
            if (attachments.length > 0) {
                html += this._renderUserAttachments(attachments);
            }
            
            return html;
        }

        // If content is multimodal array
        if (Array.isArray(content)) {
            let html = '';
            
            // Render text content first
            const textParts = content.filter(item => item.type === 'text');
            if (textParts.length > 0) {
                html += `<div class="message-content">${escapeHtml(textParts.map(p => p.text).join('\n'))}</div>`;
            }
            
            // Render images
            const imageParts = content.filter(item => item.type === 'image_url');
            if (imageParts.length > 0) {
                html += '<div class="flex flex-wrap gap-2 mt-2">';
                for (const img of imageParts) {
                    const url = img.image_url?.url || '';
                    html += `
                        <div class="relative">
                            <img src="${url}" alt="Attached image" 
                                class="max-w-48 max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onclick="window.open('${url}', '_blank')">
                        </div>
                    `;
                }
                html += '</div>';
            }

            // Render PDF files
            const fileParts = content.filter(item => item.type === 'file');
            if (fileParts.length > 0) {
                html += '<div class="flex flex-wrap gap-2 mt-2">';
                for (const file of fileParts) {
                    const filename = file.file?.filename || 'Document.pdf';
                    html += `
                        <div class="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-lg">
                            <svg class="w-5 h-5 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
                            </svg>
                            <span class="text-sm">${escapeHtml(filename)}</span>
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            return html;
        }

        return '';
    }

    /**
     * Render user attachments
     * @private
     * @param {Array} attachments
     * @returns {string} - HTML string
     */
    _renderUserAttachments(attachments) {
        if (!attachments || attachments.length === 0) return '';

        let html = '<div class="flex flex-wrap gap-2 mt-2">';
        
        for (const att of attachments) {
            if (att.type === 'image') {
                html += `
                    <div class="relative">
                        <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" 
                            class="max-w-48 max-h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onclick="window.open('${att.dataUrl}', '_blank')">
                    </div>
                `;
            } else if (att.type === 'pdf') {
                html += `
                    <div class="flex items-center gap-2 px-3 py-2 bg-white/20 rounded-lg">
                        <svg class="w-5 h-5 text-red-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
                        </svg>
                        <span class="text-sm">${escapeHtml(att.name)}</span>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Render assistant message content (handles generated images)
     * @private
     * @param {Object} msg - The message object
     * @returns {string} - HTML string
     */
    _renderAssistantMessageContent(msg) {
        let html = '';
        
        // Render text content
        if (msg.content) {
            html += `<div class="message-content prose prose-sm max-w-none text-lamp-text">${renderMarkdown(msg.content)}</div>`;
        }
        
        // Render generated images
        const images = msg.generatedImages || msg.images || [];
        if (images.length > 0) {
            html += '<div class="flex flex-wrap gap-3 mt-4">';
            for (const img of images) {
                const url = img.url || img.image_url?.url || '';
                if (url) {
                    html += `
                        <div class="relative group/img">
                            <img src="${url}" alt="Generated image" 
                                class="max-w-full rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                                style="max-height: 400px;"
                                onclick="window.open('${url}', '_blank')">
                            <div class="absolute bottom-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <a href="${url}" download="generated-image.png" 
                                    class="flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded-lg hover:bg-black/90"
                                    onclick="event.stopPropagation()">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                    </svg>
                                    Download
                                </a>
                            </div>
                        </div>
                    `;
                }
            }
            html += '</div>';
        }
        
        return html;
    }
    
    /**
     * Render messages
     */
    renderMessages() {
        const chat = stateManager.currentChat;
        const user = stateManager.user;
        
        if (!chat || chat.messages.length === 0) {
            // Show welcome screen, hide header (T3-style: no header in empty state)
            if (this.elements.welcomeScreen) this.elements.welcomeScreen.style.display = 'flex';
            if (this.elements.messagesContainer) this.elements.messagesContainer.style.display = 'none';
            if (this.elements.chatHeader) this.elements.chatHeader.style.display = 'none';
            if (this.elements.floatingSettingsBtn) this.elements.floatingSettingsBtn.style.display = 'block';
            return;
        }
        
        // Show header, hide welcome screen (active chat mode)
        if (this.elements.welcomeScreen) this.elements.welcomeScreen.style.display = 'none';
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
                            ${this._renderUserMessageContent(msg)}
                        </div>
                    </div>
                `;
            } else {
                // Assistant message with hover actions
                const stats = msg.stats;
                const modelName = stats?.model ? (getModelById(stats.model)?.name || stats.model.split('/').pop()) : '';
                const tokPerSec = stats?.tokensPerSecond ? stats.tokensPerSecond.toFixed(2) : '';
                const tokens = stats?.completionTokens || '';
                const ttft = stats?.timeToFirstToken ? stats.timeToFirstToken.toFixed(2) : '';
                
                html += `
                    <div class="group flex flex-col animate-fade-in">
                        <div class="max-w-[80%]">
                            ${this._renderAssistantMessageContent(msg)}
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
                            ${stats ? `
                                <div class="flex items-center gap-4 text-xs text-lamp-muted">
                                    ${modelName ? `<span>${modelName}</span>` : ''}
                                    ${tokPerSec ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>${tokPerSec} tok/sec</span>` : ''}
                                    ${tokens ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>${tokens} tokens</span>` : ''}
                                    ${ttft ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Time-to-First: ${ttft} sec</span>` : ''}
                                </div>
                            ` : ''}
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
        // Remove any existing typing indicator first
        this.hideTypingIndicator();
        
        const html = `
            <div id="typingIndicator" class="flex animate-fade-in justify-start">
                <div class="flex gap-1.5 py-2">
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
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
                <button data-prompt="${escapeHtml(p)}" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
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
