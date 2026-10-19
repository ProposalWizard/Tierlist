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
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./animations.css";
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
import { FIGURE_HEIGHT_R } from "@/lib/star/fiveASide/render";
import type { FigureSkin } from "@/lib/star/figureSkin";
import Sprite3dSheet from "@/components/star/Sprite3dSheet";
import FeelPreview from "@/components/star/FeelPreview";

const CELL_W = 84, CELL_H = 120, FPS = 24;

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


const GROUP_TABS: Group[] = ["Keeper", "Touches", "Shots", "Passes & headers", "Defenders", "All"];
const JUMPS: [string, string][] = [
  ["#feel", "Match feel"], ["#figures3d", "3D figures"], ["#switches", "Which are on"], ["#dials", "Dials"], ["#real", "Real chance"],
];

/** The Broadcast pill, for the two shared cards that take a style (FeelPreview, Sprite3dSheet). */
const pill = (on: boolean): React.CSSProperties => ({
  padding: "6px 12px", borderRadius: 3, border: "1px solid var(--bc-line)", whiteSpace: "nowrap",
  background: on ? "var(--bc-accent)" : "rgba(255,255,255,0.04)", color: on ? "#fff" : "var(--bc-ink2)",
  fontWeight: 800, fontSize: 12.5, cursor: "pointer",
});
const card: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(14,40,98,0.78), rgba(6,20,54,0.82))", border: "1px solid var(--bc-line)",
  borderTop: "2px solid rgba(90,160,255,0.55)", borderRadius: 4, padding: 14, boxShadow: "0 12px 34px rgba(0,4,20,0.5)", minWidth: 0,
};

function SecTitle({ children }: { children: React.ReactNode }) {
  return <div className="anim-sec"><h2>{children}</h2><i /><i /><i /></div>;
}

