import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import type {
  BluetoothDevice,
  BluetoothEscposPrinterType,
  BluetoothManagerType,
} from "@vardrz/react-native-bluetooth-escpos-printer";
import { getApiAuthToken } from "@/services/api";
import type { Voter } from "@/services/voters";

const SAVED_PRINTER_KEY = "digital-voter.thermal-printer";

export type ThermalPrinterDevice = BluetoothDevice & {
  deviceClass?: number;
  isPaired?: boolean;
  majorDeviceClass?: number;
};

type EscposPrinter = BluetoothEscposPrinterType & {
  printUnicodeText(text: string, textSize: number): Promise<void>;
  printerAlign(align: number): Promise<void>;
  printerInit(): Promise<void>;
};

type NativeBluetoothManager = Omit<
  BluetoothManagerType,
  "enableBluetooth" | "getConnectedDevice"
> & {
  // The package returns the paired-device list when Bluetooth is already on,
  // although its published TypeScript type incorrectly says boolean.
  enableBluetooth(): Promise<unknown>;
  getConnectedDeviceAddress(): Promise<string | null>;
  openBluetoothSettings(): Promise<void>;
};

type PrinterModule = {
  BluetoothEscposPrinter: EscposPrinter;
  BluetoothManager: NativeBluetoothManager;
};

function getPrinterModule(): PrinterModule {
  // Expo Go does not include this third-party native module. Do not require the
  // package until we have confirmed this is a custom development/production build.
  if (
    !NativeModules.BluetoothManager ||
    !NativeModules.BluetoothEscposPrinter ||
    !NativeModules.BluetoothTscPrinter
  ) {
    throw new Error(
      "Bluetooth printing needs the Android development or production build. It cannot run in Expo Go.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@vardrz/react-native-bluetooth-escpos-printer") as PrinterModule;
}

function readableError(error: unknown) {
  const message =
    error instanceof Error && error.message ? error.message : String(error || "");
  if (message.includes("NOT_STARTED")) {
    return "Bluetooth scan could not start. Allow Nearby devices and Location permissions, turn on Bluetooth, then try scanning again.";
  }
  return message || "Unable to communicate with the printer.";
}

async function requestBluetoothPermissions() {
  const androidApiLevel = Number(Platform.Version);
  const permissions =
    androidApiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          // This library also checks the legacy location permission before it
          // starts discovery, including on Android 12 and newer.
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]
      : [
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.some(
    (permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );

  if (denied) {
    throw new Error("Allow Nearby devices permission to find and use a printer.");
  }
}

async function ensureBluetoothReady() {
  const { BluetoothManager } = getPrinterModule();
  await requestBluetoothPermissions();

  if (!(await BluetoothManager.isBluetoothEnabled())) {
    // Opens Android's standard "Allow Bluetooth to turn on" prompt. The user
    // remains in control; if they decline, the native promise rejects below.
    try {
      await BluetoothManager.enableBluetooth();
    } catch {
      throw new Error("Bluetooth is required to find and print to a nearby device.");
    }

    if (!(await BluetoothManager.isBluetoothEnabled())) {
      throw new Error("Bluetooth is required to find and print to a nearby device.");
    }
  }
}

async function connectPrinter(device: ThermalPrinterDevice) {
  await ensureBluetoothReady();
  const { BluetoothManager } = getPrinterModule();
  const connectedAddress = await BluetoothManager.getConnectedDeviceAddress();

  if (connectedAddress !== device.address) {
    if (connectedAddress) {
      await BluetoothManager.disconnect(connectedAddress);
    }
    await BluetoothManager.connect(device.address);
  }

  await SecureStore.setItemAsync(SAVED_PRINTER_KEY, JSON.stringify(device));
}

function normalizeDevices(value: unknown, isPaired: boolean): ThermalPrinterDevice[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    try {
      const device =
        typeof item === "string"
          ? (JSON.parse(item) as ThermalPrinterDevice)
          : (item as ThermalPrinterDevice);
      return device?.address ? [{ ...device, isPaired }] : [];
    } catch {
      return [];
    }
  });
}

