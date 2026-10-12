export async function imageUpload(_uri: string): Promise<Blob> { throw new Error('Photo upload is unavailable'); }
export function saveCutout(_bytes: Uint8Array): string { throw new Error('Photo storage is unavailable'); }
export function deleteCutout(_uri: string): void {}
