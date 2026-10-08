import { getTemplatePages } from "@/utils/templatePages";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Grid2X2,
  LogOut,
  MapPinned,
  Menu,
  Printer,
  Rows3,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThermalPrinterDialog } from "@/features/voters/components/ThermalPrinterDialog";
import { VoterCard } from "@/features/voters/components/VoterCard";
import { VoterListSkeleton } from "@/features/voters/components/VoterListSkeleton";
import {
  shareVoterSlipImageFromRef,
  VoterSlipPaper,
  VoterSlipPreview,
} from "@/features/voters/components/VoterSlipPreview";

import {
  ensureAuthSession,
  getCurrentUser,
  getDefaultPoliticianRoute,
  hasPoliticianPageAccess,
  logoutPolitician,
  refreshCurrentUser,
  type AuthUser,
} from "@/services/authentication";
import {
  getLocalVoterPage,
  hasLocalVoters,
  replaceLocalVotersFromPages,
} from "@/services/local-voters";
import {
  getSavedThermalPrinter,
  printThermalVoterSlip,
} from "@/services/thermal-printer";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import {
  fetchTemplateVoters,
  forEachVoterPage,
  isVoterInBooth,
  logVoterTemplatePrint,
  type Voter,
  type VoterTemplateSelection,
} from "@/services/voters";

type TemplateLayout = "top" | "bottom" | "left" | "right" | "floating" | "dual";
type PrintScope = "single" | "family";
type SlipPreviewRequest = {
  voter: Voter;
  scope: PrintScope;
  withBanner: boolean;
};
type PrintTypeRequest = { voter: Voter; scope: PrintScope };
type ThermalPrintRequest = {
  bannerImage?: string;
  showBanner: boolean;
  voter: Voter;
};
type ShareImageRequest = { voter: Voter; resolve: () => void };

type TemplatePreviewStyle =
  | "bannerTop"
  | "bannerBottom"
  | "bannerLeft"
  | "bannerRight"
  | "floatingBadge"
  | "dualVertical";

type FieldKey =
  | "epicNo"
  | "relation"
  | "age"
  | "gender"
  | "ward"
  | "houseNo"
  | "booth"
  | "pollingStation";

const TEMPLATE_LAYOUTS: { key: TemplateLayout; label: string }[] = [
  { key: "top", label: "Banner Top" },
  { key: "bottom", label: "Banner Bottom" },
  { key: "left", label: "Banner Left" },
  { key: "right", label: "Banner Right" },
  { key: "floating", label: "Floating Badge" },
  { key: "dual", label: "Dual Vertical" },
];

const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "epicNo", label: "EPIC No" },
  { key: "relation", label: "Relation / Relative" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "ward", label: "Ward / Roll" },
  { key: "houseNo", label: "House No" },
  { key: "booth", label: "Booth No" },
  { key: "pollingStation", label: "Polling Station" },
];

const DEFAULT_FIELDS = FIELD_OPTIONS.reduce(
  (fields, option) => ({ ...fields, [option.key]: true }),
  {} as Record<FieldKey, boolean>,
);
const LOCAL_TEMPLATE_PAGE_SIZE = 100;
type TemplateListItem = { type: "controls" } | { type: "voter"; voter: Voter };
const TEMPLATE_CONTROLS_ITEM: TemplateListItem = { type: "controls" };

function uniqueValues(values: (string | undefined)[] = []) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  ).sort((first, second) => first.localeCompare(second));
}

function firstAssignedValue(values?: string[], fallback = "") {
  return uniqueValues(values).at(0) ?? fallback;
}

function joinedAssignedLabel(values?: string[], fallback = "Not assigned") {
  const assigned = uniqueValues(values);
  return assigned.length > 0 ? assigned.join(", ") : fallback;
}

function clampTemplateLayout(value?: string): TemplateLayout {
  return TEMPLATE_LAYOUTS.some((option) => option.key === value)
    ? (value as TemplateLayout)
    : "top";
}

function clampRecordsPerRow(value?: number): 2 | 3 | 4 {
  return value === 3 || value === 4 ? value : 2;
}

function previewStyleForLayout(layout: TemplateLayout): TemplatePreviewStyle {
  if (layout === "bottom") return "bannerBottom";
  if (layout === "left") return "bannerLeft";
  if (layout === "right") return "bannerRight";
  if (layout === "floating") return "floatingBadge";
  if (layout === "dual") return "dualVertical";
  return "bannerTop";
}

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

