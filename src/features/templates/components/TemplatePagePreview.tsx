import { DEFAULT_TEMPLATE_FIELDS, type TemplateFields } from "../fields";
import Svg, { ClipPath, Defs, G, Image, Rect, Text } from "react-native-svg";
import { View } from "react-native";
import type { TemplateLayout } from "./TemplateThumbnail";

type Crop = { source: { uri: string; width: number; height: number }; width: number; height: number; x: number; y: number };

export function TemplatePagePreview({ layout, crop, columns, booth, fields = DEFAULT_TEMPLATE_FIELDS }: { layout: TemplateLayout; crop?: Crop; columns: number; booth?: string; fields?: TemplateFields }) {
  const rows = layout === "none" ? 6 : 5;
  const cardWidth = (738 - (columns - 1) * 10) / columns;
  const cardHeight = (970 - (rows - 1) * 10) / rows;
  return <View className="aspect-[210/297] w-full overflow-hidden rounded-lg bg-white">
    <Svg width="100%" height="100%" viewBox="0 0 794 1123">
      <Text x={28} y={40} fontSize={18} fontWeight="bold" fill="#0F172A">Booth {booth || "002"} Voter Template</Text>
      <Text x={28} y={59} fontSize={11} fill="#64748B">Sample page · {columns * rows} example cards</Text>
      <Rect x={28} y={70} width={738} height={2} fill="#087568" />
      {Array.from({ length: columns * rows }, (_, index) => {
        const x = 28 + Math.floor(index / rows) * (cardWidth + 10);
        const y = 84 + (index % rows) * (cardHeight + 10);
        const side = layout === "left" || layout === "right" || layout === "dual";
        const bw = side ? cardWidth * (layout === "dual" ? 0.18 : 0.3) : layout === "floating" ? 32 : cardWidth;
        const bh = side ? cardHeight : layout === "floating" ? 32 : cardWidth / 3;
        const bx = layout === "right" ? x + cardWidth - bw : x;
        const by = layout === "bottom" ? y + cardHeight - bh : y;
        const tx = x + 8 + (side && layout !== "right" ? bw : 0);
        const ty = y + 18 + (layout === "top" || layout === "floating" ? bh : 0);
        // Vertical strips fill their slots without stretching the image.
        const scale = crop ? (layout === "dual" ? Math.max(bw / crop.width, bh / crop.height) : Math.min(bw / crop.width, bh / crop.height)) : 1;
        const imageX = crop ? bx + (bw - crop.width * scale) / 2 - crop.x * scale : bx;
        const imageY = crop ? by + (bh - crop.height * scale) / 2 - crop.y * scale : by;
        const id = `sample-banner-${index}`;
        const banner = (offset = 0) => <G key={offset} transform={`translate(${offset},0)`}>
          <Rect x={bx} y={by} width={bw} height={bh} fill="#F8FAFC" />
          {crop ? <G clipPath={`url(#${id})`}><Image href={{ uri: crop.source.uri }} x={imageX} y={imageY} width={crop.source.width * scale} height={crop.source.height * scale} preserveAspectRatio="none" /></G> : null}
        </G>;
        const names = ["AARTI SHARMA", "AJAY KUMAR", "ABHISHEK", "AARTI DEVI"];
        const detailWidth = cardWidth - 16 - (side ? bw * (layout === "dual" ? 2 : 1) : 0);
        const fontSize = layout === "dual" ? 10 : 12;
        const text = (value: string, textX: number, textY: number, availableWidth = detailWidth, color = "#334155", bold = false) => (
          <Text x={textX} y={textY} fontSize={Math.min(fontSize, availableWidth / Math.max(1, value.length * 0.55))} fontWeight={bold ? "bold" : "normal"} fill={color}>{value}</Text>
        );
        return <G key={index}>
          <Defs><ClipPath id={id}><Rect x={bx} y={by} width={bw} height={bh} /></ClipPath></Defs>
          <Rect x={x} y={y} width={cardWidth} height={cardHeight} fill="white" />
          {layout !== "none" ? banner() : null}
          {layout === "dual" ? banner(cardWidth - bw) : null}
          {text(names[index % names.length], tx, ty, detailWidth, "#0F172A", true)}
          {text(`S.No. ${index + 1}`, tx, ty + 15, detailWidth, "#087568", true)}
          {(side ? [
            [fields.epicNo ? `EPIC: ABC12345${String(index).padStart(2, "0")}` : ""],
            [[fields.age ? "Age: 38" : "", fields.gender ? "Female" : ""].filter(Boolean).join(" · ")],
            [fields.houseNo ? "House No: 534" : ""],
            [fields.ward ? "Ward: 1" : ""],
          ] : [
            [fields.epicNo ? `EPIC: ABC12345${String(index).padStart(2, "0")}` : "", [fields.age ? "Age: 38" : "", fields.gender ? "Female" : ""].filter(Boolean).join(" · ")],
            [fields.houseNo ? "House No: 534" : "", fields.ward ? "Ward: 1" : ""],
          ]).concat([
            [fields.relation ? "Rel: Rajesh Sharma" : ""],
            [fields.booth ? `Booth No: ${booth || "002"}` : ""],
            [fields.pollingStation ? "Station: Govt. School" : ""],
          ]).filter((row) => row.some(Boolean)).map((row, rowIndex) => <G key={rowIndex}>
            {row.map((line, columnIndex) => line ? <G key={columnIndex}>{text(line, tx + (columnIndex ? detailWidth / 2 + 3 : 0), ty + 30 + rowIndex * 15, row.length > 1 ? detailWidth / 2 - 3 : detailWidth, line.startsWith("EPIC:") ? "#087568" : "#334155", line.startsWith("EPIC:"))}</G> : null)}
          </G>)}
          <Rect x={x} y={y} width={cardWidth} height={cardHeight} fill="none" stroke="#94A3B8" strokeDasharray="1 3" strokeLinecap="round" />
        </G>;
      })}
    </Svg>
  </View>;
}
