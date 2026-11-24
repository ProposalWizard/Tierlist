/**
 * THE APP'S 3D FILES FOR THE CODE THAT ASKS FOR THEM WITH `fetch`.
 *
 * Most of the game's 3D code loads files through three.js's GLTFLoader and
 * TextureLoader, which the phone answers from the app (./GLTFLoader.ts,
 * ./standIn.ts). A few places ask `fetch("/star/…")` themselves: three's
 * FileLoader (the sky's light, an .hdr file) and the baked light's pictures
 * and numbers (lib/star/look/bakedLight.ts, which also unpacks a picture with
 * `createImageBitmap`). A phone has no website address to fetch from.
 *
 * `installBundledFetch()` answers those from the app's bundled files (the same
 * `bytes(url)` as everything else in ./platform.ts); any other address goes on
 * to the phone's own fetch. `createImageBitmap`, when the phone has none, gives
 * a picture Skia drew from the file (it can be drawn onto a canvas and read
 * back). Both are put back by the call it returns.
 */
import { threePlatform } from "./platform";
import { bundledPath } from "./standIn";

/** A file's bytes as a Blob-like thing the stand-in createImageBitmap understands. */
class BundledBlob {
  readonly __bundled = true;
  constructor(readonly bytes: Uint8Array, readonly type = "") {}
  get size() { return this.bytes.byteLength; }
  arrayBuffer() { return Promise.resolve(this.bytes.slice().buffer); }
}

class BundledResponse {
  readonly ok = true;
  readonly status = 200;
  readonly statusText = "OK";
  readonly redirected = false;
  readonly type = "basic";
  readonly body = undefined;
  readonly bodyUsed = false;
  readonly headers = { get: () => null, has: () => false, forEach: () => {} };
  constructor(readonly url: string, private buf: ArrayBuffer) {}
  arrayBuffer() { return Promise.resolve(this.buf.slice(0)); }
  text() { return Promise.resolve(new TextDecoder().decode(new Uint8Array(this.buf))); }
  json() { return this.text().then((t) => JSON.parse(t)); }
  blob() { return Promise.resolve(new BundledBlob(new Uint8Array(this.buf))); }
  clone() { return new BundledResponse(this.url, this.buf); }
}

export function installBundledFetch(): () => void {
  const g = globalThis as unknown as {
    fetch?: (input: unknown, init?: unknown) => Promise<unknown>;
    createImageBitmap?: (src: unknown, opts?: unknown) => Promise<unknown>;
  };
  const realFetch = g.fetch;
  const hadBitmap = typeof g.createImageBitmap === "function";
  g.fetch = (input: unknown, init?: unknown) => {
    const url = typeof input === "string" ? input : (input as { url?: string } | null)?.url ?? String(input);
    if (url.includes("/star/")) {
      return threePlatform().bytes(bundledPath(url)).then(
        (buf) => new BundledResponse(url, buf),
        (e) => (realFetch ? realFetch(input, init) : Promise.reject(e)),
      );
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("no network"));
  };
  if (!hadBitmap) {
    g.createImageBitmap = (src: unknown) => {
      const b = src as BundledBlob;
      if (!b || !b.__bundled) return Promise.reject(new Error("createImageBitmap: only the app's own pictures"));
      const S = threePlatform().Skia;
      const img = S.Image.MakeImageFromEncoded(S.Data.fromBytes(b.bytes));
      if (!img) return Promise.reject(new Error("createImageBitmap: could not unpack the picture"));
      return Promise.resolve({ width: img.width(), height: img.height(), close() { img.dispose?.(); }, __skiaImage: () => img });
    };
  }
  return () => {
    if (realFetch) g.fetch = realFetch; else delete g.fetch;
    if (!hadBitmap) delete g.createImageBitmap;
  };
}
