import postgres from 'postgres';
import { processImage } from './processors/image';
import { processPDF } from './processors/pdf';
import { processArchive } from './processors/archive';

interface Env {
    R2_BUCKET: R2Bucket;
    DATABASE_URL: string;
    R2_PUBLIC_URL: string;
}

interface JobPayload {
    fileId: number;
    teamId: number;
    tempPath: string;
    mimeType: string;
    filename: string;
}

let sqlInstance: ReturnType<typeof postgres> | null = null;

function getDb(env: Env) {
    if (!sqlInstance) {
        sqlInstance = postgres(env.DATABASE_URL, {
            max: 1,
            idle_timeout: 20,
            connect_timeout: 10,
        });
    }
    return sqlInstance;
}

async function query<T = any>(env: Env, queryText: string, params: any[] = []): Promise<T[]> {
    const sql = getDb(env);
    return sql.unsafe(queryText, params) as Promise<T[]>;
}

async function logProcessing(env: Env, fileId: number, attempt: number, status: string, errorMessage?: string) {
    await query(
        env,
        'INSERT INTO processing_logs (file_id, attempt, status, error_message) VALUES ($1, $2, $3, $4)',
        [fileId, attempt, status, errorMessage || null]
    );
}

async function updateFileStatus(
    env: Env,
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

    await query(env, `UPDATE files SET ${updates.join(', ')} WHERE id = $1`, params);
}

async function processFile(env: Env, payload: JobPayload, attempt: number): Promise<void> {
    const { fileId, teamId, tempPath, mimeType, filename } = payload;

    console.log(`Processing file ${fileId}, attempt ${attempt}`);

    try {
        // Update status to PROCESSING
        await updateFileStatus(env, fileId, 'PROCESSING');
        await logProcessing(env, fileId, attempt, 'PROCESSING');

        // Download file from temp path
        const tempObject = await env.R2_BUCKET.get(tempPath);
        if (!tempObject) {
            throw new Error(`File not found in temp path: ${tempPath}`);
        }

        const tempBuffer = await tempObject.arrayBuffer();
        let processedBuffer: Buffer | null = null;
        let processedExtension: string | null = null;

        // Process based on mime type
        if (mimeType.startsWith('image/')) {
            console.log('Processing image...');
            const result = await processImage(tempBuffer);
            processedBuffer = result.buffer;
            processedExtension = result.extension;
        } else if (mimeType === 'application/pdf') {
            console.log('Processing PDF...');
            const result = await processPDF(tempBuffer);
            if (result) {
                processedBuffer = result.buffer;
                processedExtension = result.extension;
            }
        } else if (mimeType === 'application/zip' || mimeType === 'application/x-rar-compressed') {
            console.log('Processing archive...');
            const result = await processArchive(tempBuffer);
            if (result) {
                processedBuffer = result.buffer;
                processedExtension = result.extension;
            }
        } else {
            console.log('No processing needed for this file type');
        }

        // Determine final filename and path
        let finalFilename = filename;
        if (processedBuffer && processedExtension) {
            // Replace extension with processed extension
            const nameParts = filename.split('.');
            nameParts[nameParts.length - 1] = processedExtension;
            finalFilename = nameParts.join('.');
        }

        const finalPath = `files/${teamId}/${fileId}/${finalFilename}`;

        // Upload to final path
        const uploadBuffer = processedBuffer || Buffer.from(tempBuffer);
        await env.R2_BUCKET.put(finalPath, uploadBuffer, {
            httpMetadata: {
                contentType: processedBuffer ? `image/${processedExtension}` : mimeType,
            },
        });

        // Generate permanent direct link
        const directLink = `${env.R2_PUBLIC_URL}/${finalPath}`;

        // Update database
        await updateFileStatus(env, fileId, 'DONE', finalPath, directLink, uploadBuffer.length);
        await logProcessing(env, fileId, attempt, 'DONE');

        // Clean up temp file
        await env.R2_BUCKET.delete(tempPath);

        console.log(`File ${fileId} processed successfully`);
    } catch (error: any) {
        console.error(`Error processing file ${fileId}:`, error);

        // Log error
        await logProcessing(env, fileId, attempt, 'FAILED', error.message);

        // If this is the last attempt, mark as FAILED
        if (attempt >= 3) {
            await updateFileStatus(env, fileId, 'FAILED');
            console.log(`File ${fileId} marked as FAILED after ${attempt} attempts`);
        } else {
            console.log(`File ${fileId} will be retried (attempt ${attempt}/3)`);
        }

        throw error; // Re-throw to trigger retry
    }
}

export default {
    async queue(batch: MessageBatch<JobPayload>, env: Env): Promise<void> {
        for (const message of batch.messages) {
            try {
                await processFile(env, message.body, message.attempts);
                message.ack();
            } catch (error) {
                console.error('Queue processing error:', error);
                // Message will be retried automatically by Cloudflare Queues
                if (message.attempts >= 3) {
                    message.ack(); // Acknowledge to prevent infinite retries
                } else {
                    message.retry(); // Retry with exponential backoff
                }
            }
        }
    },
};
