import { DEFAULT_TEMPLATE_FIELDS, type TemplateFields } from "@/features/templates/fields";
import {
  TEMPLATE_LAYOUTS,
  TemplateThumbnail,
  type TemplateLayout,
} from "@/features/templates/components/TemplateThumbnail";
import { router, useFocusEffect } from "expo-router";
import {
  Check,
  ClipboardList,
  FileText,
  LogOut,
  MapPinned,
  Menu,
  SlidersHorizontal,
  X,
  Rows3,
  ChevronDown,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getCurrentUser,
  hasPoliticianPageAccess,
  logoutPolitician,
  refreshCurrentUser,
  type AuthUser,
} from "@/services/authentication";
import { styles } from "@/features/templates/styles";

const FIELD_OPTIONS: { key: keyof TemplateFields; label: string }[] = [
  { key: "epicNo", label: "EPIC No" },
  { key: "relation", label: "Relation / Relative" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "ward", label: "Ward / Roll" },
  { key: "houseNo", label: "House No" },
  { key: "booth", label: "Booth No" },
  { key: "pollingStation", label: "Polling Station" },
];

function uniqueValues(values: (string | undefined)[] = []) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  ).sort((first, second) => first.localeCompare(second));
}

function firstAssignedValue(values?: string[], fallback = "") {
  return uniqueValues(values).at(0) ?? fallback;
}

function clampTemplateLayout(value?: string): TemplateLayout {
  return TEMPLATE_LAYOUTS.some((option) => option.key === value)
    ? (value as TemplateLayout)
    : "top";
}

