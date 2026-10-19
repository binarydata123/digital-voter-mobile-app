import {
  Briefcase,
  BriefcaseBusiness,
  GraduationCap,
  Hammer,
  House,
  Landmark,
  Mars,
  Shield,
  Store,
  UsersRound,
  Venus,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";

export const GENDER_ICONS: Record<string, LucideIcon> = {
  Male: Mars,
  Female: Venus,
  Other: UsersRound,
};

export const OCCUPATION_ICONS: Record<string, LucideIcon> = {
  "Private Job / Staff": BriefcaseBusiness,
  "State Government": Landmark,
  "Central / Army": Shield,
  "Business / Trader": Store,
  "Farmer / Agriculture": Wheat,
  "Daily Wage / Labour": Hammer,
  Homemaker: House,
  Student: GraduationCap,
  Unemployed: Briefcase,
};
