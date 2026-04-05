# 🎬 Sogni SDK Technical Deep Dive (LTX-2.3 Edition)

The **Sogni SDK** is a powerful client-side interface for interacting with the Sogni AI Video Supernet. This document focuses on using the **LTX-2.3 22B Diffusion Transformer** model for high-fidelity music video generation.

---

## 🏗️ SDK Architecture (`@sogni-ai/sogni-client`)

The SDK uses an event-based system over WebSockets to communicate with Sogni's high-performance inference clusters.

### 1. Initialization
The Sogni client is initialized with an API key and Project ID:
```javascript
import { SogniClient } from '@sogni-ai/sogni-client';

const client = new SogniClient({
  apiKey: localStorage.getItem('SOGNI_API_KEY'),
  projectId: import.meta.env.VITE_SOGNI_PROJECT_ID
});
```

---

## 🎥 LTX-2.3 Model Parameters

LTX-2.3 is optimized for cinematic movement and high resolution. Below are the key parameters used in the **Song-to-Video Studio**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | REQUIRED | Visual description of the scene. |
| `negative_prompt` | string | "" | Elements to exclude (e.g., "blur, low quality"). |
| `width` | integer | 1280 | Width (720p/1080p supported). |
| `height` | integer | 720 | Height (720p/1080p supported). |
| `num_frames` | integer | 121 | Number of frames (approx. 5 seconds at 24fps). |
| `fps` | integer | 24 | Frames per second. |
| `guidance_scale` | float | 7.5 | Creative adherence to the prompt. |
| `num_inference_steps` | integer | 50 | Quality of the generation (higher = more detailed). |
| `seed` | integer | random | Reproducibility factor. |

---

## 💰 Token Estimation Logic (Sogni/Spark)

This application provides real-time token usage estimation based on the **Spark** token system.

### Formula:
Tokens are calculated using **Resolution**, **Frame Count**, and **Model Complexity**:
```text
Tokens = (Width * Height * NumFrames * ModelMultiplier) / NormalizationFactor
```

### Studio Calculation:
For a standard 5-second 720p clip (1280x720, 121 frames) on LTX-2.3:
- **Width**: 1280
- **Height**: 720
- **NumFrames**: 121
- **LTX-2.3 Multiplier**: 1.5x (compared to standard SDXL-Video models)
- **Token Estimate**: Approximately **18,000 to 22,000 Spark Tokens**.

---

## 🛠️ SDK Job Management

Jobs are asynchronous and emit events throughout their lifecycle:

```javascript
const job = await client.createVideoJob({
  model: 'ltx-2.3',
  params: { prompt: "Cinematic sunset over the ocean", ... }
});

job.on('progress', (data) => {
  console.log(`Generation Progress: ${data.percentage}%`);
});

job.on('completed', (videoUrl) => {
  console.log(`Video complete: ${videoUrl}`);
});

job.on('error', (err) => {
  console.error(`Sogni Error: ${err.message}`);
});
```

---

## ⚠️ Error Handling & Rate Limits

The Studio application implements a **Global Error State** for Sogni:
- **Code 429**: Rate Limit Reached. Studio will pause for 30s and resume.
- **Code 402**: Insufficient Credits. Studio will prompt the user to top up.
- **Code 500**: Supernet Node Error. Studio will automatically retry once on a different node.

---

## 📜 API Reference
For the full SDK documentation, refer to the [official Sogni Docs](https://sogni.ai/docs).