// Message Input Component
// =======================

import { stateManager } from '../services/state.js';
import { $, setHtml } from '../utils/dom.js';
import { fileToBase64, isImageFile, isPdfFile, formatFileSize, getFileType } from '../utils/files.js';
import { MODELS, getModelById } from '../config/models.js';
import { MAX_TEXTAREA_HEIGHT } from '../config/constants.js';

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

        /** @type {Attachment[]} */
        this._attachments = [];
        this._unsubscribers = [];
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

        // Model dropdown toggle
        this.elements.modelButton?.addEventListener('click', () => {
            this._toggleModelDropdown();
        });

        // Model search
        this.elements.modelSearch?.addEventListener('input', (e) => {
            this._filterModels(e.target.value);
        });

        // Model selection (delegated)
        this.elements.modelList?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-model-id]');
            if (btn) {
                this._selectModel(btn.dataset.modelId);
            }
        });

        // Web search toggle
        this.elements.webSearchBtn?.addEventListener('click', () => {
            this._toggleWebSearch();
        });

        // Attach button - trigger file input
        this.elements.attachBtn?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });

        // File input change handler
        this.elements.fileInput?.addEventListener('change', (e) => {
            this._handleFileSelect(e.target.files);
            // Reset input so same file can be selected again
            e.target.value = '';
        });

        // Attachment removal (delegated)
        this.elements.attachmentsArea?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-attachment]');
            if (removeBtn) {
                this._removeAttachment(removeBtn.dataset.removeAttachment);
            }
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

        this.elements.form?.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.form.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
            
            if (e.dataTransfer?.files?.length) {
                this._handleFileSelect(e.dataTransfer.files);
            }
        });
    }

    /**
     * Handle file selection
     * @private
     * @param {FileList} files
     */
    async _handleFileSelect(files) {
        if (!files || files.length === 0) return;

        for (const file of files) {
            try {
                // Validate and convert to base64
                const dataUrl = await fileToBase64(file);
                
                // Create attachment object
                const attachment = {
                    id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    type: getFileType(file),
                    mimeType: file.type,
                    size: file.size,
                    dataUrl: dataUrl,
                };

                this._attachments.push(attachment);
            } catch (error) {
                console.error('File processing error:', error);
                alert(error.message);
            }
        }

        this._renderAttachments();
    }

    /**
     * Remove an attachment
     * @private
     * @param {string} attachmentId
     */
    _removeAttachment(attachmentId) {
        this._attachments = this._attachments.filter(att => att.id !== attachmentId);
        this._renderAttachments();
    }

    /**
     * Render attachments preview
     * @private
     */
    _renderAttachments() {
        const attachmentsArea = this.elements.attachmentsArea;
        const attachmentsList = $('attachmentsList');
        
        if (!attachmentsArea || !attachmentsList) return;

        if (this._attachments.length === 0) {
            attachmentsArea.classList.add('hidden');
            attachmentsList.innerHTML = '';
            return;
        }

        attachmentsArea.classList.remove('hidden');

        let html = '';
        for (const att of this._attachments) {
            if (att.type === 'image') {
                // Image thumbnail
                html += `
                    <div class="relative group">
                        <div class="w-20 h-20 rounded-lg overflow-hidden border border-lamp-border bg-lamp-input">
                            <img src="${att.dataUrl}" alt="${att.name}" class="w-full h-full object-cover">
                        </div>
                        <button type="button" data-remove-attachment="${att.id}" 
                            class="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                        <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate">
                            ${this._truncateName(att.name, 12)}
                        </div>
                    </div>
                `;
            } else if (att.type === 'pdf') {
                // PDF icon
                html += `
                    <div class="relative group">
                        <div class="w-20 h-20 rounded-lg border border-lamp-border bg-lamp-input flex flex-col items-center justify-center gap-1">
                            <svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H7v4h1v-1.5h.5a1.5 1.5 0 000-3H8.5zm0 1.5v-1h.5a.5.5 0 010 1h-.5zm3-.5v3h1.5a1.5 1.5 0 001.5-1.5v0a1.5 1.5 0 00-1.5-1.5H11.5zm1 2.5v-2h.5a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-.5zm3-2.5h2v.5h-1.5v.75h1v.5h-1v1.25h-.5V14z"/>
                            </svg>
                            <span class="text-xs text-lamp-muted">${formatFileSize(att.size)}</span>
                        </div>
                        <button type="button" data-remove-attachment="${att.id}" 
                            class="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                        <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate text-center">
                            ${this._truncateName(att.name, 12)}
                        </div>
                    </div>
                `;
            }
        }

        attachmentsList.innerHTML = html;
    }

    /**
     * Truncate filename for display
     * @private
     * @param {string} name
     * @param {number} maxLength
     * @returns {string}
     */
    _truncateName(name, maxLength) {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const baseName = name.substring(0, name.length - ext.length - 1);
        const truncatedBase = baseName.substring(0, maxLength - ext.length - 3);
        return `${truncatedBase}...${ext}`;
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
        this._updateSelectedModel();
        this._updateWebSearchButton();
        this._renderModelList();
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
        const hasAttachments = this._attachments.length > 0;
        
        // Allow sending if there's a message OR attachments
        if (!message && !hasAttachments) return;
        if (stateManager.isStreaming) return;

        if (this.onSubmit) {
            // Pass both message and attachments
            this.onSubmit(message, [...this._attachments]);
        }

        // Clear input and attachments
        if (this.elements.textarea) {
            this.elements.textarea.value = '';
            this.elements.textarea.style.height = 'auto';
        }
        this._attachments = [];
        this._renderAttachments();
    }

    /**
     * Clear all attachments
     */
    clearAttachments() {
        this._attachments = [];
        this._renderAttachments();
    }

    /**
     * Get current attachments
     * @returns {Attachment[]}
     */
    getAttachments() {
        return [...this._attachments];
    }

    /**
     * Toggle model dropdown
     * @private
     */
    _toggleModelDropdown() {
        this.elements.modelDropdown?.classList.toggle('hidden');
        if (!this.elements.modelDropdown?.classList.contains('hidden')) {
            this.elements.modelSearch?.focus();
        }
    }

    /**
     * Render model list
     * @private
     */
    _renderModelList() {
        const settings = stateManager.settings;
        // Default to all models enabled if enabledModels is undefined, null, empty, or contains no valid IDs
        const enabledModelIds = settings?.enabledModels;
        const validModelIds = MODELS.map(m => m.id);
        const hasValidEnabled = enabledModelIds && enabledModelIds.length > 0 && 
            enabledModelIds.some(id => validModelIds.includes(id));
        const enabledModels = hasValidEnabled 
            ? MODELS.filter(m => enabledModelIds.includes(m.id))
            : MODELS; // Show all models by default
        const selectedModel = settings?.selectedModel;

        let html = '';
        for (const model of enabledModels) {
            const isSelected = model.id === selectedModel;
            const hasImageCap = model.capabilities?.includes('image');
            const hasVisionCap = model.capabilities?.includes('vision');
            
            html += `
                <button type="button" data-model-id="${model.id}" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-lamp-input transition-colors ${isSelected ? 'bg-lamp-input' : ''}">
                    <div class="flex-1">
                        <div class="text-sm font-medium flex items-center gap-2">
                            ${model.name}
                            ${hasImageCap ? '<span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Image</span>' : ''}
                            ${hasVisionCap ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Vision</span>' : ''}
                        </div>
                        <div class="text-xs text-lamp-muted">${model.provider}</div>
                    </div>
                    ${isSelected ? '<svg class="w-4 h-4 text-lamp-accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                </button>
            `;
        }

        setHtml(this.elements.modelList, html || '<div class="px-3 py-4 text-center text-sm text-lamp-muted">No models available</div>');
    }

    /**
     * Filter models by search query
     * @private
     */
    _filterModels(query) {
        const settings = stateManager.settings;
        // Default to all models enabled if enabledModels is undefined, null, empty, or contains no valid IDs
        const enabledModelIds = settings?.enabledModels;
        const validModelIds = MODELS.map(m => m.id);
        const hasValidEnabled = enabledModelIds && enabledModelIds.length > 0 && 
            enabledModelIds.some(id => validModelIds.includes(id));
        const enabledModels = hasValidEnabled 
            ? MODELS.filter(m => enabledModelIds.includes(m.id))
            : MODELS; // Show all models by default
        const selectedModel = settings?.selectedModel;
        const lowerQuery = query.toLowerCase();

        const filtered = enabledModels.filter(m =>
            m.name.toLowerCase().includes(lowerQuery) ||
            m.provider.toLowerCase().includes(lowerQuery)
        );

        let html = '';
        for (const model of filtered) {
            const isSelected = model.id === selectedModel;
            const hasImageCap = model.capabilities?.includes('image');
            const hasVisionCap = model.capabilities?.includes('vision');
            
            html += `
                <button type="button" data-model-id="${model.id}" 
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-lamp-input transition-colors ${isSelected ? 'bg-lamp-input' : ''}">
                    <div class="flex-1">
                        <div class="text-sm font-medium flex items-center gap-2">
                            ${model.name}
                            ${hasImageCap ? '<span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Image</span>' : ''}
                            ${hasVisionCap ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Vision</span>' : ''}
                        </div>
                        <div class="text-xs text-lamp-muted">${model.provider}</div>
                    </div>
                    ${isSelected ? '<svg class="w-4 h-4 text-lamp-accent" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
                </button>
            `;
        }

        setHtml(this.elements.modelList, html || '<div class="px-3 py-4 text-center text-sm text-lamp-muted">No models found</div>');
    }

    /**
     * Select a model
     * @private
     */
    async _selectModel(modelId) {
        await stateManager.updateSettings({ selectedModel: modelId });
        this._updateSelectedModel();
        this._renderModelList();
        this.elements.modelDropdown?.classList.add('hidden');
    }

    /**
     * Update selected model display
     * @private
     */
    _updateSelectedModel() {
        const settings = stateManager.settings;
        const model = getModelById(settings?.selectedModel);
        if (this.elements.selectedModelName) {
            this.elements.selectedModelName.textContent = model?.name || 'Select Model';
        }
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
