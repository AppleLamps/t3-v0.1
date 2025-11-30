// Prompt Selector Component
// ==========================
// Handles prompt category switching and prompt selection

import { setHtml, escapeHtml } from '../../utils/dom.js';

/**
 * Prompt selector class - handles prompt category switching
 */
export class PromptSelector {
    /**
     * @param {HTMLElement} suggestedPromptsElement - Container for suggested prompts
     * @param {Function} onPromptSelect - Callback when a prompt is selected
     */
    constructor(suggestedPromptsElement, onPromptSelect) {
        this.suggestedPrompts = suggestedPromptsElement;
        this.onPromptSelect = onPromptSelect;
        
        this.prompts = {
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
    }

    /**
     * Set prompt category
     * @param {string} category - Category name
     */
    setCategory(category) {
        const categoryPrompts = this.prompts[category] || this.prompts.explore;
        
        if (this.suggestedPrompts) {
            setHtml(this.suggestedPrompts, categoryPrompts.map(p => `
                <button data-prompt="${escapeHtml(p)}" class="prompt-btn w-full text-left py-3 px-4 text-lamp-muted hover:text-lamp-text border-l-2 border-transparent hover:border-lamp-accent hover:bg-lamp-input/30 rounded-r-lg transition-all duration-200">
                    ${escapeHtml(p)}
                </button>
            `).join(''));
        }
    }

    /**
     * Bind prompt selection handler
     * @param {HTMLElement} container - Container element for event delegation
     */
    bindPromptSelection(container) {
        container?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-prompt]');
            if (btn && this.onPromptSelect) {
                this.onPromptSelect(btn.dataset.prompt);
            }
        });
    }
}

