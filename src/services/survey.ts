import { api } from "./api";
import {
  ensureAuthSession,
  getCurrentUser,
  hasPoliticianPageAccess,
  refreshCurrentUser,
  type AuthUser,
} from "./authentication";
import {
  getVoterDatabase,
  isLocalVoterDatabaseAvailable,
} from "./voter-database";

export type SurveyResponseInput = {
  electionType: string;
  electionYear: string;
  state: string;
  district: string;
  city: string;
  wardNo: string;
  gender: string;
  ageBracket: string;
  education: string;
  incomeBracket: string;
  occupation: string;
  issues: string[];
  preferredPolitician: string;
  preferredParty: string;
  surveyLocation?: SurveyLocationInput;
};

export type SurveyLocationInput = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
};

export type SurveyScope = Pick<
  SurveyResponseInput,
  "electionType" | "electionYear" | "state" | "district" | "city" | "wardNo"
>;

export type SurveyPoliticianOption = {
  id: string;
  name: string;
  party: string;
  profileImage?: string;
};

export type SurveySummary = {
  total: number;
  party: { _id: string; count: number }[];
  issues: { _id: string; count: number }[];
  occupations: { _id: string; count: number }[];
  occupationSupport: {
    _id: { occupation: string; politician: string };
    count: number;
  }[];
};

export type SupportByAgeGroupItem = {
  ageBracket: string;
  total: number;
  support: { name: string; count: number; percentage: number }[];
};

export type PreferenceByGenderItem = {
  gender: string;
  total: number;
  preferences: { name: string; count: number }[];
};

export type PreferenceByEducationItem = {
  education: string;
  total: number;
  preferences: { name: string; count: number; percentage: number }[];
};

export type PreferenceByIncomeItem = {
  incomeBracket: string;
  total: number;
  preferences: { name: string; count: number; percentage: number }[];
};

export type MajorPublicConcernItem = {
  issue: string;
  count: number;
};

export type WardLeader = {
  name: string;
  count: number;
  percentage: number;
};

export type WardHeatMapItem = {
  wardNo: string;
  total: number;
  leader: WardLeader | null;
};

export type WardHeatMapPayload = {
  view: "wards";
  totalWards?: number;
  wards: WardHeatMapItem[];
};

export type SurveyLocationPoint = {
  id?: string;
  location?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt?: string;
  wardNo?: string;
  boothNo?: string;
  preferredPolitician?: string;
  preferredParty?: string;
};

type SurveyLocationRow = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  ward_no: string;
  preferred_politician: string;
  preferred_party: string;
};

const SURVEY_BASE_PATH = "/politician/survey";
const currentYear = String(new Date().getFullYear());

/**
 * The web survey uses wards only for constituency elections.  Keeping this
 * rule in the service prevents a stale City/Ward value from changing a report
 * query when the user changes the election type.
 */
export function isConstituencySurveyElection(electionType: string) {
  return electionType === "Lok Sabha" || electionType === "Vidhan Sabha";
}

function normalizeReportScope(scope: SurveyScope): SurveyScope {
  // Reports aggregate the selected constituency/district. Ward is a response
  // entry field, not a required report filter.
  return isConstituencySurveyElection(scope.electionType)
    ? { ...scope, city: "", wardNo: "" }
    : { ...scope, wardNo: "" };
}

function surveyEndpoint(path: string) {
  return `${SURVEY_BASE_PATH}/${path.replace(/^\/+/, "")}`;
}

const emptySummary: SurveySummary = {
  total: 0,
  party: [],
  issues: [],
  occupations: [],
  occupationSupport: [],
};

function unwrapData<T>(raw: any, fallback: T): T {
  return (raw?.data ?? raw) || fallback;
}

function compactParams(params: Partial<SurveyScope>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined && value !== null && String(value).trim() !== "",
    ),
  );
}

function getSurveyLocationId(userId: string, input: SurveyResponseInput) {
  return [
    userId,
    input.electionType,
    input.electionYear,
    input.state,
    input.district,
    input.city,
    input.wardNo,
    input.surveyLocation?.capturedAt,
    input.surveyLocation?.latitude,
    input.surveyLocation?.longitude,
  ].join("|");
}

function surveyLocationFromRow(row: SurveyLocationRow): SurveyLocationPoint {
  return {
    id: row.id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    capturedAt: row.captured_at,
    wardNo: row.ward_no,
    preferredPolitician: row.preferred_politician,
    preferredParty: row.preferred_party,
  };
}

function getMongoValue(value: any) {
  return value?.$oid ?? value?.$date ?? value;
}

function getSurveyLocationItems(raw: any): any[] {
  const data = raw?.data ?? raw;
  const candidates =
    data?.locations ??
    data?.surveyLocations ??
    data?.responses ??
    data?.surveys ??
    data?.surveyResponses ??
    data?.items ??
    data?.results ??
    data?.records ??
    data?.docs ??
    data?.documents ??
    data;

  return Array.isArray(candidates)
    ? candidates
    : candidates
      ? [candidates]
      : [];
}

