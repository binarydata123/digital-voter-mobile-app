import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ArrowUp,
  LogOut,
  MapPin,
  Menu,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react-native";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { ThermalPrinterDialog } from "@/features/voters/components/ThermalPrinterDialog";
import { VoterCard } from "@/features/voters/components/VoterCard";
import { VoterDataSetup } from "@/features/voters/components/VoterDataSetup";
import { VoterListSkeleton } from "@/features/voters/components/VoterListSkeleton";

import {
  shareVoterSlipImageFromRef,
  VoterSlipPaper,
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
  getLocalVoterOverview,
  getLocalVoterPage,
  hasLocalVoters,
  replaceLocalVotersFromPages,
} from "@/services/local-voters";
import {
  getSavedThermalPrinter,
  printThermalVoterSlip,
} from "@/services/thermal-printer";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import {
  buildVoterStats,
  fetchVoters,
  forEachVoterPage,
  type Voter,
} from "@/services/voters";

const VOTER_PAGE_SIZE = 50;

type PrintScope = "single" | "family";
type SlipPreviewRequest = {
  voter: Voter;
  scope: PrintScope;
  withBanner: boolean;
};
type PrintTypeRequest = { voter: Voter; scope: PrintScope };
type ThermalPrintRequest = {
  bannerImage?: string;
  showBanner: boolean;
  voter: Voter;
};
type ShareImageRequest = { voter: Voter; resolve: () => void };

