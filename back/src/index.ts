import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { getSogniClient } from './sogni.js';
import { ClientEvent } from '@sogni-ai/sogni-client-wrapper';
import { parseFile } from 'music-metadata';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { stitchVideos } from './songWorker.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
console.log(`[Static] Serving uploads from: ${uploadsDir}`);
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure Multer for audio uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from uploads directory
app.use('/api/uploads', express.static(uploadsDir));

// Initialize Gemini only if key is present
let ai: GoogleGenAI | null = null;
console.log(`[Config] Checking for GEMINI_API_KEY...`);
if (process.env.GEMINI_API_KEY) {
    console.log(`[Config] ✅ GEMINI_API_KEY found. Initializing AI...`);
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
    console.warn("⚠️ GEMINI_API_KEY is missing from process.env. Transcription features will fail if called.");
    console.log("[Config] Loaded environment variables:", Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('GEMINI')));
}

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`>>> [${timestamp}] ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log(`    Body keys: ${Object.keys(req.body || {}).join(', ')}`);
    }
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is reachable', time: new Date().toISOString() });
});

app.get('/api/logs/:id', (req, res) => {
    const { id } = req.params;
    const job = jobs[id];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ logs: job.logs || [] });
});

app.post('/api/retry/:id', async (req, res) => {
    const { id } = req.params;
    const job = jobs[id];

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'failed') {
        return res.status(400).json({ error: 'Only failed jobs can be retried' });
    }

    console.log(`[API] 🔄 Retrying job: ${id}`);
    job.status = 'processing';
    job.error = undefined;
    job.step = 'Restarting process...';
    saveJobs();

    if (job.type === 'song-video') {
        try {
            const client = await getSogniClient();
            triggerAvailableChunks(id, client);
            res.json({ status: 'retrying', projectId: id });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    } else {
        res.status(400).json({ error: 'Manual retry not implemented for this job type yet' });
    }
});

app.get('/api/models', async (req, res) => {
    try {
        const client = await getSogniClient();
        const models = await client.getAvailableModels();
        res.json(models);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/balance', async (req, res) => {
    try {
        const auth = req.query.auth ? JSON.parse(req.query.auth as string) : undefined;
        const client = await getSogniClient(auth);

        await setupGlobalListeners(client);

        const balance: any = await client.getBalance();

        const normalized = {
            sparkBalance: balance.sparkBalance || balance.spark || 0,
            sogniBalance: balance.sogniBalance || balance.sogni || 0
        };

        res.json(normalized);
    } catch (error: any) {
        console.error('[Balance] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to trigger immediate deletion of files once persisted to local DB
app.delete('/api/cleanup/:id', async (req, res) => {
    const { id } = req.params;
    const job = jobs[id];

    if (job) {
        console.log(`[Cleanup] Manual cleanup/cancel signal for: ${id}`);
        // Mark job as cancelled so backend processing stops
        if (job.status === 'processing') {
            job.status = 'cancelled';
            job.step = 'Cancelled by user';
            console.log(`[Cleanup] ⛔ Job ${id} marked as cancelled. Backend processing will stop.`);
        }
        // Delete stitched video if it exists
        if (job.videoUrl) {
            const fileName = job.videoUrl.split('/').pop()?.split('?')[0];
            if (fileName) {
                const filePath = path.join(uploadsDir, fileName);
                try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { }
            }
        }
        // Clean up chunk files
        if (job.chunks) {
            job.chunks.forEach((c: any) => {
                if (c.localPath) {
                    try { if (fs.existsSync(c.localPath)) fs.unlinkSync(c.localPath); } catch (e) { }
                }
            });
        }
        saveJobs();
        res.json({ status: 'cancelled' });
    } else {
        res.status(404).json({ error: 'Job not found' });
    }
});

function estimateCost(duration: number, type: 'video' | 'audio', tokenType: 'spark' | 'sogni' = 'spark') {
    // Rough estimation based on Wan V2.1 T2V and ACE rates
    // Video: ~0.1 Spark / frame. 16 fps. 5s = 80 frames = 8 Spark.
    // Audio: ~1 Spark / 10s.
    if (type === 'video') {
        const frames = Math.min(160, Math.max(16, Math.round(duration * 16)));
        return (frames * 0.1).toFixed(2);
    } else {
        return (duration / 10).toFixed(2);
    }
}

app.get('/', (req, res) => {
    res.send('<h1>Sogni Backend is Active</h1><p>Visit <b>/health</b> for status.</p>');
});

// In-memory job storage with simple persistence
const JOBS_PATH = path.join(process.cwd(), 'jobs.json');
let jobs: Record<string, any> = {};

function addLog(jobId: string, message: string) {
    if (jobs[jobId]) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        if (!jobs[jobId].logs) jobs[jobId].logs = [];
        jobs[jobId].logs.push(logEntry);
        // Keep only last 100 logs
        if (jobs[jobId].logs.length > 200) jobs[jobId].logs.shift();
        saveJobs();
        console.log(`[JOB LOG][${jobId}] ${message}`);
    }
}

function saveJobs() {
    try {
        fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
    } catch (e) {
        console.error('Failed to save jobs:', e);
    }
}

function loadJobs() {
    try {
        if (fs.existsSync(JOBS_PATH)) {
            const data = fs.readFileSync(JOBS_PATH, 'utf-8');
            jobs = JSON.parse(data);
            console.log(`Loaded ${Object.keys(jobs).length} jobs from disk`);

            // Attempt to resume stuck processing jobs
            resumeJobs();
        }
    } catch (e) {
        console.error('Failed to load jobs:', e);
        jobs = {};
    }
}

async function resumeJobs() {
    let resumedCount = 0;
    let client: any = null;

    for (const [id, job] of Object.entries(jobs) as [string, any][]) {
        if (job.status === 'processing') {
            console.log(`[RESUME] Attempting to resume job: ${id}`);
            if (job.type === 'song-video') {
                try {
                    // Try to get a client using the job's stored auth or env vars
                    if (!client) {
                        client = await getSogniClient(job.auth || undefined);
                        await setupGlobalListeners(client);
                    }
                    triggerAvailableChunks(id, client);
                    resumedCount++;
                } catch (err: any) {
                    console.warn(`[RESUME] Cannot resume job ${id}: ${err.message}. Marking as failed.`);
                    job.status = 'failed';
                    job.error = 'Could not reconnect after server restart. Please retry.';
                    job.step = 'Failed: Auth unavailable on restart';
                }
            } else if (job.type === 'video' || job.type === 'audio') {
                job.status = 'failed';
                job.error = 'Process interrupted (Server Restart)';
                job.step = 'Failed: Server was restarted';
            }
        }
    }
    if (resumedCount > 0) {
        console.log(`[RESUME] Successfully resumed ${resumedCount} jobs.`);
    }
    saveJobs();
}

loadJobs();

// Cleanup routine: Remove files older than 2 hours
function cleanupFiles() {
    const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    fs.readdir(uploadsDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > GRACE_PERIOD_MS) {
                    console.log(`[Cleanup] Removing old file: ${file}`);
                    fs.unlink(filePath, () => { });
                }
            });
        });
    });

    // Also clean up old jobs in memory
    for (const [id, job] of Object.entries(jobs)) {
        if (job.timestamp && (now - job.timestamp > GRACE_PERIOD_MS * 2)) {
            console.log(`[Cleanup] Removing old job data: ${id}`);
            delete jobs[id];
        }
    }
    saveJobs();
}

// Run cleanup every 30 minutes
setInterval(cleanupFiles, 30 * 60 * 1000);
cleanupFiles();

app.post('/api/generate-music', async (req, res) => {
    const { prompt, duration = 30, auth, tokenType = 'spark' } = req.body;

    try {
        let client = await getSogniClient(auth);

        const projectConfig = {
            type: 'audio',
            modelId: 'ace_step_1.5_turbo',
            positivePrompt: prompt,
            duration: duration,
            tokenType: tokenType,
            network: 'fast',
            waitForCompletion: false
        };

        let result;
        try {
            console.log(`Creating music project with prompt: ${prompt}`);
            result = await client.createProject(projectConfig as any);
        } catch (err: any) {
            console.error('Music project creation failed:', err.message);
            if (err.message?.includes('nonce') || err.message?.includes('400') || err.message?.includes('fetch')) {
                console.log('Detected connection/nonce issue, re-connecting...');
                await client.disconnect();
                client = await getSogniClient(auth);
                result = await client.createProject(projectConfig as any);
            } else {
                throw err;
            }
        }

        const projectId = (result as any).project.id;
        console.log(`Music project created successfully: ${projectId}`);
        jobs[projectId] = { status: 'processing', type: 'audio', progress: 0, step: 'Project initialized' };
        saveJobs();
        res.json({ projectId });

    } catch (error: any) {
        console.error('Music generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Media Proxy with Retry Logic
async function fetchWithRetry(url: string, retries = 5, backoff = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            if (response.status === 404 || response.status >= 500) {
                console.warn(`[FETCH] Attempt ${i + 1} for ${url} failed with status ${response.status}. Retrying in ${backoff}ms...`);
            } else {
                return response; // Other errors might be unrecoverable
            }
        } catch (err) {
            console.warn(`[FETCH] Attempt ${i + 1} for ${url} threw error. Retrying in ${backoff}ms...`);
        }
        await new Promise(r => setTimeout(r, backoff));
        backoff *= 2; // Exponential backoff
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).send('Valid URL is required');
    }

    try {
        const response = await fetchWithRetry(url);
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
        console.error('Proxy error:', error.message);
        res.status(500).send('Proxy failed: ' + error.message);
    }
});

app.post('/api/generate-video', async (req, res) => {
    const { prompt, audioUrl, duration = 5, is360 = true, auth, tokenType = 'spark' } = req.body;

    try {
        let client = await getSogniClient(auth);

        // Clamp frames to a safe maximum for T2V (e.g., 81 frames = ~5 seconds)
        const calculatedFrames = Math.min(81, Math.max(16, Math.round(duration * 16)));
        console.log(`[VIDEO GEN] Initiating project (WAN T2V): ${calculatedFrames} frames, prompt: ${prompt}`);

        const videoConfig = {
            type: 'video',
            modelId: 'wan_v2.2-14b-fp8_t2v', // More stable Wan T2V model
            positivePrompt: is360 ? `${prompt}, 360 degree panoramic view` : prompt,
            frames: calculatedFrames,
            fps: 16,
            width: 512,
            height: 512,
            tokenType: tokenType,
            network: 'fast',
            waitForCompletion: false
        };

        let result;
        try {
            result = await client.createProject(videoConfig as any);
        } catch (err: any) {
            if (err.message?.includes('nonce') || err.message?.includes('400')) {
                console.log('Detected nonce issue in video gen, re-connecting...');
                await client.disconnect();
                client = await getSogniClient(auth);
                result = await client.createProject(videoConfig as any);
            } else {
                throw err;
            }
        }

        const projectId = (result as any).project.id;
        console.log(`[VIDEO GEN] Project created: ${projectId}`);
        jobs[projectId] = { status: 'processing', type: 'video', progress: 0, audioUrl, step: 'Initializing render' };
        saveJobs();
        res.json({ projectId });

    } catch (error: any) {
        console.error('[VIDEO GEN ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status/:projectId', (req, res) => {
    const { projectId } = req.params;
    const job = jobs[projectId];

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

// New endpoint for audio transcription
app.post('/api/transcribe', upload.single('audio'), async (req: any, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log(`Transcribing file: ${req.file.path}`);

        let duration = 5;
        try {
            const metadata = await parseFile(req.file.path);
            duration = metadata.format.duration || 5;
        } catch (e) {
            console.warn('Could not parse audio duration:', e);
        }

        // Convert audio to base64
        const fileContent = fs.readFileSync(req.file.path);
        const base64Data = fileContent.toString('base64');
        const mimeType = req.file.mimetype;

        if (!ai) {
            throw new Error('Gemini API is not configured on the server.');
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: 'Please transcribe the speech in this audio exactly as it is spoken. Additionally, create a highly descriptive and cinematic visual prompt for an AI video generator based on the audio transcription and mood. Return the result strictly as a JSON object with two keys: "transcription" (a string) and "videoPrompt" (a single descriptive string paragraph, NOT an object).' }
                    ]
                }
            ]
        });

        // Move the file to the persistent uploads directory
        const fileName = `${Date.now()}-${req.file.originalname}`;
        const newPath = path.join(uploadsDir, fileName);
        fs.renameSync(req.file.path, newPath);

        let resultText = response.text || "{}";
        if (resultText.startsWith('```json')) {
            resultText = resultText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        }

        let parsedResult = { transcription: resultText, videoPrompt: "" };
        try {
            parsedResult = JSON.parse(resultText);
        } catch (e) {
            console.warn('Failed to parse Gemini JSON, falling back to raw text', e);
        }

        res.json({
            text: parsedResult.transcription || resultText,
            videoPrompt: parsedResult.videoPrompt || "",
            duration,
            audioUrl: `${req.protocol}://${req.get('host')}/api/uploads/${fileName}`
        });
    } catch (error: any) {
        console.error('Transcription error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// Parallel chunk processing constants
const PARALLEL_LIMIT = 2;

// Helper to check if all chunks are done and trigger stitching
async function checkAndStitch(songJobId: string) {
    const job = jobs[songJobId];
    if (!job || job.type !== 'song-video') return;

    const allDone = job.chunks.every((c: any) => c.status === 'completed' || c.status === 'skipped');
    if (!allDone) return;

    addLog(songJobId, `All ${job.chunks.length} chunks complete. Starting final stitching...`);
    console.log(`\n========================================`);
    console.log(`[SONG] ALL ${job.chunks.length} CHUNKS COMPLETE`);
    console.log(`[SONG] Starting FFmpeg stitching...`);
    console.log(`========================================\n`);
    job.step = 'Stitching Video Clips...';
    saveJobs();

    try {
        const videoPaths = job.chunks.map((c: any) => c.localPath).filter(Boolean);
        console.log(`[SONG] Final Video Paths for Stitching:`, videoPaths);

        if (videoPaths.length === 0) {
            throw new Error("No valid local video paths found for stitching.");
        }

        const outputName = `stitched-${Date.now()}.mp4`;
        const outputPath = path.join(uploadsDir, outputName);

        await stitchVideos(videoPaths, job.audioPath, outputPath);

        // Immediate cleanup of chunks after successful stitching
        videoPaths.forEach((p: string) => {
            try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { }
        });

        job.status = 'completed';
        job.progress = 100;
        job.step = 'Process Completed';
        job.videoUrl = `http://localhost:${process.env.PORT || 3001}/api/uploads/${outputName}`;
        addLog(songJobId, `✅ STITCHING COMPLETE! Video ready: ${outputName}`);
        saveJobs();
        console.log(`[SONG] ✅ STITCHING COMPLETE → ${outputName}`);
    } catch (err: any) {
        console.error(`[SONG] ❌ STITCHING FAILED:`, err.message);
        job.status = 'failed';
        job.error = 'Stitching failed: ' + err.message;
        job.step = 'Stitching failed';
        saveJobs();
    }
}

// Launch up to PARALLEL_LIMIT pending chunks as direct T2V projects
async function triggerAvailableChunks(songJobId: string, client: any) {
    const job = jobs[songJobId];
    if (!job || job.type !== 'song-video') return;

    if (job.status === 'cancelled' || job.status === 'failed') {
        console.log(`[SONG] ⛔ Job ${songJobId} is ${job.status}. Stopping.`);
        return;
    }

    // Count currently active chunks
    const activeCount = job.chunks.filter((c: any) => c.status === 'processing').length;
    const slotsAvailable = PARALLEL_LIMIT - activeCount;

    if (slotsAvailable <= 0) return;

    // Find pending chunks to launch
    const pendingChunks = job.chunks.filter((c: any) => c.status === 'pending');

    if (pendingChunks.length === 0) {
        // No pending chunks — check if everything is done
        await checkAndStitch(songJobId);
        return;
    }

    const toLaunch = pendingChunks.slice(0, slotsAvailable);

    for (const chunk of toLaunch) {
        const chunkIdx = chunk.index;

        console.log(`\n----------------------------------------`);
        console.log(`[SONG] 🎬 CHUNK ${chunkIdx + 1}/${job.chunks.length} — DIRECT T2V`);
        console.log(`[SONG]    Prompt: "${chunk.prompt.substring(0, 80)}..."`);
        console.log(`[SONG]    Duration: ${chunk.duration}s`);
        console.log(`----------------------------------------`);

        const frames = Math.min(160, Math.max(16, Math.round(chunk.duration * 16)));

        const videoConfig = {
            type: 'video',
            modelId: 'wan_v2.2-14b-fp8_t2v',
            positivePrompt: `cinematic 360 panoramic view, ${chunk.prompt}`,
            frames: frames,
            fps: 16,
            width: 512,
            height: 512,
            tokenType: job.tokenType || 'spark',
            network: 'fast',
            waitForCompletion: false
        };

        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount < maxRetries && !success) {
            try {
                addLog(songJobId, `Launching Part ${chunkIdx + 1} (T2V direct)...`);
                let result = await client.createProject(videoConfig as any);
                chunk.projectId = (result as any).project.id;
                chunk.status = 'processing';
                chunk.phase = 'video';
                addLog(songJobId, `Part ${chunkIdx + 1} project created: ${chunk.projectId}`);
                saveJobs();
                console.log(`[SONG] 🎬 T2V project created → ID: ${chunk.projectId} (Attempt ${retryCount + 1})`);
                success = true;
            } catch (err: any) {
                console.warn(`[SONG] ⚠️ T2V ATTEMPT ${retryCount + 1} FAILED for chunk ${chunkIdx + 1}:`, err.message);
                if (err.message && (err.message.includes('nonce') || err.message.includes('400') || err.message.includes('fetch') || err.message.includes('ENOTFOUND'))) {
                    try { await client.disconnect(); } catch (e) { }
                    client = await getSogniClient();
                    retryCount++;
                    await new Promise(r => setTimeout(r, 2000 * retryCount));
                } else {
                    console.error(`[SONG] ❌ UNRECOVERABLE T2V ERROR:`, err.message);
                    chunk.status = 'failed';
                    job.status = 'failed';
                    job.error = err.message;
                    job.step = `Error creating video for Part ${chunkIdx + 1}: ${err.message}`;
                    saveJobs();
                    return;
                }
            }
        }

        if (!success) {
            console.error(`[SONG] ❌ T2V FAILED after ${maxRetries} attempts for chunk ${chunkIdx + 1}`);
            job.status = 'failed';
            job.error = "Max retries reached for connection issues";
            job.step = `Error creating video for Part ${chunkIdx + 1}: Connection failed`;
            saveJobs();
            return;
        }
    }

    // Update step to show active chunks
    const processingChunks = job.chunks.filter((c: any) => c.status === 'processing');
    const completedCount = job.chunks.filter((c: any) => c.status === 'completed' || c.status === 'skipped').length;
    job.step = `Rendering ${processingChunks.length} parts in parallel (${completedCount}/${job.chunks.length} done)`;
    job.progress = Math.round((completedCount / job.chunks.length) * 100);
    saveJobs();
}


// Endpoint for full song-to-video processing
app.post('/api/generate-song-video', upload.single('audio'), async (req: any, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        console.log(`\n========================================`);
        console.log(`[SONG] 🎵 NEW SONG UPLOAD`);
        console.log(`[SONG]    File: ${req.file.originalname}`);
        console.log(`========================================`);

        let duration = 30;
        try {
            const metadata = await parseFile(req.file.path);
            duration = metadata.format.duration || 30;
        } catch (e) {
            console.warn('Could not parse audio duration:', e);
        }

        const mimeType = req.file.mimetype;
        const fileContent = fs.readFileSync(req.file.path);
        const base64Data = fileContent.toString('base64');

        // Resilient initialization check
        if (!ai && process.env.GEMINI_API_KEY) {
            console.log("[Route] Gemini AI not found at startup, initializing now from process.env...");
            ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }

        if (!ai) throw new Error('Gemini API is not configured.');

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const newPath = path.join(uploadsDir, fileName);
        fs.renameSync(req.file.path, newPath);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        {
                            text: `Analyze the audio transcription and break it down into sequential chunks based on verses or thematic sections. Total duration is ~${duration}s. Provide constraints:
1. "text": transcribed text of this chunk.
2. "prompt": cinematic descriptive visual prompt for an AI video generator representing this chunk. Make it vivid and detailed.
3. "duration": float representing seconds this chunk takes. MUST BE between 5 and 10 seconds. Aim for 6-12 total chunks to cover the full duration. Total duration of all chunks MUST equal ~${duration}.
Return strictly as a JSON array of objects with keys: "text", "prompt", "duration".` }
                    ]
                }
            ]
        });

        let resultText = response.text || "[]";
        if (resultText.startsWith('```json')) {
            resultText = resultText.replace(/```json\n?/, '').replace(/```\n?$/, '');
        }

        let chunks = [];
        try {
            chunks = JSON.parse(resultText);
            if (!Array.isArray(chunks)) chunks = [chunks];
        } catch (e) {
            console.warn('Failed to parse Gemini chunk JSON', e);
            chunks = [{ text: "Full song", prompt: "A cinematic music video", duration: duration }];
        }

        console.log(`[SONG] 📋 Gemini returned ${chunks.length} chunks:`);
        chunks.forEach((c: any, i: number) => {
            console.log(`[SONG]    Part ${i + 1}: "${c.text?.substring(0, 50)}..." | ${c.duration}s`);
        });

        const songJobId = `song-${Date.now()}`;
        const audioUrl = `${req.protocol}://${req.get('host')}/api/uploads/${fileName}`;

        // Initialize the chunks
        const jobChunks = chunks.map((c: any, idx: number) => ({
            ...c,
            index: idx,
            projectId: null,
            status: 'pending',
            localPath: null,
            phase: 'video' // Direct T2V — skip image step
        }));

        jobs[songJobId] = {
            status: 'processing',
            type: 'song-video',
            progress: 0,
            audioUrl,
            audioPath: newPath,
            step: 'Initializing sequence',
            chunks: jobChunks,
            currentChunkIndex: 0,
            completedChunks: 0
        };
        saveJobs();

        const { theme = '', mood = '', style = '', customPrompt = '', auth, tokenType = 'spark' } = req.body || {};
        const authData = auth ? (typeof auth === 'string' ? JSON.parse(auth) : auth) : undefined;

        res.json({ projectId: songJobId, chunks: jobChunks });

        // Start processing chunks in parallel
        const client = await getSogniClient(authData);

        // Ensure listeners are attached BEFORE triggering chunks
        await setupGlobalListeners(client);

        // Store auth and tokenType in job for resumption/retries
        jobs[songJobId].auth = authData;
        jobs[songJobId].tokenType = tokenType;

        // Launch up to PARALLEL_LIMIT chunks at once
        triggerAvailableChunks(songJobId, client);

    } catch (error: any) {
        console.error('Song to video error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});

// Helper to automatically turn an image result into a video job within the song iteration sequence
async function transitionChunkToVideo(songId: string, currentChunk: any, imageUrl: string, client: any) {
    const job = jobs[songId];
    if (!job) return;

    // Stop if job was cancelled
    if (job.status === 'cancelled' || job.status === 'failed') {
        console.log(`[SONG] ⛔ Job ${songId} is ${job.status}. Skipping video transition.`);
        return;
    }

    try {
        console.log(`[SONG] 🎬 CHUNK ${job.currentChunkIndex + 1} — TRANSITIONING IMAGE → VIDEO`);
        job.step = `Rendering Part ${job.currentChunkIndex + 1} of ${job.chunks.length} [Video Generation]`;
        addLog(songId, `Transitioning Part ${job.currentChunkIndex + 1} from image to video animation...`);
        saveJobs();

        // 1. Fetch image to buffer with robust retries
        let imageBuffer: Buffer | null = null;
        try {
            const imageResponse = await fetchWithRetry(imageUrl);
            const contentType = imageResponse.headers.get('content-type');
            if (contentType && !contentType.includes('image')) {
                throw new Error(`Fetched media is not an image (Type: ${contentType}). Possible content filtering or CDN error.`);
            }

            const buf = Buffer.from(await imageResponse.arrayBuffer());
            if (buf.length < 100) {
                throw new Error(`Fetched image buffer is too small (${buf.length} bytes). Likely invalid.`);
            }
            imageBuffer = buf;
        } catch (err: any) {
            console.error(`[SONG] ❌ Image fetch failed for chunk ${job.currentChunkIndex + 1} after retries:`, err.message);
            throw err;
        }

        const frames = Math.min(160, Math.max(16, Math.round(currentChunk.duration * 16)));
        console.log(`[SONG]    Image fetched (${imageBuffer.length} bytes) → creating ${frames} frame video`);
        const videoConfig = {
            type: 'video',
            modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v', // Fast I2V model
            positivePrompt: `panorama 360 view, ${currentChunk.prompt}`,
            numberOfMedia: 1,
            referenceImage: imageBuffer,
            frames: frames,
            fps: 16,
            width: 512,
            height: 512,
            tokenType: 'spark',
            waitForCompletion: false
        };

        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (retryCount < maxRetries && !success) {
            try {
                const result = await client.createProject(videoConfig as any);
                currentChunk.projectId = (result as any).project.id;
                currentChunk.phase = 'video';
                saveJobs();
                console.log(`[SONG] 🎬 Video project created → ID: ${currentChunk.projectId} (Attempt ${retryCount + 1})`);
                success = true;
            } catch (err: any) {
                console.warn(`[SONG] ⚠️ VIDEO TRANSITION ATTEMPT ${retryCount + 1} FAILED for chunk ${job.currentChunkIndex + 1}:`, err.message);

                if (err.message && (err.message.includes('nonce') || err.message.includes('400') || err.message.includes('fetch') || err.message.includes('ENOTFOUND'))) {
                    console.log(`[SONG] Detected connection/DNS issue during video transition. Re-connecting and retrying...`);
                    try {
                        await client.disconnect();
                    } catch (e) { }
                    client = await getSogniClient();
                    retryCount++;
                    await new Promise(r => setTimeout(r, 2000 * retryCount));
                } else {
                    console.error(`[SONG] ❌ UNRECOVERABLE VIDEO TRANSITION ERROR:`, err.message);
                    throw err;
                }
            }
        }

        if (!success) {
            throw new Error(`VIDEO TRANSITION FAILED after ${maxRetries} attempts due to connection issues.`);
        }
    } catch (err: any) {
        console.error(`[SONG] ❌ FATAL VIDEO TRANSITION ERROR for chunk ${job.currentChunkIndex + 1}:`, err.message);
        job.status = 'failed';
        job.error = err.message;
        job.step = `Fatal error creating video chunk: ${err.message}`;
        saveJobs();
    }
}
app.post('/api/generate-video-enhanced', async (req, res) => {
    const { prompt, audioBuffer, audioUrl, is360 = true, duration = 5 } = req.body;

    try {
        let client = await getSogniClient();

        // If audioBuffer is provided (from direct upload), we use it. 
        // Otherwise use audioUrl if provided.
        // Download audio to buffer because Sogni cloud workers can't reach localhost URLs
        let referenceAudio: any = audioBuffer ? Buffer.from(audioBuffer, 'base64') : audioUrl;

        if (typeof referenceAudio === 'string' && (referenceAudio.includes('localhost') || referenceAudio.includes('127.0.0.1'))) {
            console.log('Downloading local audio to buffer for Sogni SDK (enhanced)...');
            const response = await fetch(referenceAudio);
            const arrayBuffer = await response.arrayBuffer();
            referenceAudio = Buffer.from(arrayBuffer);
        }

        // Clamp frames to a safe maximum for T2V (e.g., 161 frames = ~10 seconds)
        const calculatedFrames = Math.min(161, Math.max(16, Math.round(duration * 16)));
        console.log(`Generating Enhanced T2V video with ${calculatedFrames} frames for ${duration}s audio duration (clamped to 10s max)`);

        const videoConfig = {
            type: 'video',
            modelId: 'ltx2-19b-fp8_t2v', // Pure Text-to-Video model
            positivePrompt: is360 ? `panorama 360 view, ${prompt}` : prompt,
            frames: calculatedFrames,
            fps: 16,
            width: 512,
            height: 512,
            tokenType: 'spark',
            network: 'fast',
            waitForCompletion: false
        };

        let result;
        try {
            result = await client.createProject(videoConfig as any);
        } catch (err: any) {
            if (err.message?.includes('nonce') || err.message?.includes('400')) {
                console.log('Detected nonce issue in enhanced video gen, re-connecting...');
                await client.disconnect();
                client = await getSogniClient();
                result = await client.createProject(videoConfig as any);
            } else {
                throw err;
            }
        }

        const projectId = (result as any).project.id;
        console.log(`[ENHANCED VIDEO GEN] Project created: ${projectId}`);
        jobs[projectId] = { status: 'processing', type: 'video', progress: 0, audioUrl, step: 'Initializing enhanced render' };
        saveJobs();
        res.json({ projectId });

    } catch (error: any) {
        console.error('[ENHANCED VIDEO GEN ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Global Listeners Management
import { areListenersAttached, setListenersAttached } from './sogni.js';

async function setupGlobalListeners(client: any) {
    if (areListenersAttached()) return;

    console.log('[SOGNI] Attaching global lifecycle listeners...');

    client.on(ClientEvent.JOB_COMPLETED, (data: any) => {
        const { projectId, videoUrl, imageUrl, audioUrl } = data;
        console.log(`\n[EVENT] 🟢 JOB_COMPLETED: ${projectId}`);

        if (jobs[projectId]) {
            const job = jobs[projectId];
            const processUrl = (url?: string) => {
                if (!url) return undefined;
                if (url.startsWith('http')) return `http://localhost:${port}/api/proxy?url=${encodeURIComponent(url)}`;
                return url;
            };

            const newVideoUrl = processUrl(videoUrl);
            const newAudioUrl = processUrl(audioUrl);

            jobs[projectId] = {
                ...job,
                status: 'completed',
                progress: 100,
                step: 'Process Completed',
                audioUrl: newAudioUrl || job.audioUrl,
                videoUrl: newVideoUrl || job.videoUrl,
                imageUrl: imageUrl ? processUrl(imageUrl) : job.imageUrl
            };
            saveJobs();
        } else {
            // Check song-video chunks (T2V direct)
            for (const [songId, job] of Object.entries(jobs)) {
                if (job.type === 'song-video' && job.status === 'processing') {
                    // Find the chunk with this projectId
                    const matchingChunk = job.chunks.find((c: any) => c.projectId === projectId);
                    if (matchingChunk) {
                        if (!videoUrl) {
                            // Content was filtered — retry with safe prompt
                            const filterRetries = matchingChunk.filterRetryCount || 0;
                            const MAX_FILTER_RETRIES = 2;
                            if (filterRetries < MAX_FILTER_RETRIES) {
                                matchingChunk.filterRetryCount = filterRetries + 1;
                                matchingChunk.status = 'pending';
                                matchingChunk.projectId = null;
                                const safePrompts = [
                                    'Cinematic landscape with soft golden light, aerial view of rolling hills at sunrise, smooth camera motion',
                                    'Abstract fluid art, swirling vibrant colors on dark canvas, flowing motion',
                                    'Close-up of musical notes floating in glowing mist, dark ethereal atmosphere'
                                ];
                                matchingChunk.prompt = safePrompts[filterRetries % safePrompts.length];
                                console.warn(`[SONG] ⚠️ Video filtered for Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1}. Retrying with safe prompt...`);
                                addLog(songId, `Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1}: Filtered. Retrying with safe prompt...`);
                                saveJobs();
                                triggerAvailableChunks(songId, client);
                            } else {
                                matchingChunk.status = 'skipped';
                                console.error(`[SONG] ❌ Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1} skipped after filter retries.`);
                                addLog(songId, `Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1}: Skipped.`);
                                saveJobs();
                                triggerAvailableChunks(songId, client);
                            }
                            break;
                        }

                        // Video completed — download it
                        matchingChunk.status = 'completed';
                        console.log(`[SONG] ✅ Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1} completed: ${projectId}`);
                        addLog(songId, `Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1} rendered successfully.`);

                        fetchWithRetry(videoUrl).then(response => {
                            const localPath = path.join(uploadsDir, `chunk-${projectId}.mp4`);
                            const dest = fs.createWriteStream(localPath);
                            Readable.fromWeb(response.body as any).pipe(dest);
                            dest.on('finish', () => {
                                matchingChunk.localPath = localPath;
                                const completedCount = job.chunks.filter((c: any) => c.status === 'completed' || c.status === 'skipped').length;
                                job.progress = Math.round((completedCount / job.chunks.length) * 100);
                                job.step = `Parts done: ${completedCount}/${job.chunks.length}`;
                                saveJobs();
                                // Launch more chunks or stitch
                                triggerAvailableChunks(songId, client);
                            });
                        }).catch(err => {
                            console.error(`[SONG] ❌ Failed to download video for Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1}:`, err.message);
                            matchingChunk.status = 'failed';
                            job.status = 'failed';
                            job.error = `Download failed for Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1}`;
                            saveJobs();
                        });
                        break;
                    }
                }
            }
        }
    });

    client.on(ClientEvent.PROJECT_PROGRESS, (data: any) => {
        const { projectId, percentage } = data;
        const safePercentage = Number.isFinite(percentage) ? percentage : null;
        if (safePercentage !== null) {
            console.log(`[EVENT] 📊 PROJECT_PROGRESS: ${projectId} -> ${safePercentage}%`);
        }

        if (jobs[projectId]) {
            if (safePercentage !== null) {
                jobs[projectId].progress = safePercentage;
                if (jobs[projectId].status !== 'completed') {
                    jobs[projectId].step = `Rendering: ${safePercentage}%`;
                }
                saveJobs();
            }
        } else {
            for (const job of Object.values(jobs)) {
                if (job.type === 'song-video' && job.status === 'processing') {
                    const matchingChunk = job.chunks.find((c: any) => c.projectId === projectId);
                    if (matchingChunk) {
                        const chunkProgress = safePercentage !== null ? ` ${safePercentage}%` : '';
                        job.step = `Rendering Part ${(matchingChunk.index ?? job.chunks.indexOf(matchingChunk)) + 1} of ${job.chunks.length}${chunkProgress}`;
                        // Calculate overall progress from completed + in-progress chunks
                        const completedCount = job.chunks.filter((c: any) => c.status === 'completed' || c.status === 'skipped').length;
                        const baseProgress = Math.round((completedCount / job.chunks.length) * 100);
                        const chunkContribution = safePercentage !== null ? Math.round((safePercentage / 100) * (100 / job.chunks.length)) : 0;
                        job.progress = Math.min(99, baseProgress + chunkContribution);
                        saveJobs();
                        break;
                    }
                }
            }
        }
    });

    client.on(ClientEvent.JOB_FAILED, (data: any) => {
        const { projectId, error } = data;
        if (jobs[projectId]) {
            jobs[projectId].status = 'failed';
            jobs[projectId].error = error;
            jobs[projectId].step = `Error: ${error}`;
            saveJobs();
        }
    });

    setListenersAttached(true);
}

// Note: Global listeners are attached lazily on first successful connection
// via setupGlobalListeners() calls in balance/generate endpoints.

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
