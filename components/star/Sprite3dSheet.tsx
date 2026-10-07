"use client";

/**
 * THE NEW 3D CLIPS, FRAME BY FRAME — for /star-animations-dev.
 *
 * Every Animations: New clip in the second sprite atlas (lib/star/sprites.ts,
 * baked by tools/sprites/new/), each frame laid side by side at one facing,
 * next to the old clip the match showed for that moment before. Plain DOM
 * cells off the tinted atlas, like /star-sprites-dev: nothing animates here
 * and no football is played.
 */
import { useEffect, useState } from "react";
import {
  spriteCell, spriteAtlasUrl, spriteClipReady, spriteClipFps, spriteClipFrames,
  NEW_PLAYER_CLIPS, NEW_KEEPER_CLIPS,
  type SpriteChar, type SpriteClip, type SpriteKit,
} from "@/lib/star/sprites";

const MUTED = "#8a97aa";
const KIT: SpriteKit = { shirt: "#c8102e", shorts: "#ffffff", socks: "#c8102e" };
const GK_KIT: SpriteKit = { shirt: "#16a34a", shorts: "#14532d", socks: "#16a34a" };
const H = 46; // a standing man's height on this sheet, px

const LABEL: Record<string, string> = {
  touch: "Touch / trap", passKick: "Pass", shotKick: "Driven shot", volley: "Volley", chipKick: "Chip",
  header: "Jump header", block: "Block", clearance: "Clearance",
  oneHandR: "One-hand top corner (R)", oneHandL: "One-hand top corner (L)", lowDiveR: "Low dive (R)", lowDiveL: "Low dive (L)",
  parryR: "Parry (R)", parryL: "Parry (L)", catchHold: "Catch, held to chest", fumble: "Fumble / spill", getUpR: "Get up (R)", getUpL: "Get up (L)",
};
/** What the match drew for that moment before (Animations: Old, or no 3D twin yet). */
const OLD_OF: Record<string, SpriteClip> = {
  touch: "idle", passKick: "kick", shotKick: "kick", volley: "kick", chipKick: "kick", header: "idle", block: "kick", clearance: "kick",
  oneHandR: "diveR", oneHandL: "diveL", lowDiveR: "diveR", lowDiveL: "diveL", parryR: "diveR", parryL: "diveL",
  catchHold: "ready", fumble: "ready", getUpR: "ready", getUpL: "ready",
};

function Cell({ char, clip, t, facing, kit }: { char: SpriteChar; clip: SpriteClip; t: number; facing: number; kit: SpriteKit }) {
  const cell = spriteCell(char, clip, t, facing, H);
  const url = cell ? spriteAtlasUrl(kit, cell.atlas) : null;
  const box = { width: 74, height: 84, position: "relative" as const, flex: "0 0 auto", background: "#2f7a33", borderRadius: 6, overflow: "hidden" };
  if (!cell || !url) return <div style={box} />;
  const s = cell.scale;
  const x = 37, y = 64;
  return (
    <div style={box}>
      <div
        style={{
          position: "absolute",
          left: x - cell.ax * s, top: y - cell.ay * s,
          width: cell.sw * s, height: cell.sh * s,
          backgroundImage: `url(${url})`,
          backgroundPosition: `${-cell.sx * s}px ${-cell.sy * s}px`,
          backgroundSize: `${cell.atlasW * s}px ${cell.atlasH * s}px`,
          transform: cell.mirror ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}

/** Every frame of a clip at one facing (time picked to land mid-frame). */
function Frames({ char, clip, facing, kit, max }: { char: SpriteChar; clip: SpriteClip; facing: number; kit: SpriteKit; max?: number }) {
  const n = Math.min(max ?? 99, spriteClipFrames(char, clip));
  const fps = spriteClipFps(char, clip) || 1;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {Array.from({ length: n }, (_, i) => <Cell key={i} char={char} clip={clip} t={(i + 0.5) / fps} facing={facing} kit={kit} />)}
    </div>
  );
}

const FACINGS = [
  { label: "→", a: 0 }, { label: "↘", a: Math.PI / 4 }, { label: "↓", a: Math.PI / 2 }, { label: "↙", a: (3 * Math.PI) / 4 },
  { label: "←", a: Math.PI }, { label: "↖", a: (5 * Math.PI) / 4 }, { label: "↑", a: (3 * Math.PI) / 2 }, { label: "↗", a: (7 * Math.PI) / 4 },
];

export default function Sprite3dSheet({ pill, card }: { pill: (on: boolean) => React.CSSProperties; card: React.CSSProperties }) {
  const [facing, setFacing] = useState(Math.PI / 2);
  const [, setTick] = useState(0);
  // Wait for both atlases and their tinted pictures (a few frames), then stop.
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const poll = () => {
      if (!alive) return;
      const ready = spriteClipReady("player", "touch") && spriteClipReady("keeper", "oneHandR")
        && !!spriteAtlasUrl(KIT, 1) && !!spriteAtlasUrl(GK_KIT, 1) && !!spriteAtlasUrl(KIT, 0) && !!spriteAtlasUrl(GK_KIT, 0);
      setTick((t) => t + 1);
      if (!ready && tries++ < 80) setTimeout(poll, 150);
    };
    poll();
    return () => { alive = false; };
  }, []);

  const rows: { char: SpriteChar; clip: SpriteClip; kit: SpriteKit }[] = [
    ...NEW_PLAYER_CLIPS.map((c) => ({ char: "player" as const, clip: c as SpriteClip, kit: KIT })),
    ...NEW_KEEPER_CLIPS.map((c) => ({ char: "keeper" as const, clip: c as SpriteClip, kit: GK_KIT })),
  ];
  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 14 }}>3D figures (Settings → Look → Players: 3D)</div>
        <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
          The New clips for the 3D players, every frame, next to what the match showed before. Keepers have 4 facings, so they use the nearest.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FACINGS.map((f) => <button key={f.label} style={pill(Math.abs(facing - f.a) < 1e-6)} onClick={() => setFacing(f.a)}>{f.label}</button>)}
      </div>
      {rows.map((r) => (
        <div key={r.clip} style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>{LABEL[r.clip] ?? r.clip}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#facc15" }}>NEW</div>
          <Frames char={r.char} clip={r.clip} facing={facing} kit={r.kit} />
          <div style={{ fontSize: 10, fontWeight: 800, color: MUTED }}>OLD ({OLD_OF[r.clip]})</div>
          <Frames char={r.char} clip={OLD_OF[r.clip]} facing={facing} kit={r.kit} max={6} />
        </div>
      ))}
    </div>
  );
}
