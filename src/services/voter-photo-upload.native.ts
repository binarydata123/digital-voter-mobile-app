import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export async function appendVoterPhoto(form: FormData, uri: string): Promise<() => void> {
  // Decode iOS HEIC/PNG selections into a JPEG the backend can process.
  const context = ImageManipulator.manipulate(uri);
  let image = await context.renderAsync();
  if (Math.max(image.width, image.height) > 1600) {
    context.resize(image.width >= image.height ? { width: 1600 } : { height: 1600 });
    image = await context.renderAsync();
  }
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const file = new File(saved.uri);
  const cleanup = () => { if (file.exists) file.delete(); };
  if (!file.exists || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    cleanup();
    throw new Error("Could not prepare your photo. Choose a valid image smaller than 5 MB.");
  }
  // RN FormData serializes enumerable URI metadata, rather than web Blob bytes.
  form.append("voterPhotoFile", {
    uri: file.uri,
    name: "voter-photo.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  return cleanup;
}
