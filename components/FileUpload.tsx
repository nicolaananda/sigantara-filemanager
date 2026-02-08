'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '@/lib/api';

interface FileUploadProps {
    onUploadComplete: () => void;
}

interface UploadingFile {
    id: string;
    file: File;
    progress: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const uploadFile = async (file: File, uploadId: string) => {
        const updateProgress = (progress: number, status: UploadingFile['status'], error?: string) => {
            setUploadingFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadId ? { ...f, progress, status, error } : f
                )
            );
        };

        try {
            // Step 1: Get presigned URL
            updateProgress(10, 'uploading');
            const { uploadUrl, fileId, tempPath } = await apiService.getPresignUrl(
                file.name,
                file.type
            );

            // Step 2: Upload to R2
            updateProgress(30, 'uploading');
            await apiService.uploadToR2(uploadUrl, file);

            // Step 3: Finalize upload
            updateProgress(70, 'uploading');
            await apiService.finalizeUpload({
                fileId,
                tempPath,
                filename: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
            });

            updateProgress(100, 'success');
            onUploadComplete();

            // Remove from list after 3 seconds
            setTimeout(() => {
                setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
            }, 3000);
        } catch (err: any) {
            updateProgress(0, 'error', err.message || 'Upload failed');
        }
    };

    const handleFiles = async (files: File[]) => {
        const newFiles: UploadingFile[] = files.map((file) => ({
            id: `${Date.now()}-${Math.random()}`,
            file,
            progress: 0,
            status: 'uploading' as const,
        }));

        setUploadingFiles((prev) => [...prev, ...newFiles]);

        // Upload all files in parallel
        await Promise.all(
            newFiles.map((uploadingFile) =>
                uploadFile(uploadingFile.file, uploadingFile.id)
            )
        );
    };

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                await handleFiles(files);
            }
        },
        []
    );

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await handleFiles(Array.from(files));
            // Reset input so same file can be selected again
            e.target.value = '';
        }
    };

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-4">Upload Files</h2>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'}
          cursor-pointer
        `}
            >
                <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="pointer-events-none">
                    <motion.div
                        animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <svg
                            className="mx-auto h-16 w-16 text-zinc-400 mb-4"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                        >
                            <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </motion.div>

                    <p className="text-lg font-medium text-zinc-300 mb-2">
                        Drop files here or click to browse
                    </p>
                    <p className="text-sm text-zinc-500">
                        Multiple files supported • Images will be converted to WebP
                    </p>
                </div>
            </div>

            {/* Uploading files list */}
            <AnimatePresence>
                {uploadingFiles.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 space-y-3"
                    >
                        {uploadingFiles.map((uploadingFile) => (
                            <motion.div
                                key={uploadingFile.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={`
                  p-4 rounded-lg border
                  ${uploadingFile.status === 'success'
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : uploadingFile.status === 'error'
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-zinc-800/50 border-zinc-700'
                                    }
                `}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {/* Icon */}
                                        <div className="flex-shrink-0">
                                            {uploadingFile.status === 'success' ? (
                                                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            ) : uploadingFile.status === 'error' ? (
                                                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                        </div>

                                        {/* Filename */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate">
                                                {uploadingFile.file.name}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>

                                        {/* Progress percentage */}
                                        {uploadingFile.status === 'uploading' && (
                                            <span className="text-sm text-zinc-400 flex-shrink-0">
                                                {uploadingFile.progress}%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                {uploadingFile.status === 'uploading' && (
                                    <div className="bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${uploadingFile.progress}%` }}
                                            transition={{ duration: 0.3 }}
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                                        />
                                    </div>
                                )}

                                {/* Error message */}
                                {uploadingFile.status === 'error' && uploadingFile.error && (
                                    <p className="text-xs text-red-400 mt-1">{uploadingFile.error}</p>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
