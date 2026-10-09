/** Keep native exception wrappers and internal file paths out of the update popup. */
export function updateErrorMessage(error: unknown): string {
  const message = typeof error === "string" ? error
    : error instanceof Error ? error.message
    : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/version does not match/i.test(message)) {
    return "The downloaded APK does not match the advertised update version. Please contact support to publish the correct APK.";
  }
  if (/checksum mismatch/i.test(message)) {
    return "The downloaded APK could not be verified. Please retry. If this continues, contact support.";
  }
  if (/signing key/i.test(message)) {
    return "This update was signed with a different key and cannot replace your installed app. Please contact support.";
  }
  if (/another app/i.test(message)) {
    return "The downloaded APK is for a different app. Please contact support for the correct update.";
  }
  if (/allow installation|permission|unknown source/i.test(message)) {
    return "Allow this app to install updates in Android settings, then try again.";
  }
  if (/download failed|network|connection|timed? ?out|unable to resolve host/i.test(message)) {
    return "Could not download the update. Check your internet connection and try again.";
  }
  if (/storage|no space|ENOSPC/i.test(message)) {
    return "There is not enough storage for the update. Free up space on your phone and try again.";
  }
  if (/invalid APK|missing|outside update cache/i.test(message)) {
    return "The downloaded APK is missing or invalid. Please download the update again.";
  }
  if (/installation cancelled or failed/i.test(message)) {
    return "Installation was cancelled or could not finish. Tap Install update to try again.";
  }
  return "Could not install the update. Please try again. If this continues, contact support.";
}
