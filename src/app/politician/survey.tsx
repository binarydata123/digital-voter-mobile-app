import { Shimmer } from "@/components/common/Shimmer";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FileText,
  GraduationCap,
  LogOut,
  MapPin,
  Menu,
  RotateCcw,
  UserRound,
  WalletCards,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchSurveyPoliticianOptions,
  fetchSurveyWardOptions,
  getAssignedSurveyScope,
  saveSurveyResponse,
  type SurveyPoliticianOption,
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
// These values are persisted directly and must match the backend enum.
const INCOME = ["< ₹15k", "₹15k–35k", "₹35k–75k", "₹75k+"];
const OCCUPATIONS = [
  "Private Job / Staff",
  "State Government",
  "Central / Army",
  "Business / Trader",
  "Farmer / Agriculture",
  "Daily Wage / Labour",
  "Homemaker",
  "Student",
  "Unemployed",
];
const CONCERNS = [
  "Roads / Infrastructure",
  "Public Safety / Crime",
  "Healthcare / Hospitals",
  "Cost of Living / Inflation",
  "Education / Schools",
  "Jobs / Employment",
  "Business / Economic Development",
  "Water / Sanitation / Utilities",
  "Electricity / Power Supply",
  "Agriculture / Farmers",
  "Housing / Land",
  "Public Transport / Traffic",
  "Women / Child Welfare",
  "Youth / Skills / Opportunities",
  "Environment / Pollution",
  "Government Services / Administration",
  "Corruption / Transparency",
  "Social Welfare / Pensions",
  "Drug Abuse / Addiction",
  "Rural Development",
  "Urban Development",
  "Digital Connectivity / Internet",
  "Other",
];
const ELECTION_TYPES = [
  "Lok Sabha",
  "Vidhan Sabha",
  "Rajya Sabha",
  "Vidhan Parishad",
  "Municipal Corporation",
  "Municipal Council",
  "Nagar Panchayat",
  "Gram Panchayat",
  "Panchayat Samiti",
  "Zila Parishad",
  "Other",
];

function isConstituencyElection(electionType: string) {
  return electionType === "Lok Sabha" || electionType === "Vidhan Sabha";
}

// Keep this identical to the Next.js survey: two previous years, the current
// year, and the next nine years. An assigned year is retained even if it falls
// outside that range.
function getElectionYearOptions(selectedYear?: string) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, index) =>
    String(currentYear - 2 + index),
  );

  if (selectedYear && !years.includes(selectedYear)) {
    years.push(selectedYear);
  }

  return Array.from(new Set(years)).sort(
    (first, second) => Number(second) - Number(first),
  );
}

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

function getScopeLabel(field: ScopeField, electionType: string) {
  if (field !== "district") return scopeLabels[field];
  if (electionType === "Lok Sabha") return "Lok Sabha constituency *";
  if (electionType === "Vidhan Sabha") return "Vidhan Sabha constituency *";
  return "Constituency / District *";
}

