"use client";

/**
 * BLENDER 3D — the test page for the Blender-rendered footballer (Harry,
 * 28 Sep 2026: "I think that blender build is amazing, give it a full test
 * page and we will come back to it").
 *
 * Everything here was rendered once, offline, in Blender (tools/blender-
 * footballer). What this page proves is route (a) of that folder's NOTES.md:
 * one neutral-kit render set, recoloured into ANY club's kit in the browser.
 * Pick a club and the idle hero and the five stills are recoloured on a
 * canvas — once per pick, never per frame. There is no animation loop on
 * this page; the three clips are plain <video>.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import PlayerAvatar from "@/components/star/PlayerAvatar";
import { initials } from "@/components/star/ClubBadge";
import { CLUB_KITS, kitsOf, labelInk, type Kit } from "@/lib/star/kits";
import { getClubLogoMap, lookupClubLogo } from "@/lib/star/clubLogos";
import { kitColours, numberInk, recolourPixels, type LayerPack, type Px } from "@/lib/star/blenderRecolour";
import type { CareerState } from "@/lib/star/types";

const ROOT = "/star/blender";
const BG = "#05070d";
const INK = "#f8fafc";
const MUTED = "rgba(226,232,240,0.62)";
const CARD = "rgba(255,255,255,0.045)";
const LINE = "rgba(255,255,255,0.09)";

const SETS = [
  { id: "hero", label: "Idle (hero, new hair)" },
  { id: "idle", label: "Idle" },
  { id: "celebrate", label: "Arms up" },
  { id: "kneeslide", label: "Knee slide" },
  { id: "point", label: "Points at badge" },
  { id: "hips", label: "Hands on hips" },
] as const;
type SetId = (typeof SETS)[number]["id"];
const FILES = ["base.webp", "light.webp", "kitA.png", "kitB.png", "crest.png", "num.png"] as const;

const CLIPS = [
  { id: "idle", label: "Idle loop" },
  { id: "celebrate", label: "Jump" },
  { id: "kneeslide", label: "Knee slide" },
];

// hair.jpg is one sheet: row 1 = four styles in brown, row 2 = the crop in
// three colours. Each cell is 360 x 413 at these offsets.
const HAIR_W = 360, HAIR_H = 413, HAIR_SHEET_W = 1440;
const HAIR_CELLS: Record<string, { col: number; y: number }> = {
  "buzz-brown": { col: 0, y: 50 },
  "crop-brown": { col: 1, y: 50 },
  "afro-brown": { col: 2, y: 50 },
  "long-brown": { col: 3, y: 50 },
  "crop-black": { col: 0, y: 553 },
  "crop-blonde": { col: 2, y: 553 },
};
const HAIR_STYLES = [
  { id: "buzz", label: "Buzz" }, { id: "crop", label: "Crop" }, { id: "afro", label: "Curly" }, { id: "long", label: "Long" },
];
const HAIR_COLOURS = [
  { id: "black", label: "Black", dot: "#1b1612" }, { id: "brown", label: "Brown", dot: "#5a3a22" }, { id: "blonde", label: "Blonde", dot: "#d9b36a" },
];

const CLUBS = Object.keys(CLUB_KITS).sort((a, b) => a.localeCompare(b));

// ── Loading the layer packs (once) ─────────────────────────────────────────

async function decode(url: string): Promise<Px> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" });
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { data: d.data, width: d.width, height: d.height };
}

async function loadPack(id: SetId): Promise<LayerPack> {
  const [base, light, kitA, kitB, crest, num] = await Promise.all(FILES.map((f) => decode(`${ROOT}/layers/${id}/${f}`)));
  return { base, light, kitA, kitB, crest, num };
}

/** The figure's box inside the render (alpha > 0), padded — so each card
 *  shows the player, not a frame of empty sky. */
