const { SogniClientWrapper } = require('@sogni-ai/sogni-client-wrapper');
require('dotenv').config();

async function run() {
    const client = new SogniClientWrapper({
        username: process.env.SOGNI_USERNAME,
        password: process.env.SOGNI_PASSWORD,
        network: 'fast',
        authType: 'cookies'
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected.');

        const models = await client.getModels();
        console.log('All Models:');
        models.forEach(m => {
            console.log(`- ${m.id} (${m.media || 'unknown'})`);
        });

        await client.disconnect();
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
