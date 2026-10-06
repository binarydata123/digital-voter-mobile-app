export function searchTerms(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

export function searchRank(fields: string[], query: string): number {
  const normalized = query.trim().toLowerCase();
  if (fields.some((field) => field.toLowerCase() === normalized)) return 0;
  if (fields.some((field) => field.toLowerCase().startsWith(normalized))) return 1;
  return 2;
}