function alphaBox(p: Px, pad = 10) {
  let x0 = p.width, y0 = p.height, x1 = 0, y1 = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.data[(y * p.width + x) * 4 + 3] > 24) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(p.width - 1, x1 + pad); y1 = Math.min(p.height - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── The two decal pictures ─────────────────────────────────────────────────

const DECAL = 256;
function toPx(c: HTMLCanvasElement): Px {
  const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}
function blank(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = DECAL; c.height = DECAL;
  return [c, c.getContext("2d", { willReadFrequently: true })!];
}

/** The club's badge on a transparent square: the real crest from club_logos
 *  when it loads readably, else the game's own kit-colour-and-initials disc
 *  (the same fallback ClubBadge draws). */
async function crestPicture(club: string, kit: Kit): Promise<{ px: Px; source: string }> {
  let url: string | undefined;
  try { url = lookupClubLogo(await getClubLogoMap(), club); } catch { url = undefined; }
  if (url) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i); i.onerror = rej;
        i.src = url!;
      });
      const [c, ctx] = blank();
      const s = (DECAL * 0.86) / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (DECAL - w) / 2, (DECAL - h) / 2, w, h);
      return { px: toPx(c), source: "the club's real badge" };
    } catch {
      // Blocked cross-origin or failed to load: fall through to initials.
    }
  }
  const [c, ctx] = blank();
  const r = DECAL / 2;
  ctx.fillStyle = kit.trim; ctx.beginPath(); ctx.arc(r, r, r * 0.95, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = kit.shirt; ctx.beginPath(); ctx.arc(r, r, r * 0.82, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = labelInk(kit.shirt);
  ctx.font = `900 ${Math.round(DECAL * 0.26)}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(initials(club), r, r + 4);
  return { px: toPx(c), source: url ? "initials (the badge wouldn't load here)" : "initials (no badge loaded)" };
}

function numberPicture(n: string, kit: Kit): Px {
  const [c, ctx] = blank();
  ctx.fillStyle = numberInk(kit);
  ctx.font = `900 ${Math.round(DECAL * 0.62)}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(n, DECAL / 2, DECAL / 2 + DECAL * 0.04);
  return toPx(c);
}

// ── A minimal career, only so the real A2 avatar can be put beside it ─────

function a2Career(club: string, kit: Kit): CareerState {
  return {
    player: { club, firstName: "Probe", lastName: "Striker", skinTone: "tan", position: "ST" },
    squadNumber: 19,
    clubKits: { [club]: { home: kit, away: kitsOf(club).away } },
  } as unknown as CareerState;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BlenderPage() {
  const [club, setClub] = useState("Chelsea");
  const [strip, setStrip] = useState<"home" | "away">("home");
  const [packs, setPacks] = useState<Partial<Record<SetId, LayerPack>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [crestSource, setCrestSource] = useState("");
  const [ms, setMs] = useState<number | null>(null);
  const canvases = useRef<Partial<Record<SetId, HTMLCanvasElement | null>>>({});
  const [hair, setHair] = useState({ style: "crop", colour: "brown" });

  const kit = kitsOf(club)[strip];

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all(SETS.map(async (s) => [s.id, await loadPack(s.id)] as const))
      .then((all) => { if (alive) setPacks(Object.fromEntries(all)); })
      .catch((e) => { if (alive) setLoadError(String(e)); });
    return () => { alive = false; };
  }, []);

  // Recolour: runs once each time the club or strip changes.
  useEffect(() => {
    if (Object.keys(packs).length !== SETS.length) return;
    let alive = true;
    crestPicture(club, kit).then(({ px: crest, source }) => {
      if (!alive) return;
      const t0 = performance.now();
      const colours = kitColours(kit);
      const number = numberPicture("19", kit);
      for (const s of SETS) {
        const pack = packs[s.id]!;
        const canvas = canvases.current[s.id];
        if (!canvas) continue;
        const rgba = recolourPixels(pack, colours, crest, number);
        const box = alphaBox(pack.base);
        const full = document.createElement("canvas");
        full.width = pack.base.width; full.height = pack.base.height;
        full.getContext("2d")!.putImageData(new ImageData(rgba, pack.base.width, pack.base.height), 0, 0);
        canvas.width = box.w; canvas.height = box.h;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, box.w, box.h);
        ctx.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      }
      setMs(Math.round(performance.now() - t0));
      setCrestSource(source);
    });
    return () => { alive = false; };
  }, [packs, club, strip, kit]);

  const a2 = useMemo(() => a2Career(club, kit), [club, kit]);
  const ready = Object.keys(packs).length === SETS.length;
  const hairKey = `${hair.style}-${hair.colour}`;
  const hairCell = HAIR_CELLS[hairKey];

  const heroCanvas = (id: SetId, h: number) => (
    <canvas
      ref={(el) => { canvases.current[id] = el; }}
      style={{ height: h, width: "auto", maxWidth: "100%", display: "block", margin: "0 auto" }}
      aria-label={`${SETS.find((s) => s.id === id)!.label} in the ${club} ${strip} kit`}
    />
  );

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: INK }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 14px 60px" }}>
        {/* Header + club picker, pinned */}
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: BG, padding: "14px 0 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/star-play-dev" aria-label="Back" style={{
              width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", flex: "none",
              border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.06)", color: INK, fontSize: 17, fontWeight: 800, textDecoration: "none",
            }}>&#8249;</Link>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>Blender 3D</h1>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <select
              value={club} onChange={(e) => setClub(e.target.value)} aria-label="Club"
              style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 12, border: `1px solid ${LINE}`, background: "#0e1422", color: INK, fontWeight: 800, fontSize: 15, padding: "0 10px" }}
            >
              {CLUBS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: "flex", borderRadius: 12, border: `1px solid ${LINE}`, overflow: "hidden", flex: "none" }}>
              {(["home", "away"] as const).map((s) => (
                <button key={s} onClick={() => setStrip(s)} style={{
                  height: 40, padding: "0 12px", fontWeight: 900, fontSize: 13, textTransform: "capitalize", cursor: "pointer",
                  border: "none", background: strip === s ? "rgba(56,189,248,0.25)" : "transparent", color: strip === s ? "#e0f2fe" : MUTED,
                }}>{s}</button>
              ))}
            </div>
            <div aria-hidden style={{ width: 40, height: 40, borderRadius: 12, flex: "none", background: `linear-gradient(135deg, ${kit.shirt} 55%, ${kit.trim} 55%)`, border: `1px solid ${LINE}` }} />
          </div>
        </div>

        {loadError && <p style={{ color: "#fca5a5", fontWeight: 800 }}>Couldn&rsquo;t load the renders: {loadError}</p>}

        {/* 1. Home-screen hero: live 3D next to the live A2 */}
        <Section title="Home screen: A2 vs 3D">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Stage label="A2 (now)">
              <PlayerAvatar career={a2} width={160} height={200} look="A2" />
            </Stage>
            <Stage label="Blender 3D">{heroCanvas("hero", 200)}</Stage>
          </div>
          <Note>
            {ready ? <>Recoloured in this browser in {ms ?? "…"} ms, from one grey render. Crest: {crestSource || "…"}.</> : "Loading the renders…"}
          </Note>
        </Section>

        {/* 2. The five stills */}
        <Section title="Stills">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {SETS.filter((s) => s.id !== "hero").map((s) => (
              <Stage key={s.id} label={s.label}>{heroCanvas(s.id, 210)}</Stage>
            ))}
          </div>
        </Section>

        {/* 3. Hair */}
        <Section title="Hair">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{
              width: 180, height: Math.round((HAIR_H * 180) / HAIR_W), borderRadius: 14, border: `1px solid ${LINE}`, flex: "none",
              display: "grid", placeItems: "center", color: MUTED, fontWeight: 800, fontSize: 12, textAlign: "center", padding: hairCell ? 0 : 12,
              ...(hairCell ? {
                backgroundImage: `url(${ROOT}/hair.jpg)`,
                backgroundSize: `${(HAIR_SHEET_W * 180) / HAIR_W}px auto`,
                backgroundPosition: `-${hairCell.col * 180}px -${Math.round((hairCell.y * 180) / HAIR_W)}px`,
              } : { background: CARD }),
            }}>
              {!hairCell && "Not rendered yet — only the crop was rendered in every colour."}
            </div>
            <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 150 }}>
              <Chips items={HAIR_STYLES} value={hair.style} onPick={(style) => setHair((h) => ({ ...h, style }))} />
              <Chips items={HAIR_COLOURS} value={hair.colour} onPick={(colour) => setHair((h) => ({ ...h, colour }))} />
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ROOT}/hair.jpg`} alt="Four hair styles in brown, and the crop in black, brown and blonde" style={{ width: "100%", borderRadius: 14, marginTop: 12, display: "block" }} />
        </Section>

        {/* 4. Clips */}
        <Section title="Animations">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {CLIPS.map((c) => (
              <div key={c.id}>
                {/* H.264 for phones; VP9 for browsers built without H.264 (open-source Chromium). */}
                <video autoPlay loop muted playsInline preload="auto" poster={`${ROOT}/clips/${c.id}.jpg`}
                  style={{ width: "100%", aspectRatio: "2 / 3", borderRadius: 12, display: "block", background: "#0b1322" }}>
                  <source src={`${ROOT}/clips/${c.id}.mp4`} type='video/mp4; codecs="avc1.64001E"' />
                  <source src={`${ROOT}/clips/${c.id}.webm`} type='video/webm; codecs="vp9"' />
                </video>
                <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, textAlign: "center", marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <Note>Chelsea only — a video can&rsquo;t be recoloured. Recolourable frames are the same layer packs as above.</Note>
        </Section>

        {/* 5. Mock-up */}
        <Section title="In the home screen">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ROOT}/mockup-home.jpg`} alt="The 3D hero placed in the home screen, Chelsea" style={{ width: "100%", borderRadius: 14, display: "block" }} />
            <Stage label="A2, live">
              <PlayerAvatar career={a2Career("Chelsea", kitsOf("Chelsea").home)} width={160} height={200} look="A2" />
            </Stage>
          </div>
          <Note>The mock-up is Chelsea, pasted in offline. The A2 beside it is the real component.</Note>
        </Section>

        {/* 6. What's left, and the two routes */}
        <Section title="Before it's in the game">
          <List items={[
            "Shirt is too tight — the chest and stomach show through.",
            "Crest is small (8.5 cm on the chest).",
            "Long hair's fringe reads feminine; no swept-back style yet.",
            "No glow outline like A2, so it sits a touch darker on the card.",
            "Clips are short and hand-keyed; no run-up to the knee slide.",
          ]} />
        </Section>
        <Section title="Two ways in">
          <List items={[
            <><b>A. Pictures, recoloured here</b> — what this page does. About 150 KB per pose covers every club. No animation loop, so the one-engine guard is happy.</>,
            <><b>B. Real 3D in the browser</b> (three.js) — a 1.5–5 MB model, recoloured in the shader. It runs its own animation loop, so it needs Harry&rsquo;s OK and a guard exemption.</>,
          ]} />
        </Section>
      </div>
      <PageGuide page="/star-blender-dev" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{title}</h2>
      {children}
    </section>
  );
}

