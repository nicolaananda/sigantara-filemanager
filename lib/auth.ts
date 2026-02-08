const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface User {
    id: number;
    username: string;
    role: 'admin' | 'tim';
    teamId: number | null;
}

export interface AuthResponse {
    token: string;
    user: User;
}

class AuthService {
    private tokenKey = 'sigantara_token';
    private userKey = 'sigantara_user';

    async login(username: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data: AuthResponse = await response.json();

        // Store token and user in localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem(this.tokenKey, data.token);
            localStorage.setItem(this.userKey, JSON.stringify(data.user));
        }

        return data;
    }

    logout(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
        }
    }

    getToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(this.tokenKey);
        }
        return null;
    }

    getUser(): User | null {
        if (typeof window !== 'undefined') {
            const userStr = localStorage.getItem(this.userKey);
            if (userStr) {
                try {
                    return JSON.parse(userStr);
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    isAdmin(): boolean {
        const user = this.getUser();
        return user?.role === 'admin';
    }
}

export const authService = new AuthService();
