import { api } from "./api";
import {
  ensureAuthSession,
  getCurrentUser,
  hasPoliticianPageAccess,
  refreshCurrentUser,
  type AuthUser,
} from "./authentication";

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
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ""),
  );
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

async function get<T>(endpoint: string, params: Partial<SurveyScope>, fallback: T) {
  const { user } = await ensureAuthSession();
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
  });
  return unwrapData(response.data, { success: true });
}

export async function fetchSurveyPoliticianOptions(
  scope: Pick<SurveyScope, "electionType" | "state" | "district" | "city" | "wardNo">,
) {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }

  const response = await api.get(surveyEndpoint("politicians"), {
    params: compactParams(scope),
  });
  const data = unwrapData<{ options?: SurveyPoliticianOption[] }>(response.data, {});
  return data.options ?? [];
}

export async function fetchSurveyWardOptions(scope: Pick<SurveyScope, "state" | "district">) {
  const { user } = await ensureAuthSession();
  if (!hasPoliticianPageAccess("survey", user)) {
    throw new Error("Survey page is disabled for this account.");
  }

  const response = await api.get("/politician/dashboard/ward-options", {
    params: compactParams(scope),
  });
  const data = unwrapData<{ options?: { value?: string; label?: string }[] }>(response.data, {});
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
  const data = await get<{ preferenceByEducation: PreferenceByEducationItem[] }>(
    surveyEndpoint("summary/preference-by-education"),
    scope,
    { preferenceByEducation: [] },
  );
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
    params: compactParams({ ...scope, view: "wards" } as Partial<SurveyScope> & { view: string }),
  });
  const data = unwrapData<WardHeatMapPayload>(response.data, { view: "wards", wards: [] });
  return data.view === "wards" ? data.wards ?? [] : [];
}

export async function fetchSurveyReport(scope: SurveyScope) {
  const reportScope = normalizeReportScope(scope);
  const isConstituencyElection = isConstituencySurveyElection(
    reportScope.electionType,
  );
  const [summary, supportByAgeGroup, preferenceByGender, preferenceByEducation, preferenceByIncome, majorPublicConcerns, wardHeatMap] =
    await Promise.all([
      fetchSurveySummary(reportScope),
      fetchSupportByAgeGroup(reportScope).catch(() => []),
      fetchPreferenceByGender(reportScope).catch(() => []),
      fetchPreferenceByEducation(reportScope).catch(() => []),
      fetchPreferenceByIncome(reportScope).catch(() => []),
      fetchMajorPublicConcerns(reportScope).catch(() => []),
      isConstituencyElection
        ? fetchWardHeatMap(reportScope).catch(() => [])
        : Promise.resolve([]),
    ]);

  return {
    summary,
    supportByAgeGroup,
    preferenceByGender,
    preferenceByEducation,
    preferenceByIncome,
    majorPublicConcerns,
    wardHeatMap,
  };
}
