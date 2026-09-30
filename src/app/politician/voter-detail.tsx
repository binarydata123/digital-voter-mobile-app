import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  fetchVoterById,
  getSelectedVoter,
  type Voter,
} from "@/services/voters";

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
const params = useLocalSearchParams<{ id?: string }>();  const [voter, setVoter] = useState<Voter | null>(getSelectedVoter());

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

  const address = [
    voter.houseNo && voter.houseNo !== "N/A"
      ? `House No. ${voter.houseNo}`
      : "",
    voter.ward ? `Ward ${voter.ward}` : "",
    voter.district,
    voter.state,
  ]
    .filter(Boolean)
    .join(", ");

  const relationLabel = getRelationLabel((voter as any).relation);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#0F766E" size={22} strokeWidth={3} />
        </Pressable>
        <Text style={styles.headerTitle}>Voter Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.name}>{voter.name}</Text>
          {voter.hindiName ? (
            <Text style={styles.hindiName}>{voter.hindiName}</Text>
          ) : null}

          <Row label="Gender" value={voter.gender || "N/A"} />
          <Row label="Age" value={String(voter.age || "N/A")} />
          <Row label={relationLabel} value={voter.guardian || "N/A"} />
          <Row label="EPIC No." value={voter.epicNo || "N/A"} />
          <Row label="House No." value={voter.houseNo || "N/A"} />
          <Row label="Booth" value={voter.booth || "N/A"} />
          <Row label="Ward" value={voter.ward || "N/A"} />
          <Row label="Serial No." value={voter.serialNo || voter.id || "N/A"} />
          <Block label="Address" value={address || "N/A"} />
          <Block
            label="Polling Station"
            value={voter.pollingStation || "N/A"}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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
