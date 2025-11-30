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
    }

    /**
     * Initialize auth service from stored token
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) return;

        const storedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const storedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);

        if (storedToken && storedUser) {
            this._token = storedToken;
            this._user = JSON.parse(storedUser);

            // Verify token is still valid
            try {
                const result = await this._apiCall('/api/auth', {
                    action: 'verify',
                    token: storedToken,
                });

                if (result.user) {
                    this._user = result.user;
                    this._saveToStorage();
                }
            } catch (error) {
                // Token invalid, clear auth state
                console.warn('Auth token invalid, clearing session');
                this.logout();
            }
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

            this._token = result.token;
            this._user = result.user;
            this._saveToStorage();
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

            this._token = result.token;
            this._user = result.user;
            this._saveToStorage();
            this._notifyListeners();

            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Log out current user
     */
    logout() {
        this._token = null;
        this._user = null;
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
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
    async apiRequest(endpoint, body) {
        if (!this._token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    /**
     * Make unauthenticated API call (for auth endpoints)
     * @private
     * @param {string} endpoint 
     * @param {Object} body 
     * @returns {Promise<Object>}
     */
    async _apiCall(endpoint, body) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    /**
     * Save auth state to localStorage
     * @private
     */
    _saveToStorage() {
        if (this._token && this._user) {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, this._token);
            localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(this._user));
        }
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

