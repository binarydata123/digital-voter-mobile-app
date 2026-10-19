import { getLocalVoterPage } from './local-voters';
import { isLocalVoterDatabaseAvailable } from './voter-database';
import type { Voter } from './voters';

export async function getLocalFamilyMembers(politicianId: string, voter: Pick<Voter, 'booth' | 'houseNo'>): Promise<Voter[]> {
  if (!isLocalVoterDatabaseAvailable()) throw new Error('Family lookup uses the local database in the mobile app.');
  if (!politicianId) throw new Error('Please sign in again to view family members.');
  const booth = voter.booth?.trim();
  const house = voter.houseNo?.trim();
  const invalid = /^(n\/?a|null|undefined|unknown|none|[-*]+)$/i;
  if (!booth || booth === 'All' || invalid.test(booth) || !house || invalid.test(house)) {
    throw new Error('A valid booth number and house number are required to find family members. Edit this voter to add the missing details.');
  }
  const members = new Map<string, Voter>();
  let offset = 0;
  // Use the selected voter's stored values, rather than the current screen filters.
  // Never omit either filter: that could group unrelated households.
  while (true) {
    const page = await getLocalVoterPage(politicianId, { booth: voter.booth, houseNo: voter.houseNo }, 100, offset);
    page.voters.forEach(member => members.set(member.id, member));
    offset += page.voters.length;
    if (!page.voters.length || offset >= page.total) break;
  }
  return [...members.values()];
}