function buildTemplateHtml({
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
  fields: Record<FieldKey, boolean>;
  layout: TemplateLayout;
  politicianName: string;
  voters: Voter[];
  bannerImageUrl: string;
}) {
  const rowsPerPage = columns === 4 ? 4 : 3;
  const voterCards = voters.map((voter) => {
    const gender = displayValue(voter.gender);
    const age = displayValue(voter.age);
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
        ? `<div class="meta-left">House No: ${escapeHtml(house)}</div>`
        : "",
      fields.booth
        ? `<div class="meta-booth"><span>Booth&nbsp;No:</span> ${escapeHtml(boothValue)}</div>`
        : "",
      fields.pollingStation
        ? `<div class="meta-left">Station: ${escapeHtml(station)}</div>`
        : "",
    ].join("");

    const bannerBlock = bannerImageUrl
      ? `<div class="banner"><img src="${escapeHtml(bannerImageUrl)}" alt="Banner" class="banner-img" /></div>`
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
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      page-break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
    .banner { width: 100%; height: 160px; background: #f8fafc; overflow: hidden; }
    .banner-img { display: block; width: 100%; height: 100%; object-fit: contain; }
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
    .bottom { flex-direction: column-reverse; }
    .left, .right { display: grid; grid-template-columns: 34% 66%; }
    .left .banner, .right .banner { height: auto; min-height: 100%; }
    .right { grid-template-columns: 66% 34%; }
    .right .detail { grid-column: 1; grid-row: 1; }
    .right .banner { grid-column: 2; grid-row: 1; }
    .dual { display: grid; grid-template-columns: 1fr 1fr; }
    .dual .banner { min-height: 190px; }
    .dual .banner-img { height: 100%; object-fit: contain; }
    .detail { padding: 10px 14px; }
    .card-heading { display: flex; align-items: flex-start; gap: 8px; }
    .card-heading h2 { flex: 1; min-width: 0; }
    .card-heading .serial { position: static; flex-shrink: 0; }
    .relation { margin-top: 4px; }
    .meta-grid { margin-top: 6px; row-gap: 2px; }
    .compact { min-height: 0; }
    .compact .banner { height: 104px; }
    .compact .detail { padding: 6px; }
    .compact h2 { font-size: 12px; line-height: 15px; padding-right: 0; white-space: normal; overflow-wrap: anywhere; }
    .compact .epic { font-size: 11px; line-height: 14px; padding-right: 0; white-space: normal; overflow-wrap: anywhere; }
    .compact .relation, .compact .relation-prefix { font-size: 10px; line-height: 13px; white-space: normal; overflow-wrap: anywhere; }
    .compact .meta-left, .compact .meta-right, .compact .meta-booth { font-size: 10px; line-height: 13px; white-space: normal; overflow-wrap: anywhere; }
    .compact .serial { font-size: 8px; padding: 2px 5px; }
    .compact .card-heading { gap: 4px; }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

async function openWebTemplatePrint(html: string): Promise<void> {
  const printWindow = window.open("", "_blank");
  if (!printWindow)
    throw new Error(
      "Please allow popups for this site, then try printing again.",
    );
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    await Promise.all(
      Array.from(printWindow.document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
          window.setTimeout(resolve, 10000);
        });
      }),
    );
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    if (!printWindow.closed) printWindow.close();
    throw error;
  }
}

