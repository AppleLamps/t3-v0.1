// Typing Indicator Component
// ===========================
// Manages thinking/typing indicator display/hide

import { $ } from '../../utils/dom.js';

/**
 * Typing indicator class - manages thinking indicator display
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
     * Show thinking indicator
     */
    show() {
        // Remove any existing indicator first
        this.hide();

        const html = `
            <div id="typingIndicator" class="flex animate-fade-in justify-start py-4">
                <div class="flex items-center gap-3 px-4 py-3 bg-lamp-input rounded-2xl border border-lamp-border shadow-sm">
                    <!-- Animated lamp icon -->
                    <div class="thinking-lamp">
                        <svg class="w-5 h-5 text-lamp-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path class="lamp-bulb" stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                        <div class="lamp-glow"></div>
                    </div>
                    
                    <!-- Thinking text with animated dots -->
                    <span class="text-sm text-lamp-muted font-medium">Thinking<span class="thinking-dots"></span></span>
                </div>
            </div>
        `;

        this.messagesContainer?.insertAdjacentHTML('beforeend', html);
        this._scrollToBottom();
    }

    /**
     * Hide thinking indicator
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

