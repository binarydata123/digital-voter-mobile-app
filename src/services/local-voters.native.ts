// Native-only implementation. The web build uses local-voters.web.ts.
import type { Voter } from "./voters";
import { getVoterDatabase, isLocalVoterDatabaseAvailable } from "./voter-database";

export type LocalVoterQuery = {
  search?: string;
  booth?: string;
  ward?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  houseNo?: string;
};

type VoterRow = {
  voter_id: string;
  name: string;
  hindi_name: string;
  gender: string;
  age: number;
  guardian: string;
  epic_no: string;
  house_no: string;
  booth: string;
  ward: string;
  district: string;
  state: string;
  serial_no: string;
  polling_station: string;
};

const VOTER_INSERT_BATCH_SIZE = 50;
const SEARCH_INSERT_BATCH_SIZE = 100;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function placeholders(rowCount: number, columnCount: number) {
  const row = `(${Array.from({ length: columnCount }, () => "?").join(", ")})`;
  return Array.from({ length: rowCount }, () => row).join(", ");
}

function normalizeFtsQuery(value: string) {
  const terms = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  return terms.map((term) => `\"${term}\"*`).join(" AND ");
}

function toVoter(row: VoterRow): Voter {
  return {
    id: row.voter_id,
    name: row.name,
    hindiName: row.hindi_name,
    gender: row.gender,
    age: Number(row.age),
    guardian: row.guardian,
    epicNo: row.epic_no,
    houseNo: row.house_no,
    booth: row.booth,
    ward: row.ward,
    district: row.district,
    state: row.state,
    serialNo: row.serial_no,
    pollingStation: row.polling_station,
  };
}

export async function hasLocalVoters(politicianId: string) {
  if (!isLocalVoterDatabaseAvailable()) {
    return false;
  }

  const database = await getVoterDatabase();
  const result = await database.getFirstAsync<{ has_cache: number }>(
    "SELECT 1 AS has_cache FROM sync_state WHERE politician_id = ?",
    politicianId,
  );
  return result?.has_cache === 1;
}

export async function getLocalVoters(
  politicianId: string,
  query: LocalVoterQuery = {},
) {
  if (!isLocalVoterDatabaseAvailable()) {
    return [];
  }

  const database = await getVoterDatabase();
  const clauses = ["politician_id = ?"];
  const params: (string | number)[] = [politicianId];
  const ftsQuery = query.search?.trim() ? normalizeFtsQuery(query.search) : "";

  if (query.booth && query.booth !== "All") {
    clauses.push("booth = ?");
    params.push(query.booth);
  }
  if (query.ward) {
    clauses.push("ward = ?");
    params.push(query.ward);
  }
  if (query.gender) {
    clauses.push("gender = ?");
    params.push(query.gender);
  }
  if (query.minAge !== undefined) {
    clauses.push("age >= ?");
    params.push(query.minAge);
  }
  if (query.maxAge !== undefined) {
    clauses.push("age <= ?");
    params.push(query.maxAge);
  }
  if (query.houseNo) {
    clauses.push("house_no = ?");
    params.push(query.houseNo);
  }
  if (ftsQuery) {
    clauses.push(
      "voter_id IN (SELECT voter_id FROM voter_search WHERE politician_id = ? AND voter_search MATCH ?)",
    );
    params.push(politicianId, ftsQuery);
  }

  const rows = await database.getAllAsync<VoterRow>(
    `SELECT voter_id, name, hindi_name, gender, age, guardian, epic_no, house_no,
      booth, ward, district, state, serial_no, polling_station
     FROM voters
     WHERE ${clauses.join(" AND ")}
     ORDER BY name COLLATE NOCASE`,
    params,
  );

  return rows.map(toVoter);
}

export async function replaceLocalVoters(politicianId: string, voters: Voter[]) {
  const database = await getVoterDatabase();
  const syncedAt = new Date().toISOString();

  // This screen allows only one refresh at a time. Use the existing connection
  // so Expo does not need to close an extra transaction connection afterward.
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM voter_search WHERE politician_id = ?", politicianId);
    await database.runAsync("DELETE FROM voters WHERE politician_id = ?", politicianId);

    for (const batch of chunk(voters, VOTER_INSERT_BATCH_SIZE)) {
      await database.runAsync(
        `INSERT INTO voters (
          politician_id, voter_id, name, hindi_name, gender, age, guardian, epic_no,
          house_no, booth, ward, district, state, serial_no, polling_station
        ) VALUES ${placeholders(batch.length, 15)}`,
        batch.flatMap((voter) => [
          politicianId,
          voter.id,
          voter.name,
          voter.hindiName ?? "",
          voter.gender,
          voter.age,
          voter.guardian,
          voter.epicNo,
          voter.houseNo,
          voter.booth,
          voter.ward ?? "",
          voter.district ?? "",
          voter.state ?? "",
          voter.serialNo ?? "",
          voter.pollingStation ?? "",
        ]),
      );
    }

    for (const batch of chunk(voters, SEARCH_INSERT_BATCH_SIZE)) {
      await database.runAsync(
        `INSERT INTO voter_search (
          politician_id, voter_id, name, hindi_name, epic_no, serial_no
        ) VALUES ${placeholders(batch.length, 6)}`,
        batch.flatMap((voter) => [
          politicianId,
          voter.id,
          voter.name,
          voter.hindiName ?? "",
          voter.epicNo,
          voter.serialNo ?? "",
        ]),
      );
    }

    await database.runAsync(
      `INSERT INTO sync_state (politician_id, last_synced_at, voter_count)
       VALUES (?, ?, ?)
       ON CONFLICT(politician_id) DO UPDATE SET
         last_synced_at = excluded.last_synced_at,
         voter_count = excluded.voter_count`,
      politicianId,
      syncedAt,
      voters.length,
    );
  });
}

export async function getLastVoterSync(politicianId: string) {
  if (!isLocalVoterDatabaseAvailable()) {
    return null;
  }

  const database = await getVoterDatabase();
  const result = await database.getFirstAsync<{ last_synced_at: string }>(
    "SELECT last_synced_at FROM sync_state WHERE politician_id = ?",
    politicianId,
  );
  return result?.last_synced_at ?? null;
}
