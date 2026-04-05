import axios from "axios";
import { useAuthStore } from "../auth/restAuth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Backend API Client
 * Automatically injects REST JWT Token into headers
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * API Actions
 */

/**
 * Analyzes a single audio segment using Gemini
 * @param {number} index - The index of the segment
 * @param {Object} metadata - Audio metadata (mood, bpm, etc.)
 */
export const analyzeSegment = async (index, metadata) => {
  try {
    const response = await apiClient.post('/api/analyze-segment', {
      segmentIndex: index,
      metadata,
    });
    return response.data;
  } catch (error) {
    console.error(`AI Analysis failed for segment ${index}:`, error);
    throw new Error(error.response?.data?.message || 'Gemini analysis failed');
  }
};

/**
 * Checks backend health
 */
export const checkHealth = async () => {
  try {
    const response = await apiClient.get('/api/status');
    return response.data;
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};

export default apiClient;
