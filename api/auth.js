// Vercel Serverless Function - Authentication
// ============================================
// Handles signup and login with bcrypt password hashing and JWT tokens
// Includes rate limiting and secure cookie-based authentication

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimitMiddleware } from './utils/rateLimiter.js';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// JWT secret - MUST be set in environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable. Set it in Vercel project settings.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

// Cookie configuration
const COOKIE_CONFIG = {
    httpOnly: true,
    secure: true, // Set to true in production with HTTPS
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @param {string} type - Token type ('access' or 'refresh')
 * @returns {string} JWT token
 */
function generateToken(user, type = 'access') {
    const expiresIn = type === 'refresh' ? REFRESH_TOKEN_EXPIRES_IN : JWT_EXPIRES_IN;

    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            name: user.name,
            type
        },
        JWT_SECRET,
        { expiresIn }
    );
}

/**
 * Generate token pair (access + refresh)
 * @param {Object} user - User object
 * @returns {Object} Token pair
 */
function generateTokenPair(user) {
    const accessToken = generateToken(user, 'access');
    const refreshToken = generateToken(user, 'refresh');

    return { accessToken, refreshToken };
}

/**
 * Set authentication cookies
 * @param {Object} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
function setAuthCookies(res, accessToken, refreshToken) {
    // Set access token cookie (7 days)
    res.setHeader('Set-Cookie', [
        `auth_token=${accessToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
        `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${30 * 24 * 60 * 60}`
    ]);
}

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
function clearAuthCookies(res) {
    res.setHeader('Set-Cookie', [
        'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        'refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0'
    ]);
}

/**
 * Extract token from request cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Token from cookies
 */
function getTokenFromCookies(req) {
    const cookies = req.headers.cookie;
    if (!cookies) return null;

    const tokenMatch = cookies.match(/auth_token=([^;]+)/);
    return tokenMatch ? tokenMatch[1] : null;
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Handle user signup
 */
async function handleSignup(email, password, name = '') {
    // Validate input
    if (!email || !password) {
        return { error: 'Email and password are required', status: 400 };
    }

    if (!isValidEmail(email)) {
        return { error: 'Invalid email format', status: 400 };
    }

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters', status: 400 };
    }

    try {
        // Hash password first (before DB operations)
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user - rely on unique constraint to prevent duplicates
        // This eliminates race condition between SELECT and INSERT
        const newUser = await sql`
            INSERT INTO users (email, password_hash, name)
            VALUES (${email.toLowerCase()}, ${passwordHash}, ${name})
            RETURNING id, email, name, created_at
        `;

        const user = newUser[0];

        // Create default settings for user
        await sql`
            INSERT INTO user_settings (user_id)
            VALUES (${user.id})
        `;

        // Generate token pair
        const { accessToken, refreshToken } = generateTokenPair(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                },
            },
            tokens: {
                accessToken,
                refreshToken
            },
            status: 201,
        };
    } catch (error) {
        // Check for unique constraint violation (duplicate email)
        if (error.code === '23505') {
            return { error: 'An account with this email already exists', status: 409 };
        }
        console.error('Signup error:', error);
        return { error: 'Failed to create account', status: 500 };
    }
}

/**
 * Handle user login
 */
async function handleLogin(email, password) {
    // Validate input
    if (!email || !password) {
        return { error: 'Email and password are required', status: 400 };
    }

    try {
        // Find user
        const users = await sql`
            SELECT id, email, password_hash, name, created_at
            FROM users WHERE email = ${email.toLowerCase()}
        `;

        if (users.length === 0) {
            return { error: 'Invalid email or password', status: 401 };
        }

        const user = users[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return { error: 'Invalid email or password', status: 401 };
        }

        // Generate token pair
        const { accessToken, refreshToken } = generateTokenPair(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                },
            },
            tokens: {
                accessToken,
                refreshToken
            },
            status: 200,
        };
    } catch (error) {
        console.error('Login error:', error);
        return { error: 'Failed to log in', status: 500 };
    }
}

/**
 * Verify JWT token and return user info
 */
async function handleVerify(token) {
    if (!token) {
        return { error: 'No token provided', status: 401 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check token type
        if (decoded.type !== 'access') {
            return { error: 'Invalid token type', status: 401 };
        }

        // Fetch fresh user data
        const users = await sql`
            SELECT id, email, name, created_at, updated_at
            FROM users WHERE id = ${decoded.userId}
        `;

        if (users.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        const user = users[0];

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at,
                },
            },
            status: 200,
        };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { error: 'Invalid or expired token', status: 401 };
        }
        console.error('Verify error:', error);
        return { error: 'Failed to verify token', status: 500 };
    }
}

/**
 * Handle token refresh
 */
async function handleRefresh(refreshToken) {
    if (!refreshToken) {
        return { error: 'No refresh token provided', status: 401 };
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        // Check token type
        if (decoded.type !== 'refresh') {
            return { error: 'Invalid token type', status: 401 };
        }

        // Fetch fresh user data
        const users = await sql`
            SELECT id, email, name, created_at, updated_at
            FROM users WHERE id = ${decoded.userId}
        `;

        if (users.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        const user = users[0];

        // Generate new token pair
        const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at,
                },
            },
            tokens: {
                accessToken,
                refreshToken: newRefreshToken
            },
            status: 200,
        };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { error: 'Invalid or expired refresh token', status: 401 };
        }
        console.error('Refresh error:', error);
        return { error: 'Failed to refresh token', status: 500 };
    }
}

/**
 * Handle user logout
 */
async function handleLogout() {
    // In a more sophisticated implementation, you might want to maintain
    // a blacklist of revoked tokens. For now, we just return success.
    return {
        data: { message: 'Logged out successfully' },
        status: 200,
    };
}

/**
 * Vercel serverless handler with rate limiting and cookie authentication
 */
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Apply rate limiting middleware
    await new Promise((resolve, reject) => {
        rateLimitMiddleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // Only allow POST for auth operations
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, email, password, name, refreshToken } = req.body;

    let result;

    switch (action) {
        case 'signup':
            result = await handleSignup(email, password, name);
            break;
        case 'login':
            result = await handleLogin(email, password);
            break;
        case 'verify':
            const token = getTokenFromCookies(req) || req.body.token;
            result = await handleVerify(token);
            break;
        case 'refresh':
            const rt = refreshToken || (req.headers.cookie?.match(/refresh_token=([^;]+)/)?.[1]);
            result = await handleRefresh(rt);
            break;
        case 'logout':
            result = await handleLogout();
            break;
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }

    // Set cookies for successful auth operations (except verify)
    if (result.tokens && ['signup', 'login', 'refresh'].includes(action)) {
        setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
    }

    // Clear cookies for logout
    if (action === 'logout') {
        clearAuthCookies(res);
    }

    // Return response data (without tokens for security)
    const responseData = { ...result.data };
    return res.status(result.status).json(responseData);
}

