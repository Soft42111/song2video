# ⚔️ CLAN: Collaborative Logistics & Application Notes

This document outlines the **Engineering Standards** and **Contribution Guidelines** for the **Song-to-Video Studio**.

---

## 🛡️ Coding Standards

### ⚛️ React 18 Patterns
- Use **Functional Components** and **Hooks** exclusively.
- Implement **Zustand** for global shared state (Audio Segments, Auth, Settings).
- Use **Atomic State Updates** for predictable UI rendering.

### 🍱 Component Structure
Each UI component must include:
1. **Prop Types**: Using JSDoc or TypeScript (if applicable) to ensure data integrity.
2. **Atomic Styling**: Using Tailwind CSS utility classes.
3. **Error Boundaries**: Handle AI and Network failures gracefully.

---

## 🏗️ Technical Specifications

### 🧵 FFmpeg.wasm Integration
- FFmpeg must be loaded within a **dedicated Web Worker** to prevent UI thread blocking.
- Always use `@ffmpeg/util` for processing blobs and file types.
- Ensure **Cross-Origin Opener Policy** (`same-origin`) and **Cross-Origin Embedder Policy** (`require-corp`) are handled.

### 🧠 Gemini Prompt Engineering
Follow the **Cinematic Structuring** for AI prompts:
1. **Subject**: The focal point of the scene.
2. **Action**: The narrative movement within the frame.
3. **Lighting**: The mood-appropriate illumination.
4. **Camera**: The technical movement (Tracking, Pan, Zoom).
5. **Style**: The overall visual aesthetic (e.g., "VHS glitch", "Hyper-realistic 4K").

---

## 🧪 Testing Protocol

### 1. Audio Unit Tests
- Verify segments are within the 5.0–7.0s duration range.
- Validate that the total length of all segments matches the original audio (±100ms).

### 2. Video Integration Tests
- Confirm Sogni SDK returns valid `.mp4` URLs.
- Ensure FFmpeg handles mismatched resolutions gracefully by scaling before stitching.

---

## 🚀 Deployment Pipeline

- **Staging**: Automated deploys to Vercel on every Pull Request.
- **Production**: Merged to `main` and tagged with semantic versioning.

---

## 📜 Code of Conduct
Respect the collaborative nature of this project. Commit early, commit often, and document all complex logic within the code using JSDoc.