function normalizeScanResult(value: unknown) {
  if (!value) return { found: [] as ThermalPrinterDevice[], paired: [] as ThermalPrinterDevice[] };

  try {
    const result =
      typeof value === "string"
        ? (JSON.parse(value) as { found?: unknown; paired?: unknown })
        : (value as { found?: unknown; paired?: unknown });

    return {
      found: normalizeDevices(result.found, false),
      paired: normalizeDevices(result.paired, true),
    };
  } catch {
    return { found: [] as ThermalPrinterDevice[], paired: [] as ThermalPrinterDevice[] };
  }
}

const printerNamePattern = /(?:printer|print|thermal|pos|esc\/?pos|mpt|xprinter|zebra|rongta|bixolon|epson)/i;
const imagingDeviceClass = 0x0600;

/** Android's device class is optional, so use it together with printer-name hints. */
export function isLikelyThermalPrinter(device: ThermalPrinterDevice) {
  return (
    device.majorDeviceClass === imagingDeviceClass ||
    printerNamePattern.test(device.name || "")
  );
}

async function printTextReceipt(content: string) {
  const { BluetoothEscposPrinter: printer } = getPrinterModule();
  await printer.printerInit();
  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.printText("DIGITAL VOTER\n", {
    encoding: "GBK",
    widthtimes: 1,
    heigthtimes: 1,
  });
  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printText(content.replace("DIGITAL VOTER\n", ""), {
    encoding: "GBK",
  });
}

function receiptValue(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text === "undefined" || text === "null" ? "N/A" : text;
}

function guardianName(value: unknown) {
  const text = receiptValue(value);
  const relationStart = text.lastIndexOf(" (");
  return relationStart > 0 && text.endsWith(")")
    ? text.slice(0, relationStart)
    : text;
}

