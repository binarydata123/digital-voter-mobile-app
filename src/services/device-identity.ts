import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_KEY = "politicEase.installationId";

type DeviceIdentity = {
  deviceId: string;
  deviceName: string;
};

let identity: Promise<DeviceIdentity> | null = null;

function getBrowserName(): string {
  if (typeof navigator === "undefined") {
    return "Unknown Browser";
  }

  const ua = navigator.userAgent;

  if (/EdgA?\/|EdgiOS\//i.test(ua)) return "Microsoft Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/SamsungBrowser\//i.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//i.test(ua)) return "Mozilla Firefox";
  if (/CriOS\//i.test(ua)) return "Google Chrome";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    return "Google Chrome";
  }
  if (/Safari\//i.test(ua) && !/Chrome|Chromium|CriOS|Edg/i.test(ua)) {
    return "Safari";
  }

  return "Unknown Browser";
}

export function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (!identity) {
    identity = loadIdentity().catch((error: unknown) => {
      identity = null;
      throw error;
    });
  }

  return identity;
}

async function loadIdentity(): Promise<DeviceIdentity> {
  let deviceId: string | null = null;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      deviceId = window.localStorage.getItem(DEVICE_KEY);
    }
  } else {
    deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
  }

  if (!deviceId) {
    deviceId = Crypto.randomUUID();

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEVICE_KEY, deviceId);
      }
    } else {
      await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
    }
  }

  let deviceName: string;

  if (Platform.OS === "web") {
    deviceName = `Politic Ease · ${getBrowserName()}`;
  } else {
    const manufacturer = Device.manufacturer;
    const modelName = Device.modelName;

    deviceName =
      [manufacturer, modelName].filter(Boolean).join(" ") ||
      `Unknown ${Platform.OS} Device`;
  }

  return {
    deviceId,
    deviceName,
  };
}
