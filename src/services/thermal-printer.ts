export type ThermalPrinterDevice = {
  address: string;
  connected?: boolean;
  deviceClass?: number;
  isPaired?: boolean;
  majorDeviceClass?: number;
  name: string;
};

const unavailableMessage =
  "Bluetooth thermal printing is available in the Android development or production build only.";

export function isThermalPrinterAvailable() {
  return false;
}

export function isLikelyThermalPrinter(_device: ThermalPrinterDevice) {
  return false;
}

export async function listThermalPrinters(): Promise<ThermalPrinterDevice[]> {
  throw new Error(unavailableMessage);
}

export async function getSavedThermalPrinter(): Promise<ThermalPrinterDevice | null> {
  return null;
}

export async function pairThermalPrinter(_device: ThermalPrinterDevice) {
  throw new Error(unavailableMessage);
}

export async function openThermalPrinterSettings() {
  throw new Error(unavailableMessage);
}

export async function printThermalTestReceipt(_device: ThermalPrinterDevice) {
  throw new Error(unavailableMessage);
}

export type ThermalVoterSlipOptions = {
  bannerImage?: string;
  showBanner?: boolean;
};

export async function printThermalVoterSlip(
  _voter: unknown,
  _device: ThermalPrinterDevice,
  _options: ThermalVoterSlipOptions = {},
) {
  throw new Error(unavailableMessage);
}
