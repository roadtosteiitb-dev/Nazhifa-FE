/**
 * LOKATANI – Axios API Client
 *
 * Centralized HTTP client for all API calls.
 * Platform-aware base URL:
 *   - Android Emulator  → http://10.0.2.2:8000/api
 *   - iOS Simulator     → http://localhost:8000/api
 *   - Physical Device   → EXPO_PUBLIC_API_URL (set in .env)
 *
 * Token is loaded from AsyncStorage on each request (for session persistence).
 *
 * To use:
 *   import api from '@/services/apiClient';
 *   const response = await api.get('/lands');
 */
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Platform-aware base URL resolution
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return "https://chatty-seals-yawn.loca.lt/api";
}

export const BASE_URL = resolveBaseUrl();
console.log("BASE_URL =", BASE_URL);


const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds for PostGIS spatial queries
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Bypass-Tunnel-Reminder": "true",
    "bypass-tunnel-reminder": "true",
    "User-Agent": "Bypassed",
  },
});

// Attach JWT token before every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("@lokatani_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Token tidak tersedia, lanjutkan tanpa autentikasi
  }
  return config;
});

// Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("⚠️ Sesi berakhir, silakan login kembali");
    }
    // Re-throw so service layer / components can handle it
    return Promise.reject(error);
  }
);

export default api;
