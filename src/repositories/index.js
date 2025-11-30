// Repository Factory
// ==================
// This module exports the active repository implementation.
// Dynamically selects between LocalStorage and Neon based on auth state.

import { LocalStorageRepository } from './LocalStorageRepository.js';
import { NeonRepository } from './NeonRepository.js';
import { authService } from '../services/auth.js';

// Cached repository instances
let localStorageRepo = null;
let neonRepo = null;

/**
 * Get the LocalStorage repository instance (singleton)
 * @returns {LocalStorageRepository}
 */
function getLocalStorageRepository() {
    if (!localStorageRepo) {
        localStorageRepo = new LocalStorageRepository();
    }
    return localStorageRepo;
}

/**
 * Get the Neon repository instance (singleton)
 * @returns {NeonRepository}
 */
function getNeonRepository() {
    if (!neonRepo) {
        neonRepo = new NeonRepository();
    }
    return neonRepo;
}

/**
 * Create and return the appropriate repository instance based on auth state
 * @returns {import('./BaseRepository.js').BaseRepository}
 */
export function createRepository() {
    if (authService.isLoggedIn()) {
        return getNeonRepository();
    }
    return getLocalStorageRepository();
}

/**
 * Get the current repository based on auth state
 * This is a dynamic getter that returns the appropriate repository
 * @returns {import('./BaseRepository.js').BaseRepository}
 */
export function getRepository() {
    return createRepository();
}

// Create a proxy object that dynamically delegates to the correct repository
// This allows the repository to switch transparently when auth state changes
const repositoryProxy = new Proxy({}, {
    get(target, prop) {
        const repo = getRepository();
        const value = repo[prop];
        
        // If it's a function, bind it to the repository instance
        if (typeof value === 'function') {
            return value.bind(repo);
        }
        
        return value;
    }
});

// Export the dynamic proxy as the main repository
export const repository = repositoryProxy;

// Re-export base types for use elsewhere
export { BaseRepository } from './BaseRepository.js';
export { LocalStorageRepository } from './LocalStorageRepository.js';
export { NeonRepository } from './NeonRepository.js';
