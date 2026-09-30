import { api } from "./api";
import { ensureAuthSession } from "./authentication";

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

async function get<T>(endpoint: string, params: Partial<SurveyScope>, fallback: T) {
  await ensureAuthSession();
  const response = await api.get(endpoint, { params: compactParams(params) });
  return unwrapData<T>(response.data, fallback);
}

export async function fetchSurveySummary(scope: SurveyScope) {
  return get<SurveySummary>(surveyEndpoint("summary"), scope, emptySummary);
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
  await ensureAuthSession();
  const response = await api.get(surveyEndpoint("summary/ward-heat-map"), {
    params: compactParams({ ...scope, view: "wards" } as Partial<SurveyScope> & { view: string }),
  });
  const data = unwrapData<WardHeatMapPayload>(response.data, { view: "wards", wards: [] });
  return data.view === "wards" ? data.wards ?? [] : [];
}

export async function fetchSurveyReport(scope: SurveyScope) {
  const [summary, supportByAgeGroup, preferenceByGender, preferenceByEducation, preferenceByIncome, majorPublicConcerns, wardHeatMap] =
    await Promise.all([
      fetchSurveySummary(scope),
      fetchSupportByAgeGroup(scope).catch(() => []),
      fetchPreferenceByGender(scope).catch(() => []),
      fetchPreferenceByEducation(scope).catch(() => []),
      fetchPreferenceByIncome(scope).catch(() => []),
      fetchMajorPublicConcerns(scope).catch(() => []),
      fetchWardHeatMap(scope).catch(() => []),
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
