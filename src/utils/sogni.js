/**
 * Sogni Service Utility (Frontend Bridge)
 * Delegated to Backend for Node-compatibility (resolves Blank Page crash)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Estimates Spark token usage (Frontend Helper)
 */
export const estimateTokens = (duration, options = {}) => {
  const { fps = 16, modelMultiplier = 1.2 } = options;
  const numFrames = Math.ceil(duration * fps);
  const baseTokens = (512 * 512 * numFrames) / 10000;
  return Math.ceil(baseTokens * modelMultiplier);
};

/**
 * Triggers video generation via the local Backend Bridge
 */
export const generateVideoSegment = async (segment, globalParams = {}) => {
  const apiKey = localStorage.getItem('SOGNI_API_KEY');
  if (!apiKey) throw new Error('Sogni API Key not found in Settings.');

  // 1. Initiate Project Creation on Backend
  const response = await fetch(`${API_BASE_URL}/api/create-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      payload: {
        prompt: segment.prompt,
        width: globalParams.width || 512,
        height: globalParams.height || 512,
        frames: Math.ceil(segment.duration * (globalParams.fps || 16)),
        fps: globalParams.fps || 16,
        guidance: globalParams.guidance_scale || 1.0
      }
    })
  });

  const result = await response.json();
  if (result.error) throw new Error(result.error);

  const sogniProjectId = result.project?.id || result.id;
  if (!sogniProjectId) throw new Error("Failed to initialize Sogni Project via bridge.");

  // 2. Track Progress via WebSocket Bridge
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3001/api/sogni-ws/projects/${sogniProjectId}/stream`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS BRIDGE] Update:', data);

        if (data.type === 'PROJECT_PROGRESS' && segment.onProgress) {
          segment.onProgress(data.percentage);
        }

        if (data.type === 'JOB_COMPLETED' && data.videoUrl) {
          ws.close();
          resolve(data.videoUrl);
        }

        if (data.type === 'JOB_FAILED') {
          ws.close();
          reject(new Error(data.error || 'Generation failed.'));
        }
      } catch (err) {
        console.warn('WS Message parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Bridge Error:', err);
      // Wait for completion via polling or other method if WS fails?
      // For now, reject to trigger UI error state
    };

    // Safety timeout
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      reject(new Error('Generation Timeout (5m)'));
    }, 300000);
  });
};

/**
 * Validates Sogni API Authentication (via Backend)
 */
export const validateApiKey = async (apiKey) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sogni-api/account/balance`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch (err) {
    return false;
  }
};
