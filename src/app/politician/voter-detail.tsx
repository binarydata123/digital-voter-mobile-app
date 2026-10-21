import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  Home,
  ImagePlus,
  Layers,
  MapPin,
  Pencil,
  Trash2,
  User,
  Vote,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { getElectionVotingError } from "@/utils/electionVoting";

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

function formatEpicNo(epicNo?: string | null): string {
  const value = epicNo?.replace(/\s/g, "") ?? "";
  if (!value) return "N/A";
  return value.length === 10
    ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`
    : epicNo?.trim() || "N/A";
}

export default function VoterDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [voter, setVoter] = useState<Voter | null>(getSelectedVoter());
  const [markingVoted, setMarkingVoted] = useState(false);
  const markingVotedRef = useRef(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingVoter, setDeletingVoter] = useState(false);

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
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <ChevronLeft color="#0F766E" size={24} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle}>Voter Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.emptyText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentVoter = voter;
  const electionDay = !getElectionVotingError(getCurrentUser()?.electionDate);

  async function markVoted() {
    if (!electionDay) return;
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
      if (getElectionVotingError(getCurrentUser()?.electionDate)) return;
      Alert.alert(
        "Unable to mark voter as voted",
        error?.response?.data?.message || error?.message || "Please try again.",
      );
    } finally {
      markingVotedRef.current = false;
      setMarkingVoted(false);
    }
  }

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
    if (result.canceled || !result.assets[0]?.uri) return;

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

  async function executeDelete() {
    if (deletingVoter) return;
    setDeletingVoter(true);
    try {
      await deleteVoterDetails(currentVoter);
      deleteManagedVoter(currentVoter.id);
      const politicianId = getCurrentUser()?.id;
      if (politicianId) await deleteLocalVoter(politicianId, currentVoter.id);
      setDeleteModalVisible(false);
      router.replace("/politician/voters");
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
  }

  const relationLabel = getRelationLabel((currentVoter as any).relation);
  const fullAddress = [
    currentVoter.houseNo && currentVoter.houseNo !== "N/A"
      ? `H.No. ${currentVoter.houseNo}`
      : "",
    currentVoter.ward ? `Ward ${currentVoter.ward}` : "",
    currentVoter.district,
    currentVoter.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <ChevronLeft color="#0F766E" size={24} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Voter Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* === COMPACT HERO SECTION === */}
        <View style={styles.heroCard}>
          {/* Top Row: Avatar & Name */}
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => void pickVoterImage()}
              style={styles.avatarWrapper}
            >
              <VoterAvatar voter={currentVoter} />
              <View style={styles.avatarEditBadge}>
                <ImagePlus color="#0F766E" size={12} strokeWidth={3} />
              </View>
            </Pressable>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <Pressable
                  onPress={markVoted}
                  disabled={!electionDay || currentVoter.voted || markingVoted}
                  style={styles.namePressable}
                >
                  <Text style={styles.name} numberOfLines={2}>
                    {currentVoter.name}
                  </Text>
                  {currentVoter.hindiName ? (
                    <Text style={styles.hindiName} numberOfLines={1}>
                      {currentVoter.hindiName}
                    </Text>
                  ) : null}

                  {/* Age & Gender under the name */}
                  <Text style={styles.ageGenderText}>
                    {currentVoter.age ? `${currentVoter.age} Yrs` : "Age N/A"} •{" "}
                    {currentVoter.gender || "Gender N/A"}
                  </Text>
                </Pressable>
              </View>

              {currentVoter.voted ? (
                <View style={styles.votedBadge}>
                  <BadgeCheck size={14} color="#FFFFFF" />
                  <Text style={styles.votedBadgeText}>Voted</Text>
                </View>
              ) : electionDay ? (
                <Pressable
                  onPress={markVoted}
                  disabled={markingVoted}
                  style={styles.voteHint}
                >
                  {markingVoted ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Vote size={12} color="#FFFFFF" />
                      <Text style={styles.voteHintText}>Mark Voted</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Bottom Row: Compact Info Grid */}
          <View style={styles.heroCompactGrid}>
            <View style={styles.heroCompactItem}>
              <Text style={styles.heroCompactLabel}>EPIC NO.</Text>
              <Text style={styles.heroCompactValue}>
                {formatEpicNo(currentVoter.epicNo)}
              </Text>
            </View>
            <View style={styles.heroCompactItem}>
              <Text style={styles.heroCompactLabel}>SERIAL NO.</Text>
              <Text style={styles.heroCompactValue}>
                {currentVoter.serialNo || "N/A"}
              </Text>
            </View>
            <View style={styles.heroCompactItem}>
              {/* Booth Number replacing Age/Gender here */}
              <Text style={styles.heroCompactLabel}>BOOTH NO.</Text>
              <Text style={styles.heroCompactValue}>
                {currentVoter.booth || "N/A"}
              </Text>
            </View>
          </View>

          {/* Polling Station Row */}
          <View style={styles.heroLocationContainer}>
            <View style={styles.heroLocationRow}>
              <MapPin size={14} color="#CCFBF1" />
              <Text style={styles.heroLocationLabel}>Polling Station:</Text>
              <Text style={styles.heroLocationValue} numberOfLines={1}>
                {currentVoter.pollingStation || "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* === INFO SECTIONS === */}
        <View style={styles.sectionGrid}>
          {/* Personal Details */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <User size={16} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Personal</Text>
            </View>
            <View style={styles.sectionContent}>
              <DetailRow
                label={relationLabel}
                value={currentVoter.guardian || "N/A"}
              />
              <DetailRow
                label="WhatsApp"
                value={currentVoter.whatsappNumber || "N/A"}
              />
              <DetailRow
                label="Education"
                value={currentVoter.education || "N/A"}
              />
            </View>
          </View>

          {/* Categories */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Layers size={16} color="#0891B2" />
              <Text style={styles.sectionTitle}>Categories</Text>
            </View>
            <View style={styles.sectionContent}>
              <DetailRow
                label="Economic"
                value={currentVoter.economicCategory || "N/A"}
              />
              <DetailRow
                label="Social"
                value={currentVoter.socialCategory || "N/A"}
              />
              <DetailRow
                label="Ration"
                value={currentVoter.rationCategory || "N/A"}
              />
            </View>
          </View>

          {/* Occupation */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Briefcase size={16} color="#D97706" />
              <Text style={styles.sectionTitle}>Occupation</Text>
            </View>
            <View style={styles.sectionContent}>
              <DetailRow
                label="Working"
                value={currentVoter.working || "N/A"}
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Home size={16} color="#DC2626" />
              <Text style={styles.sectionTitle}>Address</Text>
            </View>
            <View style={styles.sectionContent}>
              <DetailRow
                label="Full Address"
                value={fullAddress || "N/A"}
                multiline
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        <Pressable
          onPress={() => {
            setSelectedVoter(currentVoter);
            router.push({
              pathname: "./voter-edit",
              params: { id: currentVoter.id },
            });
          }}
          style={styles.editButton}
        >
          <Pencil color="#0F766E" size={18} strokeWidth={2.5} />
          <Text style={styles.editButtonText}>Edit Details</Text>
        </Pressable>
        <Pressable
          onPress={() => setDeleteModalVisible(true)}
          style={styles.deleteButton}
        >
          <Trash2 color="#DC2626" size={18} strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent
        visible={deleteModalVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!deletingVoter) setDeleteModalVisible(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            if (!deletingVoter) setDeleteModalVisible(false);
          }}
        >
          <Pressable style={styles.deleteConfirmPanel}>
            <Text style={styles.deleteConfirmTitle}>Delete voter?</Text>
            <Text style={styles.deleteConfirmMessage}>
              {currentVoter.name} will be removed from this voter list.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <Pressable
                disabled={deletingVoter}
                onPress={() => setDeleteModalVisible(false)}
                style={[
                  styles.deleteCancelButton,
                  deletingVoter && styles.disabledButton,
                ]}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={deletingVoter}
                onPress={() => void executeDelete()}
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
      </Modal>
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

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const isEmpty = !value || value === "N/A";
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.detailValue, isEmpty && styles.detailValueEmpty]}
        numberOfLines={multiline ? undefined : 1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  scroll: { padding: 16, paddingBottom: 100, gap: 16 },

  // --- COMPACT HERO SECTION ---
  heroCard: {
    backgroundColor: "#0F766E",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0F766E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#CCFBF1",
  },
  avatarImage: { width: 66, height: 66, borderRadius: 33 },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  heroInfo: { flex: 1, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "flex-start" },
  namePressable: { flex: 1 },
  name: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", lineHeight: 24 },
  hindiName: {
    color: "#CCFBF1",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  ageGenderText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  votedBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  voteHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  voteHintText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  // Compact Info Grid inside Hero
  heroCompactGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  heroCompactItem: { flex: 1 },
  heroCompactLabel: {
    color: "#CCFBF1",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  heroCompactValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },

  // Polling Station Container
  heroLocationContainer: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 10,
    padding: 10,
  },
  heroLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroLocationLabel: { color: "#CCFBF1", fontSize: 11, fontWeight: "700" },
  heroLocationValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },

  // --- INFO SECTIONS GRID ---
  sectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    width: "48%", // Two columns
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sectionTitle: { color: "#334155", fontSize: 12, fontWeight: "800" },
  sectionContent: { paddingHorizontal: 12, paddingVertical: 4 },

  // Detail Rows
  detailRow: {
    flexDirection: "column",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    gap: 2,
  },
  detailLabel: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  detailValue: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  detailValueEmpty: {
    color: "#94A3B8",
    fontWeight: "500",
    fontStyle: "italic",
  },

  // Bottom Action Bar
  bottomActionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    height: 50,
    borderRadius: 14,
  },
  editButtonText: { color: "#0F766E", fontSize: 15, fontWeight: "800" },
  deleteButton: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
  },

  // Empty State
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { color: "#64748B", fontWeight: "700", fontSize: 16 },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  deleteConfirmPanel: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  deleteConfirmTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  deleteConfirmMessage: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  deleteConfirmActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  deleteCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: { color: "#334155", fontSize: 13, fontWeight: "900" },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteConfirmText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
});
