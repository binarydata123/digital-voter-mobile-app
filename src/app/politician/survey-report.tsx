import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import {
  getCurrentUser,
  getDefaultPoliticianRoute,
  hasPoliticianPageAccess,
  logoutPolitician,
} from "@/services/authentication";
import {
  buildAssignedSurveyScope,
  fetchSurveyReport,
  getAssignedSurveyScope,
  isConstituencySurveyElection,
  type PreferenceByEducationItem,
  type PreferenceByGenderItem,
  type PreferenceByIncomeItem,
  type SupportByAgeGroupItem,
  type SurveyScope,
  type SurveySummary,
} from "@/services/survey";

const AGE_BRACKETS = ["18-25", "26-35", "36-50", "50+"];
const COLORS = [
  "#225451",
  "#2563EB",
  "#F97316",
  "#16A34A",
  "#8B5CF6",
  "#64748B",
];
const emptySummary: SurveySummary = {
  total: 0,
  party: [],
  issues: [],
  occupations: [],
  occupationSupport: [],
};

type SurveyReport = Awaited<ReturnType<typeof fetchSurveyReport>>;

type BarRow = {
  label: string;
  count: number;
  percentage?: number;
  color?: string;
  meta?: string;
};

function getDefaultScope(): SurveyScope {
  return buildAssignedSurveyScope();
}

function toRouteValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getScopeFromRoute(
  params: Record<string, string | string[] | undefined>,
) {
  const scope: SurveyScope = {
    electionType: toRouteValue(params.electionType) ?? "",
    electionYear: toRouteValue(params.electionYear) ?? "",
    state: toRouteValue(params.state) ?? "",
    district: toRouteValue(params.district) ?? "",
    city: toRouteValue(params.city) ?? "",
    wardNo: toRouteValue(params.wardNo) ?? "",
  };
  return scope.electionType &&
    scope.electionYear &&
    scope.state &&
    scope.district
    ? scope
    : null;
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function colorFor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function SurveyScreen() {
  const params = useLocalSearchParams();
  // `useLocalSearchParams()` can return a new object after every render.
  // Derive stable primitive values before creating the report scope, otherwise
  // the data-loading callback changes continuously and re-fetches the API.
  const routeElectionType = toRouteValue(params.electionType);
  const routeElectionYear = toRouteValue(params.electionYear);
  const routeState = toRouteValue(params.state);
  const routeDistrict = toRouteValue(params.district);
  const routeCity = toRouteValue(params.city);
  const routeWardNo = toRouteValue(params.wardNo);
  const routeScope = useMemo(
    () =>
      getScopeFromRoute({
        electionType: routeElectionType,
        electionYear: routeElectionYear,
        state: routeState,
        district: routeDistrict,
        city: routeCity,
        wardNo: routeWardNo,
      }),
    [
      routeCity,
      routeDistrict,
      routeElectionType,
      routeElectionYear,
      routeState,
      routeWardNo,
    ],
  );
  const routeScopeKey = [
    routeScope?.electionType,
    routeScope?.electionYear,
    routeScope?.state,
    routeScope?.district,
    routeScope?.city,
    routeScope?.wardNo,
  ].join("|");
  const hasRouteScope = Boolean(routeScope);
  const [assignedScope, setAssignedScope] = useState<SurveyScope>(
    () => routeScope ?? getDefaultScope(),
  );
  const [assignedScopeReady, setAssignedScopeReady] = useState(false);
  const scope = routeScope ?? assignedScope;
  const scopeReady = Boolean(routeScope) || assignedScopeReady;
  const [report, setReport] = useState<SurveyReport>({
    summary: emptySummary,
    supportByAgeGroup: [],
    preferenceByGender: [],
    preferenceByEducation: [],
    preferenceByIncome: [],
    majorPublicConcerns: [],
    wardHeatMap: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoLoadedScopeKey = useRef<string | null>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser && !hasPoliticianPageAccess("survey", currentUser)) {
      const nextRoute = getDefaultPoliticianRoute(currentUser);
      router.replace(nextRoute ?? "/login");
    }
  }, [currentUser]);

  const isConstituencyElection = isConstituencySurveyElection(
    scope.electionType,
  );
  const districtLabel =
    scope.electionType === "Lok Sabha"
      ? "Lok Sabha constituency"
      : scope.electionType === "Vidhan Sabha"
        ? "Vidhan Sabha constituency"
        : "Constituency / District";
  const canLoad = Boolean(
    scope.electionType &&
    scope.electionYear &&
    scope.state &&
    scope.district &&
    (isConstituencyElection || scope.city),
  );
  const reportScopeKey = [
    scope.electionType,
    scope.electionYear,
    scope.state,
    scope.district,
    isConstituencyElection ? "" : scope.city,
  ].join("|");

  const loadReport = useCallback(async () => {
    if (!canLoad) {
      setError(
        isConstituencyElection
          ? "Election type, year, state, and constituency are required."
          : "Election type, year, state, district, and city are required.",
      );
      return;
    }

    setLoading(true);
    try {
      const nextReport = await fetchSurveyReport(scope);
      setReport(nextReport);
      setError("");
    } catch (loadError: any) {
      if (loadError?.message === "Please sign in again to continue.") {
        logoutPolitician();
        router.replace("/login");
        return;
      }
      setError(
        loadError?.response?.data?.message ??
          loadError?.message ??
          "Could not load survey report.",
      );
    } finally {
      setLoading(false);
    }
  }, [canLoad, isConstituencyElection, scope]);

  useEffect(() => {
    if (hasRouteScope) {
      return;
    }

    let mounted = true;

    getAssignedSurveyScope()
      .then((assignedScope) => {
        if (mounted) {
          setAssignedScope(assignedScope);
        }
      })
      .catch((scopeError: any) => {
        if (scopeError?.message === "Please sign in again to continue.") {
          logoutPolitician();
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(scopeError?.message ?? "Could not load assigned ward.");
        }
      })
      .finally(() => {
        if (mounted) setAssignedScopeReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [hasRouteScope, routeScopeKey]);

  useEffect(() => {
    if (!scopeReady || autoLoadedScopeKey.current === reportScopeKey) return;
    autoLoadedScopeKey.current = reportScopeKey;
    void loadReport();
  }, [loadReport, reportScopeKey, scopeReady]);

  const leader = report.summary.party[0];
  const partyRows = useMemo(
    () =>
      report.summary.party.map((item, index) => ({
        label: item._id,
        count: item.count,
        percentage: report.summary.total
          ? (item.count / report.summary.total) * 100
          : 0,
        color: colorFor(index),
      })),
    [report.summary.party, report.summary.total],
  );
  const issueRows = useMemo(
    () =>
      report.majorPublicConcerns.slice(0, 10).map((item, index) => ({
        label: item.issue,
        count: item.count,
        color: index === 0 ? "#F97316" : "#FB923C",
      })),
    [report.majorPublicConcerns],
  );
  const sectorRows = useMemo(() => {
    const winnerName = leader?._id;
    return report.summary.occupations.map((occupation) => {
      const support = report.summary.occupationSupport
        .filter(
          (item) =>
            item._id.occupation === occupation._id &&
            item._id.politician === winnerName,
        )
        .reduce((total, item) => total + item.count, 0);
      return {
        label: occupation._id,
        count: support,
        percentage: occupation.count ? (support / occupation.count) * 100 : 0,
        meta: `${occupation.count} responses`,
        color: "#225451",
      };
    });
  }, [
    leader?._id,
    report.summary.occupationSupport,
    report.summary.occupations,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadReport}
            tintColor="#0F766E"
          />
        }>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to survey"
            onPress={() => {
              const nextRoute = hasPoliticianPageAccess("survey", currentUser)
                ? "/politician/survey"
                : (getDefaultPoliticianRoute(currentUser) ?? "/login");
              router.replace(nextRoute);
            }}
            style={styles.iconButton}>
            <ArrowLeft color="#0F766E" size={21} strokeWidth={3} />
          </Pressable>
          {/* <Pressable accessibilityLabel="Refresh survey report" onPress={loadReport} disabled={loading} style={styles.refreshButton}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <RefreshCw color="#FFFFFF" size={18} strokeWidth={2.8} />}
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable> */}
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SURVEY REPORT</Text>
          {/* <Text style={styles.title}>Constituency survey signal</Text> */}
          <Text style={styles.subtitle}>
            Review assigned-ward party support, demographics, public concerns,
            and ward signals from saved survey responses.
          </Text>
        </View>

        <View style={styles.scopeSummary}>
          <Text style={styles.scopeSummaryLabel}>REPORT LOCATION</Text>
          <Text style={styles.scopeSummaryValue}>
            {[scope.electionType, scope.electionYear]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={styles.scopeSummaryDetail}>
            {[
              scope.state,
              `${districtLabel}: ${scope.district}`,
              !isConstituencyElection ? `City: ${scope.city}` : "",
            ]
              .filter(Boolean)
              .join("  •  ")}
          </Text>
        </View>

        {error ? <Text style={styles.warning}>{error}</Text> : null}

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Total responses</Text>
            <Text style={styles.summaryValue}>{report.summary.total}</Text>
          </View>
          <View style={styles.leaderBadge}>
            <Text style={styles.leaderBadgeLabel}>Leading</Text>
            <Text style={styles.leaderBadgeText}>
              {leader?._id ?? "No data"}
            </Text>
          </View>
        </View>

        {report.summary.total === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No anonymous responses yet</Text>
            <Text style={styles.emptyText}>
              Save survey responses for this location to generate the report.
            </Text>
          </View>
        ) : null}

        <CandidateSupport summary={report.summary} />
        <PieDistribution
          title="Vote share distribution"
          subtitle="Distribution of stated political preferences"
          rows={partyRows}
          centerLabel="Responses"
          centerValue={String(report.summary.total)}
        />
        <AgeGroupSupportChart data={report.supportByAgeGroup} />
        <PreferenceByGenderChart data={report.preferenceByGender} />
        <PreferenceByEducationChart data={report.preferenceByEducation} />
        <PreferenceByIncomeChart data={report.preferenceByIncome} />
        <BarChart
          title="Sector support index"
          subtitle="Support for current lead by occupation"
          rows={sectorRows}
          showPercent
        />
        <MajorPublicConcernsChart data={issueRows} />
        {/* {isConstituencyElection ? (
          <WardHeatMapChart wards={report.wardHeatMap} />
        ) : null} */}
      </ScrollView>
    </SafeAreaView>
  );
}

function CandidateSupport({ summary }: { summary: SurveySummary }) {
  const rows = summary.party.map((item, index) => ({
    label: item._id,
    count: item.count,
    percentage: summary.total ? (item.count / summary.total) * 100 : 0,
    color: colorFor(index),
  }));

  return (
    <PieDistribution
      title="Politician vote split"
      subtitle="Votes per politician"
      rows={rows}
      centerLabel="Total voters"
      centerValue={String(summary.total)}
      showCounts
    />
  );
}

type PieDistributionProps = {
  title?: string;
  subtitle?: string;
  rows: BarRow[];
  centerLabel?: string;
  centerValue?: string;
  showCounts?: boolean;
  compact?: boolean;
};

function PieDistribution({
  title,
  subtitle,
  rows,
  centerLabel,
  centerValue,
  showCounts = false,
  compact = false,
}: PieDistributionProps) {
  const validRows = rows.filter((row) => row.count > 0);
  const total = validRows.reduce((sum, row) => sum + row.count, 0);
  const size = compact ? 154 : 226;
  const radius = compact ? 62 : 91;
  const innerRadius = compact ? 0 : 45;

  return (
    <View style={[styles.chartCard, compact && styles.compactPieCard]}>
      {title ? <ChartHeader title={title} subtitle={subtitle} /> : null}
      {validRows.length === 0 ? <EmptyChartText /> : null}
      {validRows.length > 0 ? (
        <View style={styles.pieContent}>
          <View style={styles.pieCanvas}>
            <PieGraphic
              rows={validRows}
              total={total}
              size={size}
              radius={radius}
              innerRadius={innerRadius}
              showLabels={compact}
            />
            {innerRadius > 0 ? (
              <View style={styles.pieCenter} pointerEvents="none">
                <Text style={styles.pieCenterValue}>
                  {centerValue ?? total}
                </Text>
                <Text style={styles.pieCenterLabel}>
                  {centerLabel ?? "Votes"}
                </Text>
              </View>
            ) : null}
          </View>
          <PieLegend rows={validRows} total={total} showCounts={showCounts} />
        </View>
      ) : null}
    </View>
  );
}

function PieGraphic({
  rows,
  total,
  size,
  radius,
  innerRadius,
  showLabels,
}: {
  rows: BarRow[];
  total: number;
  size: number;
  radius: number;
  innerRadius: number;
  showLabels: boolean;
}) {
  const center = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rows.map((row, index) => {
        const startAngle =
          -Math.PI / 2 +
          (rows
            .slice(0, index)
            .reduce((sum, previous) => sum + previous.count, 0) /
            total) *
            Math.PI *
            2;
        const angle = (row.count / total) * Math.PI * 2;
        const endAngle = startAngle + angle;
        const path = buildPieSlice(
          center,
          center,
          radius,
          innerRadius,
          startAngle,
          endAngle,
        );
        const middle = startAngle + angle / 2;
        const labelRadius = innerRadius
          ? (radius + innerRadius) / 2
          : radius * 0.62;
        const percentage = (row.count / total) * 100;
        const labelX = center + Math.cos(middle) * labelRadius;
        const labelY = center + Math.sin(middle) * labelRadius + 4;

        return (
          <G key={`${row.label}-${index}`}>
            <Path
              d={path}
              fill={row.color ?? colorFor(index)}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            {showLabels && percentage >= 7 ? (
              <SvgText
                x={labelX}
                y={labelY}
                fill="#FFFFFF"
                fontSize="12"
                fontWeight="800"
                textAnchor="middle">
                {Math.round(percentage)}%
              </SvgText>
            ) : null}
          </G>
        );
      })}
      {innerRadius > 0 ? (
        <Circle cx={center} cy={center} r={innerRadius} fill="#FFFFFF" />
      ) : null}
    </Svg>
  );
}

