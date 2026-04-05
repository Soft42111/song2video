# Sogni SDK Integration Guide

A practical guide for developers and AI agents building applications with the Sogni AI SDK.

## Installation

```bash
npm install @sogni-ai/sogni-client-wrapper
```

---

## Quick Start

### Basic Client Setup

```javascript
import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';

const client = new SogniClientWrapper({
  username: process.env.SOGNI_USERNAME,
  password: process.env.SOGNI_PASSWORD,
  network: 'fast',           // Use 'fast' for better performance
  autoConnect: false,        // Manual connection control
  authType: 'cookies',
  debug: true                // Enable for development
});

await client.connect();
```

---

## Security Best Practices

### Credential Protection

**Sogni credentials are tied to the user's crypto wallet.** Leaking credentials means potentially compromising their wallet. Follow these rules:

#### For Applications You Build (Using Your Own Account)

Always keep credentials on the backend. Never expose them to the frontend.

```
your-app/
├── frontend/           # No credentials here
│   └── src/
└── backend/            # Credentials live here ONLY
    └── .env            # SOGNI_USERNAME, SOGNI_PASSWORD
```

Example backend `.env`:
```bash
SOGNI_USERNAME=your_username
SOGNI_PASSWORD=your_password
```

#### For User-Facing Apps (Users Log In With Their Own Sogni Account)

If users authenticate with their own Sogni credentials, that's fine - they're using their own account. But you should still:

1. Never log or store user credentials
2. Use secure HTTPS connections
3. Consider OAuth/SSO if available in the future

---

## Image Generation

### Recommended Defaults

| Setting | Recommended Value | Notes |
|---------|------------------|-------|
| Token Type | `spark` | Always use Spark tokens |
| Dimensions | `512x512` | Fast renders, good quality |
| Format | `jpg` | Smaller file size |

### Basic Image Generation

```javascript
const projectConfig = {
  type: 'image',
  modelId: 'z_image_turbo_bf16',     // Fast turbo model
  positivePrompt: 'A serene mountain landscape at sunset',
  negativePrompt: '',                 // Optional
  stylePrompt: '',                    // Optional
  numberOfImages: 1,
  tokenType: 'spark',                 // Always use spark
  waitForCompletion: true,
  timeout: 60000,                     // 60 seconds
  sizePreset: 'custom',
  width: 512,
  height: 512
};

const result = await client.createProject(projectConfig);

if (result.completed && result.imageUrls?.length > 0) {
  console.log('Image URL:', result.imageUrls[0]);
}
```

### Recommended Image Models

| Model ID | Use Case | Speed | Notes |
|----------|----------|-------|-------|
| `z_image_turbo_bf16` | General purpose | Fast | Good default choice |
| `flux1-schnell-fp8` | Quick iterations | Very Fast | 4 steps, guidance 1.0 |
| `flux2_dev_fp8` | High quality | Slow | Needs longer timeout (2 min) |
| `chroma-v.46-flash_fp8` | Balanced | Medium | 12 steps |

### Model-Specific Configurations

Different models need different parameters:

```javascript
const MODEL_CONFIGS = {
  'z_image_turbo_bf16': {
    guidance: 1.0,
    negativePrompt: '',
    baseTimeout: 45000
  },
  'flux1-schnell-fp8': {
    steps: 4,
    guidance: 1.0,
    negativePrompt: '',
    baseTimeout: 45000
  },
  'flux2_dev_fp8': {
    guidance: 3.5,
    negativePrompt: 'malformation, bad anatomy, bad hands, missing fingers, cropped, low quality, bad quality, jpeg artifacts, watermark',
    baseTimeout: 120000  // 2 minutes
  }
};
```

---

## Video Generation

### Recommended Defaults

| Setting | Recommended Value | Notes |
|---------|------------------|-------|
| Resolution | `512x512` | Matches source image |
| FPS | `16` | Smooth playback |
| Duration | `5 seconds` | 80 frames total |
| Token Type | `spark` | Use Spark tokens |

### Video Models

| Model ID | Quality | Speed |
|----------|---------|-------|
| `wan_v2.2-14b-fp8_i2v_lightx2v` | Fast | Quick renders |
| `wan_v2.2-14b-fp8_i2v` | Quality | Slower, better quality |

### Basic Video Generation (Image-to-Video)

```javascript
// Fetch source image as buffer
const imageResponse = await fetch(imageUrl);
const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

const fps = 16;
const durationSeconds = 5;
const frames = fps * durationSeconds; // 80 frames

const videoConfig = {
  type: 'video',
  modelId: 'wan_v2.2-14b-fp8_i2v_lightx2v',  // Fast model
  positivePrompt: 'gentle camera movement, cinematic',
  negativePrompt: '',
  stylePrompt: '',
  numberOfMedia: 1,           // Use numberOfMedia for video (not numberOfImages)
  referenceImage: imageBuffer, // Pass buffer, not URL
  frames: frames,
  fps: fps,
  width: 512,
  height: 512,
  tokenType: 'spark',
  waitForCompletion: true,
  timeout: 300000             // 5 minutes (videos take 90-120s typically)
};

const result = await client.createProject(videoConfig);

if (result.completed && result.videoUrls?.length > 0) {
  console.log('Video URL:', result.videoUrls[0]);
}
```

---

## Event-Based Streaming (Real-Time Updates)

For applications needing real-time progress updates:

