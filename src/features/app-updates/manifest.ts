export type UpdateManifest = {
  version: string;
  versionCode: number;
  apkUrl: string;
  mandatory: boolean;
  releaseNotes: string;
  sha256: string;
};
export function httpsUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("Missing HTTPS URL");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Updates require HTTPS");
  return url.href;
}
export function parseManifest(value: unknown): UpdateManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid update manifest");
  const data = value as Record<string, unknown>;
  const mandatory = data.mandatory ?? false;
  const releaseNotes = data.releaseNotes ?? "";
  if (data.platform !== undefined && data.platform !== "android") throw new Error("Expected Android update");
  if (data.packageName !== undefined && data.packageName !== "com.binarydatasteam.digitalvoter") throw new Error("Update belongs to another app");
  if (data.fileType !== undefined && data.fileType !== "apk") throw new Error("Expected APK update");
  if (typeof data.version !== "string" || !data.version.trim() || data.version.length > 100 ||
      !Number.isSafeInteger(data.versionCode) || Number(data.versionCode) < 1 || Number(data.versionCode) > 2100000000 ||
      typeof mandatory !== "boolean" || typeof releaseNotes !== "string" || releaseNotes.length > 10000 ||
      typeof data.sha256 !== "string" || !/^[a-f\d]{64}$/i.test(data.sha256)) throw new Error("Invalid update metadata");
  return { version: data.version, versionCode: Number(data.versionCode), apkUrl: httpsUrl(data.downloadUrl ?? data.apkUrl), mandatory, releaseNotes, sha256: data.sha256.toLowerCase() };
}
export function isNewer(update: UpdateManifest, installedBuild: string | null): boolean {
  const installed = Number(installedBuild);
  return installedBuild !== null && Number.isSafeInteger(installed) && installed > 0 && update.versionCode > installed;
}
