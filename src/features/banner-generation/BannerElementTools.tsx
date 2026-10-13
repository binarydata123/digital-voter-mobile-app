import { ArrowDown, ArrowUp, Pencil } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

export function BannerElementTools({ left, top, onFront, onBack, onEdit, zIndex }: {
  left: number; top: number; onFront: () => void; onBack: () => void; onEdit?: () => void; zIndex: number;
}) {
  return <View style={{ position: 'absolute', left, top, flexDirection: 'row', borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#0F4C4E' }}>
    {onEdit && <Pressable accessibilityRole="button" accessibilityLabel="Edit text colours" onPress={onEdit} style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center' }}><Pencil size={16} color="#0F4C4E" /></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Bring forward" accessibilityState={{ disabled: zIndex === 3 }} disabled={zIndex === 3} onPress={onFront} style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center', opacity: zIndex === 3 ? 0.35 : 1 }}><ArrowUp size={17} color="#0F4C4E" /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Send backward" accessibilityState={{ disabled: zIndex === 1 }} disabled={zIndex === 1} onPress={onBack} style={{ width: 36, height: 32, alignItems: 'center', justifyContent: 'center', opacity: zIndex === 1 ? 0.35 : 1 }}><ArrowDown size={17} color="#0F4C4E" /></Pressable>
  </View>;
}
