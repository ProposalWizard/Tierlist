/**
 * "Save image" for the player card: the card drawn straight onto a canvas,
 * piece by piece, at the exact place each piece sits on screen.
 *
 * Not html2canvas: tried first (22 Oct 2026) and, as Leo found for the
 * plans-page share card (shareCardDraw.ts), it moved the text inside small
 * boxes — the overall sat on top of the position, the name was cut in half —
 * and it lost the club badge. Drawing it places every line exactly.
 *
 * How: the card's shape is its own SVG (serialised and drawn); every word or
 * number marked `data-pc-text` is drawn with its own font, colour and
 * alignment inside its own box; `data-pc-img` holds the flag and the badge
 * (an <svg> or <img>); the face is the 3D portrait still already on screen
 * (Headshot3D frame "card"), or the drawn head's canvas while it waits.
 * Browser only.
 */

/** The face's soft edges, shared by the screen (a CSS mask) and the PNG:
 *  solid down to 82% of its height then fading out; 5% fade at each side.
 *  (Was 62% and 16%, 23 Oct 2026: the arms sit in those edges, so the card's
 *  own colour showed through them — pale on silver, purple on a special card —
 *  and his arms read a different skin colour from his face.) */
export const FACE_FADE = { bottomFrom: 0.82, side: 0.05 };
export const FACE_MASK_CSS =
  `linear-gradient(to bottom, #000 ${FACE_FADE.bottomFrom * 100}%, transparent 100%), ` +
  `linear-gradient(to right, transparent 0%, #000 ${FACE_FADE.side * 100}%, #000 ${100 - FACE_FADE.side * 100}%, transparent 100%)`;

const loadImage =(src: string, cors = false): Promise<HTMLImageElement | null> =>
  new Promise((res) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

const svgImage = (svg: SVGSVGElement): Promise<HTMLImageElement | null> => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const r = svg.getBoundingClientRect();
  if (!clone.getAttribute("width")) clone.setAttribute("width", String(r.width));
  if (!clone.getAttribute("height")) clone.setAttribute("height", String(r.height));
  const xml = new XMLSerializer().serializeToString(clone);
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
};

/** A canvas is "tainted" by a cross-site picture without CORS; then toBlob
 *  throws. Check a drawn picture by reading one pixel on a scratch canvas. */
function safeToDraw(img: CanvasImageSource): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, 1, 1);
    g.getImageData(0, 0, 1, 1);
    return true;
  } catch { return false; }
}

export async function drawPlayerCardPng(card: HTMLElement, scale = 3): Promise<Blob | null> {
  const box = card.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.scale(scale, scale);
  const at = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  };

  // 1. The shape (gradient, shine, edge, lines).
  const shape = card.querySelector<SVGSVGElement>("svg[data-pc-shape]");
  if (shape) {
    const img = await svgImage(shape);
    if (img) { const p = at(shape); g.drawImage(img, p.x, p.y, p.w, p.h); }
  }

  // 2. The face (the drawn head, already a canvas) and its fade.
  // The same soft edges as the screen's mask (FACE_FADE), cut on a scratch
  // canvas so the card behind stays untouched.
  // The face is either the 3D portrait (an <img> of the kept still, shown
  // object-fit: cover) or, before it lands / with no WebGL, the drawn head's canvas.
  const portrait = card.querySelector<HTMLImageElement>("[data-pc-face] img");
  const face: HTMLCanvasElement | HTMLImageElement | null =
    portrait && portrait.complete && portrait.naturalWidth > 0 && safeToDraw(portrait) ? portrait : card.querySelector<HTMLCanvasElement>("[data-pc-face] canvas");
  if (face) {
    const p = at(face);
    const s = document.createElement("canvas");
    s.width = Math.round(p.w * scale); s.height = Math.round(p.h * scale);
    const f = s.getContext("2d");
    if (f) {
      if (face instanceof HTMLImageElement) {
        // object-fit: cover, as on screen: the middle of the picture, cut evenly
        const iw = face.naturalWidth, ih = face.naturalHeight;
        const k = Math.max(s.width / iw, s.height / ih);
        const sw = s.width / k, sh = s.height / k;
        f.drawImage(face, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, s.width, s.height);
      } else f.drawImage(face, 0, 0, s.width, s.height);
      f.globalCompositeOperation = "destination-in";
      const down = f.createLinearGradient(0, 0, 0, s.height);
      down.addColorStop(0, "#000"); down.addColorStop(FACE_FADE.bottomFrom, "#000"); down.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = down; f.fillRect(0, 0, s.width, s.height);
      const across = f.createLinearGradient(0, 0, s.width, 0);
      across.addColorStop(0, "rgba(0,0,0,0)"); across.addColorStop(FACE_FADE.side, "#000");
      across.addColorStop(1 - FACE_FADE.side, "#000"); across.addColorStop(1, "rgba(0,0,0,0)");
      f.fillStyle = across; f.fillRect(0, 0, s.width, s.height);
      g.drawImage(s, p.x, p.y, p.w, p.h);
    }
  }

  // Thin lines drawn as boxes on screen (the dividers).
  card.querySelectorAll<HTMLElement>("[data-pc-rect]").forEach((el) => {
    const p = at(el);
    g.fillStyle = getComputedStyle(el).backgroundColor;
    g.fillRect(p.x, p.y, p.w, p.h);
  });

  // 3. Flag and badge.
  for (const holder of Array.from(card.querySelectorAll<HTMLElement>("[data-pc-img]"))) {
    const svg = holder.querySelector("svg");
    const img = holder.querySelector("img");
    let pic: HTMLImageElement | null = null;
    let p = at(holder);
    if (svg) { pic = await svgImage(svg as SVGSVGElement); p = at(svg); }
    else if (img && img.src) {
      p = at(img);
      pic = img.src.startsWith("data:") ? await loadImage(img.src) : await loadImage(img.src, true);
    }
    if (pic && safeToDraw(pic)) g.drawImage(pic, p.x, p.y, p.w, p.h);
  }

  // 4. Every word and number, in its own box, with its own font.
  await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  card.querySelectorAll<HTMLElement>("[data-pc-text]").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (!text) return;
    const cs = getComputedStyle(el);
    const p = at(el);
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    g.fillStyle = el.dataset.pcColor || cs.color;
    const spaced = g as CanvasRenderingContext2D & { letterSpacing?: string };
    if ("letterSpacing" in spaced) spaced.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    g.textBaseline = "alphabetic";
    const align = cs.textAlign === "right" || cs.textAlign === "end" ? "right" : cs.textAlign === "center" ? "center" : "left";
    g.textAlign = align;
    const x = align === "right" ? p.x + p.w : align === "center" ? p.x + p.w / 2 : p.x;
    // The baseline exactly where the browser put it: a zero-size probe sitting
    // on the text's baseline, read and removed at once.
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;";
    el.appendChild(probe);
    const baseline = probe.getBoundingClientRect().top - box.top;
    probe.remove();
    // A word too wide for its box is squeezed, never cut (a long surname).
    g.fillText(text, x, baseline, p.w + 0.5);
  });

  return new Promise((res) => canvas.toBlob(res, "image/png"));
}
