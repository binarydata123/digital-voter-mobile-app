export async function loadStudioImage(_key: string): Promise<string | null> { return null; }
export async function saveStudioImage(_key: string, _uri: string): Promise<string> { throw new Error('Local image storage is unavailable.'); }
