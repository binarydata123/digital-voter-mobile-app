import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentUser, logoutPolitician } from "@/services/authentication";
import {
  fetchSurveyReport,
  type PreferenceByEducationItem,
  type PreferenceByGenderItem,
  type PreferenceByIncomeItem,
  type SupportByAgeGroupItem,
  type SurveyScope,
  type SurveySummary,
  type WardHeatMapItem,
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
const currentYear = String(new Date().getFullYear());

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
  const user = getCurrentUser();
  return {
    electionType: "Vidhan Sabha",
    electionYear: currentYear,
    state: user?.state ?? "",
    district: user?.district ?? "",
    city: user?.constituency ?? "",
    wardNo: user?.ward ?? "",
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function colorFor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function SurveyScreen() {
  const [scope, setScope] = useState<SurveyScope>(() => getDefaultScope());
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

  const canLoad = Boolean(
    scope.electionType && scope.electionYear && scope.state && scope.district,
  );

  const loadReport = useCallback(async () => {
    if (!canLoad) {
      setError("Election type, year, state, and district are required.");
      return;
    }

    setLoading(true);
    try {
      const nextReport = await fetchSurveyReport(scope);
      setReport(nextReport);
      setError("");
    } catch (loadError: any) {
      if (loadError?.message === "Please sign in again to continue.") {
        await logoutPolitician();
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
  }, [canLoad, scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport();
  }, [loadReport]);

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

  function updateScope(field: keyof SurveyScope, value: string) {
    setScope((current) => ({ ...current, [field]: value }));
  }

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
        }
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to voters"
            onPress={() => router.replace("/politician/voters")}
            style={styles.iconButton}
          >
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
            Review party support, age groups, demographics, public concerns, and
            ward signals from saved survey responses.
          </Text>
        </View>

        <View style={styles.filterCard}>
          <FilterInput
            label="Election Type"
            value={scope.electionType}
            onChangeText={(value) => updateScope("electionType", value)}
          />
          <FilterInput
            label="Election Year"
            value={scope.electionYear}
            keyboardType="number-pad"
            onChangeText={(value) => updateScope("electionYear", value)}
          />
          <FilterInput
            label="State"
            value={scope.state}
            onChangeText={(value) => updateScope("state", value)}
          />
          <FilterInput
            label="District"
            value={scope.district}
            onChangeText={(value) => updateScope("district", value)}
          />
          <FilterInput
            label="City"
            value={scope.city}
            onChangeText={(value) => updateScope("city", value)}
          />
          <FilterInput
            label="Ward No"
            value={scope.wardNo}
            onChangeText={(value) => updateScope("wardNo", value)}
          />
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
        <BarChart
          title="Party support"
          subtitle="Vote preference by politician"
          rows={partyRows}
          showPercent
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
        <WardHeatMapChart wards={report.wardHeatMap} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterInput({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={label}
        placeholderTextColor="#94A3B8"
        style={styles.filterInput}
      />
    </View>
  );
}

function CandidateSupport({ summary }: { summary: SurveySummary }) {
  const rows = summary.party.map((item, index) => ({
    ...item,
    percent: summary.total ? (item.count / summary.total) * 100 : 0,
    color: colorFor(index),
  }));

  if (!rows.length) return null;

  return (
    <View style={styles.darkCard}>
      <View style={styles.darkHeader}>
        <View>
          <Text style={styles.darkEyebrow}>LIVE SURVEY SIGNAL</Text>
          <Text style={styles.darkTitle}>Candidate support</Text>
        </View>
        <Text style={styles.darkPill}>{summary.total} samples</Text>
      </View>
      <View style={styles.candidateGrid}>
        {rows.map((candidate, index) => (
          <View
            key={candidate._id}
            style={[
              styles.candidateCard,
              index === 0 && styles.leadingCandidate,
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(candidate._id)}</Text>
            </View>
            <View style={styles.candidateCopy}>
              <Text numberOfLines={1} style={styles.candidateName}>
                {candidate._id}
              </Text>
              <Text style={styles.candidateMeta}>
                {index === 0 ? "Leading" : "Support"}
              </Text>
            </View>
            <Text style={styles.candidatePercent}>
              {formatPercent(candidate.percent)}
            </Text>
          </View>
        ))}
      </View>
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
  const politicians = Array.from(
    new Set(data.flatMap((group) => group.support.map((item) => item.name))),
  );
  const groups = AGE_BRACKETS.map(
    (bracket) =>
      data.find((group) => group.ageBracket === bracket) ?? {
        ageBracket: bracket,
        total: 0,
        support: [],
      },
  );

  return (
    <View style={styles.chartCard}>
      <ChartHeader
        title="Age-group support"
        subtitle="Percent of each age group"
      />
      {politicians.length === 0 ? <EmptyChartText /> : null}
      <Legend names={politicians} />
      {groups.map((group) => (
        <View key={group.ageBracket} style={styles.groupBlock}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{group.ageBracket}</Text>
            <Text style={styles.groupMeta}>{group.total} voters</Text>
          </View>
          {politicians.map((name, index) => {
            const row = group.support.find((item) => item.name === name);
            const percentage = row?.percentage ?? 0;
            return (
              <View key={name} style={styles.miniBarRow}>
                <Text numberOfLines={1} style={styles.miniBarLabel}>
                  {name}
                </Text>
                <View style={styles.miniTrack}>
                  <View
                    style={[
                      styles.miniFill,
                      {
                        width: `${percentage}%`,
                        backgroundColor: colorFor(index),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.miniValue}>
                  {formatPercent(percentage)}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
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
      <ChartHeader title={title} subtitle="Top preference inside each group" />
      {groups.length === 0 ? <EmptyChartText /> : null}
      {groups.map((group) => {
        const top = [...group.preferences].sort((a, b) => b.count - a.count)[0];
        const pct = top
          ? (top.percentage ??
            (group.total ? (top.count / group.total) * 100 : 0))
          : 0;
        return (
          <View key={group.label} style={styles.preferenceRow}>
            <View style={styles.preferenceTop}>
              <View>
                <Text style={styles.preferenceLabel}>{group.label}</Text>
                <Text style={styles.preferenceMeta}>
                  {group.total} responses
                </Text>
              </View>
              <View style={styles.preferenceRight}>
                <Text numberOfLines={1} style={styles.preferenceName}>
                  {top?.name ?? "No data"}
                </Text>
                <Text style={styles.preferencePercent}>
                  {formatPercent(pct)}
                </Text>
              </View>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: "#225451",
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

function MajorPublicConcernsChart({ data }: { data: BarRow[] }) {
  return (
    <BarChart
      title="Major public concerns"
      subtitle="Issues raised most often by survey respondents"
      rows={data}
    />
  );
}

function WardHeatMapChart({ wards }: { wards: WardHeatMapItem[] }) {
  return (
    <View style={styles.chartCard}>
      <ChartHeader
        title="Ward support heat map"
        subtitle="Leading support percent by ward"
      />
      {wards.length === 0 ? (
        <EmptyChartText message="No ward survey data is available." />
      ) : null}
      <View style={styles.wardGrid}>
        {wards.map((ward) => {
          const pct = ward.leader?.percentage ?? 0;
          return (
            <View
              key={ward.wardNo}
              style={[styles.wardCell, { backgroundColor: getHeatColor(pct) }]}
            >
              <Text style={[styles.wardNo, pct >= 60 && styles.wardNoLight]}>
                {ward.wardNo}
              </Text>
              <Text style={[styles.wardPct, pct >= 60 && styles.wardNoLight]}>
                {pct}%
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.wardLeader, pct >= 60 && styles.wardNoLight]}
              >
                {ward.leader?.name ?? "No lead"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getHeatColor(percentage: number) {
  if (percentage >= 70) return "#166534";
  if (percentage >= 50) return "#65A30D";
  if (percentage >= 30) return "#EAB308";
  if (percentage > 0) return "#F97316";
  return "#E5E7EB";
}

function Legend({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <View style={styles.legend}>
      {names.map((name, index) => (
        <View key={name} style={styles.legendItem}>
          <View
            style={[styles.legendSwatch, { backgroundColor: colorFor(index) }]}
          />
          <Text numberOfLines={1} style={styles.legendText}>
            {name}
          </Text>
        </View>
      ))}
    </View>
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
