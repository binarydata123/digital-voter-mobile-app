import {
  BadgeCheck,
  ImagePlus,
  MoreVertical,
  Pencil,
  Printer,
  QrCode,
  Share2,
  Trash2,
  UsersRound,
} from "lucide-react-native";
import { memo, useCallback, useRef, useState } from "react";
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
import { VoterTemplateCarousel } from "./VoterTemplateCarousel";

import { getDefaultVoterAvatar } from "@/utils/voterAvatar";

function buildVoterQrValue(voter: Voter): string {
  const epicNo = voter.epicNo ?? voter.id ?? voter.serialNo ?? "";
  return `https://votersakha.tech/voter-slip.html?epicNo=${encodeURIComponent(epicNo)}`;
}

function isUsableImageUri(uri?: string) {
  const value = String(uri ?? "")
    .trim()
    .toLowerCase();
  return Boolean(value && value !== "undefined" && value !== "null");
}

type VoterCardProps = {
  voter: Voter;
  onScan?: (voter: Voter) => void;
  onPrint?: (voter: Voter) => void;
  onFamily?: (voter: Voter) => void;
  onEdit?: (voter: Voter) => void;
  onDelete?: (voter: Voter) => void;
  onImagePress?: (voter: Voter) => void;
  onMarkVoted?: (voter: Voter) => Promise<void>;
};