export default function SurveyScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const requiredViews = useRef<Record<string, View | null>>({});
  const [missingField, setMissingField] = useState<string | null>(null);
  const scrollToMissingField = useCallback(() => {
    const target = missingField ? requiredViews.current[missingField] : null;
    if (target && contentRef.current) {
      target.measureLayout(contentRef.current, (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }, () => {});
    }
  }, [missingField]);
  useEffect(() => {
    if (missingField) requestAnimationFrame(scrollToMissingField);
  }, [missingField, scrollToMissingField]);
  const [scope, setScope] = useState<SurveyScope>(() =>
    buildAssignedSurveyScope(),
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeDropdown, setActiveDropdown] = useState<ScopeField | null>(null);
  const [loadingScope, setLoadingScope] = useState(true);
  const [saving, setSaving] = useState(false);
  const [politicianOptions, setPoliticianOptions] = useState<
    SurveyPoliticianOption[]
  >([]);
  const [loadingPoliticians, setLoadingPoliticians] = useState(false);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);

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
  const canOpenTemplates = hasPoliticianPageAccess("template", currentUser);
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
      electionType: uniqueValues(scope.electionType, ...ELECTION_TYPES),
      electionYear: getElectionYearOptions(scope.electionYear),
      state: uniqueValues(scope.state),
      district: uniqueValues(scope.district),
      city: uniqueValues(scope.city),
      wardNo: uniqueValues(...wardOptions, scope.wardNo).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      ),
    }),
    [scope, wardOptions],
  );

  const constituencyElection = isConstituencyElection(scope.electionType);
  const visibleScopeFields = useMemo<ScopeField[]>(
    () => [
      "electionType",
      "electionYear",
      "state",
      "district",
      ...(constituencyElection ? [] : ["city" as const]),
    ],
    [constituencyElection],
  );
  const politicianLocationReady = Boolean(
    scope.electionType &&
    scope.state &&
    scope.district &&
    (constituencyElection || scope.city),
  );

  useEffect(() => {
    if (!constituencyElection || !scope.state || !scope.district) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoadingWards(true);
      fetchSurveyWardOptions({ state: scope.state, district: scope.district })
        .then((options) => {
          if (active) setWardOptions(options);
        })
        .catch(() => {
          if (active) setWardOptions([]);
        })
        .finally(() => {
          if (active) setLoadingWards(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [constituencyElection, scope.district, scope.state]);

  useEffect(() => {
    if (!politicianLocationReady) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoadingPoliticians(true);
      fetchSurveyPoliticianOptions({
        electionType: scope.electionType,
        state: scope.state,
        district: scope.district,
        city: constituencyElection ? "" : scope.city,
        wardNo: constituencyElection ? scope.wardNo : "",
      })
        .then((options) => {
          if (active) setPoliticianOptions(options);
        })
        .catch((loadError: any) => {
          if (active) {
            setPoliticianOptions([]);
            setError(
              loadError?.response?.data?.message ??
                loadError?.message ??
                "Could not load politicians.",
            );
          }
        })
        .finally(() => {
          if (active) setLoadingPoliticians(false);
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    constituencyElection,
    politicianLocationReady,
    scope.city,
    scope.district,
    scope.electionType,
    scope.state,
    scope.wardNo,
  ]);

  function updateScope(field: ScopeField, value: string) {
    setMissingField(null);
    setMessage("");
    setError("");
    setScope((current) => {
      if (field !== "electionType") return { ...current, [field]: value };

      const nextIsConstituency = isConstituencyElection(value);
      return {
        ...current,
        electionType: value,
        city: nextIsConstituency ? "" : current.city || currentUser?.city || "",
        wardNo: nextIsConstituency
          ? current.wardNo || currentUser?.ward || ""
          : "",
      };
    });
    setForm((current) => ({
      ...current,
      preferredPolitician: "",
      preferredParty: "",
    }));
    setActiveDropdown(null);
  }

  const setSingle = useCallback((field: keyof FormState, value: string) => {
    setMissingField(null);
    setMessage("");
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const toggleConcern = useCallback((issue: string) => {
    setMissingField(null);
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      issues: current.issues.includes(issue)
        ? current.issues.filter((item) => item !== issue)
        : [...current.issues, issue],
    }));
  }, []);

  function choosePolitician(option: SurveyPoliticianOption) {
    setMissingField(null);
    setMessage("");
    setError("");
    setForm((current) => ({
      ...current,
      preferredPolitician: option.name,
      preferredParty: option.party,
    }));
  }

  function validate() {
    if (
      !scope.electionType ||
      !scope.electionYear ||
      !scope.state ||
      !scope.district ||
      (!constituencyElection && !scope.city) ||
      (constituencyElection && !scope.wardNo)
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

  function resetForm() {
    if (saving) return;
    setForm({ ...emptyForm, issues: [] });
    setMissingField(null);
    setMessage("");
    setError("");
    setActiveDropdown(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      const firstMissingScope = visibleScopeFields.find((field) => !scope[field]);
      const firstMissingProfile = (["gender", "ageBracket", "education", "incomeBracket", "occupation"] as const)
        .find((field) => !form[field]);
      const firstMissing = firstMissingScope
        ?? (constituencyElection && !scope.wardNo ? "wardNo" : null)
        ?? firstMissingProfile
        ?? (!form.issues.length ? "issues" : "preferredPolitician");
      setMissingField(firstMissing);
      setError(validationError);
      requestAnimationFrame(() => {
        const target = requiredViews.current[firstMissing];
        if (target && contentRef.current) {
          target.measureLayout(contentRef.current, (_x, y) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
          }, () => {});
        }
      });
      return;
    }

    setSaving(true);
    try {
      await saveSurveyResponse({ ...scope, ...form });
      setMissingField(null);
      setForm(emptyForm);
      setMessage("Survey response saved.");
      setError("");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
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

  function confirmLogout() {
    logoutPolitician();
    router.replace("/login");
  }

  function openVoterPage() {
    if (canOpenVoters) {
      router.push("/politician/voters");
    }
  }

  function openTemplatePage() {
    if (canOpenTemplates) {
      router.push("/politician/templates");
    }
  }

  function openSurveyReport() {
    // The report must use the exact location selected in this survey form.
    // Passing it through the route avoids falling back to an empty assigned
    // ward on the report screen.
    router.push({
      pathname: "/politician/survey-report",
      params: {
        ...scope,
        city: constituencyElection ? "" : scope.city,
        wardNo: "",
      },
    });
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
              accessibilityRole="button"
              accessibilityLabel="Reset survey answers"
              disabled={saving || loadingScope}
              onPress={resetForm}
              style={[styles.headerIconButton, (saving || loadingScope) && styles.disabledButton]}
            >
              <RotateCcw color="#087568" size={18} strokeWidth={2.8} />
            </Pressable>
            <Pressable
              accessibilityLabel="Survey report"
              onPress={openSurveyReport}
              style={styles.headerIconButton}
            >
              <BarChart3 color="#0F766E" size={18} strokeWidth={2.8} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open survey menu"
              onPress={() => setMenuVisible(true)}
              style={[styles.headerIconButton, styles.logoutButton]}
            >
              <Menu color="#FFFFFF" size={21} strokeWidth={2.8} />
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
          ref={scrollRef}
          onContentSizeChange={scrollToMissingField}
          showsVerticalScrollIndicator={false}
        >
          <View ref={contentRef} collapsable={false} style={styles.content}>
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <View style={styles.scopeCard}>
            <View style={styles.scopeGrid}>
              {visibleScopeFields.map((field) => (
                <DropdownField
                  key={field}
                  label={getScopeLabel(field, scope.electionType)}
                  value={scope[field]}
                  onPress={() => setActiveDropdown(field)}
                  missing={missingField === field}
                  fieldRef={(view) => { requiredViews.current[field] = view; }}
                />
              ))}
            </View>
          </View>

          {constituencyElection ? (
            <View ref={(view) => { requiredViews.current.wardNo = view; }} collapsable={false} style={[styles.section, missingField === "wardNo" && styles.missingSection]}>
              <Text style={styles.sectionTitle}>Ward No. *</Text>
              {loadingScope || loadingWards ? <OptionSkeleton label="Loading wards" /> : null}
              {!loadingScope && !loadingWards && scopeOptions.wardNo.length ? (
                <View style={styles.optionGrid}>
                  {scopeOptions.wardNo.map((ward) => (
                    <OptionButton
                      key={ward}
                      label={
                        ward.toLowerCase().startsWith("ward")
                          ? ward
                          : `Ward ${ward}`
                      }
                      selected={scope.wardNo === ward}
                      onPress={() => updateScope("wardNo", ward)}
                      columns={2}
                    />
                  ))}
                </View>
              ) : null}
              {!loadingScope && !loadingWards && !scopeOptions.wardNo.length ? (
                <Text style={styles.politicianHint}>
                  No ward options are available for this constituency.
                </Text>
              ) : null}
            </View>
          ) : null}

          {loadingScope ? (
            <ActivityIndicator color="#0F766E" style={styles.scopeLoader} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View ref={(view) => { requiredViews.current.gender = view; }} collapsable={false} style={missingField === "gender" && styles.missingSection}>
          <OptionSection
            title="Gender"
            options={GENDERS}
            value={form.gender}
            field="gender"
            onSelect={setSingle}
            columns={3}
            icon={UserRound}
          />
          </View>
          <View ref={(view) => { requiredViews.current.ageBracket = view; }} collapsable={false} style={missingField === "ageBracket" && styles.missingSection}>
          <OptionSection
            title="Age bracket"
            options={AGE_BRACKETS}
            value={form.ageBracket}
            field="ageBracket"
            onSelect={setSingle}
            columns={4}
            icon={CalendarDays}
          />
          </View>
          <View ref={(view) => { requiredViews.current.education = view; }} collapsable={false} style={missingField === "education" && styles.missingSection}>
          <OptionSection
            title="Education"
            options={EDUCATION}
            value={form.education}
            field="education"
            onSelect={setSingle}
            columns={2}
            icon={GraduationCap}
          />
          </View>
          <View ref={(view) => { requiredViews.current.incomeBracket = view; }} collapsable={false} style={missingField === "incomeBracket" && styles.missingSection}>
          <OptionSection
            title="Monthly household income"
            options={INCOME}
            value={form.incomeBracket}
            field="incomeBracket"
            onSelect={setSingle}
            columns={2}
            icon={WalletCards}
          />
          </View>
          <View ref={(view) => { requiredViews.current.occupation = view; }} collapsable={false} style={missingField === "occupation" && styles.missingSection}>
          <OptionSection
            title="Occupation"
            options={OCCUPATIONS}
            value={form.occupation}
            field="occupation"
            onSelect={setSingle}
            columns={2}
            icon={BriefcaseBusiness}
          />
          </View>

          <View ref={(view) => { requiredViews.current.issues = view; }} collapsable={false} style={missingField === "issues" && styles.missingSection}>
            <ConcernSection issues={form.issues} onToggle={toggleConcern} />
          </View>

          <View ref={(view) => { requiredViews.current.preferredPolitician = view; }} collapsable={false} style={[styles.section, missingField === "preferredPolitician" && styles.missingSection]}>
            <Text style={styles.sectionTitle}>Likely preferred politician</Text>
            <View style={styles.optionGrid}>
              {loadingScope || (politicianLocationReady && loadingPoliticians) ? <OptionSkeleton label="Loading politicians" detail /> : null}
              {!loadingScope && !politicianLocationReady ? (
                <Text style={styles.politicianHint}>
                  Select a valid survey location to load active politicians.
                </Text>
              ) : null}
              {politicianLocationReady &&
              !loadingScope && !loadingPoliticians &&
              politicianOptions.length === 0 ? (
                <Text style={styles.politicianHint}>
                  No active politicians are available for this location.
                </Text>
              ) : null}
              {politicianLocationReady &&
                !loadingScope && !loadingPoliticians &&
                politicianOptions.map((candidate) => (
                  <Pressable
                    key={candidate.id}
                    onPress={() => choosePolitician(candidate)}
                    style={[
                      styles.optionButton,
                      styles.twoColumn,
                      styles.politicianOption,
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

          {/* <Pressable
            onPress={openSurveyReport}
            style={styles.reportButton}>
            <ClipboardList color="#087568" size={17} strokeWidth={2.7} />
            <Text style={styles.reportText}>View report</Text>
          </Pressable> */}
          </View>
        </ScrollView>
      </View>

      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.menuDrawer}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.menuHandle} />
            {canOpenVoters ? (
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  openVoterPage();
                }}
                style={styles.menuRow}
              >
                <View style={styles.menuIconWrap}>
                  <ClipboardList color="#087568" size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuRowTitle}>Open voter page</Text>
                  <Text style={styles.menuRowSubtitle}>
                    Manage voter records
                  </Text>
                </View>
              </Pressable>
            ) : null}
            {canOpenTemplates ? (
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  openTemplatePage();
                }}
                style={styles.menuRow}
              >
                <View style={styles.menuIconWrap}>
                  <FileText color="#087568" size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuRowTitle}>Open template page</Text>
                  <Text style={styles.menuRowSubtitle}>
                    Build voter templates
                  </Text>
                </View>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                confirmLogout();
              }}
              style={[styles.menuRow, styles.logoutMenuRow]}
            >
              <View style={[styles.menuIconWrap, styles.logoutMenuIconWrap]}>
                <LogOut color="#B91C1C" size={20} strokeWidth={2.6} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.logoutMenuTitle}>Logout</Text>
                <Text style={styles.menuRowSubtitle}>
                  Sign out from this device
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
                {getScopeLabel(activeDropdown, scope.electionType)}
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

function OptionSkeleton({ label, detail = false }: { label: string; detail?: boolean }) {
  return <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} style={[styles.optionGrid, { width: "100%" }]}>
    {[0, 1, 2, 3].map((index) => <Shimmer key={index} style={[styles.optionSkeleton, detail && { minHeight: 60 }]}>
      <View style={{ height: 10, width: "65%", borderRadius: 5, backgroundColor: "#B4DCD0" }} />
      {detail ? <View style={{ height: 8, width: "40%", borderRadius: 4, backgroundColor: "#C8E6DC" }} /> : null}
    </Shimmer>)}
  </View>;
}

function uniqueValues(...values: string[]) {
  const unique = values.map((value) => value.trim()).filter(Boolean);
  return unique.length ? Array.from(new Set(unique)) : [""];
}

function DropdownField({
  fullWidth = false,
  label,
  value,
  onPress,
  missing,
  fieldRef,
}: {
  fullWidth?: boolean;
  label: string;
  value: string;
  onPress: () => void;
  missing?: boolean;
  fieldRef?: (view: View | null) => void;
}) {
  return (
    <View ref={fieldRef} collapsable={false} style={[styles.fieldWrap, fullWidth && styles.fullFieldWrap, missing && styles.missingSection]}>
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

const OptionSection = memo(function OptionSection({
  title,
  options,
  value,
  onSelect,
  field,
  columns,
  icon,
}: {
  title: string;
  options: string[];
  value: string;
  onSelect: (field: keyof FormState, value: string) => void;
  field: keyof FormState;
  columns: 2 | 3 | 4;
  icon?: LucideIcon;
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
            onPress={() => onSelect(field, option)}
            columns={columns}
            icon={icon}
          />
        ))}
      </View>
    </View>
  );
});

const ConcernSection = memo(function ConcernSection({
  issues,
  onToggle,
}: {
  issues: string[];
  onToggle: (issue: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Major concerns <Text style={styles.hint}>(choose one or more)</Text>
      </Text>
      <View style={styles.optionGrid}>
        {CONCERNS.map((issue) => (
          <OptionButton
            key={issue}
            label={issue}
            selected={issues.includes(issue)}
            onPress={() => onToggle(issue)}
            columns={2}
            icon={CircleAlert}
          />
        ))}
      </View>
    </View>
  );
});

const OptionButton = memo(function OptionButton({
  label,
  selected,
  onPress,
  columns,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  columns: 2 | 3 | 4;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionButton,
        Icon && styles.iconOptionButton,
        columns === 4
          ? styles.fourColumn
          : columns === 2
            ? styles.twoColumn
            : styles.threeColumn,
        selected && styles.optionButtonActive,
      ]}
    >
      <OptionContent label={label} selected={selected} icon={Icon} />
    </Pressable>
  );
});

const OptionContent = memo(function OptionContent({
  label,
  selected,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  icon?: LucideIcon;
}) {
  return (
    <>
      {Icon ? (
        <Icon
          color={selected ? "#FFFFFF" : "#087568"}
          size={15}
          strokeWidth={2.7}
        />
      ) : null}
      <Text
        numberOfLines={2}
        style={[styles.optionText, Icon && styles.iconOptionText, selected && styles.optionTextActive]}
      >
        {label === "< ₹15k" ? "Below ₹15k" : label}
      </Text>
    </>
  );
});

const styles = StyleSheet.create({
  optionSkeleton: { width: "48.7%", minHeight: 44, borderRadius: 14, backgroundColor: "#E3F2EC", alignItems: "center", justifyContent: "center", gap: 8 },
  missingSection: { borderWidth: 1, borderColor: "#DC2626", borderRadius: 14, padding: 6 },
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  menuDrawer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 32,
  },
  menuHandle: {
    alignSelf: "center",
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  menuRow: {
    alignItems: "center",
    borderBottomColor: "#EEF2F7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 66,
    paddingVertical: 10,
  },
  menuIconWrap: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuRowTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  menuRowSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  logoutMenuRow: { borderBottomWidth: 0, marginTop: 4 },
  logoutMenuIconWrap: { backgroundColor: "#FEF2F2" },
  logoutMenuTitle: { color: "#B91C1C", fontSize: 14, fontWeight: "900" },
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
  scopeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  fieldWrap: { width: "47.8%", gap: 6 },
  fullFieldWrap: { width: "100%" },
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
  wardLoader: { alignSelf: "flex-start", marginVertical: 6 },
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
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  iconOptionButton: { justifyContent: "flex-start", paddingHorizontal: 12, gap: 8 },
  iconOptionText: { textAlign: "left" },
  optionButtonActive: { backgroundColor: "#064E3B", borderColor: "#064E3B" },
  politicianOption: {
    flexDirection: "column",
    minHeight: 60,
    gap: 2,
  },
  twoColumn: { width: "48.7%" },
  threeColumn: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  fourColumn: { width: "23.2%" },
  optionText: {
    flexShrink: 1,
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
  politicianHint: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 8,
  },
  politicianLoader: { alignSelf: "flex-start", marginVertical: 8 },
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
