import { sql } from '../lib/sql.js';

export async function getUser(userId) {
    try {
        const users = await sql`
            SELECT id, email, name, created_at as "createdAt", updated_at as "updatedAt"
            FROM users WHERE id = ${userId}
        `;

        if (users.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        return { data: users[0], status: 200 };
    } catch (error) {
        console.error('Get user error:', error);
        return { error: 'Failed to fetch user', status: 500 };
    }
}

export async function updateUser(userId, updates = {}) {
    try {
        const updatedUser = await sql`
            UPDATE users
            SET name = COALESCE(${updates.name}, name),
                updated_at = NOW()
            WHERE id = ${userId}
            RETURNING id, email, name, created_at as "createdAt", updated_at as "updatedAt"
        `;

        if (updatedUser.length === 0) {
            return { error: 'User not found', status: 404 };
        }

        return { data: updatedUser[0], status: 200 };
    } catch (error) {
        console.error('Update user error:', error);
        return { error: 'Failed to update user', status: 500 };
    }
}
