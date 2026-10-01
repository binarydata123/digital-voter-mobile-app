import { StyleSheet, View } from "react-native";

const SKELETON_ROWS = ["one", "two", "three", "four"];

export function VoterListSkeleton() {
  return (
    <View accessibilityLabel="Loading voters" style={styles.list}>
      {SKELETON_ROWS.map((key) => (
        <View key={key} style={styles.card}>
          <View style={styles.topRow}>
            <View style={[styles.block, styles.avatar]} />
            <View style={styles.copy}>
              <View style={[styles.block, styles.name]} />
              <View style={[styles.block, styles.meta]} />
              <View style={[styles.block, styles.guardian]} />
            </View>
          </View>
          <View style={styles.footer}>
            <View style={[styles.block, styles.infoTile]} />
            <View style={[styles.block, styles.infoTile]} />
            <View style={[styles.block, styles.action]} />
            <View style={[styles.block, styles.action]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6, paddingTop: 2 },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE8EF",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  topRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  block: { backgroundColor: "#E7F0F2" },
  avatar: { borderRadius: 30, height: 60, width: 60 },
  copy: { flex: 1, gap: 8 },
  name: { borderRadius: 6, height: 16, width: "58%" },
  meta: { borderRadius: 5, height: 12, width: "38%" },
  guardian: { borderRadius: 5, height: 12, width: "72%" },
  footer: { flexDirection: "row", gap: 6, marginTop: 10 },
  infoTile: { borderRadius: 12, flex: 1, height: 50 },
  action: { borderRadius: 12, height: 45, width: 45 },
});
