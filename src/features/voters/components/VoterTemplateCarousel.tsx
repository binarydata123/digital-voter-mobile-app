import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { BannerCropModal, type BannerCropSource, type BannerCropPreview } from "@/features/templates/components/BannerCropModal";
import type { Voter } from "@/services/voters";
import { getCurrentUser } from "@/services/authentication";
import { loadVoterSharePreference, saveVoterSharePreference, type VoterSharePreference } from "@/services/voter-share-preference";
import { exportBanner } from "@/features/banner-generation/export-banner";
import { TEMPLATE_LAYOUTS, type TemplateLayout } from "@/features/templates/components/TemplateThumbnail";
import { ChevronLeft, ChevronRight, Crop, ImagePlus, Share2, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shareCardValue } from "../share-card-values";

function FittedCard({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [cardHeight, setCardHeight] = useState(0);
  const scale = cardHeight > 0 ? Math.min(1, viewport.height / cardHeight) : 1;
  return <View style={styles.fittedViewport} onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    {viewport.width > 0 ? <View onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)} style={{ position: "absolute", width: viewport.width, top: (viewport.height - cardHeight) / 2, transform: [{ scale }], opacity: cardHeight > 0 ? 1 : 0 }}>{children}</View> : null}
  </View>;
}

function CroppedBanner({ crop, fill }: { crop: BannerCropPreview; fill: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const imageSource = useMemo(() => ({ uri: crop.source.uri }), [crop.source.uri]);
  const scale = (fill ? Math.max : Math.min)(size.width / crop.width, size.height / crop.height);
  return <View style={styles.image} onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }}>{scale > 0 ? <View style={{ position: "absolute", width: crop.width * scale, height: crop.height * scale, left: (size.width - crop.width * scale) / 2, top: (size.height - crop.height * scale) / 2, overflow: "hidden" }}><Image source={imageSource} fadeDuration={0} resizeMode="stretch" style={{ position: "absolute", width: crop.source.width * scale, height: crop.source.height * scale, transform: [{ translateX: -crop.x * scale }, { translateY: -crop.y * scale }] }} /></View> : null}</View>;
}

const SingleTemplate = memo(function SingleTemplate({ voter, layout, banner, crop, onBannerLoad, onBannerError, bannerControls }: { voter: Voter; layout: TemplateLayout; banner?: string; crop?: BannerCropPreview; onBannerLoad?: () => void; onBannerError?: () => void; bannerControls?: ReactNode }) {
  const imageSource = useMemo(() => ({ uri: banner }), [banner]);
  const side = layout === "left" || layout === "right" || layout === "dual";
  const bannerStyle = layout === "floating" ? styles.badge : side ? [styles.sideBanner, layout === "dual" && styles.dualBanner] : styles.horizontalBanner;
  const image = <View style={[styles.banner, bannerStyle]}>{crop ? <CroppedBanner crop={crop} fill={side} /> : banner ? <Image source={imageSource} fadeDuration={0} style={styles.image} resizeMode={side ? "cover" : "contain"} onLoad={onBannerLoad} onError={onBannerError} /> : null}{bannerControls ? <View style={[styles.bannerTools, side && styles.verticalTools]}>{bannerControls}</View> : null}</View>;
  const age = Number(voter.age);
  const rows = [
    { label: "House No.", value: shareCardValue(voter.houseNo) },
    { label: "Ward / Roll", value: shareCardValue(voter.ward) },
    { label: "Booth", value: shareCardValue(voter.booth) },
    { label: "Gender / Age", value: `${shareCardValue(voter.gender)} · ${Number.isFinite(age) && age > 0 ? `${age} years` : "N/A"}` },
    { label: "Relative", value: shareCardValue(voter.guardian), full: true },
    { label: "Polling station", value: shareCardValue(voter.pollingStation), full: true },
  ];
  return <View style={[styles.card, side && styles.sideCard, layout === "right" && styles.reverseRow, layout === "bottom" && styles.reverseColumn]}>
    {layout !== "none" ? image : null}
    <View style={[styles.details, side && styles.sideDetails]}>
      <View style={[styles.identityRow, side && styles.identityStack]}><Text style={styles.name}>{shareCardValue(voter.name)}</Text><View style={styles.serialPill}><Text style={styles.serial}>S.No. {shareCardValue(voter.serialNo)}</Text></View></View>
      <Text style={styles.epic}>EPIC No: {shareCardValue(voter.epicNo)}</Text>
      <View style={[styles.fieldList, side && styles.sideFieldList]}>{rows.map((field) => side
        ? <View key={field.label} style={styles.sideField}><Text style={styles.sideFieldText}><Text style={styles.sideFieldLabel}>{field.label}: </Text>{field.value}</Text></View>
        : <View key={field.label} style={field.full ? styles.fullField : styles.halfField}><Text style={styles.fieldLabel}>{field.label}</Text><Text style={styles.detail}>{field.value}</Text></View>)}</View>
    </View>
    {layout === "dual" ? image : null}
  </View>;
});

