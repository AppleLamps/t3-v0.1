// Rate Limiting Utility
// ====================
// Simple in-memory rate limiter for Vercel serverless functions
// Tracks requests per IP address with automatic cleanup

/**
 * Rate Limiter Configuration
 */
const RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 requests per minute
    cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
};

/**
 * In-memory rate limit store
 * @type {Map<string, {count: number, resetTime: number}>}
 */
const rateLimitStore = new Map();

/**
 * Cleanup old entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_LIMIT_CONFIG.cleanupIntervalMs);

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
 * Rate limiting middleware
 * @param {Object} req - Express/Vercel request object
 * @param {Object} res - Express/Vercel response object
 * @param {Function} next - Next middleware function
 */
function rateLimitMiddleware(req, res, next) {
    const clientIP = getClientIP(req);
    const now = Date.now();

    // Get or create rate limit data for this IP
    let rateLimitData = rateLimitStore.get(clientIP);

    if (!rateLimitData) {
        // First request from this IP
        rateLimitData = {
            count: 1,
            resetTime: now + RATE_LIMIT_CONFIG.windowMs
        };
        rateLimitStore.set(clientIP, rateLimitData);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests);
        res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_CONFIG.maxRequests - 1);
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

        return next();
    }

    // Check if the window has reset
    if (now > rateLimitData.resetTime) {
        // Reset the window
        rateLimitData = {
            count: 1,
            resetTime: now + RATE_LIMIT_CONFIG.windowMs
        };
        rateLimitStore.set(clientIP, rateLimitData);

        res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests);
        res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_CONFIG.maxRequests - 1);
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

        return next();
    }

    // Increment request count
    rateLimitData.count++;

    // Set rate limit headers
    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - rateLimitData.count);
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));

    // Check if limit exceeded
    if (rateLimitData.count > RATE_LIMIT_CONFIG.maxRequests) {
        const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

        res.setHeader('Retry-After', retryAfter);

        return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            retryAfter: retryAfter
        });
    }

    next();
}

/**
 * Get current rate limit status for an IP
 * @param {string} clientIP 
 * @returns {Object} Rate limit status
 */
function getRateLimitStatus(clientIP) {
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(clientIP);

    if (!rateLimitData || now > rateLimitData.resetTime) {
        return {
            allowed: true,
            remaining: RATE_LIMIT_CONFIG.maxRequests,
            resetTime: null
        };
    }

    const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - rateLimitData.count);
    const resetTime = rateLimitData.resetTime;

    return {
        allowed: rateLimitData.count <= RATE_LIMIT_CONFIG.maxRequests,
        remaining,
        resetTime
    };
}

/**
 * Manually reset rate limit for an IP (useful for testing)
 * @param {string} clientIP 
 */
function resetRateLimit(clientIP) {
    rateLimitStore.delete(clientIP);
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
    getClientIP,
    getRateLimitStatus,
    resetRateLimit,
    getRateLimitConfig,
    RATE_LIMIT_CONFIG
};