function buildPieSlice(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  start: number,
  end: number,
) {
  const outerStart = pointOnCircle(cx, cy, radius, start);
  const outerEnd = pointOnCircle(cx, cy, radius, end);
  const largeArc = end - start > Math.PI ? 1 : 0;

  if (!innerRadius) {
    return `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`;
  }

  const innerEnd = pointOnCircle(cx, cy, innerRadius, end);
  const innerStart = pointOnCircle(cx, cy, innerRadius, start);
  return `M ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function pointOnCircle(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function PieLegend({
  rows,
  total,
  showCounts,
}: {
  rows: BarRow[];
  total: number;
  showCounts: boolean;
}) {
  return (
    <View style={styles.pieLegend}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={styles.pieLegendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: row.color ?? colorFor(index) },
            ]}
          />
          <Text numberOfLines={1} style={styles.pieLegendName}>
            {row.label}
          </Text>
          <Text style={styles.pieLegendValue}>
            {showCounts ? row.count : formatPercent((row.count / total) * 100)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BarChart({
  title,
  subtitle,
  rows,
  showPercent = false,
}: {
  title: string;
  subtitle?: string;
  rows: BarRow[];
  showPercent?: boolean;
}) {
  const maxCount = Math.max(...rows.map((row) => row.count), 0);

  return (
    <View style={styles.chartCard}>
      <ChartHeader title={title} subtitle={subtitle} />
      {rows.length === 0 ? <EmptyChartText /> : null}
      {rows.map((row, index) => {
        const width = showPercent
          ? (row.percentage ?? 0)
          : maxCount
            ? (row.count / maxCount) * 100
            : 0;
        return (
          <View key={`${row.label}-${index}`} style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text numberOfLines={1} style={styles.barLabel}>
                {row.label}
              </Text>
              <Text style={styles.barValue}>
                {showPercent ? formatPercent(row.percentage ?? 0) : row.count}
              </Text>
            </View>
            {row.meta ? <Text style={styles.barMeta}>{row.meta}</Text> : null}
            <View style={styles.track}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, width)}%`,
                    backgroundColor: row.color ?? colorFor(index),
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AgeGroupSupportChart({ data }: { data: SupportByAgeGroupItem[] }) {
  const rows = AGE_BRACKETS.map((ageBracket, index) => ({
    label: ageBracket,
    count: data.find((group) => group.ageBracket === ageBracket)?.total ?? 0,
    color: colorFor(index),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <PieDistribution
      title="Age-group distribution"
      subtitle="Overall survey responses by age bracket"
      rows={rows}
      centerLabel="Voters"
      centerValue={String(total)}
      showCounts
    />
  );
}

function PreferenceByGenderChart({ data }: { data: PreferenceByGenderItem[] }) {
  return (
    <PreferenceChart
      title="Preference by gender"
      groups={data.map((item) => ({
        label: item.gender,
        total: item.total,
        preferences: item.preferences,
      }))}
    />
  );
}

function PreferenceByEducationChart({
  data,
}: {
  data: PreferenceByEducationItem[];
}) {
  return (
    <PreferenceChart
      title="Preference by education"
      groups={data.map((item) => ({
        label: item.education,
        total: item.total,
        preferences: item.preferences,
      }))}
    />
  );
}

function PreferenceByIncomeChart({ data }: { data: PreferenceByIncomeItem[] }) {
  return (
    <PreferenceChart
      title="Preference by income"
      groups={data.map((item) => ({
        label: item.incomeBracket,
        total: item.total,
        preferences: item.preferences,
      }))}
    />
  );
}

function PreferenceChart({
  title,
  groups,
}: {
  title: string;
  groups: {
    label: string;
    total: number;
    preferences: { name: string; count: number; percentage?: number }[];
  }[];
}) {
  return (
    <View style={styles.chartCard}>
      <ChartHeader title={title} subtitle="Vote share inside each group" />
      {groups.length === 0 ? <EmptyChartText /> : null}
      {groups.map((group) => {
        const rows = group.preferences.map((preference, index) => ({
          label: preference.name,
          count: preference.count,
          percentage:
            preference.percentage ??
            (group.total ? (preference.count / group.total) * 100 : 0),
          color: colorFor(index),
        }));
        return (
          <View key={group.label} style={styles.preferencePieGroup}>
            <Text style={styles.preferencePieTitle}>{group.label}</Text>
            <Text style={styles.preferencePieMeta}>{group.total} voters</Text>
            <PieDistribution title="" rows={rows} compact />
          </View>
        );
      })}
    </View>
  );
}

function MajorPublicConcernsChart({ data }: { data: BarRow[] }) {
  return (
    <BarChart
      title="Major public concerns"
      subtitle="Issues raised most often by survey respondents"
      rows={data}
    />
  );
}

function ChartHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.chartHeader}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function EmptyChartText({
  message = "No survey data yet.",
}: {
  message?: string;
}) {
  return <Text style={styles.emptyChartText}>{message}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDE7E3",
  },
  refreshButton: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#087568",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  hero: { backgroundColor: "#0B2020", borderRadius: 8, padding: 18 },
  eyebrow: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#CCFBF1",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  filterField: { gap: 6 },
  filterLabel: { color: "#334155", fontSize: 12, fontWeight: "900" },
  filterInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDE7E3",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    color: "#0F172A",
    fontWeight: "800",
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  scopeSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDE7E3",
    padding: 14,
    gap: 5,
  },
  scopeSummaryLabel: {
    color: "#0F766E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  scopeSummaryValue: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  scopeSummaryDetail: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  warning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    color: "#9A3412",
    padding: 12,
    borderRadius: 8,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  summaryLabel: { color: "#64748B", fontSize: 12, fontWeight: "900" },
  summaryValue: { color: "#0F172A", fontSize: 34, fontWeight: "900" },
  leaderBadge: {
    maxWidth: "58%",
    backgroundColor: "#E8F3EF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "flex-end",
  },
  leaderBadgeLabel: { color: "#225451", fontSize: 10, fontWeight: "900" },
  leaderBadgeText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginTop: 5,
    textAlign: "center",
  },
  darkCard: {
    backgroundColor: "#153C3A",
    borderRadius: 8,
    padding: 16,
    gap: 14,
  },
  darkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  darkEyebrow: {
    color: "#A7F3D0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  darkTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  darkPill: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: "#34D399",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  candidateGrid: { gap: 10 },
  candidateCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  leadingCandidate: {
    borderColor: "#34D399",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900" },
  candidateCopy: { flex: 1, minWidth: 0 },
  candidateName: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  candidateMeta: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  candidatePercent: { color: "#6EE7B7", fontSize: 20, fontWeight: "900" },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
  },
  compactPieCard: {
    borderWidth: 0,
    padding: 0,
    gap: 8,
  },
  pieContent: { alignItems: "center", gap: 14 },
  pieCanvas: { alignItems: "center", justifyContent: "center" },
  pieCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterValue: { color: "#0F172A", fontSize: 22, fontWeight: "900" },
  pieCenterLabel: { color: "#64748B", fontSize: 10, fontWeight: "800" },
  pieLegend: { width: "100%", gap: 8 },
  pieLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  pieLegendName: {
    flex: 1,
    minWidth: 0,
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  pieLegendValue: { color: "#225451", fontSize: 12, fontWeight: "900" },
  chartHeader: { gap: 3 },
  chartTitle: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  chartSubtitle: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  emptyChartText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 4,
  },
  barRow: { gap: 6 },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  barLabel: { flex: 1, color: "#334155", fontSize: 13, fontWeight: "900" },
  barValue: { color: "#0F766E", fontSize: 12, fontWeight: "900" },
  barMeta: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  track: {
    height: 9,
    backgroundColor: "#EEF2F7",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  legendItem: {
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: "#475569", fontSize: 11, fontWeight: "800" },
  groupBlock: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    gap: 8,
  },
  groupHeader: { flexDirection: "row", justifyContent: "space-between" },
  groupTitle: { color: "#0F172A", fontWeight: "900" },
  groupMeta: { color: "#94A3B8", fontSize: 11, fontWeight: "800" },
  miniBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniBarLabel: {
    width: 88,
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  miniTrack: {
    flex: 1,
    height: 7,
    backgroundColor: "#EEF2F7",
    borderRadius: 999,
    overflow: "hidden",
  },
  miniFill: { height: "100%", borderRadius: 999 },
  miniValue: {
    width: 42,
    color: "#0F766E",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  preferenceRow: {
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  preferenceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  preferenceLabel: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  preferenceMeta: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  preferenceRight: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  preferenceName: {
    color: "#225451",
    fontSize: 12,
    fontWeight: "900",
    maxWidth: "100%",
  },
  preferencePercent: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  preferencePieGroup: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingTop: 14,
    alignItems: "center",
  },
  preferencePieTitle: { color: "#334155", fontSize: 14, fontWeight: "900" },
  preferencePieMeta: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 8,
  },
  wardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wardCell: {
    width: "31.7%",
    minHeight: 86,
    borderRadius: 8,
    padding: 8,
    justifyContent: "space-between",
  },
  wardNo: { color: "#0F172A", fontSize: 12, fontWeight: "900" },
  wardPct: { color: "#0F172A", fontSize: 22, fontWeight: "900" },
  wardLeader: { color: "#334155", fontSize: 10, fontWeight: "800" },
  wardNoLight: { color: "#FFFFFF" },
});
