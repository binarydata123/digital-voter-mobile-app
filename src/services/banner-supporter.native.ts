import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { BannerSupporter } from './banner-supporter';
let connection: Promise<SQLite.SQLiteDatabase> | null = null;
async function open() {
  const keyName = 'politicease.bannerSupporterDatabaseKey';
  let key = await SecureStore.getItemAsync(keyName);
  if (!key) {
    key = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(keyName, key);
  }
  if (!/^[a-f\d]{64}$/i.test(key)) throw new Error('Invalid local storage key');
  const db = await SQLite.openDatabaseAsync('banner-supporter.db');
  try {
    await db.execAsync(`PRAGMA key = '${key}';`);
    await db.execAsync('CREATE TABLE IF NOT EXISTS supporter (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL, phone TEXT NOT NULL);');
    return db;
  } catch (error) { await db.closeAsync().catch(() => {}); throw error; }
}
function database() {
  if (!connection) connection = open().catch(error => { connection = null; throw error; });
  return connection;
}
export async function loadBannerSupporter(): Promise<BannerSupporter | null> {
  return (await database()).getFirstAsync<BannerSupporter>('SELECT name, phone FROM supporter WHERE id = 1');
}
export async function saveBannerSupporter(details: BannerSupporter): Promise<void> {
  await (await database()).runAsync('INSERT INTO supporter (id, name, phone) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone', details.name.trim(), details.phone);
}
