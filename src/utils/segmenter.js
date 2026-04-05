/**
 * Web Audio API - Intelligent Audio Segmenter
 * Handles BPM detection, peak analysis, and beat-synced slicing.
 */

const MIN_SEGMENT_DURATION = 5.0; // Seconds
const MAX_SEGMENT_DURATION = 7.0; // Seconds

/**
 * Analyzes an audio file and returns an array of segments with metadata
 * @param {File} file - The uploaded audio file
 * @returns {Promise<Object[]>} - Array of segment objects
 */
export const segmentAudio = async (file) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 1. Detect BPM
  const bpm = await detectBPM(audioBuffer);
  
  // 2. Generate Segments based on BPM and Peaks
  const segments = generateSegments(audioBuffer, bpm);

  return {
    bpm,
    segments,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate
  };
};

/**
 * Detects BPM using the OfflineAudioContext
 * @param {AudioBuffer} buffer 
 */
const detectBPM = async (buffer) => {
  const offlineCtx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(150, 0);

  source.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const data = renderedBuffer.getChannelData(0);

  // Simple peak-based BPM estimation
  let peaks = [];
  const threshold = 0.8;
  for (let i = 0; i < data.length; i += buffer.sampleRate / 100) {
    if (data[i] > threshold) {
      peaks.push(i);
    }
  }

  // Calculate average interval between peaks
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60 / (avgInterval / buffer.sampleRate));

  return isNaN(bpm) || bpm < 40 || bpm > 220 ? 120 : bpm; // Fallback to 120 if detection fails
};

/**
 * Divides audio into chunks of 5-7 seconds, aligning with beats
 */
const generateSegments = (buffer, bpm) => {
  const duration = buffer.duration;
  const beatDuration = 60 / bpm;
  const segments = [];
  
  let currentTime = 0;
  let index = 0;

  while (currentTime < duration) {
    // Determine ideal segment length (approx 6s)
    let targetDuration = 6.0;
    
    // Adjust target to be a multiple of beat duration
    const beatsInSegment = Math.round(targetDuration / beatDuration);
    let segmentDuration = beatsInSegment * beatDuration;

    // Constrain to our limits
    segmentDuration = Math.max(MIN_SEGMENT_DURATION, Math.min(MAX_SEGMENT_DURATION, segmentDuration));

    // Final segment adjustment
    if (currentTime + segmentDuration > duration) {
      segmentDuration = duration - currentTime;
    }

    if (segmentDuration < 1.0 && segments.length > 0) {
      // Merge very short final segment with the last one
      segments[segments.length - 1].end = duration;
      segments[segments.length - 1].duration += segmentDuration;
      break;
    }

    segments.push({
      index: index++,
      start: currentTime,
      end: currentTime + segmentDuration,
      duration: segmentDuration,
      status: 'pending', // pending, analyzing, generated, failed
      prompt: '',
      videoUrl: '',
      tokens: 0
    });

    currentTime += segmentDuration;
  }

  return segments;
};

/**
 * Extracts a portion of the audio buffer for preview/playback
 */
export const extractSegmentBuffer = (originalBuffer, start, end, audioCtx) => {
  const sampleRate = originalBuffer.sampleRate;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.floor(end * sampleRate);
  const frameCount = endSample - startSample;

  const newBuffer = audioCtx.createBuffer(
    originalBuffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  for (let channel = 0; channel < originalBuffer.numberOfChannels; channel++) {
    const originalData = originalBuffer.getChannelData(channel);
    const newData = newBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      newData[i] = originalData[startSample + i];
    }
  }

  return newBuffer;
};
