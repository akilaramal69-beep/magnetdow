import Fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { AccountManager } from './accountManager';
import { TaskQueue } from './queue';
import { WebSocketServer, WebSocket } from 'ws';

const server: FastifyInstance = Fastify({ logger: true });

// Initialize dependencies
import fs from 'fs';
const accountManager = new AccountManager();

async function waitForCaptchaFile() {
    return new Promise<void>(resolve => {
        const interval = setInterval(() => {
            if (fs.existsSync('captcha_token.txt')) {
                clearInterval(interval);
                resolve();
            }
        }, 5000);
    });
}


const taskQueue = new TaskQueue();

// Register plugins
server.register(fastifyStatic, {
    root: path.join(__dirname, '../../public'),
    prefix: '/', // optional: default '/'
});

// API Routes handled below in the background section


server.get('/api/status/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = taskQueue.getTask(id);
    if (!task) {
        return reply.code(404).send({ error: 'Task not found' });
    }
    return {
        id: task.id,
        status: task.status,
        progress: task.progress,
        fileName: task.fileName,
        downloadUrl: task.downloadUrl,
        error: task.error
    };
});

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');

    ws.on('message', (message: string) => {
        // Assume client sends task ID to subscribe
        const data = JSON.parse(message);
        if (data.action === 'subscribe' && data.taskId) {
            // Simple polling and pushing updates for this socket
            const interval = setInterval(() => {
                const task = taskQueue.getTask(data.taskId);
                if (task) {
                    ws.send(JSON.stringify({
                        taskId: task.id,
                        status: task.status,
                        progress: task.progress,
                        fileName: task.fileName,
                        downloadUrl: task.downloadUrl,
                        error: task.error
                    }));

                    if (task.status === 'completed' || task.status === 'failed') {
                        clearInterval(interval);
                    }
                } else {
                    ws.send(JSON.stringify({ error: 'Task not found' }));
                    clearInterval(interval);
                }
            }, 1000);

            ws.on('close', () => clearInterval(interval));
        }
    });
});

// Upgrade HTTP to WebSocket
server.server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

let systemReady = false;
let captchaInfo: { url: string } | null = null;

// Start Server
const start = async () => {
    try {
        // 1. Start listening immediately to avoid 503
        await server.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server running at http://localhost:3000');

        // 2. Run initialization in background
        initializeBackground();
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

async function initializeBackground() {
    // Setup Account Manager with Retry Logic
    const config = {
        username: process.env.PIKPAK_USERNAME || 'akilaramal@proton.me',
        password: process.env.PIKPAK_PASSWORD || 'Akila@7463'
    };
    accountManager.addAccount(config);

    // Custom initialization loop
    while (!systemReady) {
        try {
            const token = fs.existsSync('captcha_token.txt')
                ? fs.readFileSync('captcha_token.txt', 'utf-8').trim()
                : undefined;

            await accountManager.initialize(token);
            systemReady = true;
            captchaInfo = null;
            console.log("System initialized and ready.");
            // Clear the file after use (safer for Docker mounts than unlinking)
            if (fs.existsSync('captcha_token.txt')) {
                fs.writeFileSync('captcha_token.txt', '');
            }
        } catch (e: any) {
            if (e.code === 'CAPTCHA_REQUIRED') {
                captchaInfo = { url: e.url };
                console.error("\n\n====================================================");
                console.error("⚠️  CAPTCHA REQUIRED TO LOGIN ⚠️");
                console.error("====================================================");
                console.error("1. Open this URL in your browser:");
                console.error(e.url);
                console.error("\n2. Solve the captcha.");
                console.error("3. Copy the 'captcha_token' (it might be in the URL redirect or network tab).");
                console.error("4. Create/Update 'captcha_token.txt' in the root folder with the token.");
                console.error("====================================================\n");
                console.log("Waiting for 'captcha_token.txt' to be created/updated...");

                // Wait for file creation or modification
                await waitForCaptchaFile();
            } else {
                console.error("Critical initialization error:", e.message);
                await new Promise(r => setTimeout(r, 10000)); // Wait before retry
            }
        }
    }
}

// Add system status endpoint
server.get('/api/status', async (request, reply) => {
    return {
        ready: systemReady,
        captchaRequired: !!captchaInfo,
        captchaUrl: captchaInfo?.url
    };
});

// Update download endpoint to check readiness
server.post('/api/download', async (request, reply) => {
    if (!systemReady) {
        return reply.code(503).send({ error: 'System initializing. Please solve captcha if required.' });
    }
    const { magnet } = request.body as { magnet: string };
    // ... rest of the logic
    if (!magnet) {
        return reply.code(400).send({ error: 'Magnet link is required' });
    }

    try {
        const client = accountManager.getNextClient();
        const taskId = taskQueue.addTask(magnet, client);
        return { id: taskId };
    } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({ error: 'Failed to queue task' });
    }
});

start();