function normalizeSurveyLocationPoint(raw: any): SurveyLocationPoint | null {
  const latitude = Number(
    raw?.latitude ?? raw?.lat ?? raw?.surveyLocation?.latitude,
  );
  const longitude = Number(
    raw?.longitude ?? raw?.lng ?? raw?.lon ?? raw?.surveyLocation?.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const capturedAt = getMongoValue(
    raw?.capturedAt ??
      raw?.surveyLocation?.capturedAt ??
      raw?.createdAt ??
      raw?.updatedAt,
  );

  return {
    id: String(getMongoValue(raw?._id) ?? raw?.id ?? ""),
    location: raw?.location ? String(raw.location) : undefined,
    latitude,
    longitude,
    accuracy: raw?.accuracy ?? raw?.surveyLocation?.accuracy ?? null,
    capturedAt: capturedAt ? String(capturedAt) : undefined,
    wardNo: raw?.wardNo ? String(raw.wardNo) : undefined,
    boothNo: raw?.boothNo ? String(raw.boothNo) : undefined,
    preferredPolitician: raw?.preferredPolitician
      ? String(raw.preferredPolitician)
      : undefined,
    preferredParty: raw?.preferredParty
      ? String(raw.preferredParty)
      : undefined,
  };
}

function normalizeSurveyLocations(raw: any) {
  return getSurveyLocationItems(raw)
    .map(normalizeSurveyLocationPoint)
    .filter((location): location is SurveyLocationPoint => Boolean(location));
}

async function fetchSurveyLocationsFromEndpoint(
  endpoint: string,
  scope: SurveyScope,
) {
  const response = await api.get(endpoint, {
    params: compactParams(scope),
    validateStatus: (status) => status < 500,
  });
  if (response.status === 404) {
    return [];
  }
  return normalizeSurveyLocations(response.data);
}

async function saveLocalSurveyLocation(
  userId: string,
  input: SurveyResponseInput,
) {
  if (!input.surveyLocation || !isLocalVoterDatabaseAvailable()) return;

  const database = await getVoterDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO survey_locations (
      id, politician_id, election_type, election_year, state, district, city,
      ward_no, latitude, longitude, captured_at, preferred_politician,
      preferred_party
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      getSurveyLocationId(userId, input),
      userId,
      input.electionType,
      input.electionYear,
      input.state,
      input.district,
      input.city,
      input.wardNo,
      input.surveyLocation.latitude,
      input.surveyLocation.longitude,
      input.surveyLocation.capturedAt,
      input.preferredPolitician,
      input.preferredParty,
    ],
  );
}

async function fetchLocalSurveyLocations(userId: string, scope: SurveyScope) {
  if (!isLocalVoterDatabaseAvailable()) return [];

  const database = await getVoterDatabase();
  const rows = await database.getAllAsync<SurveyLocationRow>(
    `SELECT id, latitude, longitude, accuracy, captured_at, ward_no,
      preferred_politician, preferred_party
     FROM survey_locations
     WHERE politician_id = ?
       AND election_type = ?
       AND election_year = ?
       AND state = ?
       AND district = ?
       AND city = ?
     ORDER BY captured_at DESC`,
    [
      userId,
      scope.electionType,
      scope.electionYear,
      scope.state,
      scope.district,
      scope.city,
    ],
  );
  return rows.map(surveyLocationFromRow);
}

function mergeSurveyLocations(
  remoteLocations: SurveyLocationPoint[],
  localLocations: SurveyLocationPoint[],
) {
  const seen = new Set<string>();
  return [...remoteLocations, ...localLocations].filter((location) => {
    const key = [
      location.id,
      location.latitude.toFixed(6),
      location.longitude.toFixed(6),
      location.capturedAt ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildAssignedSurveyScope(
  user: AuthUser | null = getCurrentUser(),
): SurveyScope {
  return {
    electionType: user?.electionType ?? "Rajya Sabha",
    electionYear: String(user?.electionYear ?? currentYear),
    state: user?.state ?? "",
    district: user?.district ?? "",
    city: user?.city ?? user?.constituency ?? "",
    wardNo: user?.ward ?? "",
  };
}

export async function getAssignedSurveyScope() {
  const user = await refreshCurrentUser();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }
  return buildAssignedSurveyScope(user);
}

async function get<T>(
  endpoint: string,
  params: Partial<SurveyScope>,
  fallback: T,
) {
  const { user } = await ensureAuthSession();
  if (!user) {
    throw new Error("Please sign in again to continue.");
  }
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }
  const response = await api.get(endpoint, { params: compactParams(params) });
  return unwrapData<T>(response.data, fallback);
}

export async function fetchSurveySummary(scope: SurveyScope) {
  return get<SurveySummary>(surveyEndpoint("summary"), scope, emptySummary);
}

export async function saveSurveyResponse(input: SurveyResponseInput) {
  const { user } = await ensureAuthSession();
  if (!user) {
    throw new Error("Please sign in again to continue.");
  }
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }

  // Support a value that was selected before the app changed from a hyphen to
  // the API's required en dash. This also protects callers outside the screen.
  const incomeBracket = input.incomeBracket
    .replace("₹15k-35k", "₹15k–35k")
    .replace("₹35k-75k", "₹35k–75k");
  const response = await api.post(surveyEndpoint("responses"), {
    ...input,
    incomeBracket,
    latitude: input.surveyLocation?.latitude,
    longitude: input.surveyLocation?.longitude,
    location: input.wardNo || input.city || input.district,
  });
  await saveLocalSurveyLocation(user.id, input).catch(() => undefined);
  return unwrapData(response.data, { success: true });
}

export async function fetchSurveyPoliticianOptions(
  scope: Pick<
    SurveyScope,
    "electionType" | "state" | "district" | "city" | "wardNo"
  >,
) {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }

  const response = await api.get(surveyEndpoint("politicians"), {
    params: compactParams(scope),
  });
  const data = unwrapData<{ options?: SurveyPoliticianOption[] }>(
    response.data,
    {},
  );
  return data.options ?? [];
}

