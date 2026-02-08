import sharp from 'sharp';

export async function processImage(buffer: ArrayBuffer): Promise<{ buffer: Buffer; extension: string }> {
    try {
        const inputBuffer = Buffer.from(buffer);

        // Convert to WebP with quality 80, max width 2560px
        const processedBuffer = await sharp(inputBuffer)
            .resize(2560, null, {
                withoutEnlargement: true,
                fit: 'inside',
            })
            .webp({ quality: 80 })
            .toBuffer();

        return {
            buffer: processedBuffer,
            extension: 'webp',
        };
    } catch (error) {
        console.error('Image processing error:', error);
        throw error;
    }
}
