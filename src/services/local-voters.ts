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

export async function replaceLocalVoters(
  _politicianId: string,
  _voters: Voter[],
) {
  // No voter cache is created by the fallback implementation.
}

export async function getLastVoterSync(_politicianId: string) {
  return null;
}
