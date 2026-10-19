import { getBannerAspect } from "@/services/template-banners";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Minus, Plus, RotateCw, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, Modal, PanResponder, Pressable, ScrollView, Text, View, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { TemplateLayout } from "./TemplateThumbnail";

export type BannerCropSource = { uri: string; width: number; height: number };
export type BannerCropPreview = { source: BannerCropSource; width: number; height: number; x: number; y: number };

export function BannerCropModal({ initialSource, layout, onApply, onClose, renderPreview, embedded = false, onBusyChange }: { initialSource: BannerCropSource; layout: TemplateLayout; onApply: (uri: string) => void; onClose: () => void; renderPreview?: (crop: BannerCropPreview) => ReactNode; embedded?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [source, setSource] = useState(initialSource);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const angle = useRef(0);
  const lock = useRef(false);
  const dragStart = useRef({ x: 0.5, y: 0.5 });
  const latestPosition = useRef(position);
  useEffect(() => { latestPosition.current = position; }, [position]);
  const imageSource = useMemo(() => ({ uri: source.uri }), [source.uri]);
  const ratio = getBannerAspect(layout);
  const cropWidth = Math.min(source.width, source.height * ratio) / zoom;
  const cropHeight = cropWidth / ratio;
  const x = (source.width - cropWidth) * position.x;
  const y = (source.height - cropHeight) * position.y;
  const frameWidth = ratio < 1 ? Math.min(Math.max(1, width - 32), 96) : Math.max(1, width - 32);
  const scale = frameWidth / cropWidth;
  const start = useCallback(() => { dragStart.current = latestPosition.current; setDragging(true); }, []);
  const move = useCallback((_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
    const maxX = (source.width - cropWidth) * scale;
    const maxY = (source.height - cropHeight) * scale;
    setPosition({ x: maxX > 0 ? Math.max(0, Math.min(1, dragStart.current.x - gesture.dx / maxX)) : 0.5, y: maxY > 0 ? Math.max(0, Math.min(1, dragStart.current.y - gesture.dy / maxY)) : 0.5 });
  }, [source, cropWidth, cropHeight, scale]);
  // These callbacks access refs only after the user starts a gesture.
  // eslint-disable-next-line react-hooks/refs
  const gesture = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => !busy, onMoveShouldSetPanResponder: () => !busy, onPanResponderGrant: start, onPanResponderMove: move, onPanResponderRelease: () => setDragging(false), onPanResponderTerminate: () => setDragging(false), onPanResponderTerminationRequest: () => false }), [busy, start, move]);
  function reset() { setZoom(1); setPosition({ x: 0.5, y: 0.5 }); }
  async function process(rotate: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const context = ImageManipulator.manipulate(rotate ? initialSource.uri : source.uri);
    let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
    try {
      const nextAngle = (angle.current + 90) % 360;
      if (rotate) { if (nextAngle) context.rotate(nextAngle); }
      else {
        context.crop({ originX: Math.floor(x), originY: Math.floor(y), width: Math.max(1, Math.floor(cropWidth)), height: Math.max(1, Math.floor(cropHeight)) });
        context.resize({ width: Math.min(ratio < 1 ? 400 : 1200, Math.max(1, Math.floor(cropWidth))) });
      }
      rendered = await context.renderAsync();
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      if (rotate) { angle.current = nextAngle; setSource({ uri: result.uri, width: result.width, height: result.height }); reset(); }
      else onApply(result.uri);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to crop this banner. Please try again."); }
    finally { rendered?.release(); context.release(); lock.current = false; setBusy(false); }
  }
  const content = <SafeAreaView style={{ flex: 1, backgroundColor: "#F4FBF7" }}>
      <View className="flex-row items-center justify-between px-5 py-3"><Text className="text-xl font-bold text-[#0F172A]">Crop banner image</Text><Pressable disabled={busy} accessibilityLabel="Cancel crop" onPress={onClose} className="p-3"><X color="#087568" size={22} /></Pressable></View>
      <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ padding: 20 }}>
        <Text className="mb-4 text-sm text-[#64748B]">Drag the image inside the green frame. Zoom or rotate to adjust the crop.</Text>
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ overflow: "hidden", backgroundColor: "#E2E8F0", borderRadius: 12 }}>
          {width > 32 ? <View {...gesture.panHandlers} accessibilityLabel="Drag banner to adjust crop" style={{ width, height: frameWidth / ratio + 64, overflow: "hidden" }}>
            <Image source={imageSource} fadeDuration={0} resizeMode="stretch" style={{ position: "absolute", width: source.width * scale, height: source.height * scale, left: 0, top: 0, transform: [{ translateX: (width - frameWidth) / 2 - x * scale }, { translateY: 32 - y * scale }] }} />
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 32, backgroundColor: "rgba(15,23,42,0.5)" }} />
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 32, backgroundColor: "rgba(15,23,42,0.5)" }} />
            {["left", "right"].map((edge) => <View key={edge} pointerEvents="none" style={{ position: "absolute", [edge]: 0, top: 32, width: (width - frameWidth) / 2, height: frameWidth / ratio, backgroundColor: "rgba(15,23,42,0.5)" }} />)}
            <View pointerEvents="none" style={{ position: "absolute", left: (width - frameWidth) / 2, top: 32, width: frameWidth, height: frameWidth / ratio, borderWidth: 2, borderColor: "#087568" }}>
              {[1, 2].map((part) => <View key={`v${part}`} style={{ position: "absolute", left: `${part * 100 / 3}%`, top: 0, bottom: 0, width: 1, backgroundColor: "#FFFFFF70" }} />)}
              {[1, 2].map((part) => <View key={`h${part}`} style={{ position: "absolute", top: `${part * 100 / 3}%`, left: 0, right: 0, height: 1, backgroundColor: "#FFFFFF70" }} />)}
            </View>
          </View> : null}
        </View>
        <View className="mt-4 flex-row items-center justify-between">
          <Pressable disabled={busy} accessibilityLabel="Zoom out" onPress={() => setZoom((value) => Math.max(1, value - 0.25))} className="rounded-lg bg-[#E3F2EC] p-3"><Minus color="#087568" size={20} /></Pressable>
          <Text className="font-bold text-[#334155]">{zoom.toFixed(2)}×</Text>
          <Pressable disabled={busy} accessibilityLabel="Zoom in" onPress={() => setZoom((value) => Math.min(4, value + 0.25))} className="rounded-lg bg-[#E3F2EC] p-3"><Plus color="#087568" size={20} /></Pressable>
          <Pressable disabled={busy} accessibilityLabel="Rotate clockwise" onPress={() => process(true)} className="rounded-lg bg-[#E3F2EC] p-3"><RotateCw color="#087568" size={20} /></Pressable>
          <Pressable disabled={busy} onPress={reset} className="p-3"><Text className="font-bold text-[#087568]">Reset</Text></Pressable>
        </View>
        {renderPreview ? <View className="mt-5 rounded-xl border border-[#DDE8EF] bg-white p-3"><Text className="mb-3 text-base font-bold text-[#0F172A]">Live card preview</Text>{renderPreview({ source, width: cropWidth, height: cropHeight, x, y })}</View> : null}
        {error ? <Text accessibilityRole="alert" className="mt-4 text-red-600">{error}</Text> : null}
      </ScrollView>
      <Pressable disabled={busy} onPress={() => process(false)} className={`mx-5 mb-4 min-h-[48px] items-center justify-center rounded-xl bg-[#087568] ${busy ? "opacity-50" : ""}`}><Text className="font-bold text-white">{busy ? "Processing…" : "Apply crop"}</Text></Pressable>
    </SafeAreaView>;
  // Reuse the host modal when this editor is opened from a modal on iOS.
  return embedded ? content : <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>{content}</Modal>;
}
