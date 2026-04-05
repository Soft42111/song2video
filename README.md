# 🎵 Song-to-Video Studio (v3.0) — Enterprise AI Video Pipeline

## 🌌 Project Vision
The **Song-to-Video Studio** is a browser-native platform designed for professional music video creation. It leverages cutting-edge AI models (Gemini for creative staging and Sogni LTX-2.3 for generation) and high-performance client-side processing (Web Audio API and FFmpeg.wasm) to provide a seamless, end-to-end production environment.

## 🚀 Key Features
- **Intelligent Audio Segmentation**: Automatic peak and BPM detection using the Web Audio API for beat-synced video transitions.
- **AI-Driven Visual Staging**: Gemini-powered prompt engineering that analyzes audio mood/tempo to generate descriptive generation prompts.
- **High-Fidelity Generation**: Native integration with the Sogni SDK using the **LTX-2.3 22B Diffusion Transformer** model.
- **Client-Side Assembly**: Enterprise-grade video stitching using FFmpeg.wasm in a multi-threaded Web Worker environment.
- **Token Governance**: Real-time Sogni/Spark token estimation and tracking.
- **Security First**: Local-only storage for sensitive API credentials via IndexedDB/localStorage.

---

## 🏗️ System Architecture

### 1. Ingestion & Analysis Layer (`src/utils/segmenter.js`)
- **Web Audio API**: Decodes files into a `PCM` buffer.
- **FFT Analysis**: Used for spectral analysis and peak detection.
- **Segmentation**: Chunks audio into 5.0–7.0s intervals, ensuring cuts align with the nearest musical beat to maintain rhythmic consistency.

### 2. AI Staging Layer (`src/utils/aiAnalyzer.js`)
- **Gemini API**: Receives a JSON-structured metadata object (mood, genre, tempo).
- **Staging Logic**: Converts metadata into a cinematic visual prompt, including camera movement, lighting, and subject focus.

### 3. Generation Layer (`src/utils/sogni.js`)
- **Sogni SDK**: Communicates with the Sogni Supernet via WebSockets.
- **Model Configuration**: Defaults to **LTX-2.3** for 720p/1080p outputs.
- **Robustness**: Implements exponential backoff for rate limits and automated retries.

### 4. Assembly Layer (`src/utils/stitcher.js`)
- **FFmpeg.wasm**: Uses the latest v0.12+ CORE for WebAssembly-based encoding.
- **Stitching Logic**: Generates an FFmpeg project file (concat script) to merge generated `.mp4` chunks with the original master audio.

---

## 🛠️ Technical Stack
- **Frontend**: React 18, Vite 5, Tailwind CSS.
- **AI**: Google Gemini Pro (Backend), Sogni LTX-2.3 (SDK).
- **Video**: FFmpeg.wasm, Web Worker API.
- **Auth**: Custom REST Authentication (JWT).
- **State**: Zustand (Atomic State Management).

---

## 📂 Project Structure
```text
song-to-video-studio/
├── src/
│   ├── components/       # React UI Components
│   ├── utils/            # Core business logic (Audio, AI, FFmpeg)
│   ├── api/              # Backend bridge
│   ├── auth/             # REST Auth configuration
│   │   └── restAuth.js
│   └── App.jsx           # Main entry point
├── docs/                 # Detailed documentation
├── .env.example          # Environment template
├── package.json          # Dependency manifest
└── vite.config.js        # High-performance Vite build config
```

## 🔒 Security Policy
The Song-to-Video Studio ensures that **no generation credentials** (Sogni API Keys) ever touch our backend servers. They are stored locally in the user's browser using `localStorage`.

---

## 📜 License
This project is licensed under the MIT License. Models used (LTX-2.3) are subject to Sogni and LTX community licensing.