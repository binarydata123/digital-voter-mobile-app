import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LogOut } from "lucide-react-native";

import { api, getApiAuthToken } from "@/services/api";
import { getAuthToken } from "@/services/authentication";
import { subscribeAuthSession } from "@/services/auth-session-events";

export function AuthSessionGuard() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const unsubscribe = subscribeAuthSession((notice) => {
      setMessage(notice.message);
      if (notice.invalidated && !getAuthToken()) router.replace("/login");
    });
    // Cached voters remain usable offline; an online check enforces revocation.
    let checking = false;
    let active = true;
    async function checkSession() {
      if (checking || !active) return;
      checking = true;
      try {
        if (await getApiAuthToken()) await api.get("/auth/user");
      } catch {
        // Only authenticated 401 responses invalidate credentials in the interceptor.
      } finally {
        checking = false;
      }
    }
    const initial = setTimeout(() => { void checkSession(); }, 0);
    const interval = setInterval(() => { void checkSession(); }, 60000);
    return () => { active = false; clearTimeout(initial); clearInterval(interval); unsubscribe(); };
  }, []);

  return <Modal transparent visible={Boolean(message)} animationType="fade" onRequestClose={() => setMessage("")}>
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.icon}><LogOut size={27} color="#087568" /></View>
        <Text style={styles.title}>Account session</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={() => setMessage("")} style={styles.button}>
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.52)" },
  card: { width: "100%", maxWidth: 400, padding: 24, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center" },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#EAF7F2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  message: { marginTop: 10, fontSize: 14, lineHeight: 21, color: "#64748B", textAlign: "center" },
  button: { marginTop: 24, minHeight: 46, width: "100%", borderRadius: 12, backgroundColor: "#087568", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
