# SONG2VID 🎵 ➡️ 🎬

An open-source pipeline to transform your music into cinematic, AI-generated videos using **Sogni AI** and **Google Gemini**.

## 🚀 Overview
SONG2VID analyzes your audio tracks with Gemini-2.5-Flash to generate a structured screenplay. It then synthesizes high-fidelity cinematic visuals segment-by-segment through the Sogni Cloud API, resulting in a cohesive music video that breathes with your sound.

## ✨ Features
- **AI Scene Analysis:** Intelligent lyrical and melodic breakdown.
- **Cinematic Synthesis:** Leverages Sogni's ultra-premium image-to-video models.
- **Privacy First:** Stateless backend with local browser storage via IndexedDB.
- **Spark & Sogni Tokens:** Flexible billing via the Sogni ecosystem.

## 🛠️ Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Sogni AI Account](https://sogni.ai)
- [Gemini API Key](https://aistudio.google.com/)

### 2. Backend Configuration
Navigate to the `back/` directory and create a `.env` file (see `.env.example`):
```env
PORT=3001
GEMINI_API_KEY=your_gemini_key
SOGNI_API_KEY=your_optional_sogni_key
SOGNI_USERNAME=your_username
SOGNI_PASSWORD=your_password
```
> [!NOTE]
> The production API is located at `api.basitresume.xyz`.

### 3. Install & Run
```bash
# Terminal 1: Backend
cd back
npm install
npm run dev

# Terminal 2: Frontend
cd front
npm install
npm run dev
```

## 📜 License
This project is open-source and available under the **MIT License**.

## 🤝 Community
Developed by **Basit**.
Check out more on [Basitresume.xyz](https://Basitresume.xyz/) or follow on [X](https://x.com/soft4211).
Powered by [Sogni.ai](https://sogni.ai).