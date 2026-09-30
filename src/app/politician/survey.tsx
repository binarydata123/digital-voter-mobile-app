import { Image } from "expo-image";
import { router } from "expo-router";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LogOut,
  MapPin,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCurrentUser,
  getDefaultPoliticianRoute,
  hasPoliticianPageAccess,
  logoutPolitician,
} from "@/services/authentication";
import {
  buildAssignedSurveyScope,
  getAssignedSurveyScope,
  saveSurveyResponse,
  type SurveyResponseInput,
  type SurveyScope,
} from "@/services/survey";

const GENDERS = ["Male", "Female", "Other"];
const AGE_BRACKETS = ["18-25", "26-35", "36-50", "50+"];
const EDUCATION = [
  "Primary / Basic",
  "10th / 12th Pass",
  "Graduate",
  "PG / Professional",
];
const INCOME = ["< ₹15k", "₹15k-35k", "₹35k-75k", "₹75k+"];
const OCCUPATIONS = [
  "Private Job / Staff",
  "State Government",
  "Central / Army",
  "Business / Trader",
  "Farmer / Agriculture",
  "Daily Wage / Labour",
  "Homemaker",
  "Student",
];
const CONCERNS = [
  "Jobs & Youth",
  "Inflation / Mehngai",
  "Roads & Transport",
  "Water Supply",
  "Healthcare",
  "Education",
  "Safety & Crime",
  "Farming & Agriculture",
];
const POLITICIANS = [
  { name: "Ram", party: "Congress" },
  { name: "Testing", party: "BJP" },
];

type ScopeField = keyof SurveyScope;
type FormState = Omit<
  SurveyResponseInput,
  keyof SurveyScope | "preferredParty" | "preferredPolitician"
> & {
  preferredPolitician: string;
  preferredParty: string;
};

const emptyForm: FormState = {
  gender: "",
  ageBracket: "",
  education: "",
  incomeBracket: "",
  occupation: "",
  issues: [],
  preferredPolitician: "",
  preferredParty: "",
};

const scopeLabels: Record<ScopeField, string> = {
  electionType: "Election Type *",
  electionYear: "Election Year *",
  state: "State *",
  district: "District *",
  city: "City *",
  wardNo: "Ward *",
};

