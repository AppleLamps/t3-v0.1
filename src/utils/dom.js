// DOM Utility Functions
// =====================

/**
 * Shorthand for document.getElementById
 * @param {string} id 
 * @returns {HTMLElement|null}
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Shorthand for document.querySelector
 * @param {string} selector 
 * @param {Element} [parent=document] 
 * @returns {Element|null}
 */
export function $$(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Shorthand for document.querySelectorAll
 * @param {string} selector 
 * @param {Element} [parent=document] 
 * @returns {NodeListOf<Element>}
 */
export function $$$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Escape HTML entities
 * @param {string} text 
 * @returns {string}
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create element with attributes and children
 * @param {string} tag - Element tag name
 * @param {Object} [attrs] - Attributes
 * @param {(string|Element)[]} [children] - Children
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(el.dataset, value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
            el.appendChild(child);
        }
    }
    
    return el;
}

/**
 * Remove all children from an element
 * @param {Element} element 
 */
export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Set HTML content safely
 * @param {Element} element 
 * @param {string} html 
 */
export function setHtml(element, html) {
    element.innerHTML = html;
}

/**
 * Add event listener with cleanup
 * @param {Element} element 
 * @param {string} event 
 * @param {Function} handler 
 * @param {Object} [options] 
 * @returns {Function} - Cleanup function
 */
export function addListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
}

/**
 * Toggle class on element
 * @param {Element} element 
 * @param {string} className 
 * @param {boolean} [force] 
 */
export function toggleClass(element, className, force) {
    element.classList.toggle(className, force);
}

/**
 * Scroll element to bottom
 * @param {Element} element 
 * @param {boolean} [smooth=false] 
 */
export function scrollToBottom(element, smooth = false) {
    element.scrollTo({
        top: element.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
    });
}

/**
 * Focus an element
 * @param {string|Element} elementOrId 
 */
export function focusElement(elementOrId) {
    const element = typeof elementOrId === 'string' ? $(elementOrId) : elementOrId;
    element?.focus();
}

/**
 * Check if element is visible in viewport
 * @param {Element} element 
 * @returns {boolean}
 */
export function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Show a custom confirmation dialog
 * @param {string} message - The message to display
 * @param {Object} [options] - Options
 * @param {string} [options.title] - Dialog title
 * @param {string} [options.confirmText] - Confirm button text
 * @param {string} [options.cancelText] - Cancel button text
 * @param {boolean} [options.danger] - Whether this is a dangerous action
 * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
    const {
        title = 'Confirm',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        danger = false,
    } = options;
    
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-fade-in';
        overlay.id = 'confirmDialog';
        
        overlay.innerHTML = `
            <div class="bg-lamp-card rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
                <div class="p-6">
                    <h3 class="text-lg font-semibold text-lamp-text mb-2">${title}</h3>
                    <p class="text-lamp-muted text-sm">${message}</p>
                </div>
                <div class="flex border-t border-lamp-border">
                    <button id="confirmCancel" class="flex-1 py-3 text-sm font-medium text-lamp-muted hover:bg-lamp-input transition-colors">
                        ${cancelText}
                    </button>
                    <button id="confirmOk" class="flex-1 py-3 text-sm font-medium ${danger ? 'text-red-600 hover:bg-red-50' : 'text-lamp-accent hover:bg-lamp-input'} border-l border-lamp-border transition-colors">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };
        
        // Handle clicks
        overlay.querySelector('#confirmCancel').addEventListener('click', () => cleanup(false));
        overlay.querySelector('#confirmOk').addEventListener('click', () => cleanup(true));
        
        // Click outside to cancel
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
        
        // Escape key to cancel
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                cleanup(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Focus confirm button
        overlay.querySelector('#confirmOk').focus();
    });
}

