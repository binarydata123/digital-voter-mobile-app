import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Search, UserRound, Sparkles, RotateCcw, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PARTIES, type Party } from './parties';

const titles = ['Select Your Party', 'Choose a Politician', 'Choose a Banner', 'Add Your Photo', 'Your Banner Preview'];
const subtitles = ['Your party. Your leader. Your banner.', 'Choose who you want on your banner.', 'Pick a design to make your own.', 'Make this banner yours.', 'Here is how your personalised banner looks.'];
const templates = ['Together for progress', 'Celebration greeting', 'Community announcement'];
const demoLeaders = ['Sample politician 1', 'Sample politician 2', 'Sample politician 3'];

export default function BannerGenerationFlow() {
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [party, setParty] = useState<Party | null>(null);
  const [leader, setLeader] = useState('');
  const [template, setTemplate] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState(1);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [error, setError] = useState('');
  const filtered = PARTIES.filter(p => `${p.name} ${p.short}`.toLowerCase().includes(query.toLowerCase().trim()));
  function back() {
    setQuery(''); setError('');
    if (step > 0) setStep(step - 1);
    else if (router.canGoBack()) router.back(); else router.replace('/login');
  }
  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled) { setPhoto(result.assets[0].uri); setError(''); }
    } catch { setError('Could not open your photos. Please try again.'); }
  }
  function showPending(action: string) { Alert.alert(action, 'This is a design preview. Background removal and image export will be connected in the next step.'); }
  function banner(index: number, preview = false) {
    return <View style={[s.banner, { backgroundColor: index === 1 ? '#E7EFE9' : index === 2 ? '#E9EEF6' : '#EAF5F1', minHeight: preview ? 280 : 170 }]}>
      <View style={[s.bannerStripe, { backgroundColor: party?.color ?? '#0F4C4E' }]} />
      <View style={s.bannerTop}><Text style={[s.partyPill, { color: party?.color }]}>{party?.short}</Text><Text style={s.demoLabel}>SAMPLE DESIGN</Text></View>
      <View style={s.bannerBody}>
        <View style={{ flex: 1 }}><Text style={s.bannerHeadline}>{templates[index]}</Text><Text style={s.bannerLeader}>{leader}</Text><Text style={s.bannerMeta}>{party?.name}</Text></View>
        <View style={s.leaderPlaceholder}><UserRound size={42} color={party?.color ?? '#0F4C4E'} /></View>
      </View>
      {preview && photo && <View style={[s.supporterRow, { flexDirection: side === 'left' ? 'row' : 'row-reverse' }]}>
        <Image source={{ uri: photo }} style={{ width: 58 * size, height: 68 * size, borderRadius: 8 }} resizeMode="cover" />
        <View style={{ flex: 1 }}><Text style={s.bannerLeader}>{name.trim() || 'Your name'}</Text><Text style={s.bannerMeta}>Supporter</Text></View>
      </View>}
      <Text style={s.bannerFooter}>POLITICEASE · SUPPORTER BANNER</Text>
    </View>;
  }
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={s.back}><ArrowLeft color="#0F4C4E" size={22} /></Pressable><Text style={s.brand}>Banner Studio</Text><Text style={s.stepLabel}>{step + 1} / 5</Text></View>
    <View style={s.heading}><Text style={s.eyebrow}>CREATE SOMETHING PERSONAL</Text><Text style={s.title}>{titles[step]}</Text><Text style={s.subtitle}>{subtitles[step]}</Text>
      <View style={s.steps}>{titles.map((_, i) => <View key={i} style={[s.stepBar, i <= step && s.activeStep]} />)}</View>
      {party && step > 0 && <View style={s.context}><Text style={s.contextText}>{party.short}{step > 1 ? `  /  ${leader}` : ''}</Text><Check size={14} color="#0F4C4E" /></View>}
    </View>
    {step < 2 && <View style={s.search}><Search size={19} color="#82948F" /><TextInput value={query} onChangeText={setQuery} placeholder={step === 0 ? 'Search party name or abbreviation' : 'Search politicians'} placeholderTextColor="#82948F" style={s.searchInput} /></View>}
    {step === 0 ? <FlatList data={filtered} numColumns={2} keyExtractor={p => p.id} contentContainerStyle={s.grid} columnWrapperStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={5}
      ListHeaderComponent={<Text style={s.sectionLabel}>{filtered.length} PARTIES · NATIONAL & REGIONAL</Text>}
      ListEmptyComponent={<View style={s.empty}><Search color="#82948F" /><Text style={s.cardTitle}>No parties found</Text><Text style={s.subtitle}>Try a different party name.</Text></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name}`} onPress={() => { setParty(item); setLeader(''); setPhoto(null); setName(''); setSize(1); setSide('right'); setQuery(''); setStep(1); }} style={s.partyCard}>
        <View style={[s.partyMark, { backgroundColor: `${item.color}12` }]}><Text style={[s.partyAbbreviation, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>{item.short}</Text></View>
        <Text style={s.partyName} numberOfLines={3}>{item.name}</Text><View style={s.choose}><Text style={s.chooseText}>Choose party</Text><ChevronRight size={14} color="#0F4C4E" /></View>
      </Pressable>} /> : <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {step === 1 && <><Text style={s.notice}>Sample politicians shown for this UI preview. Real profiles will appear when the politician directory is connected.</Text>
        {demoLeaders.filter(p => p.toLowerCase().includes(query.toLowerCase())).map((p, i) => <Pressable key={p} style={s.leaderCard} accessibilityRole="button" onPress={() => { setLeader(p); setQuery(''); setStep(2); }}>
          <View style={[s.avatar, { backgroundColor: `${party?.color}15` }]}><UserRound size={28} color={party?.color} /></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{p}</Text><Text style={s.subtitle}>{party?.short} · Sample profile {i + 1}</Text></View><ChevronRight color="#0F4C4E" size={20} />
        </Pressable>)}
        {!demoLeaders.some(p => p.toLowerCase().includes(query.toLowerCase())) && <Text style={s.notice}>No matching politicians found.</Text>}
      </>}
      {step === 2 && <><Text style={s.notice}>Sample banner designs</Text>{templates.map((title, i) => <Pressable key={title} accessibilityRole="button" accessibilityLabel={`Choose ${title}`} style={s.templateCard} onPress={() => { setTemplate(i); setStep(3); }}>{banner(i)}<View style={s.templateCaption}><Text style={s.cardTitle}>{title}</Text><ArrowRight color="#0F4C4E" size={20} /></View></Pressable>)}</>}
      {step >= 3 && <>{banner(template, true)}
        {step === 3 && <><View style={s.panel}><Text style={s.cardTitle}>Your photo</Text><Text style={s.subtitle}>Choose a clear photo. Transparent PNGs also work.</Text><Pressable style={s.upload} accessibilityRole="button" onPress={() => void pickPhoto()}><ImagePlus size={23} color="#0F4C4E" /><Text style={s.uploadText}>{photo ? 'Replace photo' : 'Upload your photo'}</Text></Pressable>
          {photo && <><Pressable style={s.outlineButton} accessibilityRole="button" onPress={() => showPending('Remove background')}><Sparkles size={18} color="#0F4C4E" /><Text style={s.uploadText}>Remove background</Text></Pressable><Text style={s.smallNote}>Background removal is not connected in this UI preview.</Text></>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        </View>
        <View style={s.panel}><Text style={s.cardTitle}>Personalise your banner</Text><Text style={s.inputLabel}>YOUR NAME</Text><TextInput value={name} onChangeText={setName} maxLength={50} placeholder="Enter your name" style={s.nameInput} placeholderTextColor="#82948F" />
          <Text style={s.inputLabel}>PHOTO POSITION</Text><View style={s.controls}>{(['left', 'right'] as const).map(position => <Pressable key={position} onPress={() => setSide(position)} accessibilityRole="button" accessibilityState={{ selected: side === position }} style={[s.control, side === position && s.controlSelected]}><Text style={s.uploadText}>{position === 'left' ? 'Left' : 'Right'}</Text></Pressable>)}</View>
          <Text style={s.inputLabel}>PHOTO SIZE</Text><View style={s.controls}><Pressable accessibilityRole="button" accessibilityLabel="Smaller photo" style={s.control} onPress={() => setSize(Math.max(0.7, size - 0.1))}><Text style={s.uploadText}>−</Text></Pressable><Text style={s.size}>{Math.round(size * 100)}%</Text><Pressable accessibilityRole="button" accessibilityLabel="Larger photo" style={s.control} onPress={() => setSize(Math.min(1.5, size + 0.1))}><Text style={s.uploadText}>+</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Reset photo position" onPress={() => { setSize(1); setSide('right'); }} style={s.control}><RotateCcw size={18} color="#0F4C4E" /></Pressable></View>
        </View></>}
        {step === 4 && <View style={s.panel}><Text style={s.cardTitle}>Your preview is ready</Text><Text style={s.subtitle}>Check your photo and name before exporting.</Text><Text style={s.smallNote}>This preview uses sample artwork. Download and sharing will be enabled when banner export is connected.</Text><Pressable style={s.outlineButton} onPress={() => setStep(3)} accessibilityRole="button"><Text style={s.uploadText}>Edit banner</Text></Pressable></View>}
      </>}
    </ScrollView>}
    {step >= 3 && <View style={s.footer}>{step === 3 ? <Pressable disabled={!photo} accessibilityRole="button" accessibilityState={{ disabled: !photo }} style={[s.primary, !photo && { opacity: 0.45 }]} onPress={() => setStep(4)}><Sparkles color="#fff" size={19} /><Text style={s.primaryText}>Generate banner preview</Text></Pressable> : <View style={s.controls}><Pressable style={[s.control, { opacity: 0.45 }]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}><Text style={s.uploadText}>Save to gallery</Text></Pressable><Pressable style={[s.primary, { flex: 1, opacity: 0.45 }]} disabled accessibilityRole="button" accessibilityState={{ disabled: true }}><Text style={s.primaryText}>Share</Text></Pressable></View>}</View>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F6' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE8E4' },
  brand: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F4C4E' }, stepLabel: { color: '#7A8C88', fontSize: 12 },
  heading: { paddingHorizontal: 24, paddingTop: 24 }, eyebrow: { fontSize: 10, letterSpacing: 1.5, color: '#5A8177', fontWeight: '700' },
  title: { fontSize: 27, fontWeight: '700', color: '#173A36', marginTop: 7 }, subtitle: { fontSize: 13, lineHeight: 20, color: '#7A8C88', marginTop: 4 },
  steps: { flexDirection: 'row', gap: 5, marginTop: 20, marginBottom: 16 }, stepBar: { height: 3, borderRadius: 2, backgroundColor: '#DFE8E4', flex: 1 }, activeStep: { backgroundColor: '#0F4C4E' },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E4EFEB', padding: 10, borderRadius: 8, marginBottom: 12 }, contextText: { color: '#0F4C4E', fontSize: 12, flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 24, paddingHorizontal: 14, height: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE8E4', borderRadius: 12, marginBottom: 10 }, searchInput: { flex: 1, color: '#173A36', fontSize: 13 },
  grid: { padding: 24, paddingTop: 12, paddingBottom: 32 }, sectionLabel: { color: '#7A8C88', fontSize: 10, letterSpacing: 1, fontWeight: '700', marginBottom: 16 },
  partyCard: { flex: 1, maxWidth: '50%', aspectRatio: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE8E4', borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  partyMark: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, partyAbbreviation: { fontSize: 16, fontWeight: '800' }, partyName: { fontSize: 12, color: '#173A36', fontWeight: '600', textAlign: 'center', marginTop: 8 }, choose: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, chooseText: { fontSize: 10, color: '#0F4C4E' },
  scroll: { padding: 24, paddingTop: 12, gap: 16 }, notice: { fontSize: 12, lineHeight: 19, color: '#7A8C88' }, leaderCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#DFE8E4' }, avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 15, fontWeight: '700', color: '#173A36' },
  banner: { borderRadius: 12, overflow: 'hidden', padding: 18 }, bannerStripe: { height: 5, position: 'absolute', top: 0, left: 0, right: 0 }, bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }, partyPill: { fontWeight: '800', fontSize: 12 }, demoLabel: { fontSize: 8, letterSpacing: 1, color: '#7A8C88' }, bannerBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }, bannerHeadline: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: '#173A36' }, bannerLeader: { fontSize: 12, fontWeight: '700', color: '#173A36', marginTop: 8 }, bannerMeta: { fontSize: 10, lineHeight: 15, color: '#628077', marginTop: 3 }, leaderPlaceholder: { width: 70, height: 90, backgroundColor: '#ffffff99', borderRadius: 35, alignItems: 'center', justifyContent: 'center' }, supporterRow: { alignItems: 'center', gap: 12, marginTop: 16 }, bannerFooter: { fontSize: 8, letterSpacing: 1.2, marginTop: 16, color: '#628077' },
  templateCard: { backgroundColor: '#fff', borderRadius: 14, padding: 8, borderWidth: 1, borderColor: '#DFE8E4' }, templateCaption: { padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panel: { backgroundColor: '#fff', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#DFE8E4' }, upload: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#ADCAC0', borderRadius: 12, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, backgroundColor: '#F7FAF8' }, uploadText: { color: '#0F4C4E', fontWeight: '600', fontSize: 13 }, outlineButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ADCAC0', borderRadius: 10, padding: 12, marginTop: 12 }, smallNote: { color: '#7A8C88', fontSize: 11, lineHeight: 17, marginTop: 10 }, error: { color: '#B91C1C', fontSize: 12, marginTop: 10 }, inputLabel: { color: '#7A8C88', fontSize: 10, letterSpacing: 1, fontWeight: '700', marginTop: 18, marginBottom: 8 }, nameInput: { borderWidth: 1, borderColor: '#DFE8E4', backgroundColor: '#F7FAF8', borderRadius: 10, padding: 12, color: '#173A36' }, controls: { flexDirection: 'row', gap: 10, alignItems: 'center' }, control: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DFE8E4', borderRadius: 10, backgroundColor: '#fff' }, controlSelected: { borderColor: '#0F4C4E', backgroundColor: '#E4EFEB' }, size: { color: '#173A36', fontSize: 12 }, footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#DFE8E4', paddingHorizontal: 24, paddingVertical: 14 }, primary: { backgroundColor: '#0F4C4E', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' }, empty: { alignItems: 'center', gap: 12, paddingVertical: 50 },
});
