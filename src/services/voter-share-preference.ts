import type { TemplateLayout } from "@/features/templates/components/TemplateThumbnail";
export type VoterSharePreference = {
  layout: TemplateLayout;
  bannerUri: string | null;
  source: { uri: string; width: number; height: number } | null;
};
export async function loadVoterSharePreference(_userId: string): Promise<VoterSharePreference | null> { return null; }
export async function saveVoterSharePreference(_userId: string, _preference: VoterSharePreference): Promise<VoterSharePreference> { throw new Error("Local preference storage is unavailable."); }
