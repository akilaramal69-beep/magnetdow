import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface PikPakConfig {
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
}

export class PikPakClient {
    private client: AxiosInstance;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private config: PikPakConfig;
    private deviceId: string;

    constructor(config: PikPakConfig) {
        this.config = config;
        this.deviceId = crypto.randomBytes(16).toString('hex');
        this.client = axios.create({
            baseURL: 'https://api-drive.mypikpak.com/drive/v1',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Id': this.deviceId
            }
        });

        // Request interceptor to add token
        this.client.interceptors.request.use((config) => {
            if (this.accessToken) {
                config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return config;
        });
    }

    async login(captchaToken?: string): Promise<void> {
        if (!this.config.username || !this.config.password) {
            throw new Error("Username and password required for login");
        }

        try {
            const payload: any = {
                client_id: this.config.clientId || "YNxT9w7GMdWvEOKa",
                username: this.config.username,
                password: this.config.password,
                device_id: this.deviceId
            };

            if (captchaToken) {
                payload.captcha_token = captchaToken;
            }

            const response = await axios.post('https://user.mypikpak.com/v1/auth/signin', payload);

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            console.log(`Logged in as ${this.config.username}`);
        } catch (error: any) {
            // Re-throw with data for handling
            if (error.response?.data?.error === 'captcha_required') {
                const verificationUrl = error.response.data.verification?.url || error.response.data.url;
                throw {
                    code: 'CAPTCHA_REQUIRED',
                    url: verificationUrl,
                    message: "Captcha authentication required"
                };
            }
            throw error;
        }
    }

    async addMagnet(magnetLink: string): Promise<string> {
        try {
            const response = await this.client.post('/files', {
                kind: "drive#file",
                name: "magnet-download", // Name doesn't matter much for magnets, it resets
                folder_type: "DOWNLOAD",
                upload_type: "UPLOAD_TYPE_URL",
                url: {
                    url: magnetLink
                }
            });

            // This returns a task or file object. 
            // If it's a task, we need to track it.
            // PikPak returns the created file/task entry.
            const task = response.data.task;
            if (task) {
                return task.id; // Return task ID to track progress
            }
            return response.data.file.id; // Immediate success (rare for magnets)

        } catch (error: any) {
            console.error("Add magnet failed:", error.response?.data || error.message);
            throw error;
        }
    }

    // Check task status
    async getTaskStatus(taskId: string): Promise<any> {
        try {
            // Correct endpoint for task status might be different, commonly it's via listing tasks or files
            // For simplicity in this version, we might assume the file appears in the list.
            // But actually PikPak has a task endpoint.
            // Let's use the file list with filters if unsure, but /tasks/{id} is standard for offline download.

            // Unofficial docs suggest: GET /tasks/{id} or list tasks
            // Let's try listing tasks first as it's safer.
            const response = await this.client.get('/tasks', {
                params: {
                    type: 'offline',
                    filters: {
                        "id": { "eq": taskId }
                    }
                }
            });

            // Check if task exists in list
            const tasks = response.data.tasks || [];
            const task = tasks.find((t: any) => t.id === taskId);
            return task || null;

        } catch (error: any) {
            console.error("Get task status failed:", error.response?.data || error.message);
            // Verify if it's a 404
            return null;
        }
    }

    // Find the file created by the task
    async getFileByTaskId(taskId: string): Promise<any> {
        // This is tricky. Usually the task has a `file_id` or `file_name` once complete.
        // We'll iterate the file list sorted by time if needed, but task status usually provides `file_id`.

        const task = await this.getTaskStatus(taskId);
        if (task && task.phase === 'PHASE_TYPE_COMPLETE') {
            return { id: task.file_id, name: task.name };
        }
        return null;
    }


    async getDownloadUrl(fileId: string): Promise<string> {
        try {
            const response = await this.client.get(`/files/${fileId}`);
            // PikPak limits direct links sometimes.
            // We usually need the `web_content_link` or `download_url` from the file object.

            return response.data.web_content_link || response.data.download_url;
        } catch (error: any) {
            console.error("Get download URL failed:", error.response?.data || error.message);
            throw error;
        }
    }

    async listFiles(parentId?: string): Promise<any[]> {
        try {
            const params: any = {
                parent_id: parentId,
                thumbnail_size: "SIZE_MEDIUM",
                limit: 100,
                with_audit: false
            };
            const response = await this.client.get('/files', { params });
            return response.data.files;
        } catch (error: any) {
            console.error("List files failed:", error.response?.data || error.message);
            throw error;
        }
    }
}
