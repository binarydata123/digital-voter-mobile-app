import { httpsUrl, isNewer, parseManifest, type UpdateManifest } from "./manifest";

// Network/manifest failures are deliberately fail-open; a known update is handled by the gate.
export async function checkUpdate(url: string, installedBuild: string | null, signal: AbortSignal, request: typeof fetch = fetch): Promise<UpdateManifest | null> {
  try {
    const response = await request(httpsUrl(url), { signal, headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 20000) return null;
    const latest = parseManifest(JSON.parse(text));
    return isNewer(latest, installedBuild) ? latest : null;
  } catch { return null; }
}
