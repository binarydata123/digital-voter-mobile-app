import { ChevronDown, LockKeyhole, UserPlus, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AuthUser } from "@/services/authentication";
import { createVoter, type Voter } from "@/services/voters";
import {
  getAgeFromVoterDob, getAssignedVoterLocations, newVoterForm,
  validateNewVoter, type CreateVoterInput,
} from "@/utils/voterCreation";

export function AddVoterModal({ user, onClose, onCreated }: {
  user: AuthUser;
  onClose: () => void;
  onCreated: (voter: Voter) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(() => newVoterForm(user));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const areas = getAssignedVoterLocations(user);

  function update(key: keyof CreateVoterInput, value: string) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "dob") {
        const age = getAgeFromVoterDob(value);
        if (age !== null) next.age = String(age);
      }
      if (key === "relation" && !value) next.relationName = "";
      return next;
    });
    setError("");
  }

  async function submit() {
    if (savingRef.current) return;
    const validation = validateNewVoter(form, user);
    if (validation) { setError(validation); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const voter = await createVoter(form);
      await onCreated(voter);
      onClose();
    } catch (failure: any) {
      setError(failure?.response?.data?.message || failure?.message || "Unable to add voter. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function close() { if (!savingRef.current) onClose(); }

  const field = (key: keyof CreateVoterInput, label: string, keyboardType?: "number-pad" | "phone-pad", placeholder?: string) => (
    <FormInput label={label} value={form[key]} onChange={(value) => update(key, value)} keyboardType={keyboardType} placeholder={placeholder} />
  );
  const area = (key: keyof typeof areas, label: string) => (
    areas[key].length || key === "state" || key === "district"
      ? <FormSelect label={label} value={form[key]} options={areas[key]} onChange={(value) => update(key, value)} locked={areas[key].length <= 1} />
      : field(key, label)
  );

  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable accessibilityLabel="Dismiss add voter" style={styles.dismissArea} onPress={close} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}><UserPlus size={20} color="#087568" /></View>
              <View>
                <Text style={styles.title}>Add voter</Text>
                <Text style={styles.subtitle}>Add a voter in your assigned area</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close add voter" disabled={saving} onPress={close} style={styles.close}>
              <X size={22} color="#64748B" />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <View pointerEvents={saving ? "none" : "auto"} style={styles.sections}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Voter details</Text>
                {field("epicNo", "EPIC No. *", undefined, "Enter unique EPIC number")}
                {field("nameEnglish", "Name *", undefined, "Voter name in English")}
                <View style={styles.row}>
                  <FormSelect label="Gender *" value={form.gender} options={["Male", "Female", "Transgender", "Other"]} onChange={(value) => update("gender", value)} />
                  {field("age", "Age *", "number-pad", "18–130")}
                </View>
                {field("dob", "Date of birth", undefined, "YYYY-MM-DD (optional)")}
                <View style={styles.row}>
                  {field("phone", "Phone number", "phone-pad")}
                  {field("houseNo", "House No.")}
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.areaNotice}>
                  <LockKeyhole size={14} color="#087568" />
                  <Text style={styles.areaNoticeText}>Location choices are limited to your assigned area.</Text>
                </View>
                <View style={styles.row}>{area("state", "State *")}{area("district", "District *")}</View>
                <View style={styles.row}>{area("city", "City *")}{area("village", "Village")}</View>
                <View style={styles.row}>{area("boothNo", "Booth number *")}{area("ward", "Ward number")}</View>
                {field("pollingStationAddressEnglish", "Polling station address")}
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Family details</Text>
                <FormSelect label="Relation" value={form.relation} options={["", "Father", "Mother", "Husband", "Wife", "Guardian"]} onChange={(value) => update("relation", value)} />
                {form.relation ? field("relationName", `${form.relation} name *`) : null}
              </View>
            </View>
          </ScrollView>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={close} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={submit} style={[styles.submit, saving && styles.disabled]}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <UserPlus size={17} color="#FFFFFF" />}
              <Text style={styles.submitText}>{saving ? "Adding voter…" : "Add voter"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormInput({ label, value, onChange, keyboardType, placeholder }: {
  label: string; value: string; onChange: (value: string) => void;
  keyboardType?: "number-pad" | "phone-pad"; placeholder?: string;
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor="#94A3B8" style={styles.input} />
  </View>;
}

function FormSelect({ label, value, options, onChange, locked = false }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void; locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || "Select"}`} accessibilityState={{ disabled: locked, expanded: open }} disabled={locked} onPress={() => setOpen(!open)} style={[styles.input, styles.select, locked && styles.locked]}>
      <Text style={[styles.selectText, !value && styles.placeholder]}>{value || (locked ? "Not assigned" : "Select")}</Text>
      {locked ? <LockKeyhole size={14} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
    </Pressable>
    {open ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options}>
      {options.map((option) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === option }} key={option} onPress={() => { onChange(option); setOpen(false); }} style={[styles.option, value === option && styles.optionSelected]}>
        <Text style={styles.selectText}>{option || "None"}</Text>
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  dismissArea: { flex: 1 },
  sheet: { maxHeight: "92%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18 },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  titleIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 11, marginTop: 3 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  form: { paddingBottom: 8 },
  sections: { gap: 12 },
  section: { backgroundColor: "#F8FAFC", borderColor: "#DFE8EF", borderWidth: 1, borderRadius: 14, padding: 12, gap: 12 },
  sectionTitle: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  row: { flexDirection: "row", gap: 10 },
  field: { flex: 1, minWidth: 0, gap: 5 },
  label: { color: "#475569", fontSize: 12, fontWeight: "600" },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#D6E3EC", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 10, color: "#0F172A", fontSize: 13 },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  selectText: { color: "#0F172A", fontSize: 13, flexShrink: 1 },
  placeholder: { color: "#94A3B8" },
  locked: { backgroundColor: "#EEF4F6" },
  options: { maxHeight: 180, borderColor: "#D6E3EC", borderWidth: 1, borderRadius: 10, backgroundColor: "#FFFFFF" },
  option: { minHeight: 44, justifyContent: "center", padding: 10 },
  optionSelected: { backgroundColor: "#ECFDF5" },
  areaNotice: { flexDirection: "row", alignItems: "center", gap: 6 },
  areaNoticeText: { flex: 1, color: "#087568", fontSize: 11, lineHeight: 16 },
  error: { color: "#B91C1C", fontSize: 12, paddingTop: 10, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  cancel: { minHeight: 46, flex: 1, borderColor: "#CBD5E1", borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  submit: { minHeight: 46, flex: 1.5, backgroundColor: "#087568", borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  submitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.65 },
});
