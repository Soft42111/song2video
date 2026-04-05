import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SogniClientWrapper } from "@sogni-ai/sogni-client-wrapper";
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Content Security Policy and Browser Metadata Handlers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' http://localhost:3001 http://127.0.0.1:5173 https://api.sogni.ai wss://api.sogni.ai; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
  );
  next();
});

// Silence common browser metadata 404s
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Sogni API Proxy for CORS resolution
app.use(['/api/sogni-api', '/v1'], async (req, res) => {
  const splat = req.url.startsWith('/') ? req.url.substring(1) : req.url;
  // If the path already has v1, don't duplicate it
  const pathSuffix = splat.startsWith('v1/') ? splat.substring(3) : splat;
  const targetUrl = `https://api.sogni.ai/v1/${pathSuffix}`;
  console.log(`[PROXY] Forwarding to Sogni API: ${targetUrl} (Original URL: ${req.originalUrl})`);

  try {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (['host', 'origin', 'referer', 'content-length'].includes(k.toLowerCase())) continue;
      headers[k] = v;
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, fetchOptions);
    res.status(response.status);
    
    response.headers.forEach((v, k) => {
      const key = k.toLowerCase();
      if (key.startsWith('access-control-')) return;
      if (['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) return;
      res.setHeader(k, v);
    });

    const data = await response.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (error) {
    console.error('[PROXY] Sogni API Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Sogni WebSocket Proxy for CORS-free job tracking
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request) => {
  let splat = request.url || '';
  if (splat.includes('/api/sogni-ws/')) {
    splat = splat.split('/api/sogni-ws/')[1];
  } else if (splat.startsWith('/v1/')) {
    splat = splat.substring(4);
  } else if (splat.startsWith('/')) {
    splat = splat.substring(1);
  }
  const targetWsUrl = `wss://api.sogni.ai/v1/${splat}`;
  console.log(`[WS PROXY] Connecting to Sogni WS: ${targetWsUrl} (Original: ${request.url})`);

  const sogniWs = new WebSocket(targetWsUrl);

  sogniWs.on('open', () => {
    console.log(`[WS PROXY] Connected to Sogni WS`);
  });

  sogniWs.on('message', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  ws.on('message', (data) => {
    if (sogniWs.readyState === WebSocket.OPEN) {
      sogniWs.send(data);
    }
  });

  sogniWs.on('close', () => {
    console.log(`[WS PROXY] Sogni WS closed`);
    ws.close();
  });
  ws.on('close', () => {
    console.log(`[WS PROXY] Client WS closed`);
    sogniWs.close();
  });
  sogniWs.on('error', (err) => console.error('[WS PROXY] Sogni error:', err));
  ws.on('error', (err) => console.error('[WS PROXY] Client error:', err));
});

/**
 * Mock Auth Endpoints
 */
app.post('/api/auth/login', (req, res) => {
  const { username, apiKey } = req.body;
  res.json({
    user: { id: 'usr_123', username, name: username || 'Studio Artist' },
    token: 'mock_jwt_session_token_xyz'
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, apiKey } = req.body;
  res.json({
    user: { id: 'usr_123', username, name: username || 'New Artist' },
    token: 'mock_jwt_session_token_xyz'
  });
});

/**
 * Health Check
 */
app.get('/api/status', (req, res) => {
  res.json({ status: 'active', version: '3.0.0', engine: 'Gemini-2.0-Flash' });
});

/**
 * AI Analysis Endpoint
 * Generates cinematic prompts for Sogni LTX-2.3
 */
app.post('/api/analyze-segment', async (req, res) => {
  const { segmentIndex, metadata } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!metadata) {
    return res.status(400).json({ message: 'Missing segment metadata' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const promptText = `
      Act as a Principal Director of Cinematography. 
      Generate a highly detailed, cinematic visual prompt for an AI video generation model (LTX-2.3).
      
      CONTEXT:
      - Music Genre: ${metadata.genre || 'Epic'}
      - BPM: ${metadata.bpm || 120}
      - Mood: ${metadata.mood || 'Dynamic'}
      - Target Style: ${metadata.style || 'Cinematic'}
      - Segment Duration: ${metadata.duration || 5.0} seconds
      
      REQUIREMENTS:
      1. Describe a single, continuous cinematic shot.
      2. Focus on lighting, camera movement (tracking, pan, tilt), and hyper-realistic textures.
      3. Ensure the visual rhythm matches ${metadata.bpm} BPM.
      4. Avoid text, watermarks, or low-quality descriptors.
      
      Output ONLY the prompt string.
    `;

    const result = await model.generateContent(promptText);
    const generatedPrompt = result.response.text();

    res.json({
      segmentIndex,
      prompt: generatedPrompt.trim(),
      estimatedTokens: Math.ceil(metadata.duration * 4000), 
      parameters: {
        guidance_scale: 8.5,
        num_inference_steps: 50
      }
    });
  } catch (error) {
    console.error('Gemini Error:', error);
    res.status(500).json({ message: 'Failed to generate prompt with Gemini.' });
  }
});

/**
 * Sogni Video Generation Bridge
 * Moves Node-only SDK usage to the backend
 */
app.post('/api/create-project', async (req, res) => {
  const { apiKey, projectId, payload } = req.body;
  const projectKey = apiKey || req.headers.authorization?.split(' ')[1];
  const sogniProjectId = projectId || process.env.SOGNI_PROJECT_ID;

  if (!projectKey) return res.status(401).json({ error: 'Missing Sogni API Key' });

  try {
    const client = new SogniClientWrapper({
      apiKey: projectKey,
      projectId: sogniProjectId,
      network: 'fast',
      autoConnect: false // We are just doing a REST call here
    });

    // Unified Project API (LTX-2.3 Light recommendation)
    const result = await client.createProject({
      type: 'video',
      modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',
      positivePrompt: payload.prompt,
      negativePrompt: payload.negative_prompt || "low quality, text, watermark",
      width: payload.width || 512,
      height: payload.height || 512,
      frames: payload.frames || 80,
      fps: payload.fps || 16,
      tokenType: 'spark',
      waitForCompletion: false,
      guidance: payload.guidance || 1.0
    });

    res.json(result);
  } catch (error) {
    console.error('[SOGNI BRIDGE] Creation failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Backend listening at http://0.0.0.0:${port}`);
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname.includes('/api/sogni-ws') || pathname.startsWith('/v1/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
