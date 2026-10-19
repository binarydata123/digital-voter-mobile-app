import * as Linking from "expo-linking";
import { MessageCircle, MonitorSmartphone, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { adminWhatsAppUrl, getDeviceLimitAdminContact, type DeviceLimitContact } from "@/services/device-limit-contact";

export function DeviceLimitModal({ contactToken, onClose }: {
  contactToken?: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [contact, setContact] = useState<DeviceLimitContact | null>(null);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function close() {
    active.current = false;
    onClose();
  }

  async function contactAdmin() {
    if (lock.current) return;
    if (!contactToken) {
      setError("Unable to load your admin contact. Please sign in again and try.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const details = contact ?? await getDeviceLimitAdminContact(contactToken);
      if (!active.current) return;
      setContact(details);
      await Linking.openURL(adminWhatsAppUrl(details));
    } catch (failure: any) {
      if (active.current) setError(failure?.response?.data?.message || failure?.message || "Unable to open WhatsApp. Please try again.");
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="Close device limit message" onPress={close} style={styles.close}>
          <X size={21} color="#64748B" />
        </Pressable>
        <View style={styles.icon}><MonitorSmartphone size={29} color="#087568" /></View>
        <Text style={styles.title}>Device limit reached</Text>
        {contact && <View style={styles.contact}><Text style={styles.contactName}>{contact.admin.name}</Text><Text style={styles.contactPhone}>{contact.admin.phone}</Text></View>}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={contactAdmin} style={[styles.primary, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <><MessageCircle size={19} color="#FFFFFF" /><Text style={styles.primaryText}>Message admin on WhatsApp</Text></>}
          </Pressable>
        <Pressable accessibilityRole="button" onPress={close} style={styles.secondary}><Text style={styles.secondaryText}>Back to sign in</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(15,23,42,0.52)" },
  card: { width: "100%", maxWidth: 400, padding: 24, paddingTop: 30, borderRadius: 24, backgroundColor: "#FFFFFF", alignItems: "center" },
  close: { position: "absolute", top: 10, right: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  icon: { height: 66, width: 66, borderRadius: 33, backgroundColor: "#EAF7F2", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  title: { color: "#0F172A", fontSize: 19, fontWeight: "800", textAlign: "center" },
  contact: { width: "100%", marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: "#F1F8F5", alignItems: "center", gap: 3 },
  contactName: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  contactPhone: { color: "#087568", fontSize: 13 },
  error: { marginTop: 14, color: "#B91C1C", fontSize: 13, lineHeight: 19, textAlign: "center" },
  primary: { marginTop: 22, minHeight: 48, width: "100%", borderRadius: 12, backgroundColor: "#087568", flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondary: { marginTop: 8, minHeight: 44, alignItems: "center", justifyContent: "center", width: "100%" },
  secondaryText: { color: "#087568", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