export function VoterTemplateCarousel({ voter, onClose }: { voter: Voter; onClose: () => void }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<"template" | "banner">("template");
  const [banner, setBanner] = useState<string>();
  const [cropSource, setCropSource] = useState<BannerCropSource | null>(null);
  const [cropVisible, setCropVisible] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId] = useState(() => getCurrentUser()?.id ?? "");
  const preferenceActive = useRef(false);
  const [loadedBanner, setLoadedBanner] = useState<string>();
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const cardRef = useRef<View>(null);
  const shareLock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let active = true;
    loadVoterSharePreference(userId).then((saved) => {
      if (!active || !saved) return;
      const savedIndex = TEMPLATE_LAYOUTS.findIndex((template) => template.key === saved.layout);
      if (savedIndex < 0) return;
      preferenceActive.current = true;
      setIndex(savedIndex);
      setBanner(saved.bannerUri ?? undefined);
      setCropSource(saved.source);
      setStep("banner");
    }).catch(() => { if (active) setError("Unable to load your saved card preference. You can choose a template again."); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [userId]);

  async function persistPreference(preference: VoterSharePreference) {
    const saved = await saveVoterSharePreference(userId, preference);
    preferenceActive.current = true;
    setBanner(saved.bannerUri ?? undefined);
    setCropSource(saved.source);
  }

  async function applyCrop(uri: string) {
    setBanner(uri);
    setCropVisible(false);
    if (!preferenceActive.current) return;
    setSaving(true);
    try { await persistPreference({ layout: TEMPLATE_LAYOUTS[index].key, bannerUri: uri, source: cropSource }); }
    catch { setError("Your banner changed, but the preference could not be saved. Share the card to retry."); }
    finally { setSaving(false); }
  }

  async function selectTemplate() {
    setStep("banner");
    if (!preferenceActive.current) return;
    setSaving(true);
    try { await persistPreference({ layout: TEMPLATE_LAYOUTS[index].key, bannerUri: null, source: null }); }
    catch { setError("Unable to save the changed template. Share the card to retry."); }
    finally { setSaving(false); }
  }
  async function shareCard() {
    const dataOnly = TEMPLATE_LAYOUTS[index].key === "none";
    if (shareLock.current || (!dataOnly && (!banner || loadedBanner !== banner))) return;
    shareLock.current = true;
    setSharing(true);
    setError("");
    try {
      // Render the card without editing controls before capturing it.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await exportBanner(cardRef, "share", cardSize.width, cardSize.height);
      try { await persistPreference({ layout: TEMPLATE_LAYOUTS[index].key, bannerUri: banner ?? null, source: cropSource }); }
      catch { setError("The share screen opened, but your card preference could not be saved. Please try again."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to share this voter card. Please try again.");
    } finally {
      shareLock.current = false;
      setSharing(false);
    }
  }
  async function addBanner() {
    if (picking) return;
    setPicking(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.width || !asset.height) throw new Error("Unable to read image dimensions.");
        const context = ImageManipulator.manipulate(asset.uri);
        let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
        try {
          if (Math.max(asset.width, asset.height) > 1600) context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
          rendered = await context.renderAsync();
          const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
          setCropSource({ uri: image.uri, width: image.width, height: image.height });
          setCropVisible(true);
        } finally { rendered?.release(); context.release(); }
      }
    } catch (cause) {
      setError(cause instanceof Error ? `Unable to prepare your banner: ${cause.message}` : "Unable to prepare your banner. Please choose another photo.");
    } finally {
      setPicking(false);
    }
  }
  function navigate(next: number) {
    const page = Math.max(0, Math.min(TEMPLATE_LAYOUTS.length - 1, next));
    setIndex(page);
    scroll.current?.scrollTo({ x: page * width, animated: true });
  }
  return <Modal transparent visible animationType="slide" onRequestClose={() => { if (cropVisible) { if (!cropBusy) setCropVisible(false); } else onClose(); }}>
    {cropVisible && cropSource ? <BannerCropModal embedded initialSource={cropSource} layout={TEMPLATE_LAYOUTS[index].key} onApply={applyCrop} onClose={() => setCropVisible(false)} onBusyChange={setCropBusy} renderPreview={(crop) => <SingleTemplate voter={voter} layout={TEMPLATE_LAYOUTS[index].key} crop={crop} />} /> : <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close template carousel" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.heading}><Text style={styles.title}>{restoring ? "Voter card" : step === "template" ? "Choose a card template" : banner || TEMPLATE_LAYOUTS[index].key === "none" ? "Share voter card" : "Add your banner"}</Text><Text style={styles.hint}>{restoring ? "" : step === "template" ? "Swipe to choose the layout first" : TEMPLATE_LAYOUTS[index].label}</Text></View>
          <Pressable accessibilityLabel="Close templates" onPress={onClose} style={styles.iconButton}><X size={22} color="#64748B" /></Pressable>
        </View>
        {restoring ? <View style={[styles.preview, styles.restorePlaceholder]}><Text style={styles.hint}>Loading saved card…</Text></View> : step === "template" ? <View style={styles.carouselArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 ? <ScrollView style={styles.carouselArea} key={width} ref={scroll} horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled bounces={false} showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollTo({ x: index * width, animated: false })} onMomentumScrollEnd={(event) => setIndex(Math.max(0, Math.min(TEMPLATE_LAYOUTS.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}>
            {TEMPLATE_LAYOUTS.map((template) => <View key={template.key} style={[styles.page, { width }]}>
              <View style={styles.preview}><FittedCard>
                <SingleTemplate voter={voter} layout={template.key} />
              </FittedCard></View>
              <Text style={styles.label}>{template.label}</Text>
            </View>)}
          </ScrollView> : null}
        </View> : <View style={[styles.preview, styles.page]}><FittedCard><View ref={cardRef} collapsable={false} style={{ backgroundColor: "white" }} onLayout={(event) => setCardSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}><SingleTemplate voter={voter} layout={TEMPLATE_LAYOUTS[index].key} banner={banner} onBannerLoad={() => setLoadedBanner(banner)} onBannerError={() => { setLoadedBanner(undefined); setError("Unable to load the banner. Choose the image again."); }} bannerControls={sharing ? undefined : <>
          <Pressable accessibilityLabel={banner ? "Change banner" : "Add banner"} disabled={picking || saving || sharing} onPress={addBanner} style={styles.bannerTool}><ImagePlus size={24} color="#087568" />{(["top", "bottom"].includes(TEMPLATE_LAYOUTS[index].key) || (!banner && TEMPLATE_LAYOUTS[index].key === "floating")) ? <Text style={styles.toolText}>{picking ? "Opening…" : banner ? "Change" : "Upload"}</Text> : null}</Pressable>
          {banner && cropSource ? <Pressable accessibilityLabel="Adjust banner crop" disabled={picking || saving || sharing} onPress={() => setCropVisible(true)} style={styles.bannerTool}><Crop size={24} color="#087568" />{["top", "bottom"].includes(TEMPLATE_LAYOUTS[index].key) ? <Text style={styles.toolText}>Crop</Text> : null}</Pressable> : null}
        </>} /></View></FittedCard></View>}
        {!restoring && step === "template" ? <View style={styles.navigation}>
          <Pressable accessibilityLabel="Previous template" disabled={index === 0} onPress={() => navigate(index - 1)} style={[styles.iconButton, index === 0 && styles.disabled]}><ChevronLeft color="#087568" size={22} /></Pressable>
          <View style={styles.dots}>{TEMPLATE_LAYOUTS.map((template, page) => <Pressable key={template.key} accessibilityLabel={`Show ${template.label}`} accessibilityState={{ selected: page === index }} onPress={() => navigate(page)} style={styles.dotTarget}><View style={[styles.dot, page === index && styles.activeDot]} /></Pressable>)}</View>
          <Pressable accessibilityLabel="Next template" disabled={index === TEMPLATE_LAYOUTS.length - 1} onPress={() => navigate(index + 1)} style={[styles.iconButton, index === TEMPLATE_LAYOUTS.length - 1 && styles.disabled]}><ChevronRight color="#087568" size={22} /></Pressable>
        </View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {restoring ? null : step === "template" ? <Pressable disabled={saving} style={styles.action} onPress={selectTemplate}><Text style={styles.actionText}>Select this template</Text></Pressable> : <View>
          {banner || TEMPLATE_LAYOUTS[index].key === "none" ? <Pressable accessibilityLabel="Share voter card image" disabled={saving || sharing || picking || (TEMPLATE_LAYOUTS[index].key !== "none" && loadedBanner !== banner) || cardSize.width <= 0 || cardSize.height <= 0} onPress={shareCard} style={[styles.action, styles.shareAction, (saving || sharing || picking || (TEMPLATE_LAYOUTS[index].key !== "none" && loadedBanner !== banner)) && styles.disabled]}><Share2 color="white" size={18} /><Text style={styles.actionText}>{sharing ? "Sharing…" : "Share card"}</Text></Pressable> : null}
          {TEMPLATE_LAYOUTS[index].key === "none" ? <Text style={styles.hintCentered}>This template uses voter details only.</Text> : null}
          <Pressable disabled={saving || sharing || picking} style={styles.backButton} onPress={() => { setStep("template"); setBanner(undefined); }}><Text style={styles.backText}>Change template</Text></Pressable>
        </View>}
      </View>
    </View>}
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.46)" },
  sheet: { backgroundColor: "#F4FBF7", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, height: "70%", maxHeight: "70%" },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  heading: { flex: 1 }, title: { fontSize: 19, fontWeight: "800", color: "#0F172A" },
  hint: { fontSize: 12, color: "#64748B", marginTop: 4 },
  page: { paddingHorizontal: 20 }, preview: { flex: 1, justifyContent: "center", paddingVertical: 8 },
  carouselArea: { flex: 1 },
  fittedViewport: { flex: 1, overflow: "hidden" },
  card: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 0, backgroundColor: "#FFFFFF", overflow: "hidden" },
  sideCard: { flexDirection: "row" }, reverseRow: { flexDirection: "row-reverse" }, reverseColumn: { flexDirection: "column-reverse" },
  banner: { backgroundColor: "#0C655F", overflow: "hidden" }, image: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  horizontalBanner: { width: "100%", aspectRatio: 3 }, sideBanner: { width: "27%", alignSelf: "stretch" },
  dualBanner: { width: "18%" }, badge: { width: 112, height: 112, marginLeft: 12, marginTop: 12 },
  details: { flexGrow: 1, flexShrink: 1, padding: 12, gap: 9, minWidth: 0 },
  sideDetails: { padding: 11, gap: 8 },
  identityRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  identityStack: { flexDirection: "column", gap: 5 },
  name: { flexShrink: 1, fontSize: 18, lineHeight: 24, fontWeight: "800", color: "#000000" },
  serialPill: { alignSelf: "flex-start", borderRadius: 6, backgroundColor: "#F1F5F9", paddingHorizontal: 7, paddingVertical: 3 },
  serial: { fontSize: 10, lineHeight: 14, fontWeight: "700", color: "#000000" },
  epic: { fontSize: 13, lineHeight: 18, fontWeight: "800", color: "#000000" }, detail: { fontSize: 13, lineHeight: 19, fontWeight: "600", color: "#000000" },
  fieldList: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 9 },
  halfField: { width: "48%", gap: 2 }, fullField: { width: "100%", gap: 2 },
  fieldLabel: { fontSize: 10, lineHeight: 14, fontWeight: "500", color: "#000000" },
  sideFieldList: { flexDirection: "column", flexWrap: "nowrap", rowGap: 0, paddingTop: 2 },
  sideField: { width: "100%", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#EEF2F5" },
  sideFieldText: { fontSize: 12, lineHeight: 19, fontWeight: "600", color: "#000000" },
  sideFieldLabel: { fontWeight: "400", color: "#475569" },
  label: { fontSize: 14, fontWeight: "700", textAlign: "center", color: "#0F172A", marginTop: 10 },
  navigation: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.3 },
  dots: { flexDirection: "row" }, dotTarget: { width: 26, height: 44, justifyContent: "center", alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#CBD5E1" }, activeDot: { backgroundColor: "#087568", width: 10, height: 10, borderRadius: 5 },
  action: { marginHorizontal: 20, marginTop: 12, backgroundColor: "#087568", borderRadius: 12, minHeight: 48, justifyContent: "center", alignItems: "center" },
  actionText: { color: "white", fontSize: 14, fontWeight: "700" }, backButton: { minHeight: 44, justifyContent: "center", alignItems: "center" }, backText: { color: "#087568", fontWeight: "700" },
  shareAction: { flexDirection: "row", gap: 8 },
  bannerTools: { position: "absolute", right: 5, bottom: 5, flexDirection: "row", gap: 6 },
  verticalTools: { flexDirection: "column" }, bannerTool: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1.5, borderColor: "#087568", backgroundColor: "#FFFFFF" },
  toolText: { color: "#087568", fontSize: 11, fontWeight: "700" },
  error: { color: "#DC2626", marginHorizontal: 20, marginTop: 8, fontSize: 12 }, hintCentered: { color: "#64748B", textAlign: "center", marginTop: 12 },
  restorePlaceholder: { justifyContent: "center", alignItems: "center" },
});
