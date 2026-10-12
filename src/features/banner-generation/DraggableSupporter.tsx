import { Move } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';

import { BannerElementTools } from './BannerElementTools';

export type SupporterPlacement = { x: number; y: number; scale: number };
export const DEFAULT_SUPPORTER_PLACEMENT: SupporterPlacement = { x: 0.75, y: 0.6, scale: 0.22 };

type Props = {
  uri: string; width: number; height: number;
  placement: SupporterPlacement; editable: boolean; zIndex: number;
  onChange: (placement: SupporterPlacement) => void;
  onInteraction: (active: boolean) => void;
  onLayer: (direction: 1 | -1) => void;
  onImageLoaded: (uri: string) => void;
  onEdit: () => void;
};
export function DraggableSupporter({ uri, width, height, placement, editable, zIndex, onChange, onInteraction, onLayer, onImageLoaded, onEdit }: Props) {
  const [showTools, setShowTools] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const current = useRef(placement);
  const start = useRef(placement);
  useEffect(() => { current.current = placement; }, [placement]);
  const responders = useMemo(() => {
    const textHeight = 0;
    const maxWidth = Math.min(width, Math.max(1, height - textHeight) * 58 / 68);
    const minWidth = Math.min(44, maxWidth);
    const bounds = (value: SupporterPlacement) => {
      const photoWidth = Math.max(minWidth, Math.min(maxWidth, value.scale * width));
      const overlayHeight = photoWidth * 68 / 58 + textHeight;
      return { scale: photoWidth / width, x: Math.max(-photoWidth / (2 * width), Math.min(1 - photoWidth / (2 * width), value.x)), y: Math.max(-overlayHeight / (2 * height), Math.min(1 - overlayHeight / (2 * height), value.y)) };
    };
    const grant = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowTools(true); start.current = bounds(current.current); onInteraction(true); };
    const end = () => { onInteraction(false); hideTimer.current = setTimeout(() => setShowTools(false), 3000); };
    return {
      // PanResponder stores these callbacks; refs are read only when a gesture starts/moves.
      // eslint-disable-next-line react-hooks/refs
      drag: PanResponder.create({
        onStartShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponder: () => editable,
        onPanResponderGrant: grant,
        onPanResponderMove: (_, gesture) => {
          const previous = start.current;
          const next = bounds({ ...previous, x: previous.x + gesture.dx / width, y: previous.y + gesture.dy / height });
          current.current = next; onChange(next);
        },
        onPanResponderRelease: end,
        onPanResponderTerminate: end,
        onPanResponderTerminationRequest: () => false,
      }),
      // eslint-disable-next-line react-hooks/refs
      resize: PanResponder.create({
        onStartShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponder: () => editable,
        onPanResponderGrant: grant,
        onPanResponderMove: (_, gesture) => {
          const previous = start.current;
          const next = bounds({ ...previous, scale: previous.scale + (gesture.dx + gesture.dy * 58 / 68) / (2 * width) });
          current.current = next; onChange(next);
        },
        onPanResponderRelease: end,
        onPanResponderTerminate: end,
        onPanResponderTerminationRequest: () => false,
      }),
    };
  }, [width, height, editable, onChange, onInteraction]);
  const textHeight = 0;
  const photoWidth = Math.max(1, Math.min(width, Math.max(1, height - textHeight) * 58 / 68, Math.max(44, placement.scale * width)));
  const overlayHeight = photoWidth * 68 / 58 + textHeight;
  const left = Math.max(-photoWidth / 2, Math.min(width - photoWidth / 2, placement.x * width));
  const top = Math.max(-overlayHeight / 2, Math.min(height - overlayHeight / 2, placement.y * height));
  return <View style={[styles.overlay, { left, top, width: photoWidth, zIndex }]}>
    <View {...responders.drag.panHandlers} accessibilityLabel={editable ? 'Drag your photo to position it on the banner' : 'Supporter photo'}>
      {editable && <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, zIndex: 1, padding: 4, borderRadius: 6, backgroundColor: '#0F4C4E' }}><Move size={15} color="#fff" /></View>}
      <Image source={{ uri }} onLoad={() => onImageLoaded(uri)} style={{ width: photoWidth, height: photoWidth * 68 / 58 }} resizeMode="contain" />
    </View>
    {editable && <>
      <View pointerEvents="none" style={styles.frame} />
      <View {...responders.resize.panHandlers} accessibilityLabel="Drag this corner to resize your photo" style={styles.handleTouch}>
        <View style={styles.handle}><Text style={styles.handleText}>↘</Text></View>
      </View>
    </>}
    {editable && showTools && <BannerElementTools left={Math.max(-left, Math.min(photoWidth - 110, width - left - 110))} top={Math.max(-34, -top)} zIndex={zIndex}
      onEdit={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowTools(false); onEdit(); }}
      onFront={() => { onLayer(1); if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setShowTools(false), 3000); }}
      onBack={() => { onLayer(-1); if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setShowTools(false), 3000); }} />}
  </View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
  frame: { ...StyleSheet.absoluteFill, borderWidth: 1, borderStyle: 'dashed', borderColor: '#0F4C4E' },
  handleTouch: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, alignItems: 'flex-end', justifyContent: 'flex-end' },
  handle: { width: 24, height: 24, borderRadius: 5, backgroundColor: '#0F4C4E', alignItems: 'center', justifyContent: 'center' },
  handleText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
