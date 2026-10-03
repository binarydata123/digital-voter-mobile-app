import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Bluetooth, Download, Printer, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getSavedThermalPrinter,
  type ThermalPrinterDevice,
} from "@/services/thermal-printer";
import type { Voter } from "@/services/voters";

export type VoterSlipPreviewProps = {
  voter: Voter;
  onClose: () => void;
  showBanner?: boolean;
  bannerImage?: string;
  onDownload?: () => void;
  onPrint?: () => Promise<void> | void;
  onChangeDevice?: () => Promise<void> | void;
  variant?: "modal" | "page";
};

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugFileName(value: unknown) {
  return String(value || "voter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatGuardian(value: string) {
  const text = String(value || "N/A").trim();
  const relationStart = text.lastIndexOf(" (");
  return relationStart > 0 && text.endsWith(")")
    ? text.slice(0, relationStart)
    : text;
}

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || text === "undefined" || text === "null" ? "N/A" : text;
}

function normalizeWhatsAppPhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "91" + digits;
  return digits;
}

function buildWhatsAppMessage(voter: Voter) {
  return [
    "Voter Slip: " + voter.name,
    voter.epicNo ? "EPIC: " + voter.epicNo : "",
    voter.serialNo ? "S.No.: " + voter.serialNo : "",
    voter.booth ? "Booth: " + voter.booth : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function openWhatsAppChat(phone: string, voter: Voter) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone) return false;

  const url =
    "https://wa.me/" +
    normalizedPhone +
    "?text=" +
    encodeURIComponent(buildWhatsAppMessage(voter));

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openWhatsAppRecipientPicker(voter: Voter) {
  const url =
    "https://wa.me/?text=" + encodeURIComponent(buildWhatsAppMessage(voter));

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a local file URI (from require()) or remote URL into a base64
 * data URI so it can be embedded inside the printable HTML.
 */
async function toDataUri(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  if (uri.startsWith("data:")) return uri;
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const lower = uri.toLowerCase();
    const mime = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.log("Banner image convert error:", error);
    return undefined;
  }
}

/* ============================================================
   HTML BUILDER
   ============================================================ */

function buildSlipHtml(
  voter: Voter,
  showBanner: boolean,
  bannerDataUri?: string,
) {
  const address = [
    voter.houseNo && voter.houseNo !== "N/A"
      ? "House No. " + voter.houseNo
      : "",
    voter.ward ? "Ward " + voter.ward : "",
    voter.district,
    voter.state,
  ]
    .filter(Boolean)
    .join(", ");

  const bannerBlock = showBanner
    ? bannerDataUri
      ? `<div class="banner"><img src="${bannerDataUri}" alt="banner" /></div>`
      : `<div class="banner">
           <div class="banner-meta">वार्ड संख्या : ${escapeHtml(voter.ward || "58")}</div>
           <div class="banner-divider"></div>
           <div class="banner-text">मतदान केंद्र पता</div>
           <div class="banner-school">राजकीय उच्च प्राथमिक विद्यालय</div>
           <div class="banner-place">${escapeHtml(voter.district || "श्रीगंगानगर")}</div>
         </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Voter Slip - ${escapeHtml(voter.name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, "Noto Sans Devanagari", sans-serif;
    background: #fff;
    color: #070A1C;
    margin: 0;
    padding: 16px;
  }
  .paper {
    max-width: 420px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #E5E7EB;
    padding: 17px 12px 15px;
  }
  .banner {
    border: 3px solid #2F281F;
    border-radius: 7px;
    padding: 8px 10px;
    margin: 0 22px 8px;
    text-align: center;
    color: #2F281F;
  }
  .banner img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .banner-meta { font-size: 15px; font-weight: 900; }
  .banner-divider { height: 2px; width: 74%; background: #2F281F; margin: 5px auto; }
  .banner-text { font-size: 15px; font-weight: 900; }
  .banner-school { font-size: 19px; line-height: 26px; font-weight: 900; margin-top: 5px; }
  .banner-place { font-size: 18px; font-weight: 900; }
  .slip-title {
    font-size: 32px;
    line-height: 38px;
    font-weight: 900;
    text-align: center;
    margin: 0 0 18px;
  }
  .slip-box {
    border: 1px dashed #93B3D9;
    padding: 18px 12px;
    min-height: 530px;
  }
  .name { font-size: 21px; line-height: 27px; font-weight: 900; text-align: center; }
  .hindi { font-size: 20px; line-height: 27px; font-weight: 900; text-align: center; margin: 3px 0 22px; }
  .row { font-size: 20px; line-height: 29px; font-weight: 900; margin-bottom: 8px; }
  .row b { font-weight: 900; }
  .row.two { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .block { margin-top: 22px; font-size: 20px; line-height: 27px; font-weight: 900; }
</style>
</head>
<body>
  <div class="paper">
    ${bannerBlock}
    <h1 class="slip-title">Voter Slip</h1>
    <div class="slip-box">
      <div class="name">${escapeHtml(voter.name)}</div>
      ${voter.hindiName ? `<div class="hindi">${escapeHtml(voter.hindiName)}</div>` : ""}

      <div class="row two">
        <span>Gender : ${escapeHtml(voter.gender || "N/A")}</span>
        <span>Age : ${escapeHtml(voter.age ?? "N/A")}</span>
      </div>

      <div class="row">पिता का नाम : ${escapeHtml(formatGuardian(voter.guardian))}</div>
      <div class="row">Serial No : ${escapeHtml(voter.serialNo || voter.id || "N/A")}</div>
      <div class="row">Booth No : ${escapeHtml(voter.booth || "N/A")}</div>
      <div class="row">Epic No : ${escapeHtml(voter.epicNo || "N/A")}</div>
      <div class="block">Address : ${escapeHtml(address || "N/A")}</div>
      <div class="block">Polling Station No. &amp; Address : ${escapeHtml(voter.pollingStation || "N/A")}</div>
    </div>
  </div>
</body>
</html>`;
}

/* ============================================================
   DOWNLOAD + PRINT (platform aware)
   ============================================================ */

export async function downloadSlip(
  voter: Voter,
  showBanner: boolean,
  bannerImage?: string,
) {
  const bannerDataUri = showBanner ? await toDataUri(bannerImage) : undefined;
  const html = buildSlipHtml(voter, showBanner, bannerDataUri);
  const fileName = `voter-slip-${slugFileName(voter.epicNo || voter.id)}.html`;

  // --- WEB ---
  if (Platform.OS === "web") {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return;
  }

  // --- NATIVE ---
  try {
    const fileUri = (FileSystem.cacheDirectory ?? "") + fileName;
    await FileSystem.writeAsStringAsync(fileUri, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: "Download Voter Slip",
        UTI: "public.html",
      });
    } else {
      Alert.alert("Saved", `File saved at:\n${fileUri}`);
    }
  } catch (error: any) {
    Alert.alert(
      "Download failed",
      error?.message ?? "Unable to save the slip.",
    );
  }
}

