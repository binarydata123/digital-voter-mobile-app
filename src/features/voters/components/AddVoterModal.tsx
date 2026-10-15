import { ChevronDown, LockKeyhole, UserPlus, X } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
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

import type { AuthUser } from "@/services/authentication";
import { createVoter, type Voter } from "@/services/voters";
import {
  getAssignedVoterLocations,
  newVoterForm,
  validateNewVoter,
  type CreateVoterInput,
} from "@/utils/voterCreation";

export function AddVoterModal({
  user,
  onClose,
  onCreated,
}: {
  user: AuthUser;
  onClose: () => void;
  onCreated: (voter: Voter) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState(() => newVoterForm(user));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  // Track which dropdown is currently open so we can raise its parent's z-index
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const areas = getAssignedVoterLocations(user);

  function update(key: keyof CreateVoterInput, value: string) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "relation" && !value) next.relationName = "";
      return next;
    });
    setError("");
  }

  function updateNumeric(key: "age" | "phone", value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    update(key, digits);
  }

  async function submit() {
    if (savingRef.current) return;
    const validation = validateNewVoter(form, user);
    if (validation) {
      setError(validation);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const voter = await createVoter(form);
      await onCreated(voter);
      onClose();
    } catch (failure: any) {
      setError(
        failure?.response?.data?.message ||
          failure?.message ||
          "Unable to add voter. Please try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function close() {
    if (!savingRef.current) onClose();
  }

  const field = (
    key: keyof CreateVoterInput,
    label: string,
    keyboardType?: "number-pad" | "phone-pad",
    placeholder?: string,
  ) => (
    <FormInput
      label={label}
      value={form[key]}
      onChange={(value) => update(key, value)}
      keyboardType={keyboardType}
      placeholder={placeholder}
    />
  );

  const numericField = (
    key: "age" | "phone",
    label: string,
    keyboardType: "number-pad" | "phone-pad",
    placeholder?: string,
    maxLength?: number,
  ) => (
    <FormInput
      label={label}
      value={form[key]}
      onChange={(value) => updateNumeric(key, value)}
      keyboardType={keyboardType}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  );

  const area = (
    key: keyof typeof areas,
    label: string,
    placeholder?: string,
  ) =>
    areas[key].length || key === "state" || key === "district" ? (
      <FormSelect
        id={`area-${key}`}
        label={label}
        value={form[key]}
        options={areas[key]}
        onChange={(value) => update(key, value)}
        locked={areas[key].length <= 1}
        openSelect={openSelect}
        setOpenSelect={setOpenSelect}
      />
    ) : (
      field(key, label, undefined, placeholder)
    );

  const isVoterDetailsRaised = openSelect === "gender" || openSelect === "relation";
  const isLocationRaised = openSelect?.startsWith("area-") ?? false;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          accessibilityLabel="Dismiss add voter"
          style={styles.dismissArea}
          onPress={close}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}>
                <UserPlus size={20} color="#087568" />
              </View>
              <View>
                <Text style={styles.title}>Add voter</Text>
                <Text style={styles.subtitle}>
                  Add a voter in your assigned area
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close add voter"
              disabled={saving}
              onPress={close}
              style={styles.close}
            >
              <X size={22} color="#64748B" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <View
              pointerEvents={saving ? "none" : "auto"}
              style={styles.sections}
            >
              <View
                style={[
                  styles.section,
                  isVoterDetailsRaised && styles.sectionRaised,
                ]}
              >
                <Text style={styles.sectionTitle}>Voter details</Text>

                <View style={styles.row}>
                  {field(
                    "nameEnglish",
                    "Name *",
                    undefined,
                    "Voter name in English",
                  )}
                  {numericField("age", "Age *", "number-pad", "18–130", 3)}
                </View>
                <View style={styles.row}>
                  {field(
                    "epicNo",
                    "EPIC No. *",
                    undefined,
                    "Enter EPIC number",
                  )}
                  {numericField(
                    "phone",
                    "Phone number",
                    "phone-pad",
                    "10-digit mobile",
                    10,
                  )}
                </View>
                <View
                  style={[
                    styles.row,
                    openSelect === "gender" && styles.rowRaised,
                  ]}
                >
                  <FormSelect
                    id="gender"
                    label="Gender *"
                    value={form.gender}
                    options={["Male", "Female", "Transgender", "Other"]}
                    onChange={(value) => update("gender", value)}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                  />
                  {field("houseNo", "House No.", undefined, "House / door no.")}
                </View>
                <View
                  style={[
                    styles.row,
                    openSelect === "relation" && styles.rowRaised,
                  ]}
                >
                  <FormSelect
                    id="relation"
                    label="Relation"
                    value={form.relation}
                    options={[
                      "", "Father", "Mother", "Husband", "Wife", "Guardian",
                    ]}
                    onChange={(value) => update("relation", value)}
                    openSelect={openSelect}
                    setOpenSelect={setOpenSelect}
                  />
                  <FormInput
                    label={
                      form.relation ? `${form.relation} name *` : "Relation name"
                    }
                    value={form.relationName}
                    onChange={(value) => update("relationName", value)}
                    editable={Boolean(form.relation)}
                    placeholder={
                      form.relation
                        ? `Enter ${form.relation.toLowerCase()}'s name`
                        : "Select relation first"
                    }
                  />
                </View>
              </View>

              <View
                style={[
                  styles.section,
                  isLocationRaised && styles.sectionRaised,
                ]}
              >
                <Text style={styles.sectionTitle}>Location</Text>
                <View style={styles.areaNotice}>
                  <LockKeyhole size={14} color="#087568" />
                  <Text style={styles.areaNoticeText}>
                    Location choices are limited to your assigned area.
                  </Text>
                </View>
                <View
                  style={[
                    styles.row,
                    openSelect === "area-state" && styles.rowRaised,
                  ]}
                >
                  {area("state", "State *")}
                  {area("district", "District *")}
                </View>
                <View
                  style={[
                    styles.row,
                    (openSelect === "area-city" ||
                      openSelect === "area-village") &&
                      styles.rowRaised,
                  ]}
                >
                  {area("city", "City *")}
                  {area("village", "Village")}
                </View>
                <View
                  style={[
                    styles.row,
                    (openSelect === "area-boothNo" ||
                      openSelect === "area-ward") &&
                      styles.rowRaised,
                  ]}
                >
                  {area("boothNo", "Booth number *")}
                  {area("ward", "Ward number", "Enter ward number")}
                </View>
                {field(
                  "pollingStationAddressEnglish",
                  "Polling station address",
                  undefined,
                  "Polling station address",
                )}
              </View>
            </View>
          </ScrollView>
          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={close}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving, disabled: saving }}
              disabled={saving}
              onPress={submit}
              style={[styles.submit, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <UserPlus size={17} color="#FFFFFF" />
              )}
              <Text style={styles.submitText}>
                {saving ? "Adding voter…" : "Add voter"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormInput({
  label,
  value,
  onChange,
  keyboardType,
  placeholder,
  maxLength,
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: "number-pad" | "phone-pad";
  placeholder?: string;
  maxLength?: number;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={styles.input}
        maxLength={maxLength}
        editable={editable}
      />
    </View>
  );
}

function FormSelect({
  id,
  label,
  value,
  options,
  onChange,
  locked = false,
  openSelect,
  setOpenSelect,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  locked?: boolean;
  openSelect: string | null;
  setOpenSelect: (id: string | null) => void;
}) {
  const open = openSelect === id;

  return (
    <View style={[styles.field, open && styles.fieldOpen]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || "Select"}`}
        accessibilityState={{ disabled: locked, expanded: open }}
        disabled={locked}
        onPress={() => setOpenSelect(open ? null : id)}
        style={[styles.input, styles.select, locked && styles.locked]}
      >
        <Text
          style={[styles.selectText, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value || (locked ? "Not assigned" : "Select")}
        </Text>
        {locked ? (
          <LockKeyhole size={14} color="#64748B" />
        ) : (
          <ChevronDown size={16} color="#64748B" />
        )}
      </Pressable>

      {open ? (
        <View style={styles.options}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.optionsScroll}
          >
            {options.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: value === option }}
                key={option}
                onPress={() => {
                  onChange(option);
                  setOpenSelect(null);
                }}
                style={[
                  styles.option,
                  value === option && styles.optionSelected,
                ]}
              >
                <Text style={styles.selectText}>{option || "None"}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 11, marginTop: 3 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  form: { paddingBottom: 8 },
  sections: { gap: 12 },
  section: {
    backgroundColor: "#F8FAFC",
    borderColor: "#DFE8EF",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    zIndex: 1,
  },
  sectionRaised: {
    zIndex: 100,
    elevation: 100,
  },
  sectionTitle: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  row: {
    flexDirection: "row",
    gap: 10,
    zIndex: 1,
  },
  rowRaised: {
    zIndex: 200,
    elevation: 200,
  },
  field: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    zIndex: 1,
  },
  fieldOpen: {
    zIndex: 300,
    elevation: 300,
  },
  label: { color: "#475569", fontSize: 12, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D6E3EC",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#0F172A",
    fontSize: 13,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  selectText: { color: "#0F172A", fontSize: 13, flexShrink: 1 },
  placeholder: { color: "#94A3B8" },
  locked: { backgroundColor: "#EEF4F6" },
  options: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    maxHeight: 180,
    borderColor: "#D6E3EC",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    zIndex: 400,
    elevation: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  optionsScroll: {
    maxHeight: 180,
  },
  option: { minHeight: 44, justifyContent: "center", padding: 10 },
  optionSelected: { backgroundColor: "#ECFDF5" },
  areaNotice: { flexDirection: "row", alignItems: "center", gap: 6 },
  areaNoticeText: { flex: 1, color: "#087568", fontSize: 11, lineHeight: 16 },
  error: { color: "#B91C1C", fontSize: 12, paddingTop: 10, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  cancel: {
    minHeight: 46,
    flex: 1,
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: "#475569", fontSize: 13, fontWeight: "700" },
  submit: {
    minHeight: 46,
    flex: 1.5,
    backgroundColor: "#087568",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.65 },
});
