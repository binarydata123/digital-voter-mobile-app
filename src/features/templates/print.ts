import type { TemplateFields } from "./fields";
import type { TemplateLayout } from "./components/TemplateThumbnail";
import { getTemplatePages } from "@/utils/templatePages";
import { getLocalVoterPage } from "@/services/local-voters";
import { isVoterInBooth, type Voter } from "@/services/voters";
const LOCAL_TEMPLATE_PAGE_SIZE = 100;
function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text && text !== "undefined" && text !== "null" ? text : "N/A";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTemplateHtml({
  booth,
  columns,
  fields,
  layout,
  politicianName,
  voters,
  bannerImageUrl,
}: {
  booth: string;
  columns: number;
  fields: TemplateFields;
  layout: TemplateLayout;
  politicianName: string;
  voters: Voter[];
  bannerImageUrl: string;
}) {
  const rowsPerPage = layout === "none" ? 6 : columns === 4 ? 5 : 3;
  const voterCards = voters.map((voter) => {
    const gender = fields.gender ? displayValue(voter.gender) : "N/A";
    const age = fields.age ? displayValue(voter.age) : "N/A";
    const ageGender =
      age !== "N/A" && gender !== "N/A"
        ? `${age} | ${gender}`
        : age !== "N/A"
          ? age
          : gender;

    const relation = displayValue(voter.relation);
    const guardian = displayValue(
      String(voter.guardian ?? "")
        .replace(/\s*\(husband\)/gi, "")
        .trim(),
    );
    const relationLine =
      relation !== "N/A" && guardian !== "N/A"
        ? `${relation}: ${guardian}`
        : guardian !== "N/A"
          ? guardian
          : "N/A";

    const ward = displayValue(voter.ward);
    const house = displayValue(voter.houseNo);
    const cardWidth = (738 - (columns - 1) * 10) / columns;
    const detailFraction = layout === "dual" ? 0.64 : layout === "left" || layout === "right" ? 0.66 : 1;
    const houseFontSize = Math.min(columns === 4 ? 10 : 12, Math.max(6, (cardWidth * detailFraction - (columns === 4 ? 12 : 28)) / ((house.length + 10) * 0.6)));
    const boothValue = displayValue(voter.booth);
    const station = displayValue(voter.pollingStation);

    const metaCells = [
      fields.age || fields.gender
        ? `<div class="meta-left">${escapeHtml(ageGender)}</div>`
        : "",
      fields.ward
        ? `<div class="meta-right">Ward: ${escapeHtml(ward)}</div>`
        : "",
      fields.houseNo
        ? `<div class="meta-house" style="font-size:${houseFontSize}px"><span>House&nbsp;No:</span> ${escapeHtml(house)}</div>`
        : "",
      fields.booth
        ? `<div class="meta-booth"><span>Booth&nbsp;No:</span> ${escapeHtml(boothValue)}</div>`
        : "",
      fields.pollingStation
        ? `<div class="meta-left">Station: ${escapeHtml(station)}</div>`
        : "",
    ].join("");

    const bannerBlock =
      layout === "none"
        ? ""
        : bannerImageUrl
          ? `<div class="banner banner-image" role="img" aria-label="Banner"></div>`
          : `<div class="banner banner-fallback"><span>${escapeHtml(politicianName)} Banner</span></div>`;

    // IMPORTANT: banner FIRST, detail SECOND.
    // `.bottom` uses column-reverse to flip it, matching the RN preview.
    return `<article class="voter-card ${layout}${columns === 4 ? " compact" : ""}">
        ${bannerBlock}
        <div class="detail">
          <div class="card-heading"><h2>${escapeHtml(voter.name.toUpperCase())}</h2><div class="serial">#${escapeHtml(voter.serialNo || voter.id)}</div></div>
          ${fields.epicNo ? `<div class="epic">EPIC: ${escapeHtml(displayValue(voter.epicNo))}</div>` : ""}
          ${fields.relation ? `<div class="relation"><span class="relation-prefix">पति:</span> ${escapeHtml(relationLine)}</div>` : ""}
          <div class="meta-grid">${metaCells}</div>
        </div>
        ${layout === "dual" ? bannerBlock : ""}
      </article>`;
  });
  const pages = getTemplatePages(voterCards, columns * rowsPerPage)
    .map(
      (pageCards) => `<main class="sheet">
    <h1 class="title">Booth ${escapeHtml(booth)} Voter Template</h1>
    <p class="sub">${pageCards.length} voters</p><div class="rule"></div>
    <section class="grid">${getTemplatePages(pageCards, rowsPerPage)
      .map(
        (columnCards) =>
          `<div class="card-column">${columnCards.join("")}</div>`,
      )
      .join("")}</section>
  </main>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { margin: 14px; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; }
    @page { size: A4 portrait; margin: 0; }
    .sheet { width: 794px; min-height: 1123px; padding: 28px; break-after: page; }
    .sheet:last-child { break-after: auto; }
    .title { color: #020617; font-size: 20px; line-height: 24px; font-weight: 900; margin: 0; }
    .sub { color: #0f172a; font-size: 12px; font-weight: 900; margin: 4px 0 0; }
    .rule { height: 2px; background: #075e54; margin: 10px 0; }
    .grid { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 10px; }
    .card-column { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .voter-card {
      min-height: 190px;
      border: 1px dotted #94a3b8;
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
      position: relative;
      page-break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
    .banner { width: 100%; height: 160px; background: #f8fafc; overflow: hidden; }
    .banner-image { background-image: url(${JSON.stringify(bannerImageUrl).replace(/</g, "\\3c ")}); background-size: contain; background-position: center; background-repeat: no-repeat; }
    .banner-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 160px;
      background: #e2f3ee;
      color: #075e54;
      font-weight: 900;
      font-size: 11px;
    }
    .detail {
      flex: 1;
      padding: 14px 14px 12px;
      position: relative;
    }
    h2 {
      color: #020617;
      font-size: 15px;
      line-height: 19px;
      margin: 0;
      font-weight: 900;
      letter-spacing: 0.3px;
      padding-right: 60px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .epic {
      color: #2563eb;
      font-size: 13px;
      font-weight: 900;
      margin-top: 4px;
      padding-right: 60px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .relation {
      color: #0f766e;
      font-size: 13px;
      font-weight: 900;
      margin-top: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .relation-prefix { color: #0f766e; font-size: 12px; font-weight: 900; margin-right: 5px; }
    .serial {
      position: absolute;
      top: 12px;
      right: 12px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #2563eb;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 10px;
      font-weight: 900;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 8px;
      row-gap: 4px;
      margin-top: 10px;
    }
    .meta-left,
    .meta-right {
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-right { text-align: right; }
    .meta-booth { grid-column: 1 / -1; min-width: 0; color: #475569; font-size: 12px; font-weight: 800; white-space: normal; overflow-wrap: anywhere; line-height: 16px; }
    .meta-booth span { white-space: nowrap; }
    .meta-house { grid-column: 1 / -1; min-width: 0; color: #475569; font-weight: 800; white-space: nowrap; line-height: 1.3; }
    .meta-house span { white-space: nowrap; }
    .bottom { flex-direction: column-reverse; }
    .left, .right { display: grid; grid-template-columns: 34% 66%; }
    .left .banner, .right .banner { height: auto; min-height: 100%; }
    .right { grid-template-columns: 66% 34%; }
    .right .detail { grid-column: 1; grid-row: 1; }
    .right .banner { grid-column: 2; grid-row: 1; }
    .dual { display: grid; grid-template-columns: 18% 64% 18%; }
    .dual .banner { min-height: 0; }
    .detail { padding: 10px 14px; }
    .card-heading { display: flex; align-items: flex-start; gap: 8px; }
    .card-heading h2 { flex: 1; min-width: 0; }
    .card-heading .serial { position: static; flex-shrink: 0; }
    .relation { margin-top: 4px; }
    .meta-grid { margin-top: 6px; row-gap: 2px; }
    .compact { min-height: 0; }
    .none { min-height: 0; }
    .compact .banner { height: 104px; }
    .compact .detail { padding: 6px; }
    .compact h2 { font-size: 12px; line-height: 15px; padding-right: 0; white-space: normal; overflow-wrap: anywhere; }
    .compact .epic { font-size: 11px; line-height: 14px; padding-right: 0; white-space: normal; overflow-wrap: anywhere; }
    .compact .relation, .compact .relation-prefix { font-size: 10px; line-height: 13px; white-space: normal; overflow-wrap: anywhere; }
    .compact .meta-left, .compact .meta-right, .compact .meta-booth { font-size: 10px; line-height: 13px; white-space: normal; overflow-wrap: anywhere; }
    .compact .serial { font-size: 8px; padding: 2px 5px; }
    .compact .card-heading { gap: 4px; }
    .top .banner, .bottom .banner { height: auto; aspect-ratio: 3 / 1; position: relative; }
    .left .banner, .right .banner, .dual .banner { height: auto; min-height: 0; aspect-ratio: 1 / 3; align-self: start; position: relative; }
    .left .detail, .right .detail { padding: 8px; }
    .left .card-heading, .right .card-heading { flex-wrap: wrap; gap: 3px; }
    .left h2, .right h2 { flex-basis: 100%; font-size: 12px; line-height: 16px; }
    .left .epic, .right .epic { margin-top: 5px; font-size: 11px; line-height: 15px; }
    .left .meta-grid, .right .meta-grid { grid-template-columns: 1fr; row-gap: 5px; margin-top: 7px; }
    .left .meta-right, .right .meta-right { text-align: left; }
    .left .relation, .right .relation { margin-top: 6px; line-height: 15px; }
    .dual .detail { min-width: 0; padding: 7px 5px; }
    .dual .card-heading { flex-wrap: wrap; gap: 3px; }
    .dual h2 { flex-basis: 100%; font-size: 11px; line-height: 14px; }
    .dual .epic { padding-right: 0; font-size: 9px; line-height: 12px; }
    .dual .meta-grid { grid-template-columns: 1fr; row-gap: 3px; }
    .dual .meta-right { text-align: left; }
    .dual .relation { font-size: 9px; line-height: 12px; }
    .dual .meta-left, .dual .meta-right, .dual .meta-booth { font-size: 9px; line-height: 12px; }
    .dual { min-height: 186px; }
    .dual .banner { width: 100%; height: 100%; aspect-ratio: auto; align-self: stretch; background-size: cover; }
    .floating .banner { width: 40px; height: 40px; margin: 8px; border-radius: 20px; }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

export async function openWebTemplatePrint(html: string, printWindow: Window | null): Promise<void> {
  if (!printWindow)
    throw new Error(
      "Please allow popups for this site, then try printing again.",
    );
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    const banner = printWindow.document.querySelector<HTMLElement>(".banner-image");
    const background = banner ? printWindow.getComputedStyle(banner).backgroundImage : "none";
    const preload = printWindow.document.createElement("img");
    if (background.startsWith('url("')) preload.src = background.slice(5, -2);
    else if (background.startsWith("url(")) preload.src = background.slice(4, -1);
    await Promise.all(
      [...Array.from(printWindow.document.images), ...(preload.src ? [preload] : [])].map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
          window.setTimeout(resolve, 10000);
        });
      }),
    );
    if (printWindow.closed) return;
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    if (!printWindow.closed) printWindow.close();
    throw error;
  }
}

export async function getAllLocalTemplateVoters(politicianId: string, booth: string) {
  async function readLocalPages(query: { booth?: string }) {
    const pageVoters: Voter[] = [];
    let total = 0;

    do {
      const page = await getLocalVoterPage(
        politicianId,
        query,
        LOCAL_TEMPLATE_PAGE_SIZE,
        pageVoters.length,
      );

      total = page.total;
      pageVoters.push(...page.voters);

      if (page.voters.length === 0) {
        break;
      }
    } while (pageVoters.length < total);

    return pageVoters;
  }

  const exactBoothVoters = await readLocalPages({ booth });
  if (exactBoothVoters.length > 0 || booth === "All") {
    return exactBoothVoters.filter((voter) => isVoterInBooth(voter, booth));
  }

  const voters = await readLocalPages({});
  return voters.filter((voter) => isVoterInBooth(voter, booth));
}
