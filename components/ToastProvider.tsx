'use client';

import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
    return (
        <Toaster
            position="bottom-right"
            toastOptions={{
                // Default options
                duration: 4000,
                style: {
                    background: '#27272a', // zinc-800
                    color: '#fff',
                    border: '1px solid #3f3f46', // zinc-700
                    borderRadius: '0.5rem',
                    padding: '1rem',
                },
                // Success
                success: {
                    duration: 3000,
                    iconTheme: {
                        primary: '#10b981', // green-500
                        secondary: '#fff',
                    },
                },
                // Error
                error: {
                    duration: 5000,
                    iconTheme: {
                        primary: '#ef4444', // red-500
                        secondary: '#fff',
                    },
                },
                // Loading
                loading: {
                    iconTheme: {
                        primary: '#3b82f6', // blue-500
                        secondary: '#fff',
                    },
                },
            }}
        />
    );
}
