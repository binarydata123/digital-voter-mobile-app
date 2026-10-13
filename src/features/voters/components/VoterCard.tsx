import {
  BadgeCheck,
  House,
  Printer,
  QrCode,
  Share2,
  UsersRound,
} from "lucide-react-native";
import { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  return `https://votersakha.tech/voter-slip.html?epicNo=${encodeURIComponent(epicNo)}`;
}

type VoterCardProps = {
  voter: Voter;
  onScan?: (voter: Voter) => void;
  onPrint?: (voter: Voter) => void;
  onFamily?: (voter: Voter) => void;
  onShare?: (voter: Voter) => Promise<void> | void;
};

function VoterCardComponent({
  voter,
  onScan,
  onPrint,
  onFamily,
  onShare,
}: VoterCardProps) {
  const [qrVisible, setQrVisible] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleQrPress = useCallback(() => {
    setQrVisible(true);
    onScan?.(voter);
  }, [onScan, voter]);

  const handleSharePress = useCallback(async () => {
    if (!onShare || sharing) return;

    setSharing(true);
    try {
      await onShare(voter);
    } finally {
      setSharing(false);
    }
  }, [onShare, sharing, voter]);

  const handlePrintPress = useCallback(
    () => onPrint?.(voter),
    [onPrint, voter],
  );
  const handleFamilyPress = useCallback(
    () => onFamily?.(voter),
    [onFamily, voter],
  );

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
                <View style={styles.quickActions}>
                  <Pressable
                    accessibilityLabel="Show voter QR code"
                    onPress={handleQrPress}
                    style={styles.scanButton}>
                    <QrCode color="#087568" size={15} strokeWidth={2.8} />
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Share voter slip"
                    disabled={sharing}
                    onPress={handleSharePress}
                    style={[
                      styles.scanButton,
                      sharing && styles.scanButtonDisabled,
                    ]}>
                    {sharing ? (
                      <ActivityIndicator color="#087568" size="small" />
                    ) : (
                      <Share2 color="#087568" size={16} strokeWidth={2.7} />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.guardianRow}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.guardian}>
              {voter.guardian}
            </Text>
            <Text style={styles.boothBadge}>
              S.No. {voter.serialNo ?? voter.id ?? "N/A"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <InfoTile
          icon={BadgeCheck}
          label="EPIC No."
          value={voter.epicNo}
          priority
        />

        <InfoTile icon={House} label="House No." value={voter.houseNo} />

        <Pressable onPress={handlePrintPress} style={styles.printButton}>
          <Printer color="#087568" size={17} strokeWidth={2.5} />
          <Text style={styles.printText}>Print</Text>
        </Pressable>

        <Pressable onPress={handleFamilyPress} style={styles.familyButton}>
          <UsersRound color="#087568" size={17} strokeWidth={2.5} />
          <Text style={styles.printText}>Family</Text>
        </Pressable>
      </View>

      {qrVisible ? (
        <Modal
          transparent
          visible
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
                <QRCode value={buildVoterQrValue(voter)} size={200} />
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
      ) : null}
    </View>
  );
}

/**
 * SQLite filtering may return new object instances for the same voter. A
 * default React.memo comparison would re-render every visible card in that
 * case, so compare only the fields this card actually displays or uses.
 */
function areVoterCardPropsEqual(
  previous: Readonly<VoterCardProps>,
  next: Readonly<VoterCardProps>,
) {
  const before = previous.voter;
  const after = next.voter;

  return (
    previous.onScan === next.onScan &&
    previous.onPrint === next.onPrint &&
    previous.onFamily === next.onFamily &&
    previous.onShare === next.onShare &&
    before.id === after.id &&
    before.name === after.name &&
    before.gender === after.gender &&
    before.age === after.age &&
    before.guardian === after.guardian &&
    before.epicNo === after.epicNo &&
    before.houseNo === after.houseNo &&
    before.booth === after.booth &&
    before.serialNo === after.serialNo
  );
}

export const VoterCard = memo(VoterCardComponent, areVoterCardPropsEqual);

/* -------------------------------------------------------------
   AVATAR
   ------------------------------------------------------------- */

const AGE_IMAGES = {
  maleYoung: boyImage,
  femaleYoung: girlImage,
  maleAdult: manImage,
  femaleAdult: womenImage,
  maleOld: oldMenImage,
  femaleOld: oldWomenImage,
};

const Avatar = memo(function Avatar({
  gender,
  age,
}: {
  gender: string;
  age: number;
}) {
  const isFemale = gender.toLowerCase().startsWith("f");

  const imageSource =
    age < 35
      ? isFemale
        ? AGE_IMAGES.femaleYoung
        : AGE_IMAGES.maleYoung
      : age <= 70
        ? isFemale
          ? AGE_IMAGES.femaleAdult
          : AGE_IMAGES.maleAdult
        : isFemale
          ? AGE_IMAGES.femaleOld
          : AGE_IMAGES.maleOld;

  return (
    <View style={styles.avatar}>
      <Image
        source={imageSource}
        style={styles.avatarImage}
        resizeMode="contain"
      />
    </View>
  );
});

/* -------------------------------------------------------------
   INFO TILE
   ------------------------------------------------------------- */

const InfoTile = memo(function InfoTile({
  icon: Icon,
  label,
  value,
  priority = false,
}: {
  icon: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  label: string;
  value: string;
  priority?: boolean;
}) {
  return (
    <View style={[styles.infoTile, priority && styles.priorityInfoTile]}>
      <View style={styles.tileIcon}>
        <Icon color="#087568" size={17} strokeWidth={2.5} />
      </View>

      <View style={styles.tileTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>

        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
});

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
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
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
    flex: 1,
    fontWeight: "900",
    fontSize: 12,
  },
  guardianRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 3,
  },
  cardRightRail: { alignItems: "flex-end", gap: 7 },
  boothActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  quickActions: { flexDirection: "row", alignItems: "center", gap: 5 },
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
    width: 26,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonDisabled: { opacity: 0.7 },
  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
  },
  infoTile: {
    flex: 1,
    minWidth: 58,
    height: 50,
    backgroundColor: "#F6FBFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  priorityInfoTile: {
    flex: 1.55,
    minWidth: 112,
  },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
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
    width: 34,
    height: 45,
    // borderRadius: 12,
    // borderWidth: 1.5,
    // borderColor: "#99D6CC",
    alignItems: "center",
    justifyContent: "center",
  },
  familyButton: {
    width: 38,
    height: 45,
    // borderRadius: 12,
    // borderWidth: 1.5,
    // borderColor: "#BFEBDD",
    // backgroundColor: "#F4FFFA",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  printText: {
    color: "#087568",
    fontSize: 9,
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