```javascript
import { SogniClientWrapper, ClientEvent } from '@sogni-ai/sogni-client-wrapper';

// Setup client with events
const client = new SogniClientWrapper({
  username: process.env.SOGNI_USERNAME,
  password: process.env.SOGNI_PASSWORD,
  network: 'fast',
  autoConnect: false,
  authType: 'cookies'
});

// Listen for individual image completions
client.on(ClientEvent.JOB_COMPLETED, (data) => {
  const { projectId, jobIndex, totalJobs, imageUrl } = data;
  console.log(`Image ${jobIndex + 1}/${totalJobs} completed: ${imageUrl}`);
});

// Listen for progress updates (includes previews)
client.on(ClientEvent.PROJECT_PROGRESS, (data) => {
  const { projectId, percentage, completedJobs, totalJobs } = data;
  console.log(`Progress: ${percentage}%`);
});

// Listen for failures
client.on(ClientEvent.JOB_FAILED, (data) => {
  const { projectId, jobIndex, error } = data;
  console.error(`Image ${jobIndex} failed: ${error}`);
});

await client.connect();

// Create project without waiting (events will notify us)
const projectConfig = {
  type: 'image',
  modelId: 'z_image_turbo_bf16',
  positivePrompt: 'A cosmic nebula',
  tokenType: 'spark',
  waitForCompletion: false,  // Don't wait, use events
  numberOfPreviews: 4,       // Get preview images during render
  width: 512,
  height: 512
};

const result = await client.createProject(projectConfig);
console.log('Project started:', result.project.id);
```

---

## Common Patterns

### Singleton Client (Recommended)

Avoid creating multiple connections:

```javascript
let sogniClient = null;

async function getSogniClient() {
  if (sogniClient && sogniClient.isConnected()) {
    return sogniClient;
  }

  sogniClient = new SogniClientWrapper({
    username: process.env.SOGNI_USERNAME,
    password: process.env.SOGNI_PASSWORD,
    network: 'fast',
    autoConnect: false,
    authType: 'cookies'
  });

  await sogniClient.connect();
  return sogniClient;
}

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (sogniClient?.isConnected?.()) {
    await sogniClient.disconnect();
  }
});
```

### Getting Available Models

```javascript
const client = await getSogniClient();

// Get all available models
const availableModels = await client.getModels();
availableModels.forEach(model => {
  console.log(`${model.id} - workers: ${model.workerCount}`);
});

// Get a specific model
const modelInfo = await client.getModel('z_image_turbo_bf16');

// Get most popular model (fallback)
const popularModel = await client.getMostPopularModel();
```

### Checking Balance

```javascript
const client = await getSogniClient();
const balance = await client.getBalance();
console.log('Spark balance:', balance.spark);
```

### Error Handling

```javascript
try {
  const result = await client.createProject(projectConfig);

  if (result.completed && result.imageUrls?.length > 0) {
    // Success
  } else if (result.completed && !result.imageUrls?.length) {
    // Image was filtered (likely NSFW)
    console.log('Image filtered by content moderation');
  }

} catch (error) {
  // Check for specific error codes
  const errorCode = error.code || error.originalError?.code;
  const errorMessage = error.message || '';

  if (errorCode === 4054 || errorMessage.includes('Premium models require')) {
    console.log('This model requires Premium Spark tokens');
  } else if (errorCode === 4053 || errorMessage.includes('Free Spark')) {
    console.log('This model is not available with Free Spark');
  } else {
    console.error('Generation failed:', error.message);
  }
}
```

---

## Tips and Tricks

### Performance

1. **Use `network: 'fast'`** - Better performance for most use cases
2. **Reuse client connections** - Don't create new clients per request
3. **Use appropriate timeouts** - Fast models (45s), dev models (120s), video (300s)
4. **Batch images carefully** - 4 images per prompt is a good balance

### Quality

1. **Match video dimensions to source image** - Always use same resolution
2. **Use negative prompts for quality models** - Helps avoid artifacts
3. **Guidance scale matters** - Higher for dev models (3.5), lower for turbo (1.0)

### Reliability

1. **Handle NSFW filtering** - Images can be filtered without error
2. **Implement fallback models** - Use `getMostPopularModel()` as fallback
3. **Clean up on exit** - Always disconnect clients properly
4. **Use event streaming for long operations** - Better than polling

### Cost

1. **Always use `tokenType: 'spark'`** - Default token type
2. **512x512 is most efficient** - Good balance of quality and cost
3. **Fast models for iterations** - Use quality models for finals

---

## Environment Variables

```bash
# Required
SOGNI_USERNAME=your_username
SOGNI_PASSWORD=your_password

# Optional - Default model
SOGNI_IMG_MODEL=z_image_turbo_bf16

# Optional - Default dimensions
IMG_WIDTH=512
IMG_HEIGHT=512
IMG_FORMAT=jpg
```

---

## Troubleshooting

### "No models available"
- Check your credentials
- Try reconnecting the client
- Verify Sogni service status

### "Premium Spark Required" (Error 4054)
- The model requires premium tokens
- Switch to a free-tier model like `z_image_turbo_bf16`

### "Free Spark Restricted" (Error 4053)
- Some models don't work with free Spark
- Use a different model

### Timeout Errors
- Increase timeout for slower models
- Check worker availability (`model.workerCount`)

### Connection Issues
- Use `autoConnect: false` and handle connection manually
- Implement reconnection logic for long-running apps

