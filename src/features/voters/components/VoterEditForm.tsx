import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  X,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
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

import {
  EDUCATION_OPTIONS,
  OCCUPATION_OPTIONS,
} from "@/features/survey/demographic-options";
import type { Voter } from "@/services/voters";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  | "education"
  | "working"
  | "economicCategory"
  | "socialCategory"
  | "rationCategory"
>;

type VoterEditFormProps = {
  voter: Voter | null;
  onClose: () => void;
  onSave: (voter: Voter) => Promise<void>;
  mode?: "add" | "edit";
  locationFields?: ReactNode;
  boothField?: ReactNode;
  wardField?: ReactNode;
};

type VoterEditSheetProps = Omit<VoterEditFormProps, "voter"> & {
  voter: Voter;
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
    education: cleanFormText(voter.education),
    working: cleanFormText(voter.working),
    economicCategory: cleanFormText(voter.economicCategory),
    socialCategory: cleanFormText(voter.socialCategory),
    rationCategory: cleanFormText(voter.rationCategory),
  };
}

export function VoterEditForm({ voter, onClose, onSave, ...options }: VoterEditFormProps) {
  if (!voter) return null;

  return (
    <VoterEditSheet
      {...options}
      key={voter.id}
      voter={voter}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function VoterEditSheet({ voter, onClose, onSave, mode = "edit", locationFields, boothField, wardField }: VoterEditSheetProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const focusedInput = useRef<TextInput | null>(null);

  function revealInput(input: TextInput) {
    focusedInput.current = input;
    requestAnimationFrame(() =>
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
        input,
        110,
        true,
      ),
    );
  }

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      const input = focusedInput.current;
      if (input)
        scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
          input,
          110,
          true,
        );
    });
    return () => shown.remove();
  }, []);

  const [form, setForm] = useState<EditableVoterFields>(() => toForm(voter));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const saveLock = useRef(false);

  function updateField<Key extends keyof EditableVoterFields>(
    key: Key,
    value: EditableVoterFields[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    // Clear error for this field when user edits it
    if (fieldErrors[key]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  // ---------- Validation ----------
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    // New voters must be adults; existing records can include any age.
    const ageNum = Number(form.age);
    if ((mode === "add" || form.age) && (!Number.isFinite(ageNum) || ageNum < (mode === "add" ? 18 : 0) || ageNum > (mode === "add" ? 130 : 120))) {
      errors.age = mode === "add" ? "Age must be between 18 and 130" : "Age must be between 0 and 120";
    }

    // WhatsApp: exactly 10 digits
    if (form.whatsappNumber && !/^\d{10}$/.test(form.whatsappNumber)) {
      errors.whatsappNumber = "WhatsApp must be 10 digits";
    }

    // EPIC No: alphanumeric only
    if (form.epicNo && !/^[A-Za-z0-9]+$/.test(form.epicNo)) {
      errors.epicNo = "EPIC No. must be alphanumeric";
    }

    // Serial No: alphanumeric only
    if (form.serialNo && !/^[A-Za-z0-9]+$/.test(form.serialNo)) {
      errors.serialNo = "Serial No. must be alphanumeric";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save() {
    if (saveLock.current) return;

    if (!validateForm()) {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const age = Number(form.age);
      await onSave({
        ...voter,
        ...form,
        age: Number.isFinite(age) && age >= 0 ? Math.trunc(age) : voter.age,
        name: form.name.trim() || voter.name,
        gender: form.gender.trim() || voter.gender,
        guardian: form.guardian.trim() || "N/A",
        epicNo: form.epicNo.trim(),
        houseNo: form.houseNo.trim(),
        booth: form.booth.trim() || voter.booth,
        education: form.education?.trim() ?? "",
        working: form.working?.trim() ?? "",
      });
    } catch (error) {
      const serverMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(
        serverMessage || (error instanceof Error
          ? error.message
          : "Unable to save voter. Please try again."),
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      style={styles.backdrop}>
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back"
            onPress={onClose}
            disabled={saving}
            style={styles.headingIcon}>
            <ArrowLeft size={22} color="#087568" />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>{mode === "add" ? "Add voter" : "Edit voter"}</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {mode === "add" ? "Add a voter in your assigned area" : "Update voter details"}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}>
          <View pointerEvents={saving ? "none" : "auto"} style={styles.sections}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal details</Text>
              <View style={styles.twoColumn}>
                <Field
                  onFocus={revealInput}
                  label="Name"
                  value={form.name}
                  onChangeText={(value) => updateField("name", value)}
                />
                <Field
                  onFocus={revealInput}
                  keyboardType="phone-pad"
                  label="WhatsApp Number"
                  value={form.whatsappNumber ?? ""}
                  onChangeText={(value) =>
                    updateField(
                      "whatsappNumber",
                      value.replace(/[^\d]/g, "").slice(0, 10),
                    )
                  }
                  error={fieldErrors.whatsappNumber}
                />
              </View>

              <View style={styles.twoColumn}>
                <GenderDropdown
                  value={form.gender}
                  onChange={(value) => updateField("gender", value)}
                />
                <Field
                  onFocus={revealInput}
                  keyboardType="number-pad"
                  label="Age"
                  value={String(form.age || "")}
                  onChangeText={(value) => {
                    const digits = value.replace(/[^\d]/g, "").slice(0, 3);
                    updateField("age", Number(digits));
                  }}
                  error={fieldErrors.age}
                />
              </View>
              <View style={styles.twoColumn}>
                <GenderDropdown
                  label="Education"
                  value={form.education ?? ""}
                  options={EDUCATION_OPTIONS}
                  onChange={(value) => updateField("education", value)}
                />
                <GenderDropdown
                  label="Working / occupation"
                  value={form.working ?? ""}
                  options={OCCUPATION_OPTIONS}
                  onChange={(value) => updateField("working", value)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Voter identification</Text>
              <View style={styles.twoColumn}>
                <Field
                  onFocus={revealInput}
                  label="EPIC No."
                  value={form.epicNo}
                  onChangeText={(value) =>
                    updateField(
                      "epicNo",
                      value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10),
                    )
                  }
                  error={fieldErrors.epicNo}
                />
                <Field
                  onFocus={revealInput}
                  label="Serial No."
                  value={form.serialNo ?? ""}
                  onChangeText={(value) =>
                    updateField(
                      "serialNo",
                      value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10),
                    )
                  }
                  error={fieldErrors.serialNo}
                />
              </View>
              <View style={styles.twoColumn}>
                <Field
                  onFocus={revealInput}
                  label="House No."
                  value={form.houseNo ?? ""}
                  onChangeText={(value) => updateField("houseNo", value)}
                />
                {mode === "add" ? boothField : null}
              </View>
              {mode === "add" ? wardField : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Welfare & socioeconomic details
              </Text>
              <View style={styles.twoColumn}>
                <GenderDropdown
                  label="Economic category"
                  options={["IRDP", "BPL", "AAY", "APL", "EWS", "Unknown"]}
                  value={form.economicCategory ?? ""}
                  onChange={(value) => updateField("economicCategory", value)}
                />
                <GenderDropdown
                  label="Social category"
                  options={["SC", "ST", "OBC", "MBC", "General", "Unknown"]}
                  value={form.socialCategory ?? ""}
                  onChange={(value) => updateField("socialCategory", value)}
                />
              </View>
              <View style={styles.twoColumn}>
                <GenderDropdown
                  label="Ration category"
                  options={["PHH", "AAY", "Other", "Unknown"]}
                  value={form.rationCategory ?? ""}
                  onChange={(value) => updateField("rationCategory", value)}
                />
                <View style={styles.field} />
              </View>
            </View>

            {locationFields}
          </View>
        </ScrollView>

        {saveError ? (
          <Text accessibilityRole="alert" style={styles.saveError}>
            {saveError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable disabled={saving} onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={save}
            style={[styles.primaryButton, saving && { opacity: 0.6 }]}>
            <Check color="#FFFFFF" size={18} />
            <Text style={styles.primaryButtonText}>
              {saving ? "Saving…" : mode === "add" ? "Add voter" : "Save changes"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function GenderDropdown({
  value,
  onChange,
  label = "Gender",
  options: standardOptions = ["Male", "Female", "Transgender", "Other"],
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const options =
    value && !standardOptions.includes(value)
      ? [value, ...standardOptions]
      : standardOptions;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || "Select an option"}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[styles.input, styles.dropdownButton]}>
        <Text style={styles.dropdownText}>
          {value || (label === "Gender" ? "Select gender" : "Unknown")}
        </Text>
        <ChevronDown size={18} color="#64748B" />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}>
        <View style={styles.dropdownOverlay} accessibilityViewIsModal>
          <Pressable
            accessibilityLabel={`Close ${label.toLowerCase()} options`}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.dropdownOptions,
              { paddingBottom: Math.max(34, insets.bottom + 12) },
            ]}>
            <View style={styles.dropdownHandle} />
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{label}</Text>
              <Pressable
                accessibilityLabel="Close options"
                style={styles.closeButton}
                onPress={() => setOpen(false)}>
                <X size={22} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dropdownList}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === option }}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  style={[
                    styles.dropdownOption,
                    value === option && styles.dropdownSelected,
                  ]}>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      value === option && styles.dropdownSelectedText,
                    ]}>
                    {option}
                  </Text>
                  {value === option ? (
                    <CheckCircle2 size={18} color="#087568" />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function Field({
  onFocus,
  label,
  value,
  onChangeText,
  keyboardType,
  error,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad" | "phone-pad";
  onFocus?: (input: TextInput) => void;
  error?: string;
  editable?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={editable}
        ref={inputRef}
        onFocus={() => {
          if (inputRef.current) onFocus?.(inputRef.current);
        }}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor="#94A3B8"
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export const voterFormStyles = StyleSheet.create({
  saveError: {
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  sheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    flexShrink: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F5",
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5EF",
  },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  subtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  formScroll: { flex: 1 },
  form: { gap: 10, padding: 16, paddingBottom: 24 },
  sections: { gap: 10 },
  section: { gap: 9 },
  sectionTitle: { color: "#334155", fontSize: 13, fontWeight: "700" },
  twoColumn: { flexDirection: "row", gap: 10 },
  field: { flex: 1, minWidth: 0, gap: 1 },
  label: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE8EF",
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inputError: {
    borderColor: "#B91C1C",
    backgroundColor: "#FEF2F2",
  },
  fieldErrorText: {
    color: "#B91C1C",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.46)",
  },
  dropdownOptions: {
    maxHeight: "75%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  dropdownHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 6,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dropdownTitle: { flex: 1, color: "#0F172A", fontSize: 18, fontWeight: "900" },
  dropdownList: { gap: 10 },
  dropdownOption: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownSelected: { backgroundColor: "#EAF7F2", borderColor: "#087568" },
  dropdownOptionText: {
    flex: 1,
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
  dropdownSelectedText: { color: "#064E3B" },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: "#475569", fontSize: 14, fontWeight: "700" },
  primaryButton: {
    flex: 1.5,
    minHeight: 48,
    flexDirection: "row",
    gap: 7,
    borderRadius: 12,
    backgroundColor: "#087568",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});

const styles = voterFormStyles;
