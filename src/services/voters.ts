import { api } from "./api";
import {
  ensureAuthSession,
  getCurrentUser,
  hasPoliticianPageAccess,
} from "./authentication";

export type Voter = {
  id: string;
  name: string;
  gender: string;
  age: number;
  guardian: string;
  epicNo: string;
  houseNo: string;
  booth: string;
  ward?: string;
  district?: string;
  state?: string;
  hindiName?: string;
  serialNo?: string;
  pollingStation?: string;
  relation?: string;
  whatsappNumber?: string;
  mobileNumber?: string;
};

export type VoterStats = {
  total: number;
  boothCounts: Record<string, number>;
  male: number;
  female: number;
  senior: number;
};

export type VoterQuery = {
  search?: string;
  booth?: string;
  ward?: string;
  district?: string;
  state?: string;
  city?: string;
};

export type VoterTemplateSelection = {
  template: "studio";
  canvasLayout: "top" | "bottom" | "left" | "right" | "floating" | "dual";
  recordsPerRow: 2 | 3 | 4;
};

const VOTER_PAGE_SIZE = 200000;
const MAX_VOTER_PAGES = 500;

let selectedVoter: Voter | null = null;

export function setSelectedVoter(voter: Voter | null) {
  selectedVoter = voter;
}

export function getSelectedVoter() {
  return selectedVoter;
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function normalizeRelation(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isEmptyValue(value: unknown) {
  return (
    !value ||
    String(value).trim() === "" ||
    String(value).trim().toUpperCase() === "N/A"
  );
}

function formatGuardian(data: any) {
  const relation = firstValue(data?.Relation, data?.relation);
  const normalizedRelation = normalizeRelation(relation);
  let guardian: unknown;

  if (
    normalizedRelation.includes("father") ||
    normalizedRelation.includes("पिता") ||
    normalizedRelation.includes("ਪਿਤਾ")
  ) {
    guardian = firstValue(data?.["Father Name"], data?.fatherName);
  } else if (
    normalizedRelation.includes("husband") ||
    normalizedRelation.includes("पति") ||
    normalizedRelation.includes("ਪਤੀ")
  ) {
    guardian = firstValue(data?.["Husband Name"], data?.husbandName);
  } else if (
    normalizedRelation.includes("mother") ||
    normalizedRelation.includes("माता") ||
    normalizedRelation.includes("ਮਾਤਾ")
  ) {
    guardian = firstValue(data?.["Mother Name"], data?.motherName);
  }

  guardian = firstValue(
    guardian,
    data?.guardian,
    data?.guardian_name,
    data?.["Guardian Name"],
    data?.guardianName,
    data?.["Father Name"],
    data?.fatherName,
    data?.["Husband Name"],
    data?.husbandName,
    data?.["Mother Name"],
    data?.motherName,
  );

  if (isEmptyValue(guardian)) {
    return "N/A";
  }

  return !isEmptyValue(relation)
    ? `${guardian} (${relation})`
    : String(guardian);
}

function normalizeAge(value: unknown) {
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 ? Math.trunc(age) : 0;
}

function normalizeVoter(raw: any, index: number): Voter {
  const data = raw?.voterData ?? raw?.data?.voterData ?? raw;

  return {
    id: String(
      firstValue(
        raw?.id,
        data?._id,
        raw?._id,
        data?.["Voter ID"],
        raw?.voterId,
        index,
      ),
    ),
    name: String(
      firstValue(
        data?.["Voter Name English"],
        data?.voterNameEnglish,
        raw?.name,
        raw?.voterName,
        raw?.fullName,
        raw?.voter_name,
        "Unknown voter",
      ),
    ),
    hindiName: String(
      firstValue(
        data?.["Voter Name Hindi"],
        data?.voterNameHindi,
        data?.voter_name_hindi,
        data?.nameHindi,
        raw?.hindiName,
        "",
      ),
    ),
    gender: String(
      firstValue(
        data?.Gender,
        data?.voter_gender,
        raw?.gender,
        raw?.sex,
        raw?.voterGender,
        "Unknown",
      ),
    ),
    age: normalizeAge(
      firstValue(
        data?.Age,
        data?.voter_age,
        raw?.age,
        raw?.voterAge,
        raw?.ageYears,
        0,
      ),
    ),
    guardian: formatGuardian(data),
    epicNo: String(
      firstValue(
        data?.["EPIC No"],
        data?.Epic_no,
        data?.epicNo,
        data?.epic_no,
        data?.voter_id,
        raw?.epicNo,
        raw?.epicNumber,
        raw?.voterIdCardNo,
        "N/A",
      ),
    ),
    houseNo: String(
      firstValue(
        data?.["House No"],
        data?.["House No."],
        data?.houseNo,
        data?.house_no,
        data?.Address,
        raw?.houseNo,
        raw?.houseNumber,
        raw?.address,
        "N/A",
      ),
    ),
    booth: String(
      firstValue(
        data?.["Booth ID"],
        data?.["Booth No"],
        data?.["Booth No_"],
        data?.Booth,
        data?.booth_id,
        data?.booth_no,
        data?.boothNumber,
        data?.boothId,
        raw?.booth,
        raw?.boothName,
        raw?.partName,
        raw?.boothNo,
        raw?.partNo,
        "Booth",
      ),
    ),
    ward: String(
      firstValue(
        data?.Ward,
        data?.ward,
        raw?.ward,
        raw?.wardName,
        raw?.wardNo,
        "",
      ),
    ),
    serialNo: String(
      firstValue(
        data?.["Serial No"],
        data?.["Serial No."],
        data?.["Voter Serial No"],
        data?.["Voter Serial No."],
        data?.voter_serial_no,
        data?.serialNo,
        raw?.serialNo,
        "",
      ),
    ),
    pollingStation: String(
      firstValue(
        data?.["Polling Station"],
        data?.["Polling Station No. & Address"],
        data?.pollingStation,
        data?.pollingStationAddress,
        raw?.pollingStation,
        "",
      ),
    ),
    whatsappNumber: String(
      firstValue(
        data?.["WhatsApp No"],
        data?.["Whatsapp No"],
        data?.["WhatsApp Number"],
        data?.["Whatsapp Number"],
        data?.whatsappNumber,
        data?.whatsappNo,
        data?.whatsAppNumber,
        data?.whats_app_number,
        data?.whatsapp,
        data?.WhatsApp,
        raw?.whatsappNumber,
        raw?.whatsappNo,
        "",
      ),
    ),
    mobileNumber: String(
      firstValue(
        data?.["Mobile No"],
        data?.["Mobile Number"],
        data?.Phone,
        data?.phone,
        data?.mobile,
        data?.mobileNumber,
        data?.mobile_no,
        data?.contactNumber,
        data?.contact_no,
        raw?.mobileNumber,
        raw?.mobile,
        raw?.phone,
        "",
      ),
    ),
  };
}

function unwrapList(raw: any): any[] {
  const list =
    raw?.voters ??
    raw?.data?.voters ??
    raw?.data?.items ??
    raw?.items ??
    raw?.results ??
    raw?.data?.results ??
    raw?.data ??
    raw;

  return Array.isArray(list) ? list : [];
}

function readTotalCount(raw: any): number | null {
  const total = firstValue(
    raw?.total,
    raw?.totalCount,
    raw?.count,
    raw?.data?.total,
    raw?.data?.totalCount,
    raw?.data?.count,
    raw?.pagination?.total,
    raw?.pagination?.totalCount,
    raw?.meta?.total,
    raw?.meta?.totalCount,
  );
  const numericTotal = Number(total);

  return Number.isFinite(numericTotal) && numericTotal > 0
    ? numericTotal
    : null;
}

export function buildVoterStats(voters: Voter[]): VoterStats {
  return voters.reduce<VoterStats>(
    (stats, voter) => {
      stats.total += 1;
      stats.boothCounts[voter.booth] =
        (stats.boothCounts[voter.booth] ?? 0) + 1;
      if (voter.gender.toLowerCase().startsWith("m")) {
        stats.male += 1;
      }
      if (voter.gender.toLowerCase().startsWith("f")) {
        stats.female += 1;
      }
      if (voter.age >= 60) {
        stats.senior += 1;
      }
      return stats;
    },
    { total: 0, boothCounts: {}, male: 0, female: 0, senior: 0 },
  );
}

export async function fetchVoters(query: VoterQuery = {}): Promise<Voter[]> {
  const { user } = await ensureAuthSession();
  if (
    !hasPoliticianPageAccess("voters", user) &&
    !hasPoliticianPageAccess("template", user)
  ) {
    throw new Error("Voter data is disabled for this account.");
  }
  const politician = getCurrentUser();
  const baseParams = {
    search: query.search || undefined,
    district: query.district || politician?.district || undefined,
    state: query.state || politician?.state || undefined,
    wardNo: query.ward || politician?.ward || undefined,
    ward: query.ward || politician?.ward || undefined,
    boothNo: query.booth || undefined,
    includeCounts: false,
  };
  const voters: Voter[] = [];
  const seenVoterIds = new Set<string>();
  let totalCount: number | null = null;

  for (let page = 1; page <= MAX_VOTER_PAGES; page += 1) {
    const response = await api.get("/politician/voters", {
      params: {
        ...baseParams,
        page,
        limit: VOTER_PAGE_SIZE,
      },
    });
    const pageItems = unwrapList(response.data);

    totalCount = totalCount ?? readTotalCount(response.data);

    if (pageItems.length === 0) {
      break;
    }

    const previousCount = voters.length;
    pageItems
      .map((item, index) => normalizeVoter(item, voters.length + index))
      .forEach((voter) => {
        if (!seenVoterIds.has(voter.id)) {
          seenVoterIds.add(voter.id);
          voters.push(voter);
        }
      });

    if (totalCount !== null && voters.length >= totalCount) {
      break;
    }
    if (voters.length === previousCount) {
      break;
    }
  }

  return voters;
}

export async function fetchTemplateVoters(query: VoterQuery): Promise<Voter[]> {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("template", user)) {
    throw new Error("Template page is disabled for this account.");
  }

  if (!query.district) {
    throw new Error("District is required to load booth voters.");
  }

  const response = await api.get("/politician/voters/list", {
    params: {
      page: 1,
      limit: 10000,
      state: query.state || undefined,
      district: query.district,
      city: query.city || undefined,
      boothNo: query.booth || undefined,
      search: query.search || undefined,
    },
  });

  return unwrapList(response.data).map((item, index) =>
    normalizeVoter(item, index),
  );
}

export async function logVoterTemplatePrint({
  booth,
  district,
  printCount = 1,
  state,
  templateSelection,
}: {
  booth: string;
  district?: string;
  printCount?: number;
  state?: string;
  templateSelection: VoterTemplateSelection;
}) {
  await ensureAuthSession();
  await api.post("/politician/notifications/activity-log", {
    action: "printed_voter_template",
    district,
    state,
    voterId: booth,
    voterName: `Booth ${booth} voter template`,
    printCount,
    templateSelection,
  });
}

export async function fetchVoterById(epicNo: string): Promise<Voter | null> {
  try {
    const { user } = await ensureAuthSession();
    if (!hasPoliticianPageAccess("voters", user)) {
      throw new Error("Voter page is disabled for this account.");
    }

    const response = await api.get(
      `/politician/voters/epic/${encodeURIComponent(epicNo)}`,
    );

    return normalizeVoter(response.data, 0);
  } catch (error: any) {
    console.error("fetchVoterById failed:", error?.message ?? error);
    return null;
  }
}
