"use client";

/**
 * ANIMATION TEST AREA — every New animation, looping, next to the Old game,
 * with the dials and switches that size them (lib/star/animDials.ts).
 *
 * Leo, 6 Oct 2026: "make this all toggleable and testing area and editable and
 * viewable and everything so that if its not good we can alter and change and
 * potentially just remove it all."
 *
 * No football is played here and nothing loops in code: each animation is
 * painted once into a strip of frames (lib/star/animGallery.ts, the match's
 * own pose functions) and the browser steps through the strip with CSS. To
 * judge the dials in the real game, the links at the bottom open the real
 * match (Infinite Highlights / Infinite Match), which reads the same dials.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import {
  GALLERY, GALLERY_GROUPS, loopSeconds, drawGalleryFrame,
  type GalleryItem, type GalleryVersion,
} from "@/lib/star/animGallery";
import {
  useAnimSettings, setAnimDial, setAnimFamily, resetAnimSettings, setAnimSettings,
  exportAnimSettings, importAnimSettings,
  ANIM_FAMILIES, DIAL_INFO, DIAL_KEYS, FIRST_VERSION_DIALS, DEFAULT_ANIM_DIALS,
  type AnimSettings,
} from "@/lib/star/animDials";
import { useAnimationsLook, setAnimationsLook } from "@/lib/star/animLook";
import { FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import type { FigureSkin } from "@/lib/star/figureSkin";

const CELL_W = 84, CELL_H = 120, FPS = 24;
const BG = "#05070d", INK = "#f2f5f9", MUTED = "#8a97aa", CARD = "rgba(255,255,255,0.05)";

type Group = (typeof GALLERY_GROUPS)[number] | "All";

/** One animation painted into a strip of frames; CSS steps through it. */
function Strip({ item, version, skin, foot, settings, speed, paused, scrub }: {
  item: GalleryItem; version: GalleryVersion; skin: FigureSkin; foot: 1 | -1;
  settings: AnimSettings; speed: number; paused: boolean; scrub: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const L = loopSeconds(item);
  const n = Math.max(8, Math.round(L * FPS));
  const key = JSON.stringify(settings);
  useEffect(() => {
    const id = setTimeout(() => {
      const c = ref.current;
      if (!c) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.round(CELL_W * n * dpr);
      c.height = Math.round(CELL_H * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CELL_W * n, CELL_H);
      const r = 60 / FIGURE_HEIGHT_R;
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * CELL_W, 0, CELL_W, CELL_H);
        ctx.clip();
        // grass line
        ctx.fillStyle = "rgba(34,120,60,0.35)";
        ctx.fillRect(i * CELL_W, CELL_H - 18, CELL_W, 18);
        drawGalleryFrame(ctx, item, (i / n) * L, version, i * CELL_W + CELL_W / 2, CELL_H - 14, r, skin, foot, settings);
        ctx.restore();
      }
    }, 60);
    return () => clearTimeout(id);
  }, [item, version, skin, foot, key, n, L]);
  const frame = Math.min(n - 1, Math.round(scrub * (n - 1)));
  return (
    <div style={{ width: CELL_W, height: CELL_H, overflow: "hidden", borderRadius: 8, background: "rgba(0,0,0,0.35)" }}>
      <canvas
        ref={ref}
        style={{
          width: CELL_W * n, height: CELL_H, display: "block",
          ...(paused
            ? { transform: `translateX(${-frame * CELL_W}px)` }
            : { animation: `kibAnimStrip ${(L / speed).toFixed(3)}s steps(${n}) infinite` }),
        }}
      />
    </div>
  );
}

