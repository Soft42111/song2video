import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

let sogniClient: SogniClientWrapper | null = null;
let listenersAttached = false;

export function setListenersAttached(val: boolean) {
    listenersAttached = val;
}

export function areListenersAttached() {
    return listenersAttached;
}

export interface AuthConfig {
    username?: string;
    password?: string;
    apiKey?: string;
}

let currentAuth: AuthConfig | null = null;

export async function getSogniClient(auth?: AuthConfig) {
    // If new auth is provided, disconnect old client if different
    if (auth && JSON.stringify(auth) !== JSON.stringify(currentAuth)) {
        if (sogniClient?.isConnected()) {
            await sogniClient.disconnect();
        }
        sogniClient = null;
        currentAuth = auth;
    }

    if (sogniClient && sogniClient.isConnected()) {
        return sogniClient;
    }

    const username = auth?.username || process.env.SOGNI_USERNAME;
    const password = auth?.password || process.env.SOGNI_PASSWORD;
    const apiKey = auth?.apiKey || process.env.SOGNI_API_KEY;

    if (!apiKey && (!username || !password)) {
        throw new Error('Sogni Credentials or API Key must be provided.');
    }

    if (!sogniClient) {
        const config: any = {
            network: 'fast',
            autoConnect: false,
            authType: 'token',
            debug: true
        };

        if (username) config.username = username;
        if (password) config.password = password;
        if (apiKey) config.apiKey = apiKey;

        sogniClient = new SogniClientWrapper(config);
    }

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            console.log(`[SOGNI] Connection attempt ${attempts + 1}/${maxAttempts}`);
            await sogniClient.connect();
            console.log('[SOGNI] Connected successfully');
            return sogniClient;
        } catch (err: any) {
            attempts++;
            console.error(`[SOGNI] Connection attempt ${attempts} failed:`, err.message);
            if (attempts >= maxAttempts) throw err;
            await new Promise(r => setTimeout(r, 2 * 1000 * attempts));
        }
    }

    return sogniClient;
}

// Cleanup on shutdown
process.on('SIGTERM', async () => {
    if (sogniClient?.isConnected?.()) {
        await sogniClient.disconnect();
        console.log('Sogni Client disconnected');
    }
});
