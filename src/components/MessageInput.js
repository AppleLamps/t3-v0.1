// Message Input Component
// =======================

import { stateManager } from '../services/state.js';
import { $ } from '../utils/dom.js';
import { ModelSelector } from './input/ModelSelector.js';
import { AttachmentManager } from './input/AttachmentManager.js';
import { MAX_TEXTAREA_HEIGHT } from '../config/constants.js';
import { mixinComponentLifecycle } from './Component.js';

/**
 * @typedef {Object} Attachment
 * @property {string} id - Unique identifier
 * @property {string} name - File name
 * @property {string} type - 'image' or 'pdf'
 * @property {string} mimeType - MIME type
 * @property {number} size - File size in bytes
 * @property {string} dataUrl - Base64 data URL
 */

/**
 * Message input component - handles user input, model selection, and file attachments
 */
export class MessageInput {
    constructor() {
        mixinComponentLifecycle(this);

        this.elements = {
            form: null,
            textarea: null,
            sendButton: null,
            modelButton: null,
            modelDropdown: null,
            modelList: null,
            modelSearch: null,
            selectedModelName: null,
            webSearchBtn: null,
            attachBtn: null,
            fileInput: null,
            attachmentsArea: null,
        };

        this._unsubscribers = [];

        // Sub-components
        this._modelSelector = null;
        this._attachmentManager = null;
    }

