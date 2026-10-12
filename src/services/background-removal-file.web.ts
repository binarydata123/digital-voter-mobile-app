export async function imageUpload(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read your photo.');
  const blob = await response.blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  return blob;
}
export function saveCutout(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
}
export function deleteCutout(uri: string): void { URL.revokeObjectURL(uri); }
