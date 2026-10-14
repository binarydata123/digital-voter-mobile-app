import type { VoterSharePreference } from "./voter-share-preference";
const layouts = new Set(["top", "bottom", "left", "right", "floating", "dual", "none"]);
function key(userId: string) { return `politicease.voterSharePreference.${encodeURIComponent(userId)}`; }
export async function loadVoterSharePreference(userId: string): Promise<VoterSharePreference | null> {
  const raw = window.localStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!layouts.has(value.layout) || (value.bannerUri !== null && typeof value.bannerUri !== "string")) return null;
    return { layout: value.layout, bannerUri: value.layout === "none" ? null : value.bannerUri, source: typeof value.source?.uri === "string" && value.source.width > 0 && value.source.height > 0 ? value.source : null };
  } catch { return null; }
}
async function persistImage(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Unable to save the banner image.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to save the banner image."));
    reader.readAsDataURL(blob);
  });
}
export async function saveVoterSharePreference(userId: string, preference: VoterSharePreference): Promise<VoterSharePreference> {
  if (!userId || !layouts.has(preference.layout)) throw new Error("Invalid card preference.");
  const saved = { layout: preference.layout, bannerUri: preference.layout === "none" || !preference.bannerUri ? null : await persistImage(preference.bannerUri), source: preference.layout !== "none" && preference.source ? { ...preference.source, uri: await persistImage(preference.source.uri) } : null };
  window.localStorage.setItem(key(userId), JSON.stringify(saved));
  return saved;
}