export async function shareVoterSlipPdf(
  voter: Voter,
  showBanner: boolean,
  bannerImage?: string,
  whatsappNumber?: string,
) {
  const bannerDataUri = showBanner ? await toDataUri(bannerImage) : undefined;
  const html = buildSlipHtml(voter, showBanner, bannerDataUri);

  try {
    if (Platform.OS === "web") {
      Alert.alert("Share", "PDF sharing is available on mobile devices.");
      return;
    }

    const { base64 } = await Print.printToFileAsync({ html, base64: true });
    const pdfUri =
      (FileSystem.cacheDirectory ?? "") +
      "voter-slip-" +
      slugFileName(voter.epicNo || voter.id || voter.name) +
      ".pdf";

    if (!base64) {
      Alert.alert("Share failed", "Unable to create the voter slip PDF.");
      return;
    }

    await FileSystem.writeAsStringAsync(pdfUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: whatsappNumber
          ? "Share Voter Slip to " + voter.name
          : "Share Voter Slip",
        UTI: "com.adobe.pdf",
      });

      if (whatsappNumber) {
        await openWhatsAppChat(whatsappNumber, voter);
      } else {
        await openWhatsAppRecipientPicker(voter);
      }
    } else {
      Alert.alert("Share unavailable", "Sharing is not available on this device.");
    }
  } catch (error: any) {
    Alert.alert("Share failed", error?.message ?? "Unable to share the slip.");
  }
}

