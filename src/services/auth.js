// Auth Service
// =============
// Handles user authentication state and API calls for login/signup

import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Auth Service - manages authentication state and API calls
 */
class AuthService {
    constructor() {
        this._token = null;
        this._user = null;
        this._listeners = new Set();
        this._initialized = false;

        // Refresh token lock to prevent concurrent refresh attempts
        this._refreshPromise = null;
        this._isRefreshing = false;

        // Rate limit tracking
        this._rateLimitedUntil = 0;
    }

    /**
     * Initialize auth service from stored cookies
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) return;

        try {
            // Verify token from cookies
            const result = await this._apiCall('/api/auth', {
                action: 'verify',
            });

            if (result.user) {
                this._user = result.user;
                // Mark token present (cookie-based); enables Neon repo selection
                this._token = 'cookie_auth';
                this._initialized = true;
                this._notifyListeners();
            }
        } catch (error) {
            // No valid token in cookies or token invalid
            console.log('No valid auth token found in cookies');
            this._token = null;
            this._user = null;
        }

        this._initialized = true;
        this._notifyListeners();
    }

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn() {
        return !!this._token && !!this._user;
    }

    /**
     * Get current user
     * @returns {Object|null}
     */
    get currentUser() {
        return this._user;
    }

    /**
     * Get auth token
     * @returns {string|null}
     */
    get token() {
        return this._token;
    }

    /**
     * Subscribe to auth state changes
     * @param {Function} callback 
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    /**
     * Sign up a new user
     * @param {string} email 
     * @param {string} password 
     * @param {string} [name='']
     * @returns {Promise<Object>}
     */
    async signup(email, password, name = '') {
        try {
            const result = await this._apiCall('/api/auth', {
                action: 'signup',
                email,
                password,
                name,
            });

            // Tokens are now set via cookies by the server
            this._user = result.user;
            this._token = 'cookie_auth'; // Placeholder - actual auth is via cookies
            this._notifyListeners();

            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Log in an existing user
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<Object>}
     */
    async login(email, password) {
        try {
            const result = await this._apiCall('/api/auth', {
                action: 'login',
                email,
                password,
            });

            // Tokens are now set via cookies by the server
            this._user = result.user;
            this._token = 'cookie_auth'; // Placeholder - actual auth is via cookies
            this._notifyListeners();

            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Log out current user
     */
    async logout() {
        try {
            await this._apiCall('/api/auth', {
                action: 'logout',
            });
        } catch (error) {
            // Log error but continue with logout
            console.warn('Logout API call failed:', error.message);
        }

        this._token = null;
        this._user = null;
        this._notifyListeners();
    }

    /**
     * Update current user's name
     * @param {string} name 
     * @returns {Promise<Object>}
     */
    async updateName(name) {
        if (!this.isLoggedIn()) {
            return { success: false, error: 'Not logged in' };
        }

        try {
            const result = await this.apiRequest('/api/data', {
                action: 'updateUser',
                data: { name },
            });

            this._user = { ...this._user, name, ...result };
            this._saveToStorage();
            this._notifyListeners();

            return { success: true, user: this._user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Make an authenticated API request to data endpoints
     * @param {string} endpoint 
     * @param {Object} body 
     * @returns {Promise<Object>}
     */
    async apiRequest(endpoint, body, _isRetry = false) {
        // Check if we're rate limited
        if (Date.now() < this._rateLimitedUntil) {
            const waitTime = Math.ceil((this._rateLimitedUntil - Date.now()) / 1000);
            throw new Error(`Rate limited. Please wait ${waitTime} seconds.`);
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify(body),
        });

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            this._rateLimitedUntil = Date.now() + (retryAfter * 1000);
            throw new Error(`Too many requests. Please wait ${retryAfter} seconds.`);
        }

        const data = await response.json();

        if (!response.ok) {
            // Handle authentication errors - but only retry once
            if (response.status === 401 && !_isRetry) {
                // Token might be expired, try to refresh
                try {
                    await this.refreshToken();
                    // Retry the original request (marked as retry to prevent infinite loop)
                    return this.apiRequest(endpoint, body, true);
                } catch (refreshError) {
                    // Refresh failed, user will be logged out by refreshToken()
                    throw new Error('Authentication required');
                }
            }
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    /**
     * Refresh authentication token (with lock to prevent concurrent refreshes)
     * @returns {Promise<Object>}
     */
    async refreshToken() {
        // If already refreshing, wait for that to complete
        if (this._isRefreshing && this._refreshPromise) {
            return this._refreshPromise;
        }

        // Check if we're rate limited
        if (Date.now() < this._rateLimitedUntil) {
            await this.logout();
            throw new Error('Rate limited during refresh');
        }

        this._isRefreshing = true;
        this._refreshPromise = this._doRefreshToken();

        try {
            return await this._refreshPromise;
        } finally {
            this._isRefreshing = false;
            this._refreshPromise = null;
        }
    }

    /**
     * Internal refresh token implementation
     * @private
     */
    async _doRefreshToken() {
        try {
            const result = await this._apiCall('/api/auth', {
                action: 'refresh',
            });

            // Token is refreshed via cookies by the server
            this._user = result.user;
            this._notifyListeners();

            return { success: true, user: result.user };
        } catch (error) {
            // Check if rate limited
            if (error.message?.includes('429') || error.message?.includes('Too many')) {
                // Don't logout immediately, just throw
                throw new Error('Token refresh rate limited');
            }
            // Refresh failed, logout
            await this.logout();
            throw new Error('Token refresh failed');
        }
    }

    /**
     * Make unauthenticated API call (for auth endpoints)
     * @private
     * @param {string} endpoint 
     * @param {Object} body 
     * @returns {Promise<Object>}
     */
    async _apiCall(endpoint, body) {
        // Check if we're rate limited (except for logout)
        if (body.action !== 'logout' && Date.now() < this._rateLimitedUntil) {
            const waitTime = Math.ceil((this._rateLimitedUntil - Date.now()) / 1000);
            throw new Error(`Rate limited. Please wait ${waitTime} seconds.`);
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify(body),
        });

        // Handle rate limiting
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            this._rateLimitedUntil = Date.now() + (retryAfter * 1000);
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Too many requests. Please wait ${retryAfter} seconds.`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    /**
     * Notify all listeners of auth state change
     * @private
     */
    _notifyListeners() {
        const state = {
            isLoggedIn: this.isLoggedIn(),
            user: this._user,
        };
        this._listeners.forEach(cb => cb(state));
    }
}

// Singleton instance
export const authService = new AuthService();

