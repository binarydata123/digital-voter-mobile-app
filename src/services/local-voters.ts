import type { Voter } from "./voters";

export type LocalVoterQuery = {
  search?: string;
  booth?: string;
  ward?: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  houseNo?: string;
};
export type LocalVoterPage = { voters: Voter[]; total: number };
export type LocalVoterOverview = { total: number; boothCounts: Record<string, number> };
export type LocalVoterPageLoader = (
  savePage: (voters: Voter[]) => Promise<void>,
) => Promise<number>;

// Type-safe fallback for TypeScript. Metro selects the .native or .web module
// before this file at runtime.
export async function hasLocalVoters(_politicianId: string) {
  return false;
}

export async function getLocalVoters(
  _politicianId: string,
  _query: LocalVoterQuery = {},
): Promise<Voter[]> {
  return [];
}

export async function getLocalVoterPage(
  _politicianId: string,
  _query: LocalVoterQuery = {},
  _limit = 50,
  _offset = 0,
): Promise<LocalVoterPage> {
  return { voters: [], total: 0 };
}

export async function getLocalVoterOverview(
  _politicianId: string,
): Promise<LocalVoterOverview> {
  return { total: 0, boothCounts: {} };
}

export async function replaceLocalVoters(
  _politicianId: string,
  _voters: Voter[],
) {
  // No voter cache is created by the fallback implementation.
}

export async function replaceLocalVotersFromPages(
  _politicianId: string,
  _loadPages: LocalVoterPageLoader,
) {
  // No voter cache is created by the fallback implementation.
}

export async function getLastVoterSync(_politicianId: string) {
  return null;
}
