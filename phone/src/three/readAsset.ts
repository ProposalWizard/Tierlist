/**
 * A bundled file's bytes, on the phone (expo-file-system reads the file the app was installed with).
 * The browser build of the app (the look check, phone/tools/look) has ./readAsset.web.ts instead.
 */
import { File } from "expo-file-system";

export async function readAssetBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}
