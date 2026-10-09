import { DEFAULT_TEMPLATE_FIELDS, type TemplateFields } from "./fields";
import { buildTemplateHtml, getAllLocalTemplateVoters, openWebTemplatePrint } from "./print";
import { hasLocalVoters, replaceLocalVotersFromPages } from "@/services/local-voters";
import { isLocalVoterDatabaseAvailable } from "@/services/voter-database";
import { fetchTemplateVoters, forEachVoterPage, type Voter } from "@/services/voters";
import type { AuthUser } from "@/services/authentication";
import type { TemplateLayout } from "./components/TemplateThumbnail";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export async function generateTemplatePdf({ user, booth, district, state, layout, bannerImageUrl = "", fields = DEFAULT_TEMPLATE_FIELDS, printWindow }: {
  user: AuthUser; booth: string; district?: string; state?: string; layout: TemplateLayout; bannerImageUrl?: string; fields?: TemplateFields; printWindow: Window | null;
}) {
      const columns = 4;
      let records: Voter[];
      if (isLocalVoterDatabaseAvailable()) {
        if (!(await hasLocalVoters(user.id))) {
          await replaceLocalVotersFromPages(user.id, (savePage) => forEachVoterPage({}, savePage));
        }
        records = await getAllLocalTemplateVoters(user.id, booth);
      } else {
        const districts = district ? [district] : user.districts?.length ? user.districts : [user.district].filter(Boolean);
        if (!districts.length) throw new Error("District is required to load booth voters.");
        records = [];
        for (const district of districts) {
          records.push(...await fetchTemplateVoters({ booth, district, state: state || user.state }));
        }
      }
      const voters = Array.from(new Map(records.map((voter) => [voter.id, voter])).values());
      if (!voters.length) throw new Error("No voters found for this booth.");
      const html = buildTemplateHtml({ booth, columns, layout: layout, politicianName: user.name, voters, bannerImageUrl: bannerImageUrl, fields });
      if (Platform.OS === "web") {
        await openWebTemplatePrint(html, printWindow);
      } else {
        if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
        if (!FileSystem.cacheDirectory) throw new Error("PDF storage is unavailable.");
        const pdf = await Print.printToFileAsync({ html, base64: true, width: 595, height: 842 });
        if (!pdf.base64) throw new Error("Unable to generate the PDF.");
        const uri = `${FileSystem.cacheDirectory}voter-template-${Date.now()}.pdf`;
        await FileSystem.writeAsStringAsync(uri, pdf.base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share voter template" });
      }
}
