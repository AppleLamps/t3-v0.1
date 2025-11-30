// Message Renderer Component
// ===========================
// Handles rendering of user/assistant messages including multimodal content, attachments, generated images, and stats

import { escapeHtml } from '../../utils/dom.js';
import { renderMarkdown } from '../../utils/markdown.js';
import { getModelById } from '../../config/models.js';

/**
 * Message renderer class - handles rendering of messages
 */
export class MessageRenderer {
    /**
     * Render user message content (handles multimodal)
     * @param {Object} msg - The message object
     * @returns {string} - HTML string
     */
    renderUserMessageContent(msg) {
        const content = msg.content;
        const attachments = msg.attachments || [];

        // If content is a string (legacy or no attachments)
        if (typeof content === 'string') {
            let html = `<div class="message-content">${escapeHtml(content)}</div>`;
            
            // Render attachments if present
            if (attachments.length > 0) {
                html += this.renderUserAttachments(attachments);
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
     * @param {Array} attachments
     * @returns {string} - HTML string
     */
    renderUserAttachments(attachments) {
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
     * @param {Object} msg - The message object
     * @returns {string} - HTML string
     */
    renderAssistantMessageContent(msg) {
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
     * Render message stats HTML
     * @param {Object} stats - Stats object
     * @returns {string} - HTML string
     */
    renderMessageStats(stats) {
        if (!stats) return '';
        
        const modelName = stats?.model ? (getModelById(stats.model)?.name || stats.model.split('/').pop()) : '';
        const tokPerSec = stats?.tokensPerSecond ? stats.tokensPerSecond.toFixed(2) : '';
        const tokens = stats?.completionTokens || '';
        const ttft = stats?.timeToFirstToken ? stats.timeToFirstToken.toFixed(2) : '';
        
        return `
            <div class="flex items-center gap-4 text-xs text-lamp-muted">
                ${modelName ? `<span>${modelName}</span>` : ''}
                ${tokPerSec ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>${tokPerSec} tok/sec</span>` : ''}
                ${tokens ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>${tokens} tokens</span>` : ''}
                ${ttft ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Time-to-First: ${ttft} sec</span>` : ''}
            </div>
        `;
    }

    /**
     * Extract text content from message content (handles string or multimodal array)
     * @param {string|Array} content
     * @returns {string}
     */
    extractTextContent(content) {
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
}

