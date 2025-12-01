// Markdown Rendering Utilities
// ============================

import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import { showCodeRenderer } from './codeRenderer.js';

/**
 * Configure marked with our settings
 */
export function configureMarked() {
    // Use marked-highlight extension for code highlighting
    marked.use(markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
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
        }
    }));

    marked.setOptions({
        breaks: true,
        gfm: true,
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
        button.className = 'copy-button absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-md bg-white/80 hover:bg-white border border-lamp-border/50 hover:border-lamp-border transition-all text-lamp-muted hover:text-lamp-text shadow-sm';
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
 * Add render buttons to HTML/CSS/JS code blocks
 * @param {Element} container
 */
export function addRenderButtons(container) {
    container.querySelectorAll('pre').forEach((pre) => {
        const codeEl = pre.querySelector('code');
        if (!codeEl) return;

        // Detect language from class (language-html, language-css, etc.)
        const langMatch = codeEl.className.match(/language-(\w+)/);
        const lang = langMatch?.[1]?.toLowerCase();

        // Only show for HTML, CSS, JS
        const renderableLangs = ['html', 'css', 'javascript', 'js'];
        if (!renderableLangs.includes(lang)) return;

        // Skip if already has render button
        if (pre.querySelector('.render-button')) return;

        const button = document.createElement('button');
        button.className = 'render-button absolute top-2 right-12 flex items-center justify-center w-8 h-8 rounded-md bg-white/80 hover:bg-white border border-lamp-border/50 hover:border-lamp-border transition-all text-lamp-muted hover:text-lamp-text shadow-sm';
        button.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
        `;
        button.title = 'Render code';
        button.setAttribute('aria-label', 'Render code');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = codeEl.textContent || pre.textContent;
            showCodeRenderer(code, lang);
        });

        // Ensure pre has relative positioning
        pre.style.position = 'relative';
        pre.appendChild(button);
    });
}

/**
 * Collapse height threshold in pixels (~12 lines of code)
 */
const CODE_COLLAPSE_THRESHOLD = 300;

/**
 * Add collapse/expand functionality to long code blocks
 * @param {Element} container
 */
export function addCollapseToCodeBlocks(container) {
    container.querySelectorAll('pre').forEach((pre) => {
        // Skip if already processed
        if (pre.dataset.collapseProcessed) return;
        pre.dataset.collapseProcessed = 'true';

        // Wait for content to render, then check height
        requestAnimationFrame(() => {
            const scrollHeight = pre.scrollHeight;

            // Only collapse if exceeds threshold
            if (scrollHeight <= CODE_COLLAPSE_THRESHOLD) return;

            // Add collapsed class to restrict height
            pre.classList.add('collapsed');

            // Create the overlay container
            const overlay = document.createElement('div');
            overlay.className = 'code-collapse-overlay';

            // Create the toggle button
            const button = document.createElement('button');
            button.className = 'code-collapse-button';

            const updateButtonState = (isCollapsed) => {
                if (isCollapsed) {
                    button.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                        <span>Show more</span>
                    `;
                    button.title = 'Expand code block';
                    overlay.classList.remove('expanded');
                } else {
                    button.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                        </svg>
                        <span>Show less</span>
                    `;
                    button.title = 'Collapse code block';
                    overlay.classList.add('expanded');
                }
            };

            // Initialize as collapsed
            updateButtonState(true);

            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCurrentlyCollapsed = pre.classList.contains('collapsed');

                if (isCurrentlyCollapsed) {
                    pre.classList.remove('collapsed');
                    updateButtonState(false);
                } else {
                    pre.classList.add('collapsed');
                    updateButtonState(true);
                    // Scroll the pre element into view when collapsing
                    pre.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            overlay.appendChild(button);
            pre.appendChild(overlay);
        });
    });
}

/**
 * Process message content (render markdown + highlight + copy buttons + collapse)
 * @param {Element} container
 */
export function processMessageContent(container) {
    highlightCodeBlocks(container);
    addCopyButtons(container);
    addRenderButtons(container);
    addCollapseToCodeBlocks(container);
}

