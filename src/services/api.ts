import { create } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "votersakha.authToken";
const LIVE_API_URL = "https://api.voter-app.ai-developer.cloud/api";

const baseURL = (process.env.EXPO_PUBLIC_API_URL ?? LIVE_API_URL).replace(
  /\/+$/,
  "",
);

console.log("API BASE URL:", baseURL);

let cachedAuthToken: string | null = null;
let hasLoadedStoredToken = false;

export const api = create({
  baseURL,
  timeout: 20000,
});

export function setApiAuthToken(token: string | null) {
  cachedAuthToken = token;
  hasLoadedStoredToken = true;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    if (Platform.OS === "web") {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, token).catch((error) => {
        console.log("SecureStore save error:", error);
      });
    }
  } else {
    delete api.defaults.headers.common.Authorization;

    if (Platform.OS === "web") {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch((error) => {
        console.log("SecureStore delete error:", error);
      });
    }
  }
}

export async function getApiAuthToken() {
  if (cachedAuthToken || hasLoadedStoredToken) {
    return cachedAuthToken;
  }

  try {
    if (Platform.OS === "web") {
      cachedAuthToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    } else {
      cachedAuthToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.log("Token storage error:", error);
    cachedAuthToken = null;
  }

  hasLoadedStoredToken = true;
  return cachedAuthToken;
}

api.interceptors.request.use(async (config) => {
  if (config.url) {
    config.url = config.url.replace(/\/{2,}/g, "/");
  }

  const token = await getApiAuthToken();

  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization =
      (config.headers as any).Authorization ?? `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      console.log("API error", {
        url: error?.config?.url,
        method: error?.config?.method,
        status: error?.response?.status,
        message: error?.response?.data?.message ?? error?.message,
      });
    }

    return Promise.reject(error);
  },
);
