import { api } from "./api";

export type DeviceLimitContact = {
  admin: { name: string; phone: string };
  deviceLimit: number;
  activeDeviceCount: number;
  message: string;
};

export async function getDeviceLimitAdminContact(contactToken: string): Promise<DeviceLimitContact> {
  const response = await api.get("/auth/device-limit/admin-contact", {
    headers: { Authorization: `Bearer ${contactToken}` },
  });
  if (!response.data?.success || !response.data.data) {
    throw new Error(response.data?.message || "Unable to load your admin contact.");
  }
  return response.data.data;
}

export function adminWhatsAppUrl(contact: DeviceLimitContact) {
  let digits = contact.admin.phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(digits)) throw new Error("Your admin's contact number is unavailable. Please contact your organisation.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(contact.message)}`;
}
