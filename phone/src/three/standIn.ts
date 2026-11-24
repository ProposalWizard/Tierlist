/**
 * STAND-IN PAGE PIECES FOR THE WALK-AROUND 3D PLACES (garden, shop, house, pitch).
 *
 * The website's 3D places (lib/star/garden3d/scene.ts …) are started with
 * `start(container, callbacks, data, opts)`. They put the renderer's canvas in
 * `container`, read its size, listen for the keyboard and for pointers on it,
 * and build small captions and a speed readout from `document.createElement("div")`.
 * A phone has no page, so this file gives them what they touch and nothing
 * more: plain objects that remember what they are given and do nothing else.
 * (Only the 3D walk-around uses them: ./walkHost.ts, ./env.ts.)
 *
 * - `makeElement(tag)`: a hollow element (style, children, attributes, event listeners).
 * - `makeContainer(w, h)`: the scene's container, a hollow element with a size, whose
 *   listeners can be fed the touches (`dispatch`) so a pinch zooms as on the website.
 * - `StandInImage`: what `new TextureLoader()` gets from `createElementNS(…, "img")`:
 *   setting `src` reads the bundled file, unpacks the picture with Skia (as the
 *   phone's GLTFLoader does for pictures inside a model) and fires "load".
 */
import { threePlatform, decodePicture } from "./platform";

type Listener = (e: unknown) => void;

export interface HollowElement {
  __kibHollow: true;
  tagName: string;
  nodeName: string;
  style: Record<string, unknown> & { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  dataset: Record<string, string>;
  children: unknown[];
  childNodes: unknown[];
  parentNode: HollowElement | null;
  parentElement: HollowElement | null;
  textContent: string;
  innerHTML: string;
  innerText: string;
  className: string;
  id: string;
  hidden: boolean;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  classList: { add(...c: string[]): void; remove(...c: string[]): void; toggle(c: string): boolean; contains(c: string): boolean };
  appendChild<T>(c: T): T;
  append(...c: unknown[]): void;
  prepend(...c: unknown[]): void;
  insertBefore<T>(c: T, ref: unknown): T;
  removeChild<T>(c: T): T;
  replaceChildren(...c: unknown[]): void;
  remove(): void;
  setAttribute(k: string, v: unknown): void;
  getAttribute(k: string): string | null;
  removeAttribute(k: string): void;
  hasAttribute(k: string): boolean;
  addEventListener(type: string, fn: Listener, opts?: unknown): void;
  removeEventListener(type: string, fn: Listener, opts?: unknown): void;
  dispatchEvent(e: { type: string }): boolean;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; x: number; y: number };
  querySelector(sel: string): null;
  querySelectorAll(sel: string): never[];
  getElementsByTagName(tag: string): never[];
  contains(c: unknown): boolean;
  focus(): void;
  blur(): void;
  click(): void;
  setPointerCapture(id: number): void;
  releasePointerCapture(id: number): void;
  requestFullscreen(): Promise<void>;
  getContext(kind: string): null;
  /** For the host: the listeners the scene added, by event type. */
  __listeners: Map<string, Set<Listener>>;
}

