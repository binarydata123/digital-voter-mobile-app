import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function VoterDataSetup() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Image
            source={require("../../../../assets/images/vote.jpeg")}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="right bottom"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.brandBadge}>
            <Text style={styles.brandText}>DIGITAL VOTER</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#087568" size="large" />
          </View>
          <Text style={styles.title}>Setting up your voter data</Text>
          <Text style={styles.description}>
            Please wait while we download and update your voter list.
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Updating voter list</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  container: { flex: 1 },
  hero: {
    height: "36%",
    minHeight: 250,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 24,
  },
  heroImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6, 78, 59, 0.38)",
  },
  brandBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  brandText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F4FBF7",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  loaderWrap: {
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    marginBottom: 18,
    width: 76,
  },
  title: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 330,
    textAlign: "center",
  },
  statusRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1FAE5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusDot: {
    backgroundColor: "#10B981",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusText: { color: "#047857", fontSize: 12, fontWeight: "800" },
});
