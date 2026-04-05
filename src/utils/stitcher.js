import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * FFmpeg.wasm Module
 * Handles video segment concatenation and final audio merging.
 */

let ffmpeg = null;

/**
 * Loads FFmpeg and its WebAssembly core
 * @param {Function} onProgress - Callback for loading progress
 */
export const loadFFmpeg = async (onProgress = null) => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on("log", ({ message }) => {
    console.log("[FFmpeg Log]", message);
  });

  ffmpeg.on("progress", ({ progress, time }) => {
    if (onProgress) onProgress(progress * 100);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
};

/**
 * Stitches multiple video URLs into a single MP4 with original audio overlay
 * @param {string[]} videoUrls - List of video segment URLs
 * @param {File} audioFile - Original audio track
 * @param {Object} options - Resolution and quality settings
 */
export const stitchVideos = async (videoUrls, audioFile, options = {}) => {
  const instance = await loadFFmpeg();
  
  // 1. Write audio to virtual FS
  const audioName = "audio_master.mp3";
  await instance.writeFile(audioName, await fetchFile(audioFile));

  // 2. Write each video to virtual FS and create concat script
  let concatContent = "";
  for (let i = 0; i < videoUrls.length; i++) {
    const videoName = `segment_${i}.mp4`;
    await instance.writeFile(videoName, await fetchFile(videoUrls[i]));
    concatContent += `file ${videoName}\n`;
  }

  const concatScriptName = "concat.txt";
  await instance.writeFile(concatScriptName, concatContent);

  // 3. First Pass: Concatenate videos
  // Command: -f concat -safe 0 -i concat.txt -c copy intermediate.mp4
  await instance.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", concatScriptName,
    "-c", "copy",
    "intermediate.mp4"
  ]);

  // 4. Second Pass: Merge with master audio (sync)
  // Command: -i intermediate.mp4 -i audio_master.mp3 -c:v copy -c:a aac -shortest output.mp4
  const outputFile = "final_music_video.mp4";
  await instance.exec([
    "-i", "intermediate.mp4",
    "-i", audioName,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    outputFile
  ]);

  // 5. Read output and return as Blob URL
  const data = await instance.readFile(outputFile);
  const blob = new Blob([data.buffer], { type: "video/mp4" });
  
  // 6. Cleanup virtual FS
  await instance.deleteFile("intermediate.mp4");
  await instance.deleteFile(audioName);
  await instance.deleteFile(concatScriptName);

  return URL.createObjectURL(blob);
};

/**
 * Checks if SharedArrayBuffer is enabled (Required for FFmpeg.wasm)
 */
export const isThreadReady = () => {
  return typeof SharedArrayBuffer !== 'undefined';
};
