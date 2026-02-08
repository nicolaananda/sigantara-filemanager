'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '@/lib/auth';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface User {
    id: number;
    username: string;
    role: string;
    team_id: number | null;
    team_name?: string;
    created_at: string;
}

interface Team {
    id: number;
    name: string;
}

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'tim',
        teamId: '',
    });

    useEffect(() => {
        if (!authService.isAuthenticated() || !authService.isAdmin()) {
            router.push('/dashboard');
            return;
        }

        loadData();
    }, [router]);

    const loadData = async () => {
        try {
            const token = authService.getToken();
            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            };

            const [usersRes, teamsRes] = await Promise.all([
                fetch(`${API_URL}/users`, { headers }),
                fetch(`${API_URL}/teams`, { headers }),
            ]);

            if (usersRes.ok && teamsRes.ok) {
                const usersData = await usersRes.json();
                const teamsData = await teamsRes.json();
                setUsers(usersData.users);
                setTeams(teamsData.teams);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const token = authService.getToken();
            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            };

            const body = {
                username: formData.username,
                password: formData.password || undefined,
                role: formData.role,
                teamId: formData.teamId ? parseInt(formData.teamId) : null,
            };

            const url = editingUser
                ? `${API_URL}/users/${editingUser.id}`
                : `${API_URL}/users`;
            const method = editingUser ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(body),
            });

            if (res.ok) {
                setShowModal(false);
                setEditingUser(null);
                setFormData({ username: '', password: '', role: 'tim', teamId: '' });
                toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
                loadData();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to save user');
            }
        } catch (error) {
            toast.error('Failed to save user');
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: '',
            role: user.role,
            teamId: user.team_id?.toString() || '',
        });
        setShowModal(true);
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Delete user "${user.username}"?`)) return;

        try {
            const token = authService.getToken();
            const res = await fetch(`${API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                toast.success(`Deleted user "${user.username}"`);
                loadData();
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to delete user');
            }
        } catch (error) {
            toast.error('Failed to delete user');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
            {/* Header */}
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="btn btn-secondary text-sm"
                            >
                                ← Back
                            </button>
                            <h1 className="text-2xl font-bold">User Management</h1>
                        </div>
                        <button
                            onClick={() => {
                                setEditingUser(null);
                                setFormData({ username: '', password: '', role: 'tim', teamId: '' });
                                setShowModal(true);
                            }}
                            className="btn btn-primary"
                        >
                            + Add User
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                <div className="card">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-700">
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Username</th>
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Role</th>
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Team</th>
                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Created</th>
                                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {users.map((user) => (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="border-b border-zinc-800 hover:bg-zinc-800/50"
                                        >
                                            <td className="py-3 px-4 text-white font-medium">{user.username}</td>
                                            <td className="py-3 px-4">
                                                <span
                                                    className={`badge ${user.role === 'admin' ? 'badge-done' : 'badge-processing'
                                                        }`}
                                                >
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-zinc-400">{user.team_name || '-'}</td>
                                            <td className="py-3 px-4 text-zinc-400">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="btn btn-secondary text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user)}
                                                        className="btn btn-danger text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="card max-w-md w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-bold mb-6">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Password {editingUser && '(leave blank to keep current)'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        required={!editingUser}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="tim">Team Member</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Team (optional)
                                    </label>
                                    <select
                                        value={formData.teamId}
                                        onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">No Team</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="btn btn-primary flex-1">
                                        {editingUser ? 'Update' : 'Create'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn btn-secondary flex-1"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
