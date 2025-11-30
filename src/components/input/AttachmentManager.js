// Attachment Manager Component
// ============================
// Handles file attachments (add, remove, render preview)

import { $, setHtml, escapeHtml } from '../../utils/dom.js';
import { formatFileSize, fileToBase64, getFileType } from '../../utils/files.js';

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
 * Attachment manager class - handles file attachments
 */
export class AttachmentManager {
    /**
     * @param {HTMLElement} attachmentsArea - Container for attachments area
     * @param {HTMLElement} fileInput - File input element
     */
    constructor(attachmentsArea, fileInput) {
        this.attachmentsArea = attachmentsArea;
        this.fileInput = fileInput;
        
        /** @type {Attachment[]} */
        this._attachments = [];
    }

    /**
     * Initialize the attachment manager
     */
    init() {
        this._bindEvents();
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Attachment removal (delegated)
        this.attachmentsArea?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-attachment]');
            if (removeBtn) {
                this.removeAttachment(removeBtn.dataset.removeAttachment);
            }
        });
    }

    /**
     * Handle file selection
     * @param {FileList} files
     * @returns {Promise<Attachment[]>} - Array of new attachments
     */
    async handleFileSelect(files) {
        if (!files || files.length === 0) return [];

        const newAttachments = [];

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
                newAttachments.push(attachment);
            } catch (error) {
                console.error('File processing error:', error);
                throw error;
            }
        }

        this._render();
        return newAttachments;
    }

    /**
     * Remove an attachment
     * @param {string} attachmentId
     */
    removeAttachment(attachmentId) {
        this._attachments = this._attachments.filter(att => att.id !== attachmentId);
        this._render();
    }

    /**
     * Get all attachments
     * @returns {Attachment[]}
     */
    getAttachments() {
        return [...this._attachments];
    }

    /**
     * Clear all attachments
     */
    clearAttachments() {
        this._attachments = [];
        this._render();
    }

    /**
     * Render attachments preview
     * @private
     */
    _render() {
        const attachmentsList = $('attachmentsList');
        
        if (!this.attachmentsArea || !attachmentsList) return;

        if (this._attachments.length === 0) {
            this.attachmentsArea.classList.add('hidden');
            attachmentsList.innerHTML = '';
            return;
        }

        this.attachmentsArea.classList.remove('hidden');

        let html = '';
        for (const att of this._attachments) {
            if (att.type === 'image') {
                // Image thumbnail
                html += `
                    <div class="relative group">
                        <div class="w-20 h-20 rounded-lg overflow-hidden border border-lamp-border bg-lamp-input">
                            <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" class="w-full h-full object-cover">
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
}

