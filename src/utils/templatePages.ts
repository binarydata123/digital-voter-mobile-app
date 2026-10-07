// Each record belongs to exactly one page. The final page stays partial.
export function getTemplatePages<T>(records: readonly T[], cardsPerPage: number): T[][] {
  const size = Math.max(1, Math.trunc(cardsPerPage));
  const pages: T[][] = [];
  for (let offset = 0; offset < records.length; offset += size) {
    pages.push(records.slice(offset, offset + size));
  }
  return pages;
}
