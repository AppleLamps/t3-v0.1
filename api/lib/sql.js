import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL environment variable');
}

export const sql = neon(process.env.DATABASE_URL);

export default sql;
