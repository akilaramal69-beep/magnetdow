import { PikPakClient } from './pikpak';

interface AccountConfig {
    username?: string;
    password?: string;
}

export class AccountManager {
    private clients: PikPakClient[] = [];
    private currentIndex = 0;

    constructor() {
        // Initialize with empty list or load from env/config
    }

    addAccount(config: AccountConfig) {
        const client = new PikPakClient(config);
        this.clients.push(client);
    }

    async initialize(captchaToken?: string) {
        console.log(`Initializing ${this.clients.length} accounts...`);
        const loginPromises = this.clients.map(async (client, index) => {
            try {
                await client.login(captchaToken);
                console.log(`Account ${index + 1} ready.`);
            } catch (e: any) {
                console.error(`Account ${index + 1} failed to login.`);
                if (e.code === 'CAPTCHA_REQUIRED') throw e; // Propagate up
            }
        });
        await Promise.all(loginPromises);
    }

    getNextClient(): PikPakClient {
        if (this.clients.length === 0) {
            throw new Error("No accounts available");
        }

        // Simple Round Robin
        const client = this.clients[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.clients.length;

        return client;
    }

    // In a real scenario, we might want to check if a client is rate limited
    // and skip it. PikPak rate limits are usually per account.
}
