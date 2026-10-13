import { useLocalSearchParams } from "expo-router";
import VotersScreen from "@/features/voters/VotersScreen";

export default function VoterSearchScreen() {
  const { booth } = useLocalSearchParams<{ booth?: string }>();
  return <VotersScreen searchMode initialBooth={typeof booth === "string" ? booth : "All"} />;
}
