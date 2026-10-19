import { PermissionsAndroid, Platform } from "react-native";

type SimPhoneNumberNativeModule = {
  getPhoneNumber(): string | null;
};

function loadSimPhoneNumberModule(): SimPhoneNumberNativeModule {
  // The installed app can be an older development build or Expo Go, neither
  // of which contains this project's custom native module. Loading it lazily
  // lets sign-in continue with manual phone entry in that case.
  return require("./SimPhoneNumberModule")
    .default as SimPhoneNumberNativeModule;
}

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

    return loadSimPhoneNumberModule().getPhoneNumber();
  } catch (error) {
    console.warn("Could not read SIM phone number:", error);
    return null;
  }
}
