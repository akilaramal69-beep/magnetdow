import { PikPakClient } from './pikpak';
import { v4 as uuidv4 } from 'uuid';

export interface Task {
    id: string;
    magnet: string;
    status: 'pending' | 'processing' | 'downloading' | 'completed' | 'failed';
    progress: number;
    downloadUrl?: string;
    fileName?: string;
    error?: string;
    client?: PikPakClient;
    pikPakTaskId?: string;
    pikPakFileId?: string;
}

export class TaskQueue {
    private tasks: Map<string, Task> = new Map();

    constructor() {
        // Start the poller loop
        setInterval(() => this.processQueue(), 2000); // Check every 2 seconds
    }

    addTask(magnet: string, client: PikPakClient): string {
        const id = uuidv4();
        this.tasks.set(id, {
            id,
            magnet,
            status: 'pending',
            progress: 0,
            client
        });
        return id;
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    private async processQueue() {
        for (const [id, task] of this.tasks) {
            if (task.status === 'completed' || task.status === 'failed') continue;

            try {
                if (task.status === 'pending') {
                    task.status = 'processing';
                    // 1. Add Magnet to PikPak
                    console.log(`Processing task ${id}: Added magnet.`);

                    const pikPakIdentifier = await task.client!.addMagnet(task.magnet);

                    // Identify if it's a task ID or file ID.
                    // Usually task IDs are long numeric strings or UUIDs.
                    // If addMagnet returns a file ID directly (very fast download or instant), we skip to completed.
                    // For now, let's assume it returns a TASK ID for offline download.
                    task.pikPakTaskId = pikPakIdentifier;
                    task.status = 'downloading';
                }

                if (task.status === 'downloading' && task.pikPakTaskId) {
                    // 2. Poll Task Status
                    const pikPakTask = await task.client!.getTaskStatus(task.pikPakTaskId);

                    if (pikPakTask) {
                        task.progress = parseInt(pikPakTask.progress || '0');

                        if (pikPakTask.phase === 'PHASE_TYPE_COMPLETE') {
                            task.status = 'processing'; // Briefly processing to get link
                            task.pikPakFileId = pikPakTask.file_id;
                            task.fileName = pikPakTask.name;

                            // 3. Get Download Link
                            const link = await task.client!.getDownloadUrl(task.pikPakFileId!);
                            task.downloadUrl = link;
                            task.status = 'completed';
                            console.log(`Task ${id} completed.`);
                        } else if (pikPakTask.phase === 'PHASE_TYPE_ERROR') {
                            task.status = 'failed';
                            task.error = pikPakTask.message || "Unknown PikPak error";
                        }
                    } else {
                        // Task not found? Maybe completed and removed from list? 
                        // Or maybe it was a file ID from the start?
                        // For resilience, if not found as task, check as file?
                        // Simplified: just fail or retry logic here.
                    }
                }

            } catch (error: any) {
                console.error(`Error processing task ${id}:`, error.message);
                task.status = 'failed';
                task.error = error.message;
            }
        }
    }
}
