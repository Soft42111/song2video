import { create } from 'zustand';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Custom hook for managing Auth state via REST API
 */
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('STUDIO_USER')) || null,
  token: localStorage.getItem('STUDIO_TOKEN') || null,
  loading: false,
  error: null,

  login: async (username, password, apiKey) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password, apiKey });
      const { user, token } = response.data;
      
      localStorage.setItem('STUDIO_USER', JSON.stringify(user));
      localStorage.setItem('STUDIO_TOKEN', token);
      if (apiKey) localStorage.setItem('SOGNI_API_KEY', apiKey);
      
      set({ user, token, loading: false });
      return user;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Login failed', loading: false });
      throw new Error(err.response?.data?.message || 'Login failed');
    }
  },

  register: async (username, password, apiKey) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, { username, password, apiKey });
      const { user, token } = response.data;
      
      localStorage.setItem('STUDIO_USER', JSON.stringify(user));
      localStorage.setItem('STUDIO_TOKEN', token);
      if (apiKey) localStorage.setItem('SOGNI_API_KEY', apiKey);
      
      set({ user, token, loading: false });
      return user;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Registration failed', loading: false });
      throw new Error(err.response?.data?.message || 'Registration failed');
    }
  },

  logout: () => {
    localStorage.removeItem('STUDIO_USER');
    localStorage.removeItem('STUDIO_TOKEN');
    set({ user: null, token: null });
  }
}));
