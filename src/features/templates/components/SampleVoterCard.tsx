import { DEFAULT_TEMPLATE_FIELDS, type TemplateFields } from "../fields";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import type { TemplateLayout } from "./TemplateThumbnail";

type Crop = {
  source: { uri: string; width: number; height: number };
  width: number;
  height: number;
  x: number;
  y: number;
};

function Banner({ crop, ratio, width, height }: { crop: Crop; ratio: number; width: number; height?: number }) {
  const bannerHeight = height ?? width / ratio;
  const scale = height ? Math.max(width / crop.width, height / crop.height) : width / crop.width;
  return <View style={{ width, height: bannerHeight, overflow: "hidden", backgroundColor: "#E3F2EC" }}>
    <Image source={{ uri: crop.source.uri }} resizeMode="stretch" style={{ position: "absolute", width: crop.source.width * scale, height: crop.source.height * scale, left: (width - crop.width * scale) / 2 - crop.x * scale, top: (bannerHeight - crop.height * scale) / 2 - crop.y * scale }} />
  </View>;
}

export function SampleVoterCard({ layout, crop, booth, fields = DEFAULT_TEMPLATE_FIELDS }: { layout: TemplateLayout; crop?: Crop; booth?: string; fields?: TemplateFields }) {
  const [width, setWidth] = useState(0);
  const [detailHeight, setDetailHeight] = useState(186);
  const side = layout === "left" || layout === "right" || layout === "dual";
  const bannerWidth = side ? width * (layout === "dual" ? 0.18 : 0.3) : layout === "floating" ? 48 : width;
  const banner = crop && layout !== "none" ? <Banner crop={crop} ratio={crop.width / crop.height} width={bannerWidth} height={layout === "dual" ? detailHeight : undefined} /> : null;
  return <View className="mt-5 rounded-2xl border border-[#DDE8EF] bg-white p-3">
    <Text className="text-base font-bold text-[#0F172A]">Sample voter card</Text>
    <Text className="mb-3 mt-1 text-xs text-[#64748B]">{layout === "none" ? "Example voter data" : "Example data · updates as you adjust the crop"}</Text>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className="overflow-hidden border border-[#94A3B8] bg-white" style={{ borderStyle: "dotted", borderRadius: 0, elevation: 0, boxShadow: "none", flexDirection: layout === "bottom" ? "column-reverse" : layout === "right" ? "row-reverse" : side ? "row" : "column" }}>
      {width > 0 ? banner : null}
      <View onLayout={(event) => setDetailHeight(event.nativeEvent.layout.height)} className={layout === "dual" ? "px-2 py-3" : "p-3"} style={{ flex: side ? 1 : undefined, minWidth: 0 }}>
        <View className={`mb-2 items-start gap-2 ${layout === "dual" ? "flex-col" : "flex-row justify-between"}`}>
          <Text className="flex-1 text-sm font-black text-[#0F172A]">AARTI SHARMA</Text>
          <Text className="rounded-md bg-[#E3F2EC] px-2 py-1 text-[10px] font-bold text-[#087568]">#235</Text>
        </View>
        <View className="gap-1" style={{ flexDirection: side ? "column" : "row" }}>
          <View className="gap-1" style={{ flex: side ? undefined : 1, minWidth: 0 }}>
            {fields.epicNo ? <Text className="text-[11px] leading-4 font-bold text-[#087568]">EPIC: ABC1234567</Text> : null}
            {fields.houseNo ? <Text className="text-[11px] leading-4 text-[#334155]">House No: 534</Text> : null}
          </View>
          <View className="gap-1" style={{ flex: side ? undefined : 1, minWidth: 0 }}>
            {fields.age || fields.gender ? <Text className="text-[11px] leading-4 text-[#334155]">{[fields.age ? "Age: 38" : "", fields.gender ? "Female" : ""].filter(Boolean).join(" · ")}</Text> : null}
            {fields.ward ? <Text className="text-[11px] leading-4 text-[#334155]">Ward: 1</Text> : null}
          </View>
        </View>
        {fields.relation ? <Text className="mt-2 text-[11px] leading-4 text-[#334155]">Relative: Rajesh Sharma</Text> : null}
        {fields.booth ? <Text className="mt-1 text-[11px] leading-4 text-[#334155]">Booth No: {booth || "002"}</Text> : null}
        {fields.pollingStation ? <Text className="mt-1 text-[11px] leading-4 text-[#334155]">Polling Station: Government School</Text> : null}
      </View>
      {layout === "dual" && width > 0 ? banner : null}
    </View>
  </View>;
}
