"use client";
/**
 * SETTINGS → YOUR LOOK (Harry, 9 Oct 2026: "I like all 3 but is there no
 * customization?"). Your 3D player in Style A: one of the three bodies, your
 * skin tone and your hair colour. Saved on the career (player.body3d,
 * skinTone, hairColour); every 3D scene reads it (lib/star/style3d/toon).
 *
 * Heads and hair styles: each body is one piece (head and hair modelled
 * with it), so the hair's COLOUR changes but not its cut.
 */
import type { StarPlayer } from "@/lib/star/types";
import { SKIN_TONES, HAIR_COLOURS, resolveSkinTone, type SkinTone, type HairColour } from "@/lib/star/playerIdentity";
import { TOON_BODIES, TOON_BODY_LABEL, resolveToonBody, type ToonBody } from "@/lib/star/style3d/toon/bodies";

export interface YourLook { body3d?: ToonBody; skinTone?: SkinTone; hairColour?: HairColour }

export default function YourLookPanel({ player, onChange }: { player: StarPlayer; onChange: (look: YourLook) => void }) {
  const body = resolveToonBody(player.body3d);
  const skin = resolveSkinTone(player.skinTone);
  const hair = player.hairColour ?? "brown";
  return (
    <div className="mt-2 space-y-3" data-your-look>
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/70">Body</div>
        <div className="grid grid-cols-3 gap-2">
          {TOON_BODIES.map((b) => (
            <button
              key={b}
              type="button"
              data-body={b}
              onClick={() => onChange({ body3d: b })}
              className={`flex flex-col items-center rounded-xl border-2 p-1 ${b === body ? "border-white bg-white/15" : "border-white/15 bg-black/20"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/star/people3d/toon-${b}.webp`} alt="" className="h-24 w-auto object-contain" />
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
        <div className="mt-1 text-[10px] font-bold text-white/60">Each body&apos;s haircut is part of it: the colour changes, the cut stays.</div>
      </div>
    </div>
  );
}
