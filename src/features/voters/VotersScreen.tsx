import { BannerStudioMenuItem } from "@/features/banner-generation/BannerStudioMenuItem";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  ArrowLeft,
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
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { AddVoterModal } from "@/features/voters/components/AddVoterModal";
import { ThermalPrinterDialog } from "@/features/voters/components/ThermalPrinterDialog";
import { VoterCard } from "@/features/voters/components/VoterCard";
import { VoterDataSetup } from "@/features/voters/components/VoterDataSetup";
import { VoterEditModal } from "@/features/voters/components/VoterEditModal";
import { VoterListSkeleton } from "@/features/voters/components/VoterListSkeleton";
import { searchRank, searchTerms } from "@/utils/voterSearch";

import {
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
  addLocalVoter,
  deleteLocalVoter,
  getLocalVoterOverview,
  getLocalVoterPage,
  hasLocalVoters,
  replaceLocalVotersFromPages,
  updateLocalVoter,
} from "@/services/local-voters";
import {
  getSavedThermalPrinter,
  printThermalVoterSlip,
} from "@/services/thermal-printer";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import {
  applyManagedVoterChanges,
  buildVoterStats,
  deleteManagedVoter,
  deleteVoterDetails,
  fetchVoters,
  forEachVoterPage,
  markVoterAsVoted,
  markPrintedVoterAsVoted,
  saveManagedVoter,
  updateVoterDetails,
  type Voter,
} from "@/services/voters";

const VOTER_PAGE_SIZE = 50;
const STICKY_CONTROL_INDICES = [1];
type VoterListItem =
  | { type: "controls" | "booths" }
  | { type: "voter"; voter: Voter };
const CONTROLS_ITEM: VoterListItem = { type: "controls" };
const BOOTHS_ITEM: VoterListItem = { type: "booths" };
const getVoterListItemType = (item: VoterListItem) => item.type;

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

