import type { Voter } from "@/services/voters";

let result: { userId: string; voter: Voter } | null = null;

export function setCreatedVoter(userId: string, voter: Voter) {
  result = { userId, voter };
}

export function takeCreatedVoter(userId: string) {
  const pending = result;
  result = null;
  return pending?.userId === userId ? pending.voter : null;
}
