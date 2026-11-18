/**
 * THE PHONE'S GLTFLoader (stands in for three/examples/jsm/loaders/GLTFLoader.js).
 *
 * The game's 3D code makes its own loaders (`new GLTFLoader()`, people3d.ts,
 * farewell3d.ts, ovation3d.ts …) and asks them for website addresses
 * ("/star/people3d/toon-p1.glb"). On the phone the bundler
 * (phone/metro.config.js) hands them this class instead. It is three's own
 * loader with two differences, nothing else:
 * - the file comes from the phone (./platform.ts `bytes`: the copy bundled in
 *   phone/assets/3d), not from a web address;
 * - the WebP pictures inside the file are unpacked by Skia into pixels
 *   (a phone has no browser <img>), the same pixels the browser gets.
 * Everything else (meshopt, skins, clips, materials) is three's own code.
 */
import { DataTexture, RGBAFormat, UnsignedByteType, type Texture } from "three";
import { GLTFLoader as ThreeGLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { threePlatform, decodePicture } from "./platform";
import { ensureThreeEnv } from "./env";

type Parser = {
  json: { images?: { bufferView?: number; uri?: string; mimeType?: string }[] };
  sourceCache: Record<number, Promise<Texture>>;
  getDependency(type: string, index: number): Promise<ArrayBuffer>;
  plugins: Record<string, { isSupported?: Promise<boolean> | null }>;
  loadImageSource(sourceIndex: number, loader: unknown): Promise<Texture>;
};

/** Read a picture out of the file into a texture three can upload (no <img>). */
function loadImageSourceOnPhone(this: Parser, sourceIndex: number): Promise<Texture> {
  const cached = this.sourceCache[sourceIndex];
  if (cached !== undefined) return cached.then((t) => t.clone());
  const def = this.json.images?.[sourceIndex];
  const p = (async () => {
    if (!def) throw new Error(`3D: picture ${sourceIndex} missing`);
    let bytes: Uint8Array;
    if (def.bufferView !== undefined) bytes = new Uint8Array(await this.getDependency("bufferView", def.bufferView));
    else if (def.uri && def.uri.startsWith("data:")) bytes = base64Bytes(def.uri.slice(def.uri.indexOf(",") + 1));
    else throw new Error("3D: pictures outside the file are not used by the game");
    const px = decodePicture(bytes);
    if (!px) throw new Error(`3D: could not unpack picture ${sourceIndex} (${def.mimeType ?? "?"})`);
    const tex = new DataTexture(px.data as Uint8Array<ArrayBuffer>, px.width, px.height, RGBAFormat, UnsignedByteType);
    // a picture from a file (not a data texture): mipmaps and smooth filtering, as a browser image gets
    tex.generateMipmaps = true;
    tex.unpackAlignment = 4;
    tex.needsUpdate = true;
    tex.userData.mimeType = def.mimeType;
    return tex as Texture;
  })();
  this.sourceCache[sourceIndex] = p;
  return p;
}

function base64Bytes(b64: string): Uint8Array {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | A.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return out.subarray(0, o);
}

export class GLTFLoader extends ThreeGLTFLoader {
  constructor(manager?: ConstructorParameters<typeof ThreeGLTFLoader>[0]) {
    ensureThreeEnv();
    super(manager);
    // runs first at every parse: pictures through Skia, WebP known to be readable
    this.register((parser) => {
      const pr = parser as unknown as Parser;
      pr.loadImageSource = loadImageSourceOnPhone;
      return {
        name: "kib_phone_pictures",
        beforeRoot() {
          const webp = pr.plugins.EXT_texture_webp;
          if (webp) webp.isSupported = Promise.resolve(true);
          const avif = pr.plugins.EXT_texture_avif;
          if (avif) avif.isSupported = Promise.resolve(false);
          return null;
        },
      } as never;
    });
  }

  load(url: string, onLoad: (g: GLTF) => void, _onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void): void {
    const path = url.slice(0, url.lastIndexOf("/") + 1);
    const plain = url.split("?")[0];
    threePlatform().bytes(plain).then((buf) => {
      this.parse(buf, path, onLoad, (e) => onError ? onError(e) : console.error("3D load", url, e));
    }, (e) => { if (onError) onError(e); else console.error("3D load", url, e); });
  }
}

export type { GLTF };
