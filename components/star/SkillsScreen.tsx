"use client";
import type { CareerState, Skills } from "@/lib/star/types";
import { setPieceDuties } from "@/lib/star/setPieces";
import { starsOf, totalStars } from "@/lib/star/trainingLevels";
import { actionsLeft, WEEK_ACTIONS } from "@/lib/star/week";
import { getTuning } from "@/lib/star/tuningStore";
import { ClubCard, Glow, Pop, Shine, Shake, Burst, FloatText, rgba, tint, useClubTheme } from "./ui";
import { CardTitle, DeltaBar, useSeen, seenScope } from "./screenKit";

/**
 * TRAINING — one card per skill.
 *
 * Reskinned 28 Sep 2026 to the home screen's look (Harry: "that can
 * animation is elite, we need stuff like that all over"). Each skill is a
 * card in its own colour with a glossy bar. Training happens on another
 * screen, so when you come back with a skill that went up, its card plays
 * the can's reward: the bar glides up with a shine, "+1" floats off the end
 * of it with a few sparks, the number pops and a sweep crosses the card. The
 * stars do the same ("+★2") when a level earned stars but not yet a point.
 * Every number that was here still is (Harry: never hide numbers).
 */

interface Props {
  career: CareerState;
  onTrain: (skill: keyof Skills) => void;
}

const SKILL_LABELS: [keyof Skills, string, string, string][] = [
  ["pace", "Pace", "⚡", "Faster dribbles, more runs into space, quicker Touch Mode chase"],
  ["power", "Power", "💪", "Long shots and stronger crosses"],
  ["technique", "Technique", "🎯", "Ball control, curl, precise strikes"],
  ["vision", "Vision", "👁️", "More team-mates to pass to in every chance"],
  ["freeKick", "Free Kick", "🎪", "Free kicks, corners and penalties — and how many are yours"],
];

/** Each skill's own colour: the bar, the card's wash, the reward. */
const SKILL_COLOR: Record<keyof Skills, [string, string]> = {
  pace: ["#facc15", "#fef08a"],
  power: ["#f97316", "#fdba74"],
  technique: ["#38bdf8", "#a5f3fc"],
  vision: ["#a78bfa", "#ddd6fe"],
  freeKick: ["#f472b6", "#fbcfe8"],
};

const ENERGY_COST = getTuning("energy.trainingCost");


