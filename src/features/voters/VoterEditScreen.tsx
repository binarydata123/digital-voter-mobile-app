import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "@/services/authentication";
import { updateLocalVoter } from "@/services/local-voters";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import {
  fetchVoterById,
  getSelectedVoter,
  saveManagedVoter,
  updateVoterDetails,
  type Voter,
} from "@/services/voters";
import { VoterEditForm } from "./components/VoterEditForm";

export default function VoterEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [voter, setVoter] = useState<Voter | null>(() => {
    const selected = getSelectedVoter();
    return selected?.id === id ? selected : null;
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (voter) return;
    let active = true;
    async function load() {
      if (!id)
        throw new Error("No voter selected. Go back and choose a voter.");
      // The normal flow supplies the selected voter; direct links can reload it.
      const result = await fetchVoterById(id);
      if (!result)
        throw new Error("Voter not found. Go back and refresh the voter list.");
      if (active) setVoter(result);
    }
    load().catch((cause) => {
      if (active)
        setError(
          cause instanceof Error ? cause.message : "Unable to load this voter.",
        );
    });
    return () => {
      active = false;
    };
  }, [id, voter]);
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace("/politician/voters");
  }
  async function save(nextVoter: Voter) {
    const saved = await updateVoterDetails(nextVoter);
    const userId = getCurrentUser()?.id;
    if (userId && isLocalVoterDatabaseAvailable())
      await updateLocalVoter(userId, saved);
    saveManagedVoter(saved);
    back();
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {voter ? (
        <VoterEditForm voter={voter} onClose={back} onSave={save} />
      ) : (
        <View
          style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
          <Text style={{ color: "#475569" }}>{error || "Loading voter…"}</Text>
          <Pressable onPress={back}>
            <Text style={{ color: "#087568", fontWeight: "700" }}>
              Back to voters
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
