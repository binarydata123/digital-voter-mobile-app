import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  GraduationCap,
  Home,
  ImagePlus,
  Layers,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
  Vote,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentUser } from "@/services/authentication";
import { deleteLocalVoter, updateLocalVoter } from "@/services/local-voters";
import {
  deleteManagedVoter,
  deleteVoterDetails,
  fetchVoterById,
  getSelectedVoter,
  markVoterAsVoted,
  saveManagedVoter,
  setSelectedVoter,
  updateVoterDetails,
  type Voter,
} from "@/services/voters";

import { getDefaultVoterAvatar } from "@/utils/voterAvatar";

function isUsableImageUri(uri?: string) {
  const value = String(uri ?? "")
    .trim()
    .toLowerCase();
  return Boolean(value && value !== "undefined" && value !== "null");
}

function getRelationLabel(relation?: string): string {
  if (!relation) return "Guardian";
  const n = relation.trim().toLowerCase();
  if (n.includes("father") || n === "पिता") return "Father's Name";
  if (n.includes("mother") || n === "माता") return "Mother's Name";
  if (n.includes("husband") || n === "पति") return "Husband's Name";
  if (n.includes("wife") || n === "पत्नी") return "Wife's Name";
  return relation;
}

// Helper to check if today is election day
function isElectionDay(electionDate?: string) {
  if (!electionDate) return false;
  const today = new Date().toISOString().split("T")[0];
  const targetDate = new Date(electionDate).toISOString().split("T")[0];
  return today === targetDate;
}

