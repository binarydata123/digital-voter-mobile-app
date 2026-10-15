import { Directory, File, Paths } from 'expo-file-system';
import { getVoterDatabase } from './voter-database';
async function database() {
  const db = await getVoterDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS banner_studio_images (image_key TEXT PRIMARY KEY NOT NULL, uri TEXT NOT NULL)');
  return db;
}
export async function loadStudioImage(key: string): Promise<string | null> {
  const row = await (await database()).getFirstAsync<{ uri: string }>('SELECT uri FROM banner_studio_images WHERE image_key = ?', key);
  return row && new File(row.uri).exists ? row.uri : null;
}
let queue: Promise<unknown> = Promise.resolve();
export function saveStudioImage(key: string, uri: string): Promise<string> {
  const result = queue.catch(() => {}).then(async () => {
    const db = await database();
    const previous = await db.getFirstAsync<{ uri: string }>('SELECT uri FROM banner_studio_images WHERE image_key = ?', key);
    const folder = new Directory(Paths.document, 'banner-studio-images');
    folder.create({ intermediates: true, idempotent: true });
    const extension = uri.split('?')[0].match(/\.(png|jpe?g|webp|heic|avif)$/i)?.[1] ?? 'jpg';
    const destination = new File(folder, `image-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
    try {
      new File(uri).copy(destination);
      await db.runAsync('INSERT INTO banner_studio_images (image_key, uri) VALUES (?, ?) ON CONFLICT(image_key) DO UPDATE SET uri = excluded.uri', key, destination.uri);
    } catch (error) { if (destination.exists) destination.delete(); throw error; }
    if (previous?.uri.startsWith(folder.uri)) { try { const old = new File(previous.uri); if (old.exists) old.delete(); } catch {} }
    return destination.uri;
  });
  queue = result;
  return result;
}
