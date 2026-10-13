// Native-only implementation. The web build uses voter-database.web.ts.
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const DATABASE_NAME = "digital-voters.db";
const DATABASE_KEY_NAME = "votersakha.voterDatabaseKey";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function isLocalVoterDatabaseAvailable() {
  return Platform.OS !== "web";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getDatabaseKey() {
  const storedKey = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (storedKey) {
    return storedKey;
  }

  const key = bytesToHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, key);
  return key;
}

async function initializeDatabase() {
  if (!isLocalVoterDatabaseAvailable()) {
    throw new Error("Offline voter storage is available only in the mobile app.");
  }

  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const key = await getDatabaseKey();

  // The generated key is hexadecimal, so it is safe to use in this SQLCipher-only PRAGMA.
  await database.execAsync(`PRAGMA key = '${key}';`);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS voters (
      politician_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hindi_name TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      age INTEGER NOT NULL DEFAULT 0,
      guardian TEXT NOT NULL DEFAULT '',
      epic_no TEXT NOT NULL DEFAULT '',
      house_no TEXT NOT NULL DEFAULT '',
      booth TEXT NOT NULL DEFAULT '',
      ward TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      serial_no TEXT NOT NULL DEFAULT '',
      polling_station TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (politician_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      politician_id TEXT PRIMARY KEY NOT NULL,
      last_synced_at TEXT NOT NULL,
      voter_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS voters_by_politician_booth
      ON voters (politician_id, booth);
    CREATE INDEX IF NOT EXISTS voters_by_politician_ward
      ON voters (politician_id, ward);
    CREATE INDEX IF NOT EXISTS voters_by_politician_gender
      ON voters (politician_id, gender);
    CREATE INDEX IF NOT EXISTS voters_by_politician_age
      ON voters (politician_id, age);
    CREATE INDEX IF NOT EXISTS voters_by_politician_epic
      ON voters (politician_id, epic_no);

    CREATE VIRTUAL TABLE IF NOT EXISTS voter_search USING fts5(
      politician_id UNINDEXED,
      voter_id UNINDEXED,
      name,
      hindi_name,
      epic_no,
      serial_no,
      tokenize = 'unicode61'
    );
  `);

  return database;
}

export function getVoterDatabase() {
  databasePromise ??= initializeDatabase();
  return databasePromise;
}

export async function deleteVoterDatabase() {
  if (!isLocalVoterDatabaseAvailable()) {
    return;
  }

  try {
    const database = await databasePromise;
    await database?.closeAsync();
  } finally {
    databasePromise = null;
  }

  try {
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  } finally {
    await SecureStore.deleteItemAsync(DATABASE_KEY_NAME);
  }
}
