import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, ImagePlus, Pencil, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VoterEditModal } from "@/features/voters/components/VoterEditModal";
import {
  deleteLocalVoter,
  updateLocalVoter,
} from "@/services/local-voters";
import { getCurrentUser } from "@/services/authentication";
import {
  deleteManagedVoter,
  deleteVoterDetails,
  fetchVoterById,
  getSelectedVoter,
  saveManagedVoter,
  updateVoterDetails,
  type Voter,
} from "@/services/voters";

import { getDefaultVoterAvatar } from "@/utils/voterAvatar";


function isUsableImageUri(uri?: string) {
  const value = String(uri ?? "").trim().toLowerCase();
  return Boolean(value && value !== "undefined" && value !== "null");
}

function getRelationLabel(relation?: string): string {
  if (!relation) return "Guardian";
  const n = relation.trim().toLowerCase();
  if (n.includes("father") || n === "पिता") return "पिता का नाम";
  if (n.includes("mother") || n === "माता") return "माता का नाम";
  if (n.includes("husband") || n === "पति") return "पति का नाम";
  if (n.includes("wife") || n === "पत्नी") return "पत्नी का नाम";
  return relation;
}

export default function VoterDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [voter, setVoter] = useState<Voter | null>(getSelectedVoter());
  const [editing, setEditing] = useState(false);

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
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentVoter = voter;

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

  async function saveVoter(nextVoter: Voter) {
    setVoter(nextVoter);
    saveManagedVoter(nextVoter);

    try {
      await updateVoterDetails(nextVoter);
      const politicianId = getCurrentUser()?.id;
      if (politicianId) {
        await updateLocalVoter(politicianId, nextVoter);
      }
      setEditing(false);
    } catch (error: any) {
      Alert.alert(
        "Unable to save voter",
        error?.response?.data?.message ||
          error?.message ||
          "Please check your connection and try again.",
      );
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

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    saveVoter({ ...currentVoter, photoUri: result.assets[0].uri });
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
      <VoterEditModal
        visible={editing}
        voter={currentVoter}
        onClose={() => setEditing(false)}
        onSave={saveVoter}
      />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#0F766E" size={22} strokeWidth={3} />
        </Pressable>
        <Text style={styles.headerTitle}>Voter Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Pressable
            accessibilityLabel="Add or edit voter image"
            onPress={() => void pickVoterImage()}
            style={styles.avatarButton}>
            <VoterAvatar voter={currentVoter} />
            <View style={styles.avatarEditBadge}>
              <ImagePlus color="#FFFFFF" size={14} strokeWidth={3} />
            </View>
          </Pressable>
          <Text style={styles.name}>{currentVoter.name}</Text>
          {currentVoter.hindiName ? (
            <Text style={styles.hindiName}>{currentVoter.hindiName}</Text>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel="Edit voter"
              onPress={() => setEditing(true)}
              style={styles.actionButton}>
              <Pencil color="#087568" size={17} strokeWidth={2.6} />
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Delete voter"
              onPress={confirmDelete}
              style={[styles.actionButton, styles.deleteButton]}>
              <Trash2 color="#B91C1C" size={17} strokeWidth={2.6} />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>

          <Row label="Gender" value={currentVoter.gender || "N/A"} />
          <Row label="Age" value={String(currentVoter.age || "N/A")} />
          <Row label={relationLabel} value={currentVoter.guardian || "N/A"} />
          <Row label="EPIC No." value={currentVoter.epicNo || "N/A"} />
          <Row label="House No." value={currentVoter.houseNo || "N/A"} />
          <Row label="Booth" value={currentVoter.booth || "N/A"} />
          <Row label="Ward" value={currentVoter.ward || "N/A"} />
          <Row
            label="Serial No."
            value={currentVoter.serialNo || currentVoter.id || "N/A"}
          />
          <Block label="Address" value={address || "N/A"} />
          <Block
            label="Polling Station"
            value={currentVoter.pollingStation || "N/A"}
          />
        </View>
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
    <Image
      source={source}
      resizeMode="cover"
      style={styles.avatarImage}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  scroll: { padding: 16, paddingBottom: 28 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
  },
  avatarButton: {
    alignSelf: "center",
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#F0F8FC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 86,
    height: 86,
  },
  avatarEditBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#087568",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: "#070A1C",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  hindiName: {
    color: "#070A1C",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: -6,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  actionText: { color: "#087568", fontSize: 13, fontWeight: "900" },
  deleteText: { color: "#B91C1C", fontSize: 13, fontWeight: "900" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  block: {
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  label: { color: "#64748B", fontSize: 13, fontWeight: "800" },
  value: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "right",
  },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#64748B", fontWeight: "700" },
});
