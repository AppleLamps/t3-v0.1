// Vercel Serverless Function - Chat Proxy
// ========================================
// Proxies chat requests to OpenRouter, keeping API key server-side
// Prevents API key exposure in the client

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

// Initialize Neon client
const sql = neon(process.env.DATABASE_URL);

// JWT secret - MUST be set in environment variables
if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable');
}
const JWT_SECRET = process.env.JWT_SECRET;

// OpenRouter API URL
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Get token from request (header or cookies)
 * @param {Object} req - Request object
 * @returns {string|null} - Token or null
 */
function getTokenFromRequest(req) {
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // Skip placeholder token used for cookie auth
        if (token && token !== 'cookie_auth') {
            return token;
        }
    }

    // Fall back to cookie
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenMatch = cookies.match(/auth_token=([^;]+)/);
        if (tokenMatch) {
            return tokenMatch[1];
        }
    }

    return null;
}

/**
 * Verify JWT and extract user ID
 * @param {Object} req - Request object
 * @returns {Object} - { userId } or { error }
 */
function verifyToken(req) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return { error: 'No token provided', status: 401 };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { userId: decoded.userId };
    } catch (error) {
        return { error: 'Invalid or expired token', status: 401 };
    }
}

/**
 * Get user's API key from database
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - API key or null
 */
async function getUserApiKey(userId) {
    try {
        const result = await sql`
            SELECT api_key FROM user_settings WHERE user_id = ${userId}
        `;
        return result.length > 0 ? result[0].api_key : null;
    } catch (error) {
        console.error('Error fetching API key:', error);
        return null;
    }
}

/**
 * Handle chat completion requests
 * Streams responses back to the client
 */
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify authentication
    const authResult = verifyToken(req);
    if (authResult.error) {
        return res.status(authResult.status).json({ error: authResult.error });
    }

    const { userId } = authResult;

    // Get user's API key from database
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
        return res.status(400).json({ error: 'API key not configured. Please add your OpenRouter API key in Settings.' });
    }

    // Get request body
    const { model, messages, stream = true, ...options } = req.body;

    if (!model || !messages) {
        return res.status(400).json({ error: 'Missing required fields: model and messages' });
    }

    try {
        // Make request to OpenRouter
        const openRouterResponse = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': req.headers.origin || 'https://lampchat.vercel.app',
                'X-Title': 'LampChat',
            },
            body: JSON.stringify({
                model,
                messages,
                stream,
                ...options,
            }),
        });

        if (!openRouterResponse.ok) {
            const errorData = await openRouterResponse.json().catch(() => ({}));
            return res.status(openRouterResponse.status).json({
                error: errorData.error?.message || `OpenRouter API error: ${openRouterResponse.status}`,
            });
        }

        // For streaming responses
        if (stream) {
            // Set headers for SSE streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Get the response body as a readable stream
            const reader = openRouterResponse.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // Decode and forward the chunk
                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                }
            } catch (streamError) {
                console.error('Stream error:', streamError);
            } finally {
                res.end();
            }
        } else {
            // Non-streaming response
            const data = await openRouterResponse.json();
            return res.status(200).json(data);
        }
    } catch (error) {
        console.error('Chat proxy error:', error);
        return res.status(500).json({ error: 'Failed to process chat request' });
    }
}
