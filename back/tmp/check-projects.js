import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function check() {
    const client = new SogniClientWrapper({
        username: process.env.SOGNI_USERNAME,
        password: process.env.SOGNI_PASSWORD,
        network: 'fast',
        authType: 'token',
        debug: true
    });

    try {
        await client.connect();
        console.log('Connected to Sogni');

        // Note: The SDK might have a getProjects or similar. 
        // Let's try to get available models first to ensure connection, 
        // then try to find a way to list projects.
        const models = await client.getAvailableModels();
        console.log('Available models:', models.length);

        // If we can't list projects, we'll try to get status of the specific one
        const targetId = process.argv[2] || 'D3DA6953-9B7C-4AEA-8927-4E765F2FD8C0';
        console.log(`Checking status for project: ${targetId}`);

        // Some SDKs have getProjectStatus or similar. 
        // Looking at our previous logs, we use the status polling.
        // Let's see if the client has a getProject method.
        if (typeof client.getProject === 'function') {
            const project = await client.getProject(targetId);
            console.log('Project Status:', JSON.stringify(project, null, 2));
        } else {
            console.log('client.getProject is not a function. Current methods:', Object.keys(client));
        }

        await client.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

check();
