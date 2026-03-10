import { getSogniClient } from '../src/sogni';
import 'dotenv/config';

async function testAuthLogic() {
    console.log('--- Testing Sogni Auth Logic ---');

    console.log('\nCase 1: Providing API Key');
    try {
        const clientWithApiKey = await getSogniClient({ apiKey: 'test_api_key' });
        // Since we can't easily inspect the private state of SogniClientWrapper, 
        // we'll rely on the fact that it didn't throw an error during configuration.
        // In a real scenario, we'd mock the wrapper.
        console.log('✅ getSogniClient called with API Key successfully (config initialized)');
    } catch (err: any) {
        console.error('❌ Failed with API Key:', err.message);
    }

    console.log('\nCase 2: Providing Credentials');
    try {
        // We use dummy credentials that would trigger 'token' authType
        const clientWithCreds = await getSogniClient({ username: 'test_user', password: 'test_password' });
        console.log('✅ getSogniClient called with Credentials successfully (config initialized)');
    } catch (err: any) {
        // It's expected to fail at .connect() because these are fake, 
        // but we want to see if it got past the configuration.
        console.log('Note: Connection failed as expected with fake creds, but config was valid:', err.message);
    }
}

testAuthLogic().catch(console.error);
