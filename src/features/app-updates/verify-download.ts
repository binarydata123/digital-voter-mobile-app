type Download = { uri: string; status: number } | undefined;
export async function verifyDownload(
  download: Download,
  expectedChecksum: string,
  sha256: (uri: string) => Promise<string>,
  remove: (uri: string) => Promise<void>,
): Promise<string> {
  if (!download || download.status !== 200) throw new Error("Download failed. Check your connection and try again.");
  try {
    if ((await sha256(download.uri)).toLowerCase() !== expectedChecksum.toLowerCase()) {
      throw new Error("APK checksum mismatch. Please try again or contact support.");
    }
    return download.uri;
  } catch (error) {
    await remove(download.uri).catch(() => {});
    throw error;
  }
}
