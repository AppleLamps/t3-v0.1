// Code Renderer Utility
// =====================
// Handles rendering HTML/CSS/JS code blocks in a safe iframe modal
// Note: We don't import DOMPurify here - the iframe sandbox provides security

/**
 * Show code renderer modal
 * @param {string} code - The code to render
 * @param {string} lang - Language (html, css, js)
 */
export function showCodeRenderer(code, lang) {
    if (!code) return;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-fade-in';
    overlay.id = 'codeRendererModal';
    
    // Determine what to render based on language
    let htmlContent = '';
    let title = 'Code Preview';
    
    if (lang === 'html' || lang === 'htm') {
        // HTML: use directly - iframe sandbox provides security
        htmlContent = code;
        title = 'HTML Preview';
    } else if (lang === 'css') {
        // CSS: wrap in full HTML document with style tag
        htmlContent = `<!DOCTYPE html><html><head><title>CSS Preview</title><style>${code}</style></head><body><p>CSS styles are applied to this page.</p></body></html>`;
        title = 'CSS Preview';
    } else if (lang === 'javascript' || lang === 'js') {
        // JS: wrap in HTML with script tag
        // Security is provided by the iframe sandbox attribute
        const escapedCode = code.replace(/<\/script>/gi, '<\\/script>'); // Prevent script tag injection
        htmlContent = `<!DOCTYPE html><html><head><title>JS Preview</title></head><body><script>${escapedCode}</script></body></html>`;
        title = 'JavaScript Preview';
    } else {
        // Fallback: try as HTML
        htmlContent = code;
        title = 'Code Preview';
    }
    
    overlay.innerHTML = `
        <div class="bg-lamp-card rounded-2xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] mx-4 overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-lamp-border shrink-0">
                <h3 class="text-lg font-semibold text-lamp-text">${title}</h3>
                <button id="codeRendererClose" class="p-2 hover:bg-lamp-input rounded-lg transition-colors text-lamp-muted hover:text-lamp-text" aria-label="Close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <!-- Iframe Container -->
            <div class="flex-1 min-h-0 bg-white">
                <iframe 
                    id="codeRendererIframe" 
                    class="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                    title="Code preview">
                </iframe>
            </div>
            
            <!-- Footer with warning -->
            <div class="p-3 border-t border-lamp-border bg-amber-50/50 shrink-0">
                <p class="text-xs text-lamp-muted text-center">
                    Code is rendered in a sandboxed iframe for security. Some features may be limited.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Get iframe and set content
    const iframe = overlay.querySelector('#codeRendererIframe');
    if (iframe) {
        try {
            // Use srcdoc for better security
            iframe.srcdoc = htmlContent;
        } catch (e) {
            console.error('Failed to render code:', e);
            // Fallback: show error message
            iframe.srcdoc = `
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: system-ui; padding: 20px; color: #dc2626;">
                        <h1>Render Error</h1>
                        <p>Failed to render code. The code may contain invalid HTML or security restrictions.</p>
                        <pre style="background: #f3f4f6; padding: 10px; border-radius: 4px; overflow: auto;">${escapeHtml(code.substring(0, 500))}</pre>
                    </body>
                </html>
            `;
        }
    }
    
    // Cleanup function
    const cleanup = () => {
        overlay.remove();
        document.body.style.overflow = '';
    };
    
    // Close button
    overlay.querySelector('#codeRendererClose')?.addEventListener('click', cleanup);
    
    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
    });
    
    // Escape key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', handleEscape);
            cleanup();
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Focus close button
    overlay.querySelector('#codeRendererClose')?.focus();
}

/**
 * Escape HTML entities
 * @param {string} text 
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

