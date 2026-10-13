import { ImagePlus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
export function BannerStudioMenuItem({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 66, borderBottomWidth: 1, borderBottomColor: '#EEF2F7' }}>
    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={20} strokeWidth={2.6} color="#087568" /></View>
    <View style={{ flex: 1 }}><Text style={{ color: '#0F172A', fontSize: 14, fontWeight: '900' }}>Open Banner Studio</Text><Text style={{ marginTop: 2, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Create a personalised supporter banner</Text></View>
  </Pressable>;
}
