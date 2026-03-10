# SOGNI SONG2VID STUDIO 🎨🎬🎵

A full-spectrum AI creation studio powered by **Sogni AI** and **Google Gemini**. Generate images, videos, and music — all from your browser.

## ✨ Features

### Generation Modules
| Module | Description | Models |
|--------|-------------|--------|
| **Image (T2I)** | Text-to-Image with style, seed, steps control | Flux 1 Schnell, Flux 1 Dev, SDXL 1.0 |
| **Text→Video (T2V)** | Text-to-Video with FPS, duration, resolution | Wan 2.2 14B T2V |
| **Image→Video (I2V)** | Animate images with reference upload | Wan 2.2 I2V, LTX 2.3 |
| **Song Generation** | AI music with lyrics, tempo, key control | ACE Step 1.5 Turbo |
| **Song2Vid Pipeline** | Full audio-reactive music video synthesis | Gemini + Sogni T2V |

### Core Features
- **Prompt Enhancement** — Sogni Qwen 3.5 powered "Enhance" button on every prompt
- **Token Cost Estimation** — Dynamic cost preview before generation (updates based on quantity, steps, duration, resolution)
- **Direct API Architecture** — Frontend calls Sogni API directly for zero-latency generation
- **Privacy First** — Credentials stored locally in browser IndexedDB
- **Spark & Sogni Tokens** — Flexible billing via the Sogni ecosystem

---

## 🛠️ Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Sogni AI Account](https://sogni.ai) (API Key or username/password)
- [Gemini API Key](https://aistudio.google.com/) (for Song2Vid audio analysis)

### Frontend Setup
```bash
cd front
cp .env.example .env  # Edit VITE_API_URL to point to your backend
npm install
npm run dev
```

### Backend Setup
```bash
cd back
cp .env.example .env  # Add your GEMINI_API_KEY
npm install
npm run dev
```

### Environment Variables

#### Backend (`back/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3001) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for audio analysis |
| `SOGNI_USERNAME` | No | Default Sogni username (users can override in UI) |
| `SOGNI_PASSWORD` | No | Default Sogni password |
| `SOGNI_API_KEY` | No | Default Sogni Cloud API key |

#### Frontend (`front/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend URL (e.g., `http://localhost:3001` or `http://your-ec2-ip:3001`) |

---

## ☁️ Deployment

### Frontend → Vercel
1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set **Root Directory** to `front`
3. Add environment variable: `VITE_API_URL=http://your-backend-url:3001`

### Backend → AWS EC2
```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install dependencies
sudo apt update && sudo apt install -y nodejs npm ffmpeg
sudo npm install -g pm2

# Clone and setup
git clone https://github.com/your-repo/song2video.git
cd song2video/back && npm install

# Create .env with your GEMINI_API_KEY
nano .env

# Start with PM2
pm2 start "node --loader ts-node/esm src/index.ts" --name sogni-backend
pm2 save
```

> [!IMPORTANT]
> Open port **3001** in your EC2 Security Group for the frontend to reach the backend.

---

## 🎯 Token Cost Estimation

Costs are estimated dynamically before generation:

| Type | Formula |
|------|---------|
| **Image** | `0.05 × steps × pixelFactor × quantity` |
| **Video** | `0.1 × frames × pixelFactor × (steps/20) × quantity` |
| **Song** | `0.1 × duration × (steps/50) × quantity` |

Where `pixelFactor = (width × height) / (512 × 512)` and `frames = min(160, duration × fps)`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/models` | Available Sogni models |
| `GET` | `/api/balance` | Token balance |
| `POST` | `/api/enhance-prompt` | Enhance prompt via Qwen 3.5 |
| `POST` | `/api/analyze-audio` | Gemini audio analysis for Song2Vid |
| `POST` | `/api/stitch-video` | FFmpeg video stitching |
| `GET` | `/api/proxy` | Media proxy with retry |

---

## 📜 License
MIT License — Copyright (c) 2025 Basit

## 🤝 Community
Built by **Basit** • [Portfolio](https://Basitresume.xyz/) • [X](https://x.com/soft4211) • Powered by [Sogni.ai](https://sogni.ai)
