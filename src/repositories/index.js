// Repository Factory
// ==================
// This module exports the active repository implementation.
// Change this when migrating to a different data store (e.g., Neon).

import { LocalStorageRepository } from './LocalStorageRepository.js';
// Future: import { NeonRepository } from './NeonRepository.js';

// Repository type configuration
// Change this to switch implementations
const REPOSITORY_TYPE = 'localStorage'; // 'localStorage' | 'neon'

/**
 * Create and return the appropriate repository instance
 * @returns {import('./BaseRepository.js').BaseRepository}
 */
function createRepository() {
    switch (REPOSITORY_TYPE) {
        case 'localStorage':
            return new LocalStorageRepository();
        // Future: case 'neon':
        //     return new NeonRepository(connectionConfig);
        default:
            return new LocalStorageRepository();
    }
}

// Singleton instance
export const repository = createRepository();

// Re-export base types for use elsewhere
export { BaseRepository } from './BaseRepository.js';
export { LocalStorageRepository } from './LocalStorageRepository.js';

