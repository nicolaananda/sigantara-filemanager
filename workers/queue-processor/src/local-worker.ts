import { createClient } from 'redis';
import postgres from 'postgres';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { processImage } from './processors/image.js';

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/sigantara';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://minio:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'http://localhost:9000/sigantara-files';
const QUEUE_NAME = 'file-processing-queue';

// Create clients
const sql = postgres(DATABASE_URL);
const redisClient = createClient({ url: REDIS_URL });
const s3Client = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1',
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
});

interface JobPayload {
    fileId: number;
    teamId: number;
    tempPath: string;
    mimeType: string;
    filename: string;
}

async function updateFileStatus(
    fileId: number,
    status: string,
    finalPath?: string,
    directLink?: string,
    processedSize?: number
) {
    const updates: string[] = ['status = $2'];
    const params: any[] = [fileId, status];
    let paramIndex = 3;

    if (finalPath) {
        updates.push(`final_path = $${paramIndex}`);
        params.push(finalPath);
        paramIndex++;
    }

    if (directLink) {
        updates.push(`direct_link = $${paramIndex}`);
        params.push(directLink);
        paramIndex++;
    }

    if (processedSize) {
        updates.push(`processed_size_bytes = $${paramIndex}`);
        params.push(processedSize);
        paramIndex++;
    }

    await sql.unsafe(`UPDATE files SET ${updates.join(', ')} WHERE id = $1`, params);
}

async function processFile(payload: JobPayload, attempt: number = 1): Promise<void> {
    const { fileId, teamId, tempPath, mimeType, filename } = payload;

    console.log(`[Worker] Processing file ${fileId}, attempt ${attempt}`);

    try {
        // Update status to PROCESSING
        await updateFileStatus(fileId, 'PROCESSING');

        // Download file from MinIO temp path
        const getCommand = new GetObjectCommand({
            Bucket: 'sigantara-files',
            Key: tempPath,
        });

        const response = await s3Client.send(getCommand);
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.Body as any) {
            chunks.push(chunk);
        }
        const tempBuffer = Buffer.concat(chunks);

        let processedBuffer: Buffer | null = null;
        let processedExtension: string | null = null;

        // Process based on mime type
        if (mimeType.startsWith('image/')) {
            console.log(`[Worker] Processing image...`);
            const result = await processImage(tempBuffer.buffer);
            processedBuffer = result.buffer;
            processedExtension = result.extension;
        } else {
            console.log(`[Worker] No processing needed for ${mimeType}`);
        }

        // Determine final filename and path
        let finalFilename = filename;
        if (processedBuffer && processedExtension) {
            const nameParts = filename.split('.');
            nameParts[nameParts.length - 1] = processedExtension;
            finalFilename = nameParts.join('.');
        }

        const finalPath = `files/${teamId}/${fileId}/${finalFilename}`;

        // Upload to final path
        const uploadBuffer = processedBuffer || tempBuffer;
        const putCommand = new PutObjectCommand({
            Bucket: 'sigantara-files',
            Key: finalPath,
            Body: uploadBuffer,
            ContentType: processedBuffer ? `image/${processedExtension}` : mimeType,
        });

        await s3Client.send(putCommand);

        // Generate permanent direct link
        const directLink = `${R2_PUBLIC_URL}/${finalPath}`;

        // Update database
        await updateFileStatus(fileId, 'DONE', finalPath, directLink, uploadBuffer.length);

        // Clean up temp file
        const deleteCommand = new DeleteObjectCommand({
            Bucket: 'sigantara-files',
            Key: tempPath,
        });
        await s3Client.send(deleteCommand);

        console.log(`[Worker] File ${fileId} processed successfully`);
    } catch (error: any) {
        console.error(`[Worker] Error processing file ${fileId}:`, error);

        // If this is the last attempt, mark as FAILED
        if (attempt >= 3) {
            await updateFileStatus(fileId, 'FAILED');
            console.log(`[Worker] File ${fileId} marked as FAILED after ${attempt} attempts`);
        } else {
            console.log(`[Worker] File ${fileId} will be retried (attempt ${attempt}/3)`);
            // Re-queue with delay
            setTimeout(() => {
                redisClient.lPush(QUEUE_NAME, JSON.stringify({ ...payload, attempt: attempt + 1 }));
            }, Math.pow(2, attempt) * 1000); // Exponential backoff
        }
    }
}

async function startWorker() {
    await redisClient.connect();
    console.log('[Worker] Connected to Redis');
    console.log('[Worker] Waiting for jobs...');

    // Poll queue
    while (true) {
        try {
            const message = await redisClient.rPop(QUEUE_NAME);

            if (message) {
                const payload: JobPayload & { attempt?: number } = JSON.parse(message);
                await processFile(payload, payload.attempt || 1);
            } else {
                // Wait a bit before next poll
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('[Worker] Error:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

startWorker().catch(console.error);
