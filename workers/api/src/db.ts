import postgres from 'postgres';

export interface Env {
    R2_BUCKET: R2Bucket;
    FILE_QUEUE: Queue;
    DATABASE_URL: string;
    JWT_SECRET: string;
    R2_PUBLIC_URL: string;
}

let sqlInstance: ReturnType<typeof postgres> | null = null;

export function getDb(env: Env) {
    if (!sqlInstance) {
        sqlInstance = postgres(env.DATABASE_URL, {
            max: 1, // Cloudflare Workers limitation
            idle_timeout: 20,
            connect_timeout: 10,
        });
    }
    return sqlInstance;
}

export async function query<T = any>(
    env: Env,
    queryText: string,
    params: any[] = []
): Promise<T[]> {
    const sql = getDb(env);
    return sql.unsafe(queryText, params) as Promise<T[]>;
}
