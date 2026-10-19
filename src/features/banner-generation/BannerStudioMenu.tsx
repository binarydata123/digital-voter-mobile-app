import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Menu, FileText, UsersRound, Printer, LogOut } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ensureAuthSession, type AuthUser } from '@/services/authentication';
import { logoutAndReturnToLogin } from '@/utils/logout-and-return-to-login';

export function BannerStudioMenu() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    void ensureAuthSession().then(session => { if (active) setUser(session.user); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!user) return null;
  const links = [
    { label: 'Open voter page', route: '/politician/voters' as const, enabled: user.showVoterPage, subtitle: 'Manage voter records', Icon: FileText },
    { label: 'Open template page', route: '/politician/templates' as const, enabled: user.showTemplatePage, subtitle: 'Build booth voter banner templates', Icon: Printer },
    { label: 'Open survey page', route: '/politician/survey' as const, enabled: user.showSurveyPage, subtitle: 'Manage voter surveys', Icon: UsersRound },
  ];
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open navigation menu" onPress={() => setVisible(true)} style={[styles.headerIconButton, styles.menuButton]}><Menu size={21} strokeWidth={2.8} color="#fff" /></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.menuBackdrop} onPress={() => setVisible(false)}>
        <Pressable style={styles.menuDrawer} onPress={event => event.stopPropagation()}>
          <View style={styles.menuHandle} />
          <View style={styles.menuHeader} />
          {links.filter(link => link.enabled).map(link => <Pressable key={link.route} accessibilityRole="button" onPress={() => { setVisible(false); router.navigate(link.route); }} style={styles.menuRow}>
            <View style={styles.menuIconWrap}><link.Icon size={20} strokeWidth={2.6} color="#087568" /></View>
            <View style={styles.menuCopy}><Text style={styles.menuRowTitle}>{link.label}</Text><Text style={styles.menuRowSubtitle}>{link.subtitle}</Text></View>
          </Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => { setVisible(false); void logoutAndReturnToLogin(); }} style={[styles.menuRow, styles.logoutMenuRow]}>
            <View style={[styles.menuIconWrap, styles.logoutMenuIconWrap]}><LogOut size={20} strokeWidth={2.6} color="#B91C1C" /></View>
            <View style={styles.menuCopy}><Text style={styles.logoutMenuTitle}>Logout</Text><Text style={styles.menuRowSubtitle}>Sign out from this device</Text></View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F766E",
    shadowOpacity: 0.14,
    shadowRadius: 9,
    elevation: 3,
  },
  menuButton: { backgroundColor: "#087568" },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  menuDrawer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 32,
  },
  menuHandle: {
    alignSelf: "center",
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  menuHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  menuTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  menuClose: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  menuRow: {
    alignItems: "center",
    borderBottomColor: "#EEF2F7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 66,
    paddingVertical: 10,
  },
  menuIconWrap: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuRowTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  menuRowSubtitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  logoutMenuRow: { borderBottomWidth: 0, marginTop: 4 },
  logoutMenuIconWrap: { backgroundColor: "#FEF2F2" },
  logoutMenuTitle: { color: "#B91C1C", fontSize: 14, fontWeight: "900" },
});
