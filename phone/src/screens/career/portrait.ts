/**
 * YOUR OWN PHOTO (the website's PortraitPicker "Add a photo" / "Take a photo").
 * The phone's own picker does the choosing and the square crop:
 *  - "Add a photo" opens Android's photo picker. It needs NO permission: the
 *    phone only hands over the one picture you pick.
 *  - "Take a photo" asks for the camera the first time, then opens the camera
 *    app (front camera first).
 * The picture is made small (256 px, cut to an oval head) before it is kept, so
 * the save stays small, and is stored the way the website stores it: a
 * `data:image/…;base64,…` line on `player.portrait`.
 *
 * The website also scans the face and cuts it out; that needs a face model the
 * phone app does not carry, so here the square you crop IS the picture.
 * (Photo faces are off in matches for everyone, FACT-UI-015: the photo shows
 * on the tile, team sheets and Player of the Month graphics.)
 */
import { Skia, ImageFormat, ClipOp } from "@shopify/react-native-skia";

export type PortraitResult = { ok: true; dataUrl: string } | { ok: false; reason: "cancelled" | "denied" | "failed"; message?: string };

const SIDE = 256;

/**
 * A base64 picture made into a 256 px head: the middle square, cut to an oval (the
 * corners see-through), as a PNG. The game draws your face ON your figure's head, the way
 * the website's scanned cut-out is: a square photo there would show its corners.
 * Returns null if the phone can't draw it.
 */
function headFrom(base64: string): string | null {
  try {
    const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
    const surface = img ? Skia.Surface.Make(SIDE, SIDE) : null;
    if (!img || !surface) return null;
    const w = img.width(), h = img.height(), s = Math.min(w, h);
    const canvas = surface.getCanvas();
    const oval = Skia.PathBuilder.Make();
    oval.addOval({ x: SIDE * 0.1, y: 0, width: SIDE * 0.8, height: SIDE });
    canvas.clipPath(oval.build(), ClipOp.Intersect, true);
    canvas.drawImageRect(img, { x: (w - s) / 2, y: (h - s) / 2, width: s, height: s }, { x: 0, y: 0, width: SIDE, height: SIDE }, Skia.Paint());
    surface.flush();
    return surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100) || null;
  } catch {
    return null;
  }
}

export async function pickPortrait(from: "library" | "camera"): Promise<PortraitResult> {
  try {
    // loaded here, not at start: a phone build without the picker still opens the game
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Picker = require("expo-image-picker") as typeof import("expo-image-picker");
    const options = { mediaTypes: ["images"] as ("images")[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7, base64: true, exif: false };
    if (from === "camera") {
      const perm = await Picker.requestCameraPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: "denied", message: perm.canAskAgain ? "The camera was not allowed." : "The camera is switched off for this app. Turn it on in the phone's Settings → Apps → this app → Permissions." };
    }
    const res = from === "camera"
      ? await Picker.launchCameraAsync({ ...options, cameraType: Picker.CameraType.front })
      : await Picker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets?.length) return { ok: false, reason: "cancelled" };
    const b64 = res.assets[0].base64;
    if (!b64) return { ok: false, reason: "failed", message: "That picture could not be read." };
    const head = headFrom(b64);
    // never keep the full-size picture: it would make the save many megabytes
    if (!head) return { ok: false, reason: "failed", message: "That picture could not be used. Try another one." };
    return { ok: true, dataUrl: `data:image/png;base64,${head}` };
  } catch (e) {
    return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "That did not work." };
  }
}
