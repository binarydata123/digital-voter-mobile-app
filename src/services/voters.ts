import { api } from "./api";
import {
  ensureAuthSession,
  getCurrentUser,
  hasPoliticianPageAccess,
} from "./authentication";
import { imageUpload } from "./background-removal-file";

export type Voter = {
  id: string;
  voterKey?: string;
  voterSource?: "district_collection" | "user";
  voterCollection?: string;
  voterDocumentId?: string;
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
  photoUri?: string;
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
  canvasLayout:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "floating"
    | "dual"
    | "none";
  recordsPerRow: 2 | 3 | 4;
};

type VoterStarStanceKey =
  | "fully_confirmed"
  | "favorable"
  | "undecided"
  | "unfavorable"
  | "against"
  | "party_worker"
  | "unassigned";

type VoterStarRating = {
  voterKey?: string;
  voterSource?: "district_collection" | "user";
  voterCollection?: string;
  voterDocumentId?: string;
  stanceKey?: VoterStarStanceKey;
  photoUri?: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  duplicateVote?: boolean;
  voted?: boolean;
  dead?: boolean;
  notes?: string;
};

type VoterStarResponse = {
  star?: VoterStarRating | null;
};

type VoterIdentity = {
  voterKey: string;
  voterSource: "district_collection" | "user";
  voterCollection: string;
  voterDocumentId: string;
};

const VOTER_PAGE_SIZE = 10000;
const MAX_VOTER_PAGES = 500;

let selectedVoter: Voter | null = null;
const managedVoters = new Map<string, Voter>();
const deletedVoterIds = new Set<string>();

export function setSelectedVoter(voter: Voter | null) {
  selectedVoter = voter;
}

export function getSelectedVoter() {
  return selectedVoter;
}

export function saveManagedVoter(voter: Voter) {
  deletedVoterIds.delete(voter.id);
  managedVoters.set(voter.id, voter);
  setSelectedVoter(voter);
}

export function deleteManagedVoter(voterId: string) {
  deletedVoterIds.add(voterId);
  managedVoters.delete(voterId);

  if (selectedVoter?.id === voterId) {
    setSelectedVoter(null);
  }
}

export function applyManagedVoterChanges(voters: Voter[]) {
  return voters
    .filter((voter) => !deletedVoterIds.has(voter.id))
    .map((voter) => managedVoters.get(voter.id) ?? voter);
}

function firstValue(...values: unknown[]) {
  let emptyFallback: unknown;

  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();
    const normalizedText = text.toLowerCase();

    if (normalizedText === "undefined" || normalizedText === "null") {
      continue;
    }

    if (text !== "") {
      return value;
    }

    emptyFallback = value;
  }

  return emptyFallback;
}

function cleanOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  const normalizedText = text.toLowerCase();

  return normalizedText === "undefined" || normalizedText === "null"
    ? ""
    : text;
}

function cleanEditableDetailText(value: unknown) {
  const text = cleanOptionalText(value);
  return text.toUpperCase() === "N/A" ? "" : text;
}

