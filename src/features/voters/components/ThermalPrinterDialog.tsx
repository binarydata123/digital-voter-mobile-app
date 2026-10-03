import { Bluetooth, Printer, RefreshCw, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getSavedThermalPrinter,
  isLikelyThermalPrinter,
  listThermalPrinters,
  openThermalPrinterSettings,
  pairThermalPrinter,
  printThermalTestReceipt,
  printThermalVoterSlip,
  type ThermalPrinterDevice,
} from "@/services/thermal-printer";
import type { Voter } from "@/services/voters";

type ThermalPrinterDialogProps = {
  onClose: () => void;
  onPrinted?: () => void;
  visible: boolean;
  voter: Voter | null;
  bannerImage?: string;
  showBanner?: boolean;
};

export function ThermalPrinterDialog({
  onClose,
  onPrinted,
  visible,
  voter,
  bannerImage,
  showBanner = false,
}: ThermalPrinterDialogProps) {
  const [devices, setDevices] = useState<ThermalPrinterDevice[]>([]);
  const [selected, setSelected] = useState<ThermalPrinterDevice | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [printing, setPrinting] = useState(false);

  const loadPrinters = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const printers = await listThermalPrinters();
      setDevices(printers);
      const firstLikelyPrinter = printers.find(isLikelyThermalPrinter) ?? null;
      setSelected((current) =>
        current && printers.some((printer) => printer.address === current.address)
          ? current
          : firstLikelyPrinter,
      );

      if (!printers.length) {
        Alert.alert(
          "No printer found",
          "Turn on your printer, pair it in Android Bluetooth settings, then try again.",
        );
      }
    } catch {
      Alert.alert(
        "Scan unavailable",
        "Android rejected the live scan. Pair your printer in the Bluetooth screen, then return here and tap Scan again.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Bluetooth settings",
            onPress: () => {
              void openThermalPrinterSettings().catch((settingsError) => {
                Alert.alert(
                  "Unable to open settings",
                  settingsError?.message ?? "Open Android Bluetooth settings manually.",
                );
              });
            },
          },
        ],
      );
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;

    getSavedThermalPrinter().then((printer) => {
      if (printer) setSelected(printer);
    });
  }, [visible]);

  async function handleTestPrint() {
    if (!selected || printing) return;
    setPrinting(true);
    try {
      await printThermalTestReceipt(selected);
      Alert.alert("Test sent", "The test receipt was sent to the selected printer.");
    } catch (error: any) {
      Alert.alert("Test print failed", error?.message ?? "Unable to print the test receipt.");
    } finally {
      setPrinting(false);
    }
  }

  async function handlePairDevice() {
    if (!selected || printing) return;
    setPrinting(true);
    try {
      await pairThermalPrinter(selected);
      const pairedDevice = { ...selected, isPaired: true };
      setSelected(pairedDevice);
      setDevices((current) =>
        current.map((device) =>
          device.address === pairedDevice.address ? pairedDevice : device,
        ),
      );
      Alert.alert(
        "Printer connected",
        "The printer is paired and ready. You can now test print or print the voter slip.",
      );
    } catch (error: any) {
      Alert.alert(
        "Pairing failed",
        error?.message ?? "Unable to pair with this Bluetooth device.",
      );
    } finally {
      setPrinting(false);
    }
  }

  async function handlePrintVoter() {
    if (!selected || !voter || printing) return;
    setPrinting(true);
    try {
      await printThermalVoterSlip(voter, selected, { bannerImage, showBanner });
      onPrinted?.();
      onClose();
    } catch (error: any) {
      Alert.alert("Voter slip print failed", error?.message ?? "Unable to print the voter slip.");
    } finally {
      setPrinting(false);
    }
  }

  const pairedDevices = devices.filter(
    (device) => device.isPaired,
  );
  const nearbyDevices = devices.filter(
    (device) => !device.isPaired,
  );

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Bluetooth color="#087568" size={20} strokeWidth={2.8} />
              <Text style={styles.title}>Bluetooth Thermal Printer</Text>
            </View>
            <Pressable accessibilityLabel="Close printer" onPress={onClose} style={styles.close}>
              <X color="#475569" size={19} strokeWidth={2.7} />
            </Pressable>
          </View>

          <Text style={styles.description}>
            Scan all nearby Bluetooth devices, select one, then pair it directly from this screen.
          </Text>

          <Pressable
            disabled={loadingDevices || printing}
            onPress={loadPrinters}
            style={[styles.findButton, (loadingDevices || printing) && styles.disabled]}>
            {loadingDevices ? <ActivityIndicator color="#087568" size="small" /> : <RefreshCw color="#087568" size={16} strokeWidth={2.8} />}
            <Text style={styles.findButtonText}>Scan nearby Bluetooth devices</Text>
          </Pressable>

          {selected && !devices.some((device) => device.address === selected.address) ? (
            <Text style={styles.savedPrinter}>Saved printer: {selected.name || selected.address}</Text>
          ) : null}

          <ScrollView
            style={styles.deviceScroll}
            contentContainerStyle={styles.deviceScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled>
            {pairedDevices.length ? (
              <Text style={styles.sectionTitle}>Paired devices</Text>
            ) : null}
            <View style={styles.deviceList}>
              {pairedDevices.map((device) => {
                const isSelected = selected?.address === device.address;
                return (
                  <Pressable
                    key={device.address}
                    onPress={() => setSelected(device)}
                    style={[styles.deviceRow, isSelected && styles.deviceRowSelected]}>
                    <Printer color={isSelected ? "#FFFFFF" : "#087568"} size={18} strokeWidth={2.5} />
                    <View style={styles.deviceCopy}>
                      <Text style={[styles.deviceName, isSelected && styles.deviceTextSelected]}>
                        {device.name || "Bluetooth printer"}
                      </Text>
                      <Text style={[styles.deviceAddress, isSelected && styles.deviceTextSelected]}>{device.address}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {nearbyDevices.length ? (
              <Text style={styles.sectionTitle}>Nearby unpaired devices</Text>
            ) : null}
            <View style={styles.deviceList}>
              {nearbyDevices.map((device) => {
                const isSelected = selected?.address === device.address;
                return (
                  <Pressable
                    key={device.address}
                    onPress={() => setSelected(device)}
                    style={[styles.deviceRow, isSelected && styles.deviceRowSelected]}>
                    <Bluetooth color={isSelected ? "#FFFFFF" : "#087568"} size={18} strokeWidth={2.5} />
                    <View style={styles.deviceCopy}>
                      <Text style={[styles.deviceName, isSelected && styles.deviceTextSelected]}>
                        {device.name || "Unnamed Bluetooth device"}
                      </Text>
                      <Text style={[styles.deviceAddress, isSelected && styles.deviceTextSelected]}>{device.address}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {!selected?.isPaired ? (
              <Pressable
                disabled={!selected || printing}
                onPress={handlePairDevice}
                style={[styles.pairButton, (!selected || printing) && styles.disabled]}>
                {printing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Bluetooth color="#FFFFFF" size={16} strokeWidth={2.6} />}
                <Text style={styles.printButtonText}>Pair device</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  disabled={printing}
                  onPress={handleTestPrint}
                  style={[styles.testButton, printing && styles.disabled]}>
                  <Text style={styles.testButtonText}>Test Print</Text>
                </Pressable>
                <Pressable
                  disabled={!voter || printing}
                  onPress={handlePrintVoter}
                  style={[styles.printButton, (!voter || printing) && styles.disabled]}>
                  {printing ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Printer color="#FFFFFF" size={16} strokeWidth={2.6} />}
                  <Text style={styles.printButtonText}>Print Voter Slip</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  backdrop: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.55)", flex: 1, justifyContent: "center", padding: 20 },
  close: { alignItems: "center", height: 34, justifyContent: "center", width: 34 },
  description: { color: "#64748B", fontSize: 13, lineHeight: 19, marginTop: 12 },
  deviceAddress: { color: "#64748B", fontSize: 12, marginTop: 2 },
  deviceCopy: { flex: 1 },
  deviceList: { gap: 8, marginTop: 8 },
  deviceScroll: { flexGrow: 0, flexShrink: 1, marginTop: 12, maxHeight: 270 },
  deviceScrollContent: { paddingBottom: 2 },
  deviceName: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  deviceRow: { alignItems: "center", borderColor: "#CCFBF1", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  deviceRowSelected: { backgroundColor: "#087568", borderColor: "#087568" },
  deviceTextSelected: { color: "#FFFFFF" },
  disabled: { opacity: 0.5 },
  findButton: { alignItems: "center", backgroundColor: "#F0FDFA", borderColor: "#99F6E4", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 16, minHeight: 44 },
  findButtonText: { color: "#087568", fontSize: 13, fontWeight: "900" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerCopy: { alignItems: "center", flexDirection: "row", gap: 9 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 20, maxHeight: "88%", maxWidth: 430, padding: 20, width: "100%" },
  printButton: { alignItems: "center", backgroundColor: "#087568", borderRadius: 10, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46 },
  printButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  pairButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 10, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 46 },
  savedPrinter: { color: "#087568", fontSize: 12, fontWeight: "700", marginTop: 12 },
  sectionTitle: { color: "#334155", fontSize: 12, fontWeight: "900", marginTop: 16, textTransform: "uppercase" },
  testButton: { alignItems: "center", borderColor: "#14B8A6", borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46 },
  testButtonText: { color: "#087568", fontSize: 13, fontWeight: "900" },
  title: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
});
