export const TEMPLATE_FIELD_KEYS = ["epicNo", "relation", "age", "gender", "ward", "houseNo", "booth", "pollingStation"] as const;
export type TemplateFields = Record<(typeof TEMPLATE_FIELD_KEYS)[number], boolean>;
export const DEFAULT_TEMPLATE_FIELDS = Object.fromEntries(TEMPLATE_FIELD_KEYS.map((key) => [key, true])) as TemplateFields;

export function parseTemplateFields(value?: string): TemplateFields {
  if (value === undefined) return DEFAULT_TEMPLATE_FIELDS;
  const selected = new Set(value.split(","));
  return Object.fromEntries(TEMPLATE_FIELD_KEYS.map((key) => [key, selected.has(key)])) as TemplateFields;
}
