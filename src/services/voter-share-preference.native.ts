import { File, Directory, Paths } from "expo-file-system";
import { getVoterDatabase } from "./voter-database";
import type { VoterSharePreference } from "./voter-share-preference";

type Row = { layout: string; banner_uri: string | null; source_uri: string | null; source_width: number | null; source_height: number | null };
const layouts = new Set(["top", "bottom", "left", "right", "floating", "dual", "none"]);
async function database() {
  const db = await getVoterDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS voter_share_preferences (
    politician_id TEXT PRIMARY KEY NOT NULL, layout TEXT NOT NULL,
    banner_uri TEXT, source_uri TEXT, source_width INTEGER, source_height INTEGER
  )`);
  return db;
}
export async function loadVoterSharePreference(userId: string): Promise<VoterSharePreference | null> {
  const row = await (await database()).getFirstAsync<Row>("SELECT layout, banner_uri, source_uri, source_width, source_height FROM voter_share_preferences WHERE politician_id = ?", userId);
  if (!row || !layouts.has(row.layout)) return null;
  if (row.banner_uri && !new File(row.banner_uri).exists) return null;
  const source = row.source_uri && new File(row.source_uri).exists && (row.source_width ?? 0) > 0 && (row.source_height ?? 0) > 0
    ? { uri: row.source_uri, width: row.source_width!, height: row.source_height! } : null;
  return { layout: row.layout as VoterSharePreference["layout"], bannerUri: row.layout === "none" ? null : row.banner_uri, source };
}
let writes: Promise<unknown> = Promise.resolve();
export function saveVoterSharePreference(userId: string, preference: VoterSharePreference): Promise<VoterSharePreference> {
  const result = writes.catch(() => {}).then(() => save(userId, preference));
  writes = result;
  return result;
}
async function save(userId: string, preference: VoterSharePreference): Promise<VoterSharePreference> {
  if (!userId || !layouts.has(preference.layout)) throw new Error("Invalid card preference.");
  const db = await database();
  const previous = await db.getFirstAsync<Row>("SELECT banner_uri, source_uri FROM voter_share_preferences WHERE politician_id = ?", userId);
  const folder = new Directory(Paths.document, "voter-share-preferences");
  folder.create({ intermediates: true, idempotent: true });
  const created: File[] = [];
  function copy(uri: string, label: string) {
    const file = new File(folder, `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
    new File(uri).copy(file);
    created.push(file);
    return file.uri;
  }
  try {
    const bannerUri = preference.layout === "none" || !preference.bannerUri ? null : copy(preference.bannerUri, "banner");
    const source = preference.layout !== "none" && preference.source ? { ...preference.source, uri: copy(preference.source.uri, "source") } : null;
    await db.runAsync(`INSERT INTO voter_share_preferences (politician_id, layout, banner_uri, source_uri, source_width, source_height)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(politician_id) DO UPDATE SET layout=excluded.layout,
      banner_uri=excluded.banner_uri, source_uri=excluded.source_uri, source_width=excluded.source_width, source_height=excluded.source_height`,
      userId, preference.layout, bannerUri, source?.uri ?? null, source?.width ?? null, source?.height ?? null);
    // Delete only the previous files owned by this feature, after the new row is saved.
    for (const uri of [previous?.banner_uri, previous?.source_uri]) {
      if (uri?.startsWith(folder.uri)) { try { const file = new File(uri); if (file.exists) file.delete(); } catch {} }
    }
    return { layout: preference.layout, bannerUri, source };
  } catch (error) {
    for (const file of created) { try { if (file.exists) file.delete(); } catch {} }
    throw error;
  }
}
