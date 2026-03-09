import { getSogniClient } from '../src/sogni.js';
import util from 'util';

async function listModels() {
    try {
        console.log('Connecting...');
        const client = await getSogniClient();
        console.log('Connected.');

        console.log('Fetching models...');
        const models = await client.getModels();

        console.log('Available Models:');
        models.forEach(m => {
            console.log(`- ID: ${m.id}, Type: ${m.type || 'N/A'}, Category: ${m.category || 'N/A'}`);
        });

        process.exit(0);
    } catch (error: any) {
        console.error('FAILED:', error);
        process.exit(1);
    }
}

listModels();
