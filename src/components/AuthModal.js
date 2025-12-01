// Auth Modal Component
// ====================
// Login/Signup modal for user authentication

import { authService } from '../services/auth.js';
import { $, setHtml } from '../utils/dom.js';
import { mixinComponentLifecycle } from './Component.js';

/**
 * Auth modal component - handles login and signup
 */
export class AuthModal {
    constructor() {
        this.elements = {
            modal: null,
            form: null,
            emailInput: null,
            passwordInput: null,
            nameInput: null,
            submitBtn: null,
            toggleLink: null,
            errorMessage: null,
        };

        this._mode = 'login'; // 'login' | 'signup'
        this._isLoading = false;
        this._onSuccess = null;

        // Add lifecycle management for automatic cleanup
        mixinComponentLifecycle(this);
    }

    /**
     * Initialize the auth modal
     * @param {string} containerId - Container element ID
     */
    init(containerId) {
        const container = $(containerId);
        if (!container) {
            console.error('Auth modal container not found');
            return;
        }

        container.innerHTML = this._render();
        this._cacheElements();
        this._bindEvents();
    }

    /**
     * Render modal HTML
     * @private
     */
    _render() {
        return `
            <div id="authModal" class="fixed inset-0 z-[100] flex items-center justify-center" style="display: none;">
                <!-- Backdrop -->
                <div id="authBackdrop" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                
                <!-- Modal Content -->
                <div class="relative bg-lamp-card rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
                    <!-- Header -->
                    <div class="relative px-8 pt-8 pb-6 text-center border-b border-lamp-border bg-gradient-to-b from-lamp-sidebar to-lamp-card">
                        <button id="authCloseBtn" class="absolute top-4 right-4 p-2 text-lamp-muted hover:text-lamp-text rounded-lg hover:bg-lamp-input transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                        
                        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                        </div>
                        
                        <h2 id="authTitle" class="text-2xl font-bold text-lamp-text">Welcome Back</h2>
                        <p id="authSubtitle" class="text-sm text-lamp-muted mt-1">Sign in to sync your chats across devices</p>
                    </div>
                    
                    <!-- Form -->
                    <form id="authForm" class="p-8 space-y-5">
                        <!-- Error Message -->
                        <div id="authError" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                            Error message here
                        </div>
                        
                        <!-- Name Field (signup only) -->
                        <div id="nameField" class="hidden">
                            <label for="authName" class="block text-sm font-medium text-lamp-text mb-2">Name</label>
                            <input type="text" id="authName" placeholder="Your name (optional)"
                                class="w-full px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl focus:outline-none focus:border-lamp-accent focus:ring-2 focus:ring-lamp-accent/20 transition-all">
                        </div>
                        
                        <!-- Email Field -->
                        <div>
                            <label for="authEmail" class="block text-sm font-medium text-lamp-text mb-2">Email</label>
                            <input type="email" id="authEmail" placeholder="you@example.com" required
                                class="w-full px-4 py-3 bg-lamp-input border border-lamp-border rounded-xl focus:outline-none focus:border-lamp-accent focus:ring-2 focus:ring-lamp-accent/20 transition-all">
                        </div>
                        
                        <!-- Password Field -->
                        <div>
                            <label for="authPassword" class="block text-sm font-medium text-lamp-text mb-2">Password</label>
                            <div class="relative">
                                <input type="password" id="authPassword" placeholder="••••••••" required minlength="6"
                                    class="w-full px-4 py-3 pr-12 bg-lamp-input border border-lamp-border rounded-xl focus:outline-none focus:border-lamp-accent focus:ring-2 focus:ring-lamp-accent/20 transition-all">
                                <button type="button" id="togglePasswordBtn" class="absolute right-3 top-1/2 -translate-y-1/2 text-lamp-muted hover:text-lamp-text transition-colors">
                                    <svg id="passwordEyeIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                    </svg>
                                </button>
                            </div>
                            <p id="passwordHint" class="hidden text-xs text-lamp-muted mt-2">Must be at least 6 characters</p>
                        </div>
                        
                        <!-- Submit Button -->
                        <button type="submit" id="authSubmitBtn" 
                            class="w-full py-3.5 bg-lamp-accent text-white font-semibold rounded-xl hover:bg-lamp-hover transition-all shadow-lg shadow-lamp-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span id="authSubmitText">Sign In</span>
                            <svg id="authSpinner" class="hidden w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </button>
                    </form>
                    
                    <!-- Footer -->
                    <div class="px-8 pb-8 text-center">
                        <p class="text-sm text-lamp-muted">
                            <span id="authToggleText">Don't have an account?</span>
                            <button type="button" id="authToggleLink" class="font-semibold text-lamp-accent hover:underline ml-1">
                                Sign up
                            </button>
                        </p>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
            </style>
        `;
    }

    /**
     * Cache element references
     * @private
     */
    _cacheElements() {
        this.elements.modal = $('authModal');
        this.elements.backdrop = $('authBackdrop');
        this.elements.closeBtn = $('authCloseBtn');
        this.elements.form = $('authForm');
        this.elements.emailInput = $('authEmail');
        this.elements.passwordInput = $('authPassword');
        this.elements.nameInput = $('authName');
        this.elements.nameField = $('nameField');
        this.elements.submitBtn = $('authSubmitBtn');
        this.elements.submitText = $('authSubmitText');
        this.elements.spinner = $('authSpinner');
        this.elements.toggleLink = $('authToggleLink');
        this.elements.toggleText = $('authToggleText');
        this.elements.errorMessage = $('authError');
        this.elements.title = $('authTitle');
        this.elements.subtitle = $('authSubtitle');
        this.elements.passwordHint = $('passwordHint');
        this.elements.togglePasswordBtn = $('togglePasswordBtn');
        this.elements.passwordEyeIcon = $('passwordEyeIcon');
    }

