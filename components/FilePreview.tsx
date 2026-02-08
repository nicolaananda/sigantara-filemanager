'use client';

import { motion } from 'framer-motion';
import type { FileData } from '@/lib/api';

interface FilePreviewProps {
    file: FileData;
    onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
    const isImage = file.mime_type.startsWith('image/');
    const isPDF = file.mime_type === 'application/pdf';
    const isArchive = file.mime_type === 'application/zip' || file.mime_type === 'application/x-rar-compressed';

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div>
                        <h2 className="text-xl font-bold text-white">{file.filename}</h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            {file.mime_type} • {formatBytes(file.size_bytes)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
                    {isImage && file.direct_link && (
                        <div className="flex justify-center">
                            <img
                                src={file.direct_link}
                                alt={file.filename}
                                className="max-w-full h-auto rounded-lg shadow-2xl"
                            />
                        </div>
                    )}

                    {isPDF && file.direct_link && (
                        <div className="w-full h-[600px]">
                            <iframe
                                src={file.direct_link}
                                className="w-full h-full rounded-lg border border-zinc-800"
                                title={file.filename}
                            />
                        </div>
                    )}

                    {isArchive && (
                        <div className="text-center py-12">
                            <svg
                                className="mx-auto h-20 w-20 text-zinc-600 mb-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                            </svg>
                            <h3 className="text-lg font-semibold text-white mb-2">Archive File</h3>
                            <div className="space-y-2 text-sm text-zinc-400">
                                <p><span className="text-zinc-500">Filename:</span> {file.filename}</p>
                                <p><span className="text-zinc-500">Size:</span> {formatBytes(file.size_bytes)}</p>
                                <p><span className="text-zinc-500">Type:</span> {file.mime_type}</p>
                                {file.created_at && (
                                    <p><span className="text-zinc-500">Created:</span> {new Date(file.created_at).toLocaleString()}</p>
                                )}
                            </div>
                            {file.direct_link && (
                                <a
                                    href={file.direct_link}
                                    download
                                    className="inline-block mt-6 btn btn-primary"
                                >
                                    Download Archive
                                </a>
                            )}
                        </div>
                    )}

                    {!isImage && !isPDF && !isArchive && file.direct_link && (
                        <div className="text-center py-12">
                            <svg
                                className="mx-auto h-20 w-20 text-zinc-600 mb-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <h3 className="text-lg font-semibold text-white mb-2">File Preview Not Available</h3>
                            <p className="text-zinc-400 mb-6">This file type cannot be previewed in the browser</p>
                            <a
                                href={file.direct_link}
                                download
                                className="btn btn-primary"
                            >
                                Download File
                            </a>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
