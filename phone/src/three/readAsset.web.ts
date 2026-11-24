/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this file:
 * on a phone ./readAsset.ts reads the bundled file with expo-file-system, which does not
 * exist in a browser; here the same file is fetched from the page's own address.
 */
export async function readAssetBytes(uri: string): Promise<Uint8Array> {
  const r = await fetch(uri);
  if (!r.ok) throw new Error(`3D: ${uri} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
