import { serve } from '@hono/node-server';
import app from './index';
import postgres from 'postgres';
import { S3Client } from '@aws-sdk/client-s3';
import { createClient } from 'redis';

// Environment variables
const PORT = parseInt(process.env.PORT || '8787');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/sigantara';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://minio:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'http://localhost:9000/sigantara-files';

// Create S3 client (MinIO) - for internal operations
const s3Client = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
});

// Create S3 client for presigned URLs - using localhost so browser can access
const s3ClientForPresign = new S3Client({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
});

// Create Redis client for queue simulation
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379',
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Mock R2 Bucket interface using S3
class MockR2Bucket {
    private bucketName = 'sigantara-files';

    async put(key: string, value: ArrayBuffer | Buffer, options?: any) {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);

        await s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: options?.httpMetadata?.contentType,
        }));

        return { key };
    }

    async get(key: string) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');

        try {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }));

            const chunks: Uint8Array[] = [];
            for await (const chunk of response.Body as any) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            return {
                arrayBuffer: async () => buffer.buffer,
            };
        } catch (error) {
            return null;
        }
    }

    async delete(key: string) {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

        await s3Client.send(new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        }));
    }

    async createPresignedUrl(key: string, options: any) {
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        // Use s3ClientForPresign so URL uses localhost:9000 instead of minio:9000
        const url = await getSignedUrl(s3ClientForPresign, command, {
            expiresIn: options.expiresIn || 3600,
        });

        return url;
    }

    async createMultipartUpload(key: string) {
        // For simplicity, return a mock upload ID
        return { uploadId: 'mock-upload-id', key };
    }
}

// Mock Queue interface using Redis
class MockQueue {
    private queueName = 'file-processing-queue';

    async send(message: any) {
        await redisClient.lPush(this.queueName, JSON.stringify(message));
        console.log('Message queued:', message);
    }
}

// Create mock environment
const mockEnv = {
    R2_BUCKET: new MockR2Bucket(),
    FILE_QUEUE: new MockQueue(),
    DATABASE_URL,
    JWT_SECRET,
    R2_PUBLIC_URL,
};

// Start server
async function startServer() {
    await redisClient.connect();
    console.log('Connected to Redis');

    serve({
        fetch: (request: Request) => {
            // Add mock env to request context
            return app.fetch(request, mockEnv);
        },
        port: PORT,
    });

    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${DATABASE_URL}`);
    console.log(`📦 MinIO: ${MINIO_ENDPOINT}`);
    console.log(`🔴 Redis: redis://redis:6379`);
}

startServer().catch(console.error);
