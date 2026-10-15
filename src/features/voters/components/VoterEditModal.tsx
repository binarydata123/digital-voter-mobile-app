import { X } from "lucide-react-native";
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

import type { Voter } from "@/services/voters";

type EditableVoterFields = Pick<
  Voter,
  | "name"
  | "hindiName"
  | "gender"
  | "age"
  | "guardian"
  | "epicNo"
  | "houseNo"
  | "booth"
  | "ward"
  | "serialNo"
  | "mobileNumber"
  | "whatsappNumber"
>;

type VoterEditModalProps = {
  voter: Voter | null;
  visible: boolean;
  onClose: () => void;
  onSave: (voter: Voter) => void;
};

type VoterEditSheetProps = Omit<VoterEditModalProps, "voter"> & {
  voter: Voter;
};

const emptyForm: EditableVoterFields = {
  name: "",
  hindiName: "",
  gender: "",
  age: 0,
  guardian: "",
  epicNo: "",
  houseNo: "",
  booth: "",
  ward: "",
  serialNo: "",
  mobileNumber: "",
  whatsappNumber: "",
};

function cleanFormText(value: unknown) {
  const text = String(value ?? "").trim();
  const normalizedText = text.toLowerCase();

  return normalizedText === "undefined" || normalizedText === "null"
    ? ""
    : text;
}

function toForm(voter: Voter): EditableVoterFields {
  return {
    name: cleanFormText(voter.name),
    hindiName: cleanFormText(voter.hindiName),
    gender: cleanFormText(voter.gender),
    age: voter.age,
    guardian: cleanFormText(voter.guardian),
    epicNo: cleanFormText(voter.epicNo),
    houseNo: cleanFormText(voter.houseNo),
    booth: cleanFormText(voter.booth),
    ward: cleanFormText(voter.ward),
    serialNo: cleanFormText(voter.serialNo),
    mobileNumber: cleanFormText(voter.mobileNumber),
    whatsappNumber: cleanFormText(voter.whatsappNumber),
  };
}

export function VoterEditModal({
  voter,
  visible,
  onClose,
  onSave,
}: VoterEditModalProps) {
  if (!voter) return null;

  return (
    <VoterEditSheet
      visible={visible}
      voter={voter}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function VoterEditSheet({
  voter,
  visible,
  onClose,
  onSave,
}: VoterEditSheetProps) {
  const [draft, setDraft] = useState<{
    form: EditableVoterFields;
    voterId: string | null;
  }>(() => ({ form: emptyForm, voterId: null }));

  const form = draft.voterId === voter.id ? draft.form : toForm(voter);

  function updateField<Key extends keyof EditableVoterFields>(
    key: Key,
    value: EditableVoterFields[Key],
  ) {
    setDraft((current) => ({
      form: {
        ...(current.voterId === voter.id ? current.form : toForm(voter)),
        [key]: value,
      },
      voterId: voter.id,
    }));
  }

  function save() {
    const age = Number(form.age);
    onSave({
      ...voter,
      ...form,
      age: Number.isFinite(age) && age >= 0 ? Math.trunc(age) : voter.age,
      name: form.name.trim() || voter.name,
      gender: form.gender.trim() || voter.gender,
      guardian: form.guardian.trim() || "N/A",
      epicNo: form.epicNo.trim() || "N/A",
      houseNo: form.houseNo.trim() || "N/A",
      booth: form.booth.trim() || voter.booth,
    });
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Edit voter</Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {voter.epicNo || voter.serialNo || voter.id}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close edit voter"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X color="#64748B" size={20} strokeWidth={2.8} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.form}
          >
            <Field
              label="Name"
              value={form.name}
              onChangeText={(value) => updateField("name", value)}
            />

            <View style={styles.twoColumn}>
              <Field
                label="Gender"
                value={form.gender}
                onChangeText={(value) => updateField("gender", value)}
              />
              <Field
                keyboardType="number-pad"
                label="Age"
                value={String(form.age || "")}
                onChangeText={(value) =>
                  updateField("age", Number(value.replace(/[^\d]/g, "")))
                }
              />
            </View>

            <View style={styles.twoColumn}>
              <Field
                label="EPIC No."
                value={form.epicNo}
                onChangeText={(value) => updateField("epicNo", value)}
              />
              <Field
                label="Serial No."
                value={form.serialNo ?? ""}
                onChangeText={(value) => updateField("serialNo", value)}
              />
            </View>
            {/* <View style={styles.twoColumn}>
              <Field
                label="House No."
                value={form.houseNo}
                onChangeText={(value) => updateField("houseNo", value)}
              />
              <Field
                label="Booth"
                value={form.booth}
                onChangeText={(value) => updateField("booth", value)}
              />
            </View> */}
            {/* <Field
              label="Ward"
              value={form.ward ?? ""}
              onChangeText={(value) => updateField("ward", value)}
            /> */}
            <View style={styles.twoColumn}>
              <Field
                keyboardType="phone-pad"
                label="Mobile"
                value={form.mobileNumber ?? ""}
                onChangeText={(value) => updateField("mobileNumber", value)}
              />
              <Field
                keyboardType="phone-pad"
                label="WhatsApp"
                value={form.whatsappNumber ?? ""}
                onChangeText={(value) => updateField("whatsappNumber", value)}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad" | "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "flex-end",
  },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 22,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  subtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  form: { gap: 12, paddingTop: 16, paddingBottom: 8 },
  twoColumn: { flexDirection: "row", gap: 10 },
  field: { flex: 1, minWidth: 0, gap: 5 },
  label: { color: "#64748B", fontSize: 11, fontWeight: "900" },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 12,
  },
  actions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#475569", fontSize: 13, fontWeight: "900" },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
