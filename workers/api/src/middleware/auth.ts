import { SignJWT, jwtVerify } from 'jose';
import type { Context } from 'hono';
import type { Env } from '../db';

export interface JWTPayload {
    userId: number;
    username: string;
    role: 'admin' | 'tim';
    teamId: number | null;
}

export async function generateToken(env: Env, payload: JWTPayload): Promise<string> {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

    return token;
}

export async function verifyToken(env: Env, token: string): Promise<JWTPayload | null> {
    try {
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as JWTPayload;
    } catch (error) {
        return null;
    }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(c.env, token);

    if (!payload) {
        return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('user', payload);
    await next();
}

export function requireRole(role: 'admin' | 'tim') {
    return async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
        const user = c.get('user') as JWTPayload;

        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        if (role === 'admin' && user.role !== 'admin') {
            return c.json({ error: 'Forbidden: Admin access required' }, 403);
        }

        await next();
    };
}
