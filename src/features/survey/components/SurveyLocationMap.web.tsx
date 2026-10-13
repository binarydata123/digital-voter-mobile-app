import { StyleSheet, Text, View } from "react-native";

import type { SurveyLocationPoint } from "@/services/survey";
import {
  buildSurveyLocationMapHtml,
  getValidSurveyLocations,
} from "./surveyLocationMapHtml";

export function SurveyLocationMap({
  locations,
  onInteractionChange,
}: {
  locations: SurveyLocationPoint[];
  onInteractionChange?: (isInteracting: boolean) => void;
}) {
  const validLocations = getValidSurveyLocations(locations);
  const mapHtml = buildSurveyLocationMapHtml(validLocations);

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
        <View
          onTouchCancel={() => onInteractionChange?.(false)}
          onTouchEnd={() => onInteractionChange?.(false)}
          onTouchStart={() => onInteractionChange?.(true)}
          style={styles.mapFrame}>
          <iframe
            title="Survey locations map"
            srcDoc={mapHtml}
            style={{ border: 0, height: "100%", width: "100%" }}
          />
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
  mapFrame: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    height: 280,
    overflow: "hidden",
    width: "100%",
  },
});