export default function SurveyScreen() {
  const [scope, setScope] = useState<SurveyScope>(() =>
    buildAssignedSurveyScope(),
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeDropdown, setActiveDropdown] = useState<ScopeField | null>(null);
  const [loadingScope, setLoadingScope] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoutChoiceVisible, setLogoutChoiceVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAssignedSurveyScope()
      .then((assignedScope) => {
        if (mounted) setScope(assignedScope);
      })
      .catch((loadError: any) => {
        if (loadError?.message === "Please sign in again to continue.") {
          logoutPolitician();
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(loadError?.message ?? "Could not load assigned ward.");
        }
      })
      .finally(() => {
        if (mounted) setLoadingScope(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentUser = getCurrentUser();
  const canOpenVoters = hasPoliticianPageAccess("voters", currentUser);
  const politicianName = currentUser?.name ?? "Testing";
  const locationLabel = [scope.city, scope.state].filter(Boolean).join(", ");

  useEffect(() => {
    if (currentUser && !hasPoliticianPageAccess("survey", currentUser)) {
      const nextRoute = getDefaultPoliticianRoute(currentUser);
      router.replace(nextRoute ?? "/login");
    }
  }, [currentUser]);

  const scopeOptions = useMemo<Record<ScopeField, string[]>>(
    () => ({
      electionType: uniqueValues(
        scope.electionType,
        "Rajya Sabha",
        "Vidhan Sabha",
        "Lok Sabha",
      ),
      electionYear: uniqueValues(scope.electionYear, "2026", "2025", "2024"),
      state: uniqueValues(scope.state),
      district: uniqueValues(scope.district),
      city: uniqueValues(scope.city),
      wardNo: uniqueValues(scope.wardNo),
    }),
    [scope],
  );

  const candidateOptions = useMemo(() => {
    const userName = currentUser?.name?.trim();
    if (!userName || POLITICIANS.some((item) => item.name === userName)) {
      return POLITICIANS;
    }
    return [{ name: userName, party: "Assigned" }, ...POLITICIANS];
  }, [currentUser?.name]);

  function updateScope(field: ScopeField, value: string) {
    setMessage("");
    setError("");
    setScope((current) => ({ ...current, [field]: value }));
    setActiveDropdown(null);
  }

  function setSingle(field: keyof FormState, value: string) {
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleConcern(issue: string) {
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      issues: current.issues.includes(issue)
        ? current.issues.filter((item) => item !== issue)
        : [...current.issues, issue],
    }));
  }

  function choosePolitician(name: string, party: string) {
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      preferredPolitician: name,
      preferredParty: party,
    }));
  }

  function validate() {
    if (
      !scope.electionType ||
      !scope.electionYear ||
      !scope.state ||
      !scope.district ||
      !scope.wardNo
    ) {
      return "Election location and assigned ward are required.";
    }
    if (
      !form.gender ||
      !form.ageBracket ||
      !form.education ||
      !form.incomeBracket ||
      !form.occupation
    ) {
      return "Please select one option in every voter profile section.";
    }
    if (!form.issues.length) {
      return "Please choose at least one major concern.";
    }
    if (!form.preferredPolitician) {
      return "Please choose the likely preferred politician.";
    }
    return "";
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await saveSurveyResponse({ ...scope, ...form });
      setForm(emptyForm);
      setMessage("Survey response saved for assigned ward.");
      setError("");
    } catch (saveError: any) {
      if (saveError?.message === "Please sign in again to continue.") {
        logoutPolitician();
        router.replace("/login");
        return;
      }
      setError(
        saveError?.response?.data?.message ??
          saveError?.message ??
          "Could not save survey response.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    setLogoutChoiceVisible(true);
  }

  function confirmLogout() {
    setLogoutChoiceVisible(false);
    logoutPolitician();
    router.replace("/login");
  }

  function openVoterPage() {
    if (canOpenVoters) {
      setLogoutChoiceVisible(false);
      router.push("/politician/voters");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
          source={require("../../../assets/images/vote.jpeg")}
          style={styles.headerImage}
          contentFit="cover"
          // contentPosition={{ left: "62%", top: "42%" }}
          transition={120}
        />
        <View style={styles.headerOverlay} />

        <View style={styles.headerTop}>
          <View />
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Survey report"
              onPress={() => router.push("/politician/survey-report")}
              style={styles.headerIconButton}
            >
              <BarChart3 color="#0F766E" size={18} strokeWidth={2.8} />
            </Pressable>
            <Pressable
              accessibilityLabel="Logout"
              onPress={handleLogout}
              style={[styles.headerIconButton, styles.logoutButton]}
            >
              <LogOut color="#FFFFFF" size={18} strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GROUND SURVEY</Text>
          <Text numberOfLines={1} style={styles.title}>
            {politicianName}
          </Text>
          <Text style={styles.boothTitle}>
            Ward-{scope.wardNo || "Assigned"}
          </Text>
          {locationLabel ? (
            <View style={styles.locationRow}>
              <MapPin color="#087568" size={14} strokeWidth={2.8} />
              <Text numberOfLines={1} style={styles.location}>
                {locationLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.scopeCard}>
            <View style={styles.scopeGrid}>
              {(Object.keys(scopeLabels) as ScopeField[]).map((field) => (
                <DropdownField
                  key={field}
                  label={scopeLabels[field]}
                  value={scope[field]}
                  onPress={() => setActiveDropdown(field)}
                />
              ))}
            </View>
          </View>

          {loadingScope ? (
            <ActivityIndicator color="#0F766E" style={styles.scopeLoader} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <OptionSection
            title="Gender"
            options={GENDERS}
            value={form.gender}
            onSelect={(value) => setSingle("gender", value)}
            columns={3}
          />
          <OptionSection
            title="Age bracket"
            options={AGE_BRACKETS}
            value={form.ageBracket}
            onSelect={(value) => setSingle("ageBracket", value)}
            columns={2}
          />
          <OptionSection
            title="Education"
            options={EDUCATION}
            value={form.education}
            onSelect={(value) => setSingle("education", value)}
            columns={2}
          />
          <OptionSection
            title="Monthly household income"
            options={INCOME}
            value={form.incomeBracket}
            onSelect={(value) => setSingle("incomeBracket", value)}
            columns={2}
          />
          <OptionSection
            title="Occupation"
            options={OCCUPATIONS}
            value={form.occupation}
            onSelect={(value) => setSingle("occupation", value)}
            columns={2}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Major concerns{" "}
              <Text style={styles.hint}>(choose one or more)</Text>
            </Text>
            <View style={styles.optionGrid}>
              {CONCERNS.map((issue) => (
                <OptionButton
                  key={issue}
                  label={issue}
                  selected={form.issues.includes(issue)}
                  onPress={() => toggleConcern(issue)}
                  columns={2}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Likely preferred politician</Text>
            <View style={styles.optionGrid}>
              {candidateOptions.map((candidate) => (
                <Pressable
                  key={`${candidate.name}-${candidate.party}`}
                  onPress={() =>
                    choosePolitician(candidate.name, candidate.party)
                  }
                  style={[
                    styles.optionButton,
                    styles.twoColumn,
                    form.preferredPolitician === candidate.name &&
                      styles.optionButtonActive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.optionText,
                      form.preferredPolitician === candidate.name &&
                        styles.optionTextActive,
                    ]}
                  >
                    {candidate.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.partyText,
                      form.preferredPolitician === candidate.name &&
                        styles.optionTextActive,
                    ]}
                  >
                    {candidate.party}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            disabled={saving || loadingScope}
            onPress={handleSave}
            style={[
              styles.saveButton,
              (saving || loadingScope) && styles.disabledButton,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <CheckCircle2 color="#FFFFFF" size={18} strokeWidth={2.8} />
            )}
            <Text style={styles.saveText}>Save</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/politician/survey-report")}
            style={styles.reportButton}
          >
            <ClipboardList color="#087568" size={17} strokeWidth={2.7} />
            <Text style={styles.reportText}>View report</Text>
          </Pressable>
        </ScrollView>
      </View>

      {logoutChoiceVisible ? (
        <View style={styles.logoutChoiceOverlay}>
          <Pressable
            accessibilityLabel="Cancel logout"
            onPress={() => setLogoutChoiceVisible(false)}
            style={styles.logoutChoiceBackdrop}
          />
          <View style={styles.logoutChoicePanel}>
            <View style={styles.logoutChoiceHeader}>
              <Text style={styles.logoutChoiceTitle}>Before you leave</Text>
              <Pressable
                accessibilityLabel="Close logout options"
                onPress={() => setLogoutChoiceVisible(false)}
                style={styles.logoutChoiceClose}
              >
                <X color="#64748B" size={20} strokeWidth={2.6} />
              </Pressable>
            </View>

            <Text style={styles.logoutChoiceMessage}>
              {canOpenVoters
                ? "Open the voter page or confirm logout from this account."
                : "Confirm logout from this account."}
            </Text>

            <View style={styles.logoutChoiceActions}>
              {canOpenVoters ? (
                <Pressable
                  onPress={openVoterPage}
                  style={styles.voterChoiceButton}
                >
                  <Text style={styles.voterChoiceText}>Open Voter Page</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={confirmLogout} style={styles.logoutConfirmButton}>
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Modal
        transparent
        visible={Boolean(activeDropdown)}
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        {activeDropdown ? (
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setActiveDropdown(null)}
          >
            <Pressable style={styles.dropdownSheet}>
              <View style={styles.handle} />
              <Text style={styles.dropdownTitle}>
                {scopeLabels[activeDropdown]}
              </Text>
              {scopeOptions[activeDropdown].map((option) => {
                const selected = scope[activeDropdown] === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => updateScope(activeDropdown, option)}
                    style={[
                      styles.dropdownOption,
                      selected && styles.dropdownOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        selected && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {option || "Assigned after login"}
                    </Text>
                    {selected ? (
                      <CheckCircle2
                        color="#087568"
                        size={18}
                        strokeWidth={2.7}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function uniqueValues(...values: string[]) {
  const unique = values.map((value) => value.trim()).filter(Boolean);
  return unique.length ? Array.from(new Set(unique)) : [""];
}

function DropdownField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.dropdownField}>
        <Text numberOfLines={1} style={styles.dropdownText}>
          {value || "Assigned after login"}
        </Text>
        <ChevronDown color="#64748B" size={16} strokeWidth={2.8} />
      </Pressable>
    </View>
  );
}

function OptionSection({
  title,
  options,
  value,
  onSelect,
  columns,
}: {
  title: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  columns: 2 | 3;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => (
          <OptionButton
            key={option}
            label={option}
            selected={value === option}
            onPress={() => onSelect(option)}
            columns={columns}
          />
        ))}
      </View>
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
  columns,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  columns: 2 | 3;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionButton,
        columns === 2 ? styles.twoColumn : styles.threeColumn,
        selected && styles.optionButtonActive,
      ]}
    >
      <Text
        numberOfLines={2}
        style={[styles.optionText, selected && styles.optionTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  header: {
    minHeight: 198,
    backgroundColor: "#DFF1EA",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
    overflow: "hidden",
  },
  headerImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    // left: 0,
    width: "155%",
    height: "100%",
    // transform: [{ translateX: 18 }, { translateY: -10 }, { scale: 1.14 }],
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // backgroundColor: "rgba(244, 251, 247, 0.32)",
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
  logoutButton: { backgroundColor: "#087568" },
  headerCopy: {
    width: "62%",
    maxWidth: 250,
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    // backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  eyebrow: {
    color: "#55718A",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  title: {
    color: "#0F172A",
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
    marginTop: 1,
  },
  boothTitle: {
    color: "#087568",
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  location: { color: "#087568", fontSize: 12, fontWeight: "900", flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    marginTop: -20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F4FBF7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  content: { paddingBottom: 34, gap: 14 },
  scopeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    padding: 14,
    shadowColor: "#718096",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  scopeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fieldWrap: { width: "100%", gap: 6 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "900" },
  dropdownField: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C5D5E6",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  dropdownText: { flex: 1, color: "#1E293B", fontSize: 14, fontWeight: "700" },
  scopeLoader: { alignSelf: "flex-start", marginTop: -2 },
  section: { gap: 9 },
  sectionTitle: { color: "#334155", fontSize: 14, fontWeight: "900" },
  hint: { color: "#94A3B8", fontWeight: "700" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  optionButtonActive: { backgroundColor: "#064E3B", borderColor: "#064E3B" },
  twoColumn: { width: "48.7%" },
  threeColumn: { width: "31.8%" },
  optionText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  optionTextActive: { color: "#FFFFFF" },
  partyText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#064E3B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 3,
  },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  reportButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#087568",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  reportText: { color: "#087568", fontSize: 14, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
  error: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    color: "#9A3412",
    fontWeight: "700",
  },
  success: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    color: "#047857",
    fontWeight: "800",
  },
  logoutChoiceOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logoutChoiceBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
  },
  logoutChoicePanel: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 18,
    paddingTop: 18,
    gap: 10,
  },
  logoutChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  logoutChoiceClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutChoiceTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  logoutChoiceMessage: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    marginBottom: 4,
  },
  logoutChoiceActions: {
    flexDirection: "row",
    gap: 10,
  },
  voterChoiceButton: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  voterChoiceText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  logoutConfirmButton: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  logoutConfirmText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.46)",
    justifyContent: "flex-end",
  },
  dropdownSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 6,
  },
  dropdownTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  dropdownOption: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownOptionActive: { backgroundColor: "#EAF7F2", borderColor: "#087568" },
  dropdownOptionText: { color: "#475569", fontSize: 14, fontWeight: "900" },
  dropdownOptionTextActive: { color: "#064E3B" },
});
