import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getVoterIdFromQrData(data: string): string | null {
  const trimmed = data.trim();

  try {
    const url = new URL(trimmed);
    const voterId =
      url.searchParams.get("voterId") ?? url.searchParams.get("id");
    if (voterId) return voterId.trim();
  } catch {
    // Plain text QR codes are handled below.
  }

  const epicNoMatch = trimmed.match(/^Epic No\s*:\s*(.+)$/im);
  if (epicNoMatch?.[1]) return epicNoMatch[1].trim();

  const voterIdMatch = trimmed.match(/^Voter ID\s*:\s*(.+)$/im);
  if (voterIdMatch?.[1]) return voterIdMatch[1].trim();

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;

  return null;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Loading camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.msg}>Camera permission needed</Text>
        <Pressable onPress={requestPermission} style={styles.btn}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function handleScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const voterId = getVoterIdFromQrData(data);
    if (voterId) {
      router.replace({
        pathname: "/politician/voter-slip",
        params: { voterId },
      });
      return;
    }

    setTimeout(() => setScanned(false), 1500);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Align QR inside the frame</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  msg: { color: "#0F172A", fontWeight: "800", marginBottom: 12 },
  btn: {
    backgroundColor: "#087568",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: { color: "#FFFFFF", fontWeight: "900" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 20,
  },
  hint: {
    color: "#FFFFFF",
    fontWeight: "800",
    marginTop: 16,
    fontSize: 14,
  },
});
