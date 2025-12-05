// Rate Limiting Utility - Upstash Redis Implementation
// ====================================================
// Distributed rate limiter for Vercel serverless functions
// Uses Upstash Redis for persistent storage across instances
// SECURITY FIX: Replaces in-memory Map with distributed storage

import { Redis } from '@upstash/redis';

/**
 * Rate Limiter Configuration
 * Different limits for different action types
 */
const RATE_LIMIT_CONFIG = {
    // Default rate limit (for sensitive actions like login/signup)
    default: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 requests per minute (allows for retries)
    },
    // Stricter limit for login attempts (brute force protection)
    login: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10, // 10 login attempts per minute
    },
    // Stricter limit for signup (spam protection)
    signup: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 5, // 5 signups per minute
    },
    // More lenient for read-only operations (verify, refresh)
    verify: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 120, // 120 verifications per minute (page loads, etc.)
    },
    refresh: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 refreshes per minute
    },
    // Logout should always be allowed
    logout: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 logouts per minute (practically unlimited)
    },
    // Chat/data operations
    chat: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 600, // High ceiling to avoid throttling normal use
    },
    data: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 300, // High ceiling for CRUD/import/export bursts
    },
};

/**
 * Initialize Upstash Redis client
 * Uses environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isRedisConfigured = !!(REDIS_URL && REDIS_TOKEN);

const redis = isRedisConfigured ? new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
}) : null;

// In-memory fallback limiter (per action)
const fallbackStore = new Map();
function fallbackIncrement(clientIP, action = 'default') {
    const config = getConfigForAction(action);
    const now = Date.now();
    const key = `${action}:${clientIP}`;
    const current = fallbackStore.get(key);
    if (!current || now > current.resetTime) {
        const data = { count: 1, resetTime: now + config.windowMs, config };
        fallbackStore.set(key, data);
        return data;
    }
    const updated = { ...current, count: current.count + 1, config };
    fallbackStore.set(key, updated);
    return updated;
}

/**
 * Rate limit data structure stored in Redis
 * @typedef {Object} RateLimitData
 * @property {number} count - Number of requests in current window
 * @property {number} resetTime - Timestamp when the window resets
 */

/**
 * Get rate limit config for a specific action
 * @param {string} action - The action type (login, signup, verify, etc.)
 * @returns {Object} Rate limit config with windowMs and maxRequests
 */
function getConfigForAction(action) {
    return RATE_LIMIT_CONFIG[action] || RATE_LIMIT_CONFIG.default;
}

/**
 * Extract client IP from request headers
 * Handles Vercel proxy headers and fallback to connection
 * @param {Object} req - Express/Vercel request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
    // Check Vercel proxy headers first
    const realIP = req.headers['x-real-ip'];
    const forwardedFor = req.headers['x-forwarded-for'];

    if (realIP) {
        return realIP;
    }

    if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwardedFor.split(',')[0].trim();
    }

    // Fallback to connection remote address
    return req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown';
}

/**
 * Get rate limit key for Redis storage
 * @param {string} clientIP - Client IP address
 * @param {string} action - Action type for separate rate limiting
 * @returns {string} Redis storage key
 */
function getRateLimitKey(clientIP, action = 'default') {
    return `rate_limit:${action}:${clientIP}`;
}

/**
 * Get rate limit data from Redis storage
 * @param {string} clientIP - Client IP address
 * @param {string} action - Action type
 * @returns {Promise<RateLimitData|null>} Rate limit data or null
 */
async function getRateLimitData(clientIP, action = 'default') {
    try {
        const key = getRateLimitKey(clientIP, action);
        const data = await redis.get(key);

        if (!data) {
            return null;
        }

        // Validate data structure
        if (typeof data.count !== 'number' || typeof data.resetTime !== 'number') {
            return null;
        }

        return data;
    } catch (error) {
        console.error('Redis get rate limit error:', error);
        return null;
    }
}

/**
 * Set rate limit data in Redis storage
 * @param {string} clientIP - Client IP address
 * @param {string} action - Action type
 * @param {RateLimitData} data - Rate limit data
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
async function setRateLimitData(clientIP, action, data, ttlSeconds) {
    try {
        const key = getRateLimitKey(clientIP, action);
        await redis.setex(key, ttlSeconds, data);
        return true;
    } catch (error) {
        console.error('Redis set rate limit error:', error);
        return false;
    }
}

/**
 * Increment rate limit counter atomically using Redis INCR
 * @param {string} clientIP - Client IP address
 * @param {string} action - Action type for separate rate limiting
 * @returns {Promise<{count: number, resetTime: number, config: Object}|null>} Updated rate limit data or null
 */
