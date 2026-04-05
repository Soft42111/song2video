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
    mood: estimateMood(segment),
  };

  try {
    const model = "gemini-2.0-flash";
    const promptText = `
      Act as a Principal Director of Cinematography. 
      Generate TWO highly detailed cinematic visual prompts for shard ${segment.index}.
      
      CONTEXT:
      - Music: ${metadata.genre} at ${metadata.bpm} BPM
      - Style: ${metadata.style}
      - Mood: ${metadata.mood}
      
      1. T2I_PROMPT: A static high-resolution keyframe description. Focus on lighting, world-building, and composition.
      2. I2V_PROMPT: An animation directive. Describe the camera movement and fluid motion that should occur over ${metadata.duration}s.
      
      Output in JSON format: { "t2i": "...", "i2v": "..." }
    `;

    const result = await analyzeSegment(segment.index, { ...metadata, customPrompt: promptText });
    
    // Simple parsing if backend returns the JSON string
    let parsed = { t2i: result.prompt, i2v: result.prompt };
    try {
      if (result.prompt.includes('{')) {
        const jsonMatch = result.prompt.match(/\{.*\}/s);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {}

    return {
      t2iPrompt: parsed.t2i,
      i2vPrompt: parsed.i2v,
      tokens: result.estimatedTokens || 0
    };
  } catch (error) {
    console.error(`Gemini I2V Analysis Error for segment ${segment.index}:`, error);
    const fallback = `${STYLE_PRESETS[style]} responding to ${genre} at ${bpm}bpm.`;
    return {
      t2iPrompt: fallback,
      i2vPrompt: fallback,
      tokens: 0
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
