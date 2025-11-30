// Typing Indicator Component
// ===========================
// Manages typing indicator display/hide

import { $ } from '../../utils/dom.js';

/**
 * Typing indicator class - manages typing indicator display
 */
export class TypingIndicator {
    /**
     * @param {HTMLElement} messagesContainer - Container element for messages
     * @param {HTMLElement} chatArea - Chat area element for scrolling
     */
    constructor(messagesContainer, chatArea) {
        this.messagesContainer = messagesContainer;
        this.chatArea = chatArea;
    }

    /**
     * Show typing indicator
     */
    show() {
        // Remove any existing typing indicator first
        this.hide();
        
        const html = `
            <div id="typingIndicator" class="flex animate-fade-in justify-start">
                <div class="flex gap-1.5 py-2">
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                    <div class="w-2 h-2 bg-lamp-muted rounded-full typing-dot"></div>
                </div>
            </div>
        `;
        
        this.messagesContainer?.insertAdjacentHTML('beforeend', html);
        this._scrollToBottom();
    }
    
    /**
     * Hide typing indicator
     */
    hide() {
        $('typingIndicator')?.remove();
    }

    /**
     * Scroll chat area to bottom
     * @private
     */
    _scrollToBottom() {
        if (this.chatArea) {
            this.chatArea.scrollTop = this.chatArea.scrollHeight;
        }
    }
}

