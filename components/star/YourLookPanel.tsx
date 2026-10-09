"use client";
/**
 * SETTINGS → YOUR LOOK (Harry, 9 Oct 2026: "I like all 3 but is there no
 * customization?"). Your 3D player in Style A: a head (face and haircut), a
 * build, your skin tone and your hair colour. Saved on the career
 * (player.head3d, body3d, skinTone, hairColour); every 3D scene reads it
 * (lib/star/style3d/toon).
 *
 * Each head is one generated piece (face and haircut modelled together), so
 * the hair's COLOUR changes but its cut comes with the head.
 */
import type { StarPlayer } from "@/lib/star/types";
import { SKIN_TONES, HAIR_COLOURS, resolveSkinTone, type SkinTone, type HairColour } from "@/lib/star/playerIdentity";
import {
  TOON_BODIES, TOON_BODY_LABEL, TOON_PLAYER_HEADS, TOON_HEAD_LABEL, yourToonBody, yourToonHead, toonHeadPicture,
  type ToonBody, type ToonHead,
} from "@/lib/star/style3d/toon/bodies";

export interface YourLook { body3d?: ToonBody; head3d?: ToonHead; skinTone?: SkinTone; hairColour?: HairColour }

/** A simple outline of each build (no picture needed: it's a scale). */
const BUILD_W: Record<ToonBody, number> = { c1: 14, c2: 20, c3: 16 };
const BUILD_H: Record<ToonBody, number> = { c1: 40, c2: 40, c3: 46 };

export default function YourLookPanel({ player, onChange }: { player: StarPlayer; onChange: (look: YourLook) => void }) {
  const body = yourToonBody(player);
  const head = yourToonHead(player);
  const skin = resolveSkinTone(player.skinTone);
  const hair = player.hairColour ?? "brown";
  return (
    <div className="mt-2 space-y-3" data-your-look>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Head</div>
        <div className="grid grid-cols-3 gap-2">
          {TOON_PLAYER_HEADS.map((h) => (
            <button
              key={h}
              type="button"
              data-head={h}
              onClick={() => onChange({ head3d: h })}
              className={`flex flex-col items-center rounded-xl border-2 p-1 ${h === head ? "border-white bg-white/15" : "border-white/15 bg-black/20"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toonHeadPicture(h)} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <span className="mt-1 text-[11px] font-black text-white">{TOON_HEAD_LABEL[h]}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Build</div>
        <div className="grid grid-cols-3 gap-2">
          {TOON_BODIES.map((b) => (
            <button
              key={b}
              type="button"
              data-body={b}
              onClick={() => onChange({ body3d: b })}
              className={`flex flex-col items-center rounded-xl border-2 p-2 ${b === body ? "border-white bg-white/15" : "border-white/15 bg-black/20"}`}
            >
              <svg width="40" height="50" viewBox="0 0 40 50" aria-hidden>
                <circle cx="20" cy={50 - BUILD_H[b] + 4} r="4" fill="white" />
                <rect x={20 - BUILD_W[b] / 2} y={50 - BUILD_H[b] + 10} width={BUILD_W[b]} height={BUILD_H[b] - 10} rx="4" fill="white" opacity="0.85" />
              </svg>
              <span className="mt-1 text-[11px] font-black text-white">{TOON_BODY_LABEL[b]}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Skin</div>
        <div className="flex flex-wrap gap-2">
          {SKIN_TONES.map((t) => (
            <button key={t.id} type="button" aria-label={t.label} data-skin={t.id} onClick={() => onChange({ skinTone: t.id })}
              className={`h-8 w-8 rounded-full border-2 ${t.id === skin ? "border-white" : "border-white/20"}`} style={{ background: t.hex }} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Hair colour</div>
        <div className="flex flex-wrap gap-2">
          {HAIR_COLOURS.map((h) => (
            <button key={h.id} type="button" data-hair={h.id} onClick={() => onChange({ hairColour: h.id })}
              className={`flex items-center gap-1 rounded-full border-2 px-2 py-1 text-[11px] font-bold text-white ${h.id === hair ? "border-white bg-white/15" : "border-white/20"}`}>
              <span className="inline-block h-4 w-4 rounded-full" style={{ background: h.hex }} />{h.label}
            </button>
          ))}
        </div>
        <div className="mt-1 text-[10px] font-bold text-white/60">The haircut comes with the head: the colour changes, the cut stays.</div>
      </div>
    </div>
  );
}
