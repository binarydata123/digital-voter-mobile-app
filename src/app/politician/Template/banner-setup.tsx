import { parseTemplateFields } from "@/features/templates/fields";
import { generateTemplatePdf } from "@/features/templates/generate";
import { TEMPLATE_LAYOUTS } from "@/features/templates/components/TemplateThumbnail";
import { TemplatePagePreview } from "@/features/templates/components/TemplatePagePreview";
import { SampleVoterCard } from "@/features/templates/components/SampleVoterCard";
import { ensureAuthSession, getCurrentUser, hasPoliticianPageAccess, refreshCurrentUser } from "@/services/authentication";
import { getBannerAspect, loadTemplateBanner, saveTemplateBanner } from "@/services/template-banners";
import { logVoterTemplatePrint } from "@/services/voters";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Eye, ImagePlus, Minus, Plus, RotateCw, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, PanResponder, type GestureResponderEvent, type PanResponderGestureState, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SourceImage = { uri: string; width: number; height: number };

export default function BannerSetupScreen() {
  const params = useLocalSearchParams<{ layout?: string; booth?: string; district?: string; state?: string; fields?: string }>();
  const fields = parseTemplateFields(params.fields);
  const template = TEMPLATE_LAYOUTS.find((item) => item.key === params.layout && item.key !== "none");
  const ratio = getBannerAspect(template?.key ?? "top");
  const [source, setSource] = useState<SourceImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [previewWidth, setPreviewWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const originalImage = useRef<SourceImage | null>(null);
  const rotationAngle = useRef(0);
  const [error, setError] = useState("");
  const [pagePreview, setPagePreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0.5, y: 0.5 });
  const latestPosition = useRef(position);
  useEffect(() => { latestPosition.current = position; }, [position]);
  const busyRef = useRef(false);
  const pickedImageRef = useRef(false);

  useEffect(() => {
    let active = true;
    const user = getCurrentUser();
    if (user?.id && template) {
      loadTemplateBanner(user.id, template.key).then((uri) => {
        if (uri) Image.getSize(uri, (width, height) => {
          if (active && !pickedImageRef.current) setSource({ uri, width, height });
        }, () => {});
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [template]);

  const cropWidth = source ? Math.min(source.width, source.height * ratio) / zoom : 1;
  const cropHeight = cropWidth / ratio;
  const originX = source ? (source.width - cropWidth) * position.x : 0;
  const originY = source ? (source.height - cropHeight) * position.y : 0;
  const frameWidth = ratio < 1 ? Math.min(previewWidth - 32, 96) : Math.max(1, previewWidth - 32);
  const scale = frameWidth / cropWidth;

  const startDrag = useCallback(() => {
    dragStart.current = latestPosition.current;
    setDragging(true);
  }, []);
  const moveDrag = useCallback((_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
    if (!source) return;
    const maxX = (source.width - cropWidth) * scale;
    const maxY = (source.height - cropHeight) * scale;
    setPosition({
      x: maxX > 0 ? Math.min(1, Math.max(0, dragStart.current.x - gesture.dx / maxX)) : 0.5,
      y: maxY > 0 ? Math.min(1, Math.max(0, dragStart.current.y - gesture.dy / maxY)) : 0.5,
    });
  }, [source, cropWidth, cropHeight, scale]);
  // PanResponder stores these callbacks; refs are read only when a touch event fires.
  // eslint-disable-next-line react-hooks/refs
  const cropGesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(source) && !busy,
    onMoveShouldSetPanResponder: () => Boolean(source) && !busy,
    onPanResponderGrant: startDrag,
    onPanResponderMove: moveDrag,
    onPanResponderRelease: () => setDragging(false),
    onPanResponderTerminate: () => setDragging(false),
    onPanResponderTerminationRequest: () => false,
  }), [source, busy, startDrag, moveDrag]);

  async function chooseImage() {
    if (busyRef.current) return;
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.width || !asset.height) throw new Error("Unable to read this image. Choose another image.");
      pickedImageRef.current = true;
      // Keep the crop editor's decoded image below 1600px on its longest edge.
      const context = ImageManipulator.manipulate(asset.uri);
      let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
      try {
        if (Math.max(asset.width, asset.height) > 1600) {
          context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
        }
        rendered = await context.renderAsync();
        const resized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
        const nextSource = { uri: resized.uri, width: resized.width, height: resized.height };
        originalImage.current = nextSource;
        rotationAngle.current = 0;
        setSource(nextSource);
      } finally {
        rendered?.release();
        context.release();
      }
      setZoom(1);
      setPosition({ x: 0.5, y: 0.5 });
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Unable to open photos.");
    }
  }

  async function rotateImage() {
    if (!source || busyRef.current) return;
    busyRef.current = true;
    pickedImageRef.current = true;
    setBusy(true);
    setRotating(true);
    setError("");
    const original = originalImage.current ?? source;
    originalImage.current = original;
    const angle = (rotationAngle.current + 90) % 360;
    const context = ImageManipulator.manipulate(original.uri);
    let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    try {
      if (angle !== 0) context.rotate(angle);
      rendered = await context.renderAsync();
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
      setSource({ uri: result.uri, width: result.width, height: result.height });
      rotationAngle.current = angle;
      setZoom(1);
      setPosition({ x: 0.5, y: 0.5 });
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : "Unable to rotate the image.");
    } finally {
      rendered?.release();
      context.release();
      busyRef.current = false;
      setBusy(false);
      setRotating(false);
    }
  }

  async function saveBanner() {
    if (!source || !template || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const printWindow = Platform.OS === "web" ? window.open("", "_blank") : null;
    try {
      if (Platform.OS === "web" && !printWindow) throw new Error("Please allow popups, then try Generate again.");
      const { user } = await ensureAuthSession();
      if (!user?.id || !hasPoliticianPageAccess("template", user)) throw new Error("Please sign in with template access.");
      const booth = params.booth || user.assignedBooths?.[0] || user.booth;
      if (!booth) throw new Error("Select a booth before saving the template.");
      const context = ImageManipulator.manipulate(source.uri);
      context.crop({ originX: Math.floor(originX), originY: Math.floor(originY), width: Math.max(1, Math.floor(cropWidth)), height: Math.max(1, Math.floor(cropHeight)) });
      const outputWidth = ratio < 1 ? 400 : 1200;
      context.resize({ width: Math.min(outputWidth, Math.floor(cropWidth)) });
      let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
      let result;
      try {
        rendered = await context.renderAsync();
        result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
      } finally {
        rendered?.release();
        context.release();
      }
      if (!result.base64) throw new Error("Unable to crop the image.");
      await saveTemplateBanner(user.id, template.key, result.base64);
      const columns = 4;
      await generateTemplatePdf({ user, fields, booth, district: params.district, state: params.state, layout: template.key, bannerImageUrl: `data:image/jpeg;base64,${result.base64}`, printWindow });
      await logVoterTemplatePrint({ booth, district: params.district || user.district, state: params.state || user.state, printCount: 0, templateSelection: { template: "studio", canvasLayout: template.key, recordsPerRow: columns } });
      await refreshCurrentUser();

    } catch (saveError) {
      printWindow?.close();
      setError(saveError instanceof Error ? saveError.message : "Unable to generate the PDF. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      <View className="px-4 py-3"><Pressable disabled={busy} onPress={() => router.back()} className="flex-row items-center gap-2 self-start py-2"><ArrowLeft color="#087568" size={22} /><Text className="text-base font-bold text-[#087568]">Back</Text></Pressable></View>
      <ScrollView scrollEnabled={!dragging} showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-6">
        <Text className="text-2xl font-black text-[#0F172A]">{template?.label ?? "Banner"}</Text>
        <Text className="mb-5 mt-2 text-sm leading-6 text-[#64748B]">{ratio < 1 ? "Choose a portrait image for the vertical banner." : ratio === 1 ? "Choose an image for the square badge." : "Choose a landscape image for the horizontal banner."} Adjust the crop below.</Text>
        <Pressable disabled={busy || !template} onPress={chooseImage} className="mb-5 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-[#087568] bg-white"><ImagePlus color="#087568" size={20} /><Text className="font-bold text-[#087568]">{source ? "Change image" : "Choose image"}</Text></Pressable>
        <View className="rounded-2xl border border-[#DDE8EF] bg-white p-3">
          <Text className="text-base font-bold text-[#0F172A]">Crop banner image</Text>
          <Text className="mb-3 mt-1 text-xs text-[#64748B]">Drag the image to position it inside the green frame.</Text>
          <View onLayout={(event) => setPreviewWidth(Math.max(1, event.nativeEvent.layout.width))} className="items-center overflow-hidden rounded-xl bg-[#E2E8F0]">
            {source && previewWidth > 32 ? <View {...cropGesture.panHandlers} accessibilityLabel="Drag image to adjust crop" style={{ width: previewWidth, height: frameWidth / ratio + 64, overflow: "hidden" }}>
              <Image source={{ uri: source.uri }} resizeMode="stretch" style={{ position: "absolute", width: source.width * scale, height: source.height * scale, left: (previewWidth - frameWidth) / 2 - originX * scale, top: 32 - originY * scale }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 32, backgroundColor: "rgba(15,23,42,0.5)" }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 32, backgroundColor: "rgba(15,23,42,0.5)" }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 32, width: (previewWidth - frameWidth) / 2, height: frameWidth / ratio, backgroundColor: "rgba(15,23,42,0.5)" }} />
              <View pointerEvents="none" style={{ position: "absolute", right: 0, top: 32, width: (previewWidth - frameWidth) / 2, height: frameWidth / ratio, backgroundColor: "rgba(15,23,42,0.5)" }} />
              <View pointerEvents="none" style={{ position: "absolute", left: (previewWidth - frameWidth) / 2, top: 32, width: frameWidth, height: frameWidth / ratio, borderWidth: 2, borderColor: "#087568" }}>
                {[1, 2].map((part) => <View key={`v${part}`} style={{ position: "absolute", left: `${part * 100 / 3}%`, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />)}
                {[1, 2].map((part) => <View key={`h${part}`} style={{ position: "absolute", top: `${part * 100 / 3}%`, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />)}
                {[{ top: -4, left: -4 }, { top: -4, right: -4 }, { bottom: -4, left: -4 }, { bottom: -4, right: -4 }].map((corner, index) => <View key={index} style={{ position: "absolute", ...corner, width: 8, height: 8, backgroundColor: "white", borderWidth: 1, borderColor: "#087568" }} />)}
              </View>
            </View> : <View className="min-h-[180px] w-full items-center justify-center"><ImagePlus color="#087568" size={32} /><Text className="mt-3 text-sm text-[#64748B]">Choose an image to start cropping</Text></View>}
          </View>
          {source ? <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Pressable accessibilityLabel="Zoom out" disabled={busy} onPress={() => setZoom((value) => Math.max(1, value - 0.25))} className="h-10 w-10 items-center justify-center rounded-lg bg-[#E3F2EC]"><Minus color="#087568" size={20} /></Pressable>
              <Text className="text-xs font-bold text-[#334155]">{zoom.toFixed(2)}×</Text>
              <Pressable accessibilityLabel="Zoom in" disabled={busy} onPress={() => setZoom((value) => Math.min(4, value + 0.25))} className="h-10 w-10 items-center justify-center rounded-lg bg-[#E3F2EC]"><Plus color="#087568" size={20} /></Pressable>
            </View>
            <Pressable accessibilityLabel="Rotate image 90 degrees clockwise" disabled={busy} onPress={rotateImage} className={`h-10 w-10 items-center justify-center rounded-lg bg-[#E3F2EC] ${busy ? "opacity-50" : ""}`}><RotateCw color="#087568" size={20} /></Pressable>
            <Pressable disabled={busy} onPress={() => { setZoom(1); setPosition({ x: 0.5, y: 0.5 }); }} className="px-2 py-3"><Text className="text-sm font-bold text-[#087568]">Reset</Text></Pressable>
          </View> : null}
        </View>
        {source && template ? <SampleVoterCard fields={fields} layout={template.key} booth={params.booth} crop={{ source, width: cropWidth, height: cropHeight, x: originX, y: originY }} /> : null}
        {error ? <Text accessibilityRole="alert" className="mt-4 rounded-xl bg-[#FFF7ED] p-3 text-sm text-[#9A3412]">{error}</Text> : null}
      </ScrollView>
      <View className="flex-row gap-3 border-t border-[#E2E8F0] bg-white p-4">
        <Pressable accessibilityRole="button" disabled={busy || !source || !template} onPress={() => setPagePreview(true)} className={`min-h-[50px] flex-row items-center justify-center gap-2 rounded-[14px] border border-[#087568] px-4 ${busy || !source ? "opacity-50" : ""}`}>
          <Eye color="#087568" size={20} /><Text className="text-[15px] font-bold text-[#087568]">Preview</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !source || !template} onPress={saveBanner} className={`min-h-[50px] flex-1 flex-row items-center justify-center gap-2 rounded-[14px] bg-[#064E3B] ${busy || !source ? "opacity-50" : ""}`}>
          {busy ? <ActivityIndicator color="white" /> : <Check color="white" size={20} />}<Text className="text-[15px] font-black text-white">{busy ? rotating ? "Rotating…" : "Generating…" : "Generate"}</Text>
        </Pressable>
      </View>
      <Modal visible={pagePreview} animationType="slide" onRequestClose={() => setPagePreview(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-lg font-bold text-[#0F172A]">Page preview</Text>
            <Pressable accessibilityLabel="Close preview" onPress={() => setPagePreview(false)} className="rounded-full bg-white p-3"><X color="#087568" size={22} /></Pressable>
          </View>
          <ScrollView contentContainerClassName="p-4">
            {pagePreview && source && template ? <TemplatePagePreview fields={fields} layout={template.key} crop={{ source, width: cropWidth, height: cropHeight, x: originX, y: originY }} columns={4} booth={params.booth} /> : null}
            <Text className="mt-3 text-center text-xs text-[#64748B]">1 / 1 · Example voter data</Text>
          </ScrollView>
          <View className="border-t border-[#E2E8F0] bg-white p-4"><Pressable onPress={() => setPagePreview(false)} className="min-h-[50px] items-center justify-center rounded-[14px] bg-[#064E3B]"><Text className="text-[15px] font-bold text-white">Back to editing</Text></Pressable></View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
