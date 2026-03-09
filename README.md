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
> For production, set the `VITE_API_URL` environment variable in your frontend hosting service to point to your deployed backend.

### 🌐 Free Hosting Options
- **Frontend**: [Vercel](https://vercel.com) (Free Tier) - Root: `front`
- **Backend**: [Render.com](https://render.com) (Free "Web Service") - Root: `back` 
    - **Build Command**: `npm install`
    - **Start Command**: `npm run dev`
    - **Env Vars**: 
        - `GEMINI_API_KEY`: *(Your global key)*
        - `PORT`: `3001`

> [!IMPORTANT]
> This app is designed for users to provide their **own** Sogni credentials in the UI. You only need to provide the `GEMINI_API_KEY` in the hosting environment.

---

## 📜 License
This project is open-source and available under the **MIT License**.

## 🤝 Community
Developed by **Basit**.
Check out more on [Basitresume.xyz](https://Basitresume.xyz/) or follow on [X](https://x.com/soft4211).
Powered by [Sogni.ai](https://sogni.ai).

---

### 🧪 Ready to Test?
Check out the [Full Tester Guide](./TesterGuide.md) for step-by-step instructions.