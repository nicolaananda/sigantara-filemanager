'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService, type FileData } from '@/lib/api';
import { authService } from '@/lib/auth';
import FilePreview from './FilePreview';
import toast from 'react-hot-toast';

interface FileListProps {
    files: FileData[];
    onFileDeleted: () => void;
    currentUserId?: number;
    currentUserRole?: string;
}

export default function FileList({ files, onFileDeleted, currentUserId, currentUserRole }: FileListProps) {
    const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Check if user can delete a file
    const canDeleteFile = (file: FileData) => {
        // Admin can delete any file
        if (currentUserRole === 'admin') return true;
        // Team member can only delete their own files
        return file.user_id === currentUserId;
    };

    const handleDelete = async (file: FileData) => {
        if (!canDeleteFile(file)) {
            toast.error('You do not have permission to delete this file');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) {
            return;
        }

        setDeleting(file.id);
        try {
            await apiService.deleteFile(file.id);
            toast.success(`Deleted ${file.filename}`);
            onFileDeleted();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete file');
        } finally {
            setDeleting(null);
        }
    };

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        // Show toast instead of alert
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.textContent = 'Link copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    // Filter and search files
    const filteredFiles = useMemo(() => {
        return files.filter((file) => {
            const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || file.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [files, searchQuery, statusFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
    const paginatedFiles = filteredFiles.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset to page 1 when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { class: string; label: string }> = {
            PENDING_UPLOAD: { class: 'badge badge-pending', label: 'Pending' },
            UPLOADED: { class: 'badge badge-pending', label: 'Uploaded' },
            PROCESSING: { class: 'badge badge-processing', label: 'Processing' },
            DONE: { class: 'badge badge-done', label: 'Done' },
            FAILED: { class: 'badge badge-failed', label: 'Failed' },
        };
        return badges[status] || { class: 'badge', label: status };
    };

    if (files.length === 0) {
        return (
            <div className="card text-center py-12">
                <svg
                    className="mx-auto h-16 w-16 text-zinc-600 mb-4"
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
                <p className="text-zinc-400 text-lg">No files yet</p>
                <p className="text-zinc-500 text-sm mt-2">Upload your first file to get started</p>
            </div>
        );
    }

    return (
        <>
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Files</h2>
                    <div className="text-sm text-zinc-400">
                        {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Status</option>
                        <option value="DONE">Done</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="FAILED">Failed</option>
                    </select>
                </div>

                {/* File List */}
                <div className="space-y-3">
                    <AnimatePresence>
                        {paginatedFiles.map((file) => {
                            const statusBadge = getStatusBadge(file.status);
                            const canDelete = canDeleteFile(file);

                            return (
                                <motion.div
                                    key={file.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-white truncate">{file.filename}</h3>
                                                <span className={statusBadge.class}>{statusBadge.label}</span>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-zinc-400">
                                                <div>
                                                    <span className="text-zinc-500">Size:</span> {formatBytes(file.size_bytes)}
                                                </div>
                                                {file.processed_size_bytes && (
                                                    <div>
                                                        <span className="text-zinc-500">Processed:</span>{' '}
                                                        {formatBytes(file.processed_size_bytes)}
                                                    </div>
                                                )}
                                                {file.team_name && (
                                                    <div>
                                                        <span className="text-zinc-500">Team:</span> {file.team_name}
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-zinc-500">Uploaded:</span> {formatDate(file.created_at)}
                                                </div>
                                            </div>

                                            {file.direct_link && (
                                                <div className="mt-3 flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={file.direct_link}
                                                        readOnly
                                                        className="flex-1 px-3 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-300"
                                                    />
                                                    <button
                                                        onClick={() => copyLink(file.direct_link!)}
                                                        className="btn btn-secondary text-sm"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {file.status === 'DONE' && (
                                                <button
                                                    onClick={() => setSelectedFile(file)}
                                                    className="btn btn-secondary text-sm"
                                                >
                                                    Preview
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(file)}
                                                disabled={deleting === file.id || !canDelete}
                                                className="btn btn-danger text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={!canDelete ? 'You can only delete your own files' : ''}
                                            >
                                                {deleting === file.id ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-zinc-400">
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedFile && <FilePreview file={selectedFile} onClose={() => setSelectedFile(null)} />}
        </>
    );
}