async function getAllLocalTemplateVoters(politicianId: string, booth: string) {
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

export default function TemplatesScreen() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printRequestActive = useRef(false);
  const [savingTemplateSelection, setSavingTemplateSelection] = useState(false);
  const [error, setError] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [slipPreview, setSlipPreview] = useState<SlipPreviewRequest | null>(
    null,
  );
  const [printTypeRequest, setPrintTypeRequest] =
    useState<PrintTypeRequest | null>(null);
  const [thermalPrintRequest, setThermalPrintRequest] =
    useState<ThermalPrintRequest | null>(null);
  const [shareImageRequest, setShareImageRequest] =
    useState<ShareImageRequest | null>(null);
  const shareSlipRef = useRef<View>(null);
  const templateListRef = useRef<FlashListRef<TemplateListItem>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(() =>
    getCurrentUser(),
  );
  const currentUser = profileUser;
  const assignedBooths = useMemo(
    () => uniqueValues(currentUser?.assignedBooths ?? []),
    [currentUser?.assignedBooths],
  );
  const assignedDistricts = useMemo(
    () => uniqueValues(currentUser?.districts ?? [currentUser?.district]),
    [currentUser?.district, currentUser?.districts],
  );
  const activeState = firstAssignedValue(
    currentUser?.states,
    currentUser?.state,
  );
  const activeDistrict = assignedDistricts[0] ?? "";
  const stateLabel = joinedAssignedLabel(
    currentUser?.states,
    currentUser?.state,
  );
  const districtLabel = joinedAssignedLabel(
    currentUser?.districts,
    currentUser?.district,
  );
  const savedTemplate = currentUser?.selectedVoterTemplate;

  // Prefer the template-specific banner, fall back to the profile banner.
  const templateBannerImage =
    (currentUser as any)?.templateBannerImage || currentUser?.bannerImage || "";

  const [selectedBooth, setSelectedBooth] = useState(
    () => profileUser?.assignedBooths?.[0] ?? profileUser?.booth ?? "",
  );
  const [columns, setColumns] = useState<2 | 3 | 4>(() =>
    clampRecordsPerRow(savedTemplate?.recordsPerRow),
  );
  const [layout, setLayout] = useState<TemplateLayout>(() =>
    clampTemplateLayout(savedTemplate?.canvasLayout),
  );
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0);

  const politicianName = currentUser?.name ?? "Politician";

  const hasSurveyAccess = hasPoliticianPageAccess("survey", currentUser);
  const hasTemplateAccess = hasPoliticianPageAccess("template", currentUser);
  const showQuickLinks = hasSurveyAccess && hasTemplateAccess;

  useEffect(() => {
    let active = true;

    refreshCurrentUser()
      .then((user) => {
        if (!active) return;
        setProfileUser(user);
        setColumns(
          clampRecordsPerRow(user.selectedVoterTemplate?.recordsPerRow),
        );
        setLayout(
          clampTemplateLayout(user.selectedVoterTemplate?.canvasLayout),
        );
        setSelectedBooth(
          (current) => current || user.assignedBooths?.[0] || user.booth || "",
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const loadVoters = useCallback(async () => {
    setLoading(true);
    try {
      const { user: sessionUser } = await ensureAuthSession();
      const user = profileUser ?? sessionUser;
      if (!hasPoliticianPageAccess("template", user)) {
        router.replace(getDefaultPoliticianRoute(user) ?? "/login");
        return;
      }
      if (!selectedBooth) {
        setVoters([]);
        setError("No booth is assigned to this account.");
        return;
      }

      const currentPoliticianId = sessionUser?.id ?? null;

      if (isLocalVoterDatabaseAvailable() && currentPoliticianId) {
        if (!(await hasLocalVoters(currentPoliticianId))) {
          await replaceLocalVotersFromPages(currentPoliticianId, (savePage) =>
            forEachVoterPage({}, savePage),
          );
        }

        const localVoters = await getAllLocalTemplateVoters(
          currentPoliticianId,
          selectedBooth,
        );
        setVoters(localVoters);
        setError("");
        return;
      }

      if (assignedDistricts.length === 0) {
        setVoters([]);
        setError("District is required to load booth voters.");
        return;
      }

      const districtResults = await Promise.all(
        assignedDistricts.map((district) =>
          fetchTemplateVoters({
            booth: selectedBooth,
            district,
            state: activeState,
          }).catch(() => []),
        ),
      );
      setVoters(districtResults.flat());
      setError("");
    } catch (loadError: any) {
      if (loadError?.message === "Please sign in again to continue.") {
        await logoutPolitician();
        router.replace("/login");
        return;
      }
      setError(loadError?.message ?? "Unable to load voters.");
    } finally {
      setLoading(false);
    }
  }, [activeState, assignedDistricts, profileUser, selectedBooth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVoters();
  }, [loadVoters]);

  useEffect(() => {
    if (!shareImageRequest) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      const waitForBanner = templateBannerImage ? 250 : 0;

      timer = setTimeout(() => {
        shareVoterSlipImageFromRef(
          shareSlipRef,
          shareImageRequest.voter,
          shareImageRequest.voter.whatsappNumber ||
            shareImageRequest.voter.mobileNumber,
          Boolean(templateBannerImage),
          templateBannerImage,
        ).finally(() => {
          shareImageRequest.resolve();
          setShareImageRequest(null);
        });
      }, waitForBanner);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [shareImageRequest, templateBannerImage]);

  const filteredVoters = useMemo(
    () =>
      Array.from(new Map(voters.map((voter) => [voter.id, voter])).values()),
    [voters],
  );
  const listData = useMemo<TemplateListItem[]>(
    () => [
      TEMPLATE_CONTROLS_ITEM,
      ...(loading ? [] : filteredVoters.map((voter) => ({ type: "voter" as const, voter }))),
    ],
    [filteredVoters, loading],
  );

  const boothOptions =
    assignedBooths.length > 0
      ? assignedBooths
      : [selectedBooth].filter(Boolean);
  const rowsPerPage = columns === 4 ? 4 : 3;
  const previewVoters = filteredVoters.slice(0, columns * rowsPerPage);
  const previewPages = getTemplatePages(previewVoters, columns * rowsPerPage);
  const templateSelection = useMemo<VoterTemplateSelection>(
    () => ({
      template: "studio",
      canvasLayout: layout,
      recordsPerRow: columns,
    }),
    [columns, layout],
  );

  const html = useMemo(
    () =>
      buildTemplateHtml({
        booth: selectedBooth === "All" ? "All Booths" : selectedBooth,
        columns,
        fields,
        layout,
        politicianName,
        voters: filteredVoters,
        bannerImageUrl: templateBannerImage,
      }),
    [
      columns,
      fields,
      filteredVoters,
      layout,
      politicianName,
      selectedBooth,
      templateBannerImage,
    ],
  );

  async function saveTemplateSelection(
    overrides: Partial<VoterTemplateSelection> = {},
    options: { printCount?: number; showError?: boolean } = {},
  ) {
    const nextSelection: VoterTemplateSelection = {
      ...templateSelection,
      ...overrides,
    };

    await logVoterTemplatePrint({
      booth: selectedBooth,
      district: activeDistrict,
      printCount: options.printCount,
      state: activeState,
      templateSelection: nextSelection,
    });
    const refreshedUser = await refreshCurrentUser().catch(() => undefined);

    if (refreshedUser) {
      setProfileUser(refreshedUser);
    }
  }

  async function saveTemplateSelectionPreference(
    overrides: Partial<VoterTemplateSelection>,
  ) {
    if (!selectedBooth) {
      Alert.alert(
        "No booth assigned",
        "A booth is required before saving the template selection.",
      );
      return;
    }

    setSavingTemplateSelection(true);
    try {
      await saveTemplateSelection(overrides, { printCount: 0 });
    } catch (saveError: any) {
      Alert.alert(
        "Template not saved",
        saveError?.message ?? "Unable to save the template selection.",
      );
    } finally {
      setSavingTemplateSelection(false);
    }
  }

  function handleColumnsSelect(value: string) {
    const nextColumns = clampRecordsPerRow(Number(value));
    setColumns(nextColumns);
    void saveTemplateSelectionPreference({ recordsPerRow: nextColumns });
  }

  function handleLayoutSelect(nextLayout: TemplateLayout) {
    setLayout(nextLayout);
    void saveTemplateSelectionPreference({ canvasLayout: nextLayout });
  }

  async function downloadPdf() {
    if (printRequestActive.current) return;
    if (filteredVoters.length === 0) {
      Alert.alert(
        "No voters",
        "Select a booth with voters before creating PDF.",
      );
      return;
    }

    printRequestActive.current = true;
    setSaving(true);
    try {
      if (Platform.OS === "web") {
        await openWebTemplatePrint(html);
        await saveTemplateSelection();
        return;
      }
      await saveTemplateSelection();
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) {
        throw new Error("Unable to access the PDF cache directory.");
      }
      // Write into the app's scoped cache so Sharing has permission to read it.
      const { base64 } = await Print.printToFileAsync({ html, base64: true });
      if (!base64) {
        throw new Error("Unable to create the PDF file.");
      }
      const uri = `${cacheDirectory}voter-template-${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF created", uri);
      }
    } catch (pdfError: any) {
      Alert.alert("PDF failed", pdfError?.message ?? "Unable to create PDF.");
    } finally {
      printRequestActive.current = false;
      setSaving(false);
    }
  }

  async function printTemplate() {
    if (printRequestActive.current) return;
    if (filteredVoters.length === 0) {
      Alert.alert("No voters", "Select a booth with voters before printing.");
      return;
    }

    printRequestActive.current = true;
    setPrinting(true);
    try {
      if (Platform.OS === "web") {
        await openWebTemplatePrint(html);
        await saveTemplateSelection();
        return;
      }
      await saveTemplateSelection();
      await Print.printAsync({ html });
    } catch (printError: any) {
      Alert.alert(
        "Print failed",
        printError?.message ?? "Unable to print template.",
      );
    } finally {
      printRequestActive.current = false;
      setPrinting(false);
    }
  }

  const handlePrint = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "single" });
  }, []);

  const handleFamily = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "family" });
  }, []);

  const handleShareVoterSlip = useCallback(async (voter: Voter) => {
    await new Promise<void>((resolve) => {
      setShareImageRequest({ voter, resolve });
    });
  }, []);

  function openSlipPreview(withBanner: boolean) {
    if (!printTypeRequest) return;
    setSlipPreview({ ...printTypeRequest, withBanner });
    setPrintTypeRequest(null);
  }

  const handleSlipPreviewPrint = useCallback(async () => {
    if (!slipPreview) return;
    const request = {
      bannerImage: templateBannerImage,
      showBanner: slipPreview.withBanner,
      voter: slipPreview.voter,
    };

    const savedPrinter = await getSavedThermalPrinter();
    if (!savedPrinter) {
      setThermalPrintRequest(request);
      return;
    }

    try {
      await printThermalVoterSlip(request.voter, savedPrinter, request);
      setSlipPreview(null);
    } catch {
      setThermalPrintRequest(request);
    }
  }, [slipPreview, templateBannerImage]);

  const handleChangeThermalPrinter = useCallback(async () => {
    if (!slipPreview) return;
    setThermalPrintRequest({
      bannerImage: templateBannerImage,
      showBanner: slipPreview.withBanner,
      voter: slipPreview.voter,
    });
  }, [slipPreview, templateBannerImage]);

  function openMenu() {
    setMenuVisible(true);
  }

  async function handleLogout() {
    setMenuVisible(false);
    await logoutPolitician();
    router.replace("/login");
  }

  function goToSurvey() {
    setMenuVisible(false);
    router.push("/politician/survey");
  }

  function goToVoters() {
    setMenuVisible(false);
    router.push("/politician/voters");
  }

  function renderScreenHeader() {
    return (
      <>
        {/* ================= BANNER TOP ================= */}
        <View style={styles.header}>
          <Image
            source={require("../../../assets/images/vote.jpeg")}
            style={styles.headerImage}
            resizeMode="cover"
          />
          <View style={styles.headerOverlay} />

          <View style={styles.headerTop}>
            <View />
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerIconButton}
                onPress={() => setPreviewVisible(true)}>
                <Eye color="#0F766E" size={18} strokeWidth={2.8} />
              </Pressable>
              <Pressable
                style={styles.headerIconButton}
                onPress={downloadPdf}
                disabled={saving || printing}>
                {saving ? (
                  <ActivityIndicator size="small" color="#0F766E" />
                ) : (
                  <Download color="#0F766E" size={18} strokeWidth={2.8} />
                )}
              </Pressable>
              <Pressable
                style={styles.headerIconButton}
                onPress={printTemplate}
                disabled={printing || saving}>
                {printing ? (
                  <ActivityIndicator size="small" color="#0F766E" />
                ) : (
                  <Printer color="#0F766E" size={18} strokeWidth={2.8} />
                )}
              </Pressable>
              <Pressable
                style={[styles.headerIconButton, styles.menuButton]}
                onPress={openMenu}>
                <Menu color="#FFFFFF" size={21} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>VOTER LIST</Text>
            <Text style={styles.title}>Ward-14</Text>
            <Text style={styles.boothTitle}>
              Booth-{selectedBooth || "1"}, {selectedBooth ? "" : "2"}
            </Text>
            <View style={styles.locationRow}>
              <MapPinned color="#087568" size={14} strokeWidth={2.8} />
              <Text style={styles.location}>
                {districtLabel}, {stateLabel}
              </Text>
            </View>
          </View>
        </View>
        {/* =============== / BANNER TOP ================= */}

        {error ? <Text style={styles.warning}>{error}</Text> : null}
      </>
    );
  }

  function renderStickyControls() {
    return (
      <View style={styles.stickyControls}>
        <View style={styles.panel}>
          <View style={styles.filterGrid}>
            <SelectChip
              icon={<Rows3 color="#075e54" size={15} />}
              label={selectedBooth || "No booth assigned"}
              options={boothOptions}
              onSelect={setSelectedBooth}
            />
            <SelectChip
              icon={<Grid2X2 color="#075e54" size={15} />}
              label={`${columns} / row`}
              options={["2", "3", "4"]}
              onSelect={handleColumnsSelect}
            />
            <Pressable
              style={styles.filterIconButton}
              onPress={() => setFilterVisible(true)}
              accessibilityLabel="Open template filters">
              <SlidersHorizontal color="#FFFFFF" size={18} strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  function renderListItem({ item }: { item: TemplateListItem }) {
    if (item.type === "controls") {
      return renderStickyControls();
    }

    return (
      <View style={styles.voterItem}>
        <VoterCard
          voter={item.voter}
          onPrint={handlePrint}
          onFamily={handleFamily}
          onShare={handleShareVoterSlip}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlashList
        ref={templateListRef}
        data={listData}
        keyExtractor={(item) =>
          item.type === "voter" ? `voter:${item.voter.id}` : "controls"
        }
        renderItem={renderListItem}
        getItemType={(item) => item.type}
        stickyHeaderIndices={[0]}
        onScroll={(event) => {
          const visible = event.nativeEvent.contentOffset.y > 300;
          setShowScrollTop((current) =>
            current === visible ? current : visible,
          );
        }}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderScreenHeader}
        ListFooterComponent={loading ? <View style={{ paddingHorizontal: 12, paddingBottom: 20 }}><VoterListSkeleton /></View> : null}
      />

      {showScrollTop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scroll to top"
          onPress={() =>
            templateListRef.current?.scrollToOffset({
              offset: 0,
              animated: true,
            })
          }
          style={styles.scrollTopButton}>
          <ArrowUp color="#FFFFFF" size={20} strokeWidth={3} />
        </Pressable>
      ) : null}

      {/* ===================== FILTER DRAWER ===================== */}
      <Modal
        transparent
        visible={filterVisible}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setFilterVisible(false)}>
          <Pressable style={styles.filterSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />

            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Template Filters</Text>
              <Pressable
                onPress={() => setFilterVisible(false)}
                style={styles.filterSheetClose}>
                <X color="#334155" size={20} strokeWidth={2.7} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.filterSheetBody}>
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>CANVA LAYOUTS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.layoutTabs}>
                  {TEMPLATE_LAYOUTS.map((item) => (
                    <Pressable
                      key={item.key}
                      onPress={() => handleLayoutSelect(item.key)}
                      disabled={savingTemplateSelection}
                      style={[
                        styles.layoutTab,
                        layout === item.key && styles.layoutTabActive,
                        savingTemplateSelection && styles.layoutTabSaving,
                      ]}>
                      <Text
                        style={[
                          styles.layoutTabText,
                          layout === item.key && styles.layoutTabTextActive,
                        ]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>VOTER DETAILS</Text>
                  <View style={styles.sectionHeaderRight}>
                    <Pressable
                      onPress={() => setFields(DEFAULT_FIELDS)}
                      hitSlop={6}>
                      <Text style={styles.bulkText}>Select all</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setFields(
                          FIELD_OPTIONS.reduce(
                            (nextFields, option) => ({
                              ...nextFields,
                              [option.key]: false,
                            }),
                            {} as Record<FieldKey, boolean>,
                          ),
                        )
                      }
                      hitSlop={6}>
                      <Text style={styles.bulkTextMuted}>Clear all</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGrid}>
                  {FIELD_OPTIONS.map((field) => (
                    <Pressable
                      key={field.key}
                      onPress={() =>
                        setFields((current) => ({
                          ...current,
                          [field.key]: !current[field.key],
                        }))
                      }
                      style={[
                        styles.fieldChip,
                        fields[field.key] && styles.fieldChipActive,
                      ]}>
                      <View
                        style={[
                          styles.checkBox,
                          fields[field.key] && styles.checkBoxActive,
                        ]}>
                        {fields[field.key] ? (
                          <Check color="#ffffff" size={12} strokeWidth={3} />
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={styles.fieldText}>
                        {field.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={styles.filterApplyButton}
              onPress={() => setFilterVisible(false)}>
              {savingTemplateSelection ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.filterApplyText}>Apply</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===================== PREVIEW MODAL ===================== */}
      <Modal
        transparent
        visible={previewVisible}
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <SafeAreaView style={styles.previewHeaderCopy}>
                <Text style={styles.previewTitle}>Template Preview</Text>
                <Text style={styles.previewSubtitle}>
                  Showing {previewVoters.length} sample voters. PDF includes all{" "}
                  {filteredVoters.length} voters.
                </Text>
              </SafeAreaView>
              <Pressable
                onPress={() => setPreviewVisible(false)}
                style={styles.previewCloseButton}>
                <X color="#334155" size={20} strokeWidth={2.7} />
              </Pressable>
            </View>
            <ScrollView
              style={{
                flexGrow: 0,
                height:
                  previewWidth > 0
                    ? Math.ceil(previewVoters.length / (columns * rowsPerPage)) *
                        1123 *
                        Math.min(1, previewWidth / 794) +
                      Math.max(
                        0,
                        Math.ceil(previewVoters.length / (columns * rowsPerPage)) - 1,
                      ) *
                        12 +
                      24
                    : 400,
              }}
              onLayout={(event) =>
                setPreviewWidth(
                  Math.max(1, event.nativeEvent.layout.width - 24),
                )
              }
              contentContainerStyle={{
                padding: 12,
                gap: 12,
                alignItems: "center",
                backgroundColor: "#CBD5E1",
              }}>
              {previewWidth > 0 &&
                previewPages.map((pageVoters, pageIndex) => {
                  const scale = Math.min(1, previewWidth / 794);
                  return (
                    <View
                      key={pageIndex}
                      style={{
                        width: 794 * scale,
                        height: 1123 * scale,
                        overflow: "hidden",
                        flexShrink: 0,
                      }}>
                      <View
                        style={[
                          styles.previewSheet,
                          {
                            width: 794,
                            height: 1123,
                            backgroundColor: "#FFFFFF",
                            transform: [{ scale }],
                            transformOrigin: "top left",
                          },
                        ]}>
                        <Text style={styles.paperTitle}>
                          Booth{" "}
                          {selectedBooth === "All"
                            ? "All Booths"
                            : selectedBooth}{" "}
                          Voter Template
                        </Text>
                        <Text style={styles.paperSubtitle}>
                          {pageVoters.length} voters
                        </Text>
                        <View style={styles.paperRule} />
                        <View style={styles.previewGrid}>
                          {getTemplatePages(pageVoters, rowsPerPage).map(
                            (columnVoters, columnIndex) => (
                              <View
                                key={columnIndex}
                                style={{
                                  width:
                                    (794 - 56 - (columns - 1) * 10) / columns,
                                  gap: 10,
                                }}>
                                {columnVoters.map((voter) => (
                                  <View
                                    key={voter.id}
                                    style={styles.previewCardCell}>
                                    <TemplateCard
                                      compact={columns === 4}
                                      fields={fields}
                                      layout={layout}
                                      politicianName={politicianName}
                                      voter={voter}
                                      bannerImageUrl={templateBannerImage}
                                    />
                                  </View>
                                ))}
                              </View>
                            ),
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================== VOTER CARD PRINT FLOW ===================== */}
      <Modal
        transparent
        visible={Boolean(printTypeRequest)}
        animationType="fade"
        onRequestClose={() => setPrintTypeRequest(null)}>
        {printTypeRequest ? (
          <Pressable
            style={styles.printChoiceBackdrop}
            onPress={() => setPrintTypeRequest(null)}>
            <Pressable style={styles.printChoicePanel}>
              <View style={styles.printChoiceHeader}>
                <Text style={styles.printChoiceTitle}>
                  {printTypeRequest.scope === "family"
                    ? "Select Family Print Type"
                    : "Select Voter Slip Print Type"}
                </Text>
                <Pressable
                  accessibilityLabel="Close print type"
                  onPress={() => setPrintTypeRequest(null)}
                  style={styles.printChoiceClose}>
                  <Text style={styles.printChoiceCloseText}>x</Text>
                </Pressable>
              </View>

              <PrintChoiceRow
                icon={
                  printTypeRequest.scope === "family" ? "family-print" : "print"
                }
                title={
                  printTypeRequest.scope === "family"
                    ? "Print Family Members with Banner"
                    : "Print Voter Slip with Banner"
                }
                subtitle={
                  printTypeRequest.scope === "family"
                    ? "Family member slips with banner."
                    : "Voter slip with banner image."
                }
                onPress={() => openSlipPreview(true)}
              />

              <PrintChoiceRow
                icon={printTypeRequest.scope === "family" ? "family" : "print"}
                title={
                  printTypeRequest.scope === "family"
                    ? "Print Family Members without Banner"
                    : "Print Voter Slip without Banner"
                }
                subtitle={
                  printTypeRequest.scope === "family"
                    ? "Family member slips."
                    : "Voter slip only."
                }
                onPress={() => openSlipPreview(false)}
              />
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>

      <Modal
        transparent
        visible={Boolean(slipPreview)}
        animationType="fade"
        onRequestClose={() => setSlipPreview(null)}>
        {slipPreview ? (
          <SafeAreaView style={styles.slipPreviewSafeArea}>
            <VoterSlipPreview
              voter={slipPreview.voter}
              onClose={() => setSlipPreview(null)}
              showBanner={slipPreview.withBanner}
              bannerImage={templateBannerImage}
              onPrint={handleSlipPreviewPrint}
              onChangeDevice={handleChangeThermalPrinter}
            />
          </SafeAreaView>
        ) : null}
      </Modal>

      {thermalPrintRequest ? (
        <ThermalPrinterDialog
          visible
          voter={thermalPrintRequest.voter}
          bannerImage={thermalPrintRequest.bannerImage}
          showBanner={thermalPrintRequest.showBanner}
          onClose={() => setThermalPrintRequest(null)}
          onPrinted={() => {
            setThermalPrintRequest(null);
            setSlipPreview(null);
          }}
        />
      ) : null}

      {shareImageRequest ? (
        <View pointerEvents="none" style={styles.shareCaptureHost}>
          <View collapsable={false} ref={shareSlipRef}>
            <VoterSlipPaper
              voter={shareImageRequest.voter}
              showBanner={Boolean(templateBannerImage)}
              bannerImage={templateBannerImage}
            />
          </View>
        </View>
      ) : null}

      {/* ===================== SIDE / BOTTOM MENU ===================== */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />

            {showQuickLinks ? (
              <>
                <Pressable style={styles.menuItem} onPress={goToSurvey}>
                  <View style={styles.menuIconWrap}>
                    <ClipboardList
                      color="#075e54"
                      size={18}
                      strokeWidth={2.6}
                    />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Open survey page</Text>
                    <Text style={styles.menuSubtitle}>
                      Manage voter surveys
                    </Text>
                  </View>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={goToVoters}>
                  <View style={styles.menuIconWrap}>
                    <FileText color="#075e54" size={18} strokeWidth={2.6} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Open voter page</Text>
                    <Text style={styles.menuSubtitle}>
                      Manage voter records
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.menuDivider} />
              </>
            ) : null}

            <Pressable style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIconWrap, styles.menuIconWrapDanger]}>
                <LogOut color="#b91c1c" size={18} strokeWidth={2.6} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuTitle, styles.menuTitleDanger]}>
                  Logout
                </Text>
                <Text style={styles.menuSubtitle}>
                  Sign out from this device
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SelectChip({
  icon,
  label,
  onSelect,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: (value: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.selectWrap}>
      <Pressable style={styles.selectChip} onPress={() => setOpen(true)}>
        {icon}
        <Text numberOfLines={1} style={styles.selectText}>
          {label}
        </Text>
        <ChevronDown color="#075e54" size={16} strokeWidth={2.7} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setOpen(false)}>
          <View style={styles.dropdownPanel}>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  style={styles.dropdownRow}>
                  <Text style={styles.dropdownText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function TemplateCard({
  compact = false,
  fields,
  layout,
  politicianName,
  voter,
  bannerImageUrl,
}: {
  compact?: boolean;
  fields: Record<FieldKey, boolean>;
  layout: TemplateLayout;
  politicianName: string;
  voter: Voter;
  bannerImageUrl: string;
}) {
  const gender = displayValue(voter.gender);
  const age = displayValue(voter.age);
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
  const booth = displayValue(voter.booth);
  const station = displayValue(voter.pollingStation);

  // Banner rendered FIRST → default `column` puts it on top.
  // `.bannerBottom` uses `column-reverse` to flip it below the details.
  return (
    <View
      style={[
        styles.templateCard,
        compact && styles.compactCard,
        previewStyleForLayout(layout) === "bannerBottom" && styles.bannerBottom,
        previewStyleForLayout(layout) === "bannerLeft" && styles.bannerLeft,
        previewStyleForLayout(layout) === "bannerRight" && styles.bannerRight,
        previewStyleForLayout(layout) === "dualVertical" && styles.dualVertical,
      ]}>
      <View style={[styles.cardBanner, compact && styles.compactBanner]}>
        {bannerImageUrl ? (
          <Image
            source={{ uri: bannerImageUrl }}
            style={styles.cardBannerImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.cardBannerPlaceholder}>
            <Text style={styles.cardBannerPlaceholderText}>
              {politicianName} Banner
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.cardDetail, compact && styles.compactDetail]}>
        <View style={styles.cardHeading}>
          <Text style={[styles.cardName, compact && styles.compactName]}>
            {voter.name.toUpperCase()}
          </Text>
          <View style={[styles.cardSerial, compact && styles.compactSerial]}>
            <Text
              style={[
                styles.cardSerialText,
                compact && styles.compactSerialText,
              ]}>
              #{displayValue(voter.serialNo || voter.id)}
            </Text>
          </View>
        </View>

        {fields.epicNo ? (
          <Text style={[styles.cardEpic, compact && styles.compactEpic]}>
            EPIC: {displayValue(voter.epicNo)}
          </Text>
        ) : null}

        {fields.relation ? (
          <View style={styles.cardRelationRow}>
            <Text
              style={[
                styles.cardRelationPrefix,
                compact && styles.compactText,
              ]}>
              पति:
            </Text>
            <Text
              style={[styles.cardRelationValue, compact && styles.compactText]}>
              {relationLine}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardMetaGrid}>
          {fields.age || fields.gender ? (
            <Text style={[styles.cardMetaText, compact && styles.compactText]}>
              {ageGender}
            </Text>
          ) : null}
          {fields.ward ? (
            <Text
              style={[styles.cardMetaTextRight, compact && styles.compactText]}>
              Ward: {ward}
            </Text>
          ) : null}
          {fields.houseNo ? (
            <Text style={[styles.cardMetaText, compact && styles.compactText]}>
              House No: {house}
            </Text>
          ) : null}
          {fields.booth ? (
            <Text style={[styles.cardBoothText, compact && styles.compactText]}>
              Booth{"\u00A0"}No: {booth}
            </Text>
          ) : null}
          {fields.pollingStation ? (
            <Text style={[styles.cardMetaText, compact && styles.compactText]}>
              Station: {station}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PrintChoiceRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: "print" | "family" | "family-print";
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const isFamily = icon !== "print";

  return (
    <Pressable onPress={onPress} style={styles.printChoiceRow}>
      <View style={styles.printChoiceIcon}>
        {isFamily ? (
          <UsersRound color="#087568" size={22} strokeWidth={2.5} />
        ) : (
          <Printer color="#087568" size={22} strokeWidth={2.5} />
        )}
      </View>
      <View style={styles.printChoiceCopy}>
        <Text style={styles.printChoiceRowTitle}>{title}</Text>
        <Text style={styles.printChoiceSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollTopButton: {
    position: "absolute",
    right: 18,
    bottom: 26,
    zIndex: 50,
    elevation: 8,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  slipPreviewSafeArea: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 34 },
  listContent: { paddingBottom: 34 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centerText: { color: "#475569", fontWeight: "800" },

  /* ============ Header (matches voter page) ============ */
  header: {
    minHeight: 190,
    backgroundColor: "#E6F4EA",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    overflow: "hidden",
  },
  headerImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "155%",
    height: "100%",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerActions: { flexDirection: "row", gap: 10 },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F766E",
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
  },
  menuButton: { backgroundColor: "#087568" },
  headerCopy: { marginTop: 2 },
  eyebrow: {
    color: "#55718A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  title: {
    color: "#0F172A",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 2,
  },
  boothTitle: {
    color: "#087568",
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "900",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  location: { color: "#087568", fontSize: 13, fontWeight: "900" },

  /* ============ Existing screen ============ */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  topCopy: { flex: 1 },
  subtitle: { color: "#587099", fontSize: 13, fontWeight: "800", marginTop: 3 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbe5ef",
  },
  warning: {
    color: "#9a3412",
    backgroundColor: "#ffedd5",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    fontWeight: "800",
    marginHorizontal: 16,
    marginTop: 14,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginHorizontal: 16,
    marginTop: 14,
  },
  stickyControls: {
    backgroundColor: "#f1f5f9",
    paddingBottom: 2,
    zIndex: 10,
    elevation: 10,
  },
  filterGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectWrap: { flex: 1, minWidth: 0 },
  selectChip: {
    height: 42,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#075e54",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fff",
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 7,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedChip: { backgroundColor: "#f8fafc", borderColor: "#cbd5e1" },
  selectText: { flex: 1, color: "#075e54", fontSize: 12, fontWeight: "900" },
  sectionBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  sectionLabel: {
    color: "#8aa0bd",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 10,
  },
  layoutTabs: { gap: 8 },
  layoutTab: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  layoutTabActive: { backgroundColor: "#075e54", borderColor: "#075e54" },
  layoutTabSaving: { opacity: 0.65 },
  layoutTabText: { color: "#334155", fontSize: 12, fontWeight: "900" },
  layoutTabTextActive: { color: "#fff" },
  bulkText: { color: "#075e54", fontSize: 11, fontWeight: "900" },
  bulkTextMuted: { color: "#64748b", fontSize: 11, fontWeight: "900" },
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fieldChip: {
    width: "48%",
    minHeight: 36,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#075e54",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  fieldText: {
    flex: 1,
    color: "#075e54",
    fontSize: 11,
    fontWeight: "900",
  },
  fieldChipActive: { backgroundColor: "#e2f3ee" },
  checkBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#075e54",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: { backgroundColor: "#075e54" },

  /* ============ Booth Voters cards ============ */
  votersSection: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  voterItem: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tableTitle: { color: "#020617", fontSize: 18, fontWeight: "900" },
  tableSubtitle: {
    color: "#587099",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 10,
  },
  voterCardList: {
    gap: 10,
  },

  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  dropdownPanel: {
    maxHeight: 360,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  dropdownRow: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  dropdownText: { color: "#0f172a", fontWeight: "800" },

  /* ============ Preview modal ============ */
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.58)",
    padding: 14,
    justifyContent: "center",
  },
  previewPanel: {
    maxHeight: "100%",
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  previewHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  previewHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  previewTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900" },
  previewSubtitle: {
    color: "#587099",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  previewCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  previewSheet: { padding: 28 },
  paperTitle: { color: "#020617", fontSize: 20, fontWeight: "900" },
  paperSubtitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  paperRule: { height: 2, backgroundColor: "#075e54", marginVertical: 10 },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 10,
  },
  previewCardCell: {
    minWidth: 0,
  },

  /* ============ Preview TemplateCard ============ */
  templateCard: {
    minHeight: 190,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  compactCard: { minHeight: 0 },
  compactBanner: { height: 104 },
  compactDetail: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6 },
  compactName: { fontSize: 12, lineHeight: 15, letterSpacing: 0 },
  compactEpic: { fontSize: 11, lineHeight: 14 },
  compactText: { fontSize: 10, lineHeight: 13 },
  compactSerialText: { fontSize: 8 },
  compactSerial: { paddingHorizontal: 5, paddingVertical: 2 },
  cardDetail: {
    flexGrow: 1,
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardSerial: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cardSerialText: {
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "900",
  },
  cardName: {
    flex: 1,
    color: "#020617",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    letterSpacing: 0.3,
    paddingRight: 0,
  },
  cardEpic: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
    paddingRight: 0,
  },
  cardRelationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  cardRelationPrefix: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "900",
  },
  cardRelationValue: {
    flex: 1,
    color: "#0F766E",
    fontSize: 13,
    fontWeight: "900",
  },
  cardMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    rowGap: 2,
  },
  cardMetaText: {
    width: "50%",
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    paddingRight: 6,
  },
  cardBoothText: {
    width: "100%",
    color: "#475569",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  cardMetaTextRight: {
    width: "50%",
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    paddingLeft: 6,
  },
  cardBanner: {
    width: "100%",
    height: 160,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  cardBannerImage: { width: "100%", height: "100%" },
  cardBannerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2F3EE",
  },
  cardBannerPlaceholderText: {
    color: "#075E54",
    fontSize: 11,
    fontWeight: "900",
  },
  bannerBottom: { flexDirection: "column-reverse" },
  bannerLeft: { flexDirection: "row" },
  bannerRight: { flexDirection: "row-reverse" },
  floatingBadge: {},
  dualVertical: { flexDirection: "row" },
  shareCaptureHost: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 420,
    opacity: 0.01,
  },

  /* ============ Print choice modal ============ */
  printChoiceBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  printChoicePanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  printChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  printChoiceTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  printChoiceClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  printChoiceCloseText: { color: "#64748B", fontSize: 24, lineHeight: 24 },
  printChoiceRow: {
    minHeight: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
  },
  printChoiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#E2F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  printChoiceCopy: { flex: 1, minWidth: 0 },
  printChoiceRowTitle: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  printChoiceSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  /* ============ Filter drawer ============ */
  filterSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 16,
    maxHeight: "85%",
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  filterSheetTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900",
  },
  filterSheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  filterSheetBody: {
    paddingBottom: 14,
  },
  filterApplyButton: {
    height: 46,
    borderRadius: 8,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  filterApplyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  /* ============ Side / bottom menu ============ */
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  menuHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 14,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#e2f3ee",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconWrapDanger: {
    backgroundColor: "#fee2e2",
  },
  menuCopy: { flex: 1 },
  menuTitle: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "900",
  },
  menuTitleDanger: { color: "#b91c1c" },
  menuSubtitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 6,
  },
});
