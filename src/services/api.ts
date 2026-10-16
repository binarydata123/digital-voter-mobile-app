import { create } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { notifyAuthSession } from "./auth-session-events";

let invalidateSession: (() => Promise<void>) | null = null;
export function setSessionInvalidationHandler(handler: () => Promise<void>) {
  invalidateSession = handler;
}

const AUTH_TOKEN_KEY = "votersakha.authToken";
const LIVE_API_URL = "https://api.voter-app.ai-developer.cloud/api";

const baseURL = (process.env.EXPO_PUBLIC_API_URL ?? LIVE_API_URL).replace(
  /\/+$/,
  "",
);

console.log("API BASE URL:", baseURL);

let cachedAuthToken: string | null = null;
let hasLoadedStoredToken = false;
let tokenRevision = 0;
let tokenStorageWrite: Promise<void> = Promise.resolve();
export function waitForAuthTokenStorage() { return tokenStorageWrite; }

export const api = create({
  baseURL,
  timeout: 20000,
});

export function setApiAuthToken(token: string | null) {
  tokenRevision++;
  cachedAuthToken = token;
  hasLoadedStoredToken = true;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;

    if (Platform.OS === "web") {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      tokenStorageWrite = tokenStorageWrite.catch(() => {}).then(() => SecureStore.setItemAsync(AUTH_TOKEN_KEY, token));
      tokenStorageWrite.catch((error) => {
        console.log("SecureStore save error:", error);
      });
    }
  } else {
    delete api.defaults.headers.common.Authorization;

    if (Platform.OS === "web") {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    } else {
      tokenStorageWrite = tokenStorageWrite.catch(() => {}).then(() => SecureStore.deleteItemAsync(AUTH_TOKEN_KEY));
      tokenStorageWrite.catch((error) => {
        console.log("SecureStore delete error:", error);
      });
    }
  }
}

export async function getApiAuthToken() {
  if (cachedAuthToken || hasLoadedStoredToken) {
    return cachedAuthToken;
  }

  const revision = tokenRevision;
  try {
    let storedToken: string | null;
    if (Platform.OS === "web") {
      storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    } else {
      storedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    }
    if (revision !== tokenRevision) return cachedAuthToken;
    cachedAuthToken = storedToken;
  } catch (error) {
    if (revision !== tokenRevision) return cachedAuthToken;
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
  async (error) => {
    const code = error?.response?.data?.code;
    const requestToken = error?.config?.headers?.Authorization;
    const token = await getApiAuthToken();
    if (error?.response?.status === 401 && token && requestToken === `Bearer ${token}` &&
        ["SESSION_INVALIDATED", "DEVICE_SESSION_REVOKED"].includes(code) &&
        !["/auth/login", "/login", "/politician/login", "/auth/register"].includes(error?.config?.url)) {
      setApiAuthToken(null);
      await invalidateSession?.().catch((storageError) => {
        console.log("Session cleanup error:", storageError);
      });
      notifyAuthSession({ invalidated: true, message: error.response.data.message || "Please sign in again." });
    }
    if (__DEV__) {
      const requestBaseURL = error?.config?.baseURL ?? baseURL;
      const requestUrl = error?.config?.url ?? "";
      const fullUrl = requestUrl
        ? new URL(requestUrl, `${requestBaseURL}/`).toString()
        : requestBaseURL;

      console.log("API error", {
        baseURL: requestBaseURL,
        code: error?.code,
        fullUrl,
        method: error?.config?.method,
        status: error?.response?.status,
        url: requestUrl,
        message: error?.response?.data?.message ?? error?.message,
      });
    }

    return Promise.reject(error);
  },
);
