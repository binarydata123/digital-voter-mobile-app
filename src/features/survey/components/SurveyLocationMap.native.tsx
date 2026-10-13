import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import type { SurveyLocationPoint } from "@/services/survey";

function getMapRegion(locations: SurveyLocationPoint[]) {
  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeDelta = Math.max(0.01, (maxLatitude - minLatitude) * 1.8);
  const longitudeDelta = Math.max(0.01, (maxLongitude - minLongitude) * 1.8);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

function formatLocationTime(capturedAt?: string) {
  if (!capturedAt) return "";
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

const mapProvider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;

export function SurveyLocationMap({
  locations,
}: {
  locations: SurveyLocationPoint[];
}) {
  const mapRef = useRef<MapView>(null);
  const validLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          Number.isFinite(location.latitude) &&
          Number.isFinite(location.longitude),
      ),
    [locations],
  );
  const region = validLocations.length ? getMapRegion(validLocations) : null;

  useEffect(() => {
    if (!mapRef.current || validLocations.length === 0) {
      return;
    }

    mapRef.current.fitToCoordinates(
      validLocations.map((location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      {
        animated: true,
        edgePadding: { bottom: 44, left: 44, right: 44, top: 44 },
      },
    );
  }, [validLocations]);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Survey locations</Text>
        <Text style={styles.chartSubtitle}>
          {`${validLocations.length} saved location${validLocations.length === 1 ? "" : "s"}`}
        </Text>
      </View>
      {!region ? (
        <Text style={styles.emptyChartText}>No saved survey locations yet.</Text>
      ) : (
        <MapView
          ref={mapRef}
          initialRegion={region}
          provider={mapProvider}
          style={styles.map}
          mapType="standard"
          showsCompass={false}
          showsUserLocation={false}
          toolbarEnabled={false}>
          {validLocations.map((location, index) => (
            <Marker
              key={location.id ?? `${location.latitude}-${location.longitude}-${index}`}
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              pinColor="#DC2626"
              title={location.location ?? location.wardNo ?? `Survey ${index + 1}`}
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
});
