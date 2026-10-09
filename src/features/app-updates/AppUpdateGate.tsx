import * as Application from "expo-application";
import { requireOptionalNativeModule } from "expo";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { type UpdateManifest } from "./manifest";
import { checkUpdate } from "./check";
import { verifyDownload } from "./verify-download";
import { updateErrorMessage } from "./error-message";

type Installer = {
  isInstallAllowed(): boolean;
  openInstallSettings(): Promise<void>;
  sha256(uri: string): Promise<string>;
  install(uri: string, checksum: string, code: number, version: string): Promise<void>;
  addListener(event: "onInstallResult", listener: (result: { success: boolean; message: string }) => void): { remove(): void };
};
const installer = Platform.OS === "android" ? requireOptionalNativeModule<Installer>("ApkInstaller") : null;
const manifestUrl = process.env.EXPO_PUBLIC_APK_UPDATE_URL ?? "https://voter-app.ai-developer.cloud/download/politic-ease.json";
type Stage = "idle" | "downloading" | "verifying" | "ready" | "permission" | "installing";

export function AppUpdateGate() {
  const [update, setUpdate] = useState<UpdateManifest | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [hasApk, setHasApk] = useState(false);
  const [error, setError] = useState("");
  const apk = useRef<string | null>(null);
  const busy = useRef(false);
  const download = useRef<FileSystem.DownloadResumable | null>(null);
  const busyStage = stage === "downloading" || stage === "verifying" || stage === "installing";

  useEffect(() => {
    if (!installer || !manifestUrl) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let mounted = true;
    void (async () => {
      try {
        const latest = await checkUpdate(manifestUrl, Application.nativeBuildVersion, controller.signal);
        if (mounted && latest) setUpdate(latest);
      } catch {
        // A failed startup check must not lock users out of the app.
      } finally { clearTimeout(timer); }
    })();
    const resultSubscription = installer.addListener("onInstallResult", (result) => {
      busy.current = false;
      setStage("ready");
      setError(result.success ? "" : updateErrorMessage(result.message));
    });
    const appSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setStage((current) => current === "permission" && installer.isInstallAllowed() ? "ready" : current);
    });
    return () => {
      mounted = false; controller.abort(); clearTimeout(timer);
      resultSubscription.remove(); appSubscription.remove();
      void download.current?.pauseAsync().catch(() => {});
    };
  }, []);

  async function installUpdate() {
    if (!installer || !update || busy.current) return;
    busy.current = true;
    setError("");
    try {
      if (!apk.current) {
        if (!FileSystem.cacheDirectory) throw new Error("Update storage unavailable");
        const directory = `${FileSystem.cacheDirectory}apk-updates/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        // Remove previous downloads so APKs do not accumulate in cache.
        for (const name of await FileSystem.readDirectoryAsync(directory)) await FileSystem.deleteAsync(directory + name, { idempotent: true });
        const target = `${directory}${update.versionCode}.apk`;
        setProgress(0); setStage("downloading");
        let lastProgress = 0;
        download.current = FileSystem.createDownloadResumable(update.apkUrl, target, {}, (event) => {
          const now = Date.now();
          if (now - lastProgress < 200) return;
          lastProgress = now;
          setProgress(event.totalBytesExpectedToWrite > 0 ? Math.min(1, event.totalBytesWritten / event.totalBytesExpectedToWrite) : 0);
        });
        const timeout = setTimeout(() => { void download.current?.pauseAsync().catch(() => {}); }, 15 * 60 * 1000);
        let result;
        try { result = await download.current.downloadAsync(); } finally { clearTimeout(timeout); download.current = null; }
        setStage("verifying");
        apk.current = await verifyDownload(result, update.sha256,
          (uri) => installer.sha256(uri),
          (uri) => FileSystem.deleteAsync(uri, { idempotent: true }));
        setHasApk(true);
      }
      if (!installer.isInstallAllowed()) {
        setStage("permission");
        await installer.openInstallSettings();
      } else {
        setStage("installing");
        await installer.install(apk.current, update.sha256, update.versionCode, update.version);
      }
    } catch (cause) {
      setError(updateErrorMessage(cause));
      setStage(apk.current ? "ready" : "idle");
    } finally { busy.current = false; }
  }

  if (!update) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!update.mandatory && !busyStage) setUpdate(null); }}>
      <View className="flex-1 justify-center bg-black/60 px-6">
        <View className="max-h-[85%] rounded-2xl bg-white p-6">
          <Text className="text-xl font-bold text-slate-900">{update.mandatory ? "Update required" : "Update available"}</Text>
          <Text className="mt-2 text-sm text-slate-500">Version {update.version} · Installed {Application.nativeApplicationVersion}</Text>
          <ScrollView className="mt-4" style={{ maxHeight: 240 }}><Text className="text-sm leading-6 text-slate-700">{update.releaseNotes}</Text></ScrollView>
          {update.mandatory && <Text className="mt-3 text-sm text-slate-600">Install this update to continue.</Text>}
          {stage === "permission" && <Text className="mt-3 text-sm text-slate-600">Enable “Allow from this source” in Android settings, then return here to install.</Text>}
          {!!error && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-700">{error}</Text>}
          {busyStage && <View className="mt-4 flex-row items-center gap-3"><ActivityIndicator color="#075e50" /><Text className="text-sm text-slate-700">{stage === "downloading" ? `Downloading ${Math.round(progress * 100)}%` : stage === "verifying" ? "Verifying APK…" : "Complete installation in Android’s installer."}</Text></View>}
          {stage === "downloading" && <View className="mt-2 h-2 overflow-hidden rounded bg-slate-100"><View style={{ width: `${progress * 100}%` }} className="h-2 bg-emerald-700" /></View>}
          {!busyStage && <Pressable onPress={() => void installUpdate()} className="mt-5 items-center rounded-xl bg-[#075e50] py-4"><Text className="font-bold text-white">{hasApk ? stage === "permission" ? "Allow installation" : "Install update" : "Update Now"}</Text></Pressable>}
          {stage === "installing" && <Pressable onPress={() => { setStage("ready"); setError("If installation did not complete, try opening the installer again."); }} className="mt-3 items-center py-2"><Text className="text-sm text-[#075e50]">Installation did not finish?</Text></Pressable>}
          {!update.mandatory && !busyStage && <Pressable onPress={() => setUpdate(null)} className="mt-3 items-center py-2"><Text className="font-semibold text-slate-600">Later</Text></Pressable>}
        </View>
      </View>
    </Modal>
  );
}
