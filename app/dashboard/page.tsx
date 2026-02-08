'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authService } from '@/lib/auth';
import { apiService, type FileData } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import FileList from '@/components/FileList';
import Stats from '@/components/Stats';

export default function Dashboard() {
    const router = useRouter();
    const [files, setFiles] = useState<FileData[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (!authService.isAuthenticated()) {
            router.push('/login');
            return;
        }

        const userData = authService.getUser();
        setUser(userData);
        loadFiles();

        // Poll for updates every 5 seconds
        const interval = setInterval(loadFiles, 5000);
        return () => clearInterval(interval);
    }, [router]);

    const loadFiles = async () => {
        try {
            const data = await apiService.getFiles();
            setFiles(data);
        } catch (error) {
            console.error('Failed to load files:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        authService.logout();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-zinc-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                            >
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                    />
                                </svg>
                            </motion.div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Sigantara File Manager</h1>
                                <p className="text-sm text-zinc-400">
                                    {user?.role === 'admin' ? '👑 Administrator' : `📁 ${user?.teamName || 'Team Member'}`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => router.push('/users')}
                                    className="btn btn-secondary text-sm"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                        />
                                    </svg>
                                    Manage Users
                                </button>
                            )}
                            <div className="text-right">
                                <p className="text-sm font-medium text-white">{user?.username}</p>
                                <p className="text-xs text-zinc-500">{user?.role}</p>
                            </div>
                            <button onClick={handleLogout} className="btn btn-danger text-sm">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Stats Section */}
                    <Stats files={files} />

                    {/* Upload Section */}
                    <FileUpload onUploadComplete={loadFiles} />

                    {/* Files Section */}
                    <FileList
                        files={files}
                        onFileDeleted={loadFiles}
                        currentUserId={user?.id}
                        currentUserRole={user?.role}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-800 mt-16 py-6">
                <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
                    <p>Sigantara File Manager • Built with Next.js, Cloudflare Workers & R2</p>
                </div>
            </footer>
        </div>
    );
}