export async function printSlip(
  voter: Voter,
  showBanner: boolean,
  bannerImage?: string,
) {
  const bannerDataUri = showBanner ? await toDataUri(bannerImage) : undefined;
  const html = buildSlipHtml(voter, showBanner, bannerDataUri);

  try {
    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (!win) {
        Alert.alert("Print blocked", "Please allow popups to print.");
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      return;
    }
    await Print.printAsync({ html });
  } catch (error: any) {
    Alert.alert("Print failed", error?.message ?? "Unable to print the slip.");
  }
}

/* ============================================================
   COMPONENT
   ============================================================ */

export function VoterSlipPreview({
  voter,
  onClose,
  showBanner = false,
  bannerImage,
  onDownload,
  onPrint,
  onChangeDevice,
  variant = "modal",
}: VoterSlipPreviewProps) {
  const [savedPrinter, setSavedPrinter] = useState<ThermalPrinterDevice | null>(
    null,
  );

  useEffect(() => {
    void getSavedThermalPrinter().then(setSavedPrinter).catch(() => {
      setSavedPrinter(null);
    });
  }, []);
  const address = [
    voter.houseNo && voter.houseNo !== "N/A"
      ? "House No. " + voter.houseNo
      : "",
    voter.ward ? "Ward " + voter.ward : "",
    voter.district,
    voter.state,
  ]
    .filter(Boolean)
    .join(", ");

  async function handleDownload() {
    await downloadSlip(voter, showBanner, bannerImage);
    onDownload?.();
  }

  async function handlePrint() {
    if (onPrint) {
      try {
        await onPrint();
      } catch (error: any) {
        Alert.alert("Print failed", error?.message ?? "Unable to print the voter slip.");
      }
      return;
    }

    await printSlip(voter, showBanner, bannerImage);
  }

  async function handleChangeDevice() {
    if (!onChangeDevice) return;
    try {
      await onChangeDevice();
    } catch (error: any) {
      Alert.alert("Printer unavailable", error?.message ?? "Unable to prepare the voter slip.");
    }
  }

  const slipContent = (
    <View style={styles.paper}>
      {showBanner ? (
        bannerImage ? (
          <Image
            source={{ uri: bannerImage }}
            style={styles.bannerImage}
            contentFit="contain"
          />
        ) : (
          <View style={styles.bannerFallback}>
            <Text style={styles.bannerMeta}>
              वार्ड संख्या : {voter.ward || "58"}
            </Text>
            <Text style={styles.bannerDivider} />
            <Text style={styles.bannerText}>मतदान केंद्र पता</Text>
            <Text style={styles.bannerSchool}>
              राजकीय उच्च प्राथमिक विद्यालय
            </Text>
            <Text style={styles.bannerPlace}>
              {voter.district || "श्रीगंगानगर"}
            </Text>
          </View>
        )
      ) : null}

      <Text style={styles.slipTitle}>Voter Slip</Text>

      <View style={styles.slipBox}>
        <Text style={styles.voterName}>{voter.name}</Text>
        {voter.hindiName ? (
          <Text style={styles.voterHindiName}>{voter.hindiName}</Text>
        ) : null}

        <View style={styles.twoColumnRow}>
          <SlipInline label="Gender" value={voter.gender || "N/A"} />
          <SlipInline label="Age" value={String(voter.age || "N/A")} />
        </View>

        <SlipLine label="पिता का नाम" value={formatGuardian(voter.guardian)} />
        <SlipLine
          label="Serial No"
          value={voter.serialNo || voter.id || "N/A"}
        />
        <SlipLine label="Booth No" value={voter.booth || "N/A"} />
        <SlipLine label="Epic No" value={voter.epicNo || "N/A"} />
        <SlipBlock label="Address" value={address || "N/A"} />
        <SlipBlock
          label="Polling Station No. & Address"
          value={displayValue(voter.pollingStation)}
        />
      </View>
    </View>
  );

  if (variant === "page") {
    return (
      <SafeAreaView style={styles.pageBackdrop}>
        <ScrollView contentContainerStyle={styles.pageScrollContent}>
          {slipContent}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.backdrop}>
      <View style={styles.previewPanel}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Voter Slip Preview</Text>
          <Pressable
            accessibilityLabel="Close voter slip preview"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X color="#64748B" size={22} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {slipContent}
        </ScrollView>

        <View style={styles.footerActions}>
          {onChangeDevice ? (
            <View style={styles.printerBar}>
              <View style={styles.printerStatus}>
                <Bluetooth color="#087568" size={19} strokeWidth={2.7} />
                <View style={styles.printerCopy}>
                  <Text style={styles.printerLabel}>Selected printer</Text>
                  <Text numberOfLines={1} style={styles.printerName}>
                    {savedPrinter?.name || "No printer selected"}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Change Bluetooth printer"
                onPress={handleChangeDevice}
                style={styles.changeDeviceButton}>
                <Text style={styles.changeDeviceText}>
                  {savedPrinter ? "Change" : "Select"}
                </Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.primaryFooterActions}>
          <Pressable
            accessibilityLabel="Download voter slip"
            onPress={handleDownload}
            style={[styles.footerButton, styles.downloadButton]}
          >
            <Download color="#334155" size={17} strokeWidth={2.5} />
            <Text style={styles.downloadText}>Download</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Print voter slip"
            onPress={handlePrint}
            style={[styles.footerButton, styles.printButton]}
          >
            <Printer color="#FFFFFF" size={17} strokeWidth={2.5} />
            <Text style={styles.printText}>Print</Text>
          </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   SMALL SUB-COMPONENTS
   ============================================================ */

function SlipInline({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.inlineText}>
      {label} : <Text style={styles.inlineValue}>{displayValue(value)}</Text>
    </Text>
  );
}

function SlipLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.lineText}>
      {label} : <Text style={styles.lineValue}>{displayValue(value)}</Text>
    </Text>
  );
}

function SlipBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.blockRow}>
      <Text style={styles.blockText}>
        {label} : {displayValue(value)}
      </Text>
    </View>
  );
}

/* ============================================================
   STYLES (same as before, unchanged)
   ============================================================ */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.78)",
    padding: 0,
  },
  pageBackdrop: { flex: 1, backgroundColor: "#F8FAFC" },
  pageScrollContent: { padding: 15, paddingBottom: 28 },
  previewPanel: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 0,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  previewHeader: {
    height: 68,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: { color: "#111827", fontSize: 14, fontWeight: "900" },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { padding: 16, paddingBottom: 18 },
  paper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingTop: 17,
    paddingBottom: 15,
  },
  bannerImage: {
    width: "100%",
    height: 110,
    marginBottom: 8,
  },
  bannerFallback: {
    borderWidth: 3,
    borderColor: "#2F281F",
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 22,
    marginBottom: 8,
    alignItems: "center",
  },
  bannerMeta: { color: "#2F281F", fontSize: 15, fontWeight: "900" },
  bannerDivider: {
    width: "74%",
    height: 2,
    backgroundColor: "#2F281F",
    marginVertical: 5,
  },
  bannerText: { color: "#2F281F", fontSize: 15, fontWeight: "900" },
  bannerSchool: {
    color: "#2F281F",
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 5,
  },
  bannerPlace: { color: "#2F281F", fontSize: 18, fontWeight: "900" },
  slipTitle: {
    color: "#070A1C",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 18,
  },
  slipBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#93B3D9",
    paddingHorizontal: 12,
    paddingVertical: 18,
    minHeight: 530,
  },
  voterName: {
    color: "#070A1C",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  voterHindiName: {
    color: "#070A1C",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 3,
    marginBottom: 22,
  },
  twoColumnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  inlineText: {
    color: "#070A1C",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
  },
  inlineValue: { fontWeight: "900" },
  lineText: {
    color: "#070A1C",
    fontSize: 20,
    lineHeight: 29,
    fontWeight: "900",
    marginBottom: 8,
  },
  lineValue: { fontWeight: "900" },
  blockRow: { marginTop: 22 },
  blockText: {
    color: "#070A1C",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
  },
  footerActions: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    padding: 12,
  },
  primaryFooterActions: { flexDirection: "row", gap: 8 },
  printerBar: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C5EEE7",
    backgroundColor: "#F0FDFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 11,
    paddingRight: 7,
    marginBottom: 8,
  },
  printerStatus: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  printerCopy: { flex: 1 },
  printerLabel: { color: "#64748B", fontSize: 10, fontWeight: "700" },
  printerName: { color: "#075E54", fontSize: 13, fontWeight: "900", marginTop: 1 },
  changeDeviceButton: {
    height: 34,
    minWidth: 76,
    borderRadius: 6,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  changeDeviceText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  footerButton: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  downloadButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE3EA",
  },
  printButton: { backgroundColor: "#235F5B" },
  downloadText: { color: "#334155", fontSize: 13, fontWeight: "900" },
  printText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
