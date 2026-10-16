import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getSimPhoneNumber } from "../../modules/sim-phone-number/src/getSimPhoneNumber";

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

function formatIndianPhoneNumber(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";

  // Already includes India's country code.
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  // Indian 10-digit mobile number.
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  // Keep other formats unchanged rather than guessing.
  return trimmed;
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
    const baseDeviceName =
      [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") ||
      `Unknown ${Platform.OS} Device`;

    // Default to the device name without a phone number.
    deviceName = baseDeviceName;

    if (Platform.OS === "android") {
      try {
        const phoneNumber = await getSimPhoneNumber();

        if (phoneNumber?.trim()) {
          const formattedNumber = formatIndianPhoneNumber(phoneNumber);

          if (formattedNumber) {
            deviceName = `${baseDeviceName} · ${formattedNumber}`;
          }
        }
      } catch {
        // Ignore SIM detection failures and retain the base device name.
      }
    }
  }

  return {
    deviceId,
    deviceName,
  };
}
