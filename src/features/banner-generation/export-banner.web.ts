import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
export async function exportBanner(ref: RefObject<View | null>, action: 'save' | 'share', width: number, height: number) {
  if (!ref.current) throw new Error('Wait for your banner to load.');
  const factor = Math.min(1600 / width, 1600 / height);
  const dataUri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri', width: Math.round(width * factor), height: Math.round(height * factor) });
  const response = await fetch(dataUri);
  const blob = await response.blob();
  const file = new File([blob], 'politicease-banner.png', { type: 'image/png' });
  if (action === 'share' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'PoliticEase banner' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = file.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
