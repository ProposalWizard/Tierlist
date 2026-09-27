/**
 * lib/star/faceImageCache.ts — a photo that will not load becomes a fake face,
 * never a blank circle.
 *
 * Final playtest (27 Sep 2026): in a browser that could not reach the photo
 * store, every head but yours was drawn as a plain circle (91 "Failed to
 * fetch" errors) — the cache retried once and then left the man on
 * drawPlayerHead's plain backing for the whole match. The rule is ALWAYS a
 * fake face (lib/star/fakeFaces.ts).
 *
 * There is no DOM here, so `Image` and `window.setTimeout` are stood in for:
 * an image "loads" only if its address is one of the site's own fake faces,
 * exactly the situation in the playtest (the site up, the photo store not).
 */
import { FAKE_FACES, fakeFaceFor } from "../../lib/star/fakeFaces";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const timers: (() => void)[] = [];
class FakeImage {
  dataset: Record<string, string> = {};
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 0;
  private _src = "";
  get src() { return this._src; }
  set src(v: string) {
    this._src = v;
    this.complete = false; this.naturalWidth = 0;
    // Only the site's own files load; every photo-store address fails.
    if (FAKE_FACES.includes(v)) { this.complete = true; this.naturalWidth = 400; }
    else queueMicrotask(() => this.onerror?.());
  }
}
(globalThis as unknown as { Image: unknown }).Image = FakeImage;
(globalThis as unknown as { window: unknown }).window = { setTimeout: (f: () => void) => { timers.push(f); return 0; } };

const { createFaceImageCache, fallbackFaceFor } = await import("../../lib/star/faceImageCache");
const settle = async () => { for (let i = 0; i < 5; i++) { await Promise.resolve(); while (timers.length) timers.shift()!(); await Promise.resolve(); } };

console.log("A PHOTO THAT WILL NOT LOAD BECOMES A FAKE FACE");
{
  const cache = createFaceImageCache();
  const urls = Array.from({ length: 40 }, (_, i) => `https://photos.example/player-portraits/${1000 + i}.png`);
  const imgs = urls.map((u) => cache.get(u) as unknown as FakeImage);
  await settle();
  const drawn = imgs.filter((im) => im.complete && im.naturalWidth > 0).length;
  ok(drawn === urls.length, `every head is drawable after its photo failed (${drawn} of ${urls.length}; before: 0)`);
  ok(imgs.every((im, i) => im.src === fakeFaceFor(urls[i]) && FAKE_FACES.includes(im.src)), "…each as a fake face, the same one for that photo every time");
  ok(fallbackFaceFor(urls[3]) === fallbackFaceFor(urls[3]), "the fallback for one photo never changes");
  const again = cache.get(urls[0]) as unknown as FakeImage;
  ok(again === imgs[0], "a failed photo is not fetched again every frame (the cache keeps the fake face)");
}
{
  const cache = createFaceImageCache();
  const fake = cache.get(FAKE_FACES[2]) as unknown as FakeImage;
  await settle();
  ok(fake.src === FAKE_FACES[2] && fake.complete, "a fake face is drawn as itself");
  ok(cache.get(undefined) === undefined, "no address, no image (drawPlayerHead's own backing)");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
