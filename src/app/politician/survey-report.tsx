import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
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

/**
 * Heatmap palettes — one distinct ramp per demographic chart.
 * Each palette is ordered from weakest → strongest.
 */
type HeatPalette = {
  name: string;
  /** Weakest → strongest (5 stops). */
  colors: [string, string, string, string, string];
  /** Text color used on top of the strongest two stops. */
  strongText: string;
  /** Text color used on top of the weakest three stops. */
  weakText: string;
  /** Border used to highlight the leading cell. */
  leaderBorder: string;
};




const INCOME_PALETTE: HeatPalette = {
  name: "amber",
  colors: ["#FFFBEB", "#FEF3C7", "#FCD34D", "#F59E0B", "#B45309"],
  weakText: "#78350F",
  strongText: "#FFFFFF",
  leaderBorder: "#B45309",
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

/**
 * Map a 0-100 percentage to a color from the given palette.
 * Thresholds: 0-5, 5-20, 20-35, 35-55, 55+
 */
function heatStop(percentage: number): 0 | 1 | 2 | 3 | 4 {
  if (percentage >= 55) return 4;
  if (percentage >= 35) return 3;
  if (percentage >= 20) return 2;
  if (percentage >= 5) return 1;
  return 0;
}

function heatColor(percentage: number, palette: HeatPalette) {
  return palette.colors[heatStop(percentage)];
}

function heatTextColor(percentage: number, palette: HeatPalette) {
  return heatStop(percentage) >= 3 ? palette.strongText : palette.weakText;
}

export default function SurveyScreen() {
  const params = useLocalSearchParams();
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
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
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
        {/* 
          
          
          
          
          
          
          
          
          */}

        {loading || !scopeReady ? <ReportSkeleton /> : <>
        {report.summary.total === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No anonymous responses yet</Text>
            <Text style={styles.emptyText}>
              Save survey responses for this location to generate the report.
            </Text>
          </View>
        ) : null}

        <PieDistribution
          title="Vote share distribution"
          subtitle="Distribution of stated political preferences"
          rows={partyRows}
          centerLabel="Responses"
          centerValue={String(report.summary.total)}
        />

        <PreferencePieCharts
          title="Age-group support"
          groups={AGE_BRACKETS.map((bracket) => {
            const found = report.supportByAgeGroup.find(
              (group) => group.ageBracket === bracket,
            );
            return {
              label: bracket,
              total: found?.total ?? 0,
              preferences:
                found?.support.map((s) => ({
                  name: s.name,
                  count: s.count,
                  percentage: s.percentage,
                })) ?? [],
            };
          })}
        />

        <GenderPreferenceBars
          groups={report.preferenceByGender.map((item) => ({
            label: item.gender,
            total: item.total,
            preferences: item.preferences,
          }))}
        />

        <PreferencePieCharts
          title="Education preference"
          groups={report.preferenceByEducation.map((item) => ({
            label: item.education,
            total: item.total,
            preferences: item.preferences,
          }))}
        />

        <IncomePreferenceViews
          groups={report.preferenceByIncome.map((item) => ({
            label: item.incomeBracket,
            total: item.total,
            preferences: item.preferences,
          }))}
        />

        <BarChart
          title="Sector support index"
          subtitle="Support for current lead by occupation"
          rows={sectorRows}
          showPercent
        />
        <MajorPublicConcernsChart data={issueRows} />
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportSkeleton() {
  return <View accessible accessibilityLabel="Loading survey report" accessibilityState={{ busy: true }} style={{ gap: 14 }}>
    {["pie", "groups", "bars"].map((kind) => <View key={kind} style={styles.chartCard}>
      <View style={[styles.skeletonBlock, { width: "58%", height: 18, marginBottom: 10 }]} />
      <View style={[styles.skeletonBlock, { width: "80%", height: 12, marginBottom: 22 }]} />
      {kind === "bars" ? <View style={{ gap: 14 }}>
        {[85, 65, 75, 45].map((width) => <View key={width} style={[styles.skeletonBlock, { width: `${width}%`, height: 24 }]} />)}
      </View> : <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", gap: 18 }}>
        {Array.from({ length: kind === "groups" ? 4 : 1 }, (_, index) => <View key={index} style={{ alignItems: "center", gap: 10, width: kind === "groups" ? "44%" : "100%" }}>
          <View style={[styles.skeletonBlock, { width: 120, height: 120, borderRadius: 60 }]} />
          <View style={[styles.skeletonBlock, { width: 85, height: 12 }]} />
        </View>)}
      </View>}
    </View>)}
  </View>;
}

/* ------------------------------- Pie / Donut ------------------------------- */

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
        const endAngle = startAngle + Math.min(angle, Math.PI * 2 - 0.000001);
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

/* --------------------------------- Bars ---------------------------------- */

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

/* ------------------------------ Heatmap ---------------------------------- */

type HeatmapGroup = {
  label: string;
  total: number;
  preferences: { name: string; count: number; percentage?: number }[];
};

function GenderPreferenceBars({ groups }: { groups: HeatmapGroup[] }) {
  const genders = [
    { label: "Male", color: "#2563EB" },
    { label: "Female", color: "#EC4899" },
    { label: "Other", color: "#8B5CF6" },
  ];
  const names = Array.from(new Set(groups.flatMap((group) => group.preferences.map((item) => item.name))));
  const getCount = (name: string, gender: string) => groups
    .filter((group) => group.label.toLowerCase() === gender.toLowerCase())
    .reduce((sum, group) => sum + group.preferences.filter((item) => item.name === name).reduce((count, item) => count + item.count, 0), 0);
  const maximum = Math.max(1, ...names.flatMap((name) => genders.map((gender) => getCount(name, gender.label))));
  return <View style={styles.chartCard}>
    <Text style={styles.chartTitle}>Preference by gender</Text>
    <Text style={{ color: "#64748B", fontSize: 12, marginTop: 4 }}>Number of voters · swipe to view politicians</Text>
    <View style={{ flexDirection: "row", gap: 16, marginVertical: 14 }}>
      {genders.map((gender) => <View key={gender.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: gender.color }} />
        <Text style={{ color: "#475569", fontSize: 12 }}>{gender.label}</Text>
      </View>)}
    </View>
    {names.length === 0 ? <Text style={{ color: "#94A3B8" }}>No responses yet.</Text> :
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ flexDirection: "row", gap: 18, paddingBottom: 10 }}>
          {names.map((name) => <View key={name} style={{ width: 126 }}>
            <View style={{ height: 190, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#CBD5E1" }}>
              {genders.map((gender) => {
                const count = getCount(name, gender.label);
                return <View key={gender.label} accessible accessibilityLabel={`${name}, ${gender.label}: ${count} voters`} style={{ alignItems: "center", width: 30 }}>
                  <Text style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}>{count}</Text>
                  <View style={{ width: 26, height: count > 0 ? Math.max(2, count / maximum * 160) : 0, backgroundColor: gender.color, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                </View>;
              })}
            </View>
            <Text style={{ textAlign: "center", color: "#334155", fontSize: 12, fontWeight: "800", marginTop: 8 }}>{name}</Text>
          </View>)}
        </View>
      </ScrollView>}
  </View>;
}

function InteractivePreferencePie({ rows, total, label }: { rows: BarRow[]; total: number; label: string }) {
  const [visible, setVisible] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${label} preference details`} onPress={() => setVisible(true)} onLongPress={() => setVisible(true)} delayLongPress={350}>
      <PieGraphic rows={rows} total={total} size={140} radius={68} innerRadius={0} showLabels />
    </Pressable>
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable onPress={() => setVisible(false)} style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 24 }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: "#0F172A", borderRadius: 14, padding: 18, maxHeight: "80%", width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Text style={{ flex: 1, color: "#FFFFFF", fontWeight: "900", fontSize: 16 }}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close preference details" onPress={() => setVisible(false)} style={{ padding: 8 }}><Text style={{ color: "#FFFFFF", fontSize: 18 }}>✕</Text></Pressable>
          </View>
          <ScrollView>
            {rows.slice().sort((first, second) => second.count - first.count).map((item) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: item.color }} />
                <Text style={{ flex: 1, color: "#E2E8F0", fontSize: 13 }}>{item.label}</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>{formatPercent(item.count / total * 100)}</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

function PreferencePieCharts({ title, groups, embedded = false }: { title: string; groups: HeatmapGroup[]; embedded?: boolean }) {
  const names = Array.from(new Set(groups.flatMap((group) => group.preferences.map((item) => item.name))));
  return (
    <View style={!embedded && styles.chartCard}>
      {!embedded && <Text style={styles.chartTitle}>{title}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginVertical: 14 }}>
        {names.map((name, index) => (
          <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: colorFor(index) }} />
            <Text style={{ color: "#475569", fontSize: 11 }}>{name}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 }}>
        {groups.map((group) => {
          const rows = group.preferences.filter((item) => item.count > 0).map((item) => ({ ...item, label: item.name, color: colorFor(names.indexOf(item.name)) }));
          const total = rows.reduce((sum, item) => sum + item.count, 0);
          return <View key={group.label} style={{ width: "48%", alignItems: "center", gap: 5 }}>
            {total > 0 ? <InteractivePreferencePie rows={rows} total={total} label={group.label} /> : <Text style={{ color: "#94A3B8", paddingVertical: 50 }}>No responses</Text>}
            <Text style={{ color: "#334155", fontWeight: "800", textAlign: "center" }}>{group.label}</Text>
            <Text style={{ color: "#94A3B8", fontSize: 11 }}>{group.total} voters</Text>
          </View>;
        })}
      </View>
    </View>
  );
}

function IncomePreferenceViews({ groups }: { groups: HeatmapGroup[] }) {
  const [view, setView] = useState<"pie" | "heatmap">("pie");
  return <View style={styles.chartCard}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Text style={[styles.chartTitle, { flexGrow: 1 }]}>Preference by income</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
      {(["pie", "heatmap"] as const).map((option) => <Pressable
        key={option}
        accessibilityRole="button"
        accessibilityLabel={`Show income preference as ${option === "pie" ? "pie charts" : "heatmap"}`}
        accessibilityState={{ selected: view === option }}
        onPress={() => setView(option)}
        style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#0F766E", backgroundColor: view === option ? "#0F766E" : "#FFFFFF" }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: view === option ? "#FFFFFF" : "#0F766E" }}>{option === "pie" ? "Pie charts" : "Heatmap"}</Text>
      </Pressable>)}
      </View>
    </View>
    {view === "pie" ? <PreferencePieCharts embedded title="Preference by income" groups={groups} /> :
      <PreferenceHeatmap embedded title="Preference by income" subtitle="Darker cells indicate stronger political preference" rowHeader="Income" palette={INCOME_PALETTE} groups={groups} />}
  </View>;
}

function PreferenceHeatmap({
  title,
  subtitle,
  rowHeader,
  groups,
  palette,
  embedded = false,
}: {
  embedded?: boolean;
  title: string;
  subtitle?: string;
  rowHeader: string;
  groups: HeatmapGroup[];
  palette: HeatPalette;
}) {
  const politicians = Array.from(
    new Set(groups.flatMap((group) => group.preferences.map((p) => p.name))),
  );
  const visibleGroups = groups.filter((group) => group.total > 0);
  const hasData = visibleGroups.length > 0 && politicians.length > 0;
  const tableWidth = politicians.length * 68 - 6;

  return (
    <View style={embedded ? { marginTop: 14 } : styles.chartCard}>
      <View style={styles.chartHeader}>
        {!embedded && <View style={styles.chartHeaderRow}>
          <Text style={styles.chartTitle}>{title}</Text>
          <View
            style={[
              styles.paletteSwatch,
              { backgroundColor: palette.colors[4] },
            ]}
          />
        </View>}
        {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
      </View>
      {!hasData ? <EmptyChartText /> : null}
      {hasData ? (
        <>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={{ width: 96, gap: 6 }}>
              <Text style={[styles.heatmapHeader, styles.heatmapRowHeader, { height: 26 }]}>{rowHeader}</Text>
              {visibleGroups.map((group) => <View key={group.label} style={styles.heatmapRowCell}>
                <Text style={styles.heatmapRowLabel}>{group.label}</Text>
                <Text style={styles.heatmapRowTotal}>{group.total}</Text>
              </View>)}
            </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={[styles.heatmapTable, { width: tableWidth }]}>
              <View style={[styles.heatmapHeaderRow, { height: 26 }]}>
                {politicians.map((name) => (
                  <Text
                    key={name}
                    numberOfLines={2}
                    style={styles.heatmapHeader}>
                    {name}
                  </Text>
                ))}
              </View>
              {visibleGroups.map((group) => {
                const leader = [...group.preferences].sort(
                  (a, b) => b.count - a.count,
                )[0];
                const leaderPct =
                  leader && group.total
                    ? (leader.count / group.total) * 100
                    : 0;

                return (
                  <View key={group.label} style={styles.heatmapRow}>
                    {politicians.map((name) => {
                      const preference = group.preferences.find(
                        (item) => item.name === name,
                      );
                      const percentage =
                        preference?.percentage ??
                        (preference && group.total
                          ? (preference.count / group.total) * 100
                          : 0);
                      const isLeader = leader?.name === name && leaderPct > 0;
                      return (
                        <View
                          key={name}
                          style={[
                            styles.heatmapCell,
                            {
                              backgroundColor: heatColor(percentage, palette),
                            },
                            isLeader && {
                              borderWidth: 2,
                              borderColor: palette.leaderBorder,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.heatmapValue,
                              {
                                color: heatTextColor(percentage, palette),
                              },
                            ]}>
                            {percentage > 0
                              ? `${Math.round(percentage)}%`
                              : "–"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={styles.heatmapLegendText}>Low</Text>
            {palette.colors.map((color) => (
              <View
                key={color}
                style={[styles.heatmapLegendSwatch, { backgroundColor: color }]}
              />
            ))}
            <Text style={styles.heatmapLegendText}>High</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ------------------------- Concerns bar chart ---------------------------- */

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
  skeletonBlock: { backgroundColor: "#E2E8F0", borderRadius: 6 },
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

  /* Heatmap */
  heatmapTable: { gap: 6 },
  heatmapHeaderRow: { flexDirection: "row", gap: 6 },
  heatmapHeader: {
    width: 62,
    color: "#64748B",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textAlign: "center",
  },
  heatmapRowHeader: { width: 96, textAlign: "left" },
  heatmapRow: { flexDirection: "row", gap: 6 },
  heatmapRowCell: {
    width: 96,
    minHeight: 54,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  heatmapRowLabel: { color: "#0F172A", fontSize: 12, fontWeight: "900" },
  heatmapRowTotal: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  heatmapCell: {
    alignItems: "center",
    borderRadius: 8,
    height: 54,
    justifyContent: "center",
    width: 62,
  },
  heatmapValue: { fontSize: 12, fontWeight: "900" },
  heatmapLegend: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  heatmapLegendSwatch: { borderRadius: 3, height: 10, width: 22 },
  heatmapLegendText: { color: "#64748B", fontSize: 10, fontWeight: "800" },

  chartHeader: { gap: 3 },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  paletteSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
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
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
});