export default function SkillsScreen({ career, onTrain }: Props) {
  const duties = setPieceDuties(career);
  const left = actionsLeft(career);
  const { glow } = useClubTheme(career);
  const scope = seenScope(career);
  return (
    <div className="mt-2 space-y-2">
      <ClubCard glow={glow} className="relative overflow-hidden p-3 text-center">
        <CardTitle tone="text-emerald-300">Training</CardTitle>
        <div className="mt-0.5 text-sm font-bold text-white">Each level costs a day and {ENERGY_COST} energy. 3 tries, up to ★★★.</div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {Array.from({ length: WEEK_ACTIONS }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-9 rounded-full ${i < left ? "bg-gradient-to-b from-emerald-300 to-emerald-500" : "bg-black/45"}`}
              style={i < left ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 0 10px rgba(52,211,153,.6)" } : { boxShadow: "inset 0 1px 3px rgba(0,0,0,.6)" }}
            />
          ))}
        </div>
        <div className="mt-1 text-[10.5px] font-bold text-emerald-100/85">
          <Pop value={left}>{left > 0 ? `${left} of ${WEEK_ACTIONS} days left this week` : "No days left — the next match is the next week"}</Pop>
        </div>
      </ClubCard>

      {/* What the free-kick rating actually buys. It was trainable, had an
          achievement and was read by no code at all. */}
      <ClubCard glow="#f59e0b" className="p-3">
        <CardTitle tone="text-amber-300">🎪 Set-piece duty</CardTitle>
        <div className="mt-1 text-[11.5px] font-bold text-white">
          {duties.freeKicks && duties.penalties
            ? "You take the free kicks and the penalties."
            : duties.penalties
              ? `Penalties are yours. Free kicks need a Free Kick rating of ${duties.freeKickNeeded}.`
              : `${career.player.club} have better takers. Penalties need ${duties.penaltyNeeded}, free kicks ${duties.freeKickNeeded}.`}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-black">
          <span className={`rounded-full px-2 py-0.5 ${duties.penalties ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-black/35 text-white ring-1 ring-white/10"}`}>
            Penalties {duties.penalties ? "✓ yours" : `need ${duties.penaltyNeeded}`}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${duties.freeKicks ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-black/35 text-white ring-1 ring-white/10"}`}>
            Free kicks {duties.freeKicks ? "✓ yours" : `need ${duties.freeKickNeeded}`}
          </span>
        </div>
        <div className="mt-1.5 text-[10px] font-bold text-white/70">
          Judged against your club — a move up the league can cost you the ball.
        </div>
      </ClubCard>

      {SKILL_LABELS.map(([key, label, icon, desc]) => (
        <SkillCard
          key={key}
          skill={key}
          label={label}
          icon={icon}
          desc={desc}
          value={career.skills[key]}
          stars={totalStars(starsOf(career, key))}
          canTrain={career.energy >= ENERGY_COST && career.skills[key] < 100 && left > 0}
          onTrain={() => onTrain(key)}
          scope={scope}
        />
      ))}
    </div>
  );
}

function SkillCard({ skill, label, icon, desc, value, stars, canTrain, onTrain, scope }: {
  skill: keyof Skills; label: string; icon: string; desc: string;
  value: number; stars: number; canTrain: boolean; onTrain: () => void; scope: string;
}) {
  const [c1, c2] = SKILL_COLOR[skill];
  // Both remembered between visits: training happens on another screen.
  const val = useSeen(`${scope}:skill:${skill}`, value);
  const star = useSeen(`${scope}:stars:${skill}`, stars);
  const rose = val.delta > 0 && val.trigger > 0;
  const starsRose = star.delta > 0 && star.trigger > 0;
  // One reward per visit: a point if the skill rose, else the stars.
  const reward = rose ? val.trigger : starsRose ? star.trigger : 0;
  return (
    <button
      disabled={!canTrain}
      onClick={onTrain}
      className="kib-press relative block w-full overflow-hidden rounded-2xl p-3 text-left disabled:opacity-60"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${rgba(c1, canTrain ? 0.3 : 0.14)} 0%, transparent 55%), linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(c1, canTrain ? 0.32 : 0.14)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
      }}
    >
      {reward > 0 && <Shine trigger={reward} />}
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center">
          <Glow color={c1} alpha={canTrain ? 0.45 : 0.2} className="inset-0.5 blur-md" />
          <Shake trigger={reward} className="relative">
          <span
            className="relative grid h-11 w-11 place-items-center rounded-xl text-[22px]"
            style={{ background: `linear-gradient(180deg, ${rgba(c1, 0.35)}, ${rgba(tint(c1, -0.4), 0.35)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px ${rgba(c1, 0.5)}` }}
          >
            {icon}
          </span>
          </Shake>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-black leading-tight text-white">{label}</div>
          <div className="text-[10.5px] font-bold leading-snug text-white/70">{desc}</div>
        </div>
        <div className="relative shrink-0 text-center">
          <div className="text-[24px] font-black leading-none tabular-nums" style={{ color: c2, textShadow: `0 0 12px ${rgba(c1, 0.7)}` }}>
            <Pop value={val.shown}>{val.shown}</Pop>
          </div>
          <div className="mt-0.5 text-[10px] font-black tabular-nums text-amber-300">
            ★ <Pop value={star.shown}>{star.shown}</Pop>/90
          </div>
          {!rose && starsRose && (
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <Burst trigger={star.trigger} colors={["#fde047", "#ffffff", c1]} count={12} spread={0.4} round className="left-1/2 top-4" />
              <FloatText trigger={star.trigger} text={`+★${star.delta}`} color="#fde047" size={17} className="left-1/2 -top-4" style={{ color: "#fff", textShadow: "0 0 10px #facc15, 0 2px 4px rgba(0,0,0,.8)" }} />
            </div>
          )}
        </div>
      </div>
      {/* The skill out of 100: glides up on a gain, the can's juice on top. */}
      <div className="mt-2.5">
        <DeltaBar seen={val} colors={[c1, c2]} className="h-3" label={label.toUpperCase()} />
      </div>
    </button>
  );
}

export { ENERGY_COST as TRAINING_ENERGY_COST };
