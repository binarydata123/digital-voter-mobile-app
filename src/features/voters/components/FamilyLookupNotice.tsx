import type { Voter } from '@/services/voters';
import { CircleAlert, UsersRound, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { shareCardValue } from '../share-card-values';

export type FamilyNotice = { voter: Voter; error?: string };
export function FamilyLookupNotice({ notice, onClose }: { notice: FamilyNotice; onClose: () => void }) {
  const Icon = notice.error ? CircleAlert : UsersRound;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close family message" onPress={onClose} />
      <View style={s.panel} accessibilityViewIsModal>
        <Pressable style={s.close} accessibilityLabel="Close family message" onPress={onClose}><X size={20} color="#64748B" /></Pressable>
        <View style={s.icon}><Icon size={30} color="#087568" /></View>
        <Text style={s.title}>{notice.error ? 'Unable to find family members' : 'No other family members found'}</Text>
        <Text style={s.message}>{notice.error || 'This house has only one member. No other family members were found.'}</Text>
        {!notice.error ? <View style={s.address}><Text style={s.addressText}>{shareCardValue(notice.voter.booth)} · House No. {shareCardValue(notice.voter.houseNo)}</Text></View> : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={s.button}><Text style={s.buttonText}>Got it</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15,23,42,0.46)' },
  panel: { width: '100%', maxWidth: 360, padding: 24, paddingTop: 28, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center' }, close: { position: 'absolute', right: 8, top: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#EAF7F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '800', color: '#0F172A', textAlign: 'center' }, message: { fontSize: 13, lineHeight: 20, color: '#64748B', textAlign: 'center', marginTop: 10 }, address: { backgroundColor: '#F0F8F5', borderRadius: 10, padding: 10, marginTop: 14, width: '100%' }, addressText: { color: '#087568', fontSize: 12, fontWeight: '700', textAlign: 'center' }, button: { width: '100%', minHeight: 48, borderRadius: 12, backgroundColor: '#087568', alignItems: 'center', justifyContent: 'center', marginTop: 20 }, buttonText: { fontSize: 14, color: 'white', fontWeight: '700' },
});
