import {
  BadgeCheck,
  House,
  Printer,
  QrCode,
  UsersRound,
} from "lucide-react-native";
import { memo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import type { Voter } from "@/services/voters";

const boyImage = require("@/assets/icons/boy.png");
const girlImage = require("@/assets/icons/girl.png");
const manImage = require("@/assets/icons/man.png");
const womenImage = require("@/assets/icons/women.png");
const oldMenImage = require("@/assets/icons/old-man.png");
const oldWomenImage = require("@/assets/icons/old-women.png");

function buildVoterQrValue(voter: Voter): string {
  const epicNo = voter.epicNo ?? voter.id ?? voter.serialNo ?? "";
  return `https://api.votersakha.tech/api/public/voter-slip.html?epicNo=${encodeURIComponent(epicNo)}`;
}

export const VoterCard = memo(function VoterCard({
  voter,
  onScan,
  onPrint,
  onFamily,
}: {
  voter: Voter;
  onScan?: (voter: Voter) => void;
  onPrint?: (voter: Voter) => void;
  onFamily?: (voter: Voter) => void;
}) {
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState("");

  function handleQrPress() {
    const value = buildVoterQrValue(voter);

    setQrValue(value);
    setQrVisible(true);

    onScan?.(voter);
  }

  return (
    <View style={styles.voterCard}>
      <View style={styles.voterTop}>
        <Avatar gender={voter.gender} age={voter.age} />

        <View style={styles.voterContent}>
          <View style={styles.voterHeaderRow}>
            <View style={styles.voterInfo}>
              <Text numberOfLines={1} style={styles.voterName}>
                {voter.name}
              </Text>
              <Text style={styles.voterMeta}>
                {voter.gender} - {voter.age} Years
              </Text>
            </View>

            <View style={styles.cardRightRail}>
              <View style={styles.boothActions}>
                <Text style={styles.boothBadge}>
                  S.No. {voter.serialNo ?? voter.id ?? "N/A"}
                </Text>

                <Pressable
                  accessibilityLabel="Show voter QR code"
                  onPress={handleQrPress}
                  style={styles.scanButton}>
                  <QrCode color="#087568" size={15} strokeWidth={2.8} />
                </Pressable>
              </View>
            </View>
          </View>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            style={styles.guardian}>
            {voter.guardian}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <InfoTile
          icon={<BadgeCheck color="#087568" size={17} strokeWidth={2.5} />}
          label="EPIC No."
          value={voter.epicNo}
        />

        <InfoTile
          icon={<House color="#087568" size={17} strokeWidth={2.5} />}
          label="House No."
          value={voter.houseNo}
        />

        <Pressable onPress={() => onPrint?.(voter)} style={styles.printButton}>
          <Printer color="#087568" size={17} strokeWidth={2.5} />
          <Text style={styles.printText}>Print</Text>
        </Pressable>

        <Pressable
          onPress={() => onFamily?.(voter)}
          style={styles.familyButton}>
          <UsersRound color="#087568" size={17} strokeWidth={2.5} />
          <Text style={styles.printText}>Family</Text>
        </Pressable>
      </View>

      {/* =============== QR MODAL =============== */}
      <Modal
        transparent
        visible={qrVisible}
        animationType="fade"
        onRequestClose={() => setQrVisible(false)}>
        <Pressable
          style={styles.qrBackdrop}
          onPress={() => setQrVisible(false)}>
          <Pressable style={styles.qrPanel}>
            <Text style={styles.qrTitle}>{voter.name}</Text>
            <Text style={styles.qrSubtitle}>
              S.No. {voter.serialNo ?? voter.id ?? "N/A"} · {voter.booth}
            </Text>

            <View style={styles.qrWrap}>
              <QRCode value={qrValue} size={200} />
            </View>

            <Text style={styles.qrHint}>
              Scan this QR with another phone to open the voter detail.
            </Text>

            <Pressable
              onPress={() => setQrVisible(false)}
              style={styles.qrCloseButton}>
              <Text style={styles.qrCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

/* -------------------------------------------------------------
   AVATAR
   ------------------------------------------------------------- */

function Avatar({ gender, age }: { gender: string; age: number }) {
  const isFemale = gender.toLowerCase().startsWith("f");

  let imageSource;

  if (age < 35) {
    imageSource = isFemale ? girlImage : boyImage;
  } else if (age <= 70) {
    imageSource = isFemale ? womenImage : manImage;
  } else {
    imageSource = isFemale ? oldWomenImage : oldMenImage;
  }

  return (
    <View style={styles.avatar}>
      <Image
        source={imageSource}
        style={styles.avatarImage}
        resizeMode="contain"
      />
    </View>
  );
}

/* -------------------------------------------------------------
   INFO TILE
   ------------------------------------------------------------- */

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoTile}>
      <View style={styles.tileIcon}>{icon}</View>
      <View style={styles.tileTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------
   STYLES
   ------------------------------------------------------------- */

const styles = StyleSheet.create({
  voterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    padding: 12,
    shadowColor: "#718096",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  voterTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F0F8FC",
  },
  avatarImage: {
    width: 60,
    height: 60,
  },
  voterContent: { flex: 1, minWidth: 0, paddingTop: 3 },
  voterHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  voterInfo: { flex: 1, minWidth: 0 },
  voterName: { color: "#06082A", fontWeight: "900", fontSize: 16 },
  voterMeta: {
    color: "#747999",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
  },
  guardian: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 3,
    width: "100%",
  },
  cardRightRail: { alignItems: "flex-end", gap: 7 },
  boothActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  boothBadge: {
    overflow: "hidden",
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  scanButton: {
    width: 28,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
  },
  infoTile: {
    flex: 1,
    minWidth: 72,
    height: 50,
    backgroundColor: "#F6FBFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 7,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#DDF8EC",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTextWrap: { flex: 1, minWidth: 0 },
  infoLabel: { color: "#747999", fontSize: 9, fontWeight: "800" },
  infoValue: {
    color: "#06082A",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  printButton: {
    width: 45,
    height: 45,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#99D6CC",
    alignItems: "center",
    justifyContent: "center",
  },
  familyButton: {
    width: 45,
    height: 45,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#BFEBDD",
    backgroundColor: "#F4FFFA",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  printText: {
    color: "#087568",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },

  /* ---------- QR modal ---------- */
  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  qrPanel: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  qrTitle: {
    color: "#06082A",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  qrSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  qrWrap: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 10,
  },
  qrHint: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  qrCloseButton: {
    marginTop: 14,
    backgroundColor: "#087568",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  qrCloseText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
