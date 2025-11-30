// Date Utility Functions
// ======================

import { DATE_GROUPS } from '../config/constants.js';

/**
 * Get start of day for a date
 * @param {Date} date 
 * @returns {Date}
 */
export function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Get date group label for a timestamp
 * @param {number} timestamp 
 * @returns {string}
 */
export function getDateGroup(timestamp) {
    const date = startOfDay(new Date(timestamp));
    const today = startOfDay(new Date());
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    if (date.getTime() === today.getTime()) {
        return DATE_GROUPS.TODAY;
    } else if (date.getTime() === yesterday.getTime()) {
        return DATE_GROUPS.YESTERDAY;
    } else if (date > lastWeek) {
        return DATE_GROUPS.LAST_WEEK;
    } else {
        return DATE_GROUPS.OLDER;
    }
}

/**
 * Group items by date
 * @param {Array} items - Items with updatedAt property
 * @returns {Object<string, Array>}
 */
export function groupByDate(items) {
    const groups = {
        [DATE_GROUPS.TODAY]: [],
        [DATE_GROUPS.YESTERDAY]: [],
        [DATE_GROUPS.LAST_WEEK]: [],
        [DATE_GROUPS.OLDER]: [],
    };
    
    for (const item of items) {
        const group = getDateGroup(item.updatedAt);
        groups[group].push(item);
    }
    
    return groups;
}

/**
 * Format timestamp for display
 * @param {number} timestamp 
 * @returns {string}
 */
export function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format timestamp as date
 * @param {number} timestamp 
 * @returns {string}
 */
export function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp 
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) {
        return 'just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        return formatDate(timestamp);
    }
}

