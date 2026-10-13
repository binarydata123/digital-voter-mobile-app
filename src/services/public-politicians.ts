import { api } from './api';

export type PublicPolitician = {
  id: string;
  profileId: string;
  name: string;
  party: string;
  profileImage: string;
  bannerImage: string;
  templateBannerImage: string;
};
export function publicImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const base = new URL(api.defaults.baseURL!);
    const url = new URL(value.trim(), `${base.origin}/`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
export async function fetchPublicPoliticians(party: string, page: number, signal: AbortSignal) {
  const response = await api.get('/public/politicians', {
    params: { party, page, limit: 50 }, signal,
    // Axios omits false-valued headers; public directory must not require a token.
    headers: { Authorization: false },
  });
  const data = response.data?.data;
  if (response.data?.success !== true || !Array.isArray(data?.politicians)) throw new Error('Invalid politician directory response');
  const politicians: PublicPolitician[] = data.politicians
    .filter((p: PublicPolitician) => p && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p: PublicPolitician) => ({ id: p.id, profileId: p.profileId, name: p.name, party: p.party,
      profileImage: publicImageUrl(p.profileImage), bannerImage: publicImageUrl(p.bannerImage), templateBannerImage: publicImageUrl(p.templateBannerImage) }));
  return { politicians, totalPages: Number(data.pagination?.totalPages) || 0 };
}
