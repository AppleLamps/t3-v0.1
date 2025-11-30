// Markdown Rendering Utilities
// ============================

import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

/**
 * Configure marked with our settings
 */
export function configureMarked() {
    marked.setOptions({
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    console.warn('Highlight error:', e);
                }
            }
            try {
                return hljs.highlightAuto(code).value;
            } catch (e) {
                console.warn('Auto highlight error:', e);
            }
            return code;
        },
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
    });

    // Configure DOMPurify to allow safe HTML elements used in code highlighting
    DOMPurify.setConfig({
        ALLOWED_TAGS: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'br', 'hr',
            'ul', 'ol', 'li',
            'blockquote', 'pre', 'code',
            'a', 'strong', 'em', 'del', 's',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'span', 'div',
            'img',
        ],
        ALLOWED_ATTR: [
            'href', 'target', 'rel',
            'class', 'id',
            'src', 'alt', 'title', 'width', 'height',
        ],
        ALLOW_DATA_ATTR: false,
    });
}

/**
 * Render markdown to HTML (sanitized)
 * @param {string} text - Markdown text
 * @returns {string} - Sanitized HTML string
 */
export function renderMarkdown(text) {
    if (!text) return '';

    try {
        const rawHtml = marked.parse(text);
        // Sanitize HTML to prevent XSS attacks
        return DOMPurify.sanitize(rawHtml);
    } catch (e) {
        console.error('Markdown parse error:', e);
        // Escape the text as fallback to prevent XSS
        return DOMPurify.sanitize(text);
    }
}

/**
 * Highlight all code blocks in an element
 * @param {Element} container 
 */
export function highlightCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach((block) => {
        try {
            hljs.highlightElement(block);
        } catch (e) {
            console.warn('Code highlight error:', e);
        }
    });
}

/**
 * Add copy buttons to code blocks
 * @param {Element} container 
 */
export function addCopyButtons(container) {
    container.querySelectorAll('pre').forEach((pre) => {
        // Skip if already has copy button
        if (pre.querySelector('.copy-button')) return;

        const button = document.createElement('button');
        button.className = 'copy-button absolute top-2 right-2 p-1.5 rounded bg-lamp-input hover:bg-lamp-border transition-colors text-lamp-muted hover:text-lamp-text';
        button.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
        `;
        button.title = 'Copy code';

        button.addEventListener('click', async () => {
            const code = pre.querySelector('code')?.textContent || pre.textContent;
            try {
                await navigator.clipboard.writeText(code);
                button.innerHTML = `
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                `;
                setTimeout(() => {
                    button.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    `;
                }, 2000);
            } catch (e) {
                console.error('Copy failed:', e);
            }
        });

        pre.style.position = 'relative';
        pre.appendChild(button);
    });
}

/**
 * Process message content (render markdown + highlight + copy buttons)
 * @param {Element} container 
 */
export function processMessageContent(container) {
    highlightCodeBlocks(container);
    addCopyButtons(container);
}