function buildVoterReceipt(voter: Voter) {
  const address = [
    voter.houseNo && voter.houseNo !== "N/A" ? `House No. ${voter.houseNo}` : "",
    voter.ward ? `Ward ${voter.ward}` : "",
    voter.district,
    voter.state,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Name: ${receiptValue(voter.name)}\n`,
    voter.hindiName ? `${receiptValue(voter.hindiName)}\n` : "",
    `EPIC No: ${receiptValue(voter.epicNo)}\n`,
    `पिता का नाम: ${guardianName(voter.guardian)}\n`,
    `Age: ${receiptValue(voter.age)}    Gender: ${receiptValue(voter.gender)}\n`,
    `Serial No: ${receiptValue(voter.serialNo || voter.id)}\n`,
    `House / Address: ${receiptValue(address)}\n`,
    `Booth No: ${receiptValue(voter.booth)}\n`,
    `Polling Station: ${receiptValue(voter.pollingStation)}\n`,
    "\n\n\n",
  ].join("");
}

async function readBannerBase64(bannerImage?: string) {
  if (!bannerImage) return null;
  if (bannerImage.startsWith("data:")) return bannerImage.split(",", 2)[1] ?? null;

  const resolvedBannerImage = bannerImage.startsWith("/")
    ? `https://api.votersakha.tech${bannerImage}`
    : bannerImage;
  let uri = resolvedBannerImage;
  let temporaryUri: string | null = null;
  try {
    if (resolvedBannerImage.startsWith("http://") || resolvedBannerImage.startsWith("https://")) {
      temporaryUri = `${FileSystem.cacheDirectory}thermal-banner-${Date.now()}`;
      const token = await getApiAuthToken();
      const downloaded = await FileSystem.downloadAsync(resolvedBannerImage, temporaryUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (downloaded.status < 200 || downloaded.status >= 300) {
        throw new Error(`Banner download failed (${downloaded.status}).`);
      }
      uri = downloaded.uri;
    }
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } finally {
    if (temporaryUri) {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => {});
    }
  }
}

export function isThermalPrinterAvailable() {
  return true;
}

export async function listThermalPrinters(): Promise<ThermalPrinterDevice[]> {
  await ensureBluetoothReady();
  const { BluetoothManager } = getPrinterModule();
  const devices = new Map<string, ThermalPrinterDevice>();

  // Always return bonded devices. This works on Android versions where the
  // package's legacy live-discovery method is rejected by the OS.
  const pairedFromAdapter = normalizeDevices(
    await BluetoothManager.enableBluetooth(),
    true,
  );
  pairedFromAdapter.forEach((device) => devices.set(device.address, device));

  try {
    // This package's Android method resolves a JSON string even though its
    // TypeScript declaration says it returns an object.
    const { paired, found } = normalizeScanResult(
      await BluetoothManager.scanDevices(),
    );

    paired.forEach((device) => {
      if (device.address) {
        devices.set(device.address, { ...device, isPaired: true });
      }
    });
    found.forEach((device) => {
      if (device.address && !devices.has(device.address)) {
        devices.set(device.address, { ...device, isPaired: false });
      }
    });
  } catch (error) {
    // A paired printer remains usable even when Android rejects live discovery.
    if (!devices.size) throw new Error(readableError(error));
  }

  return [...devices.values()];
}

export async function openThermalPrinterSettings() {
  await ensureBluetoothReady();
  await getPrinterModule().BluetoothManager.openBluetoothSettings();
}

export async function getSavedThermalPrinter(): Promise<ThermalPrinterDevice | null> {
  const saved = await SecureStore.getItemAsync(SAVED_PRINTER_KEY);
  if (!saved) return null;

  try {
    const device = JSON.parse(saved) as ThermalPrinterDevice;
    return device.address ? { ...device, isPaired: true } : null;
  } catch {
    await SecureStore.deleteItemAsync(SAVED_PRINTER_KEY);
    return null;
  }
}

export async function pairThermalPrinter(device: ThermalPrinterDevice) {
  try {
    // Android displays its system pairing prompt when this first SPP connection
    // needs a bond. The library has discovery/connect APIs, but no standalone
    // create-bond API.
    await connectPrinter(device);
  } catch (error) {
    throw new Error(readableError(error));
  }
}

export async function printThermalTestReceipt(device: ThermalPrinterDevice) {
  try {
    await connectPrinter(device);
    await printTextReceipt("PRINTER TEST\n--------------------------------\nBluetooth connection successful.\n\n\n");
  } catch (error) {
    throw new Error(readableError(error));
  }
}

export type ThermalVoterSlipOptions = {
  bannerImage?: string;
  showBanner?: boolean;
};

/** Prints a banner image, when requested, followed by compact 58 mm ESC/POS text. */
export async function printThermalVoterSlip(
  voter: Voter,
  device: ThermalPrinterDevice,
  options: ThermalVoterSlipOptions = {},
) {
  try {
    await connectPrinter(device);
    const { BluetoothEscposPrinter: printer } = getPrinterModule();
    await printer.printerInit();

    if (options.showBanner) {
      const bannerBase64 = await readBannerBase64(options.bannerImage);
      if (!bannerBase64) {
        throw new Error("Banner image could not be loaded for this voter slip.");
      }
      await printer.printerAlign(printer.ALIGN.CENTER);
      await printer.printPic(bannerBase64, {
        width: 350,
        center: true,
        paperSize: 58,
        autoCut: false,
      });
    }

    // Android draws this receipt with its Unicode font before sending it to
    // ESC/POS. This preserves Hindi characters without using a UI snapshot.
    await printer.printUnicodeText(buildVoterReceipt(voter), 23);
  } catch (error) {
    throw new Error(readableError(error));
  }
}
