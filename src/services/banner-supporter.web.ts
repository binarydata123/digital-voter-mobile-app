import type { BannerSupporter } from './banner-supporter';
const key = 'politicease.bannerSupporter';
export async function loadBannerSupporter(): Promise<BannerSupporter | null> {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  return typeof value?.name === 'string' && typeof value?.phone === 'string' ? { name: value.name, phone: value.phone } : null;
}
export async function saveBannerSupporter(details: BannerSupporter): Promise<void> {
  window.localStorage.setItem(key, JSON.stringify({ name: details.name.trim(), phone: details.phone }));
}
