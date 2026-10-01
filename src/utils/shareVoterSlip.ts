import type { Voter } from "@/services/voters";
import * as Linking from "expo-linking";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

function buildVoterQrValue(voter: Voter): string {
  const epicNo = voter.epicNo ?? voter.id ?? voter.serialNo ?? "";
  return `https://votersakha.tech/voter-slip.html?epicNo=${encodeURIComponent(epicNo)}`;
}

function buildVoterSlipHtml(voter: Voter): string {
  const address = [
    voter.houseNo && voter.houseNo !== "N/A"
      ? `House No. ${voter.houseNo}`
      : "",
    voter.ward ? `Ward ${voter.ward}` : "",
    voter.district || "",
    voter.state || "",
  ]
    .filter(Boolean)
    .join(", ");

  const qrValue = buildVoterQrValue(voter);
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`;

  return `
  <!DOCTYPE html>
  <html lang="hi">
    <head>
      <meta charset="UTF-8" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, "Noto Sans Devanagari", sans-serif; background: #fff; color: #070a1c; padding: 16px; }
        .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
        .title { font-size: 26px; font-weight: 900; text-align: center; margin-bottom: 18px; }
        .name { font-size: 20px; font-weight: 900; text-align: center; }
        .hindi { font-size: 18px; font-weight: 900; text-align: center; margin: 4px 0 18px; }
        .row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .row .label { color: #64748b; }
        .row .value { color: #0f172a; text-align: right; }
        .block { margin-top: 14px; font-size: 15px; font-weight: 800; }
        .block .label { color: #64748b; display: block; margin-bottom: 4px; }
        .block .value { color: #0f172a; }
        .qr { text-align: center; margin-top: 20px; }
        .qr img { width: 180px; height: 180px; }
        .qr .caption { color: #64748b; font-size: 11px; margin-top: 6px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="title">Voter Slip</div>
        <div class="name">${voter.name || "N/A"}</div>
        ${voter.hindiName ? `<div class="hindi">${voter.hindiName}</div>` : ""}
        <div class="row"><span class="label">Gender :</span><span class="value">${voter.gender || "N/A"}</span></div>
        <div class="row"><span class="label">Age :</span><span class="value">${voter.age || "N/A"}</span></div>
        <div class="row"><span class="label">${voter.relation || "पिता का नाम"} :</span><span class="value">${voter.guardian || "N/A"}</span></div>
        <div class="row"><span class="label">Serial No :</span><span class="value">${voter.serialNo || "N/A"}</span></div>
        <div class="row"><span class="label">Booth No :</span><span class="value">${voter.booth || "N/A"}</span></div>
        <div class="row"><span class="label">Epic No :</span><span class="value">${voter.epicNo || "N/A"}</span></div>
        <div class="block"><span class="label">Address :</span><span class="value">${address || "N/A"}</span></div>
        <div class="block"><span class="label">Polling Station No. &amp; Address :</span><span class="value">${voter.pollingStation || "N/A"}</span></div>
        <div class="qr">
          <img src="${qrImage}" alt="QR" />
          <div class="caption">Scan to open voter detail</div>
        </div>
      </div>
    </body>
  </html>`;
}

export async function shareVoterSlip(voter: Voter): Promise<void> {
  const epicNo = voter.epicNo || voter.id || "voter";

  // 1. Generate the PDF
  const { uri } = await Print.printToFileAsync({
    html: buildVoterSlipHtml(voter),
    base64: false,
  });

  // 2. Phone number check
  const phone = (voter.whatsappNumber || voter.mobileNumber || "").replace(
    /\D/g,
    "",
  );

  if (phone.length >= 10) {
    const withCountry = phone.length === 10 ? `91${phone}` : phone;
    const chatUrl = `https://wa.me/${withCountry}?text=${encodeURIComponent(
      `Voter Slip - ${voter.name}\nEPIC: ${epicNo}\nBooth: ${voter.booth}\n${buildVoterQrValue(voter)}`,
    )}`;

    return new Promise<void>((resolve) => {
      Alert.alert(
        "Share Voter Slip",
        `${voter.name}\n${withCountry}`,
        [
          {
            text: "Send PDF via WhatsApp",
            onPress: async () => {
              await Sharing.shareAsync(uri, {
                mimeType: "application/pdf",
                dialogTitle: `Share voter slip - ${voter.name}`,
                UTI: "com.adobe.pdf",
              });
              resolve();
            },
          },
          {
            text: "Open WhatsApp chat",
            onPress: async () => {
              await Linking.openURL(chatUrl);
              resolve();
            },
          },
          { text: "Cancel", style: "cancel", onPress: () => resolve() },
        ],
        { cancelable: true, onDismiss: () => resolve() },
      );
    });
  }

  // 3. No phone → just open native share sheet
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert("Sharing not available on this device");
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: `Share voter slip - ${voter.name}`,
    UTI: "com.adobe.pdf",
  });
}
