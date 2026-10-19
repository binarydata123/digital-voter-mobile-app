import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCurrentUser, hasPoliticianPageAccess } from "@/services/authentication";
import { AddVoterForm } from "./components/AddVoterForm";
import { setCreatedVoter } from "./voter-creation-result";

export default function VoterAddScreen() {
  const user = getCurrentUser();
  function back() {
    if (router.canGoBack()) router.back();
    else router.replace("/politician/voters");
  }
  return (
    <SafeAreaView edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {user && hasPoliticianPageAccess("voters", user) ? (
        <AddVoterForm user={user} onClose={back}
          onCreated={(voter) => setCreatedVoter(user.id, voter)} />
      ) : (
        <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
          <Text>Sign in with voter access to add a voter.</Text>
          <Pressable onPress={back}><Text>Back to voters</Text></Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
