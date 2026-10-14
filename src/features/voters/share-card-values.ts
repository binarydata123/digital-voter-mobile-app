/** Normalize absent API values, including values previously stored as strings. */
export function shareCardValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number" && !Number.isFinite(value)) return "N/A";
  const text = String(value).trim();
  return !text || /^(undefined|null|nan|n\/?a|none)$/i.test(text) ? "N/A" : text;
}
