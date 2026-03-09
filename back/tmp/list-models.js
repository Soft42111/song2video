import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function run() {
    const username = process.env.SOGNI_USERNAME;
    const password = process.env.SOGNI_PASSWORD;

    if (!username || !password) {
        console.error('SOGNI_USERNAME and SOGNI_PASSWORD must be set');
        process.exit(1);
    }

    const client = new SogniClientWrapper({
        username,
        password,
        network: 'fast',
        authType: 'token',
        debug: false
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected.');

        // Get available models
        const models = await client.getAvailableModels();
        console.log('--- POTENTIAL T2V MODELS ---');
        const t2vModels = models.filter(m => m.id.toLowerCase().includes('t2v') || m.id.toLowerCase().includes('wan') || m.id.toLowerCase().includes('ltx'));

        t2vModels.forEach(m => {
            console.log(`- ID: ${m.id}`);
            console.log(`  Name: ${m.name}`);
            console.log(`  Config: ${JSON.stringify(m.config, null, 2)}`);
            console.log('------------------------');
        });

        await client.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
