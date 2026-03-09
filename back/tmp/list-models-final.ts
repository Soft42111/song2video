import { getSogniClient } from '../src/sogni.js';

async function listModels() {
    try {
        console.log('Connecting via src/sogni.js...');
        const client = await getSogniClient();
        console.log('Connected.');

        console.log('Waiting for models to load...');
        const models = await client.getModels();

        console.log('Available Models:');
        models.forEach(m => {
            console.log(`- ID: ${m.id}, Media: ${m.media}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('FAILED:', error);
        process.exit(1);
    }
}

listModels();
