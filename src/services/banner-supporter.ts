export type BannerSupporter = { name: string; phone: string };
export async function loadBannerSupporter(): Promise<BannerSupporter | null> { return null; }
export async function saveBannerSupporter(_details: BannerSupporter): Promise<void> { throw new Error('Local storage is unavailable'); }
