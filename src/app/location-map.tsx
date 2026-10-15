import {
  buildSurveyLocationMapHtml,
  getSurveyLocationMapRegion,
  getValidSurveyLocations,
} from "@/features/survey/components/surveyLocationMapHtml";
import {
  fetchSurveyLocations,
  getAssignedSurveyScope,
  type SurveyLocationPoint,
} from "@/services/survey";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

declare const require: <T = unknown>(moduleName: string) => T;

type NativeMapsModule = {
  default: ComponentType<any>;
  Marker: ComponentType<any>;
};

type NativeWebViewModule = {
  WebView: ComponentType<any>;
};

function getNativeMaps() {
  return require<NativeMapsModule>("react-native-maps");
}

function getNativeWebView() {
  return require<NativeWebViewModule>("react-native-webview");
}

function formatLocationTime(capturedAt?: string) {
  if (!capturedAt) return "";
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function LocationMapScreen() {
  const mapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState<SurveyLocationPoint[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadLocations() {
      setLoading(true);
      setError("");

      try {
        const scope = await getAssignedSurveyScope();
        const nextLocations = await fetchSurveyLocations(scope);
        if (mounted) {
          setLocations(nextLocations);
        }
      } catch (loadError: any) {
        if (mounted) {
          setError(
            loadError?.response?.data?.message ??
              loadError?.message ??
              "Map could not load.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadLocations();

    return () => {
      mounted = false;
    };
  }, []);

  const validLocations = useMemo(
    () => getValidSurveyLocations(locations),
    [locations],
  );
  const mapHtml = useMemo(
    () => buildSurveyLocationMapHtml(validLocations),
    [validLocations],
  );
  const region = useMemo(
    () =>
      validLocations.length ? getSurveyLocationMapRegion(validLocations) : null,
    [validLocations],
  );

  useEffect(() => {
    if (Platform.OS !== "ios" || !mapRef.current || !region) {
      return;
    }

    mapRef.current.fitToCoordinates(
      validLocations.map((location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      {
        animated: false,
        edgePadding: { bottom: 48, left: 40, right: 40, top: 48 },
      },
    );
  }, [region, validLocations]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F4C4E" />
        <Text>Loading map...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Map could not load</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (validLocations.length === 0) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>No saved survey locations yet</Text>
        <Text style={styles.errorText}>
          Submit surveys with location permission enabled to see markers here.
        </Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <iframe
          title="Survey locations map"
          srcDoc={mapHtml}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </View>
    );
  }

  if (Platform.OS === "ios") {
    const { default: MapView, Marker } = getNativeMaps();

    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          initialRegion={region ?? undefined}
          style={styles.map}
          mapType="standard"
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
                location.location ?? location.wardNo ?? `Survey ${index + 1}`
              }
              description={
                [
                  location.wardNo && location.location !== location.wardNo
                    ? `Ward ${location.wardNo}`
                    : "",
                  location.boothNo ? `Booth ${location.boothNo}` : "",
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
      </View>
    );
  }

  const { WebView } = getNativeWebView();

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onError={() => {
          setError("Please check your internet connection.");
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0F4C4E" />
            <Text>Loading map...</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
    backgroundColor: "#F8FAFC",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F4C4E",
    textAlign: "center",
  },
  errorText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
