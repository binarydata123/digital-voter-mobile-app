import { Check } from "lucide-react-native";
import { memo } from "react";
import Svg, { Path } from "react-native-svg";
import { View } from "react-native";

export type TemplateLayout =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "floating"
  | "dual"
  | "none";

export const TEMPLATE_LAYOUTS: { key: TemplateLayout; label: string }[] = [
  { key: "top", label: "Banner Top" },
  { key: "bottom", label: "Banner Bottom" },
  { key: "left", label: "Banner Left" },
  { key: "right", label: "Banner Right" },
  { key: "floating", label: "Floating Badge" },
  { key: "dual", label: "Dual Vertical" },
  { key: "none", label: "Data Only" },
];

function rectangle(x: number, y: number, width: number, height: number) {
  return `M${x},${y}h${width}v${height}h-${width}Z`;
}

// Draw each sheet with four SVG paths, rather than hundreds of styled Views.
const drawings = Object.fromEntries(TEMPLATE_LAYOUTS.map(({ key }) => {
  let cards = "", banners = "", lines = "";
  const rows = key === "none" ? 6 : 5;
  const rowHeight = key === "none" ? 47 : 57;
  const height = key === "none" ? 44 : 54;
  for (let i = 0; i < rows * 4; i++) {
    const x = 5 + (i % 4) * 50, y = 5 + Math.floor(i / 4) * rowHeight;
    cards += rectangle(x, y, 47, height);
    const side = key === "left" || key === "right" || key === "dual";
    let textX = x + 3, textY = y + 4, textWidth = 39;
    if (key === "top" || key === "bottom") {
      banners += rectangle(x, key === "top" ? y : y + 40, 47, 14);
      if (key === "top") textY += 15;
    } else if (side) {
      banners += rectangle(key === "right" ? x + 31 : x, y, 16, 54);
      if (key !== "right") textX += 16;
      textWidth = key === "dual" ? 17 : 23;
      if (key === "dual") banners += rectangle(x + 38, y, 9, 54);
    } else if (key === "floating") {
      banners += rectangle(x + 3, y + 3, 7, 7);
      textY += 10;
    }
    for (let row = 0; row < 3; row++) lines += rectangle(textX, textY + row * 3, textWidth - row * 5, 0.7);
    lines += rectangle(textX, key === "bottom" ? y + 36 : y + height - 4, textWidth, 0.7);
  }
  return [key, { cards, banners, lines }];
})) as Record<TemplateLayout, { cards: string; banners: string; lines: string }>;

export const TemplateThumbnail = memo(function TemplateThumbnail({ layout, selected }: { layout: TemplateLayout; selected: boolean }) {
  const drawing = drawings[layout];
  return (
    <View className={`aspect-[210/297] rounded-md border-2 bg-white p-[5px] ${selected ? "border-[#087568]" : "border-[#DDE8EF]"}`}>
      <Svg width="100%" height="100%" viewBox="0 0 210 297">
        <Path d={drawing.cards} fill="white" />
        <Path d={drawing.banners} fill={layout === "left" || layout === "right" ? "#374151" : "#087568"} />
        <Path d={drawing.lines} fill="#94A3B8" />
        <Path d={drawing.cards} fill="none" stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="0.5 1.5" strokeLinecap="round" />
      </Svg>
      {selected ? <View className="absolute right-1 top-1 rounded-full bg-[#087568] p-[3px]"><Check color="#FFFFFF" size={12} strokeWidth={3} /></View> : null}
    </View>
  );
});
