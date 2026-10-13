import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { TemplateLayout } from "@/features/templates/components/TemplateThumbnail";

export function getBannerAspect(layout: TemplateLayout) {
  if (layout === "left" || layout === "right" || layout === "dual") return 1 / 3;
  if (layout === "floating") return 1;
  return 3;
}

function storageKey(userId: string, layout: TemplateLayout) {
  return `template-banner-${encodeURIComponent(userId)}-${layout}`;
}

export async function loadTemplateBanner(userId: string, layout: TemplateLayout): Promise<string | null> {
  if (layout === "none") return null;
  const key = storageKey(userId, layout);
  if (Platform.OS === "web") return window.localStorage.getItem(key);
  if (!FileSystem.documentDirectory) return null;
  const uri = `${FileSystem.documentDirectory}template-banners/${key}.jpg`;
  if (!(await FileSystem.getInfoAsync(uri)).exists) return null;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:image/jpeg;base64,${base64}`;
}

export async function saveTemplateBanner(userId: string, layout: TemplateLayout, base64: string) {
  const key = storageKey(userId, layout);
  if (Platform.OS === "web") {
    const uri = `data:image/jpeg;base64,${base64}`;
    window.localStorage.setItem(key, uri);
    return uri;
  }
  if (!FileSystem.documentDirectory) throw new Error("Local image storage is unavailable.");
  const folder = `${FileSystem.documentDirectory}template-banners/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const uri = `${folder}${key}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

