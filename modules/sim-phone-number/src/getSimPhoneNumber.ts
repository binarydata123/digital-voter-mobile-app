import { PermissionsAndroid, Platform } from "react-native";
import SimPhoneNumber from "./SimPhoneNumberModule";

export async function getSimPhoneNumber(): Promise<string | null> {
  if (
    Platform.OS !== "android" ||
    !SimPhoneNumber ||
    typeof SimPhoneNumber.getPhoneNumber !== "function"
  ) {
    return null;
  }

  try {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
    );

    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      return null;
    }

    return SimPhoneNumber.getPhoneNumber();
  } catch (error) {
    console.warn("Could not read SIM phone number:", error);
    return null;
  }
}
