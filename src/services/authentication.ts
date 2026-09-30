import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api, getApiAuthToken, setApiAuthToken } from "./api";
import { deleteVoterDatabase } from "./voter-database";

export type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: "politician";
  ward?: string;
  booth?: string;
  assignedBooths?: string[];
  constituency?: string;
  district?: string;
  state?: string;
  imageUrl?: string;
  bannerImage?: string;
  showVoterPage: boolean;
  showTemplatePage: boolean;
  showSurveyPage: boolean;
};

type LoginPayload = {
  phone: string;
  password: string;
};

type LoginResult = {
  token: string;
  user: AuthUser;
};

let authToken: string | null = null;
let currentUser: AuthUser | null = null;
let hasLoadedStoredUser = false;

const AUTH_USER_KEY = "votersakha.authUser";

function normalizeUser(raw: any): AuthUser {
  const source = raw?.user ?? raw?.data?.user ?? raw?.politician ?? raw?.data ?? raw;
  const role = String(source?.role ?? "politician").toLowerCase();

  if (role !== "politician") {
    throw new Error("Only politician accounts can login to this app.");
  }

  const profile = source?.profile ?? {};
  const states = firstArrayValue(source?.states, profile?.states);
  const districts = firstArrayValue(source?.districts, profile?.districts);

  return {
    id: String(source?.id ?? source?._id ?? source?.politicianId ?? "politician"),
    name: String(source?.name ?? source?.fullName ?? source?.politicianName ?? "Politician"),
    phone: String(source?.phone ?? source?.mobile ?? source?.phoneNumber ?? ""),
    role: "politician",
    ward: source?.ward ?? source?.wardName ?? profile?.ward ?? profile?.wardName,
    booth:
      source?.booth ??
      source?.boothName ??
      source?.assignedBooth ??
      source?.assignedBoothName ??
      profile?.booth ??
      profile?.boothName ??
      profile?.assignedBooth ??
      profile?.assignedBoothName ??
      firstArrayValue(source?.boothNumbers, profile?.boothNumbers)?.[0],
    assignedBooths: normalizeAssignedBooths({ ...profile, ...source }),
    constituency: source?.constituency ?? source?.assemblyName ?? profile?.constituency ?? profile?.assemblyName,
    district: source?.district ?? profile?.district ?? districts?.[0],
    state: source?.state ?? profile?.state ?? states?.[0],
    imageUrl: source?.imageUrl ?? source?.profileImage ?? source?.photo ?? profile?.profileImage,
    bannerImage: source?.bannerImage ?? profile?.bannerImage,
    showVoterPage: normalizeAccessFlag(source?.showVoterPage ?? profile?.showVoterPage),
    showTemplatePage: normalizeAccessFlag(source?.showTemplatePage ?? profile?.showTemplatePage),
    showSurveyPage: normalizeAccessFlag(source?.showSurveyPage ?? profile?.showSurveyPage),
  };
}

function normalizeAccessFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() !== "false";
  return true;
}

function firstArrayValue(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value.map((item) => String(item)).filter(Boolean);
    }
  }

  return undefined;
}

function normalizeAssignedBooths(source: any) {
  const booths =
    source?.assignedBooths ??
    source?.booths ??
    source?.boothNumbers ??
    source?.boothIds ??
    source?.assignedBoothIds ??
    source?.assignedBooth;

  if (!booths) {
    return undefined;
  }

  if (Array.isArray(booths)) {
    return booths
      .map((booth) => String(booth?.name ?? booth?.boothName ?? booth?.id ?? booth?._id ?? booth))
      .filter(Boolean);
  }

  return [String(booths)];
}

function firstStringToken(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().replace(/^Bearer\s+/i, "");
    }
  }

  return null;
}

function extractToken(raw: any) {
  return firstStringToken(
    raw?.token?.accessToken,
    raw?.token?.token,
    raw?.data?.token?.accessToken,
    raw?.data?.token?.token,
    raw?.token,
    raw?.accessToken,
    raw?.authToken,
    raw?.access_token,
    raw?.jwt,
    raw?.data?.token,
    raw?.data?.accessToken,
    raw?.data?.authToken,
    raw?.data?.access_token,
    raw?.data?.jwt,
  );
}

function saveStoredUser(user: AuthUser | null) {
  hasLoadedStoredUser = true;

  if (Platform.OS === "web") {
    if (user) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_KEY);
    }
    return;
  }

  const action = user
    ? SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user))
    : SecureStore.deleteItemAsync(AUTH_USER_KEY);

  action.catch((error) => {
    console.log("User storage error:", error);
  });
}

async function loadStoredUser() {
  if (currentUser || hasLoadedStoredUser) {
    return currentUser;
  }

  try {
    const storedUser =
      Platform.OS === "web"
        ? window.localStorage.getItem(AUTH_USER_KEY)
        : await SecureStore.getItemAsync(AUTH_USER_KEY);

    currentUser = storedUser ? normalizeUser(JSON.parse(storedUser)) : null;
  } catch (error) {
    console.log("User storage load error:", error);
    currentUser = null;
  }

  hasLoadedStoredUser = true;
  return currentUser;
}

export type PoliticianPage = "voters" | "survey" | "template";

export function hasPoliticianPageAccess(
  page: PoliticianPage,
  user: AuthUser | null = getCurrentUser(),
) {
  if (!user) return false;
  if (page === "voters") return user.showVoterPage;
  if (page === "survey") return user.showSurveyPage;
  return user.showTemplatePage;
}

export function getDefaultPoliticianRoute(user: AuthUser | null = getCurrentUser()) {
  if (!user) return null;
  if (user.showVoterPage) return "/politician/voters";
  if (user.showSurveyPage) return "/politician/survey";
  return null;
}

export function setAuthSession(token: string | null, user: AuthUser | null) {
  authToken = token;
  currentUser = user;

  setApiAuthToken(token);
  saveStoredUser(user);
}

export function getAuthToken() {
  return authToken;
}

export function getCurrentUser() {
  return currentUser;
}

export async function ensureAuthSession() {
  const token = authToken ?? (await getApiAuthToken());
  authToken = token;

  if (!token) {
    currentUser = null;
    hasLoadedStoredUser = true;
    throw new Error("Please sign in again to continue.");
  }

  await loadStoredUser();
  return { token, user: currentUser };
}

export async function loginPolitician(payload: LoginPayload): Promise<LoginResult> {
  const endpoints = ["/auth/login", "/politician/login", "/login"];
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      const response = await api.post(endpoint, {
        phone: payload.phone,
        phoneNumber: payload.phone,
        mobile: payload.phone,
        password: payload.password,
        role: "politician",
      });
      const token = extractToken(response.data);
      const user = normalizeUser(response.data);

      if (!token) {
        throw new Error("Login response did not include an auth token.");
      }

      setAuthSession(token, user);
      return { token, user };
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      if (status && status !== 404) {
        break;
      }
    }
  }

  const message =
    (lastError as any)?.response?.data?.message ??
    (lastError as any)?.message ??
    "Unable to login. Please check your credentials.";
  throw new Error(message);
}

export async function logoutPolitician() {
  setAuthSession(null, null);

  try {
    await deleteVoterDatabase();
  } catch (error) {
    console.log("Voter database cleanup error:", error);
  }
}