    /**
     * Initialize the message input
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = $(containerId);
        if (!container) {
            console.error('Message input container not found');
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
     * Render message input HTML
     * @private
     */
    _render() {
        return `
            <div class="p-4 pb-6 bg-gradient-to-t from-lamp-bg via-lamp-bg to-transparent relative z-10">
                <div class="max-w-3xl mx-auto">
                    <form id="chatForm" class="relative">
                        <!-- Hidden file input for attachments -->
                        <input type="file" id="fileInput" multiple accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf" class="hidden">
                        
                        <!-- Allow popovers/dropdowns to escape the card so they don't get clipped by the rounded card container -->
                        <div class="bg-lamp-card border border-lamp-border rounded-2xl shadow-lg focus-within:border-lamp-muted/50 focus-within:shadow-xl transition-all duration-200 overflow-visible">
                            
                            <!-- Attachments Preview Area -->
                            <div id="attachmentsArea" class="hidden px-4 pt-4 pb-2">
                                <div id="attachmentsList" class="flex flex-wrap gap-2">
                                    <!-- Attachments will be rendered here -->
                                </div>
                            </div>
                            
                            <textarea id="messageInput" 
                                placeholder="Type your message here..." 
                                rows="1"
                                class="w-full bg-transparent px-4 py-4 resize-none focus:outline-none text-lamp-text placeholder:text-lamp-muted/60"></textarea>
                            
                            <div class="flex items-center justify-between px-3 pb-3 relative">
                                <div class="flex items-center gap-1.5">
                                    <!-- Model Selector -->
                                    <div class="relative z-50">
                                        <button type="button" id="modelButton" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lamp-muted hover:text-lamp-text hover:bg-lamp-input rounded-lg transition-colors">
                                            <span id="selectedModelName">GPT-4o</span>
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                            </svg>
                                        </button>
                                        <div id="modelDropdown" class="hidden absolute bottom-full left-0 mb-2 w-64 bg-lamp-card border border-lamp-border rounded-xl shadow-2xl overflow-hidden" style="z-index: 9999;">
                                            <div class="p-2 border-b border-lamp-border">
                                                <input type="text" id="modelSearch" placeholder="Search models..." 
                                                    class="w-full px-3 py-2 text-sm bg-lamp-input border border-lamp-border rounded-lg focus:outline-none focus:border-lamp-accent">
                                            </div>
                                            <div id="modelList" class="max-h-64 overflow-y-auto p-2">
                                                <!-- Models will be rendered here -->
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Web Search Toggle -->
                                    <button type="button" id="webSearchBtn" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lamp-muted hover:text-lamp-text hover:bg-lamp-input rounded-lg transition-colors">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                                        </svg>
                                        Search
                                    </button>
                                    
                                    <!-- Attach Button -->
                                    <button type="button" id="attachBtn" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lamp-muted hover:text-lamp-text hover:bg-lamp-input rounded-lg transition-colors">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                                        </svg>
                                        Attach
                                    </button>
                                </div>
                                
                                <!-- Send Button - T3 Style Circle -->
                                <button type="submit" id="sendButton" class="w-9 h-9 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.form = $('chatForm');
        this.elements.textarea = $('messageInput');
        this.elements.sendButton = $('sendButton');
        this.elements.modelButton = $('modelButton');
        this.elements.modelDropdown = $('modelDropdown');
        this.elements.modelList = $('modelList');
        this.elements.modelSearch = $('modelSearch');
        this.elements.selectedModelName = $('selectedModelName');
        this.elements.webSearchBtn = $('webSearchBtn');
        this.elements.attachBtn = $('attachBtn');
        this.elements.fileInput = $('fileInput');
        this.elements.attachmentsArea = $('attachmentsArea');
    }

    /**
     * Initialize sub-components
     * @private
     */
    _initSubComponents() {
        // Initialize model selector
        this._modelSelector = new ModelSelector(
            this.elements.modelButton,
            this.elements.modelDropdown,
            this.elements.modelList,
            this.elements.modelSearch,
            this.elements.selectedModelName
        );
        this._modelSelector.init();

        // Initialize attachment manager
        this._attachmentManager = new AttachmentManager(
            this.elements.attachmentsArea,
            this.elements.fileInput
        );
        this._attachmentManager.init();
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Form submission
        this.elements.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });

        // Textarea auto-resize and enter key
        this.elements.textarea?.addEventListener('input', () => {
            this._autoResize();
        });

        this.elements.textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSubmit();
            }
        });

        // Model selector handles its own events

        // Web search toggle
        this.elements.webSearchBtn?.addEventListener('click', () => {
            this._toggleWebSearch();
        });

        // Attach button - trigger file input
        this.elements.attachBtn?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });

        // File input change handler
        this.elements.fileInput?.addEventListener('change', async (e) => {
            try {
                await this._attachmentManager.handleFileSelect(e.target.files);
            } catch (error) {
                alert(error.message);
            }
            // Reset input so same file can be selected again
            e.target.value = '';
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.elements.modelDropdown?.contains(e.target) &&
                !this.elements.modelButton?.contains(e.target)) {
                this.elements.modelDropdown?.classList.add('hidden');
            }
        });

        // Drag and drop support
        this.elements.form?.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.form.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
        });

        this.elements.form?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.form.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
        });

        this.elements.form?.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.form.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');

            if (e.dataTransfer?.files?.length) {
                try {
                    await this._attachmentManager.handleFileSelect(e.dataTransfer.files);
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    }


    /**
     * Subscribe to state changes
     * @private
     */
    _subscribeToState() {
        this._unsubscribers.push(
            stateManager.subscribe('settingsUpdated', () => this.refresh()),
            stateManager.subscribe('streamingChanged', (state, isStreaming) => {
                this._setDisabled(isStreaming);
            }),
        );
    }

    /**
     * Refresh the input component
     */
    refresh() {
        if (this._modelSelector) {
            this._modelSelector.refresh();
        }
        this._updateWebSearchButton();
    }

    /**
     * Auto-resize textarea
     * @private
     */
    _autoResize() {
        const textarea = this.elements.textarea;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
    }

    /**
     * Handle form submission
     * @private
     */
    _handleSubmit() {
        const message = this.elements.textarea?.value.trim();
        const attachments = this._attachmentManager ? this._attachmentManager.getAttachments() : [];
        const hasAttachments = attachments.length > 0;

        // Allow sending if there's a message OR attachments
        if (!message && !hasAttachments) return;
        if (stateManager.isStreaming) return;

        if (this.onSubmit) {
            // Pass both message and attachments
            this.onSubmit(message, [...attachments]);
        }

        // Clear input and attachments
        if (this.elements.textarea) {
            this.elements.textarea.value = '';
            this.elements.textarea.style.height = 'auto';
        }
        if (this._attachmentManager) {
            this._attachmentManager.clearAttachments();
        }
    }

    /**
     * Clear all attachments
     */
    clearAttachments() {
        if (this._attachmentManager) {
            this._attachmentManager.clearAttachments();
        }
    }

    /**
     * Get current attachments
     * @returns {Attachment[]}
     */
    getAttachments() {
        return this._attachmentManager ? this._attachmentManager.getAttachments() : [];
    }


    /**
     * Toggle web search
     * @private
     */
    async _toggleWebSearch() {
        const settings = stateManager.settings;
        await stateManager.updateSettings({ webSearchEnabled: !settings?.webSearchEnabled });
        this._updateWebSearchButton();
    }

    /**
     * Update web search button state
     * @private
     */
    _updateWebSearchButton() {
        const settings = stateManager.settings;
        const btn = this.elements.webSearchBtn;
        if (!btn) return;

        if (settings?.webSearchEnabled) {
            btn.classList.add('bg-lamp-accent', 'text-white');
            btn.classList.remove('text-lamp-muted', 'hover:text-lamp-text', 'hover:bg-lamp-input');
        } else {
            btn.classList.remove('bg-lamp-accent', 'text-white');
            btn.classList.add('text-lamp-muted', 'hover:text-lamp-text', 'hover:bg-lamp-input');
        }
    }

    /**
     * Set disabled state
     * @private
     */
    _setDisabled(disabled) {
        if (this.elements.sendButton) {
            this.elements.sendButton.disabled = disabled;
        }
        if (this.elements.textarea) {
            this.elements.textarea.disabled = disabled;
        }
        if (this.elements.attachBtn) {
            this.elements.attachBtn.disabled = disabled;
        }
    }

    /**
     * Set the input value
     * @param {string} value 
     */
    setValue(value) {
        if (this.elements.textarea) {
            this.elements.textarea.value = value;
            this.elements.textarea.focus();
            this._autoResize();
        }
    }

    /**
     * Focus the input
     */
    focus() {
        this.elements.textarea?.focus();
    }

    /**
     * Set event handlers
     * @param {Object} handlers 
     */
    setHandlers(handlers) {
        this.onSubmit = handlers.onSubmit;
    }

    /**
     * Cleanup
     */
    destroy() {
        this._unsubscribers.forEach(unsub => unsub());
    }
}