export default function TemplatesScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [boothModalVisible, setBoothModalVisible] = useState(false);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(() =>
    getCurrentUser(),
  );
  const currentUser = profileUser;
  const assignedBooths = useMemo(
    () => uniqueValues(currentUser?.assignedBooths ?? []),
    [currentUser?.assignedBooths],
  );
  const assignedDistricts = useMemo(
    () => uniqueValues(currentUser?.districts ?? [currentUser?.district]),
    [currentUser?.district, currentUser?.districts],
  );
  const activeState = firstAssignedValue(
    currentUser?.states,
    currentUser?.state,
  );
  const activeDistrict = assignedDistricts[0] ?? "";
  const savedTemplate = currentUser?.selectedVoterTemplate;


  const [selectedBooth, setSelectedBooth] = useState(
    () => profileUser?.assignedBooths?.[0] ?? profileUser?.booth ?? "",
  );
  const [layout, setLayout] = useState<TemplateLayout>(() =>
    clampTemplateLayout(savedTemplate?.canvasLayout),
  );
  useFocusEffect(
    useCallback(() => {
      const user = getCurrentUser();
      if (user) {
        setProfileUser(user);
        setLayout(
          clampTemplateLayout(user.selectedVoterTemplate?.canvasLayout),
        );
      }
    }, []),
  );

  const [fields, setFields] = useState(DEFAULT_TEMPLATE_FIELDS);


  const hasSurveyAccess = hasPoliticianPageAccess("survey", currentUser);
  const hasTemplateAccess = hasPoliticianPageAccess("template", currentUser);
  const showQuickLinks = hasSurveyAccess && hasTemplateAccess;

  useEffect(() => {
    let active = true;

    refreshCurrentUser()
      .then((user) => {
        if (!active) return;
        setProfileUser(user);
        setLayout(
          clampTemplateLayout(user.selectedVoterTemplate?.canvasLayout),
        );
        setSelectedBooth(
          (current) => current || user.assignedBooths?.[0] || user.booth || "",
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const boothOptions =
    assignedBooths.length > 0
      ? assignedBooths
      : [selectedBooth].filter(Boolean);
  function openTemplatePreview(templateLayout: TemplateLayout) {
    router.push({
      pathname: "/politician/Template/template-preview",
      params: {
        layout: templateLayout,
        booth: selectedBooth,
        district: activeDistrict,
        state: activeState,
        fields: FIELD_OPTIONS.filter((option) => fields[option.key]).map((option) => option.key).join(","),
      },
    });
  }

  function openMenu() {
    setMenuVisible(true);
  }

  async function handleLogout() {
    setMenuVisible(false);
    await logoutPolitician();
    router.replace("/login");
  }

  function goToSurvey() {
    setMenuVisible(false);
    router.push("/politician/survey");
  }

  function goToVoters() {
    setMenuVisible(false);
    router.push("/politician/voters");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-8">
        <View className="h-[190px] overflow-hidden bg-[#E6F4EA] px-[18px] pb-3 pt-2">
          <Image
            source={require("../../../assets/images/vote.jpeg")}
            className="absolute right-0 top-0 h-[190px] w-[155%]"
            resizeMode="cover"
          />
          <View className="mb-2 flex-row items-center justify-end gap-2.5">
            <Pressable
              accessibilityLabel="Open template menu"
              onPress={openMenu}
              className="h-9 w-9 items-center justify-center rounded-lg bg-[#087568]">
              <Menu color="#FFFFFF" size={21} strokeWidth={2.8} />
            </Pressable>
          </View>
          <View className="mt-2">
            <Text className="text-[11px] font-black text-[#55718A]">
              VOTER LIST
            </Text>
            <Text className="mt-1 text-[25px] font-black text-[#0F172A]">
              {currentUser?.ward ||
                currentUser?.constituency ||
                activeDistrict ||
                "Assigned area"}
            </Text>
            <Text className="text-[19px] font-black text-[#087568]">
              {selectedBooth || "Assigned booth"}
            </Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <MapPinned color="#087568" size={14} strokeWidth={2.8} />
              <Text className="text-[13px] font-black text-[#087568]">
                {[currentUser?.city || activeDistrict, activeState]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-2 bg-[#F1F5F9] px-4 py-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Open booth filter" onPress={() => setBoothModalVisible(true)} className="min-h-[44px] flex-1 flex-row items-center gap-2 rounded-xl border border-[#DDE8EF] bg-white px-3">
            <Rows3 color="#087568" size={17} />
            <Text className="flex-1 text-sm font-bold text-[#087568]">{selectedBooth === "All" ? "All Voters" : selectedBooth || "Select booth"}</Text>
            <ChevronDown color="#087568" size={18} />
          </Pressable>
          <Pressable style={styles.filterIconButton} onPress={() => setFilterVisible(true)} accessibilityLabel="Open template filters"><SlidersHorizontal color="#FFFFFF" size={18} strokeWidth={2.8} /></Pressable>
        </View>
        <View className="px-4 pb-4">
          <Text className="mb-4 mt-5 text-center text-[11px] font-extrabold tracking-[1px] text-[#64748B]">
            SELECT AN A4 TEMPLATE
          </Text>
          <View className="flex-row flex-wrap justify-between gap-y-5">
            {TEMPLATE_LAYOUTS.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: layout === item.key }}
                accessibilityLabel={item.label}
                onPress={() => openTemplatePreview(item.key)}
                className="w-[48%]">
                <TemplateThumbnail
                  layout={item.key}
                  selected={layout === item.key}
                />
                <Text
                  className={`mt-2 text-center text-xs font-extrabold ${layout === item.key ? "text-[#087568]" : "text-[#475569]"}`}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ===================== FILTER DRAWER ===================== */}
      <Modal transparent visible={boothModalVisible} animationType="slide" onRequestClose={() => setBoothModalVisible(false)}>
        <Pressable className="flex-1 justify-end bg-[rgba(15,23,42,0.46)]" onPress={() => setBoothModalVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} className="max-h-[75%] rounded-t-[28px] bg-white p-5 pb-8">
            <View className="mb-4 h-1 w-[42px] self-center rounded-full bg-[#CBD5E1]" />
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-black text-[#0F172A]">Booth Wise Voters</Text>
              <Pressable accessibilityLabel="Close booth filter" onPress={() => setBoothModalVisible(false)} className="p-2"><X color="#64748B" size={22} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {["All", ...boothOptions.filter((booth) => booth !== "All")].map((booth) => {
                  const active = selectedBooth === booth;
                  return <Pressable key={booth} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { setSelectedBooth(booth); setBoothModalVisible(false); }} className={`min-h-[64px] w-[48%] flex-row items-center justify-between rounded-2xl border p-3.5 ${active ? "border-[#087568] bg-[#D1FAE5]" : "border-[#BBF7D0] bg-[#ECFDF5]"}`}>
                    <Text className="flex-1 text-xs font-extrabold text-[#065F46]">{booth === "All" ? "All Voters" : booth}</Text>
                    {active ? <Check color="#087568" size={18} /> : null}
                  </Pressable>;
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={filterVisible}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setFilterVisible(false)}>
          <Pressable style={styles.filterSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />

            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Template Filters</Text>
              <Pressable
                onPress={() => setFilterVisible(false)}
                style={styles.filterSheetClose}>
                <X color="#334155" size={20} strokeWidth={2.7} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.filterSheetBody}>
              <View style={styles.sectionBox}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>VOTER DETAILS</Text>
                  <View style={styles.sectionHeaderRight}>
                    <Pressable
                      onPress={() => setFields(DEFAULT_TEMPLATE_FIELDS)}
                      hitSlop={6}>
                      <Text style={styles.bulkText}>Select all</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setFields(
                          FIELD_OPTIONS.reduce(
                            (nextFields, option) => ({
                              ...nextFields,
                              [option.key]: false,
                            }),
                            {} as TemplateFields,
                          ),
                        )
                      }
                      hitSlop={6}>
                      <Text style={styles.bulkTextMuted}>Clear all</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGrid}>
                  {FIELD_OPTIONS.map((field) => (
                    <Pressable
                      key={field.key}
                      onPress={() =>
                        setFields((current) => ({
                          ...current,
                          [field.key]: !current[field.key],
                        }))
                      }
                      style={[
                        styles.fieldChip,
                        fields[field.key] && styles.fieldChipActive,
                      ]}>
                      <View
                        style={[
                          styles.checkBox,
                          fields[field.key] && styles.checkBoxActive,
                        ]}>
                        {fields[field.key] ? (
                          <Check color="#ffffff" size={12} strokeWidth={3} />
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={styles.fieldText}>
                        {field.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={styles.filterApplyButton}
              onPress={() => setFilterVisible(false)}>
              <Text style={styles.filterApplyText}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===================== SIDE / BOTTOM MENU ===================== */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />

            {showQuickLinks ? (
              <>
                <Pressable style={styles.menuItem} onPress={goToSurvey}>
                  <View style={styles.menuIconWrap}>
                    <ClipboardList
                      color="#075e54"
                      size={18}
                      strokeWidth={2.6}
                    />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Open survey page</Text>
                    <Text style={styles.menuSubtitle}>
                      Manage voter surveys
                    </Text>
                  </View>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={goToVoters}>
                  <View style={styles.menuIconWrap}>
                    <FileText color="#075e54" size={18} strokeWidth={2.6} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.menuTitle}>Open voter page</Text>
                    <Text style={styles.menuSubtitle}>
                      Manage voter records
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.menuDivider} />
              </>
            ) : null}

            <Pressable style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIconWrap, styles.menuIconWrapDanger]}>
                <LogOut color="#b91c1c" size={18} strokeWidth={2.6} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={[styles.menuTitle, styles.menuTitleDanger]}>
                  Logout
                </Text>
                <Text style={styles.menuSubtitle}>
                  Sign out from this device
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

