import { analyzeSegment } from "../api/backend";

/**
 * AI Analyzer Module
 * Handles prompt generation for each audio segment using the Gemini API bridge.
 */

const STYLE_PRESETS = {
  cinematic: "High-fidelity cinematic shot, anamorphic lens, 8k resolution, professional color grade.",
  vhs: "1990s VHS glitch aesthetic, low resolution, tracking lines, color bleeding, nostalgic.",
  cyberpunk: "Neon-drenched cyberpunk city, rain-slicked streets, futuristic architecture, glow effects.",
  abstract: "Surreal abstract patterns, flowing energy, vibrant color shifts, hypnotic motion.",
  noir: "High-contrast black and white, dramatic shadows, moody lighting, film noir style."
};

/**
 * Orchestrates the analysis of a single segment
 * @param {Object} segment - The segment metadata
 * @param {string} style - Selected style preset
 * @param {string} genre - Music genre
 * @param {number} bpm - Global BPM
 */
export const getSegmentPrompt = async (segment, style = 'cinematic', genre = 'Music', bpm = 120) => {
  const metadata = {
    index: segment.index,
    duration: segment.duration,
    bpm,
    genre,
    style: STYLE_PRESETS[style] || STYLE_PRESETS.cinematic,
    // Add mood detection logic based on spectral analysis (if available)
    mood: estimateMood(segment),
  };

  try {
    const result = await analyzeSegment(segment.index, metadata);
    return {
      prompt: result.prompt,
      tokens: result.estimatedTokens || 0,
      parameters: result.parameters || {}
    };
  } catch (error) {
    console.error(`Gemini Analysis Error for segment ${segment.index}:`, error);
    // Return a fallback prompt to avoid breaking the pipeline
    return {
      prompt: `${STYLE_PRESETS[style]} responding to ${genre} music at ${bpm}bpm.`,
      tokens: 0,
      parameters: {}
    };
  }
};

/**
 * Estimates mood based on segment position and duration
 * (Placeholder for more complex spectral analysis)
 */
const estimateMood = (segment) => {
  if (segment.index === 0) return 'Intro / Atmospheric';
  if (segment.duration > 6.5) return 'Building / Tension';
  if (segment.index % 2 === 0) return 'Energetic / Melodic';
  return 'Rhythmic / Groovy';
};

/**
 * Formats a prompt with cinematic modifiers
 * @param {string} basePrompt 
 * @param {string} style 
 */
export const formatCinematicPrompt = (basePrompt, style = 'cinematic') => {
  const prefix = STYLE_PRESETS[style] || STYLE_PRESETS.cinematic;
  return `${prefix} ${basePrompt} Cinematic lighting, masterwork.`;
};
