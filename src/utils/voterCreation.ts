import type { AuthUser } from "@/services/authentication";

export type CreateVoterInput = {
  whatsappNumber?: string;
  serialNo?: string;
  education?: string;
  working?: string;
  economicCategory?: string;
  socialCategory?: string;
  rationCategory?: string;
  epicNo: string;
  nameEnglish: string;
  gender: string;
  age: string;
  dob: string;
  phone: string;
  houseNo: string;
  state: string;
  district: string;
  city: string;
  village: string;
  boothNo: string;
  ward: string;
  pollingStationAddressEnglish: string;
  relation: string;
  relationName: string;
};

export function getAssignedVoterLocations(user: AuthUser) {
  const values = (list?: string[], fallback?: string) =>
    Array.from(new Set((list?.length ? list : [fallback ?? ""])
      .map((value) => value.trim()).filter(Boolean)));
  return {
    state: values(user.states, user.state),
    district: values(user.districts, user.district),
    city: values(user.cities, user.city),
    village: values(user.villages),
    boothNo: values(user.assignedBooths, user.booth),
    ward: values(undefined, user.ward),
  };
}

export function newVoterForm(user: AuthUser): CreateVoterInput {
  const areas = getAssignedVoterLocations(user);
  return {
    epicNo: "", nameEnglish: "", gender: "", age: "", dob: "", phone: "",
    houseNo: "", state: areas.state[0] ?? "", district: areas.district[0] ?? "",
    city: areas.city[0] ?? "", village: areas.village[0] ?? "",
    boothNo: areas.boothNo[0] ?? "", ward: areas.ward[0] ?? "",
    pollingStationAddressEnglish: "", relation: "", relationName: "",
  };
}

export function getAgeFromVoterDob(value: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) return null;
  return today.getFullYear() - year - (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day) ? 1 : 0);
}

export function validateNewVoter(form: CreateVoterInput, user: AuthUser) {
  const areas = getAssignedVoterLocations(user);
  if (!areas.state.length || !areas.district.length) return "Your account needs an assigned state and district before adding voters.";
  for (const key of Object.keys(areas) as (keyof typeof areas)[]) {
    if (areas[key].length && !areas[key].some((value) => value.toLowerCase() === form[key].trim().toLowerCase())) {
      return "Choose locations within your assigned area.";
    }
  }
  if (!form.epicNo.trim()) return "EPIC number is required.";
  if (!form.nameEnglish.trim()) return "Voter name is required.";
  if (!["Male", "Female", "Transgender", "Other"].includes(form.gender)) return "Select a gender.";
  if (!/^\d+$/.test(form.age) || Number(form.age) < 18 || Number(form.age) > 130) return "Age must be between 18 and 130 years.";
  if (!form.city.trim() || !form.boothNo.trim()) return "City and booth number are required.";
  if (form.dob) {
    const age = getAgeFromVoterDob(form.dob);
    if (age === null) return "Enter a valid date of birth in YYYY-MM-DD format.";
    if (age !== Number(form.age)) return "Age must match the date of birth.";
  }
  if (form.whatsappNumber && !/^\d{10}$/.test(form.whatsappNumber)) return "WhatsApp must be 10 digits.";
  if (form.relation && !form.relationName.trim()) return "Enter the relation name.";
  return "";
}