    /**
     * Bind event handlers
     * Uses this.on() for automatic cleanup on destroy
     * @private
     */
    _bindEvents() {
        // Close modal
        if (this.elements.closeBtn) {
            this.on(this.elements.closeBtn, 'click', () => this.close());
        }
        if (this.elements.backdrop) {
            this.on(this.elements.backdrop, 'click', () => this.close());
        }

        // Form submission
        if (this.elements.form) {
            this.on(this.elements.form, 'submit', (e) => this._handleSubmit(e));
        }

        // Toggle between login and signup
        if (this.elements.toggleLink) {
            this.on(this.elements.toggleLink, 'click', () => this._toggleMode());
        }

        // Toggle password visibility
        if (this.elements.togglePasswordBtn) {
            this.on(this.elements.togglePasswordBtn, 'click', () => this._togglePasswordVisibility());
        }

        // Escape key to close
        this.on(document, 'keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.modal?.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    /**
     * Open the modal
     * @param {'login'|'signup'} [mode='login'] - Initial mode
     * @param {Function} [onSuccess] - Callback on successful auth
     */
    open(mode = 'login', onSuccess = null) {
        this._mode = mode;
        this._onSuccess = onSuccess;
        this._updateUI();
        this._clearError();
        this._clearForm();

        if (this.elements.modal) this.elements.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Focus email input
        setTimeout(() => this.elements.emailInput?.focus(), 100);
    }

    /**
     * Close the modal
     */
    close() {
        if (this.elements.modal) this.elements.modal.style.display = 'none';
        document.body.style.overflow = '';
        this._clearForm();
        this._clearError();
    }

    /**
     * Toggle between login and signup modes
     * @private
     */
    _toggleMode() {
        this._mode = this._mode === 'login' ? 'signup' : 'login';
        this._updateUI();
        this._clearError();
    }

    /**
     * Update UI based on current mode
     * @private
     */
    _updateUI() {
        const isLogin = this._mode === 'login';

        // Update title and subtitle
        if (this.elements.title) {
            this.elements.title.textContent = isLogin ? 'Welcome Back' : 'Create Account';
        }
        if (this.elements.subtitle) {
            this.elements.subtitle.textContent = isLogin
                ? 'Sign in to sync your chats across devices'
                : 'Sign up to save your chats in the cloud';
        }

        // Toggle name field
        if (this.elements.nameField) {
            this.elements.nameField.classList.toggle('hidden', isLogin);
        }

        // Update submit button
        if (this.elements.submitText) {
            this.elements.submitText.textContent = isLogin ? 'Sign In' : 'Create Account';
        }

        // Update toggle link
        if (this.elements.toggleText) {
            this.elements.toggleText.textContent = isLogin
                ? "Don't have an account?"
                : 'Already have an account?';
        }
        if (this.elements.toggleLink) {
            this.elements.toggleLink.textContent = isLogin ? 'Sign up' : 'Sign in';
        }

        // Show password hint for signup
        if (this.elements.passwordHint) {
            this.elements.passwordHint.classList.toggle('hidden', isLogin);
        }
    }

    /**
     * Handle form submission
     * @private
     */
    async _handleSubmit(e) {
        e.preventDefault();

        if (this._isLoading) return;

        const email = this.elements.emailInput?.value?.trim();
        const password = this.elements.passwordInput?.value;
        const name = this.elements.nameInput?.value?.trim();

        if (!email || !password) {
            this._showError('Please fill in all required fields');
            return;
        }

        if (this._mode === 'signup' && password.length < 6) {
            this._showError('Password must be at least 6 characters');
            return;
        }

        this._setLoading(true);
        this._clearError();

        let result;
        if (this._mode === 'login') {
            result = await authService.login(email, password);
        } else {
            result = await authService.signup(email, password, name);
        }

        this._setLoading(false);

        if (result.success) {
            this.close();
            if (this._onSuccess) {
                this._onSuccess(result.user);
            }
        } else {
            this._showError(result.error || 'Authentication failed');
        }
    }

    /**
     * Toggle password visibility
     * @private
     */
    _togglePasswordVisibility() {
        if (!this.elements.passwordInput || !this.elements.passwordEyeIcon) return;

        const isPassword = this.elements.passwordInput.type === 'password';
        this.elements.passwordInput.type = isPassword ? 'text' : 'password';

        // Update icon
        this.elements.passwordEyeIcon.innerHTML = isPassword
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
    }

    /**
     * Set loading state
     * @private
     */
    _setLoading(loading) {
        this._isLoading = loading;

        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
        }
        if (this.elements.submitText) {
            this.elements.submitText.classList.toggle('hidden', loading);
        }
        if (this.elements.spinner) {
            this.elements.spinner.classList.toggle('hidden', !loading);
        }
    }

    /**
     * Show error message
     * @private
     */
    _showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.remove('hidden');
        }
    }

    /**
     * Clear error message
     * @private
     */
    _clearError() {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.classList.add('hidden');
            this.elements.errorMessage.textContent = '';
        }
    }

    /**
     * Clear form fields
     * @private
     */
    _clearForm() {
        if (this.elements.emailInput) this.elements.emailInput.value = '';
        if (this.elements.passwordInput) this.elements.passwordInput.value = '';
        if (this.elements.nameInput) this.elements.nameInput.value = '';
    }
}

