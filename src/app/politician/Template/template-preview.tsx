import { parseTemplateFields } from "@/features/templates/fields";
import { TemplatePagePreview } from "@/features/templates/components/TemplatePagePreview";
import { generateTemplatePdf } from "@/features/templates/generate";
import { SampleVoterCard } from "@/features/templates/components/SampleVoterCard";
import { TEMPLATE_LAYOUTS, TemplateThumbnail } from "@/features/templates/components/TemplateThumbnail";
import { ensureAuthSession, hasPoliticianPageAccess, refreshCurrentUser } from "@/services/authentication";
import { logVoterTemplatePrint } from "@/services/voters";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Check, Eye, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TemplatePreviewScreen() {
  const params = useLocalSearchParams<{ layout?: string; booth?: string; district?: string; state?: string; fields?: string }>();
  const fields = parseTemplateFields(params.fields);
  const template = TEMPLATE_LAYOUTS.find((item) => item.key === params.layout);
  const [pagePreview, setPagePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  async function useTemplate() {
    if (!template || savingRef.current) return;
    if (template.key !== "none") {
      router.push({ pathname: "/politician/Template/banner-setup", params: { ...params, layout: template.key } });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    const printWindow = Platform.OS === "web" ? window.open("", "_blank") : null;
    try {
      if (Platform.OS === "web" && !printWindow) throw new Error("Please allow popups, then try Generate again.");
      const { user } = await ensureAuthSession();
      if (!user || !hasPoliticianPageAccess("template", user)) throw new Error("Template access is unavailable.");
      const booth = params.booth || user?.assignedBooths?.[0] || user?.booth;
      if (!booth) throw new Error("Select a booth before using this template.");
      const columns = 4;
      await generateTemplatePdf({ user, fields, booth, district: params.district, state: params.state, layout: "none", printWindow });
      await logVoterTemplatePrint({
        booth,
        district: params.district || user?.district,
        state: params.state || user?.state,
        printCount: 0,
        templateSelection: { template: "studio", canvasLayout: template.key, recordsPerRow: columns },
      });
      await refreshCurrentUser();

    } catch (saveError) {
      printWindow?.close();
      setError(saveError instanceof Error ? saveError.message : "Unable to generate the PDF. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
      <View className="px-4 py-3">
        <Pressable accessibilityLabel="Back to templates" disabled={saving} onPress={() => router.back()} className="flex-row items-center gap-2 self-start py-2">
          <ArrowLeft color="#087568" size={22} />
          <Text className="text-base font-bold text-[#087568]">Back</Text>
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-6">
        {template?.key === "none" ? <SampleVoterCard fields={fields} layout="none" booth={params.booth} /> : template ? <>
          <TemplateThumbnail layout={template.key} selected={false} />
          <Text className="mb-3 mt-6 text-2xl font-black text-[#0F172A]">{template.label}</Text>
          <Text className="text-sm leading-6 text-[#64748B]">An A4 sheet of voter cards with the banner positioned in this layout.</Text>
          <Text className="mt-3 text-xs text-[#64748B]">A4 layout preview</Text>
        </> : <Text className="text-base text-[#0F172A]">Template not found.</Text>}
        {error ? <Text accessibilityRole="alert" className="mt-4 rounded-xl bg-[#FFF7ED] p-3 text-sm text-[#9A3412]">{error}</Text> : null}
      </ScrollView>
      <View className="flex-row gap-3 border-t border-[#E2E8F0] bg-white p-4">
        {template?.key === "none" ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => setPagePreview(true)} className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-[14px] border border-[#087568] px-4"><Eye color="#087568" size={20} /><Text className="text-[15px] font-bold text-[#087568]">Preview</Text></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={saving || !template} onPress={useTemplate} className={`min-h-[50px] flex-1 flex-row items-center justify-center gap-2 rounded-[14px] bg-[#064E3B] ${saving || !template ? "opacity-65" : ""}`}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Check color="#FFFFFF" size={20} strokeWidth={2.8} />}
          <Text className="text-[15px] font-black text-white">{saving ? "Generating…" : template?.key === "none" ? "Generate" : "Use this template"}</Text>
        </Pressable>
      </View>
      <Modal visible={pagePreview} animationType="slide" onRequestClose={() => setPagePreview(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F1F5F9" }}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-lg font-bold text-[#0F172A]">Page preview</Text>
            <Pressable accessibilityLabel="Close preview" onPress={() => setPagePreview(false)} className="rounded-full bg-white p-3"><X color="#087568" size={22} /></Pressable>
          </View>
          <ScrollView contentContainerClassName="p-4">
            {pagePreview ? <TemplatePagePreview fields={fields} layout="none" columns={4} booth={params.booth} /> : null}
            <Text className="mt-3 text-center text-xs text-[#64748B]">1 / 1 · Example voter data</Text>
          </ScrollView>
          <View className="border-t border-[#E2E8F0] bg-white p-4"><Pressable onPress={() => setPagePreview(false)} className="min-h-[50px] items-center justify-center rounded-[14px] bg-[#064E3B]"><Text className="text-[15px] font-bold text-white">Back to editing</Text></Pressable></View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
