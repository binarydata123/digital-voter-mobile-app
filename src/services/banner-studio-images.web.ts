function storageKey(key: string) { return `politicease.studioImage.${encodeURIComponent(key)}`; }
export async function loadStudioImage(key: string): Promise<string | null> { return window.localStorage.getItem(storageKey(key)); }
export async function saveStudioImage(key: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to save this image.');
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to save this image.')); reader.readAsDataURL(blob);
  });
  window.localStorage.setItem(storageKey(key), data);
  return data;
}
