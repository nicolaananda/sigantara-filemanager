'use client';

import { motion } from 'framer-motion';
import { FileData } from '@/lib/api';

interface StatsProps {
    files: FileData[];
}

export default function Stats({ files }: StatsProps) {
    const totalFiles = files.length;
    const doneFiles = files.filter((f) => f.status === 'DONE').length;
    const processingFiles = files.filter((f) => f.status === 'PROCESSING').length;
    const failedFiles = files.filter((f) => f.status === 'FAILED').length;

    const totalSize = files.reduce((acc, f) => acc + f.size_bytes, 0);
    const processedSize = files.reduce((acc, f) => acc + (f.processed_size_bytes || 0), 0);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const stats = [
        {
            label: 'Total Files',
            value: totalFiles,
            icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                </svg>
            ),
            color: 'from-blue-500 to-indigo-600',
        },
        {
            label: 'Completed',
            value: doneFiles,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                    />
                </svg>
            ),
            color: 'from-green-500 to-emerald-600',
        },
        {
            label: 'Processing',
            value: processingFiles,
            icon: (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            ),
            color: 'from-yellow-500 to-orange-600',
        },
        {
            label: 'Failed',
            value: failedFiles,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                    />
                </svg>
            ),
            color: 'from-red-500 to-rose-600',
        },
    ];

    const storageStats = [
        {
            label: 'Original Size',
            value: formatBytes(totalSize),
            color: 'text-blue-400',
        },
        {
            label: 'Processed Size',
            value: formatBytes(processedSize),
            color: 'text-green-400',
        },
        {
            label: 'Saved',
            value: totalSize > 0 ? `${Math.round(((totalSize - processedSize) / totalSize) * 100)}%` : '0%',
            color: 'text-purple-400',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="card"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-400 mb-1">{stat.label}</p>
                                <p className="text-3xl font-bold text-white">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>{stat.icon}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Storage Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
            >
                <h3 className="text-lg font-semibold mb-4">Storage Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {storageStats.map((stat) => (
                        <div key={stat.label} className="text-center">
                            <p className="text-sm text-zinc-400 mb-2">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Progress bar */}
                {totalSize > 0 && (
                    <div className="mt-6">
                        <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                            <span>Compression Efficiency</span>
                            <span>{Math.round(((totalSize - processedSize) / totalSize) * 100)}%</span>
                        </div>
                        <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round(((totalSize - processedSize) / totalSize) * 100)}%` }}
                                transition={{ duration: 1, delay: 0.5 }}
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-600"
                            />
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