export default function AnimationsTestPage() {
  const settings = useAnimSettings();
  const master = useAnimationsLook();
  const [group, setGroup] = useState<Group>("Shots");
  const [skin, setSkin] = useState<FigureSkin>("classic");
  const [foot, setFoot] = useState<1 | -1>(1);
  const [compare, setCompare] = useState<"old" | "first">("old");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [scrub, setScrub] = useState(0.3);
  const [copied, setCopied] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteMsg, setPasteMsg] = useState("");

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  const items = useMemo(() => (group === "All" ? GALLERY : GALLERY.filter((g) => g.group === group)), [group]);
  const groups = useMemo(() => {
    const out: { name: string; keys: (keyof typeof DIAL_INFO)[] }[] = [];
    for (const k of DIAL_KEYS) {
      const g = DIAL_INFO[k].group;
      let e = out.find((o) => o.name === g);
      if (!e) { e = { name: g, keys: [] }; out.push(e); }
      e.keys.push(k);
    }
    return out;
  }, []);

  const pill = (on: boolean): React.CSSProperties => ({
    height: 30, padding: "0 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)",
    background: on ? "#facc15" : "rgba(255,255,255,0.06)", color: on ? "#111" : INK, fontWeight: 800, fontSize: 12, cursor: "pointer",
  });
  const card: React.CSSProperties = { background: CARD, borderRadius: 14, padding: 12, border: "1px solid rgba(255,255,255,0.08)" };

  const copy = async () => {
    const text = exportAnimSettings(settings);
    setCopied(text);
    try { await navigator.clipboard.writeText(text); } catch { /* the text box below still shows it */ }
  };

  return (
    <main style={{ minHeight: "100vh", background: BG, color: INK, padding: "14px 14px 90px", fontFamily: "inherit" }}>
      <style>{`@keyframes kibAnimStrip { from { transform: translateX(0) } to { transform: translateX(-100%) } }`}</style>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/star-play-dev" style={{ color: MUTED, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>‹ Play Area</Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Animations</h1>
        </div>

        {/* ── Master switch ── */}
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Animations in the game</div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>The real switch (also Settings → Look). Old = the game exactly as before.</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={pill(master === "new")} onClick={() => setAnimationsLook("new")}>New</button>
            <button style={pill(master === "old")} onClick={() => setAnimationsLook("old")}>Old</button>
          </div>
        </div>

        {/* ── Gallery controls ── */}
        <div style={{ ...card, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["Keeper", "Touches", "Shots", "Passes & headers", "Defenders", "All"] as Group[]).map((g) => (
              <button key={g} style={pill(group === g)} onClick={() => setGroup(g)}>{g}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={pill(skin === "classic")} onClick={() => setSkin("classic")}>Flat</button>
            <button style={pill(skin === "3d")} onClick={() => setSkin("3d")}>Shaded</button>
            <span style={{ width: 6 }} />
            <button style={pill(foot === 1)} onClick={() => setFoot(1)}>Right foot</button>
            <button style={pill(foot === -1)} onClick={() => setFoot(-1)}>Left foot</button>
            <span style={{ width: 6 }} />
            <button style={pill(compare === "old")} onClick={() => setCompare("old")}>vs Old game</button>
            <button style={pill(compare === "first")} onClick={() => setCompare("first")}>vs First version</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[1, 0.5, 0.25].map((s) => (
              <button key={s} style={pill(speed === s && !paused)} onClick={() => { setSpeed(s); setPaused(false); }}>{s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}</button>
            ))}
            <button style={pill(paused)} onClick={() => setPaused((p) => !p)}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
            {paused && (
              <input aria-label="Scrub" type="range" min={0} max={1} step={0.005} value={scrub}
                onChange={(e) => setScrub(Number(e.target.value))} style={{ flex: 1, minWidth: 120 }} />
            )}
          </div>
        </div>

        {/* ── The gallery ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ ...card, padding: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>{it.label}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <div>
                  <Strip item={it} version={compare} skin={skin} foot={foot} settings={settings} speed={speed} paused={paused} scrub={scrub} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: MUTED, marginTop: 3 }}>{compare === "old" ? "OLD" : "FIRST VERSION"}</div>
                </div>
                <div>
                  <Strip item={it} version="new" skin={skin} foot={foot} settings={settings} speed={speed} paused={paused} scrub={scrub} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: settings.on[it.family] ? "#facc15" : MUTED, marginTop: 3 }}>
                    {settings.on[it.family] ? "NEW" : "NEW (off → Old)"}
                  </div>
                </div>
              </div>
              {compare === "old" && <div style={{ fontSize: 10, color: MUTED, marginTop: 4, fontWeight: 600 }}>Old: {it.oldNote}</div>}
            </div>
          ))}
        </div>

        {/* ── Switches ── */}
        <div style={{ ...card, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Which animations are on</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Off = that one is drawn the Old way, here and in the game, on this phone.</div>
          {ANIM_FAMILIES.map((f) => (
            <label key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{f.label}</span>
                <span style={{ display: "block", fontSize: 10, color: MUTED, fontWeight: 600 }}>{f.note}</span>
              </span>
              <input type="checkbox" checked={settings.on[f.id]} onChange={(e) => setAnimFamily(f.id, e.target.checked)} style={{ width: 22, height: 22 }} />
            </label>
          ))}
        </div>

        {/* ── Dials ── */}
        <div id="dials" style={{ ...card, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Dials</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
            Looks only — the ball, the saves and the results never read these. Saved on this phone at once.
          </div>
          {groups.map((g) => (
            <div key={g.name} style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#facc15", textTransform: "uppercase", letterSpacing: 0.5 }}>{g.name}</div>
              {g.keys.map((k) => {
                const info = DIAL_INFO[k];
                const v = settings.dials[k];
                return (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 800 }}>{info.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {v.toFixed(2)}
                      <span style={{ color: MUTED, fontWeight: 600 }}> · default {DEFAULT_ANIM_DIALS[k]} · first {FIRST_VERSION_DIALS[k]}</span>
                    </span>
                    <input aria-label={info.label} type="range" min={info.min} max={info.max} step={info.step} value={v}
                      onChange={(e) => setAnimDial(k, Number(e.target.value))} style={{ gridColumn: "1 / -1", width: "100%" }} />
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={pill(false)} onClick={() => resetAnimSettings()}>Reset to defaults</button>
            <button style={pill(false)} onClick={() => setAnimSettings({ ...settings, dials: FIRST_VERSION_DIALS })}>First version sizes</button>
            <button style={pill(false)} onClick={copy}>Copy settings</button>
          </div>
          {copied && (
            <textarea readOnly value={copied} rows={3} onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", fontSize: 10, background: "rgba(0,0,0,0.4)", color: INK, borderRadius: 8, padding: 6 }} />
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste settings here"
              style={{ flex: 1, fontSize: 12, background: "rgba(0,0,0,0.4)", color: INK, borderRadius: 8, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.15)" }} />
            <button style={pill(false)} onClick={() => setPasteMsg(importAnimSettings(paste) ? "Applied." : "That isn't animation settings.")}>Apply</button>
          </div>
          {pasteMsg && <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>{pasteMsg}</div>}
        </div>

        {/* ── The real match ── */}
        <div style={{ ...card, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>See it in a real chance</div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>The real match reads these same dials and switches.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Link href="/star-highlights-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Infinite Highlights →</Link>
            <Link href="/star-play-dev" style={{ ...pill(false), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Play Area (Infinite Match) →</Link>
          </div>
        </div>
      </div>
      <PageGuide page="/star-animations-dev" corner="bottom-left" />
    </main>
  );
}
