import { StyleSheet, Text, View } from "react-native";

import type { SurveyLocationPoint } from "@/services/survey";

export function SurveyLocationMap({
  locations,
}: {
  locations: SurveyLocationPoint[];
}) {
  const validLocations = locations.filter(
    (location) =>
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Survey locations</Text>
        <Text style={styles.chartSubtitle}>
          {`${validLocations.length} saved location${validLocations.length === 1 ? "" : "s"}`}
        </Text>
      </View>
      {validLocations.length === 0 ? (
        <Text style={styles.emptyChartText}>No saved survey locations yet.</Text>
      ) : (
        <View style={styles.mapFallback}>
          {validLocations.slice(0, 8).map((location, index) => (
            <Text
              key={location.id ?? `${location.latitude}-${location.longitude}-${index}`}
              style={styles.mapFallbackText}>
              {`${index + 1}. ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
  },
  chartHeader: { gap: 3 },
  chartTitle: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  chartSubtitle: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  emptyChartText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 4,
  },
  mapFallback: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  mapFallbackText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
});
