import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './db';
import { query } from './db';
import { authMiddleware, generateToken, type JWTPayload } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
    return c.json({ status: 'ok', service: 'Sigantara File Manager API' });
});

// POST /auth/login - Authenticate user
app.post('/auth/login', async (c) => {
    try {
        const { username, password } = await c.req.json();

        if (!username || !password) {
            return c.json({ error: 'Username and password required' }, 400);
        }

        // Query user from database
        const users = await query<any>(
            c.env,
            'SELECT id, username, password, role, team_id FROM users WHERE username = $1',
            [username]
        );

        if (users.length === 0 || users[0].password !== password) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }

        const user = users[0];

        // Generate JWT token
        const token = await generateToken(c.env, {
            userId: user.id,
            username: user.username,
            role: user.role,
            teamId: user.team_id,
        });

        return c.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                teamId: user.team_id,
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// POST /files/presign - Generate presigned URL for upload
app.post('/files/presign', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;
        const { filename, mimeType } = await c.req.json();

        if (!filename || !mimeType) {
            return c.json({ error: 'Filename and mimeType required' }, 400);
        }

        // Generate unique file ID
        const fileId = crypto.randomUUID();
        const teamId = user.teamId || 1; // Default to team 1 for admin

        // Create temp path
        const tempPath = `temp/${teamId}/${fileId}/${filename}`;

        // Generate presigned URL for upload
        const presignedUrl = await c.env.R2_BUCKET.createMultipartUpload(tempPath);

        // For simplicity, we'll use a direct PUT URL
        // In production, you might want to use multipart upload for large files
        const url = await c.env.R2_BUCKET.createPresignedUrl(tempPath, {
            method: 'PUT',
            expiresIn: 3600, // 1 hour
        });

        return c.json({
            uploadUrl: url,
            fileId,
            tempPath,
        });
    } catch (error: any) {
        console.error('Presign error:', error);
        return c.json({ error: 'Failed to generate presigned URL' }, 500);
    }
});

