import { File, Paths } from 'expo-file-system';
export async function imageUpload(uri: string): Promise<Blob> {
  const file = new File(uri);
  if (!file.exists || file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  return file;
}
export function saveCutout(bytes: Uint8Array): string {
  const file = new File(Paths.cache, `supporter-cutout-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  file.create();
  try { file.write(bytes); return file.uri; } catch (error) { file.delete(); throw error; }
}
export function deleteCutout(uri: string): void {
  try { const file = new File(uri); if (file.exists) file.delete(); } catch {}
}
