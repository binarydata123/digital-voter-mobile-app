import { fetch } from 'expo/fetch';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from './api';
import { imageUpload, saveCutout, deleteCutout } from './background-removal-file';
export { deleteCutout } from './background-removal-file';

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
}
export async function removePhotoBackground(uri: string, signal: AbortSignal): Promise<string> {
  // Bound upload dimensions to avoid sending full-resolution camera photos to the model.
  const context = ImageManipulator.manipulate(uri);
  let image = await context.renderAsync();
  let preparedUri: string | null = null;
  try {
    if (Math.max(image.width, image.height) > 1600) {
      context.resize(image.width >= image.height ? { width: 1600 } : { height: 1600 });
      image.release(); image = await context.renderAsync();
    }
    const prepared = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    preparedUri = prepared.uri;
    if (signal.aborted) throw new Error('Cancelled');
    const form = new FormData();
    form.append('file', await imageUpload(prepared.uri), 'photo.jpg');
    const response = await fetch(`${api.defaults.baseURL!.replace(/\/+$/, '')}/public/remove-background`, { method: 'POST', body: form, signal });
    if (!response.ok) {
      if (response.status === 413) throw new Error('Your photo is too large. Choose a smaller image.');
      if (response.status === 429) throw new Error('Too many requests. Wait a moment and try again.');
      throw new Error('Could not remove the background. Please try again.');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024 || !isPng(bytes)) throw new Error('The server did not return a valid PNG cutout. Please try again.');
    if (signal.aborted) throw new Error('Cancelled');
    return saveCutout(bytes);
  } finally { if (preparedUri) deleteCutout(preparedUri); image.release(); context.release(); }
}
