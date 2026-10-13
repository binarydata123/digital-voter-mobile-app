import { Redirect } from "expo-router";
import { useLoginDestination } from "@/hooks/use-login-destination";

export default function HomeScreen() {
  const destination = useLoginDestination();
  return destination ? <Redirect href={destination} /> : null;
}
