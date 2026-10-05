"use client";
import { happinessOf } from "@/lib/star/relationships";
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "./RelationshipMinigame";
import { actionsLeft, WEEK_ACTIONS } from "@/lib/star/week";
import { ClubCard, PressButton, Pop, levelColors, useClubTheme } from "./ui";
import { CardTitle, DeltaBar, useSeen, seenScope } from "./screenKit";

/**
 * The older Life tab (the week, energy, Rest and five relationship bars).
 * Relations (RelationsPage.tsx) replaced it on the bottom bar; kept, and
 * reskinned 28 Sep 2026 to the home screen's look with the same moving bars
 * and pressable minigame buttons, for anything that still mounts it.
 */

interface Props {
  career: CareerState;
  onPlayRelationshipGame: (kind: RelationshipKind) => void;
  onRest: () => void;
}

export default function LifeScreen({
  career, onPlayRelationshipGame, onRest,
}: Props) {
  const left = actionsLeft(career);
  const canPlay = left > 0;
  const { glow } = useClubTheme(career);
  const scope = seenScope(career);
  return (
    <div className="mt-2 space-y-3">
      <ClubCard glow={glow} className="p-3">
        <CardTitle tone="text-emerald-300">This week</CardTitle>
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: WEEK_ACTIONS }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${i < left ? "bg-gradient-to-b from-emerald-300 to-emerald-500" : "bg-black/45"}`}
              style={i < left ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 0 8px rgba(52,211,153,.55)" } : { boxShadow: "inset 0 1px 3px rgba(0,0,0,.6)" }}
            />
          ))}
        </div>
        <div className="mt-1 text-[10px] font-bold text-white/85">
          {left > 0
            ? `${left} of ${WEEK_ACTIONS} days left. Train, work on a relationship, or rest.`
            : "The week is gone. The next match is the next week."}
        </div>
        <div className="mt-2">
          <RelationshipRow label="Energy" value={Math.round(career.energy)} icon="⚡" seenKey={`${scope}:energy`} level />
        </div>
        <div className="mt-2">
          <PressButton variant="primary" onClick={onRest} disabled={left === 0} className="w-full">
            Rest 😴
          </PressButton>
        </div>
        {left > 0 && (
          <div className="mt-1.5 text-center text-[9px] font-bold text-white/60">
            Any day{left === 1 ? "" : "s"} left unspent still count toward energy — credited automatically the moment you go and play.
          </div>
        )}
      </ClubCard>
      <ClubCard glow="#10b981" className="p-3">
        <RelationshipRow label="Boss" value={career.relationships.boss} icon="💼" seenKey={`${scope}:rel:boss`} onIconClick={canPlay ? () => onPlayRelationshipGame("boss") : undefined} />
        <RelationshipRow label="Team" value={career.relationships.team} icon="👕" seenKey={`${scope}:rel:team`} onIconClick={canPlay ? () => onPlayRelationshipGame("team") : undefined} />
        <RelationshipRow label="Fans" value={career.relationships.fans} icon="🧣" seenKey={`${scope}:rel:fans`} onIconClick={canPlay ? () => onPlayRelationshipGame("fans") : undefined} />
        <RelationshipRow label="Sponsors" value={career.relationships.sponsors} icon="🤝" seenKey={`${scope}:rel:sponsors`} onIconClick={canPlay ? () => onPlayRelationshipGame("sponsors") : undefined} />
        <RelationshipRow label="Happiness" value={happinessOf(career)} icon="😊" seenKey={`${scope}:rel:happiness`} onIconClick={canPlay ? () => onPlayRelationshipGame("happiness") : undefined} />
        <div className="mt-1 text-center text-[9px] font-bold text-emerald-300">
          Tap an emoji to play a minigame and raise it (costs a day)
        </div>
      </ClubCard>
    </div>
  );
}

function RelationshipRow({ label, value, icon, seenKey, level = false, onIconClick }: {
  label: string; value: number; icon: string; seenKey: string; level?: boolean; onIconClick?: () => void;
}) {
  const v = Math.round(value);
  const seen = useSeen(seenKey, v);
  // Same lines as always: green 70+, yellow 40+, red under.
  const colors: [string, string] = level ? levelColors(seen.shown)
    : seen.shown >= 70 ? ["#10b981", "#6ee7b7"] : seen.shown >= 40 ? ["#eab308", "#fde047"] : ["#ef4444", "#fda4af"];
  return (
    <div className="mb-2.5 flex items-center gap-2 last:mb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-black text-white">{label}</span>
          <span className="text-[12px] font-black tabular-nums text-white"><Pop value={seen.shown}>{seen.shown}</Pop></span>
        </div>
        <DeltaBar seen={seen} colors={colors} className="mt-1 h-3" />
      </div>
      <PressButton
        variant={onIconClick ? "accent" : "plain"}
        accent={colors[0]}
        onClick={onIconClick}
        disabled={!onIconClick}
        aria-label={onIconClick ? `Play the ${label} minigame` : label}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${onIconClick ? "" : "cursor-default bg-white/10 opacity-60"}`}
      >
        {icon}
      </PressButton>
    </div>
  );
}
