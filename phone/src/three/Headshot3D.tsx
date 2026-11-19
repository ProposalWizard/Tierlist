import { partOff } from "../safety";
/**
 * A PLAYER'S HEADSHOT, SHOT FROM THE 3D MODEL (the website's
 * components/star/Headshot3D.tsx, on the phone).
 *
 * Shows his drawn head straight away and swaps in the 3D headshot once it is
 * ready: made one at a time (./headshotMaker.ts, on a GL context with no
 * view), once per device (kept as a file, the website keeps it in the
 * browser's database). If the phone can't make it, the drawn head stays.
 * The same man on every card: his look from lib/star/headshot3d/look.ts (you:
 * Settings → Your look). Pictures are made only for cards on screen (this
 * component asks when it mounts; the phone's screens mount only what they show).
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Image, View } from "react-native";
import { Skia } from "@shopify/react-native-skia";
import { Directory, File, Paths } from "expo-file-system";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";
import { headshotLookFor, headshotKey, type HeadshotKit, type HeadshotLook, type HeadshotFrame } from "@/lib/star/headshot3d/look";
import { headshotsToDrop, KEEP_HEADSHOTS } from "@/lib/star/headshot3d/store";
import { setupPhone3d } from "./assets";

/** Zoom keeps this point still: the face's middle sits a little above the chip's (the website's 50% 52%). */
const ZOOM_ORIGIN_Y = 0.52;

const memory = new Map<string, string>();
const going = new Map<string, Promise<string | null>>();
let dir: Directory | null = null;
let failedOnce = false;

function fileName(key: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) { const c = key.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13); }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}.png`;
}

/** The phone keeps the newest KEEP_HEADSHOTS pictures, as the website does (headshot3d/store.ts). */
const INDEX_KEY = "kib-headshots-index";
function keepOnly(d: Directory, added: string) {
  try {
    const ls = globalThis.localStorage;
    const rows = (JSON.parse(ls?.getItem(INDEX_KEY) ?? "[]") as { k: string; at: number }[]).filter((r) => r.k !== added);
    rows.push({ k: added, at: Date.now() });
    const drop = new Set(headshotsToDrop(rows, KEEP_HEADSHOTS));
    for (const k of Array.from(drop)) {
      try { const old = new File(d, k); if (old.exists) old.delete(); } catch { /* gone already */ }
      for (const [mk, uri] of Array.from(memory)) if (uri.endsWith("/" + k)) memory.delete(mk);
    }
    ls?.setItem(INDEX_KEY, JSON.stringify(rows.filter((r) => !drop.has(r.k))));
  } catch { /* no index: nothing dropped this time */ }
}

/** His picture's file address: kept on this phone, else made now. Null: the drawn head stays. */
export function headshotUri(id: string, look: HeadshotLook, frame: HeadshotFrame): Promise<string | null> {
  const key = headshotKey(id, look, frame);
  const mem = memory.get(key);
  if (mem) return Promise.resolve(mem);
  let p = going.get(key);
  if (p) return p;
  p = (async () => {
    try {
      dir ??= new Directory(Paths.document, "kib-headshots");
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const f = new File(dir, fileName(key));
      if (f.exists) { memory.set(key, f.uri); return f.uri; }
      if (failedOnce) return null;
      setupPhone3d();
      const { shootHeadshot, setHeadshotGl, headshotsPossible } = await import("./headshotMaker");
      const { GLView } = await import("expo-gl");
      if (!headshotsPossible()) {
        setHeadshotGl({
          make: async () => (await GLView.createContextAsync()) as unknown as WebGL2RenderingContext,
          drop: (gl) => { void GLView.destroyContextAsync(gl as never).catch(() => {}); },
        });
      }
      const px = await shootHeadshot(look, frame);
      if (!px) { if (!headshotsPossible()) failedOnce = true; return null; }
      const img = Skia.Image.MakeImage({ width: px.width, height: px.height, colorType: 4, alphaType: 2 } as never, Skia.Data.fromBytes(px.data), px.width * 4);
      const png = img?.encodeToBytes();
      if (!png) return null;
      f.create({ overwrite: true });
      await f.write(png);
      memory.set(key, f.uri);
      keepOnly(dir, f.name);
      return f.uri;
    } catch (e) {
      console.warn("headshot", e);
      return null;
    } finally {
      going.delete(key);
    }
  })();
  going.set(key, p);
  return p;
}

export function Headshot3D({ id, you, position, skin, kit, size, frame = "head", zoom = 1, fallback }: {
  id: string;
  you?: boolean;
  position?: string;
  skin?: string;
  kit: HeadshotKit;
  size: number;
  frame?: HeadshotFrame;
  /** >1 crops in on the face (a small round chip). */
  zoom?: number;
  /** What shows until the headshot lands (his drawn head). */
  fallback: ReactNode;
}) {
  if (partOff("3d")) return <>{fallback}</>;
  const yourPick = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const isYou = !!you || id === "you";
  const look = useMemo(
    () => headshotLookFor({ id, you: isYou, position, skin, kit }, yourPick),
    [id, isYou, position, skin, kit.shirt, kit.trim, kit.shorts, yourPick], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const key = headshotKey(id, look, frame);
  const [uri, setUri] = useState<string | null>(() => memory.get(key) ?? null);
  useEffect(() => {
    const m = memory.get(key);
    if (m) { setUri(m); return; }
    setUri(null);
    let alive = true;
    void headshotUri(id, look, frame).then((u) => { if (alive && u) setUri(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const shift = (ZOOM_ORIGIN_Y - 0.5) * size * (zoom - 1);
  return (
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, transform: zoom !== 1 ? [{ translateY: -shift }, { scale: zoom }] : undefined }} fadeDuration={180} />
        : <View style={{ width: size, height: size, transform: zoom !== 1 ? [{ translateY: -shift }, { scale: zoom }] : undefined }}>{fallback}</View>}
    </View>
  );
}