export default function VotersScreen() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [localPoliticianId, setLocalPoliticianId] = useState<string | null>(
    null,
  );
  const [localTotal, setLocalTotal] = useState(0);
  const [localBoothCounts, setLocalBoothCounts] = useState<
    Record<string, number>
  >({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [activeBooth, setActiveBooth] = useState("All");
  const [pendingBooth, setPendingBooth] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [slipPreview, setSlipPreview] = useState<SlipPreviewRequest | null>(
    null,
  );
  const [printTypeRequest, setPrintTypeRequest] =
    useState<PrintTypeRequest | null>(null);
  const [thermalPrintRequest, setThermalPrintRequest] =
    useState<ThermalPrintRequest | null>(null);
  const [shareImageRequest, setShareImageRequest] =
    useState<ShareImageRequest | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const boothSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareSlipRef = useRef<View>(null);
  const listRef = useRef<FlashListRef<Voter>>(null);
  const [scrollTopOpacity] = useState(() => new Animated.Value(0));
  const lastLocalQueryKey = useRef("");
  const localRequestId = useRef(0);
  const currentUser = getCurrentUser();
  const canOpenSurvey = hasPoliticianPageAccess("survey", currentUser);
  const canUseTemplates = hasPoliticianPageAccess("template", currentUser);
  const deferredQuery = useDeferredValue(query);
  const isSearchPending = query !== deferredQuery;
  const localMode = Boolean(localPoliticianId);

  const loadInitialLocalPage = useCallback(async (politicianId: string) => {
    const [page, overview] = await Promise.all([
      getLocalVoterPage(politicianId, {}, VOTER_PAGE_SIZE),
      getLocalVoterOverview(politicianId),
    ]);
    lastLocalQueryKey.current = `${politicianId}|All|`;
    setVoters(page.voters);
    setLocalTotal(page.total);
    setLocalBoothCounts(overview.boothCounts);
    setLocalPoliticianId(politicianId);
  }, []);

  const loadVoters = useCallback(async () => {
    const signedInUser = getCurrentUser();
    if (signedInUser && !hasPoliticianPageAccess("voters", signedInUser)) {
      const nextRoute = getDefaultPoliticianRoute(signedInUser);
      router.replace(nextRoute ?? "/login");
      setInitialLoading(false);
      return;
    }

    setInitialLoading(true);
    try {
      const session = await ensureAuthSession();
      const currentPoliticianId = session.user?.id ?? null;

      if (isLocalVoterDatabaseAvailable() && currentPoliticianId) {
        if (await hasLocalVoters(currentPoliticianId)) {
          await loadInitialLocalPage(currentPoliticianId);
          setError("");
          return;
        }

        await replaceLocalVotersFromPages(currentPoliticianId, (savePage) =>
          forEachVoterPage({}, savePage),
        );
        await loadInitialLocalPage(currentPoliticianId);
        setError("");
        return;
      }

      const list = await fetchVoters();
      setLocalPoliticianId(null);
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
      setInitialLoading(false);
    }
  }, [loadInitialLocalPage]);

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

  useEffect(() => {
    if (!shareImageRequest) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      const waitForBanner =
        canUseTemplates && currentUser?.bannerImage ? 250 : 0;

      timer = setTimeout(() => {
        shareVoterSlipImageFromRef(
          shareSlipRef,
          shareImageRequest.voter,
          shareImageRequest.voter.whatsappNumber ||
            shareImageRequest.voter.mobileNumber,
          canUseTemplates,
          currentUser?.bannerImage,
        ).finally(() => {
          shareImageRequest.resolve();
          setShareImageRequest(null);
        });
      }, waitForBanner);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [canUseTemplates, currentUser?.bannerImage, shareImageRequest]);

  // Animate the scroll-to-top button opacity whenever visibility changes.
  useEffect(() => {
    Animated.timing(scrollTopOpacity, {
      toValue: showScrollTop ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showScrollTop, scrollTopOpacity]);

  const refreshAllVoterData = useCallback(async () => {
    setActiveBooth("All");
    setQuery("");
    setRefreshing(true);
    try {
      const session = await ensureAuthSession();
      const currentPoliticianId = session.user?.id ?? null;

      if (isLocalVoterDatabaseAvailable() && currentPoliticianId) {
        await replaceLocalVotersFromPages(currentPoliticianId, (savePage) =>
          forEachVoterPage({}, savePage),
        );
        await loadInitialLocalPage(currentPoliticianId);
      } else {
        const downloadedVoters = await fetchVoters();
        setLocalPoliticianId(null);
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
      setRefreshing(false);
    }
  }, [loadInitialLocalPage]);

  useEffect(() => {
    if (!localPoliticianId) return;

    const normalizedSearch = deferredQuery.trim();
    const queryKey = `${localPoliticianId}|${activeBooth}|${normalizedSearch}`;
    if (lastLocalQueryKey.current === queryKey) return;

    const requestId = ++localRequestId.current;
    setLoadingMore(true);
    getLocalVoterPage(
      localPoliticianId,
      { booth: activeBooth, search: normalizedSearch || undefined },
      VOTER_PAGE_SIZE,
    )
      .then((page) => {
        if (requestId !== localRequestId.current) return;
        lastLocalQueryKey.current = queryKey;
        setVoters(page.voters);
        setLocalTotal(page.total);
      })
      .catch((pageError: any) => {
        if (requestId === localRequestId.current) {
          setError(pageError?.message ?? "Unable to load local voters.");
        }
      })
      .finally(() => {
        if (requestId === localRequestId.current) setLoadingMore(false);
      });
  }, [activeBooth, deferredQuery, localPoliticianId]);

  const loadMoreLocalVoters = useCallback(async () => {
    if (!localPoliticianId || loadingMore || voters.length >= localTotal) {
      return;
    }

    const requestId = ++localRequestId.current;
    setLoadingMore(true);
    try {
      const page = await getLocalVoterPage(
        localPoliticianId,
        { booth: activeBooth, search: deferredQuery.trim() || undefined },
        VOTER_PAGE_SIZE,
        voters.length,
      );
      if (requestId !== localRequestId.current) return;
      setVoters((current) => [...current, ...page.voters]);
      setLocalTotal(page.total);
    } catch (pageError: any) {
      if (requestId === localRequestId.current) {
        setError(pageError?.message ?? "Unable to load more voters.");
      }
    } finally {
      if (requestId === localRequestId.current) setLoadingMore(false);
    }
  }, [
    activeBooth,
    deferredQuery,
    loadingMore,
    localPoliticianId,
    localTotal,
    voters.length,
  ]);

  const stats = useMemo(
    () =>
      localMode
        ? {
            total: localTotal,
            boothCounts: localBoothCounts,
            male: 0,
            female: 0,
            senior: 0,
          }
        : buildVoterStats(voters),
    [localBoothCounts, localMode, localTotal, voters],
  );
  const booths = useMemo(
    () =>
      localMode
        ? ["All", ...Object.keys(localBoothCounts)]
        : ["All", ...Array.from(new Set(voters.map((voter) => voter.booth)))],
    [localBoothCounts, localMode, voters],
  );

  const boothCounts = useMemo(() => {
    const counts: Record<string, number> = { All: stats.total };
    booths.forEach((booth) => {
      if (booth === "All") return;
      counts[booth] = stats.boothCounts[booth] ?? 0;
    });
    return counts;
  }, [booths, stats]);

  const voterSearchIndex = useMemo(
    () =>
      localMode
        ? []
        : voters.map((voter) => ({
            searchText: [voter.name, voter.epicNo, voter.serialNo ?? ""]
              .join(" ")
              .toLowerCase(),
            voter,
          })),
    [localMode, voters],
  );

  const filteredVoters = useMemo(() => {
    if (localMode) return voters;
    const lowered = deferredQuery.trim().toLowerCase();
    const matched: Voter[] = [];

    for (const { voter, searchText } of voterSearchIndex) {
      const boothMatch = activeBooth === "All" || voter.booth === activeBooth;
      const queryMatch = !lowered || searchText.includes(lowered);
      if (boothMatch && queryMatch) matched.push(voter);
    }

    return matched;
  }, [activeBooth, deferredQuery, localMode, voterSearchIndex, voters]);

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

  async function confirmLogout() {
    await logoutPolitician();
    router.replace("/login");
  }

  function openSurveyPage() {
    if (canOpenSurvey) {
      router.push("/politician/survey");
    }
  }

  const handlePrint = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "single" });
  }, []);

  const handleFamily = useCallback((voter: Voter) => {
    setPrintTypeRequest({ voter, scope: "family" });
  }, []);

  const handleShareVoterSlip = useCallback(async (voter: Voter) => {
    await new Promise<void>((resolve) => {
      setShareImageRequest({ voter, resolve });
    });
  }, []);

  const renderVoter = useCallback(
    (voter: Voter) => (
      <VoterCard
        voter={voter}
        onPrint={handlePrint}
        onFamily={handleFamily}
        onShare={handleShareVoterSlip}
      />
    ),
    [handleFamily, handlePrint, handleShareVoterSlip],
  );

  const renderVoterItem = useCallback(
    ({ item }: { item: Voter }) => (
      <View style={styles.voterItemWrap}>{renderVoter(item)}</View>
    ),
    [renderVoter],
  );

  const voterKeyExtractor = useCallback((item: Voter) => item.id, []);

  const listData = useMemo(
    // `deferredQuery` keeps the previous result visible during a search. Do
    // not clear it here: unmounting every card on each key press is expensive.
    () => (pendingBooth ? [] : filteredVoters),
    [filteredVoters, pendingBooth],
  );

  // Toggle scroll-to-top visibility based on how far the user scrolled.
  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const shouldShow = offsetY > 400;
      setShowScrollTop((prev) => (prev === shouldShow ? prev : shouldShow));
    },
    [],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  }, []);

  const renderScreenHeader = useCallback(
    () => (
      <>
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
                disabled={refreshing}
                style={[
                  styles.headerIconButton,
                  refreshing && styles.headerIconButtonDisabled,
                ]}>
                {refreshing ? (
                  <ActivityIndicator color="#0F766E" size="small" />
                ) : (
                  <RefreshCw color="#0F766E" size={18} strokeWidth={2.8} />
                )}
              </Pressable>
              <Pressable
                accessibilityLabel="Open voter menu"
                onPress={() => setMenuVisible(true)}
                style={[styles.headerIconButton, styles.menuButton]}>
                <Menu color="#FFFFFF" size={21} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

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

        {error ? (
          <View style={styles.warningWrap}>
            <Text style={styles.warning}>{error}</Text>
          </View>
        ) : null}
      </>
    ),
    [error, refreshAllVoterData, refreshing],
  );

  const renderStickyControls = useCallback(
    () => (
      <View style={styles.stickyControls}>
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
            onPress={() => setModalVisible(true)}>
            <SlidersHorizontal color="#FFFFFF" size={15} strokeWidth={2.8} />
            <Text style={styles.filterButtonText}>Filter</Text>
          </Pressable>
        </View>
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
                style={[styles.boothTab, isActive && styles.boothTabActive]}>
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
                  ]}>
                  {label}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    isActive && styles.countBadgeActive,
                  ]}>
                  <Text
                    style={[
                      styles.countBadgeText,
                      isActive && styles.countBadgeTextActive,
                    ]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    ),
    [activeBooth, boothCounts, booths, query, selectBooth],
  );

  const renderListFooter = useCallback(() => {
    if (pendingBooth || isSearchPending || loadingMore) {
      return (
        <View style={styles.listFooterWrap}>
          <VoterListSkeleton />
        </View>
      );
    }

    if (filteredVoters.length === 0) {
      return (
        <View style={styles.listFooterWrap}>
          <EmptyState
            title="No voters found"
            message="Try a different name, EPIC number, or booth."
          />
        </View>
      );
    }

    return null;
  }, [filteredVoters.length, isSearchPending, loadingMore, pendingBooth]);

  // Keep this as an element, not a callback passed as ListHeaderComponent.
  // FlashList can reconcile the existing TextInput while `query` changes,
  // preserving Android keyboard focus during a search.
  const listHeader = useMemo(
    () => (
      <>
        {renderScreenHeader()}
        {renderStickyControls()}
      </>
    ),
    [renderScreenHeader, renderStickyControls],
  );

  function openSlipPreview(withBanner: boolean) {
    if (!printTypeRequest) return;
    setSlipPreview({ ...printTypeRequest, withBanner });
    setPrintTypeRequest(null);
  }

  const handleSlipPreviewPrint = useCallback(async () => {
    if (!slipPreview) return;
    const request = {
      bannerImage: getCurrentUser()?.bannerImage,
      showBanner: slipPreview.withBanner,
      voter: slipPreview.voter,
    };

    const savedPrinter = await getSavedThermalPrinter();
    if (!savedPrinter) {
      setThermalPrintRequest(request);
      return;
    }

    try {
      await printThermalVoterSlip(request.voter, savedPrinter, request);
      setSlipPreview(null);
    } catch {
      // The saved printer is no longer reachable. Let the user reconnect or
      // choose another device instead of leaving them at a failed print alert.
      setThermalPrintRequest(request);
    }
  }, [slipPreview]);

  const handleChangeThermalPrinter = useCallback(async () => {
    if (!slipPreview) return;
    setThermalPrintRequest({
      bannerImage: getCurrentUser()?.bannerImage,
      showBanner: slipPreview.withBanner,
      voter: slipPreview.voter,
    });
  }, [slipPreview]);

  if (initialLoading) {
    return <VoterDataSetup />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlashList
        ref={listRef}
        data={listData}
        keyExtractor={voterKeyExtractor}
        renderItem={renderVoterItem}
        onEndReached={localMode ? loadMoreLocalVoters : undefined}
        onEndReachedThreshold={0.25}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        // decelerationRate={1}
        drawDistance={400}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListFooterComponent={renderListFooter}
      />

      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuVisible(false)}>
          <Pressable
            style={styles.menuDrawer}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHeader}></View>
            {canOpenSurvey ? (
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  openSurveyPage();
                }}
                style={styles.menuRow}>
                <View style={styles.menuIconWrap}>
                  <UsersRound color="#087568" size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuRowTitle}>Open survey page</Text>
                  <Text style={styles.menuRowSubtitle}>
                    Manage voter surveys
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {canUseTemplates ? (
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  router.push("/politician/templates");
                }}
                style={styles.menuRow}>
                <View style={styles.menuIconWrap}>
                  <Printer color="#087568" size={20} strokeWidth={2.6} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuRowTitle}>Open template page</Text>
                  <Text style={styles.menuRowSubtitle}>
                    Build booth voter banner templates
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setMenuVisible(false);
                void confirmLogout();
              }}
              style={[styles.menuRow, styles.logoutMenuRow]}>
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

      {/* Print type modal */}
      <Modal
        transparent
        visible={Boolean(printTypeRequest)}
        animationType="fade"
        onRequestClose={() => setPrintTypeRequest(null)}>
        {printTypeRequest ? (
          <Pressable
            style={styles.printChoiceBackdrop}
            onPress={() => setPrintTypeRequest(null)}>
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
                  style={styles.printChoiceClose}>
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
        onRequestClose={() => setSlipPreview(null)}>
        {slipPreview ? (
          <VoterSlipPreview
            voter={slipPreview.voter}
            onClose={() => setSlipPreview(null)}
            showBanner={slipPreview.withBanner}
            bannerImage={getCurrentUser()?.bannerImage}
            onPrint={handleSlipPreviewPrint}
            onChangeDevice={handleChangeThermalPrinter}
          />
        ) : null}
      </Modal>

      {thermalPrintRequest ? (
        <ThermalPrinterDialog
          visible
          voter={thermalPrintRequest.voter}
          bannerImage={thermalPrintRequest.bannerImage}
          showBanner={thermalPrintRequest.showBanner}
          onClose={() => setThermalPrintRequest(null)}
          onPrinted={() => {
            setThermalPrintRequest(null);
            setSlipPreview(null);
          }}
        />
      ) : null}

      {shareImageRequest ? (
        <View pointerEvents="none" style={styles.shareCaptureHost}>
          <View collapsable={false} ref={shareSlipRef}>
            <VoterSlipPaper
              voter={shareImageRequest.voter}
              showBanner={canUseTemplates}
              bannerImage={currentUser?.bannerImage}
            />
          </View>
        </View>
      ) : null}

      {/* Booth wise modal */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}>
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
                  style={styles.modalCard}>
                  <Text style={styles.modalCardLabel}>{booth}</Text>
                  <Text style={styles.modalCardValue}>{count}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Scroll-to-top floating button */}
      <Animated.View
        pointerEvents={showScrollTop ? "auto" : "none"}
        style={[styles.scrollTopWrap, { opacity: scrollTopOpacity }]}>
        <Pressable
          accessibilityLabel="Scroll to top"
          onPress={scrollToTop}
          style={({ pressed }) => [
            styles.scrollTopButton,
            pressed && { transform: [{ scale: 0.92 }] },
          ]}>
          <ArrowUp color="#FFFFFF" size={20} strokeWidth={3} />
        </Pressable>
      </Animated.View>
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
  shareCaptureHost: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 420,
    backgroundColor: "#FFFFFF",
  },

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
  menuButton: { backgroundColor: "#087568" },
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
  warningWrap: {
    backgroundColor: "#F4FBF7",
    paddingHorizontal: 16,
    paddingTop: 14,
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
  stickyControls: {
    position: "relative",
    backgroundColor: "#F4FBF7",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 24,
    zIndex: 24,
  },
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
  listContent: { paddingBottom: 96, backgroundColor: "#F4FBF7" },
  voterItemWrap: {
    position: "relative",
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 10,
    zIndex: 0,
    elevation: 0,
  },
  listFooterWrap: {
    paddingHorizontal: 16,
  },
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

  /* ---------- Scroll to top ---------- */
  scrollTopWrap: {
    position: "absolute",
    right: 18,
    bottom: 26,
    zIndex: 50,
    elevation: 50,
  },
  scrollTopButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  /* ---------- Header menu drawer ---------- */
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
  menuHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  menuTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  menuClose: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
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
