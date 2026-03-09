import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function listModels() {
    const username = process.env.SOGNI_USERNAME;
    const password = process.env.SOGNI_PASSWORD;

    console.log('Using credentials:', { username, passwordLength: password?.length });

    const client = new SogniClientWrapper({
        username: username as string,
        password: password as string,
        network: 'fast',
        autoConnect: false,
        authType: 'token',
        debug: true
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');

        console.log('Fetching models...');
        const models = await client.getAvailableModels();
        console.log('Available Models:');
        models.forEach((m: any) => {
            console.log(`- ID: ${m.id}, Media: ${m.media}, Tier: ${m.tier}`);
        });

        const balance = await client.getBalance();
        console.log('Balance:', balance);

        console.log('Testing project creation with ace_step_1.5_sft...');
        try {
            const project = await client.createProject({
                type: 'audio',
                modelId: 'ace_step_1.5_sft',
                positivePrompt: 'A beautiful ambient electronic track',
                numberOfMedia: 1,
                duration: 30, // Audio models use duration in seconds
                tokenType: 'spark',
                waitForCompletion: true
            });
            console.log('Project result:', project);
        } catch (createError: any) {
            console.error('Project creation failed:', createError.message);
            if (createError.payload) {
                console.error('Payload:', JSON.stringify(createError.payload, null, 2));
            }
        }

        await client.disconnect();
    } catch (error: any) {
        const util = await import('util');
        console.error('Error in listModels:', util.inspect(error, { depth: null, colors: true }));
    }
}

listModels();
