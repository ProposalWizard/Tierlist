"use client";
import { attributeOverall } from "@/lib/star/rating";
import TrophyImage from "@/components/star/TrophyImage";
import { fameOf, fameLevel, nextFameLevel, FAME_LEVELS } from "@/lib/star/fame";
import { reputationLabel, REPUTATION_RECOMMEND_MIN, REPUTATION_PROPOSE_RULES_MIN, REPUTATION_PRESIDENCY_MIN } from "@/lib/star/reputation";
import { useState } from "react";
import { objectiveLabel, sponsorEligible, sponsorFee, sponsorRequirementText } from "@/lib/star/sponsors";
import { clauseSummary, offerClauses } from "@/lib/star/contracts";
import { willingToRenegotiate } from "@/lib/star/careerFlow";
import { mulberry32 } from "@/lib/star/season";
import type { CareerState, Trophy } from "@/lib/star/types";
import { ACHIEVEMENTS } from "@/lib/star/achievements";
import { RECORDS, recordBeaten } from "@/lib/star/records";
import { formatMoney } from "@/lib/star/money";
import { Burst, CountUp, FloatText, PressButton, Shine, StatBar, clubTheme, useTrigger } from "@/components/star/legacy/ui";
import { Screen, ScreenHeader, Rays, useLater } from "@/components/star/legacy/ui/Screen";
import { prefersReducedMotion } from "@/components/star/legacy/ui/motion";

