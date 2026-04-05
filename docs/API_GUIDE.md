# 🔌 API_GUIDE: Song-to-Video Studio (Backend Bridge)

The **Song-to-Video Studio** uses a "Backend-Lite" architecture to manage sensitive AI requests (Gemini) while maintaining efficient client-side generation.

---

## 🏛️ Architecture Overview

- **Frontend**: Handles Sogni SDK, FFmpeg.wasm, and Audio Analysis.
- **Backend (Node.js/Express)**: Proxy for the Gemini API.
- **Authentication**: Custom REST API (JSON Web Tokens).

---

## 🧠 Gemini Integration (POST `/api/analyze-segment`)

The frontend sends segment metadata (Mood, Genre, BPM) to the backend, which returns a cinematic prompt for the Sogni SDK.

### 📥 Request Body
```json
{
  "segmentIndex": 1,
  "metadata": {
    "mood": "Aggressive",
    "genre": "Techno",
    "bpm": 128,
    "hasPeak": true,
    "duration": 5.2
  }
}
```

### 📤 Response Body (Gemini-Generated)
```json
{
  "prompt": "Hyper-realistic cyberpunk street at night, neon lights pulsing at 128bpm, wet pavement, slow tracking camera, cinematic anamorphic lens flare.",
  "parameters": {
    "guidance_scale": 8.0,
    "num_inference_steps": 50
  }
}
```

---

## 🔐 Authentication Middleware

All backend requests must include a valid JWT Token in the Authorization header:
```text
Authorization: Bearer <JWT_TOKEN>
```

---

## ⚡ Deployment & Hosting

### 🛠️ Local Development
To run the backend bridge locally:
```bash
cd backend
npm install
npm run start
```
Default port: `3001` or as specified in `VITE_API_BASE_URL`.

### ☁️ Production Hosting
- Recommended for **Vercel** or **Heroku**.
- Ensure the `GEMINI_API_KEY` is set in the environment variables.

---

## 📊 Endpoints Table

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/status` | Check Service Health | No |
| POST | `/api/analyze-segment` | Get Gemini prompt | Yes |
| GET | `/api/user/profile` | (Optional) Fetch profile | Yes |

---

## 📜 Error Codes
- **401 Unauthorized**: Missing or expired Firebase token.
- **429 Too Many Requests**: Gemini API quota reached.
- **500 Internal Server Error**: Gemini prompt engineering failure.