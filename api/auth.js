// Vercel Serverless Function - Authentication
// ============================================
// Handles signup and login with bcrypt password hashing and JWT tokens

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// JWT secret (should be set in Vercel environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        { 
            userId: user.id, 
            email: user.email,
            name: user.name 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
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
        // Check if user already exists
        const existingUser = await sql`
            SELECT id FROM users WHERE email = ${email.toLowerCase()}
        `;

        if (existingUser.length > 0) {
            return { error: 'An account with this email already exists', status: 409 };
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
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

        // Generate token
        const token = generateToken(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                },
                token,
            },
            status: 201,
        };
    } catch (error) {
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

        // Generate token
        const token = generateToken(user);

        return {
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    createdAt: user.created_at,
                },
                token,
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
 * Vercel serverless handler
 */
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST for auth operations
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, email, password, name, token } = req.body;

    let result;

    switch (action) {
        case 'signup':
            result = await handleSignup(email, password, name);
            break;
        case 'login':
            result = await handleLogin(email, password);
            break;
        case 'verify':
            result = await handleVerify(token);
            break;
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }

    return res.status(result.status).json(result.data);
}

