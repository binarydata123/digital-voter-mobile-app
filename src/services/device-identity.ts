import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_KEY = "politicEase.installationId";
let identity: Promise<{ deviceId: string; deviceName: string }> | null = null;

export function getDeviceIdentity() {
  if (!identity) {
    identity = loadIdentity().catch((error) => {
      identity = null;
      throw error;
    });
  }
  return identity;
}

async function loadIdentity() {
  let deviceId = Platform.OS === "web"
    ? window.localStorage.getItem(DEVICE_KEY)
    : await SecureStore.getItemAsync(DEVICE_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    if (Platform.OS === "web") window.localStorage.setItem(DEVICE_KEY, deviceId);
    else await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
  }
  // Installation identity is deliberately independent of hardware identifiers.
  return { deviceId, deviceName: `Politic Ease · ${Platform.OS} ${Platform.Version}` };
}
