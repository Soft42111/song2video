# Project Context: Sogni Director AI Video Studio

## 🪐 Vision & Goal
A professional-grade AI video production environment ("Sogni Director") that transforms audio signals into cinematic video sequences. The UI is designed to mimic high-end NLE (Non-Linear Editor) software like DaVinci Resolve or Runway Gen-3.

---

## 🎨 Design System: "Sogni Director" (Masterpiece)
- **Primary Aesthetic**: Cinema-First, Industrial, Professional.
- **Color Palette**: 
  - **Background**: Pure Black (#000000).
  - **Surface**: Studio Noir / Charcoal (#0a0a0b, #121214).
  - **Accent**: Phosphor Cyan (#00f5ff) - Used for primary actions and state indicators.
  - **Secondary**: Crimson (#ff3b3b) - Used for recording/error states.
- **Typography**: 
  - **Outfit**: Bold headings, numeric data, and pro-labels.
  - **Inter**: Functional UI text, descriptions, and inputs.
  - **Tracking**: Ultra-wide (0.15em) for labels, tight (-0.05em) for headings.
- **Layout**: Three-Pane Studio (Media Ingest Left, Production Stage Center, Telemetry Right) with a scrollable Horizontal Film Strip Timeline.

---

## 🏗️ Technical Architecture

### Frontend (React + Vite + Tailwind)
- **Core State**: Managed via `zustand` (Auth) and React Local State (Pipeline).
- **Animations**: Heavy use of `framer-motion` for layout transitions and "Neural" pulses.
- **Icons**: `lucide-react` (Stroke: 1.5 - 2.5 for that "Pro" look).

### Backend (Node.js Bridge)
- **Host**: `http://localhost:3001`
- **Role**: Secure bridge for Sogni SDK and Gemini 2.0 Flash API (isolates heavy SDK from browser).
- **Auth**: REST-based custom auth (currently mock endpoints in `server/index.js`).

### AI/Video Pipeline
- **Analysis**: `aiAnalyzer.js` uses Gemini 2.0 Flash to generate cinematic prompts from audio metadata.
- **Generation**: `sogni.js` calls the backend SDK to generate MP4 segments.
- **Stitching**: `stitcher.js` uses `ffmpeg.wasm` to merge segments + audio.
- **CRITICAL**: Requires **SharedArrayBuffer** support. The server MUST provide `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.

---

## 📂 Component Registry
- **`App.jsx`**: Global orchestration, Auth Terminal, and the "Production Ruler" (Top Nav).
- **`SongUploader.jsx`**: "Media Ingest Bin" - Handles audio parsing and BPM detection.
- **`VideoGenerator.jsx`**: "Production Deck" - Horizontal timeline with clip editors and "Director's Desk" detail view.
- **`TokenEstimator.jsx`**: "Budget Log" - Tracks "Spark" (SPK) token consumption.
- **`VideoStitcher.jsx`**: "Mastering Monitor" - Final export deck with 10-bit HEVC metadata display.

---

## ⚠️ Current Status & Known Issues
- **Frontend Stability**: Recently underwent a 100% redesign. A React crash was identified at `App.jsx:28:37` due to component hoisting (fixed).
- **Rendering**: The "Cinema Stage" relies on an 8K background asset (`director_studio_bg_8k.png`).
- **Auth**: Production-grade identity provider (Clerk/Supabase) is NOT yet integrated; using mock auth.
- **Video Export**: Requires browser-level SharedArrayBuffer activation.

---

## 🛠️ Commands
- **Backend**: `node server/index.js`
- **Frontend**: `npx vite --force --host 127.0.0.1`

---
*Created: 2026-04-05 • Updated by Antigravity AI*