// ---------- SPONSORS ----------
function ObjectiveRow({ deal }: { deal: import("@/lib/star/types").SponsorDeal }) {
  const o = deal.objective;
  if (!o) return null;
  const pct = Math.min(100, Math.round((o.progress / Math.max(1, o.target)) * 100));
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className={o.done ? "text-emerald-300" : "text-white"}>
          {objectiveLabel(o)}{o.done ? " ✓" : ""}
        </span>
        <span className="text-amber-300">★{formatMoney(o.bonus)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full ${o.done ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <div className="mt-0.5 text-[9px] text-white/85">
        {o.kind === "rating" ? (o.progress / 10).toFixed(1) : o.progress} / {o.kind === "rating" ? (o.target / 10).toFixed(1) : o.target}
        {" · "}{o.seasonsLeft} season{o.seasonsLeft === 1 ? "" : "s"} left
      </div>
    </div>
  );
}

export function SponsorsScreen({ career, onBack, onSign }: {
  career: CareerState; onBack: () => void; onSign: (category: string) => void;
}) {
  const total = career.sponsors.reduce((s, sp) => s + (sp.active ? sponsorFee(sp.category, career) : 0), 0);
  const theme = clubTheme(career.player.club, career);
  return (
    <Screen glow={theme.glow}>
      <div className="w-full flex-1">
        <ScreenHeader
          title="Sponsors"
          kicker="Your deals"
          onBack={onBack}
          right={<div className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black text-amber-300 ring-1 ring-amber-300/30">★ {fameOf(career)} fame · {fameLevel(fameOf(career)).name}</div>}
        />

        <div className="kit-card overflow-hidden">
          {career.sponsors.map((sp, i) => {
            const eligible = !sp.active && sponsorEligible(sp.category, career);
            return (
              <div key={sp.category} className={`kit-rise py-2.5 px-3 border-b border-white/[0.06] ${sp.active ? "bg-amber-400/[0.06]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="font-black text-white text-sm truncate">{sp.category}</span>
                    {/* Level 1 is the original, un-upgraded deal — not worth a
                        badge. Only shown once an objective has actually
                        raised it, so it reads as "you did this," not as
                        a difficulty label on every deal from day one. */}
                    {(sp.level ?? 1) > 1 && (
                      <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                        Lv.{sp.level}
                      </span>
                    )}
                  </div>
                  {sp.active ? (
                    <div className="flex items-center gap-1 font-black text-yellow-300 text-sm">
                      <StarIcon />{formatMoney(sponsorFee(sp.category, career))}
                      <span className="ml-0.5 text-[9px] font-bold text-white/60">/season</span>
                    </div>
                  ) : eligible ? (
                    <button
                      onClick={() => onSign(sp.category)}
                      className="kit-btn kit-btn-green rounded-lg px-3 py-1 text-[10px]"
                    >
                      Sign — ★{formatMoney(sponsorFee(sp.category, career))}
                    </button>
                  ) : (
                    <div className="text-[10px] text-white/85 uppercase font-black">Locked</div>
                  )}
                </div>
                {!sp.active && (
                  <div className="mt-1 text-[10px] font-semibold text-white">{sponsorRequirementText(sp.category)}</div>
                )}
                {sp.active && (
                  <div className="mt-1 text-[10px] font-bold text-white">
                    {typeof sp.termLeft === "number"
                      ? `Deal ends after ${sp.termLeft === 1 ? "this season" : `${sp.termLeft} seasons`} — then re-earn it`
                      : "Deal ends after this season — then re-earn it"}
                  </div>
                )}
                <ObjectiveRow deal={sp} />
              </div>
            );
          })}
          <div className="relative m-2 flex items-center overflow-hidden rounded-xl px-3 py-2.5" style={{ background: "linear-gradient(180deg,#34d399,#059669 60%,#065f46)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
            <Shine trigger={1} />
            <div className="font-black text-white text-sm flex-1">Total Per Season</div>
            <div className="flex items-center gap-1 font-black text-white text-sm">
              <StarIcon />{formatMoney(total)}
            </div>
          </div>
        </div>

        <div className="kit-card mt-3 p-3 text-[10px] text-white/80 text-center leading-tight">
          Every brand wants a fame level — plus something that fits them: goals for
          your boot deal, fans for clothing, a trophy for tech, a car or a home of
          your own for the luxury brands. Deals last one season (two for Watch,
          Jewellery and Car), then you have to earn them again. Hit a deal&rsquo;s
          objective and it upgrades, paying more from then on.
        </div>
      </div>
    </Screen>
  );
}

// ---------- ACHIEVEMENTS ----------
//
// Two tabs sharing one screen: Achievements is "did you ever do this at all"
// (a fixed list, checked off for good, see ACHIEVEMENTS). Records is a
// different question — "have you ever done it BETTER THAN THE REAL PREMIER
// LEAGUE EVER HAS" — so it needs a progress bar rather than a checkmark, and
// a source (RECORDS, records.ts) that carries the real number to chase, not
// just a boolean.
export function AchievementsScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const [tab, setTab] = useState<"achievements" | "records">("achievements");
  const beaten = RECORDS.filter(r => recordBeaten(career, r)).length;
  const theme = clubTheme(career.player.club, career);
  return (
    <Screen glow={theme.glow}>
      <div className="w-full flex-1 flex flex-col">
        <ScreenHeader title={tab === "achievements" ? "Achievements" : "Records"} kicker="Your career" onBack={onBack} />

        <div className="kit-tabs mb-3">
          {(["achievements", "records"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`kit-tab text-[11px] ${tab === t ? "kit-tab-on" : ""}`}
            >
              {t === "achievements" ? "Achievements" : "Records"}
            </button>
          ))}
        </div>

        {tab === "achievements" ? (
          <>
            <div className="kit-card overflow-hidden flex-1 overflow-y-auto max-h-[560px]">
              {ACHIEVEMENTS.map((a, i) => {
                const unlocked = career.achievements.includes(a.id);
                return (
                  <div key={a.id} className={`kit-rise flex items-center gap-3 p-3 border-b border-white/[0.06] ${unlocked ? "bg-amber-400/[0.07]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <div className={`text-3xl ${unlocked ? "" : "opacity-20 grayscale"}`} style={unlocked ? { filter: "drop-shadow(0 0 8px rgba(251,191,36,.7))" } : undefined}>⭐</div>
                    <div className="flex-1">
                      <div className={`font-black text-sm ${unlocked ? "text-yellow-300" : "text-white/65"}`}>{a.label}</div>
                      <div className={`text-[10px] ${unlocked ? "text-white/85" : "text-white/65"}`}>{a.description}</div>
                    </div>
                    {unlocked && <div className="text-emerald-400 font-black text-lg">✓</div>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-center text-white/80 font-bold">
              <span className="text-amber-300">{career.achievements.length}</span> / {ACHIEVEMENTS.length} unlocked
              <StatBar value={(career.achievements.length / Math.max(1, ACHIEVEMENTS.length)) * 100} colors={["#f59e0b", "#fde047"]} className="mx-auto mt-1.5 h-2 w-40" />
            </div>
          </>
        ) : (
          <>
            <div className="kit-card overflow-hidden flex-1 overflow-y-auto max-h-[560px]">
              {RECORDS.map((r, i) => {
                const progress = r.progress(career);
                const won = progress >= r.value;
                const pct = Math.min(100, Math.round((progress / r.value) * 100));
                return (
                  <div key={r.id} className={`kit-rise p-3 border-b border-white/[0.06] ${won ? "bg-amber-400/[0.07]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <div className="flex items-start gap-3">
                      <div className={`text-3xl ${won ? "" : "opacity-20 grayscale"}`}>🏅</div>
                      <div className="flex-1">
                        <div className={`font-black text-sm ${won ? "text-yellow-300" : "text-white/65"}`}>{r.label}</div>
                        <div className={`text-[10px] ${won ? "text-white/85" : "text-white/65"}`}>
                          {r.holder} · {r.value} {r.unit} ({r.achieved})
                        </div>
                      </div>
                      {won && <div className="text-emerald-400 font-black text-lg">✓</div>}
                    </div>
                    <StatBar value={Math.max(3, pct)} colors={won ? ["#34d399", "#a3e635"] : ["#f59e0b", "#fde047"]} sheen={false} className="mt-2 h-2" />
                    <div className="mt-1 text-[9px] font-bold text-white/70">
                      Your best: {progress} / {r.value} {r.unit}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-center text-white/75 font-bold">
              {beaten} / {RECORDS.length} beaten
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

// ---------- TROPHIES ----------

/** How individual honours read in the cabinet, rarest first — Ballon d'Or
 *  itself sits in its own hero tile above this list, not counted twice
 *  here. Anything not in this order (a future award kind) still shows, just
 *  after the named ones, so nothing silently disappears from the count. */
const AWARD_ORDER = ["Player of the Season", "Golden Boot", "Player of the Month"];
const AWARD_ICON: Record<string, string> = {
  "Player of the Season": "⭐", "Golden Boot": "👟", "Player of the Month": "🗓️",
};

export function TrophiesScreen({ trophies, onBack, ballonDors, awards }: {
  trophies: Trophy[]; ballonDors: number; onBack: () => void;
  /** Every individual honour ever won — see CareerState.awards. Simply
   *  counted per kind ("Player of the Month ×11"), not listed one by one:
   *  requested directly, since a career can rack up a lot of these and the
   *  trophy cabinet is about the honours roll, not a monthly diary. */
  awards?: { kind: string }[];
}) {
  const counts = new Map<string, number>();
  for (const a of awards ?? []) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  const kinds = Array.from(counts.keys()).sort((a, b) => {
    const ia = AWARD_ORDER.indexOf(a), ib = AWARD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <Screen glow="#d4a017">
      <div className="w-full flex-1">
        <ScreenHeader title="Trophy Cabinet" kicker="Your honours" onBack={onBack} />

        {/* The Ballon d'Or: rising into turning light, a shine across the
            case, and the count ticking up to the real number. */}
        <div className="kit-card relative mb-3 overflow-hidden p-4 text-center" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55), 0 0 30px rgba(251,191,36,.2)" }}>
          <Rays color="#fde68a" size={300} className="top-[40%]" />
          <Shine trigger={1} />
          <div className="kit-trophy-in relative mb-1 flex justify-center"><TrophyImage name="Ballon d'Or" height={96} /></div>
          <div className="relative text-3xl font-black tabular-nums text-yellow-300" style={{ textShadow: "0 0 14px rgba(251,191,36,.55)" }}><CountUp value={useLater(500) ? ballonDors : 0} ms={700} /></div>
          <div className="relative text-[10px] font-black uppercase tracking-widest text-yellow-200">Ballon d&apos;Or</div>
          {ballonDors > 0 && <Burst colors={["#fde047", "#fbbf24", "#ffffff"]} count={18} className="left-1/2 top-[38%]" />}
        </div>

        {kinds.length > 0 && (
          <div className="kit-card overflow-hidden mb-3">
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 border-b border-white/[0.06]">
              Individual Awards
            </div>
            {kinds.map((kind, i) => (
              <div key={kind} className="kit-rise flex items-center gap-2.5 px-3 py-2 border-b border-white/[0.05]" style={{ animationDelay: `${200 + i * 70}ms` }}>
                <span className="kit-trophy-in flex w-8 justify-center" style={{ animationDelay: `${260 + i * 70}ms` }}><TrophyImage name={kind} height={34} fallback={AWARD_ICON[kind] ?? "🏅"} /></span>
                <span className="flex-1 font-bold text-white text-sm">{kind}</span>
                <span className="font-black text-amber-300 text-sm">×{counts.get(kind)}</span>
              </div>
            ))}
          </div>
        )}

        {trophies.length === 0 ? (
          <div className="kit-card p-6 text-center text-white text-sm">
            No trophies yet — win the league or a cup!
          </div>
        ) : (
          <div className="kit-card overflow-hidden">
            {trophies.map((t, i) => (
              <div key={i} className="kit-rise relative flex items-center gap-3 overflow-hidden p-3 border-b border-white/[0.06]" style={{ animationDelay: `${350 + Math.min(i, 10) * 80}ms` }}>
                <div className="kit-trophy-in flex w-10 justify-center" style={{ animationDelay: `${420 + Math.min(i, 10) * 80}ms`, filter: "drop-shadow(0 0 8px rgba(251,191,36,.35))" }}><TrophyImage name={t.competition} height={48} fallback="🥇" /></div>
                <div className="flex-1">
                  <div className="font-black text-white text-sm">{t.competition}</div>
                  <div className="text-[10px] text-white/80">{t.club} · Season {t.season}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

// ---------- REPUTATION ----------

/** Same traffic-light bar LifeScreen.tsx's RelationshipRow uses, read-only —
 *  nothing here is a minigame to play. See lib/star/reputation.ts's file
 *  note for what actually moves each of these right now. */
function ReputationRow({ label, value, icon, blurb }: { label: string; value: number; icon: string; blurb: string }) {
  const on = useLater(250);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg kit-row flex items-center justify-center text-xl">{icon}</div>
        <div className="relative flex-1">
          <StatBar value={on ? value : 0} className="h-9" />
          <div className="absolute inset-0 flex items-center justify-center" style={{ textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
            <span className="font-black text-white text-sm">{label}</span>
            <span className="ml-2 font-black text-white text-xs bg-black/50 rounded-full px-2 tabular-nums">{value}</span>
          </div>
        </div>
      </div>
      <div className="mt-1 ml-11 text-[9px] font-semibold text-white/90">{blurb}</div>
    </div>
  );
}

export function ReputationScreen({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const rep = career.reputation;
  const fame = fameOf(career);
  const level = fameLevel(fame);
  const next = nextFameLevel(fame);
  const earned = Math.round(career.fame);
  const fromOwned = Math.max(0, fame - earned);
  const repUnlocks: { min: number; text: string }[] = [
    { min: 0, text: "Buy shares in clubs — votes lean your way more as this rises" },
    { min: REPUTATION_RECOMMEND_MIN, text: "Club boards take your recommendations seriously" },
    { min: REPUTATION_PROPOSE_RULES_MIN, text: "Propose Rule Book changes (influence also needed)" },
    { min: REPUTATION_PRESIDENCY_MIN, text: "Stand for president of the FA, UEFA, FIFA or CONMEBOL" },
  ];
  const theme = clubTheme(career.player.club, career);
  return (
    <Screen glow={theme.glow}>
      <div className="w-full flex-1 space-y-3">
        <ScreenHeader title="Fame & Reputation" kicker="Ownership" onBack={onBack} />

        <div className="kit-card kit-rise p-3" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.35), 0 10px 24px -12px rgba(0,0,0,.8)" }}>
          <ReputationRow label={`Fame · ${level.name}`} value={fame} icon="⭐"
            blurb="How many people know your name. Earned from big moments — promotions, trophies, awards, the Ballon d'Or — plus what you own. Playing well alone earns none." />
          <div className="mt-2 text-[11px] font-bold text-white">
            {earned} earned + {fromOwned} from what you own
            {next ? ` · ${next.min - fame} to ${next.name}` : " · maxed"}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] font-black text-white">
            {FAME_LEVELS.map(l => (
              <div key={l.name} className={`rounded-md px-1.5 py-1 text-center ${fame >= l.min ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-gray-950" : "kit-row"}`}>
                {l.name} {l.min}+
              </div>
            ))}
          </div>
        </div>

        <div className="kit-card kit-rise p-3" style={{ animationDelay: "90ms", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.35), 0 10px 24px -12px rgba(0,0,0,.8)" }}>
          <ReputationRow label={`Reputation · ${reputationLabel(rep)}`} value={rep} icon="🤝"
            blurb="Whether the people who run football trust you. Up with trophies, clean seasons and good causes; down with scandals, overruling votes and merging clubs." />
          <div className="mt-2 space-y-1">
            {repUnlocks.map(u => (
              <div key={u.min} className="flex items-center gap-2 text-[11px] font-bold text-white">
                <span className={`w-9 shrink-0 rounded-md text-center text-[10px] font-black ${rep >= u.min ? "bg-gradient-to-b from-emerald-300 to-emerald-500 text-gray-950" : "kit-row text-white"}`}>{u.min}+</span>
                <span>{u.text}</span>
              </div>
            ))}
          </div>
        </div>

        {(career.fameNews?.length ?? 0) > 0 && (
          <div className="kit-card kit-rise p-3" style={{ animationDelay: "180ms" }}>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-1.5">Last season</div>
            {career.fameNews!.map((line, i) => (
              <div key={i} className="text-[11px] font-bold text-white">{line}</div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

// ---------- CONTRACT RENEWAL (higher-or-lower) ----------
export function ContractRenewal({ career, offerReason, onComplete }: {
  career: CareerState;
  offerReason?: "form" | "star";
  onComplete: (newContract: CareerState["contract"] | null) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "playing">("intro");
  const [current, setCurrent] = useState(7);
  const [next, setNext] = useState<number | null>(null);
  const [rounds, setRounds] = useState(0);
  const [wins, setWins] = useState(0);
  // Once a guess is wrong, the game is over for real — see `guess` below.
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  // The juice: a right guess bursts and floats the raise, a wrong one shakes
  // the offer, and signing stamps it before handing it over.
  const [wonAt, fireWon] = useTrigger();
  const [lostAt, fireLost] = useTrigger();
  const [signed, setSigned] = useState(false);
  const theme = clubTheme(career.player.club, career);

  // Requested directly: "it doesn't matter how long you have left on your
  // contract... the club should be more keen to discuss... if you're
  // performing really well... if you haven't improved that much, they'll
  // probably just reject the renewal approach." The old "final year only"
  // gate is gone — you can ask any time — but asking is no longer a free
  // guarantee of a conversation either. A club-initiated offer (offerReason
  // set) is, by definition, already willing; a player-initiated ask has to
  // clear the same real bar `checkForContractOffer`'s own proactive offer
  // does (see careerFlow.ts's `willingToRenegotiate`).
  const willing = !!offerReason || willingToRenegotiate(career);

  // Draw a card that is never equal to the current one — a true higher-or-lower has
  // no ties, so a 6 can't be followed by another 6.
  const drawDifferent = (from: number) => {
    let n = 1 + Math.floor(Math.random() * 13);
    while (n === from) n = 1 + Math.floor(Math.random() * 13);
    return n;
  };

  const startCard = () => {
    setPhase("playing");
    setCurrent(3 + Math.floor(Math.random() * 8));
    setNext(null);
    setRounds(0);
    setWins(0);
    setLocked(false);
    setMessage("");
  };

  // Requested directly, replacing the old fixed "5 rounds then it's over"
  // shape entirely: every correct guess raises the live offer and hands you
  // a real choice — bank it now, or push your luck again — with no cap on
  // how many times you can push. The first WRONG guess ends it for real:
  // the offer drops from wherever it was, and that reduced number is now
  // the only thing on the table (see `locked` below and the render for the
  // "no more guessing, just accept" state that follows).
  const guess = (higher: boolean) => {
    if (locked) return;
    const n = drawDifferent(current);
    setNext(n);
    setRounds((r) => r + 1);
    const correct = higher ? n > current : n < current;
    setTimeout(() => {
      if (correct) {
        setWins((w) => w + 1);
        fireWon();
        setMessage("✓ Correct! Your offer just improved — take it, or push again.");
      } else {
        setLocked(true);
        fireLost();
        setMessage("✗ Wrong — talks sour and the offer drops. This is now their final position.");
      }
      setCurrent(n);
      setNext(null);
    }, 900);
  };

  // Each correct guess raises your terms by a real PERCENTAGE of what you
  // already earn — rescaled 14 Sep 2026: a flat +★1 (or +★0.5 for the
  // bonuses) meant something when wage was ★1, but is a rounding error now
  // wage lives on the real-money scale. Same idea as every other wage-offer
  // formula in the game (see transfers.ts) — a good negotiation compounds
  // off your current terms, not off a fixed placeholder amount.
  const RAISE_PCT_PER_WIN = 0.08;
  // A single wrong guess costs a real, noticeable chunk of whatever you'd
  // already banked — applied ONCE, on top of the wins already earned, not
  // instead of them, so a strong run that ends in one slip still lands
  // somewhere between "nothing gained" and "the peak you reached."
  const LOSS_PENALTY_PCT = 0.15;
  const offerMultiplier = (1 + RAISE_PCT_PER_WIN * wins) * (locked ? (1 - LOSS_PENALTY_PCT) : 1);
  const currentOffer = (base: number) => Math.round(base * offerMultiplier);

  const finalise = () => {
    const wage = currentOffer(career.contract.wage);
    // The better the negotiation went, the more of the deal they will write in.
    // Seeded off the outcome so the same negotiation produces the same offer.
    const newContract: CareerState["contract"] = {
      club: career.contract.club,
      wage,
      goalBonus: currentOffer(career.contract.goalBonus),
      assistBonus: currentOffer(career.contract.assistBonus),
      seasonsRemaining: 3,
      ...offerClauses(career, wage, mulberry32(career.season * 71 + wins * 13 + rounds)),
    };
    // Signed: the stamp lands and the confetti goes, then the same contract
    // goes up as always. Straight through for a phone set to reduce motion.
    if (signed) return;
    setSigned(true);
    setTimeout(() => onComplete(newContract), prefersReducedMotion() ? 0 : 1300);
  };

  return (
    <Screen glow={theme.glow} center>
      <div className="relative w-full">
        {signed && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <Burst colors={[theme.shirt, theme.trim, "#fde047", "#ffffff"]} count={30} spread={1.4} />
            <div className="kit-stamp rounded-xl border-4 border-emerald-400 bg-emerald-950/85 px-5 py-2 text-3xl font-black uppercase tracking-widest text-emerald-300" style={{ boxShadow: "0 0 40px rgba(52,211,153,.5)" }}>Signed</div>
          </div>
        )}
        <div className="text-center mb-3">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">Contract Renewal</div>
          <div className="text-[20px] font-black uppercase text-white">{career.contract.club}</div>
        </div>

        {phase === "intro" && !willing && (
          <div className="kit-card kit-rise p-4 text-center">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm text-gray-200 mb-1 leading-snug font-bold">
              Not interested in renegotiating right now.
            </div>
            <div className="text-xs text-white/75 mb-4 leading-snug">
              You haven&apos;t done enough lately to earn a better deal — a real hot streak of form, or a genuine jump in your overall, and they&apos;ll be a lot more willing to talk.
            </div>
            <PressButton variant="primary" onClick={() => onComplete(null)} className="w-full">Back</PressButton>
          </div>
        )}

        {phase === "intro" && willing && (
          <div className="kit-card kit-rise p-4">
            {offerReason === "form" && (
              <div className="mb-3 flex items-start gap-2 bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-3 py-2.5">
                <span className="text-lg leading-none">📈</span>
                <div className="text-xs text-emerald-200 leading-snug">
                  <span className="font-black text-emerald-300">Outstanding form!</span> Your performances have been exceptional — {career.contract.club} want to lock you in with an improved deal early.
                </div>
              </div>
            )}
            {offerReason === "star" && (
              <div className="mb-3 flex items-start gap-2 bg-amber-900/40 border border-amber-700/50 rounded-xl px-3 py-2.5">
                <span className="text-lg leading-none">⭐</span>
                <div className="text-xs text-amber-200 leading-snug">
                  <span className="font-black text-amber-300">Overall {Math.round(attributeOverall(career.skills))}!</span> The club recognise how much you have improved and are offering improved terms to reflect your standing.
                </div>
              </div>
            )}
            <div className="text-xs text-white/85 mb-3 leading-snug">
              Your agent will play higher-or-lower against the club negotiator. Every correct guess raises your offer by {Math.round(RAISE_PCT_PER_WIN * 100)}% — take it whenever you like, or keep pushing. Get one wrong and talks sour: the offer drops, and that final number is the only one left on the table.
            </div>
            <div className="kit-row rounded-xl p-3 text-xs mb-3 space-y-1">
              <div className="flex justify-between"><span>Current wage</span><span className="text-yellow-300 font-black">★{formatMoney(career.contract.wage)}/week</span></div>
              <div className="flex justify-between"><span>Goal bonus</span><span className="text-yellow-300 font-black">★{formatMoney(career.contract.goalBonus)}</span></div>
              <div className="flex justify-between"><span>Assist bonus</span><span className="text-yellow-300 font-black">★{formatMoney(career.contract.assistBonus)}</span></div>
              <div className="flex justify-between"><span>Seasons remaining</span><span className="text-white/85 font-black">{career.contract.seasonsRemaining}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PressButton variant="secondary" onClick={() => onComplete(null)} className="normal-case">
                {offerReason ? "Decline offer" : "Not now"}
              </PressButton>
              <PressButton variant="primary" pulse onClick={startCard} className="normal-case">Start negotiation</PressButton>
            </div>
          </div>
        )}

        {phase === "playing" && (
          <div className="kit-card p-4 text-center">
            <div className="text-xs text-white/80 mb-2">Round {rounds + 1} · <span className="font-black text-emerald-300">{wins} correct</span></div>
            <div className="flex justify-center gap-3 items-center mb-4">
              <CardBig value={current} />
              <div className="text-xl text-white/60">→</div>
              <CardBig value={next ?? "?"} />
            </div>
            {message && (
              <div key={message + rounds} className={`kit-rise mb-3 font-black text-sm leading-snug ${message.startsWith("✓") ? "text-emerald-300" : "text-red-400"}`}>{message}</div>
            )}

            {/* The live offer — updates after every single guess, win or
                loss, so the choice to stop or push again is always made
                with real, current numbers in front of you, not a guess. */}
            <div key={lostAt} className={`relative kit-row rounded-xl p-3 text-xs mb-3 space-y-1 text-left ${lostAt ? "kit-shake-x" : ""}`} style={locked ? { boxShadow: "inset 0 0 0 1px rgba(248,113,113,.45)" } : undefined}>
              <Burst trigger={wonAt} colors={["#34d399", "#fde047", "#ffffff"]} count={16} spread={0.7} className="left-3/4 top-1/2" round />
              <FloatText trigger={wonAt} text={`+${Math.round(RAISE_PCT_PER_WIN * 100)}%`} color="#34d399" className="left-3/4 top-2" size={15} />
              <FloatText trigger={lostAt} text={`−${Math.round(LOSS_PENALTY_PCT * 100)}%`} color="#f87171" className="left-3/4 top-2" size={15} />
              <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">
                {locked ? "Final offer" : "Current offer"}
              </div>
              <div className="flex justify-between"><span>Wage</span><span className={`font-black ${locked ? "text-red-300" : "text-emerald-300"}`}>★{formatMoney(currentOffer(career.contract.wage))}/week</span></div>
              <div className="flex justify-between"><span>Goal bonus</span><span className={`font-black ${locked ? "text-red-300" : "text-emerald-300"}`}>★{formatMoney(currentOffer(career.contract.goalBonus))}</span></div>
              <div className="flex justify-between"><span>Assist bonus</span><span className={`font-black ${locked ? "text-red-300" : "text-emerald-300"}`}>★{formatMoney(currentOffer(career.contract.assistBonus))}</span></div>
            </div>

            {!locked ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <PressButton variant="danger" onClick={() => guess(false)} disabled={next !== null || signed}>▼ Lower</PressButton>
                  <PressButton variant="primary" onClick={() => guess(true)} disabled={next !== null || signed}>▲ Higher</PressButton>
                </div>
                <PressButton variant="secondary" onClick={finalise} disabled={next !== null || signed} className="w-full normal-case">
                  Accept this offer →
                </PressButton>
              </>
            ) : (
              <PressButton variant="primary" pulse onClick={finalise} disabled={signed} className="w-full normal-case">Sign Contract →</PressButton>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}

function CardBig({ value }: { value: number | string }) {
  const isNum = typeof value === "number";
  const display = isNum ? (value === 1 ? "A" : value === 11 ? "J" : value === 12 ? "Q" : value === 13 ? "K" : value) : value;
  return (
    <div
      key={String(value)}
      className={`kit-flip-in w-20 h-28 rounded-xl flex items-center justify-center ${isNum ? "bg-gradient-to-b from-white to-slate-200" : "bg-gradient-to-b from-slate-600 to-slate-800"}`}
      style={{ boxShadow: "inset 0 -3px 0 rgba(0,0,0,.15), inset 0 0 0 2px rgba(255,255,255,.35), 0 10px 20px -8px rgba(0,0,0,.9)" }}
    >
      <div className={`text-4xl font-black ${isNum ? "text-black" : "text-white/75"}`}>{display}</div>
    </div>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
