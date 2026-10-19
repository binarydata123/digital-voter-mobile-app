import { useState } from "react";
import { Text, View } from "react-native";

import type { AuthUser } from "@/services/authentication";
import { createVoter, type Voter } from "@/services/voters";
import {
  getAssignedVoterLocations,
  newVoterForm,
  validateNewVoter,
  type CreateVoterInput,
} from "@/utils/voterCreation";
import {
  Field,
  GenderDropdown,
  VoterEditForm,
  voterFormStyles as styles,
} from "./VoterEditForm";

export function AddVoterForm({ user, onClose, onCreated }: {
  user: AuthUser;
  onClose: () => void;
  onCreated: (voter: Voter) => void;
}) {
  const [location, setLocation] = useState(() => newVoterForm(user));
  const [voter] = useState<Voter>(() => ({
    id: "new-voter", name: "", gender: "", age: 0, guardian: "",
    epicNo: "", houseNo: "", booth: location.boothNo, ward: location.ward,
  }));
  const areas = getAssignedVoterLocations(user);

  function update(key: keyof CreateVoterInput, value: string) {
    setLocation((current) => ({ ...current, [key]: value }));
  }

  function area(key: keyof typeof areas, label: string) {
    const options = areas[key];
    if (options.length > 1) return (
      <GenderDropdown label={label} value={location[key]} options={options}
        onChange={(value) => update(key, value)} />
    );
    return <Field label={label} value={location[key]}
      editable={!options.length && key !== "state" && key !== "district"}
      onChangeText={(value) => update(key, value)} />;
  }

  async function save(next: Voter) {
    const input: CreateVoterInput = {
      ...location,
      nameEnglish: next.name,
      gender: next.gender,
      age: String(next.age),
      epicNo: next.epicNo,
      houseNo: next.houseNo,
      whatsappNumber: next.whatsappNumber ?? "",
      serialNo: next.serialNo ?? "",
      education: next.education ?? "",
      working: next.working ?? "",
      economicCategory: next.economicCategory ?? "",
      socialCategory: next.socialCategory ?? "",
      rationCategory: next.rationCategory ?? "",
    };
    const error = validateNewVoter(input, user);
    if (error) throw new Error(error);
    const created = await createVoter(input);
    onCreated(created);
    onClose();
  }

  return (
    <VoterEditForm voter={voter} mode="add" onClose={onClose} onSave={save}
      boothField={area("boothNo", "Booth *")}
      wardField={area("ward", "Ward")}
      locationFields={
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & family</Text>
          <Text style={styles.subtitle}>Location choices are limited to your assigned area.</Text>
          <View style={styles.twoColumn}>
            {area("state", "State *")}
            {area("district", "District *")}
          </View>
          <View style={styles.twoColumn}>
            {area("city", "City *")}
            {area("village", "Village")}
          </View>
          <Field label="Polling station address" value={location.pollingStationAddressEnglish}
            onChangeText={(value) => update("pollingStationAddressEnglish", value)} />
          <View style={styles.twoColumn}>
            <GenderDropdown label="Relation" value={location.relation}
              options={["None", "Father", "Mother", "Husband", "Wife", "Guardian"]}
              onChange={(value) => {
                update("relation", value === "None" ? "" : value);
                if (value === "None") update("relationName", "");
              }} />
            <Field label={location.relation ? `${location.relation} name *` : "Relation name"}
              value={location.relationName} editable={Boolean(location.relation)}
              onChangeText={(value) => update("relationName", value)} />
          </View>
        </View>
      } />
  );
}
