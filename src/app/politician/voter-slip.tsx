import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/common/EmptyState";
import { VoterSlipPreview } from "@/features/voters/components/VoterSlipPreview";
import {
  fetchVoterById,
  getSelectedVoter,
  type Voter,
} from "@/services/voters";

export default function VoterSlipScreen() {
  const { voterId } = useLocalSearchParams<{ voterId?: string }>();
  const selectedVoter = getSelectedVoter();
  const canUseSelectedVoter = Boolean(
    selectedVoter &&
      (!voterId ||
        selectedVoter.id === voterId ||
        selectedVoter.epicNo === voterId),
  );
  const [voter, setVoter] = useState<Voter | null>(
    canUseSelectedVoter ? selectedVoter : null,
  );
  const [loading, setLoading] = useState(
    Boolean(voterId && !canUseSelectedVoter),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadVoter() {
      if (!voterId || canUseSelectedVoter) return;

      setLoading(true);
      const nextVoter = await fetchVoterById(voterId);
      if (isMounted) {
        setVoter(nextVoter);
        setLoading(false);
      }
    }

    loadVoter();

    return () => {
      isMounted = false;
    };
  }, [canUseSelectedVoter, voterId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color="#087568" />
          <Text style={styles.loadingText}>Loading voter slip...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!voter) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <EmptyState
            title="Voter slip not found"
            message="Scan a valid voter QR code or open a voter card again."
          />
          <Pressable onPress={() => router.back()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <VoterSlipPreview
      voter={voter}
      onClose={() => router.back()}
      variant="page"
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  centered: { flex: 1, padding: 18, justifyContent: "center", gap: 14 },
  loadingText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
