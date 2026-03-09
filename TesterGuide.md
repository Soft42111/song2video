# 🧪 Tester Guide: SONG2VID

Welcome to the testing phase of **SONG2VID**! This guide will walk you through the core flow to ensure everything is working as intended.

## 🛠️ 1. Setup & Launch
1.  **Clone the Repo**: `git clone https://github.com/Soft42111/song2video.git`
2.  **Environment Setup**:
    -   Go to `back/` and create a `.env` file.
    -   Add your `GEMINI_API_KEY`, `SOGNI_USERNAME`, and `SOGNI_PASSWORD`.
3.  **Run Servers**:
    -   **Backend**: `cd back && npm install && npm run dev`
    -   **Frontend**: `cd front && npm install && npm run dev`
4.  **Open the App**: Visit `http://localhost:5173`.
    -   **Production**: Set `VITE_API_URL` in your hosting provider (e.g., Vercel/Netlify) to your backend's public URL.

## 🎨 2. The Core Generation Flow
Testing the end-to-end "Song-to-Video" pipeline:

1.  **Authentication**: Click the **Settings (Gear)** icon. Enter your Sogni credentials or Cloud API Key.
2.  **Upload**: Select an MP3/WAV file. The app will immediately start analyzing the audio with Gemini.
3.  **Wait for Analysis**: You'll see a checklist of "Parts" (verses/lines) appearing as Gemini breaks down the song.
4.  **Initiate Generation**: Once analysis is complete, click the **"INITIATE GENERATION"** button.
5.  **Watch the Progress**:
    -   **Part 1** should start "Generating image" (0% -> 100%).
    -   It will then transition to "Video animation".
    -   This repeats for all parts of the song.
6.  **Stitching**: Once all parts are done, the server will stitch them into a master video.
7.  **Final Reveal**: The video will appear in the main player, and you'll have the option to save it.

## 📂 3. Persistence & History
-   Click the **History (Archive)** icon in the header to see your previous generations.
-   Everything is stored locally in your browser's **IndexedDB**, so the data persists even after a page refresh.

## ⚖️ 4. Legal & Policy
-   Scroll to the **Footer**.
-   Click **MIT License**, **Terms of Service**, or **Privacy Policy** to verify the information in the new Policy Modal.
-   Check the ecosystem links (Sogni AI, Basit, X) to ensure they open correctly.

## 🐛 What to Look For
-   Does the **Spark Balance** show correctly (around 458 Spark)?
-   Does **Part 1** get stuck at 0%? (It should now move steadily).
-   Are the transition animations smooth?
-   Does the final video playback correctly?

Enjoy the cinematic experience! 🚀
