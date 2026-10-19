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
      voter_key TEXT NOT NULL DEFAULT '',
      voter_source TEXT NOT NULL DEFAULT '',
      voter_collection TEXT NOT NULL DEFAULT '',
      voter_document_id TEXT NOT NULL DEFAULT '',
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
      photo_uri TEXT NOT NULL DEFAULT '',
      voted INTEGER NOT NULL DEFAULT 0,
      education TEXT NOT NULL DEFAULT '',
      working TEXT NOT NULL DEFAULT '',
      whatsapp_number TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (politician_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      politician_id TEXT PRIMARY KEY NOT NULL,
      last_synced_at TEXT NOT NULL,
      voter_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS survey_locations (
      id TEXT PRIMARY KEY NOT NULL,
      politician_id TEXT NOT NULL,
      election_type TEXT NOT NULL DEFAULT '',
      election_year TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      ward_no TEXT NOT NULL DEFAULT '',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      captured_at TEXT NOT NULL,
      preferred_politician TEXT NOT NULL DEFAULT '',
      preferred_party TEXT NOT NULL DEFAULT ''
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
    CREATE INDEX IF NOT EXISTS survey_locations_by_scope
      ON survey_locations (
        politician_id,
        election_type,
        election_year,
        state,
        district,
        city
      );

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

  await database.execAsync(
    "ALTER TABLE voters ADD COLUMN photo_uri TEXT NOT NULL DEFAULT '';",
  ).catch(() => {});
  await database.execAsync(
    "ALTER TABLE voters ADD COLUMN voter_key TEXT NOT NULL DEFAULT '';",
  ).catch(() => {});
  await database.execAsync(
    "ALTER TABLE voters ADD COLUMN voter_source TEXT NOT NULL DEFAULT '';",
  ).catch(() => {});
  await database.execAsync(
    "ALTER TABLE voters ADD COLUMN voter_collection TEXT NOT NULL DEFAULT '';",
  ).catch(() => {});
  await database.execAsync(
    "ALTER TABLE voters ADD COLUMN voter_document_id TEXT NOT NULL DEFAULT '';",
  ).catch(() => {});

  const columns = await database.getAllAsync<{ name: string }>("PRAGMA table_info(voters)");
  if (!columns.some((column) => column.name === "voted")) {
    await database.execAsync("ALTER TABLE voters ADD COLUMN voted INTEGER NOT NULL DEFAULT 0;");
  }
  for (const column of ["education", "working", "economic_category", "social_category", "ration_category", "whatsapp_number"]) {
    if (!columns.some((existing) => existing.name === column)) {
      await database.execAsync(`ALTER TABLE voters ADD COLUMN ${column} TEXT NOT NULL DEFAULT '';`);
    }
  }

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
