import { Move } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { BannerElementTools } from './BannerElementTools';

export type BannerTextPosition = { x: number; y: number };
type Props = {
  text: string; kind: 'name' | 'phone'; width: number; height: number;
  position: BannerTextPosition; editable: boolean; zIndex: number; backgroundColor: string; textColor: string;
  onChange: (position: BannerTextPosition) => void;
  onInteraction: (active: boolean) => void;
  onEdit: () => void;
  placeholder?: boolean;
  onLayer: (direction: 1 | -1) => void;
};
export function DraggableBannerText({ text, kind, width, height, position, editable, zIndex, backgroundColor, textColor, onChange, onInteraction, onEdit, onLayer, placeholder = false }: Props) {
  const [showPencil, setShowPencil] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const editAction = useRef(onEdit);
  useEffect(() => { editAction.current = onEdit; }, [onEdit]);
  const current = useRef(position);
  const start = useRef(position);
  useEffect(() => { current.current = position; }, [position]);
  const fontSize = kind === 'name' ? Math.max(14, Math.min(24, width * 0.055)) : Math.max(11, Math.min(16, width * 0.035));
  const labelWidth = Math.min(width, kind === 'name' ? Math.max(80, Math.min(width * 0.7, text.length * fontSize * 0.65 + 40)) : fontSize * 7 + 36);
  const labelHeight = Math.min(height, fontSize + 12);
  const boundX = (x: number) => Math.max(-labelWidth / (2 * width), Math.min(1 - labelWidth / (2 * width), x));
  const boundY = (y: number) => Math.max(-labelHeight / (2 * height), Math.min(1 - labelHeight / (2 * height), y));
  const left = boundX(position.x) * width;
  const top = boundY(position.y) * height;
  const responder = useMemo(() => {
    const clampX = (x: number) => Math.max(-labelWidth / (2 * width), Math.min(1 - labelWidth / (2 * width), x));
    const clampY = (y: number) => Math.max(-labelHeight / (2 * height), Math.min(1 - labelHeight / (2 * height), y));
    // Gesture callbacks read refs after render; PanResponder only stores callbacks here.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => editable,
      onMoveShouldSetPanResponder: () => editable,
      onPanResponderGrant: () => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowPencil(true); start.current = { x: clampX(current.current.x), y: clampY(current.current.y) }; onInteraction(true); },
      onPanResponderMove: (_, gesture) => {
        const next = { x: clampX(start.current.x + gesture.dx / width), y: clampY(start.current.y + gesture.dy / height) };
        current.current = next; onChange(next);
      },
      onPanResponderRelease: (_, gesture) => {
        onInteraction(false);
        if (placeholder && Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) { setShowPencil(false); editAction.current(); return; }
        hideTimer.current = setTimeout(() => setShowPencil(false), 3000);
      },
      onPanResponderTerminate: () => {
        onInteraction(false);
        hideTimer.current = setTimeout(() => setShowPencil(false), 3000);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [width, height, labelWidth, labelHeight, editable, placeholder, onChange, onInteraction]);
  return <View accessibilityLabel={kind === 'phone' ? 'Drag mobile number anywhere on the banner' : 'Move supporter name'}
    style={{ position: 'absolute', zIndex, left, top, width: labelWidth, height: labelHeight, justifyContent: 'center', borderWidth: editable ? 1 : 0, borderStyle: 'dashed', borderColor: '#0F4C4E', backgroundColor, borderRadius: kind === 'name' ? 4 : 0 }}>
    <View {...responder.panHandlers} style={{ flex: 1, justifyContent: 'center' }}>
    {editable && <View pointerEvents="none" style={{ position: 'absolute', left: 5 }}>
      <Move size={14} color={textColor} />
    </View>}
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: textColor, fontWeight: kind === 'name' ? '800' : '600', fontSize, paddingLeft: 26, paddingRight: 8 }}>{text}</Text>
    </View>
    {editable && showPencil && <BannerElementTools left={Math.max(-left, Math.min(labelWidth - 110, width - left - 110))} top={Math.max(-34, -top)} zIndex={zIndex}
      onEdit={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowPencil(false); onEdit(); }}
      onFront={() => { onLayer(1); if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setShowPencil(false), 3000); }}
      onBack={() => { onLayer(-1); if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setShowPencil(false), 3000); }} />}

  </View>;
}
