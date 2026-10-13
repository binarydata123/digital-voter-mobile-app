import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { WebView } from "react-native-webview";

import type { SurveyLocationPoint } from "@/services/survey";
import {
  buildSurveyLocationMapHtml,
  getSurveyLocationMapRegion,
  getValidSurveyLocations,
} from "./surveyLocationMapHtml";

function formatLocationTime(capturedAt?: string) {
  if (!capturedAt) return "";
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function SurveyLocationMap({
  locations,
  onInteractionChange,
}: {
  locations: SurveyLocationPoint[];
  onInteractionChange?: (isInteracting: boolean) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const validLocations = useMemo(
    () => getValidSurveyLocations(locations),
    [locations],
  );
  const region = useMemo(
    () =>
      validLocations.length ? getSurveyLocationMapRegion(validLocations) : null,
    [validLocations],
  );
  const mapHtml = useMemo(
    () => buildSurveyLocationMapHtml(validLocations),
    [validLocations],
  );

  useEffect(() => {
    if (Platform.OS === "android" || !mapRef.current || !region) {
      return;
    }

    mapRef.current.fitToCoordinates(
      validLocations.map((location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      {
        animated: false,
        edgePadding: { bottom: 32, left: 32, right: 32, top: 32 },
      },
    );
  }, [region, validLocations]);

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
          style={styles.map}>
          {Platform.OS === "android" ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: mapHtml }}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled
              overScrollMode="never"
            />
          ) : (
            <MapView
              ref={mapRef}
              initialRegion={region ?? undefined}
              style={styles.nativeMap}
              mapType="standard"
              scrollEnabled
              zoomEnabled
              pitchEnabled
              rotateEnabled
              showsCompass={false}
              showsUserLocation={false}>
              {validLocations.map((location, index) => (
                <Marker
                  key={
                    location.id ??
                    `${location.latitude}-${location.longitude}-${index}`
                  }
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  pinColor="#DC2626"
                  title={
                    location.location ??
                    location.wardNo ??
                    `Survey ${index + 1}`
                  }
                  description={
                    [
                      location.wardNo && location.location !== location.wardNo
                        ? `Ward ${location.wardNo}`
                        : "",
                      location.preferredPolitician
                        ? `${location.preferredPolitician}${location.preferredParty ? ` (${location.preferredParty})` : ""}`
                        : "",
                      formatLocationTime(location.capturedAt),
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                />
              ))}
            </MapView>
          )}
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
  map: {
    borderRadius: 8,
    height: 240,
    overflow: "hidden",
    width: "100%",
  },
  nativeMap: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
});