function Stage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${LINE}`, padding: "10px 6px 8px", overflow: "hidden",
      background: "radial-gradient(80% 55% at 50% 85%, rgba(34,197,94,0.22), transparent 70%), linear-gradient(180deg, #0a1020, #0d1628)",
    }}>
      <div style={{ display: "grid", placeItems: "center", minHeight: 150 }}>{children}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: MUTED, textAlign: "center", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Chips({ items, value, onPick }: { items: { id: string; label: string; dot?: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => (
        <button key={it.id} onClick={() => onPick(it.id)} style={{
          display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 999, cursor: "pointer",
          fontWeight: 800, fontSize: 13, border: `1px solid ${value === it.id ? "rgba(56,189,248,0.7)" : LINE}`,
          background: value === it.id ? "rgba(56,189,248,0.2)" : CARD, color: value === it.id ? "#e0f2fe" : INK,
        }}>
          {it.dot && <span style={{ width: 12, height: 12, borderRadius: 999, background: it.dot, border: "1px solid rgba(255,255,255,0.3)" }} />}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "8px 2px 0", fontSize: 12, fontWeight: 700, color: MUTED, lineHeight: 1.5 }}>{children}</p>;
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: 0, padding: "10px 12px 10px 28px", borderRadius: 14, background: CARD, border: `1px solid ${LINE}`, display: "grid", gap: 6 }}>
      {items.map((it, i) => <li key={i} style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>{it}</li>)}
    </ul>
  );
}