export default function AnimationsTestPage() {
  const settings = useAnimSettings();
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
  // "All" shows each group under its own title, as in the picked picture.
  const sections = useMemo(() => {
    const names: string[] = group === "All" ? [...GALLERY_GROUPS] : [group];
    return names.map((n) => ({ name: n, list: items.filter((it) => it.group === n) })).filter((s) => s.list.length);
  }, [group, items]);
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

  const copy = async () => {
    const text = exportAnimSettings(settings);
    setCopied(text);
    try { await navigator.clipboard.writeText(text); } catch { /* the text box below still shows it */ }
  };
  const pickGroup = (g: Group) => {
    setGroup(g);
    document.getElementById("gallery")?.scrollIntoView({ block: "start" });
  };

  return (
    <BroadcastPage title="2D Animations" sub="Every New animation next to the Old game, with the dials that size them" back="/star-play-dev">
      <style>{`@keyframes kibAnimStrip { from { transform: translateX(0) } to { transform: translateX(-100%) } }`}</style>
      <div className="anim-layout">
        {/* ── Sections ── */}
        <nav className="anim-rail" aria-label="Sections">
          <div className="anim-rail-label">Animations</div>
          {GROUP_TABS.map((g) => (
            <button key={g} className="anim-railitem" aria-pressed={group === g} onClick={() => pickGroup(g)}>{g}</button>
          ))}
          <div className="anim-rail-label">On this page</div>
          {JUMPS.map(([href, label]) => <a key={href} className="anim-railitem" href={href}>{label}</a>)}
        </nav>

        <div className="anim-main">
          {/* ── The player bar ── */}
          <div className="anim-bar" id="gallery">
            <button className="anim-play" aria-pressed={paused} onClick={() => setPaused((p) => !p)} title={paused ? "Play" : "Pause"}
              aria-label={paused ? "Play" : "Pause"}>{paused ? "▶" : "❚❚"}</button>
            <input className="anim-track" aria-label="Scrub" type="range" min={0} max={1} step={0.005} value={scrub}
              onChange={(e) => { setScrub(Number(e.target.value)); setPaused(true); }} />
            <div className="anim-row">
              {[1, 0.5, 0.25].map((s) => (
                <Pill key={s} on={speed === s && !paused} onClick={() => { setSpeed(s); setPaused(false); }}>{s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}</Pill>
              ))}
            </div>
          </div>
          <div className="anim-bar">
            <div className="anim-row">
              <Label>Look</Label>
              <Pill on={skin === "classic"} onClick={() => setSkin("classic")}>Flat</Pill>
              <Pill on={skin === "3d"} onClick={() => setSkin("3d")}>Shaded</Pill>
            </div>
            <span className="anim-sep" />
            <div className="anim-row">
              <Label>Foot</Label>
              <Pill on={foot === 1} onClick={() => setFoot(1)}>Right foot</Pill>
              <Pill on={foot === -1} onClick={() => setFoot(-1)}>Left foot</Pill>
            </div>
            <span className="anim-sep" />
            <div className="anim-row">
              <Label>Left picture</Label>
              <Pill on={compare === "old"} onClick={() => setCompare("old")}>vs Old game</Pill>
              <Pill on={compare === "first"} onClick={() => setCompare("first")}>vs First version</Pill>
            </div>
          </div>

          {/* ── The gallery ── */}
          {sections.map((sec) => (
            <section key={sec.name}>
              <SecTitle>{sec.name}</SecTitle>
              <div className="anim-cards">
                {sec.list.map((it) => (
                  <div key={it.id} className="anim-card">
                    <div className="anim-ct">{it.label}</div>
                    <div className="anim-pics">
                      <div className="anim-pic">
                        <div className="anim-scale">
                          <Strip item={it} version={compare} skin={skin} foot={foot} settings={settings} speed={speed} paused={paused} scrub={scrub} />
                        </div>
                        <span className="anim-tag">{compare === "old" ? "Old" : "First version"}</span>
                      </div>
                      <div className="anim-pic">
                        <div className="anim-scale">
                          <Strip item={it} version="new" skin={skin} foot={foot} settings={settings} speed={speed} paused={paused} scrub={scrub} />
                        </div>
                        <span className="anim-tag" data-new={settings.on[it.family] ? "true" : "off"}>
                          {settings.on[it.family] ? "New" : "New (off → Old)"}
                        </span>
                      </div>
                    </div>
                    {compare === "old" && <div className="anim-cf">Old: {it.oldNote}</div>}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* ── Match feel (lib/star/matchFeel.ts) ── */}
          <section>
            <SecTitle>Match feel</SecTitle>
            <FeelPreview pill={pill} card={card} />
          </section>

          {/* ── The 3D figures' New clips ── */}
          <section id="figures3d">
            <SecTitle>3D figures</SecTitle>
            <Sprite3dSheet pill={pill} card={card} />
          </section>

          {/* ── Switches ── */}
          <section id="switches">
            <SecTitle>Which are on</SecTitle>
            <Panel title="Which animations are on" note="Off = drawn the Old way, here and in the game, on this phone">
              {ANIM_FAMILIES.map((f) => (
                <label key={f.id} className="anim-switch">
                  <span><b>{f.label}</b><span>{f.note}</span></span>
                  <input type="checkbox" checked={settings.on[f.id]} onChange={(e) => setAnimFamily(f.id, e.target.checked)} />
                </label>
              ))}
            </Panel>
          </section>

          {/* ── Dials ── */}
          <section id="dials">
            <SecTitle>Dials</SecTitle>
            <Panel title="Dials" note="Looks only. Saved on this phone at once">
              <Note>The ball, the saves and the results never read these.</Note>
              {groups.map((g) => (
                <div key={g.name} style={{ display: "grid", gap: 8 }}>
                  <div className="anim-dialgroup">{g.name}</div>
                  {g.keys.map((k) => {
                    const info = DIAL_INFO[k];
                    const v = settings.dials[k];
                    return (
                      <div key={k} className="anim-dial">
                        <b>{info.label}</b>
                        <em>{v.toFixed(2)}<small> · default {DEFAULT_ANIM_DIALS[k]} · first {FIRST_VERSION_DIALS[k]}</small></em>
                        <input aria-label={info.label} type="range" min={info.min} max={info.max} step={info.step} value={v}
                          onChange={(e) => setAnimDial(k, Number(e.target.value))} />
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="anim-row">
                <Btn onClick={() => resetAnimSettings()}>Reset to defaults</Btn>
                <Btn onClick={() => setAnimSettings({ ...settings, dials: FIRST_VERSION_DIALS })}>First version sizes</Btn>
                <Btn main onClick={copy}>Copy settings</Btn>
              </div>
              {copied && (
                <textarea className="anim-text" readOnly value={copied} rows={3} onFocus={(e) => e.currentTarget.select()} />
              )}
              <div className="anim-row" style={{ flexWrap: "nowrap" }}>
                <input className="anim-text" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste settings here" style={{ flex: 1, minWidth: 0 }} />
                <Btn onClick={() => setPasteMsg(importAnimSettings(paste) ? "Applied." : "That isn't animation settings.")}>Apply</Btn>
              </div>
              {pasteMsg && <Note>{pasteMsg}</Note>}
            </Panel>
          </section>

          {/* ── The real match ── */}
          <section id="real">
            <SecTitle>Real chance</SecTitle>
            <Panel title="See it in a real chance" note="The real match reads these same dials and switches">
              <div className="anim-row">
                <Btn href="/star-highlights-dev">Infinite Highlights →</Btn>
                <Btn href="/star-play-dev">Play Area (Infinite Match) →</Btn>
              </div>
            </Panel>
          </section>
        </div>
      </div>
      <PageGuide page="/star-animations-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
