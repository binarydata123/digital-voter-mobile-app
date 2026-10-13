import type { SQLiteDatabase } from "expo-sqlite";

// Type-safe fallback for TypeScript. Metro selects the .native or .web module
// before this file at runtime.
export function isLocalVoterDatabaseAvailable() {
  return false;
}

export async function getVoterDatabase(): Promise<SQLiteDatabase> {
  throw new Error("No voter database implementation is available for this platform.");
}

export async function deleteVoterDatabase() {
  // No database is created by the fallback implementation.
}
