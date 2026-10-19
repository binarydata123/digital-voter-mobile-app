import { router } from "expo-router";

import { logoutPolitician } from "@/services/authentication";

export async function logoutAndReturnToLogin() {
  const loggedOut = await logoutPolitician();
  if (!loggedOut) return false;

  // Remove the authenticated screens before opening login. This prevents a
  // stale screen from being revealed by Android back navigation after logout.
  router.dismissAll();
  router.replace("/login");
  return true;
}