export function makeElement(tag = "div"): HollowElement {
  const listeners = new Map<string, Set<Listener>>();
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const el = {
    __kibHollow: true as const,
    tagName: tag.toUpperCase(),
    nodeName: tag.toUpperCase(),
    style: { setProperty(this: Record<string, unknown>, k: string, v: string) { this[k] = v; }, removeProperty(this: Record<string, unknown>, k: string) { delete this[k]; } },
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    childNodes: [] as unknown[],
    parentNode: null as HollowElement | null,
    parentElement: null as HollowElement | null,
    textContent: "",
    innerHTML: "",
    innerText: "",
    className: "",
    id: "",
    hidden: false,
    width: 0,
    height: 0,
    clientWidth: 0,
    clientHeight: 0,
    offsetWidth: 0,
    offsetHeight: 0,
    classList: {
      add: (...c: string[]) => { c.forEach((x) => classes.add(x)); },
      remove: (...c: string[]) => { c.forEach((x) => classes.delete(x)); },
      toggle: (c: string) => { if (classes.has(c)) { classes.delete(c); return false; } classes.add(c); return true; },
      contains: (c: string) => classes.has(c),
    },
    appendChild<T>(c: T): T {
      el.children.push(c); el.childNodes.push(c);
      const k = c as { parentNode?: unknown; parentElement?: unknown };
      if (k && typeof k === "object") { k.parentNode = el; k.parentElement = el; }
      return c;
    },
    append(...c: unknown[]) { c.forEach((x) => el.appendChild(x)); },
    prepend(...c: unknown[]) { c.forEach((x) => el.appendChild(x)); },
    insertBefore<T>(c: T, _ref: unknown): T { return el.appendChild(c); },
    removeChild<T>(c: T): T {
      el.children = el.children.filter((x) => x !== c); el.childNodes = el.children.slice();
      const k = c as { parentNode?: unknown; parentElement?: unknown };
      if (k && typeof k === "object") { k.parentNode = null; k.parentElement = null; }
      return c;
    },
    replaceChildren(...c: unknown[]) { el.children = []; el.childNodes = []; c.forEach((x) => el.appendChild(x)); },
    remove() { (el.parentNode as HollowElement | null)?.removeChild(el); },
    setAttribute(k: string, v: unknown) { attrs.set(k, String(v)); },
    getAttribute(k: string) { return attrs.has(k) ? (attrs.get(k) as string) : null; },
    removeAttribute(k: string) { attrs.delete(k); },
    hasAttribute(k: string) { return attrs.has(k); },
    addEventListener(type: string, fn: Listener) { let s = listeners.get(type); if (!s) listeners.set(type, (s = new Set())); s.add(fn); },
    removeEventListener(type: string, fn: Listener) { listeners.get(type)?.delete(fn); },
    dispatchEvent(e: { type: string }) { listeners.get(e.type)?.forEach((f) => f(e)); return true; },
    getBoundingClientRect() { const w = el.clientWidth, h = el.clientHeight; return { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByTagName() { return []; },
    contains(c: unknown) { return c === el || el.children.includes(c); },
    focus() { /* no focus on a phone */ },
    blur() { /* no focus on a phone */ },
    click() { /* no click */ },
    setPointerCapture() { /* the host owns the touches */ },
    releasePointerCapture() { /* the host owns the touches */ },
    requestFullscreen() { return Promise.resolve(); },
    getContext() { return null; },
    __listeners: listeners,
  };
  return el as unknown as HollowElement;
}

/** The scene's container: a hollow element of this size (CSS points). */
export function makeContainer(width: number, height: number) {
  const el = makeElement("div");
  el.clientWidth = el.offsetWidth = el.width = width;
  el.clientHeight = el.offsetHeight = el.height = height;
  /** Hand a touch to whatever the scene listens for on the container (the pinch zoom listens for pointers). */
  const dispatch = (type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", id: number, x: number, y: number) => {
    const set = el.__listeners.get(type);
    if (!set || !set.size) return;
    const e = { type, pointerId: id, pointerType: "touch", clientX: x, clientY: y, button: 0, buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1, target: el, currentTarget: el, preventDefault() { /* nothing to prevent */ }, stopPropagation() { /* nothing to stop */ } };
    for (const f of Array.from(set)) f(e);
  };
  const resize = (w: number, h: number) => { el.clientWidth = el.offsetWidth = el.width = w; el.clientHeight = el.offsetHeight = el.height = h; };
  return { el: el as unknown as HTMLElement, hollow: el, dispatch, resize };
}

/** The path a loader asks for ("/star/x.webp", or with ?v=…, or a full address) as the app's file address. */
export function bundledPath(url: string): string {
  let u = url.split("?")[0].split("#")[0];
  const i = u.indexOf("/star/");
  if (i > 0) u = u.slice(i);
  return u;
}

/**
 * What a texture loader gets for an <img>: the picture arrives from the app's bundled
 * files; its pixels are kept as `data` (RGBA, top row first) with `width` and `height`,
 * which ./gl.ts uploads as they are (texImage2D reads `data`).
 */
export class StandInImage {
  __kibHollow = true as const;
  tagName = "IMG";
  style: Record<string, unknown> = {};
  crossOrigin: string | null = null;
  complete = false;
  width = 0;
  height = 0;
  naturalWidth = 0;
  naturalHeight = 0;
  data: Uint8Array | undefined;
  onload: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private url = "";
  get src() { return this.url; }
  set src(v: string) {
    this.url = String(v);
    if (this.url.startsWith("data:")) { this.fail(new Error("3D: pictures given as data are not used by the game")); return; }
    threePlatform().bytes(bundledPath(this.url)).then((buf) => {
      const px = decodePicture(new Uint8Array(buf));
      if (!px) throw new Error(`3D: could not unpack ${this.url}`);
      this.width = this.naturalWidth = px.width;
      this.height = this.naturalHeight = px.height;
      this.data = px.data;
      this.complete = true;
      this.fire("load");
    }).catch((e) => this.fail(e));
  }
  addEventListener(type: string, fn: Listener) { let s = this.listeners.get(type); if (!s) this.listeners.set(type, (s = new Set())); s.add(fn); }
  removeEventListener(type: string, fn: Listener) { this.listeners.get(type)?.delete(fn); }
  setAttribute() { /* nothing */ }
  removeAttribute() { /* nothing */ }
  private fail(e: unknown) { this.fire("error", e); }
  private fire(type: "load" | "error", err?: unknown) {
    const ev = { type, target: this, currentTarget: this, error: err };
    // three's loader reads `this` (the image) in its listener, as a browser's <img> gives
    for (const f of Array.from(this.listeners.get(type) ?? [])) (f as (this: unknown, e: unknown) => void).call(this, ev);
    (type === "load" ? this.onload : this.onerror)?.call(this, ev);
  }
}