function formatEpicNo(epicNo?: string | null): string {
  const value = epicNo?.replace(/\s/g, "") ?? "";
  if (!value) return "N/A";
  return value.length === 10
    ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`
    : epicNo?.trim() || "N/A";
}

function VoterCardComponent({
  voter,
  onScan,
  onPrint,
  onFamily,
  onEdit,
  onDelete,
  onImagePress,
  onMarkVoted,
}: VoterCardProps) {
  const [qrVisible, setQrVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [markingVoted, setMarkingVoted] = useState(false);
  const markingVotedRef = useRef(false);

  const handleNamePress = useCallback(async () => {
    if (!onMarkVoted || voter.voted || markingVotedRef.current) return;
    markingVotedRef.current = true;
    setMarkingVoted(true);
    try {
      await onMarkVoted(voter);
    } finally {
      markingVotedRef.current = false;
      setMarkingVoted(false);
    }
  }, [onMarkVoted, voter]);

  const handleQrPress = useCallback(() => {
    setQrVisible(true);
    onScan?.(voter);
  }, [onScan, voter]);

  const handlePrintPress = useCallback(
    () => onPrint?.(voter),
    [onPrint, voter],
  );
  const handleFamilyPress = useCallback(
    () => onFamily?.(voter),
    [onFamily, voter],
  );
  const handleImagePress = useCallback(
    () => onImagePress?.(voter),
    [onImagePress, voter],
  );
  const handleEditPress = useCallback(() => {
    setActionsVisible(false);
    onEdit?.(voter);
  }, [onEdit, voter]);
  const handleDeletePress = useCallback(() => {
    setActionsVisible(false);
    onDelete?.(voter);
  }, [onDelete, voter]);

  return (
    <View style={styles.voterCard}>
      <View style={styles.voterTop}>
        <Avatar
          voter={voter}
          onPress={onImagePress ? handleImagePress : undefined}
        />

        <View style={styles.voterContent}>
          <View style={styles.voterHeaderRow}>
            <View style={styles.voterInfo}>
              <View style={styles.nameAndAgeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    voter.voted
                      ? `${voter.name}, voted`
                      : `Mark ${voter.name} as voted`
                  }
                  accessibilityState={{
                    disabled:
                      !onMarkVoted || Boolean(voter.voted) || markingVoted,
                    busy: markingVoted,
                  }}
                  disabled={!onMarkVoted || voter.voted || markingVoted}
                  onPress={handleNamePress}
                  style={styles.voterNameRow}
                >
                  {markingVoted ? (
                    <ActivityIndicator size="small" color="#15803d" />
                  ) : voter.voted ? (
                    <View style={styles.votedBadge}>
                      <BadgeCheck size={15} color="#15803d" />
                    </View>
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={[styles.voterName, styles.voterNameText]}
                  >
                    {voter.name}
                  </Text>
                </Pressable>
                <Text style={styles.voterAge}>
                  {voter.age > 0 ? `${voter.age} Yrs` : "Age N/A"}
                </Text>
              </View>
            </View>

            <View style={styles.cardRightRail}>
              <View style={styles.boothActions}>
                <View style={styles.quickActions}>
                  <Pressable
                    accessibilityLabel="Show voter QR code"
                    onPress={handleQrPress}
                    style={styles.scanButton}
                  >
                    <QrCode color="#087568" size={15} strokeWidth={2.8} />
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Share voter slip"
                    onPress={() => setFilterVisible(true)}
                    style={styles.scanButton}>
                    <Share2 color="#087568" size={16} strokeWidth={2.7} />
                  </Pressable>

                  <Pressable
                    accessibilityLabel="Open voter actions"
                    onPress={() => setActionsVisible(true)}
                    style={styles.scanButton}
                  >
                    <MoreVertical color="#087568" size={17} strokeWidth={2.8} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.guardianRow}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.guardian}
            >
              {voter.guardian}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.houseNumber}>
            House No. {voter.houseNo || "N/A"}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <InfoTile
          icon={BadgeCheck}
          label="EPIC No."
          value={formatEpicNo(voter.epicNo)}
          priority
        />

        <InfoTile
          icon={BadgeCheck}
          label="Serial No."
          value={voter.serialNo || "N/A"}
          compact
        />

        <Pressable onPress={handlePrintPress} style={styles.printButton}>
          <Printer color="#087568" size={17} strokeWidth={2.5} />
          <Text numberOfLines={1} style={styles.printText}>Print</Text>
        </Pressable>

        <Pressable onPress={handleFamilyPress} style={styles.familyButton}>
          <UsersRound color="#087568" size={17} strokeWidth={2.5} />
          <Text numberOfLines={1} style={styles.printText}>Family</Text>
        </Pressable>
      </View>

      {filterVisible ? (
        <VoterTemplateCarousel
          voter={voter}
          onClose={() => setFilterVisible(false)}
        />
      ) : null}

      {qrVisible ? (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setQrVisible(false)}
        >
          <Pressable
            style={styles.qrBackdrop}
            onPress={() => setQrVisible(false)}
          >
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
                style={styles.qrCloseButton}
              >
                <Text style={styles.qrCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {actionsVisible ? (
        <Modal
          transparent
          visible
          animationType="slide"
          onRequestClose={() => setActionsVisible(false)}
        >
          <Pressable
            style={styles.actionBackdrop}
            onPress={() => setActionsVisible(false)}
          >
            <Pressable
              style={styles.actionPanel}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.actionHandle} />
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>Voter actions</Text>
                <Text numberOfLines={1} style={styles.actionSubtitle}>{voter.name}</Text>
              </View>

              {/* {onImagePress ? (
                <ActionRow
                  icon={ImagePlus}
                  title={
                    voter.photoUri ? "Edit voter image" : "Add voter image"
                  }
                  subtitle="Update voter profile photo"
                  onPress={() => {
                    setActionsVisible(false);
                    onImagePress(voter);
                  }}
                />
              ) : null} */}
              {onEdit ? (
                <ActionRow
                  icon={Pencil}
                  title="Edit voter"
                  subtitle="Update voter details"
                  onPress={handleEditPress}
                />
              ) : null}
              {onDelete ? (
                <ActionRow
                  danger
                  icon={Trash2}
                  title="Delete voter"
                  subtitle="Remove this voter from the list"
                  onPress={handleDeletePress}
                />
              ) : null}
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
    previous.onEdit === next.onEdit &&
    previous.onDelete === next.onDelete &&
    previous.onImagePress === next.onImagePress &&
    previous.onMarkVoted === next.onMarkVoted &&
    before.voted === after.voted &&
    before.id === after.id &&
    before.name === after.name &&
    before.gender === after.gender &&
    before.education === after.education &&
    before.working === after.working &&
    before.age === after.age &&
    before.guardian === after.guardian &&
    before.epicNo === after.epicNo &&
    before.houseNo === after.houseNo &&
    before.booth === after.booth &&
    before.serialNo === after.serialNo &&
    before.photoUri === after.photoUri
  );
}

export const VoterCard = memo(VoterCardComponent, areVoterCardPropsEqual);

/* -------------------------------------------------------------
   AVATAR
   ------------------------------------------------------------- */

const Avatar = memo(function Avatar({
  voter,
  onPress,
}: {
  voter: Voter;
  onPress?: () => void;
}) {
  const defaultSource = getDefaultVoterAvatar(voter.gender, voter.age);
  const source = isUsableImageUri(voter.photoUri)
    ? { uri: voter.photoUri }
    : defaultSource;

  const avatar = (
    <View style={styles.avatar}>
      <Image source={source} style={styles.avatarImage} resizeMode="contain" />
      {onPress ? (
        <View style={styles.avatarEditBadge}>
          <ImagePlus color="#FFFFFF" size={12} strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) {
    return avatar;
  }

  return (
    <Pressable accessibilityLabel="Add or edit voter image" onPress={onPress}>
      {avatar}
    </Pressable>
  );
});

const ActionRow = memo(function ActionRow({
  danger = false,
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  danger?: boolean;
  icon: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.actionRow,
        danger && styles.actionRowDanger,
      ]}
    >
      <View style={[styles.actionIcon, danger && styles.actionIconDanger]}>
        <Icon
          color={danger ? "#B91C1C" : "#087568"}
          size={20}
          strokeWidth={2.6}
        />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionText, danger && styles.actionTextDanger]}>
          {title}
        </Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
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
  compact = false,
}: {
  icon: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  label: string;
  value: string;
  priority?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.infoTile, priority && styles.priorityInfoTile, compact && styles.compactInfoTile]}>
      <View style={styles.tileIcon}>
        <Icon color="#087568" size={17} strokeWidth={2.5} />
      </View>

      <View style={[styles.tileTextWrap, compact && styles.compactTileTextWrap]}>
        <Text numberOfLines={1} style={styles.infoLabel}>{label}</Text>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          ellipsizeMode="tail"
          style={styles.infoValue}
        >
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
  avatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#087568",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  voterContent: { flex: 1, minWidth: 0, paddingTop: 3 },
  voterHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  voterInfo: { flex: 1, minWidth: 0 },
  voterName: { color: "#06082A", fontWeight: "900", fontSize: 14 },
  nameAndAgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  voterNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 22,
    flexShrink: 1,
  },
  voterNameText: { flexShrink: 1 },
  votedBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  voterAge: {
    color: "#747999",
    fontWeight: "800",
    fontSize: 10,
    flexShrink: 0,
  },
  houseNumber: {
    color: "#747999",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  guardian: {
    color: "#047857",
    flex: 1,
    fontWeight: "900",
    fontSize: 11,
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
  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    fontSize: 12,
  },
  infoTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    backgroundColor: "#F6FBFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  priorityInfoTile: {
    flex: 1.15,
  },
  compactInfoTile: { flex: 0, flexShrink: 1 },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#DDF8EC",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTextWrap: { flex: 1, minWidth: 0 },
  compactTileTextWrap: { flex: 0, flexShrink: 1, minWidth: 0 },
  infoLabel: { color: "#747999", fontSize: 12, fontWeight: "800" },
  infoValue: {
    color: "#06082A",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
  printButton: {
    minWidth: 34,
    minHeight: 45,
    flexShrink: 0,
    // borderRadius: 12,
    // borderWidth: 1.5,
    // borderColor: "#99D6CC",
    alignItems: "center",
    justifyContent: "center",
  },
  familyButton: {
    minWidth: 44,
    minHeight: 45,
    paddingHorizontal: 2,
    flexShrink: 0,
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
    fontSize: 12,
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

  /* ---------- Action modal ---------- */
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  actionPanel: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 32,
  },
  actionHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 14,
  },
  actionHeader: { marginBottom: 8 },
  actionTitle: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  actionSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  actionRow: {
    width: "100%",
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomColor: "#EEF2F7",
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  actionRowDanger: { borderBottomWidth: 0, marginTop: 4 },
  actionCopy: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconDanger: { backgroundColor: "#FEF2F2" },
  actionText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900",
  },
  actionTextDanger: { color: "#B91C1C" },
});
