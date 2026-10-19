import {
    Check,
    CircleHelp,
    ClipboardList,
    Construction,
    Droplets,
    Landmark,
    MessageSquare,
    Trash2,
    X,
    Zap,
} from "lucide-react-native";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type RequestType = "requirement" | "complaint";

export type FollowUpStatus = "Pending" | "In Progress" | "Resolved";

export type VoterRequestPayload = {
  voterId: string;
  voterName: string;
  epicNo: string;
  type: RequestType;
  category: string;
  description: string;
  status: FollowUpStatus;
};

type VoterInfo = {
  id: string;
  name: string;
  epicNo?: string;
};

type Props = {
  visible: boolean;
  voter: VoterInfo | null;
  onClose: () => void;
  onSubmit: (record: VoterRequestPayload) => void;
};

const CATEGORIES = [
  { label: "Water Supply", Icon: Droplets },
  { label: "Electricity", Icon: Zap },
  { label: "Roads", Icon: Construction },
  { label: "Sanitation", Icon: Trash2 },
  { label: "Government Scheme", Icon: Landmark },
  { label: "Other", Icon: CircleHelp },
];

export function RequirementsComplaintsModal({
  visible,
  voter,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<RequestType>("requirement");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setType("requirement");
    setCategory("");
    setDescription("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!voter) {
      setError("Please select a voter.");
      return;
    }

    if (!category) {
      setError("Please select a category.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter the issue details.");
      return;
    }

    const record: VoterRequestPayload = {
      voterId: voter.id,
      voterName: voter.name,
      epicNo: voter.epicNo ?? "",
      type,
      category,
      description: description.trim(),
      status: "Pending",
    };

    onSubmit(record);
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={styles.dismissArea} accessibilityLabel="Close requirements and complaints" onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headingIcon}><ClipboardList size={22} color="#087568" /></View>
            <View style={styles.headingCopy}><Text style={styles.title}>Requirements & complaints</Text><Text style={styles.subtitle}>Record a request or report an issue</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close modal" onPress={handleClose} style={styles.closeButton}><X size={21} color="#64748B" /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Request type</Text>
              <View style={styles.typeRow}>
                {(["requirement", "complaint"] as const).map(option => {
                  const selected = type === option;
                  const Icon = option === "requirement" ? ClipboardList : MessageSquare;
                  return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setType(option); setError(""); }} style={[styles.typeCard, selected && styles.selectedCard]}>
                    <View style={styles.typeTop}><Icon size={20} color="#087568" />{selected ? <Check size={16} color="#087568" /> : null}</View>
                    <Text style={[styles.optionText, selected && styles.selectedText]}>{option === "requirement" ? "Requirement" : "Complaint"}</Text>
                    <Text style={styles.helper}>{option === "requirement" ? "Help or service needed" : "A problem to resolve"}</Text>
                  </Pressable>;
                })}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category <Text style={styles.required}>*</Text></Text>
              <View style={styles.categoryGrid}>{CATEGORIES.map(({ label, Icon }) => {
                const selected = category === label;
                return <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setCategory(label); setError(""); }} style={[styles.category, selected && styles.selectedCard]}>
                  <Icon size={18} color="#087568" /><Text style={[styles.categoryText, selected && styles.selectedText]}>{label}</Text>{selected ? <Check size={14} color="#087568" /> : null}
                </Pressable>;
              })}</View>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Issue details <Text style={styles.required}>*</Text></Text>
              <TextInput accessibilityLabel="Issue details" value={description} onChangeText={value => { setDescription(value); setError(""); }} placeholder={type === "requirement" ? "Describe the help or service needed…" : "Describe the problem and where it happened…"} placeholderTextColor="#94A3B8" multiline maxLength={1000} textAlignVertical="top" style={styles.input} />
              <Text style={styles.counter}>{description.length}/1000</Text>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={handleClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={handleSubmit} style={styles.save}><Check size={18} color="white" /><Text style={styles.saveText}>Save record</Text></Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.46)" },
  dismissArea: { flex: 1 }, sheet: { maxHeight: "90%", flexShrink: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12 },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#EDF2F5" },
  headingIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#E7F5EF", alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1 }, title: { fontSize: 17, lineHeight: 23, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 12, lineHeight: 18, color: "#64748B", marginTop: 3 }, closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  form: { padding: 20, gap: 20 },
  section: { gap: 10 }, sectionTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: "#334155" }, required: { color: "#087568" },
  typeRow: { flexDirection: "row", gap: 10 }, typeCard: { flex: 1, padding: 12, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: "#DDE8EF", backgroundColor: "#FFFFFF" }, typeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectedCard: { borderColor: "#087568", backgroundColor: "#EAF7F1" }, selectedText: { color: "#087568" }, optionText: { color: "#334155", fontSize: 13, fontWeight: "700" }, helper: { color: "#64748B", fontSize: 11, lineHeight: 16 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }, category: { width: "48.5%", minHeight: 48, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#DDE8EF", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: "#FFFFFF" }, categoryText: { flex: 1, color: "#334155", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  input: { minHeight: 108, borderWidth: 1, borderColor: "#DDE8EF", borderRadius: 12, backgroundColor: "#F8FAFC", padding: 12, color: "#0F172A", fontSize: 14, lineHeight: 21 }, counter: { alignSelf: "flex-end", fontSize: 10, color: "#64748B" },
  footer: { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingHorizontal: 20, paddingTop: 14, gap: 10 }, error: { color: "#B91C1C", fontSize: 12, lineHeight: 18, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 10 },
  actions: { flexDirection: "row", gap: 10 }, cancel: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1" }, cancelText: { color: "#475569", fontSize: 14, fontWeight: "700" }, save: { flex: 1.5, minHeight: 48, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#087568", borderRadius: 12 }, saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