export default function VoterDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [voter, setVoter] = useState<Voter | null>(getSelectedVoter());
  const [markingVoted, setMarkingVoted] = useState(false);
  const markingVotedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const updated = getSelectedVoter();
      if (updated?.id === params.id) setVoter(updated);
    }, [params.id]),
  );

  useEffect(() => {
    if (voter) return;
    if (params.id) {
      fetchVoterById(params.id).then((v) => setVoter(v));
    }
  }, [params.id, voter]);

  if (!voter) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color="#0F766E" size={22} strokeWidth={3} />
          </Pressable>
          <Text style={styles.headerTitle}>Voter Detail</Text>
        </View>
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentVoter = voter;
  const electionDay = isElectionDay((currentVoter as any).electionDate);

  async function markVoted() {
    if (!electionDay) {
      Alert.alert(
        "Not Election Day",
        "You can only mark a voter as voted on the election date.",
      );
      return;
    }
    if (currentVoter.voted || markingVotedRef.current) return;

    markingVotedRef.current = true;
    setMarkingVoted(true);
    try {
      const updated = await markVoterAsVoted(currentVoter);
      setVoter(updated);
      saveManagedVoter(updated);
      const politicianId = getCurrentUser()?.id;
      if (politicianId) await updateLocalVoter(politicianId, updated);
    } catch (error: any) {
      Alert.alert(
        "Unable to mark voter as voted",
        error?.response?.data?.message || error?.message || "Please try again.",
      );
    } finally {
      markingVotedRef.current = false;
      setMarkingVoted(false);
    }
  }

  const address = [
    currentVoter.houseNo && currentVoter.houseNo !== "N/A"
      ? `House No. ${currentVoter.houseNo}`
      : "",
    currentVoter.ward ? `Ward ${currentVoter.ward}` : "",
    currentVoter.district,
    currentVoter.state,
  ]
    .filter(Boolean)
    .join(", ");

  const relationLabel = getRelationLabel((currentVoter as any).relation);

  async function pickVoterImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

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
      const saved = await updateVoterDetails({
        ...currentVoter,
        photoUri: result.assets[0].uri,
      });
      const politicianId = getCurrentUser()?.id;
      if (politicianId) await updateLocalVoter(politicianId, saved);
      saveManagedVoter(saved);
      setVoter(saved);
    } catch (error: any) {
      Alert.alert(
        "Unable to save voter image",
        error?.response?.data?.message || error?.message || "Please try again.",
      );
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete voter?",
      `${currentVoter.name} will be removed from this voter detail view.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteVoterDetails(currentVoter);
                deleteManagedVoter(currentVoter.id);
                const politicianId = getCurrentUser()?.id;
                if (politicianId) {
                  await deleteLocalVoter(politicianId, currentVoter.id);
                }
                router.replace("/politician/voters");
              } catch (error: any) {
                Alert.alert(
                  "Unable to delete voter",
                  error?.response?.data?.message ||
                    error?.message ||
                    "Please check your connection and try again.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#0F766E" size={22} strokeWidth={3} />
        </Pressable>
        <Text style={styles.headerTitle}>Voter Detail</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Hero Section - Fixed to show Hindi name clearly */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Pressable
              accessibilityLabel="Add or edit voter image"
              onPress={() => void pickVoterImage()}
              style={styles.avatarWrapper}
            >
              <VoterAvatar voter={currentVoter} />
              <View style={styles.avatarEditBadge}>
                <ImagePlus color="#FFFFFF" size={11} strokeWidth={3} />
              </View>
            </Pressable>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <Pressable
                  onPress={markVoted}
                  disabled={!electionDay || currentVoter.voted || markingVoted}
                  style={styles.namePressable}
                >
                  <View style={styles.nameWithBadge}>
                    <Text style={styles.name} numberOfLines={1}>
                      {currentVoter.name}
                    </Text>
                    {currentVoter.voted && (
                      <View style={styles.votedBadge}>
                        <BadgeCheck size={14} color="#FFFFFF" />
                        <Text style={styles.votedBadgeText}>Voted</Text>
                      </View>
                    )}
                  </View>
                  {/* Hindi name now has its own space and is fully visible */}
                  {currentVoter.hindiName ? (
                    <Text style={styles.hindiName} numberOfLines={1}>
                      {currentVoter.hindiName}
                    </Text>
                  ) : null}
                </Pressable>
              </View>

              {!currentVoter.voted && electionDay && (
                <Pressable
                  onPress={markVoted}
                  disabled={markingVoted}
                  style={styles.voteHint}
                >
                  {markingVoted ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Vote size={13} color="#FFFFFF" />
                      <Text style={styles.voteHintText}>
                        Tap name to mark as voted
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              {/* Quick Action Buttons */}
              <View style={styles.quickActions}>
                <Pressable
                  accessibilityLabel="Edit voter"
                  onPress={() => {
                    setSelectedVoter(currentVoter);
                    router.push({
                      pathname: "./voter-edit",
                      params: { id: currentVoter.id },
                    });
                  }}
                  style={styles.quickActionButton}
                >
                  <Pencil color="#FFFFFF" size={14} strokeWidth={2.6} />
                  <Text style={styles.quickActionText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Delete voter"
                  onPress={confirmDelete}
                  style={[styles.quickActionButton, styles.quickDeleteButton]}
                >
                  <Trash2 color="#FFFFFF" size={14} strokeWidth={2.6} />
                  <Text style={styles.quickDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Personal Details Section */}
        <Section
          title="Personal Details"
          icon={<User size={16} color="#FFFFFF" />}
          iconBg="#0F766E"
        >
          <DetailRow label="Gender" value={currentVoter.gender || "N/A"} />
          <DetailRow label="Age" value={String(currentVoter.age || "N/A")} />
          <DetailRow
            label={relationLabel}
            value={currentVoter.guardian || "N/A"}
          />
          <DetailRow
            label="EPIC Number"
            value={currentVoter.epicNo || "N/A"}
            highlight
          />
          <DetailRow
            label="Serial Number"
            value={currentVoter.serialNo || currentVoter.id || "N/A"}
          />
        </Section>

        {/* Categories Section */}
        <Section
          title="Categories"
          icon={<Layers size={16} color="#FFFFFF" />}
          iconBg="#7C3AED"
        >
          <DetailRow
            label="Economic Category"
            value={currentVoter.economicCategory || "N/A"}
          />
          <DetailRow
            label="Social Category"
            value={currentVoter.socialCategory || "N/A"}
          />
          <DetailRow
            label="Ration Category"
            value={currentVoter.rationCategory || "N/A"}
          />
        </Section>

        {/* Occupation & Contact Section */}
        <Section
          title="Occupation & Contact"
          icon={<Briefcase size={16} color="#FFFFFF" />}
          iconBg="#0891B2"
        >
          <DetailRow
            label="Education"
            value={currentVoter.education || "N/A"}
            icon={<GraduationCap size={14} color="#64748B" />}
          />
          <DetailRow
            label="Working / Occupation"
            value={currentVoter.working || "N/A"}
          />
          <DetailRow
            label="WhatsApp Number"
            value={currentVoter.whatsappNumber || "N/A"}
            icon={<Phone size={14} color="#64748B" />}
          />
        </Section>

        {/* Address & Polling Section */}
        <Section
          title="Address & Polling Station"
          icon={<Home size={16} color="#FFFFFF" />}
          iconBg="#DC2626"
        >
          <DetailRow label="House No." value={currentVoter.houseNo || "N/A"} />
          <DetailRow label="Ward" value={currentVoter.ward || "N/A"} />
          <DetailRow label="Booth" value={currentVoter.booth || "N/A"} />
          <DetailRow label="Full Address" value={address || "N/A"} multiline />
          <DetailRow
            label="Polling Station"
            value={currentVoter.pollingStation || "N/A"}
            multiline
            icon={<MapPin size={14} color="#64748B" />}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function VoterAvatar({ voter }: { voter: Voter }) {
  const defaultSource = getDefaultVoterAvatar(voter.gender, voter.age);
  const source = isUsableImageUri(voter.photoUri)
    ? { uri: voter.photoUri }
    : defaultSource;

  return (
    <Image source={source} resizeMode="cover" style={styles.avatarImage} />
  );
}

function Section({
  title,
  icon,
  iconBg,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
  highlight = false,
  icon,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelWrap}>
        {icon ? <View style={styles.detailIcon}>{icon}</View> : null}
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text
        style={[styles.detailValue, highlight && styles.detailValueHighlight]}
        numberOfLines={multiline ? undefined : 1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },

  // Premium Hero Section - Fixed Layout
  heroCard: {
    backgroundColor: "#0F766E", // Solid teal background
    borderRadius: 20,
    padding: 16,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: "#0D9488",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 4,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0F766E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  namePressable: {
    flex: 1,
    minWidth: 0,
  },
  nameWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  name: {
    color: "#FFFFFF", // White text on teal background
    fontSize: 19,
    fontWeight: "900",
    flexShrink: 1,
  },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#15803d",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  votedBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  hindiName: {
    color: "#CCFBF1", // Light teal/white for Hindi name
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  voteHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  voteHintText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  quickActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  quickDeleteButton: {
    backgroundColor: "rgba(220, 38, 38, 0.2)",
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  quickDeleteText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  // Sections
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  detailLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  detailIcon: {
    marginTop: 1,
  },
  detailLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },
  detailValueHighlight: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { color: "#64748B", fontWeight: "700", fontSize: 16 },
});
