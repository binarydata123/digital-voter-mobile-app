export async function appendVoterPhoto(form: FormData, uri: string): Promise<() => void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Could not read your photo.");
  const blob = await response.blob();
  if (!blob.size || blob.size > 5 * 1024 * 1024) {
    throw new Error("Choose a valid image smaller than 5 MB.");
  }
  form.append("voterPhotoFile", blob, "voter-photo.jpg");
  return () => {};
}
