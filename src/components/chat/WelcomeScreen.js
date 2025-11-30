// Welcome Screen Component
// =========================
// Manages welcome screen, prompt categories, and suggested prompts

import { $, setHtml, escapeHtml } from '../../utils/dom.js';

/**
 * Welcome screen class - manages welcome screen display
 */
export class WelcomeScreen {
    /**
     * @param {HTMLElement} welcomeScreenElement - Welcome screen container element
     * @param {HTMLElement} welcomeNameElement - Element to display user name
     * @param {HTMLElement} suggestedPromptsElement - Container for suggested prompts
     */
    constructor(welcomeScreenElement, welcomeNameElement, suggestedPromptsElement) {
        this.welcomeScreen = welcomeScreenElement;
        this.welcomeName = welcomeNameElement;
        this.suggestedPrompts = suggestedPromptsElement;
    }

    /**
     * Update welcome name display
     * @param {string} name - User name (optional)
     */
    updateName(name) {
        // Re-fetch element reference in case DOM was re-rendered
        const welcomeNameEl = document.getElementById('welcomeName');
        if (welcomeNameEl) {
            welcomeNameEl.textContent = name ? `, ${name}` : '';
        }
    }

    /**
     * Show welcome screen
     */
    show() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'flex';
        }
    }

    /**
     * Hide welcome screen
     */
    hide() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'none';
        }
    }

    /**
     * Render welcome screen HTML
     * @returns {string} - HTML string
     */
    render() {
        return `
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
        `;
    }
}

