# 🚀 Quickstart Guide: Song-to-Video Studio

Welcome to the **Song-to-Video Studio**. Follow this guide to set up your enterprise-grade AI video production environment in under 10 minutes.

---

## 🔧 Prerequisites

Before starting, ensure you have the following installed:
- **Node.js**: v18.0.0 or higher.
- **npm**: v8.0.0 or higher.
- **Modern Browser**: Chrome, Edge, or Brave (for SharedArrayBuffer support in FFmpeg.wasm).

---

## 🔑 Required API Credentials

1. **Authentication**:
   - The app now uses a custom REST API for Authentication.
   - The backend includes mock endpoints for login/registration.
2. **Gemini API**:
   - Obtain an API key from [aistudio.google.com](https://aistudio.google.com/).
3. **Sogni SDK**:
   - Register at [sogni.ai](https://sogni.ai/).
   - Obtain your **API Key** and **Project ID**.

---

## 📦 Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone <repository-url>
cd song-to-video-studio
npm install
```

### 2️⃣ Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_GEMINI_API_KEY=xxx

# Sogni SDK (Credentials stored in browser after login)
# This serves as a default if needed
VITE_SOGNI_PROJECT_ID=xxx
```

---

## ⚡ Running the Pipeline

### 1. Start the Frontend (Development Mode)
```bash
npm run dev
```

### 2. Start the Backend Bridge (Lite Node.js server)
```bash
npm run server
```

---

## 🧩 Usage Workflow

1. **Authentication**: Sign in using your Firebase credentials.
2. **Setup Credentials**: Go to **Settings** and securely enter your **Sogni API Key**. This will be saved to `localStorage`.
3. **Upload Audio**: Drag and drop an MP3/WAV file. The app will automatically analyze BPM and segment the audio.
4. **AI Staging**: Review the Gemini-generated prompts for each segment. Edit them if needed.
5. **Generate**: Click **Generate All**. The Sogni SDK will process segments using the **LTX-2.3** model.
6. **Stitch & Export**: Once all segments are finished, click **Assemble Video**. FFmpeg.wasm will stitch them and provide a download link.

---

## ☁️ Deployment on Render (Backend Only)

Since the Sogni SDK runs in the browser, you only need to host the Gemini API Bridge on Render:

1. **New Web Service**: Connect your GitHub repository to Render.
2. **Environment**: Select `Node.js`.
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**: Add `GEMINI_API_KEY` to your Render dashboard.
6. **Frontend**: Update `VITE_API_BASE_URL` in your `.env` to point to your new Render URL (`https://xxx.onrender.com`).

---

## 🛠️ Troubleshooting

### ⚠️ FFmpeg.wasm Not Loading?
- Ensure you are using a Chromium-based browser.
- Check if your environment supports `SharedArrayBuffer`.
- If running in production, ensure your server sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.

### ⚠️ Sogni Generation Fails?
- Check your balance/tokens.
- Ensure your Sogni API key has permissions for the **LTX-2.3** model.
- Monitor the browser console for specific Sogni SDK error codes.

---

## 🆘 Support
For Enterprise support or feature requests, contact the Sogni Engineering team.