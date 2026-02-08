import { authService } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface FileData {
    id: number;
    team_id: number;
    user_id: number;
    uploaded_by?: number; // Alias for user_id for clarity
    filename: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    processed_size_bytes?: number;
    status: 'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
    direct_link?: string;
    created_at: string;
    updated_at: string;
    team_name?: string;
    username?: string;
}

class ApiService {
    private getHeaders(): HeadersInit {
        const token = authService.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        };
    }

    async getPresignUrl(filename: string, mimeType: string): Promise<{
        uploadUrl: string;
        fileId: string;
        tempPath: string;
    }> {
        const response = await fetch(`${API_URL}/files/presign`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ filename, mimeType }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get presign URL');
        }

        return response.json();
    }

    async finalizeUpload(data: {
        fileId: string;
        tempPath: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
    }): Promise<{ success: boolean; fileId: number; status: string }> {
        const response = await fetch(`${API_URL}/files/finalize`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to finalize upload');
        }

        return response.json();
    }

    async getFiles(): Promise<FileData[]> {
        const response = await fetch(`${API_URL}/files`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch files');
        }

        const data = await response.json();
        return data.files;
    }

    async getFile(id: number): Promise<FileData> {
        const response = await fetch(`${API_URL}/files/${id}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch file');
        }

        const data = await response.json();
        return data.file;
    }

    async deleteFile(id: number): Promise<void> {
        const response = await fetch(`${API_URL}/files/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete file');
        }
    }

    async uploadToR2(url: string, file: File): Promise<void> {
        const response = await fetch(url, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to upload file to R2');
        }
    }
}

export const apiService = new ApiService();
