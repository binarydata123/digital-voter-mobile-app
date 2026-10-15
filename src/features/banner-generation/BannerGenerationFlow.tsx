import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Search, UserRound, Sparkles, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicPoliticians, type PublicPolitician } from '@/services/public-politicians';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PARTIES, type Party } from './parties';
import { exportBanner } from './export-banner';
import { BannerStudioMenu } from './BannerStudioMenu';
import { BannerColorChoices } from './BannerColorChoices';
import { DraggableBannerText } from './DraggableBannerText';
import { DraggableSupporter, DEFAULT_SUPPORTER_PLACEMENT } from './DraggableSupporter';
import { PoliticianListSkeleton } from './PoliticianListSkeleton';
import { removePhotoBackground, deleteCutout } from '@/services/background-removal';
import { loadBannerSupporter, saveBannerSupporter } from '@/services/banner-supporter';

type BannerLayer = 'photo' | 'name' | 'phone';
const titles = ['Select Your Party', 'Choose a Politician', 'Choose a Banner', 'Edit Your Banner'];
const subtitles = ['Your party. Your leader. Your banner.', 'Choose who you want on your banner.', 'Pick a design to make your own.', 'Your changes appear live. Save or share when ready.'];


export default function BannerGenerationFlow() {
  const bannerRef = useRef<View>(null);
  const exportBusy = useRef(false);
  const [exporting, setExporting] = useState<'save' | 'share' | null>(null);
  const [gallerySaved, setGallerySaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);
  const [exportMessage, setExportMessage] = useState('');
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const imageLoaded = useCallback((uri: string) => setLoadedImages(previous => previous[uri] ? previous : { ...previous, [uri]: true }), []);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [party, setParty] = useState<Party | null>(null);
  const [selectedPolitician, setSelectedPolitician] = useState<PublicPolitician | null>(null);
  const leader = selectedPolitician?.name ?? '';
  const [politicians, setPoliticians] = useState<PublicPolitician[]>([]);
  const [loadingPoliticians, setLoadingPoliticians] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [retry, setRetry] = useState(0);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [customBanner, setCustomBanner] = useState<string | null>(null);
  const [pickingBanner, setPickingBanner] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const banners = selectedPolitician ? [
    { title: 'Politician banner', uri: selectedPolitician.bannerImage },
    ...(customBanner ? [{ title: 'Your uploaded banner', uri: customBanner }] : []),
  ].filter((item, index, items) => item.uri && items.findIndex(b => b.uri === item.uri) === index) : [];
  useEffect(() => {
    if (!party) return;
    const partyName = party.name;
    const controller = new AbortController();
    async function load() {
      setLoadingPoliticians(true); setDirectoryError('');
      try {
        const result = await fetchPublicPoliticians(partyName, page, controller.signal);
        if (controller.signal.aborted) return;
        setPoliticians(previous => page === 1 ? result.politicians : [...previous, ...result.politicians.filter(p => !previous.some(existing => existing.id === p.id))]);
        setTotalPages(result.totalPages);
      } catch {
        if (!controller.signal.aborted) setDirectoryError('Could not load politicians. Check your connection and try again.');
      } finally { if (!controller.signal.aborted) setLoadingPoliticians(false); }
    }
    void load();
    return () => controller.abort();
  }, [party, page, retry]);
  const [template, setTemplate] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [removingBackground, setRemovingBackground] = useState(false);
  const removalRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { removalRequest.current?.abort(); }, []);
  useEffect(() => () => { if (cutout) deleteCutout(cutout); }, [cutout]);
  async function removeBackground() {
    if (!photo || cutout || removalRequest.current) return;
    const controller = new AbortController();
    removalRequest.current = controller;
    setRemovingBackground(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 150000);
    try {
      const result = await removePhotoBackground(photo, controller.signal);
      if (controller.signal.aborted) { deleteCutout(result); return; }
      setCutout(result); setPhoto(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Background removal failed. Please try again.');
      else setError('Background removal was cancelled or timed out. Please try again.');
    } finally { clearTimeout(timeout); removalRequest.current = null; setRemovingBackground(false); }
  }
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');
  useEffect(() => {
    let active = true;
    void loadBannerSupporter().then(details => {
      if (active && details) { setName(details.name); setPhone(details.phone); }
    }).catch(() => {
      if (active) setDetailsMessage('Could not load saved details. You can enter them again.');
    }).finally(() => { if (active) setDetailsLoaded(true); });
    return () => { active = false; };
  }, []);
  async function saveDetails() {
    if (savingDetails || !detailsLoaded) return;
    if (phone && !/^[0-9]{10}$/.test(phone)) { setDetailsMessage('Please enter a valid 10-digit mobile number, or leave it blank.'); return; }
    setSavingDetails(true); setDetailsMessage('');
    try {
      await saveBannerSupporter({ name: name.trim(), phone });
      setName(name.trim()); setColourEditor(null);
    } catch { setDetailsMessage('Could not save your details. Please try again.'); }
    finally { setSavingDetails(false); }
  }
  const [colourEditor, setColourEditor] = useState<'name' | 'phone' | null>(null);
  const [nameBackground, setNameBackground] = useState('#FF9900');
  const [nameColor, setNameColor] = useState('#111111');
  const [phoneBackground, setPhoneBackground] = useState('#FFDA55');
  const [phoneColor, setPhoneColor] = useState('#111111');
  const [layers, setLayers] = useState<BannerLayer[]>(['phone', 'name', 'photo']);
  function moveLayer(layer: BannerLayer, direction: 1 | -1) {
    setLayers(previous => {
      const index = previous.indexOf(layer);
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }
  const [namePosition, setNamePosition] = useState({ x: 0.4, y: 0.72 });
  const [phonePosition, setPhonePosition] = useState({ x: 0.03, y: 0.85 });
  const [placement, setPlacement] = useState(DEFAULT_SUPPORTER_PLACEMENT);
  const [livePreviewSize, setLivePreviewSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [draggingPhoto, setDraggingPhoto] = useState(false);
  const [error, setError] = useState('');
  const filtered = PARTIES.filter(p => `${p.name} ${p.short}`.toLowerCase().includes(query.toLowerCase().trim()));
  async function finishBanner(action: 'save' | 'share') {
    if (exportBusy.current || step !== 3 || removingBackground || savingDetails) return;
    if (phone && !/^[0-9]{10}$/.test(phone)) { setColourEditor('phone'); setDetailsMessage('Enter a valid 10-digit mobile number before exporting.'); return; }
    exportBusy.current = true; setExporting(action); setExportMessage('');
    if (action === 'save') { if (savedTimer.current) clearTimeout(savedTimer.current); setGallerySaved(false); }
    try {
      if (!loadedImages[banners[template]?.uri] || (photo && !loadedImages[photo])) throw new Error('Wait for the banner and photo to finish loading.');
      // Commit the clean live preview before capture: no handles or placeholder text.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await exportBanner(bannerRef, action, canvasSize.width, canvasSize.height);
      if (action === 'save') {
        setExportMessage('Banner saved successfully.'); setGallerySaved(true);
        savedTimer.current = setTimeout(() => setGallerySaved(false), 3000);
      }
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setExportMessage(cause instanceof Error ? cause.message : 'Could not export your banner. Please try again.');
    } finally { exportBusy.current = false; setExporting(null); }
  }
  function back() {
    if (exportBusy.current) return;
    removalRequest.current?.abort();
    setQuery(''); setError('');
    if (step > 0) setStep(step - 1);
    else if (router.canGoBack()) router.back(); else router.replace('/login');
  }
  async function pickBanner() {
    if (pickingBanner) return;
    setPickingBanner(true); setBannerError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (result.canceled) return;
      const image = result.assets[0];
      const existing = banners.findIndex(item => item.uri === image.uri);
      const nextIndex = existing >= 0 ? existing : banners.filter(item => item.title !== 'Your uploaded banner').length;
      setCustomBanner(image.uri);
      if (image.width > 0 && image.height > 0) setImageRatios(previous => ({ ...previous, [image.uri]: image.width / image.height }));
      setTemplate(nextIndex); setPlacement(DEFAULT_SUPPORTER_PLACEMENT); setStep(3);
    } catch { setBannerError('Could not open your banner image. Please try again.'); }
    finally { setPickingBanner(false); }
  }
  async function pickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled) { setCutout(null); setOriginalPhoto(result.assets[0].uri); setPhoto(result.assets[0].uri); setPlacement(DEFAULT_SUPPORTER_PLACEMENT); setError(''); }
    } catch { setError('Could not open your photos. Please try again.'); }
  }
  function banner(index: number, preview = false, readOnly = false) {
    const size = readOnly ? livePreviewSize : canvasSize;
    const updateSize = readOnly ? setLivePreviewSize : setCanvasSize;
    const chosen = banners[index];
    if (!chosen) return null;
    return <View style={{ borderRadius: preview ? 0 : 12, overflow: 'hidden', backgroundColor: '#fff' }}>
      <View ref={preview && !readOnly ? bannerRef : undefined} collapsable={false} style={{ aspectRatio: imageRatios[chosen.uri] ?? 1.6, overflow: 'hidden' }} onLayout={preview ? ({ nativeEvent }) => { const { width, height } = nativeEvent.layout; updateSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); } : undefined}>
        <Image source={{ uri: chosen.uri }} style={StyleSheet.absoluteFill} resizeMode="contain"
          accessibilityLabel={chosen.title}
          onLoad={({ nativeEvent }) => {
            imageLoaded(chosen.uri);
            const { width, height } = nativeEvent.source;
            if (width > 0 && height > 0) setImageRatios(previous => ({ ...previous, [chosen.uri]: width / height }));
          }} />
        {preview && photo && size.width > 0 && size.height > 0 && <DraggableSupporter
          uri={photo} onEdit={() => setPhotoEditorOpen(true)} onImageLoaded={imageLoaded} onLayer={direction => moveLayer('photo', direction)} zIndex={layers.indexOf('photo') + 1} width={size.width} height={size.height}
          placement={placement} editable={step === 3 && !exporting && !readOnly} onChange={setPlacement} onInteraction={setDraggingPhoto}
        />}
        {preview && size.width > 0 && size.height > 0 && <>
          {(!!name.trim() || (!exporting && !readOnly)) && <DraggableBannerText text={name.trim() || 'Edit name'} kind="name" placeholder={!name.trim()} onLayer={direction => moveLayer('name', direction)} zIndex={layers.indexOf('name') + 1} onEdit={() => { setDetailsMessage(''); setColourEditor('name'); }} backgroundColor={nameBackground} textColor={nameColor} width={size.width} height={size.height} position={namePosition} editable={step === 3 && !exporting && !readOnly} onChange={setNamePosition} onInteraction={setDraggingPhoto} />}
          {(!!phone || (!exporting && !readOnly)) && <DraggableBannerText text={phone || 'Edit number'} kind="phone" placeholder={!phone} onLayer={direction => moveLayer('phone', direction)} zIndex={layers.indexOf('phone') + 1} onEdit={() => { setDetailsMessage(''); setColourEditor('phone'); }} backgroundColor={phoneBackground} textColor={phoneColor} width={size.width} height={size.height} position={phonePosition} editable={step === 3 && !exporting && !readOnly} onChange={setPhonePosition} onInteraction={setDraggingPhoto} />}
        </>}


      </View>
    </View>;
  }

  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={s.back}><ArrowLeft color="#0F4C4E" size={22} /></Pressable><Text style={s.brand}>Banner Studio</Text><Text style={s.stepLabel}>{step + 1} / {titles.length}</Text><BannerStudioMenu /></View>
    <View style={s.heading}><Text style={s.eyebrow}>CREATE SOMETHING PERSONAL</Text><Text style={s.title}>{titles[step]}</Text><Text style={s.subtitle}>{subtitles[step]}</Text>
      <View style={s.steps}>{titles.map((_, i) => <View key={i} style={[s.stepBar, i <= step && s.activeStep]} />)}</View>
      {party && step > 0 && <View style={s.context}><Text style={s.contextText}>{party.short}{step > 1 ? `  /  ${leader}` : ''}</Text><Check size={14} color="#0F4C4E" /></View>}
    </View>
    {step < 2 && <View style={s.search}><Search size={19} color="#82948F" /><TextInput value={query} onChangeText={setQuery} placeholder={step === 0 ? 'Search party name or abbreviation' : 'Search politicians'} placeholderTextColor="#82948F" style={s.searchInput} /></View>}
    {step === 0 ? <FlatList data={filtered} numColumns={2} keyExtractor={p => p.id} contentContainerStyle={s.grid} columnWrapperStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={5}
      ListHeaderComponent={<Text style={s.sectionLabel}>{filtered.length} PARTIES · NATIONAL & REGIONAL</Text>}
      ListEmptyComponent={<View style={s.empty}><Search color="#82948F" /><Text style={s.cardTitle}>No parties found</Text><Text style={s.subtitle}>Try a different party name.</Text></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.name}`} onPress={() => { setParty(item); setRetry(value => value + 1); setSelectedPolitician(null); setCustomBanner(null); setBannerError(''); setPoliticians([]); setPage(1); setTemplate(0); setDirectoryError(''); setLoadingPoliticians(true); setPhoto(null); setOriginalPhoto(null); setCutout(null); setPlacement(DEFAULT_SUPPORTER_PLACEMENT); setQuery(''); setStep(1); }} style={s.partyCard}>
        <View style={[s.partyMark, { backgroundColor: `${item.color}12` }]}><Text style={[s.partyAbbreviation, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>{item.short}</Text></View>
        <Text style={s.partyName} numberOfLines={3}>{item.name}</Text><View style={s.choose}><Text style={s.chooseText}>Choose party</Text><ChevronRight size={14} color="#0F4C4E" /></View>
      </Pressable>} /> : <ScrollView scrollEnabled={!draggingPhoto} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {step === 1 && <>
        {politicians.filter(p => p.name.toLowerCase().includes(query.toLowerCase().trim())).map(p => <Pressable key={p.id} style={s.leaderCard} accessibilityRole="button" onPress={() => { setSelectedPolitician(p); setCustomBanner(null); setBannerError(''); setTemplate(0); setQuery(''); setStep(2); }}>
          <View style={[s.avatar, { backgroundColor: `${party?.color}15`, overflow: 'hidden' }]}>{p.profileImage ? <Image source={{ uri: p.profileImage }} style={{ width: 54, height: 54 }} /> : <UserRound size={28} color={party?.color} />}</View>
          <View style={{ flex: 1 }}><Text style={s.cardTitle}>{p.name}</Text><Text style={s.subtitle}>{p.party}</Text></View><ChevronRight color="#0F4C4E" size={20} />
        </Pressable>)}
        {loadingPoliticians && <PoliticianListSkeleton rows={politicians.length ? 2 : 5} />}
        {!!directoryError && <View style={s.panel}><Text accessibilityRole="alert" style={s.error}>{directoryError}</Text><Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => setRetry(value => value + 1)}><Text style={s.uploadText}>Retry</Text></Pressable></View>}
        {!loadingPoliticians && !directoryError && !politicians.some(p => p.name.toLowerCase().includes(query.toLowerCase().trim())) && <View style={s.empty}><UserRound color="#82948F" /><Text style={s.cardTitle}>{politicians.length ? 'No matching politicians' : 'No politicians available'}</Text><Text style={s.subtitle}>{politicians.length ? 'Try another name or load more profiles.' : 'Select another party or check again later.'}</Text></View>}
        {!loadingPoliticians && !directoryError && page < totalPages && <Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => { setLoadingPoliticians(true); setPage(value => value + 1); }}><Text style={s.uploadText}>Load more politicians</Text></Pressable>}
      </>}
      {step === 2 && <>{banners.length ? banners.map((item, i) => <Pressable key={item.uri} accessibilityRole="button" accessibilityLabel={`Choose ${item.title}`} style={s.templateCard} onPress={() => { setTemplate(i); setPlacement(DEFAULT_SUPPORTER_PLACEMENT); setStep(3); }}>{banner(i)}<View style={s.templateCaption}><Text style={s.cardTitle}>{item.title === 'Politician banner' ? 'Use this banner' : 'Use uploaded banner'}</Text><ArrowRight color="#0F4C4E" size={20} /></View></Pressable>) : <View style={s.empty}><ImagePlus color="#82948F" /><Text style={s.cardTitle}>No banners available</Text><Text style={s.subtitle}>This politician has not uploaded a banner yet. You can add your own below.</Text></View>}
        {banners.length > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}><View style={{ flex: 1, height: 1, backgroundColor: '#DDE8E4' }} /><Text style={{ fontSize: 11, color: '#82948F' }}>OR</Text><View style={{ flex: 1, height: 1, backgroundColor: '#DDE8E4' }} /></View>}
        <Pressable accessibilityRole="button" accessibilityLabel="Upload a different banner from gallery" disabled={pickingBanner} accessibilityState={{ disabled: pickingBanner }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: '#DDE8E4', borderRadius: 14, backgroundColor: '#FFFFFF', opacity: pickingBanner ? 0.6 : 1 }} onPress={() => void pickBanner()}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1ED', alignItems: 'center', justifyContent: 'center' }}>{pickingBanner ? <ActivityIndicator color="#0F4C4E" /> : <ImagePlus size={22} color="#0F4C4E" />}</View>
          <View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 13, fontWeight: '700', color: '#0F4C4E' }}>{customBanner ? 'Change uploaded banner' : banners.length ? 'Use a different banner' : 'Upload a banner'}</Text><Text style={{ fontSize: 11, lineHeight: 16, color: '#82948F' }}>{banners.length ? 'Optional · choose a banner from your gallery' : 'Choose a banner image from your gallery'}</Text></View>
          <ChevronRight size={18} color="#0F4C4E" />
        </Pressable>
        {!!bannerError && <Text accessibilityRole="alert" style={s.error}>{bannerError}</Text>}

      </>}
      {step >= 3 && <>{banner(template, true)}
        {step === 3 && photo && <Text style={s.smallNote}>Drag the photo or name separately. Resize the photo from its corner. Tap its pencil to replace it or remove the background. Drag the number anywhere on the banner.</Text>}
        {step === 3 && <>
          {!photo && <Pressable accessibilityRole="button" accessibilityLabel="Upload your photo" style={[s.upload, { padding: 20, marginTop: 0 }]} onPress={() => setPhotoEditorOpen(true)}>
            <ImagePlus size={30} color="#0F4C4E" />
            <Text style={s.cardTitle}>Add your photo to the banner</Text>
            <Text style={[s.subtitle, { textAlign: 'center' }]}>Upload a photo, then remove its background for a clean cutout.</Text>
            <Text style={s.uploadText}>Upload photo</Text>
          </Pressable>}
        </>}
        {banners.length > 0 && <View style={s.panel}>
          <Text style={[s.cardTitle, { marginBottom: 12 }]}>Live preview</Text>
          <View pointerEvents="none">{banner(banners[template] ? template : 0, true, true)}</View>
        </View>}
        {!!exportMessage && <Text accessibilityLiveRegion="polite" style={s.smallNote}>{exportMessage}</Text>}
      </>}
    </ScrollView>}
    {step === 3 && <View style={s.footer}>
      <View style={s.controls}>
        <Pressable style={[s.control, (exporting || removingBackground || !detailsLoaded) && { opacity: 0.6 }]} disabled={!!exporting || removingBackground || !detailsLoaded} accessibilityRole="button" onPress={() => void finishBanner('save')}>
          {exporting === 'save' ? <ActivityIndicator color="#0F4C4E" /> : <Text accessibilityLiveRegion="polite" style={s.uploadText}>{gallerySaved ? 'Saved ✓' : 'Save to gallery'}</Text>}
        </Pressable>
        <Pressable style={[s.primary, { flex: 1 }, (exporting || removingBackground || !detailsLoaded) && { opacity: 0.6 }]} disabled={!!exporting || removingBackground || !detailsLoaded} accessibilityRole="button" onPress={() => void finishBanner('share')}>
          {exporting === 'share' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Share</Text>}
        </Pressable>
      </View>
    </View>}
    <Modal visible={photoEditorOpen} transparent animationType="slide" onRequestClose={() => setPhotoEditorOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo editor" style={{ flex: 1 }} onPress={() => setPhotoEditorOpen(false)} />
        <SafeAreaView edges={['bottom']} style={{ maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={s.panel}><Text style={s.cardTitle}>Your photo</Text><Text style={s.subtitle}>Choose a clear photo. Transparent PNGs also work.</Text><Pressable style={[s.upload, photo && { padding: 12 }]} accessibilityRole="button" disabled={removingBackground} accessibilityLabel={photo ? 'Replace uploaded photo' : 'Upload your photo'} onPress={() => void pickPhoto()}>{photo ? <Image source={{ uri: photo }} accessibilityLabel="Uploaded photo preview" resizeMode="contain" style={{ width: '100%', height: 150, marginBottom: 8 }} /> : <ImagePlus size={23} color="#0F4C4E" />}<Text style={s.uploadText}>{photo ? 'Replace photo' : 'Upload your photo'}</Text></Pressable>
          {photo && <>
            <Pressable style={s.outlineButton} disabled={removingBackground} accessibilityRole="button" accessibilityState={{ disabled: removingBackground, busy: removingBackground }} onPress={() => {
              if (cutout && originalPhoto) { setPhoto(originalPhoto); setCutout(null); setError(''); }
              else void removeBackground();
            }}>{removingBackground ? <ActivityIndicator color="#0F4C4E" /> : <Sparkles size={18} color="#0F4C4E" />}<Text style={s.uploadText}>{removingBackground ? 'Removing background…' : cutout ? 'Restore original photo' : 'Remove background'}</Text></Pressable>
            <Text style={s.smallNote}>{removingBackground ? 'Processing your photo. This may take up to two minutes.' : cutout ? 'Background removed. Your transparent photo is ready.' : 'Remove the background before placing your photo on the banner.'}</Text>
          </>}
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        </View>
            <Pressable accessibilityRole="button" style={[s.primary, { marginTop: 16 }]} onPress={() => setPhotoEditorOpen(false)}><Text style={s.primaryText}>Done</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
    <Modal visible={colourEditor !== null} transparent animationType="slide" onRequestClose={() => { if (!savingDetails) setColourEditor(null); }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close colour editor" disabled={savingDetails} onPress={() => setColourEditor(null)} style={{ flex: 1 }} />
        <SafeAreaView edges={['bottom']} style={{ maxHeight: '85%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24 }}>
            <Text style={s.cardTitle}>{colourEditor === 'name' ? 'Edit name' : 'Edit mobile number'}</Text>
            <Text style={s.inputLabel}>{colourEditor === 'name' ? 'YOUR NAME' : 'MOBILE NUMBER'}</Text>
            {colourEditor === 'name' ? <TextInput autoFocus editable={detailsLoaded && !savingDetails} value={name} onChangeText={value => { setName(value); setDetailsMessage(''); }} maxLength={50} placeholder="Enter your name" style={s.nameInput} placeholderTextColor="#82948F" />
              : <TextInput autoFocus editable={detailsLoaded && !savingDetails} value={phone} onChangeText={value => { setPhone(value.replace(/\D/g, '').slice(0, 10)); setDetailsMessage(''); }} maxLength={10} keyboardType="phone-pad" placeholder="Enter 10-digit mobile number" style={s.nameInput} placeholderTextColor="#82948F" />}
            <Text style={s.smallNote}>Saved on this device for your next banner.</Text>
            {!!detailsMessage && <Text accessibilityRole="alert" style={s.error}>{detailsMessage}</Text>}
            <BannerColorChoices label="Background colour" value={colourEditor === 'name' ? nameBackground : phoneBackground} onChange={colourEditor === 'name' ? setNameBackground : setPhoneBackground} allowTransparent />
            <BannerColorChoices label="Text colour" value={colourEditor === 'name' ? nameColor : phoneColor} onChange={colourEditor === 'name' ? setNameColor : setPhoneColor} />
            <Pressable disabled={savingDetails || !detailsLoaded} accessibilityRole="button" style={[s.primary, { marginTop: 20 }]} onPress={() => void saveDetails()}>{savingDetails ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Save changes</Text>}</Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
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
  templateCard: { backgroundColor: '#fff', borderRadius: 14, padding: 8, borderWidth: 1, borderColor: '#DFE8E4' }, templateCaption: { padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panel: { backgroundColor: '#fff', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#DFE8E4' }, upload: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#ADCAC0', borderRadius: 12, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, backgroundColor: '#F7FAF8' }, uploadText: { color: '#0F4C4E', fontWeight: '600', fontSize: 13 }, outlineButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ADCAC0', borderRadius: 10, padding: 12, marginTop: 12 }, smallNote: { color: '#7A8C88', fontSize: 11, lineHeight: 17, marginTop: 10 }, error: { color: '#B91C1C', fontSize: 12, marginTop: 10 }, inputLabel: { color: '#7A8C88', fontSize: 10, letterSpacing: 1, fontWeight: '700', marginTop: 18, marginBottom: 8 }, nameInput: { borderWidth: 1, borderColor: '#DFE8E4', backgroundColor: '#F7FAF8', borderRadius: 10, padding: 12, color: '#173A36' }, controls: { flexDirection: 'row', gap: 10, alignItems: 'center' }, control: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DFE8E4', borderRadius: 10, backgroundColor: '#fff' }, controlSelected: { borderColor: '#0F4C4E', backgroundColor: '#E4EFEB' }, size: { color: '#173A36', fontSize: 12 }, footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#DFE8E4', paddingHorizontal: 24, paddingVertical: 14 }, primary: { backgroundColor: '#0F4C4E', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' }, empty: { alignItems: 'center', gap: 12, paddingVertical: 50 },
});
