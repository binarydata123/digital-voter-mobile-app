import type { RefObject } from 'react';
import { View, NativeModules } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
let previousExport: File | null = null;

export async function exportBanner(ref: RefObject<View | null>, action: 'save' | 'share', width: number, height: number) {
  if (!NativeModules.RNViewShot) throw new Error('Rebuild and install the app to enable banner export.');
  if (!ref.current || width <= 0 || height <= 0) throw new Error('Wait for the banner preview to load.');
  if (action === 'save') {
    if (!requireOptionalNativeModule('ExpoMediaLibraryNext')) throw new Error('Rebuild and install the app to enable gallery saving.');
    const { requestPermissionsAsync } = await import('expo-media-library');
    const permission = await requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) throw new Error('Allow saving photos in your phone settings, then try again.');
  } else if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
  const factor = Math.min(1600 / width, 1600 / height);
  const captured = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: Math.round(width * factor), height: Math.round(height * factor) });
  const destination = new File(Paths.cache, `politicease-banner-${Date.now()}.png`);
  try {
    const source = new File(captured.startsWith('file:') ? captured : `file://${captured}`);
    source.copy(destination);
    if (previousExport?.exists) previousExport.delete();
    previousExport = destination;
    if (action === 'save') {
      const { Asset } = await import('expo-media-library');
      await Asset.create(destination.uri);
    } else await Sharing.shareAsync(destination.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your PoliticEase banner' });
  } finally { releaseCapture(captured); }
}
