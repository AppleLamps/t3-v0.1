import { sql } from '../lib/sql.js';

export async function getProjects(userId) {
    try {
        const projects = await sql`
            SELECT
                p.id,
                p.name,
                p.description,
                p.instructions,
                p.visibility,
                p.created_at as "createdAt",
                p.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pf.id,
                            'name', pf.name,
                            'type', pf.type,
                            'size', pf.size,
                            'createdAt', pf.created_at
                        ) ORDER BY pf.created_at ASC
                    ) FILTER (WHERE pf.id IS NOT NULL),
                    '[]'
                ) as files
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            WHERE p.user_id = ${userId}
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        `;

        return { data: projects, status: 200 };
    } catch (error) {
        console.error('Get projects error:', error);
        return { error: 'Failed to fetch projects', status: 500 };
    }
}

export async function getProjectById(userId, projectId) {
    try {
        const projects = await sql`
            SELECT
                p.id,
                p.name,
                p.description,
                p.instructions,
                p.visibility,
                p.created_at as "createdAt",
                p.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pf.id,
                            'name', pf.name,
                            'type', pf.type,
                            'data', pf.data,
                            'size', pf.size,
                            'createdAt', pf.created_at
                        ) ORDER BY pf.created_at ASC
                    ) FILTER (WHERE pf.id IS NOT NULL),
                    '[]'
                ) as files
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            WHERE p.id = ${projectId} AND p.user_id = ${userId}
            GROUP BY p.id
        `;

        if (projects.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        return { data: projects[0], status: 200 };
    } catch (error) {
        console.error('Get project error:', error);
        return { error: 'Failed to fetch project', status: 500 };
    }
}

export async function createProject(userId, projectData = {}) {
    try {
        const name = projectData.name || 'New Project';
        const description = projectData.description || '';
        const instructions = projectData.instructions || '';
        const visibility = projectData.visibility || 'private';

        const newProject = await sql`
            INSERT INTO projects (user_id, name, description, instructions, visibility)
            VALUES (${userId}, ${name}, ${description}, ${instructions}, ${visibility})
            RETURNING id, name, description, instructions, visibility, created_at as "createdAt", updated_at as "updatedAt"
        `;

        const project = {
            ...newProject[0],
            userId,
            files: [],
        };

        return { data: project, status: 201 };
    } catch (error) {
        console.error('Create project error:', error);
        return { error: 'Failed to create project', status: 500 };
    }
}

export async function updateProject(userId, projectId, updates = {}) {
    try {
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        await sql`
            UPDATE projects
            SET name = COALESCE(${updates.name}, name),
                description = COALESCE(${updates.description}, description),
                instructions = COALESCE(${updates.instructions}, instructions),
                visibility = COALESCE(${updates.visibility}, visibility),
                updated_at = NOW()
            WHERE id = ${projectId}
        `;

        return await getProjectById(userId, projectId);
    } catch (error) {
        console.error('Update project error:', error);
        return { error: 'Failed to update project', status: 500 };
    }
}

export async function deleteProject(userId, projectId) {
    try {
        const result = await sql`
            DELETE FROM projects
            WHERE id = ${projectId} AND user_id = ${userId}
            RETURNING id
        `;

        if (result.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Delete project error:', error);
        return { error: 'Failed to delete project', status: 500 };
    }
}

export async function addProjectFile(userId, projectId, fileData = {}) {
    try {
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        const newFile = await sql`
            INSERT INTO project_files (project_id, name, type, data, size)
            VALUES (${projectId}, ${fileData.name || ''}, ${fileData.type || ''}, ${fileData.data || ''}, ${fileData.size || 0})
            RETURNING id, name, type, size, created_at as "createdAt"
        `;

        await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

        return { data: newFile[0], status: 201 };
    } catch (error) {
        console.error('Add project file error:', error);
        return { error: 'Failed to add file', status: 500 };
    }
}

export async function removeProjectFile(userId, projectId, fileId) {
    try {
        const ownership = await sql`
            SELECT p.id FROM projects p
            JOIN project_files pf ON pf.project_id = p.id
            WHERE p.id = ${projectId} AND p.user_id = ${userId} AND pf.id = ${fileId}
        `;

        if (ownership.length === 0) {
            return { error: 'File not found', status: 404 };
        }

        await sql`DELETE FROM project_files WHERE id = ${fileId}`;
        await sql`UPDATE projects SET updated_at = NOW() WHERE id = ${projectId}`;

        return { data: { success: true }, status: 200 };
    } catch (error) {
        console.error('Remove project file error:', error);
        return { error: 'Failed to remove file', status: 500 };
    }
}

export async function getProjectChats(userId, projectId) {
    try {
        const ownership = await sql`
            SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId}
        `;

        if (ownership.length === 0) {
            return { error: 'Project not found', status: 404 };
        }

        const chats = await sql`
            SELECT
                c.id,
                c.title,
                c.project_id as "projectId",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                ${userId} as "userId",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', m.id,
                            'role', m.role,
                            'content', m.content,
                            'model', m.model,
                            'stats', m.stats,
                            'generatedImages', m.generated_images,
                            'createdAt', m.created_at
                        ) ORDER BY m.created_at ASC
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'
                ) as messages
            FROM chats c
            LEFT JOIN messages m ON m.chat_id = c.id
            WHERE c.user_id = ${userId} AND c.project_id = ${projectId}
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        `;

        return { data: chats, status: 200 };
    } catch (error) {
        console.error('Get project chats error:', error);
        return { error: 'Failed to fetch project chats', status: 500 };
    }
}