async function incrementRateLimit(clientIP, action = 'default') {
    const key = getRateLimitKey(clientIP, action);
    const config = getConfigForAction(action);
    const now = Date.now();

    try {
        // Use Redis pipeline for atomic operations
        const pipeline = redis.pipeline();

        // Try to get existing data
        pipeline.get(key);
        const results = await pipeline.exec();
        const current = results[0];

        if (!current) {
            // First request from this IP in this window
            const newData = {
                count: 1,
                resetTime: now + config.windowMs
            };

            // Set with TTL equal to window duration
            await setRateLimitData(clientIP, action, newData, Math.ceil(config.windowMs / 1000));
            return { ...newData, config };
        }

        // Validate existing data
        if (typeof current.count !== 'number' || typeof current.resetTime !== 'number') {
            // Invalid data, reset
            const newData = {
                count: 1,
                resetTime: now + config.windowMs
            };
            await setRateLimitData(clientIP, action, newData, Math.ceil(config.windowMs / 1000));
            return { ...newData, config };
        }

        // Check if window has reset
        if (now > current.resetTime) {
            // Reset window
            const newData = {
                count: 1,
                resetTime: now + config.windowMs
            };
            await setRateLimitData(clientIP, action, newData, Math.ceil(config.windowMs / 1000));
            return { ...newData, config };
        }

        // Increment count
        const updatedData = {
            count: current.count + 1,
            resetTime: current.resetTime
        };

        // Update with remaining TTL
        const remainingTtl = Math.ceil((current.resetTime - now) / 1000);
        await setRateLimitData(clientIP, action, updatedData, Math.max(1, remainingTtl));

        return { ...updatedData, config };
    } catch (error) {
        console.error('Redis increment rate limit error:', error);
        return null;
    }
}

/**
 * Rate limiting middleware factory
 * @param {string} action - Action type for rate limiting (login, signup, verify, etc.)
 * @returns {Function} Middleware function
 */
function createRateLimitMiddleware(action = 'default') {
    return async function rateLimitMiddleware(req, res, next) {
        const clientIP = getClientIP(req);
        const now = Date.now();

        try {
            // Check if Redis is configured
            let rateLimitData = null;
            if (isRedisConfigured) {
                rateLimitData = await incrementRateLimit(clientIP, action);
            }

            if (!rateLimitData) {
                // Fall back to in-memory limiter
                rateLimitData = fallbackIncrement(clientIP, action);
            }

            const config = rateLimitData.config;

            // Set rate limit headers
            const remaining = Math.max(0, config.maxRequests - rateLimitData.count);
            res.setHeader('X-RateLimit-Limit', config.maxRequests);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

            // Check if limit exceeded
            if (rateLimitData.count > config.maxRequests) {
                const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

                res.setHeader('Retry-After', retryAfter);

                return res.status(429).json({
                    error: 'Too many requests',
                    message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                    retryAfter: retryAfter
                });
            }

            next();
        } catch (error) {
            console.error('Rate limit middleware error:', error);
            // On any unexpected error, allow the request but log it
            next();
        }
    };
}

/**
 * Legacy rate limiting middleware (uses default config)
 * @param {Object} req - Express/Vercel request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function rateLimitMiddleware(req, res, next) {
    // Try to extract action from request body for action-specific limiting
    let action = 'default';
    if (req.body && req.body.action) {
        action = req.body.action;
    }

    const middleware = createRateLimitMiddleware(action);
    return middleware(req, res, next);
}

/**
 * Get current rate limit status for an IP
 * @param {string} clientIP 
 * @param {string} action - Action type
 * @returns {Promise<Object>} Rate limit status
 */
async function getRateLimitStatus(clientIP, action = 'default') {
    try {
        const config = getConfigForAction(action);
        const rateLimitData = await getRateLimitData(clientIP, action);
        const now = Date.now();

        if (!rateLimitData || now > rateLimitData.resetTime) {
            return {
                allowed: true,
                remaining: config.maxRequests,
                resetTime: null
            };
        }

        const remaining = Math.max(0, config.maxRequests - rateLimitData.count);
        const resetTime = rateLimitData.resetTime;

        return {
            allowed: rateLimitData.count <= config.maxRequests,
            remaining,
            resetTime
        };
    } catch (error) {
        console.error('Get rate limit status error:', error);
        const config = getConfigForAction(action);
        return {
            allowed: true,
            remaining: config.maxRequests,
            resetTime: null,
            error: 'Unable to retrieve rate limit status'
        };
    }
}

/**
 * Manually reset rate limit for an IP (useful for testing)
 * @param {string} clientIP 
 * @param {string} action - Action type (or null to reset all actions)
 * @returns {Promise<boolean>} Success status
 */
async function resetRateLimit(clientIP, action = null) {
    try {
        if (action) {
            const key = getRateLimitKey(clientIP, action);
            await redis.del(key);
        } else {
            // Reset all action-specific limits for this IP
            const actions = Object.keys(RATE_LIMIT_CONFIG);
            for (const act of actions) {
                const key = getRateLimitKey(clientIP, act);
                await redis.del(key);
            }
        }
        return true;
    } catch (error) {
        console.error('Reset rate limit error:', error);
        return false;
    }
}

/**
 * Get rate limit configuration
 * @returns {Object} Current configuration
 */
function getRateLimitConfig() {
    return { ...RATE_LIMIT_CONFIG };
}

// Export functions and middleware
export {
    rateLimitMiddleware,
    createRateLimitMiddleware,
    getClientIP,
    getRateLimitStatus,
    resetRateLimit,
    getRateLimitConfig,
    RATE_LIMIT_CONFIG
};