export default function VotersScreen({
  searchMode = false,
  initialBooth = "All",
}: {
  searchMode?: boolean;
  initialBooth?: string;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [localPoliticianId, setLocalPoliticianId] = useState<string | null>(
    null,
  );
  const [localTotal, setLocalTotal] = useState(0);
  const [localAllVoterTotal, setLocalAllVoterTotal] = useState(0);
  const [localBoothCounts, setLocalBoothCounts] = useState<
    Record<string, number>
  >({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [activeBooth, setActiveBooth] = useState(initialBooth);
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
  const [printerSelectionVersion, setPrinterSelectionVersion] = useState(0);
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);
  const [addingVoter, setAddingVoter] = useState(false);
  const [deleteVoterRequest, setDeleteVoterRequest] = useState<Voter | null>(
    null,
  );
  const [deletingVoter, setDeletingVoter] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const boothSwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlashListRef<VoterListItem>>(null);
  const [scrollTopOpacity] = useState(() => new Animated.Value(0));
  const lastLocalQueryKey = useRef("");
  const localRequestId = useRef(0);
  const currentUser = getCurrentUser();
  const headerTitle =
    currentUser?.ward ||
    currentUser?.constituency ||
    currentUser?.district ||
    "Assigned area";
  const headerLocation = [
    currentUser?.city || currentUser?.district,
    currentUser?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const canOpenSurvey = hasPoliticianPageAccess("survey", currentUser);
  const canUseTemplates = hasPoliticianPageAccess("template", currentUser);
  const deferredQuery = useDeferredValue(query);
  const isSearchPending = query !== deferredQuery;
  const localMode = Boolean(localPoliticianId);

  const loadInitialLocalPage = useCallback(
    async (politicianId: string) => {
      if (searchMode) {
        const overview = await getLocalVoterOverview(politicianId);
        setLocalAllVoterTotal(overview.total);
        setLocalBoothCounts(overview.boothCounts);
        setLocalPoliticianId(politicianId);
        return;
      }
      const [page, overview] = await Promise.all([
        getLocalVoterPage(politicianId, {}, VOTER_PAGE_SIZE),
        getLocalVoterOverview(politicianId),
      ]);
      lastLocalQueryKey.current = `${politicianId}|All|`;
      setVoters(applyManagedVoterChanges(page.voters));
      setLocalTotal(page.total);
      setLocalAllVoterTotal(overview.total);
      setLocalBoothCounts(overview.boothCounts);
      setLocalPoliticianId(politicianId);
    },
    [searchMode],
  );

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
    if (localMode || !pendingBooth || pendingBooth !== activeBooth) {
      return;
    }

    const frame = requestAnimationFrame(() => setPendingBooth(null));
    return () => cancelAnimationFrame(frame);
  }, [activeBooth, localMode, pendingBooth]);

  // Animate the scroll-to-top button opacity whenever visibility changes.
  useEffect(() => {
    Animated.timing(scrollTopOpacity, {
      toValue: showScrollTop ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showScrollTop, scrollTopOpacity]);

  const refreshAllVoterData = useCallback(async () => {
    if (refreshing) return;
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
  }, [loadInitialLocalPage, refreshing]);

  useEffect(() => {
    if (!localPoliticianId) return;

    const normalizedSearch = deferredQuery.trim();
    if (searchMode && !normalizedSearch) {
      ++localRequestId.current;
      lastLocalQueryKey.current = "";
      return;
    }
    const queryKey = `${localPoliticianId}|${activeBooth}|${normalizedSearch}`;
    if (lastLocalQueryKey.current === queryKey) {
      setPendingBooth(null);
      setLoadingMore(false);
      return;
    }

    const requestId = ++localRequestId.current;
    let cancelled = false;
    setLoadingMore(true);
    getLocalVoterPage(
      localPoliticianId,
      { booth: activeBooth, search: normalizedSearch || undefined },
      VOTER_PAGE_SIZE,
    )
      .then((page) => {
        if (cancelled || requestId !== localRequestId.current) return;
        lastLocalQueryKey.current = queryKey;
        setVoters(applyManagedVoterChanges(page.voters));
        setLocalTotal(page.total);
      })
      .catch((pageError: any) => {
        if (!cancelled && requestId === localRequestId.current) {
          setVoters([]);
          setError(pageError?.message ?? "Unable to load local voters.");
        }
      })
      .finally(() => {
        if (!cancelled && requestId === localRequestId.current) {
          setLoadingMore(false);
          setPendingBooth(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeBooth, deferredQuery, localPoliticianId, searchMode]);

  const loadMoreLocalVoters = useCallback(async () => {
    if (
      !localPoliticianId ||
      (searchMode && !query.trim()) ||
      pendingBooth ||
      loadingMore ||
      voters.length >= localTotal
    ) {
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
      setVoters((current) => [
        ...current,
        ...applyManagedVoterChanges(page.voters),
      ]);
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
    searchMode,
    query,
    localPoliticianId,
    localTotal,
    pendingBooth,
    voters.length,
  ]);

  const stats = useMemo(
    () =>
      localMode
        ? {
            total: localAllVoterTotal,
            boothCounts: localBoothCounts,
            male: 0,
            female: 0,
            senior: 0,
          }
        : buildVoterStats(voters),
    [localAllVoterTotal, localBoothCounts, localMode, voters],
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
            words: searchTerms(
              [
                voter.name,
                voter.hindiName ?? "",
                voter.epicNo,
                voter.serialNo ?? "",
              ].join(" "),
            ),
            voter,
          })),
    [localMode, voters],
  );

  const filteredVoters = useMemo(() => {
    if (localMode) return voters;
    const lowered = deferredQuery.trim().toLowerCase();
    const terms = searchTerms(lowered);
    const matched: Voter[] = [];

    for (const { voter, words } of voterSearchIndex) {
      const boothMatch = activeBooth === "All" || voter.booth === activeBooth;
      const queryMatch = terms.every((term) =>
        words.some((word) => word.startsWith(term)),
      );
      if (boothMatch && queryMatch) matched.push(voter);
    }

    return matched.sort((a, b) => {
      const fields = (voter: Voter) => [
        voter.name,
        voter.hindiName ?? "",
        voter.epicNo,
        voter.serialNo ?? "",
      ];
      return (
        (lowered
          ? searchRank(fields(a), lowered) - searchRank(fields(b), lowered)
          : 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        a.id.localeCompare(b.id)
      );
    });
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
      // Ignore any response still in flight for the previously selected booth.
      ++localRequestId.current;
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

  const refreshLocalOverview = useCallback(async () => {
    if (!localPoliticianId) return;
    const overview = await getLocalVoterOverview(localPoliticianId);
    setLocalAllVoterTotal(overview.total);
    setLocalBoothCounts(overview.boothCounts);
  }, [localPoliticianId]);

  const replaceVoter = useCallback(
    async (nextVoter: Voter) => {
      setVoters((current) =>
        current.map((voter) => (voter.id === nextVoter.id ? nextVoter : voter)),
      );
      saveManagedVoter(nextVoter);

      await updateVoterDetails(nextVoter);

      if (localPoliticianId) {
        await updateLocalVoter(localPoliticianId, nextVoter);
        await refreshLocalOverview();
      }
    },
    [localPoliticianId, refreshLocalOverview],
  );

  const handleSaveVoter = useCallback(
    async (nextVoter: Voter) => {
      try {
        await replaceVoter(nextVoter);
        setEditingVoter(null);
      } catch (error: any) {
        Alert.alert(
          "Unable to save voter",
          error?.response?.data?.message ||
            error?.message ||
            "Please check your connection and try again.",
        );
      }
    },
    [replaceVoter],
  );

  const handleEditVoter = useCallback((voter: Voter) => {
    setEditingVoter(voter);
  }, []);

  const deleteVoter = useCallback(
    async (voter: Voter) => {
      await deleteVoterDetails(voter);
      setVoters((current) => current.filter((item) => item.id !== voter.id));
      if (localMode) {
        setLocalTotal((total) => Math.max(0, total - 1));
        setLocalAllVoterTotal((total) => Math.max(0, total - 1));
        setLocalBoothCounts((counts) => ({
          ...counts,
          [voter.booth]: Math.max(0, (counts[voter.booth] ?? 0) - 1),
        }));
      }
      deleteManagedVoter(voter.id);
      if (localPoliticianId) {
        await deleteLocalVoter(localPoliticianId, voter.id);
        await refreshLocalOverview();
      }
    },
    [localMode, localPoliticianId, refreshLocalOverview],
  );

  const handleDeleteVoter = useCallback((voter: Voter) => {
    setDeleteVoterRequest(voter);
  }, []);

  const confirmDeleteVoter = useCallback(async () => {
    if (!deleteVoterRequest || deletingVoter) return;

    setDeletingVoter(true);
    try {
      // ✅ 10 second ka race condition
      await Promise.race([
        deleteVoter(deleteVoterRequest),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new Error("Delete request timed out. Please try again.")),
            10000,
          ),
        ),
      ]);
      setDeleteVoterRequest(null);
    } catch (error: any) {
      Alert.alert(
        "Unable to delete voter",
        error?.response?.data?.message ||
          error?.message ||
          "Please check your connection and try again.",
      );
    } finally {
      setDeletingVoter(false);
    }
  }, [deleteVoter, deleteVoterRequest, deletingVoter]);

  const handleVoterImagePress = useCallback(
    async (voter: Voter) => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow photo library access to add or edit this voter image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      try {
        await replaceVoter({ ...voter, photoUri: result.assets[0].uri });
      } catch (error: any) {
        Alert.alert(
          "Unable to save voter image",
          error?.response?.data?.message ||
            error?.message ||
            "Please check your connection and try again.",
        );
      }
    },
    [replaceVoter],
  );

  const handleMarkVoted = useCallback(
    async (voter: Voter) => {
      if (voter.voted) return;
      try {
        const updated = await markVoterAsVoted(voter);
        saveManagedVoter(updated);
        setVoters((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (localPoliticianId) {
          await updateLocalVoter(localPoliticianId, updated);
        }
      } catch (error: any) {
        Alert.alert(
          "Unable to mark voter as voted",
          error?.response?.data?.message ||
            error?.message ||
            "Please try again.",
        );
      }
    },
    [localPoliticianId],
  );

  const handleVoterPrinted = useCallback(async (voter: Voter) => {
    try {
      const updated = await markPrintedVoterAsVoted(voter);
      if (!updated) return;
      saveManagedVoter(updated);
      setVoters((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (localPoliticianId) await updateLocalVoter(localPoliticianId, updated);
    } catch (error: any) {
      Alert.alert(
        "Slip printed; voted status could not be saved",
        error?.response?.data?.message || error?.message || "Tap the voter name to try saving the status again.",
      );
    }
  }, [localPoliticianId]);

  const renderVoter = useCallback(
    (voter: Voter) => (
      <VoterCard
        voter={voter}
        onPrint={handlePrint}
        onFamily={handleFamily}
        onEdit={handleEditVoter}
        onDelete={handleDeleteVoter}
        onImagePress={handleVoterImagePress}
        onMarkVoted={handleMarkVoted}
      />
    ),
    [
      handleDeleteVoter,
      handleFamily,
      handleEditVoter,
      handlePrint,
      handleVoterImagePress,
      handleMarkVoted,
    ],
  );

  const voterKeyExtractor = useCallback(
    (item: VoterListItem) =>
      item.type === "voter" ? `voter:${item.voter.id}` : item.type,
    [],
  );

  const listData = useMemo<VoterListItem[]>(
    // `deferredQuery` keeps the previous result visible during a search. Do
    // not clear it here: unmounting every card on each key press is expensive.
    () => [
      ...(searchMode ? [] : [BOOTHS_ITEM, CONTROLS_ITEM]),
      ...(pendingBooth || (searchMode && !query.trim())
        ? []
        : filteredVoters.map(
            (voter): VoterListItem => ({ type: "voter", voter }),
          )),
    ],
    [filteredVoters, pendingBooth, searchMode, query],
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

  const handleVoterCreated = useCallback(
    async (created: Voter) => {
      ++localRequestId.current;
      setQuery("");
      setActiveBooth("All");
      setPendingBooth(null);
      if (localPoliticianId) {
        try {
          await addLocalVoter(localPoliticianId, created);
          await loadInitialLocalPage(localPoliticianId);
          setError("");
        } catch {
          setVoters((current) => [
            created,
            ...current.filter((voter) => voter.id !== created.id),
          ]);
          setError(
            "Voter added successfully. Refresh voter data to update offline storage.",
          );
        }
      } else {
        setVoters((current) => [
          created,
          ...current.filter((voter) => voter.id !== created.id),
        ]);
      }
    },
    [localPoliticianId, loadInitialLocalPage],
  );

  const renderScreenHeader = useCallback(
    () => (
      <>
        <View style={styles.header}>
          <Image
            source={require("../../../assets/images/vote.jpeg")}
            style={styles.headerImage}
            contentFit="cover"
            contentPosition="right center"
            transition={120}
          />
          <View style={styles.headerOverlay} />

          <View style={styles.headerTop}>
            <View />
            <View style={styles.headerActions}>
              {/* <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add voter"
                onPress={() => setAddingVoter(true)}
                style={styles.headerIconButton}
              >
                <UserPlus color="#0F766E" size={19} strokeWidth={2.6} />
              </Pressable> */}
              <Pressable
                accessibilityLabel="Refresh offline voter data"
                onPress={refreshAllVoterData}
                disabled={refreshing}
                style={styles.headerIconButton}
              >
                <RefreshCw color="#0F766E" size={18} strokeWidth={2.8} />
              </Pressable>
              <Pressable
                accessibilityLabel="Open voter menu"
                onPress={() => setMenuVisible(true)}
                style={[styles.headerIconButton, styles.menuButton]}
              >
                <Menu color="#FFFFFF" size={21} strokeWidth={2.8} />
              </Pressable>
            </View>
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>VOTER LIST</Text>
            <Text style={styles.title} numberOfLines={1}>
              {headerTitle}
            </Text>
            {headerLocation ? (
              <View style={styles.locationRow}>
                <MapPin color="#087568" size={14} strokeWidth={2.8} />
                <Text style={styles.location} numberOfLines={1}>
                  {headerLocation}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {error ? (
          <View style={styles.warningWrap}>
            <Text style={styles.warning}>{error}</Text>
          </View>
        ) : null}
      </>
    ),
    [error, refreshAllVoterData, refreshing, headerTitle, headerLocation],
  );

  const renderStickyControls = useCallback(
    (section: "controls" | "booths") => (
      <View
        style={
          section === "controls" ? styles.stickyControls : styles.boothControls
        }
      >
        {section === "controls" ? (
          <View style={styles.searchRow}>
            {searchMode ? (
              <View style={styles.searchBox}>
                <Search color="#94A3B8" size={18} strokeWidth={2.6} />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    if (localMode && !value.trim()) {
                      ++localRequestId.current;
                      lastLocalQueryKey.current = "";
                      setVoters([]);
                      setLocalTotal(0);
                      setLoadingMore(false);
                      setPendingBooth(null);
                    }
                  }}
                  placeholder="Search name, EPIC No. or Serial No."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                  returnKeyType="search"
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open voter search"
                style={styles.searchBox}
                onPress={() =>
                  router.push({
                    pathname: "./voter-search",
                    params: { booth: activeBooth },
                  })
                }
              >
                <Search color="#94A3B8" size={18} strokeWidth={2.6} />
                <Text
                  style={[styles.searchInput, { color: "#94A3B8" }]}
                  numberOfLines={1}
                >
                  Search name, EPIC No. or Serial No.
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.filterButton}
              onPress={() => setModalVisible(true)}
            >
              <SlidersHorizontal color="#FFFFFF" size={15} strokeWidth={2.8} />
              <Text style={styles.filterButtonText}>Filter</Text>
            </Pressable>
          </View>
        ) : null}
        {section === "booths" ? (
          <FlatList
            horizontal
            data={booths}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.boothTabs}
            renderItem={({ item }) => {
              const isActive = (pendingBooth ?? activeBooth) === item;
              const label = item === "All" ? "All Voters" : item;
              const count = boothCounts[item] ?? 0;

              return (
                <Pressable
                  onPress={() => selectBooth(item)}
                  style={[styles.boothTab, isActive && styles.boothTabActive]}
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
        ) : null}
      </View>
    ),
    [
      activeBooth,
      boothCounts,
      booths,
      pendingBooth,
      query,
      selectBooth,
      searchMode,
      localMode,
    ],
  );

  const renderListFooter = useCallback(() => {
    if (searchMode && !query.trim())
      return (
        <View style={styles.listFooterWrap}>
          <EmptyState
            title="Search for a voter"
            message="Enter a name, EPIC number, or serial number above to find voters."
          />
        </View>
      );
    if (searchMode && initialLoading) return null;
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
  }, [
    filteredVoters.length,
    searchMode,
    query,
    initialLoading,
    isSearchPending,
    loadingMore,
    pendingBooth,
  ]);

  const renderVoterItem = useCallback(
    ({ item }: { item: VoterListItem }) =>
      item.type === "voter" ? (
        <View style={styles.voterItemWrap}>{renderVoter(item.voter)}</View>
      ) : (
        renderStickyControls(item.type)
      ),
    [renderStickyControls, renderVoter],
  );
  const listHeader = useMemo(() => renderScreenHeader(), [renderScreenHeader]);

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
      await handleVoterPrinted(request.voter);
    } catch {
      // The saved printer is no longer reachable. Let the user reconnect or
      // choose another device instead of leaving them at a failed print alert.
      setThermalPrintRequest(request);
    }
  }, [slipPreview, handleVoterPrinted]);

  const handleChangeThermalPrinter = useCallback(async () => {
    if (!slipPreview) return;
    setThermalPrintRequest({
      bannerImage: getCurrentUser()?.bannerImage,
      showBanner: slipPreview.withBanner,
      voter: slipPreview.voter,
    });
  }, [slipPreview]);

  if (!searchMode && (initialLoading || refreshing)) {
    return <VoterDataSetup />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {addingVoter && currentUser ? (
        <AddVoterModal
          user={currentUser}
          onClose={() => setAddingVoter(false)}
          onCreated={handleVoterCreated}
        />
      ) : null}
      <VoterEditModal
        visible={Boolean(editingVoter)}
        voter={editingVoter}
        onClose={() => setEditingVoter(null)}
        onSave={handleSaveVoter}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: safeAreaInsets.top,
          backgroundColor: "#087568",
        }}
      />
      {searchMode && (
        <>
          <View style={styles.searchPageHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to voter list"
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace("/politician/voters")
              }
              style={styles.searchPageBack}
            >
              <ArrowLeft size={22} color="#087568" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.searchPageTitle}>Search voters</Text>
              <Text style={styles.searchPageSubtitle} numberOfLines={1}>
                {activeBooth === "All" ? "All voters" : activeBooth}
              </Text>
            </View>
          </View>
          {renderStickyControls("controls")}
          {!!error && <Text style={styles.warning}>{error}</Text>}
        </>
      )}
      {searchMode &&
      (!query.trim() ||
        (!initialLoading &&
          !isSearchPending &&
          !loadingMore &&
          !pendingBooth &&
          filteredVoters.length === 0)) ? (
        <View style={styles.searchEmptyArea}>
          <View style={styles.searchEmptyIcon}>
            <Search size={30} color="#087568" strokeWidth={1.8} />
          </View>
          <Text style={styles.searchEmptyTitle}>
            {query.trim() ? "No voters found" : "Search for a voter"}
          </Text>
          <Text style={styles.searchEmptyMessage}>
            {query.trim()
              ? "Try a different name, EPIC number, serial number, or booth."
              : "Enter a name, EPIC number, or serial number above to find voters."}
          </Text>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={listData}
          keyExtractor={voterKeyExtractor}
          renderItem={renderVoterItem}
          getItemType={getVoterListItemType}
          stickyHeaderIndices={searchMode ? undefined : STICKY_CONTROL_INDICES}
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
          ListHeaderComponent={searchMode ? undefined : listHeader}
          ListFooterComponent={renderListFooter}
        />
      )}

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
            <View style={styles.menuHeader}></View>
            {canOpenSurvey ? (
              <Pressable
                onPress={() => {
                  setMenuVisible(false);
                  openSurveyPage();
                }}
                style={styles.menuRow}
              >
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
                style={styles.menuRow}
              >
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

            <BannerStudioMenuItem
              onPress={() => {
                setMenuVisible(false);
                router.push("/banner-generation");
              }}
            />
            <Pressable
              onPress={() => {
                setMenuVisible(false);
                void confirmLogout();
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

      {/* Delete voter confirmation */}
      <Modal
        transparent
        visible={Boolean(deleteVoterRequest)}
        animationType="fade"
        onRequestClose={() => {
          if (!deletingVoter) setDeleteVoterRequest(null);
        }}
      >
        {deleteVoterRequest ? (
          <Pressable
            style={styles.printChoiceBackdrop}
            onPress={() => {
              if (!deletingVoter) setDeleteVoterRequest(null);
            }}
          >
            <Pressable style={styles.deleteConfirmPanel}>
              <Text style={styles.deleteConfirmTitle}>Delete voter?</Text>
              <Text style={styles.deleteConfirmMessage}>
                {deleteVoterRequest.name} will be removed from this voter list.
              </Text>
              <View style={styles.deleteConfirmActions}>
                <Pressable
                  disabled={deletingVoter}
                  onPress={() => setDeleteVoterRequest(null)}
                  style={[
                    styles.deleteCancelButton,
                    deletingVoter && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.deleteCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={deletingVoter}
                  onPress={() => void confirmDeleteVoter()}
                  style={[
                    styles.deleteConfirmButton,
                    deletingVoter && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.deleteConfirmText}>
                    {deletingVoter ? "Deleting..." : "Delete"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>

      {/* Print type modal */}
      <Modal
        transparent
        visible={Boolean(printTypeRequest)}
        animationType="slide"
        onRequestClose={() => setPrintTypeRequest(null)}
      >
        {printTypeRequest ? (
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setPrintTypeRequest(null)}
          >
            <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.handle} />
              <View style={styles.printChoiceHeader}>
                <Text style={styles.printChoiceTitle}>
                  {printTypeRequest.scope === "family"
                    ? "Print family slips"
                    : "Print voter slip"}
                </Text>
                <Pressable
                  accessibilityLabel="Close print type"
                  onPress={() => setPrintTypeRequest(null)}
                  style={styles.printChoiceClose}
                >
                  <Text style={styles.printChoiceCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.printOptions}>
              {canUseTemplates ? (
                <PrintChoiceRow
                  icon={
                    printTypeRequest.scope === "family"
                      ? "family-print"
                      : "print"
                  }
                  title={
                    printTypeRequest.scope === "family"
                      ? "Family slips with banner"
                      : "With banner"
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
                    ? "Family slips without banner"
                    : "Without banner"
                }
                subtitle={
                  printTypeRequest.scope === "family"
                    ? "Family member slips."
                    : "Voter slip only."
                }
                onPress={() => openSlipPreview(false)}
              />
              </View>
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
            onPrint={handleSlipPreviewPrint}
            onChangeDevice={handleChangeThermalPrinter}
            printerSelectionVersion={printerSelectionVersion}
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
          onSelected={() =>
            setPrinterSelectionVersion((version) => version + 1)
          }
          onPrinted={() => {
            const printedVoter = thermalPrintRequest.voter;
            setThermalPrintRequest(null);
            setSlipPreview(null);
            void handleVoterPrinted(printedVoter);
          }}
        />
      ) : null}

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

      {/* Scroll-to-top floating button */}
      <Animated.View
        pointerEvents={showScrollTop ? "auto" : "none"}
        style={[styles.scrollTopWrap, { opacity: scrollTopOpacity }]}
      >
        <Pressable
          // Preserve the native Pressable style callback on Android.
          cssInterop={false}
          accessibilityLabel="Scroll to top"
          onPress={scrollToTop}
          style={({ pressed }) => [
            styles.scrollTopButton,
            pressed && { transform: [{ scale: 0.92 }] },
          ]}
        >
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
  searchPageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 10,
    minHeight: 48,
  },
  searchPageBack: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE8E3",
    justifyContent: "center",
    alignItems: "center",
  },
  searchPageTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  searchPageSubtitle: { color: "#64748B", fontSize: 11, marginTop: 1 },
  searchEmptyArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 20,
    gap: 10,
  },
  searchEmptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E4F1EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  searchEmptyTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  searchEmptyMessage: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
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
    left: 0,
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
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.025,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 24,
  },
  boothControls: {
    backgroundColor: "#F4FBF7",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
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
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  filterButton: {
    flexShrink: 0,
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
  printChoiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  printChoiceTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900", flex: 1 },
  printOptions: { gap: 12 },
  printChoiceClose: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  printChoiceCloseText: { color: "#64748B", fontSize: 24, lineHeight: 24 },
  printChoiceRow: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    borderRadius: 14,
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
  deleteConfirmPanel: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  deleteConfirmTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
  },
  deleteConfirmMessage: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  deleteConfirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  deleteCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "900",
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
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