export async function fetchSurveyWardOptions(
  scope: Pick<SurveyScope, "state" | "district">,
) {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }

  const response = await api.get("/politician/dashboard/ward-options", {
    params: compactParams(scope),
  });
  const data = unwrapData<{ options?: { value?: string; label?: string }[] }>(
    response.data,
    {},
  );
  return (data.options ?? [])
    .map((option) => String(option.value ?? option.label ?? "").trim())
    .filter(Boolean);
}

export async function fetchSupportByAgeGroup(scope: SurveyScope) {
  const data = await get<{ supportByAgeGroup: SupportByAgeGroupItem[] }>(
    surveyEndpoint("summary/support-by-age-group"),
    scope,
    { supportByAgeGroup: [] },
  );
  return data.supportByAgeGroup ?? [];
}

export async function fetchPreferenceByGender(scope: SurveyScope) {
  const data = await get<{ preferenceByGender: PreferenceByGenderItem[] }>(
    surveyEndpoint("summary/preference-by-gender"),
    scope,
    { preferenceByGender: [] },
  );
  return data.preferenceByGender ?? [];
}

export async function fetchPreferenceByEducation(scope: SurveyScope) {
  const data = await get<{
    preferenceByEducation: PreferenceByEducationItem[];
  }>(surveyEndpoint("summary/preference-by-education"), scope, {
    preferenceByEducation: [],
  });
  return data.preferenceByEducation ?? [];
}

export async function fetchPreferenceByIncome(scope: SurveyScope) {
  const data = await get<{ preferenceByIncome: PreferenceByIncomeItem[] }>(
    surveyEndpoint("summary/preference-by-income"),
    scope,
    { preferenceByIncome: [] },
  );
  return data.preferenceByIncome ?? [];
}

export async function fetchMajorPublicConcerns(scope: SurveyScope) {
  const data = await get<{ majorPublicConcerns: MajorPublicConcernItem[] }>(
    surveyEndpoint("summary/major-public-concerns"),
    scope,
    { majorPublicConcerns: [] },
  );
  return data.majorPublicConcerns ?? [];
}

export async function fetchWardHeatMap(scope: SurveyScope) {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }
  const response = await api.get(surveyEndpoint("summary/ward-heat-map"), {
    params: compactParams({
      ...scope,
      view: "wards",
    } as Partial<SurveyScope> & { view: string }),
  });
  const data = unwrapData<WardHeatMapPayload>(response.data, {
    view: "wards",
    wards: [],
  });
  return data.view === "wards" ? (data.wards ?? []) : [];
}

export async function fetchSurveyLocations(scope: SurveyScope) {
  const { user } = await ensureAuthSession();
  if (!user) throw new Error("Please sign in again to continue.");

  const remoteLocations = await fetchSurveyLocationsFromEndpoint(
    surveyEndpoint("summary/locations"),
    scope,
  ).catch(() => []);
  const localLocations = await fetchLocalSurveyLocations(user.id, scope).catch(
    () => [],
  );
  return mergeSurveyLocations(remoteLocations, localLocations);
}

export async function fetchSurveyReport(scope: SurveyScope) {
  const reportScope = normalizeReportScope(scope);
  const isConstituencyElection = isConstituencySurveyElection(
    reportScope.electionType,
  );
  const [
    summary,
    supportByAgeGroup,
    preferenceByGender,
    preferenceByEducation,
    preferenceByIncome,
    majorPublicConcerns,
    wardHeatMap,
    surveyLocations,
  ] = await Promise.all([
    fetchSurveySummary(reportScope),
    fetchSupportByAgeGroup(reportScope).catch(() => []),
    fetchPreferenceByGender(reportScope).catch(() => []),
    fetchPreferenceByEducation(reportScope).catch(() => []),
    fetchPreferenceByIncome(reportScope).catch(() => []),
    fetchMajorPublicConcerns(reportScope).catch(() => []),
    isConstituencyElection
      ? fetchWardHeatMap(reportScope).catch(() => [])
      : Promise.resolve([]),
    fetchSurveyLocations(reportScope).catch(() => []),
  ]);

  return {
    summary,
    supportByAgeGroup,
    preferenceByGender,
    preferenceByEducation,
    preferenceByIncome,
    majorPublicConcerns,
    wardHeatMap,
    surveyLocations,
  };
}