function normalizeRelation(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isEmptyValue(value: unknown) {
  const text = String(value ?? "").trim();

  return (
    !text ||
    text.toLowerCase() === "undefined" ||
    text.toLowerCase() === "null" ||
    text.toUpperCase() === "N/A"
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

function normalizeBoothForMatch(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^booth[\s-_]*/i, "")
    .replace(/^0+(\d)/, "$1");
}

function parseVoterKey(value?: string): VoterIdentity {
  const voterKey = cleanOptionalText(value);
  const [collectionName, ...documentParts] = voterKey.split(":");
  const documentId = documentParts.join(":");

  if (collectionName && documentId) {
    return {
      voterCollection: collectionName,
      voterDocumentId: documentId,
      voterKey,
      voterSource: "district_collection" as const,
    };
  }

  return {
    voterCollection: "",
    voterDocumentId: voterKey,
    voterKey,
    voterSource: "user" as const,
  };
}

function getDistrictVoterCollectionName(district?: string) {
  const districtName = cleanOptionalText(district);

  if (!districtName) return "";

  return `${districtName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}_voters`;
}

function isManagedVoterKey(value: string) {
  const { voterCollection, voterDocumentId } = parseVoterKey(value);
  return /^[A-Za-z0-9_]+_voters$/.test(voterCollection) && Boolean(voterDocumentId);
}

export function isVoterInBooth(voter: Voter, booth?: string) {
  if (!booth || booth === "All") {
    return true;
  }

  const voterBooth = normalizeBoothForMatch(voter.booth);
  const selectedBooth = normalizeBoothForMatch(booth);

  return voterBooth === selectedBooth || voter.booth === booth;
}

function normalizeVoter(raw: any, index: number): Voter {
  const data = raw?.voterData ?? raw?.data?.voterData ?? raw;
  const district = cleanOptionalText(
    firstValue(
      data?.District,
      data?.district,
      data?.Distt,
      data?.districtName,
      raw?.district,
      raw?.districtName,
      getCurrentUser()?.district,
      "",
    ),
  );
  const state = cleanOptionalText(
    firstValue(
      data?.State,
      data?.state,
      data?.stateName,
      raw?.state,
      raw?.stateName,
      getCurrentUser()?.state,
      "",
    ),
  );
  const documentId = cleanOptionalText(
    firstValue(
      raw?.voterDocumentId,
      raw?.documentId,
      raw?.voter_document_id,
      data?._id,
      raw?._id,
      data?.mongoId,
      raw?.mongoId,
      "",
    ),
  );
  const collectionName = cleanOptionalText(
    firstValue(
      raw?.voterCollection,
      raw?.collectionName,
      raw?.collection,
      data?.voterCollection,
      getDistrictVoterCollectionName(district),
      "",
    ),
  );
  const parsedVoterKey = parseVoterKey(
    cleanOptionalText(
      firstValue(
        [raw?.id, raw?.voterKey, data?.voterKey]
          .map(cleanOptionalText)
          .find(isManagedVoterKey),
        collectionName && documentId ? `${collectionName}:${documentId}` : "",
        raw?.voterKey,
        data?.voterKey,
      ),
    ),
  );

  return {
    id: cleanOptionalText(
      firstValue(
        parsedVoterKey.voterKey,
        raw?.id,
        data?.["Voter ID"],
        raw?.voterId,
        documentId,
        index,
      ),
    ),
    voterKey: parsedVoterKey.voterKey,
    voterSource: parsedVoterKey.voterSource,
    voterCollection: parsedVoterKey.voterCollection,
    voterDocumentId: parsedVoterKey.voterDocumentId,
    name: cleanOptionalText(
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
    hindiName: cleanOptionalText(
      firstValue(
        data?.["Voter Name Hindi"],
        data?.voterNameHindi,
        data?.voter_name_hindi,
        data?.nameHindi,
        raw?.hindiName,
        "",
      ),
    ),
    gender: cleanOptionalText(
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
    epicNo: cleanOptionalText(
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
    houseNo: cleanOptionalText(
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
    booth: cleanOptionalText(
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
    ward: cleanOptionalText(
      firstValue(
        data?.Ward,
        data?.ward,
        raw?.ward,
        raw?.wardName,
        raw?.wardNo,
        "",
      ),
    ),
    district,
    state,
    serialNo: cleanOptionalText(
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
    pollingStation: cleanOptionalText(
      firstValue(
        data?.["Polling Station"],
        data?.["Polling Station No. & Address"],
        data?.pollingStation,
        data?.pollingStationAddress,
        raw?.pollingStation,
        "",
      ),
    ),
    whatsappNumber: cleanOptionalText(
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
    mobileNumber: cleanOptionalText(
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
    photoUri: cleanOptionalText(
      firstValue(
        data?.photoUri,
        data?.photoUrl,
        data?.voterPhoto,
        data?.voterImage,
        raw?.photoUri,
        raw?.photoUrl,
        raw?.voterPhoto,
        raw?.voterImage,
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

export async function forEachVoterPage(
  query: VoterQuery = {},
  onPage: (voters: Voter[]) => Promise<void> | void,
): Promise<number> {
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
    boothNo: query.booth && query.booth !== "All" ? query.booth : undefined,
    includeCounts: false,
  };
  let voterCount = 0;
  let totalCount: number | null = null;

  for (let page = 1; page <= MAX_VOTER_PAGES; page += 1) {
    const response = await api.get("/politician/voters/assigned-data", {
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

    const voters = Array.from(
      new Map(
        pageItems
          .map((item, index) => normalizeVoter(item, voterCount + index))
          .map((voter) => [voter.id, voter]),
      ).values(),
    );

    if (voters.length === 0) {
      break;
    }

    await onPage(voters);
    voterCount += voters.length;

    if (totalCount !== null && voterCount >= totalCount) {
      break;
    }
    if (pageItems.length < VOTER_PAGE_SIZE) {
      break;
    }
  }

  return voterCount;
}

export async function fetchVoters(query: VoterQuery = {}): Promise<Voter[]> {
  const voters: Voter[] = [];
  await forEachVoterPage(query, (page) => {
    voters.push(...page);
  });
  return applyManagedVoterChanges(voters);
}

export async function fetchTemplateVoters(query: VoterQuery): Promise<Voter[]> {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("template", user)) {
    throw new Error("Template page is disabled for this account.");
  }

  if (!query.district) {
    throw new Error("District is required to load booth voters.");
  }

  const voters: Voter[] = [];
  await forEachVoterPage(query, (page) => {
    voters.push(...page);
  });

  return applyManagedVoterChanges(voters).filter((voter) =>
    isVoterInBooth(voter, query.booth),
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

function isLocalPhotoUri(uri?: string) {
  return Boolean(
    uri &&
    !uri.startsWith("http://") &&
    !uri.startsWith("https://") &&
    !uri.startsWith("data:"),
  );
}

function appendVoterStarPayload(
  formData: FormData,
  payload: Record<string, unknown>,
) {
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
}

async function fetchVoterStar(
  voterKey: string,
): Promise<VoterStarRating | null> {
  try {
    const response = await api.get(
      `/voter-stars/${encodeURIComponent(voterKey)}`,
    );
    return (response.data?.data as VoterStarResponse | undefined)?.star ?? null;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

function getVoterApiKey(voter: Voter) {
  const voterKey = cleanOptionalText(voter.voterKey);
  const fullKey = [voter.id, voter.voterKey]
    .map(cleanOptionalText)
    .find(isManagedVoterKey);
  if (fullKey) return fullKey;

  const collectionName =
    cleanOptionalText(voter.voterCollection) ||
    getDistrictVoterCollectionName(voter.district);
  const documentId = cleanOptionalText(voter.voterDocumentId);

  if (collectionName && documentId) {
    return `${collectionName}:${documentId}`;
  }

  return voterKey || cleanOptionalText(voter.id);
}

function getVoterIdentity(
  voter: Voter,
  star?: VoterStarRating | null,
): VoterIdentity {
  const parsed = parseVoterKey(getVoterApiKey(voter));
  const collectionName =
    cleanOptionalText(star?.voterCollection) ||
    cleanOptionalText(voter.voterCollection) ||
    parsed.voterCollection ||
    getDistrictVoterCollectionName(voter.district);
  const documentId =
    cleanOptionalText(star?.voterDocumentId) ||
    cleanOptionalText(voter.voterDocumentId) ||
    parsed.voterDocumentId;
  const voterKey =
    cleanOptionalText(star?.voterKey) ||
    cleanOptionalText(voter.voterKey) ||
    (collectionName && documentId
      ? `${collectionName}:${documentId}`
      : parsed.voterKey);

  return {
    voterKey,
    voterSource:
      star?.voterSource ||
      voter.voterSource ||
      (collectionName && documentId
        ? "district_collection"
        : parsed.voterSource),
    voterCollection: collectionName,
    voterDocumentId: documentId,
  };
}

async function resolveVoterIdentityFromBackend(
  voter: Voter,
): Promise<VoterIdentity | null> {
  const search = cleanOptionalText(voter.epicNo) || cleanOptionalText(voter.id);

  if (!search) return null;

  try {
    const politician = getCurrentUser();
    const response = await api.get("/politician/voters/assigned-data", {
      params: {
        search,
        district: voter.district || politician?.district || undefined,
        state: voter.state || politician?.state || undefined,
        includeCounts: false,
        page: 1,
        limit: 10,
      },
      timeout: 8000,
    });
    const voters = unwrapList(response.data)
      .map((item, index) => normalizeVoter(item, index))
      .filter((candidate) => {
        const sameEpic =
          !isEmptyValue(voter.epicNo) &&
          cleanOptionalText(candidate.epicNo).toLowerCase() ===
          cleanOptionalText(voter.epicNo).toLowerCase();
        const sameId =
          cleanOptionalText(candidate.id).toLowerCase() ===
          cleanOptionalText(voter.id).toLowerCase();

        return sameEpic || sameId;
      });
    const matches = voters.filter((candidate) =>
      isManagedVoterKey(cleanOptionalText(candidate.voterKey)),
    );
    const uniqueMatches = new Map(matches.map((candidate) => [candidate.voterKey, candidate]));
    const matchedVoter = uniqueMatches.size === 1 ? matches[0] : null;

    return matchedVoter ? getVoterIdentity(matchedVoter) : null;
  } catch (error) {
    console.log("Voter identity lookup failed:", error);
    return null;
  }
}

async function getResolvedVoterIdentity(voter: Voter) {
  const identity = getVoterIdentity(voter);

  if (identity.voterKey.includes(":") && identity.voterDocumentId) {
    return identity;
  }

  return (await resolveVoterIdentityFromBackend(voter)) ?? identity;
}

export async function updateVoterDetails(voter: Voter) {
  await ensureAuthSession();

  const resolvedIdentity = await getResolvedVoterIdentity(voter);
  const voterKey = resolvedIdentity.voterKey || getVoterApiKey(voter);
  const existingStar = await fetchVoterStar(voterKey);
  const identity = {
    ...resolvedIdentity,
    ...getVoterIdentity(
      {
        ...voter,
        voterKey,
        voterSource: resolvedIdentity.voterSource,
        voterCollection: resolvedIdentity.voterCollection,
        voterDocumentId: resolvedIdentity.voterDocumentId,
      },
      existingStar,
    ),
  };
  const payload = {
    activityAction: "edit_details",
    ...identity,
    stanceKey: existingStar?.stanceKey ?? "unassigned",
    voterName: cleanOptionalText(voter.name),
    voterPhone:
      cleanEditableDetailText(voter.mobileNumber) ||
      cleanEditableDetailText(voter.whatsappNumber),
    state: cleanOptionalText(voter.state),
    district: cleanOptionalText(voter.district),
    name: cleanOptionalText(voter.name),
    hindiName: cleanOptionalText(voter.hindiName),
    gender: cleanOptionalText(voter.gender),
    age: voter.age,
    guardian: cleanOptionalText(voter.guardian),
    epicNo: cleanOptionalText(voter.epicNo),
    houseNo: cleanOptionalText(voter.houseNo),
    booth: cleanOptionalText(voter.booth),
    ward: cleanOptionalText(voter.ward),
    serialNo: cleanOptionalText(voter.serialNo),
    pollingStation: cleanOptionalText(voter.pollingStation),
    "Voter Name English": cleanOptionalText(voter.name),
    "Voter Name Hindi": cleanOptionalText(voter.hindiName),
    Gender: cleanOptionalText(voter.gender),
    Age: voter.age,
    "House No": cleanOptionalText(voter.houseNo),
    "Booth ID": cleanOptionalText(voter.booth),
    Ward: cleanOptionalText(voter.ward),
    "Serial No": cleanOptionalText(voter.serialNo),
    "EPIC No": cleanOptionalText(voter.epicNo),
    mobileNumber:
      cleanEditableDetailText(voter.mobileNumber) ||
      cleanEditableDetailText(existingStar?.mobileNumber),
    whatsappNumber:
      cleanEditableDetailText(voter.whatsappNumber) ||
      cleanEditableDetailText(existingStar?.whatsappNumber),
    duplicateVote: existingStar?.duplicateVote ?? false,
    voted: existingStar?.voted ?? false,
    dead: existingStar?.dead ?? false,
    notes: existingStar?.notes ?? "",
    source: "voter_detail",
  };

  if (isLocalPhotoUri(voter.photoUri)) {
    const formData = new FormData();
    appendVoterStarPayload(formData, payload);
    formData.append(
      "voterPhotoFile",
      await imageUpload(voter.photoUri!),
      "voter-photo.jpg",
    );

    await api.put(`/voter-stars/${encodeURIComponent(voterKey)}`, formData);
    return;
  }

  await api.put(`/voter-stars/${encodeURIComponent(voterKey)}`, {
    ...payload,
    photoUri: voter.photoUri ?? existingStar?.photoUri ?? "",
  });
}

export async function deleteVoterDetails(voter: Voter) {
  await ensureAuthSession();

  let voterKey = getVoterApiKey(voter);

  if (!isManagedVoterKey(voterKey)) {
    const identity = await resolveVoterIdentityFromBackend(voter);
    voterKey = identity?.voterKey ?? "";
  }

  if (!isManagedVoterKey(voterKey)) {
    throw new Error(
      "Full voter identifier is missing. Please refresh voter data and try again.",
    );
  }

  const response = await api.delete(
    `/politician/voters/${encodeURIComponent(voterKey)}`,
  );

  if (response.data?.success === false) {
    throw new Error(response.data.message || "Unable to delete voter");
  }
}

export async function fetchVoterById(epicNo: string): Promise<Voter | null> {
  try {
    const { user } = await ensureAuthSession();
    if (!hasPoliticianPageAccess("voters", user)) {
      throw new Error("Voter page is disabled for this account.");
    }

    const response = await api.get(
      `/politician/voters/epic/api/politician/voters?${encodeURIComponent(epicNo)}`,
    );

    const voter = normalizeVoter(response.data, 0);
    return applyManagedVoterChanges([voter])[0] ?? null;
  } catch (error: any) {
    console.error("fetchVoterById failed:", error?.message ?? error);
    return null;
  }
}