// POST /files/finalize - Finalize upload and enqueue processing
app.post('/files/finalize', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;
        const { fileId, tempPath, filename, mimeType, sizeBytes } = await c.req.json();

        if (!fileId || !tempPath || !filename || !mimeType || !sizeBytes) {
            return c.json({ error: 'Missing required fields' }, 400);
        }

        const teamId = user.teamId || 1;

        // Create file record in database
        const result = await query<any>(
            c.env,
            `INSERT INTO files (team_id, user_id, filename, original_filename, original_path, mime_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
            [teamId, user.userId, filename, filename, tempPath, mimeType, sizeBytes, 'UPLOADED']
        );

        const dbFileId = result[0].id;

        // Enqueue processing job
        await c.env.FILE_QUEUE.send({
            fileId: dbFileId,
            teamId,
            tempPath,
            mimeType,
            filename,
        });

        return c.json({
            success: true,
            fileId: dbFileId,
            status: 'UPLOADED',
            message: 'File uploaded and queued for processing',
        });
    } catch (error: any) {
        console.error('Finalize error:', error);
        return c.json({ error: 'Failed to finalize upload' }, 500);
    }
});

// GET /files - List files
app.get('/files', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;

        let files;
        if (user.role === 'admin') {
            // Admin can see all files
            files = await query<any>(
                c.env,
                `SELECT f.*, t.name as team_name, u.username 
         FROM files f
         JOIN teams t ON f.team_id = t.id
         JOIN users u ON f.user_id = u.id
         ORDER BY f.created_at DESC
         LIMIT 100`
            );
        } else {
            // Tim can only see their team's files
            files = await query<any>(
                c.env,
                `SELECT f.*, t.name as team_name, u.username 
         FROM files f
         JOIN teams t ON f.team_id = t.id
         JOIN users u ON f.user_id = u.id
         WHERE f.team_id = $1
         ORDER BY f.created_at DESC
         LIMIT 100`,
                [user.teamId]
            );
        }

        return c.json({ files });
    } catch (error: any) {
        console.error('List files error:', error);
        return c.json({ error: 'Failed to fetch files' }, 500);
    }
});

// GET /files/:id - Get single file
app.get('/files/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;
        const fileId = c.req.param('id');

        const files = await query<any>(
            c.env,
            `SELECT f.*, t.name as team_name, u.username 
       FROM files f
       JOIN teams t ON f.team_id = t.id
       JOIN users u ON f.user_id = u.id
       WHERE f.id = $1`,
            [fileId]
        );

        if (files.length === 0) {
            return c.json({ error: 'File not found' }, 404);
        }

        const file = files[0];

        // Check permissions
        if (user.role !== 'admin' && file.team_id !== user.teamId) {
            return c.json({ error: 'Forbidden' }, 403);
        }

        return c.json({ file });
    } catch (error: any) {
        console.error('Get file error:', error);
        return c.json({ error: 'Failed to fetch file' }, 500);
    }
});

// DELETE /files/:id - Delete file
app.delete('/files/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;
        const fileId = c.req.param('id');

        // Get file info
        const files = await query<any>(
            c.env,
            'SELECT * FROM files WHERE id = $1',
            [fileId]
        );

        if (files.length === 0) {
            return c.json({ error: 'File not found' }, 404);
        }

        const file = files[0];

        // Check permissions
        // Admin can delete any file
        // Team member can only delete their own files
        if (user.role !== 'admin' && file.user_id !== user.userId) {
            return c.json({ error: 'Forbidden - You can only delete your own files' }, 403);
        }

        // Delete from R2
        if (file.final_path) {
            await c.env.R2_BUCKET.delete(file.final_path);
        }
        if (file.original_path) {
            await c.env.R2_BUCKET.delete(file.original_path);
        }

        // Delete from database (cascade will delete processing_logs)
        await query(c.env, 'DELETE FROM files WHERE id = $1', [fileId]);

        return c.json({ success: true, message: 'File deleted' });
    } catch (error: any) {
        console.error('Delete file error:', error);
        return c.json({ error: 'Failed to delete file' }, 500);
    }
});

// ========== USER MANAGEMENT (Admin Only) ==========

// GET /users - List all users (admin only)
app.get('/users', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;

        if (user.role !== 'admin') {
            return c.json({ error: 'Forbidden - Admin only' }, 403);
        }

        const users = await query<any>(
            c.env,
            `SELECT u.id, u.username, u.role, u.team_id, t.name as team_name, u.created_at
       FROM users u
       LEFT JOIN teams t ON u.team_id = t.id
       ORDER BY u.created_at DESC`
        );

        return c.json({ users });
    } catch (error: any) {
        console.error('List users error:', error);
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});

// POST /users - Create new user (admin only)
app.post('/users', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;

        if (user.role !== 'admin') {
            return c.json({ error: 'Forbidden - Admin only' }, 403);
        }

        const { username, password, role, teamId } = await c.req.json();

        if (!username || !password || !role) {
            return c.json({ error: 'Username, password, and role required' }, 400);
        }

        if (role !== 'admin' && role !== 'tim') {
            return c.json({ error: 'Role must be either "admin" or "tim"' }, 400);
        }

        // Check if username already exists
        const existing = await query<any>(
            c.env,
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existing.length > 0) {
            return c.json({ error: 'Username already exists' }, 400);
        }

        // Create user
        const result = await query<any>(
            c.env,
            `INSERT INTO users (username, password, role, team_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, team_id, created_at`,
            [username, password, role, teamId || null]
        );

        return c.json({ user: result[0] });
    } catch (error: any) {
        console.error('Create user error:', error);
        return c.json({ error: 'Failed to create user' }, 500);
    }
});

// PUT /users/:id - Update user (admin only)
app.put('/users/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;

        if (user.role !== 'admin') {
            return c.json({ error: 'Forbidden - Admin only' }, 403);
        }

        const userId = c.req.param('id');
        const { username, password, role, teamId } = await c.req.json();

        if (!username || !role) {
            return c.json({ error: 'Username and role required' }, 400);
        }

        if (role !== 'admin' && role !== 'tim') {
            return c.json({ error: 'Role must be either "admin" or "tim"' }, 400);
        }

        // Check if user exists
        const existing = await query<any>(
            c.env,
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );

        if (existing.length === 0) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Update user (with or without password)
        let result;
        if (password) {
            result = await query<any>(
                c.env,
                `UPDATE users 
         SET username = $1, password = $2, role = $3, team_id = $4
         WHERE id = $5
         RETURNING id, username, role, team_id, created_at`,
                [username, password, role, teamId || null, userId]
            );
        } else {
            result = await query<any>(
                c.env,
                `UPDATE users 
         SET username = $1, role = $2, team_id = $3
         WHERE id = $4
         RETURNING id, username, role, team_id, created_at`,
                [username, role, teamId || null, userId]
            );
        }

        return c.json({ user: result[0] });
    } catch (error: any) {
        console.error('Update user error:', error);
        return c.json({ error: 'Failed to update user' }, 500);
    }
});

// DELETE /users/:id - Delete user (admin only)
app.delete('/users/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user') as JWTPayload;

        if (user.role !== 'admin') {
            return c.json({ error: 'Forbidden - Admin only' }, 403);
        }

        const userId = c.req.param('id');

        // Prevent deleting yourself
        if (parseInt(userId) === user.userId) {
            return c.json({ error: 'Cannot delete your own account' }, 400);
        }

        // Check if user exists
        const existing = await query<any>(
            c.env,
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );

        if (existing.length === 0) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Delete user (cascade will handle files)
        await query(c.env, 'DELETE FROM users WHERE id = $1', [userId]);

        return c.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
        console.error('Delete user error:', error);
        return c.json({ error: 'Failed to delete user' }, 500);
    }
});

// GET /teams - List all teams
app.get('/teams', authMiddleware, async (c) => {
    try {
        const teams = await query<any>(
            c.env,
            'SELECT id, name, created_at FROM teams ORDER BY name'
        );

        return c.json({ teams });
    } catch (error: any) {
        console.error('List teams error:', error);
        return c.json({ error: 'Failed to fetch teams' }, 500);
    }
});

// POST /teams - Create new team (Admin only)
app.post('/teams', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'admin') {
            return c.json({ error: 'Admin access required' }, 403);
        }

        const { name } = await c.req.json();

        if (!name || !name.trim()) {
            return c.json({ error: 'Team name is required' }, 400);
        }

        // Check if team name already exists
        const existing = await query<any>(
            c.env,
            'SELECT id FROM teams WHERE name = $1',
            [name.trim()]
        );

        if (existing.length > 0) {
            return c.json({ error: 'Team name already exists' }, 400);
        }

        // Create team
        const result = await query<any>(
            c.env,
            'INSERT INTO teams (name) VALUES ($1) RETURNING id, name, created_at',
            [name.trim()]
        );

        return c.json({ team: result[0] }, 201);
    } catch (error: any) {
        console.error('Create team error:', error);
        return c.json({ error: 'Failed to create team' }, 500);
    }
});

// PUT /teams/:id - Update team (Admin only)
app.put('/teams/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'admin') {
            return c.json({ error: 'Admin access required' }, 403);
        }

        const teamId = parseInt(c.req.param('id'));
        const { name } = await c.req.json();

        if (!name || !name.trim()) {
            return c.json({ error: 'Team name is required' }, 400);
        }

        // Check if team exists
        const existing = await query<any>(
            c.env,
            'SELECT id FROM teams WHERE id = $1',
            [teamId]
        );

        if (existing.length === 0) {
            return c.json({ error: 'Team not found' }, 404);
        }

        // Check if new name conflicts with another team
        const nameConflict = await query<any>(
            c.env,
            'SELECT id FROM teams WHERE name = $1 AND id != $2',
            [name.trim(), teamId]
        );

        if (nameConflict.length > 0) {
            return c.json({ error: 'Team name already exists' }, 400);
        }

        // Update team
        const result = await query<any>(
            c.env,
            'UPDATE teams SET name = $1 WHERE id = $2 RETURNING id, name, created_at',
            [name.trim(), teamId]
        );

        return c.json({ team: result[0] });
    } catch (error: any) {
        console.error('Update team error:', error);
        return c.json({ error: 'Failed to update team' }, 500);
    }
});

// DELETE /teams/:id - Delete team (Admin only)
app.delete('/teams/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        if (user.role !== 'admin') {
            return c.json({ error: 'Admin access required' }, 403);
        }

        const teamId = parseInt(c.req.param('id'));

        // Check if team exists
        const team = await query<any>(
            c.env,
            'SELECT id FROM teams WHERE id = $1',
            [teamId]
        );

        if (team.length === 0) {
            return c.json({ error: 'Team not found' }, 404);
        }

        // Check if team has users
        const users = await query<any>(
            c.env,
            'SELECT id FROM users WHERE team_id = $1',
            [teamId]
        );

        if (users.length > 0) {
            return c.json({
                error: `Cannot delete team with ${users.length} member(s). Please reassign or remove users first.`
            }, 400);
        }

        // Check if team has files
        const files = await query<any>(
            c.env,
            'SELECT id FROM files WHERE team_id = $1',
            [teamId]
        );

        if (files.length > 0) {
            return c.json({
                error: `Cannot delete team with ${files.length} file(s). Please delete files first.`
            }, 400);
        }

        // Delete team
        await query<any>(
            c.env,
            'DELETE FROM teams WHERE id = $1',
            [teamId]
        );

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Delete team error:', error);
        return c.json({ error: 'Failed to delete team' }, 500);
    }
});

export default app;
