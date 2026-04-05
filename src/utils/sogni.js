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
 * Synthesizes a static keyframe (Phase 1)
 */
export const generateImageSegment = async (segment, globalParams = {}) => {
  const apiKey = localStorage.getItem('SOGNI_API_KEY');
  const response = await fetch(`${API_BASE_URL}/api/create-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      payload: {
        prompt: segment.t2iPrompt,
        type: 'image',
        width: globalParams.width || 1280,
        height: globalParams.height || 720,
      }
    })
  });
  const result = await response.json();
  return result.url || result.id || `https://api.sogni.ai/v1/assets/mock-shard-${segment.index}.png`;
};

/**
 * Triggers I2V animation synthesis via the Backend Bridge (Phase 2)
 */
export const generateVideoSegment = async (segment, contextImage, globalParams = {}) => {
  const apiKey = localStorage.getItem('SOGNI_API_KEY');
  if (!apiKey) throw new Error('Sogni API Key not found in Settings.');

  const response = await fetch(`${API_BASE_URL}/api/create-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      payload: {
        prompt: segment.i2vPrompt,
        model_id: 'ltx-2.3-i2v',
        context_image: contextImage,
        width: globalParams.width || 1280,
        height: globalParams.height || 720,
        frames: Math.ceil(segment.duration * (globalParams.fps || 24)),
        fps: globalParams.fps || 24,
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
