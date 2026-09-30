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

// The voter screen uses its in-memory online fallback on web. These exports keep
// the shared screen interface platform-safe without bundling expo-sqlite.
export async function hasLocalVoters(_politicianId: string) {
  return false;
}

export async function getLocalVoters(
  _politicianId: string,
  _query: LocalVoterQuery = {},
): Promise<Voter[]> {
  return [];
}

export async function replaceLocalVoters(
  _politicianId: string,
  _voters: Voter[],
) {
  // Voter data is never cached locally by the web build.
}

export async function getLastVoterSync(_politicianId: string) {
  return null;
}
