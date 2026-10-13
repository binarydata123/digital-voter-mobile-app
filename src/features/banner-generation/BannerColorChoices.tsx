import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

const COLORS = [
  { value: '#111111', name: 'Black' }, { value: '#FFFFFF', name: 'White' },
  { value: '#FF9900', name: 'Orange' }, { value: '#FFDA55', name: 'Yellow' },
  { value: '#0F4C4E', name: 'Teal' }, { value: '#C62828', name: 'Red' },
  { value: '#2458B8', name: 'Blue' }, { value: '#198754', name: 'Green' },
];
export function BannerColorChoices({ label, value, onChange, allowTransparent = false }: {
  label: string; value: string; onChange: (value: string) => void; allowTransparent?: boolean;
}) {
  const choices = COLORS;
  return <View style={{ marginTop: 16 }}>
    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7A8C88', marginBottom: 8 }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {choices.map(color => <Pressable key={color.value} accessibilityRole="button" accessibilityLabel={`${label}: ${color.name}`} accessibilityState={{ selected: value === color.value }} onPress={() => onChange(color.value)}
        style={{ width: 44, height: 44, borderRadius: 22, padding: 4, borderWidth: value === color.value ? 2 : 1, borderColor: value === color.value ? '#0F4C4E' : '#DFE8E4', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color.value, borderWidth: 1, borderColor: '#DFE8E4', alignItems: 'center', justifyContent: 'center' }}>
          {value === color.value && <Check size={18} color={['#FFFFFF', '#FFDA55', '#FF9900'].includes(color.value) ? '#111111' : '#FFFFFF'} />}
        </View>
      </Pressable>)}
    </View>
    {allowTransparent && <Pressable accessibilityRole="button" accessibilityLabel={`${label}: Transparent background`} accessibilityState={{ selected: value === 'transparent' }} onPress={() => onChange('transparent')}
      style={{ minHeight: 44, marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, borderColor: value === 'transparent' ? '#0F4C4E' : '#DFE8E4', backgroundColor: value === 'transparent' ? '#E4EFEB' : '#fff' }}>
      <Text style={{ color: '#0F4C4E', fontSize: 22 }}>∅</Text>
      <Text style={{ flex: 1, color: '#0F4C4E', fontSize: 13, fontWeight: '600' }}>Transparent background</Text>
      {value === 'transparent' && <Check size={18} color="#0F4C4E" />}
    </Pressable>}
  </View>;
}
