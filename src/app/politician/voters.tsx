import { Image } from "expo-image";
import { router } from "expo-router";
import {
  LogOut,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  type ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { VoterCard } from "@/features/voters/components/VoterCard";
import { VoterDataSetup } from "@/features/voters/components/VoterDataSetup";
import { VoterListSkeleton } from "@/features/voters/components/VoterListSkeleton";

import {
  shareVoterSlipPdf,
  VoterSlipPreview,
} from "@/features/voters/components/VoterSlipPreview";
import {
  ensureAuthSession,
  getCurrentUser,
  getDefaultPoliticianRoute,
  hasPoliticianPageAccess,
  logoutPolitician,
} from "@/services/authentication";
import {
  getLocalVoters,
  hasLocalVoters,
  replaceLocalVoters,
} from "@/services/local-voters";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import { buildVoterStats, fetchVoters, type Voter } from "@/services/voters";

type PrintScope = "single" | "family";
type SlipPreviewRequest = {
  voter: Voter;
  scope: PrintScope;
  withBanner: boolean;
};
type PrintTypeRequest = { voter: Voter; scope: PrintScope };

export default function VotersScreen() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [query, setQuery] = useState("");
  const [activeBooth, setActiveBooth] = useState("All");
  const [pendingBooth, setPendingBooth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [slipPreview, setSlipPreview] = useState<SlipPreviewRequest | null>(
    null,
  );
  const [printTypeRequest, setPrintTypeRequest] =
    useState<PrintTypeRequest | null>(null);
  const [logoutChoiceVisible, setLogoutChoiceVisible] = useState(false);
  const boothSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUser = getCurrentUser();
  const canOpenSurvey = hasPoliticianPageAccess("survey", currentUser);
  const canUseTemplates = hasPoliticianPageAccess("template", currentUser);

  const loadVoters = useCallback(async () => {
    if (currentUser && !hasPoliticianPageAccess("voters", currentUser)) {
      const nextRoute = getDefaultPoliticianRoute(currentUser);
      router.replace(nextRoute ?? "/login");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const session = await ensureAuthSession();
      const currentPoliticianId = session.user?.id ?? null;

      if (isLocalVoterDatabaseAvailable() && currentPoliticianId) {
        if (await hasLocalVoters(currentPoliticianId)) {
          const localVoters = await getLocalVoters(currentPoliticianId);
          setVoters(localVoters);
          setError("");
          return;
        }

        const downloadedVoters = await fetchVoters();
        await replaceLocalVoters(currentPoliticianId, downloadedVoters);
        const localVoters = await getLocalVoters(currentPoliticianId);
        setVoters(localVoters);
        setError("");
        return;
      }

      const list = await fetchVoters();
      setVoters(list);
      setError("");
    } catch (loadError: any) {
      if (loadError?.message === "Please sign in again to continue.") {
        await logoutPolitician();
        router.replace("/login");
        return;
      }
      setVoters([]);
      setError(loadError?.message ?? "Unable to load voters from the backend.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadVoters();
  }, [loadVoters]);

  useEffect(
    () => () => {
      if (boothSwitchTimer.current) {
        clearTimeout(boothSwitchTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!pendingBooth || pendingBooth !== activeBooth) {
      return;
    }

    const frame = requestAnimationFrame(() => setPendingBooth(null));
    return () => cancelAnimationFrame(frame);
  }, [activeBooth, pendingBooth]);

  const refreshAllVoterData = useCallback(async () => {
    setActiveBooth("All");
    setQuery("");
    setLoading(true);
    try {
      const session = await ensureAuthSession();
      const downloadedVoters = await fetchVoters();
      const currentPoliticianId = session.user?.id ?? null;

      if (isLocalVoterDatabaseAvailable() && currentPoliticianId) {
        await replaceLocalVoters(currentPoliticianId, downloadedVoters);
        setVoters(await getLocalVoters(currentPoliticianId));
      } else {
        setVoters(downloadedVoters);
      }

      setError("");
    } catch (refreshError: any) {
      if (refreshError?.message === "Please sign in again to continue.") {
        await logoutPolitician();
        router.replace("/login");
        return;
      }
      setError(refreshError?.message ?? "Unable to refresh voter data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const booths = useMemo(
    () => ["All", ...Array.from(new Set(voters.map((voter) => voter.booth)))],
    [voters],
  );
  const stats = useMemo(() => buildVoterStats(voters), [voters]);

  // Count per booth tab (All = total, others = boothCounts[booth] or 0)
  const boothCounts = useMemo(() => {
    const counts: Record<string, number> = { All: stats.total };
    booths.forEach((booth) => {
      if (booth === "All") return;
      counts[booth] = stats.boothCounts[booth] ?? 0;
    });
    return counts;
  }, [booths, stats]);

  const filteredVoters = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return voters.filter((voter) => {
      const boothMatch = activeBooth === "All" || voter.booth === activeBooth;
      const queryMatch =
        !lowered ||
        voter.name.toLowerCase().includes(lowered) ||
        voter.epicNo.toLowerCase().includes(lowered) ||
        (voter.serialNo ?? "").toLowerCase().includes(lowered);
      return boothMatch && queryMatch;
    });
  }, [activeBooth, query, voters]);

  const selectBooth = useCallback(
    (booth: string) => {
      if (booth === activeBooth && !pendingBooth) {
        return;
      }

      if (boothSwitchTimer.current) {
        clearTimeout(boothSwitchTimer.current);
      }

      setPendingBooth(booth);
      boothSwitchTimer.current = setTimeout(() => {
        boothSwitchTimer.current = null;
        setActiveBooth(booth);
      }, 0);
    },
    [activeBooth, pendingBooth],
  );

  function handleLogout() {
    setLogoutChoiceVisible(true);
  }

  async function confirmLogout() {
    setLogoutChoiceVisible(false);
    await logoutPolitician();
    router.replace("/login");
  }

  function openSurveyPage() {
    if (canOpenSurvey) {
      setLogoutChoiceVisible(false);
      router.push("/politician/survey");
    }
  }

  const handlePrint = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "single" });
  }, []);

  const handleFamily = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "family" });
  }, []);

  const handleShareVoterSlip = useCallback(
    async (voter: Voter) => {
      await shareVoterSlipPdf(
        voter,
        canUseTemplates,
        currentUser?.bannerImage,
        voter.whatsappNumber || voter.mobileNumber,
      );
    },
    [canUseTemplates, currentUser?.bannerImage],
  );

  const renderVoter = useCallback(
    ({ item }: ListRenderItemInfo<Voter>) => (
      <VoterCard
        voter={item}
        onPrint={handlePrint}
        onFamily={handleFamily}
        onShare={handleShareVoterSlip}
      />
    ),
    [handleFamily, handlePrint, handleShareVoterSlip],
  );

  function openSlipPreview(withBanner: boolean) {
    if (!printTypeRequest) return;
    setSlipPreview({ ...printTypeRequest, withBanner });
    setPrintTypeRequest(null);
  }

  function handleDownloadSlip() {
    Alert.alert(
      "Download",
      "Slip download will be connected to the print image exporter.",
    );
  }

  function handlePrintSlip() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.print();
      return;
    }
    Alert.alert("Print", "Thermal printer integration will print this slip.");
  }

  if (loading) {
    return <VoterDataSetup />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <Image
          source={require("../../../assets/images/vote.jpeg")}
          style={styles.headerImage}
          contentFit="cover"
          transition={120}
        />
        <View style={styles.headerOverlay} />

        <View style={styles.headerTop}>
          <View />
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Refresh offline voter data"
              onPress={refreshAllVoterData}
              disabled={loading}
              style={[
                styles.headerIconButton,
                loading && styles.headerIconButtonDisabled,
              ]}
            >
              <RefreshCw color="#0F766E" size={18} strokeWidth={2.8} />
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

        {/* Title block starts on next line (not beside back arrow) */}
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>VOTER LIST</Text>
          <Text style={styles.title}>Ward-14</Text>
          <Text style={styles.boothTitle}>Booth-1, 2</Text>
          <View style={styles.locationRow}>
            <MapPin color="#087568" size={14} strokeWidth={2.8} />
            <Text style={styles.location}>Ganganagar, Rajasthan</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search color="#94A3B8" size={18} strokeWidth={2.6} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, EPIC No. or Serial No."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          <Pressable
            style={styles.filterButton}
            onPress={() => setModalVisible(true)}
          >
            <SlidersHorizontal color="#FFFFFF" size={15} strokeWidth={2.8} />
            <Text style={styles.filterButtonText}>Filter</Text>
          </Pressable>
        </View>

        <FlatList
          data={pendingBooth ? [] : filteredVoters}
          keyExtractor={(item) => item.id}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {error ? <Text style={styles.warning}>{error}</Text> : null}

              {/* Total Voters card with Users icon */}
              {/* <Pressable
                onPress={() => setModalVisible(true)}
                style={styles.totalCard}
              >
                <View style={styles.totalCardLeft}>
                  <View style={styles.totalIconWrap}>
                    <UsersRound color="#087568" size={22} strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>Total Voters</Text>
                    <Text style={styles.totalValue}>{stats.total}</Text>
                  </View>
                </View>
                <Info color="#0F766E" size={20} strokeWidth={2.5} />
              </Pressable> */}

              {/* Booth tabs with counts */}
              <View style={styles.boothTabsWrap}>
                <FlatList
                  horizontal
                  data={booths}
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.boothTabs}
                  renderItem={({ item }) => {
                    const isActive = activeBooth === item;
                    const label = item === "All" ? "All Voters" : item;
                    const count = boothCounts[item] ?? 0;
                    return (
                      <Pressable
                        onPress={() => selectBooth(item)}
                        style={[
                          styles.boothTab,
                          isActive && styles.boothTabActive,
                        ]}
                      >
                        {item === "All" ? (
                          <UsersRound
                            color={isActive ? "#FFFFFF" : "#087568"}
                            size={16}
                            strokeWidth={2.6}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.boothTabText,
                            isActive && styles.boothTabTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                        <View
                          style={[
                            styles.countBadge,
                            isActive && styles.countBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.countBadgeText,
                              isActive && styles.countBadgeTextActive,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </>
          }
          ListEmptyComponent={
            pendingBooth ? (
              <VoterListSkeleton />
            ) : (
              <EmptyState
                title="No voters found"
                message="Try a different name, EPIC number, or booth."
              />
            )
          }
          renderItem={renderVoter}
        />

        {/* <Pressable
          accessibilityLabel="Open booth filter"
          onPress={() => setModalVisible(true)}
          style={styles.boothFilterHandleButton}
        >
          <View style={styles.boothFilterHandle} />
        </Pressable> */}
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
              {canOpenSurvey
                ? "Open the survey page or confirm logout from this account."
                : "Confirm logout from this account."}
            </Text>

            <View style={styles.logoutChoiceActions}>
              {canOpenSurvey ? (
                <Pressable
                  onPress={openSurveyPage}
                  style={styles.surveyChoiceButton}
                >
                  <Text style={styles.surveyChoiceText}>Open Survey Page</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={confirmLogout}
                style={styles.logoutConfirmButton}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Print type modal */}
      <Modal
        transparent
        visible={Boolean(printTypeRequest)}
        animationType="fade"
        onRequestClose={() => setPrintTypeRequest(null)}
      >
        {printTypeRequest ? (
          <Pressable
            style={styles.printChoiceBackdrop}
            onPress={() => setPrintTypeRequest(null)}
          >
            <Pressable style={styles.printChoicePanel}>
              <View style={styles.printChoiceHeader}>
                <Text style={styles.printChoiceTitle}>
                  {printTypeRequest.scope === "family"
                    ? "Select Family Print Type"
                    : "Select Voter Slip Print Type"}
                </Text>
                <Pressable
                  accessibilityLabel="Close print type"
                  onPress={() => setPrintTypeRequest(null)}
                  style={styles.printChoiceClose}
                >
                  <Text style={styles.printChoiceCloseText}>x</Text>
                </Pressable>
              </View>

              {canUseTemplates ? (
                <PrintChoiceRow
                  icon={
                    printTypeRequest.scope === "family"
                      ? "family-print"
                      : "print"
                  }
                  title={
                    printTypeRequest.scope === "family"
                      ? "Print Family Members with Banner"
                      : "Print Voter Slip with Banner"
                  }
                  subtitle={
                    printTypeRequest.scope === "family"
                      ? "Family member slips with banner."
                      : "Voter slip with banner image."
                  }
                  onPress={() => openSlipPreview(true)}
                />
              ) : null}
              <PrintChoiceRow
                icon={printTypeRequest.scope === "family" ? "family" : "print"}
                title={
                  printTypeRequest.scope === "family"
                    ? "Print Family Members without Banner"
                    : "Print Voter Slip without Banner"
                }
                subtitle={
                  printTypeRequest.scope === "family"
                    ? "Family member slips."
                    : "Voter slip only."
                }
                onPress={() => openSlipPreview(false)}
              />
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>

      {/* Slip preview modal */}
      <Modal
        transparent
        visible={Boolean(slipPreview)}
        animationType="fade"
        onRequestClose={() => setSlipPreview(null)}
      >
        {slipPreview ? (
          <VoterSlipPreview
            voter={slipPreview.voter}
            onClose={() => setSlipPreview(null)}
            showBanner={slipPreview.withBanner}
            bannerImage={getCurrentUser()?.bannerImage}
            onDownload={handleDownloadSlip}
            onPrint={handlePrintSlip}
          />
        ) : null}
      </Modal>

      {/* Booth wise modal */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Booth Wise Voters</Text>
            <View style={styles.modalGrid}>
              {Object.entries(stats.boothCounts).map(([booth, count]) => (
                <Pressable
                  key={booth}
                  onPress={() => {
                    selectBooth(booth);
                    setModalVisible(false);
                  }}
                  style={styles.modalCard}
                >
                  <Text style={styles.modalCardLabel}>{booth}</Text>
                  <Text style={styles.modalCardValue}>{count}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PrintChoiceRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: "print" | "family" | "family-print";
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const isFamily = icon !== "print";

  return (
    <Pressable onPress={onPress} style={styles.printChoiceRow}>
      <View style={styles.printChoiceIcon}>
        {isFamily ? (
          <UsersRound color="#087568" size={22} strokeWidth={2.5} />
        ) : (
          <Printer color="#087568" size={22} strokeWidth={2.5} />
        )}
      </View>
      <View style={styles.printChoiceCopy}>
        <Text style={styles.printChoiceRowTitle}>{title}</Text>
        <Text style={styles.printChoiceSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },

  /* ---------- Header ---------- */
  header: {
    minHeight: 190,
    backgroundColor: "#E6F4EA",

    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    overflow: "hidden",
  },
  headerImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "155%",
    height: "100%",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // backgroundColor: "rgba(232, 248, 245, 0.20)",
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
  headerIconButtonDisabled: { opacity: 0.62 },
  logoutButton: { backgroundColor: "#087568" },
  headerCopy: { marginTop: 2 },
  eyebrow: {
    color: "#55718A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  title: {
    color: "#0F172A",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 2,
  },
  boothTitle: {
    color: "#087568",
    fontSize: 23,
    lineHeight: 27,
    fontWeight: "900",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  location: { color: "#087568", fontSize: 13, fontWeight: "900" },

  /* ---------- Body ---------- */
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    marginTop: -24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F4FBF7",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 4,
  },
  warning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    color: "#9A3412",
    padding: 10,
    borderRadius: 12,
    fontWeight: "700",
    marginBottom: 10,
  },

  /* Total voters card */
  totalCard: {
    backgroundColor: "#EAF7F2",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D6EFE3",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  totalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#D6EFE3",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { color: "#64748B", fontWeight: "800", fontSize: 12 },
  totalValue: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 26,
    marginTop: 2,
  },

  /* Search */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 5,
  },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontWeight: "700",
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  filterButton: {
    height: 40,
    borderRadius: 14,
    backgroundColor: "#064E3B",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },

  /* Booth tabs */
  boothTabsWrap: { height: 50, marginBottom: 0 },
  boothTabs: { gap: 8, paddingBottom: 4, paddingTop: 2 },
  boothTab: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  boothTabActive: { backgroundColor: "#064E3B", borderColor: "#064E3B" },
  boothTabText: { color: "#475569", fontWeight: "900", fontSize: 12 },
  boothTabTextActive: { color: "#FFFFFF" },
  countBadge: {
    minWidth: 34,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: "#EAF7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeActive: { backgroundColor: "#FFFFFF" },
  countBadgeText: { color: "#087568", fontWeight: "900", fontSize: 11 },
  countBadgeTextActive: { color: "#064E3B" },

  /* List */
  listContent: { paddingBottom: 70, gap: 6, paddingTop: 2 },
  boothFilterHandleButton: {
    position: "absolute",
    left: "50%",
    bottom: 1,
    width: 78,
    height: 15,
    marginLeft: -59,
    // borderRadius: 16,
    // backgroundColor: "#FFFFFF",
    // borderWidth: 1,
    // borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    // shadowColor: "#0F172A",
    // shadowOpacity: 0.12,
    // shadowRadius: 12,
    // shadowOffset: { width: 0, height: 4 },
    // elevation: 6,
    // zIndex: 5,
  },
  boothFilterHandle: {
    width: 92,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
  },

  logoutChoiceOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    elevation: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
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
  surveyChoiceButton: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  surveyChoiceText: {
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

  /* Print choice modal */
  printChoiceBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  printChoicePanel: {
    width: "100%",
    maxWidth: 362,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 16,
    gap: 12,
  },
  printChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  printChoiceTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  printChoiceClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  printChoiceCloseText: { color: "#64748B", fontSize: 24, lineHeight: 24 },
  printChoiceRow: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  printChoiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#EEF6F4",
    alignItems: "center",
    justifyContent: "center",
  },
  printChoiceCopy: { flex: 1, minWidth: 0 },
  printChoiceRowTitle: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  printChoiceSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },

  /* Booth wise modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.46)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },
  modalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modalCard: {
    width: "48%",
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  modalCardLabel: { color: "#065F46", fontWeight: "800", fontSize: 12 },
  modalCardValue: {
    color: "#022C22",
    fontWeight: "900",
    fontSize: 24,
    marginTop: 4,
  },
});
