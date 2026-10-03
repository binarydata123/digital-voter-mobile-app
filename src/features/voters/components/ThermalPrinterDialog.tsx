import {
  Bluetooth,
  Check,
  Printer,
  RefreshCw,
  Smartphone,
  X,
  Zap,
} from "lucide-react-native";
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
  const [hasScanned, setHasScanned] = useState(false);
  const [printing, setPrinting] = useState(false);

  const loadPrinters = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const printers = await listThermalPrinters();
      setDevices(printers);
      setHasScanned(true);
      const firstLikelyPrinter = printers.find(isLikelyThermalPrinter) ?? null;
      setSelected((current) =>
        current &&
        printers.some((printer) => printer.address === current.address)
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
      setHasScanned(true);
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
                  settingsError?.message ??
                    "Open Android Bluetooth settings manually.",
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
      Alert.alert(
        "Test sent",
        "The test receipt was sent to the selected printer.",
      );
    } catch (error: any) {
      Alert.alert(
        "Test print failed",
        error?.message ?? "Unable to print the test receipt.",
      );
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
      Alert.alert(
        "Voter slip print failed",
        error?.message ?? "Unable to print the voter slip.",
      );
    } finally {
      setPrinting(false);
    }
  }

  function openBluetoothPairing() {
    void openThermalPrinterSettings().catch((error: any) => {
      Alert.alert(
        "Unable to open Bluetooth settings",
        error?.message ?? "Open Android Bluetooth settings manually.",
      );
    });
  }

  const pairedDevices = devices.filter((device) => device.isPaired);
  const nearbyDevices = devices.filter((device) => !device.isPaired);
  const isBusy = loadingDevices || printing;
  const showPairNewRow = hasScanned && !nearbyDevices.length && !loadingDevices;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => event.stopPropagation()}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Bluetooth color="#FFFFFF" size={18} strokeWidth={2.8} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Thermal Printer</Text>
              <Text style={styles.subtitle}>Bluetooth device setup</Text>
            </View>
            <Pressable
              accessibilityLabel="Close printer"
              onPress={onClose}
              style={styles.close}
              hitSlop={8}>
              <X color="#64748B" size={18} strokeWidth={2.8} />
            </Pressable>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Select a paired printer or scan to find a new one nearby.
          </Text>

          {/* Scan button */}
          <Pressable
            disabled={isBusy}
            onPress={loadPrinters}
            style={({ pressed }) => [
              styles.scanButton,
              isBusy && styles.disabled,
              pressed && !isBusy && styles.scanButtonPressed,
            ]}>
            {loadingDevices ? (
              <ActivityIndicator color="#087568" size="small" />
            ) : (
              <RefreshCw color="#087568" size={16} strokeWidth={2.8} />
            )}
            <Text style={styles.scanButtonText}>
              {loadingDevices ? "Scanning…" : "Scan nearby devices"}
            </Text>
          </Pressable>

          {/* Pair new device — quick access row */}
          {showPairNewRow ? (
            <View style={styles.pairNewRow}>
              <Text style={styles.pairNewText}>Printer not listed?</Text>
              <Pressable
                onPress={openBluetoothPairing}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.pairNewButton,
                  pressed && styles.pairNewButtonPressed,
                ]}>
                <Bluetooth color="#FFFFFF" size={14} strokeWidth={2.8} />
                <Text style={styles.pairNewButtonText}>Pair new device</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Empty state */}
          {hasScanned && !devices.length && !loadingDevices ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Smartphone color="#94A3B8" size={26} strokeWidth={2.2} />
              </View>
              <Text style={styles.emptyTitle}>No printers found</Text>
              <Text style={styles.emptyBody}>
                Make sure your printer is on and paired in Bluetooth settings.
              </Text>
              <Pressable onPress={openBluetoothPairing} style={styles.emptyCta}>
                <Bluetooth color="#087568" size={14} strokeWidth={2.6} />
                <Text style={styles.emptyCtaText}>Open Bluetooth settings</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Saved printer notice */}
          {selected &&
          !devices.some((device) => device.address === selected.address) ? (
            <View style={styles.savedNotice}>
              <Check color="#087568" size={14} strokeWidth={3} />
              <Text style={styles.savedNoticeText} numberOfLines={1}>
                Saved: {selected.name || selected.address}
              </Text>
            </View>
          ) : null}

          {/* Device list */}
          {devices.length ? (
            <ScrollView
              style={styles.deviceScroll}
              contentContainerStyle={styles.deviceScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              {pairedDevices.length ? (
                <Text style={styles.sectionTitle}>Paired</Text>
              ) : null}
              <View style={styles.deviceList}>
                {pairedDevices.map((device) => {
                  const isSelected = selected?.address === device.address;
                  return (
                    <Pressable
                      key={device.address}
                      onPress={() => setSelected(device)}
                      style={({ pressed }) => [
                        styles.deviceRow,
                        isSelected && styles.deviceRowSelected,
                        pressed && !isSelected && styles.deviceRowPressed,
                      ]}>
                      <View
                        style={[
                          styles.deviceIcon,
                          isSelected && styles.deviceIconSelected,
                        ]}>
                        <Printer
                          color={isSelected ? "#087568" : "#FFFFFF"}
                          size={16}
                          strokeWidth={2.6}
                        />
                      </View>
                      <View style={styles.deviceCopy}>
                        <Text
                          style={[
                            styles.deviceName,
                            isSelected && styles.deviceTextSelected,
                          ]}
                          numberOfLines={1}>
                          {device.name || "Bluetooth printer"}
                        </Text>
                        <Text
                          style={[
                            styles.deviceAddress,
                            isSelected && styles.deviceTextSelected,
                          ]}
                          numberOfLines={1}>
                          {device.address}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.selectedBadge}>
                          <Check color="#FFFFFF" size={12} strokeWidth={3.2} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {nearbyDevices.length ? (
                <Text style={styles.sectionTitle}>Nearby unpaired</Text>
              ) : null}
              <View style={styles.deviceList}>
                {nearbyDevices.map((device) => {
                  const isSelected = selected?.address === device.address;
                  return (
                    <Pressable
                      key={device.address}
                      onPress={() => setSelected(device)}
                      style={({ pressed }) => [
                        styles.deviceRow,
                        isSelected && styles.deviceRowSelected,
                        pressed && !isSelected && styles.deviceRowPressed,
                      ]}>
                      <View
                        style={[
                          styles.deviceIcon,
                          styles.deviceIconUnpaired,
                          isSelected && styles.deviceIconSelected,
                        ]}>
                        <Bluetooth
                          color="#087568"
                          size={16}
                          strokeWidth={2.6}
                        />
                      </View>
                      <View style={styles.deviceCopy}>
                        <Text
                          style={[
                            styles.deviceName,
                            isSelected && styles.deviceTextSelected,
                          ]}
                          numberOfLines={1}>
                          {device.name || "Unnamed device"}
                        </Text>
                        <Text
                          style={[
                            styles.deviceAddress,
                            isSelected && styles.deviceTextSelected,
                          ]}
                          numberOfLines={1}>
                          {device.address}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.selectedBadge}>
                          <Check color="#FFFFFF" size={12} strokeWidth={3.2} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            {!selected?.isPaired ? (
              <Pressable
                disabled={!selected || printing}
                onPress={handlePairDevice}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!selected || printing) && styles.disabled,
                  pressed &&
                    selected &&
                    !printing &&
                    styles.primaryButtonPressed,
                ]}>
                {printing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Zap color="#FFFFFF" size={16} strokeWidth={2.8} />
                )}
                <Text style={styles.primaryButtonText}>Pair device</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  disabled={printing}
                  onPress={handleTestPrint}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    printing && styles.disabled,
                    pressed && !printing && styles.secondaryButtonPressed,
                  ]}>
                  <Text style={styles.secondaryButtonText}>Test print</Text>
                </Pressable>
                <Pressable
                  disabled={!voter || printing}
                  onPress={handlePrintVoter}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.primaryButtonFlex,
                    (!voter || printing) && styles.disabled,
                    pressed &&
                      voter &&
                      !printing &&
                      styles.primaryButtonPressed,
                  ]}>
                  {printing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Printer color="#FFFFFF" size={16} strokeWidth={2.8} />
                  )}
                  <Text style={styles.primaryButtonText}>Print slip</Text>
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
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flex: 1,
    justifyContent: "flex-end",
  },
  close: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  description: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  deviceAddress: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  deviceCopy: {
    flex: 1,
  },
  deviceIcon: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  deviceIconSelected: {
    backgroundColor: "#CCFBF1",
  },
  deviceIconUnpaired: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderWidth: 1,
  },
  deviceList: {
    gap: 8,
    marginTop: 8,
  },
  deviceName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  deviceRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  deviceRowPressed: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  deviceRowSelected: {
    backgroundColor: "#F0FDFA",
    borderColor: "#087568",
    borderWidth: 1.5,
  },
  deviceScroll: {
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 14,
    maxHeight: 280,
  },
  deviceScrollContent: {
    paddingBottom: 4,
  },
  deviceTextSelected: {
    color: "#0F766E",
  },
  disabled: {
    opacity: 0.45,
  },
  emptyBody: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  emptyCta: {
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyCtaText: {
    color: "#087568",
    fontSize: 12.5,
    fontWeight: "900",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    marginBottom: 12,
    width: 52,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "900",
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 40,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerIconWrap: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  pairNewButton: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#087568",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  pairNewButtonPressed: {
    backgroundColor: "#065F55",
    transform: [{ scale: 0.97 }],
  },
  pairNewButtonText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  pairNewRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  pairNewText: {
    color: "#64748B",
    fontSize: 12.5,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonFlex: {
    flex: 1,
  },
  primaryButtonPressed: {
    backgroundColor: "#065F55",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  savedNotice: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  savedNoticeText: {
    color: "#087568",
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
  },
  scanButtonPressed: {
    backgroundColor: "#CCFBF1",
  },
  scanButtonText: {
    color: "#087568",
    fontSize: 13.5,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#14B8A6",
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  secondaryButtonPressed: {
    backgroundColor: "#F0FDFA",
  },
  secondaryButtonText: {
    color: "#087568",
    fontSize: 14,
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 16,
    textTransform: "uppercase",
  },
  selectedBadge: {
    alignItems: "center",
    backgroundColor: "#087568",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxWidth: 480,
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    width: "100%",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  title: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
});
