/**
 * POST-MATCH, as the website's (components/star/PostMatch.tsx) in the packed
 * app's glass look, in its order: the competition, the scoreboard (both
 * crests, name plates in the kits, the score on white plates, Win/Draw/Defeat),
 * the knockout line, worn-out boots, then
 *   simmed: one card (⏩ Simulated, the star bar, the big match rating, goals
 *           and assists);
 *   played: the star bar, the match rating (tap for every chance), chances /
 *           goals / assists / passes, boss / team / fans, the pay;
 * the achievements one at a time, then the glowing CONTINUE.
 * The phone keeps its own extra lines (the star's extra points, boss / team /
 * fans after a sim, energy back), placed where the website's nearest block is.
 * Reads the report flow.completeMatch saved (game/session.ts). Nothing moves
 * at rest (the website's count-ups and bursts are left out).
 */
import { useState } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { shortClub } from "@/lib/star/media/grammar";
import { kitsFor, type Kit } from "@/lib/star/kits";
import { CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood, type ChanceOutcome } from "@/lib/star/chanceLog";
import type { CareerState } from "@/lib/star/types";
import * as flow from "../../game/flow";
import { useSession } from "../../game/session";
import { Press } from "../../ui/Press";
import { FillStar, FONT, LookButton, glassStyle, rgba } from "../../ui/look";
import { Frame, Btn, ClubCrest, money } from "./kit";
import { glowOf } from "./lookBits";

const RESULT = { win: { word: "WIN", color: "#34d399" }, draw: { word: "DRAW", color: "#fbbf24" }, loss: { word: "DEFEAT", color: "#f87171" } } as const;
const OUTLINE = { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 } as const;

/** A glass card lit in a colour (the website's ClubCard glow). */
function GlowCard({ glow, children, style }: { glow: string; children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[glassStyle("glass"), { borderRadius: 16, overflow: "hidden", backgroundImage: `radial-gradient(ellipse at 50% 0%, ${rgba(glow, 0.22)} 0%, ${rgba(glow, 0)} 70%), linear-gradient(180deg, rgba(14,30,52,0.66), rgba(10,22,40,0.74))`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.18), inset 0px 0px 0px 1px ${rgba(glow, 0.45)}, 0px 8px 22px -10px rgba(0,0,0,0.55)` } as ViewStyle, style]}>{children}</View>;
}

export function PostMatchScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const { report } = useSession();
  const [chancesOpen, setChancesOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  if (!report) {
    return <Frame title="Full time"><Btn label="Home" onPress={() => go(flow.HOME)} /></Frame>;
  }
  const { stats, fixture } = report;
  const mine = flow.myTeam(career, fixture);
  const youHome = fixture.home !== false;
  const homeTeam = youHome ? mine : fixture.opponent;
  const awayTeam = youHome ? fixture.opponent : mine;
  const kits = kitsFor(homeTeam, awayTeam, career.clubKits?.[homeTeam], career.clubKits?.[awayTeam]);
  const myKit = youHome ? kits.home : kits.away;
  const theme = glowOf(myKit.shirt, myKit.trim);
  const us = stats.homeScore, them = stats.awayScore;
  const result = us > them ? "win" : us < them ? "loss" : "draw";
  const look = RESULT[result];
  const hs = youHome ? stats.homeScore : stats.awayScore;
  const as = youHome ? stats.awayScore : stats.homeScore;
  const ko = report.knockout;
  const through = !!ko && (ko.startsWith("🏆") || ko.startsWith("Into") || ko.startsWith("Through"));
  const achs = flow.achievementCards(report.achievements);
  const allSeen = seen >= achs.length;

  const starBar = <StarBar from={report.starFrom} to={report.starTo} toNext={report.star.toNext} held={report.star.held} gate={report.star.gate} extra={report.star.extra} />;
  // Only a played match with a chance log opens on a tap (a disabled Press would fade the rating).
  const canTap = !!stats.chanceLog && !stats.simmed;
  const hero = <RatingHero value={stats.rating} starMan={stats.starMan} tap={canTap} open={chancesOpen} />;
  const rating = canTap ? <Press onPress={() => setChancesOpen((o) => !o)}>{hero}</Press> : hero;
  const rel = (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <RelBar label="Boss" from={report.rel.before.boss} to={report.rel.after.boss} />
      <RelBar label="Team" from={report.rel.before.team} to={report.rel.after.team} />
      <RelBar label="Fans" from={report.rel.before.fans} to={report.rel.after.fans} />
    </View>
  );

  return (
    <Frame title="Full time" bare
      footer={
        <LookButton kind="primary" disabled={!allSeen} onPress={() => go(flow.postMatchContinue())}
          style={{ paddingVertical: 14, borderRadius: 14, boxShadow: allSeen ? "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 0px 24px rgba(52,211,153,0.55)" : undefined } as ViewStyle}>
          <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 20, lineHeight: 24, letterSpacing: 0.6 }}>CONTINUE  →</Text>
        </LookButton>
      }>
      {/* The competition */}
      <View style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
        <Text style={{ color: report.competition ? "#bfdbfe" : "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{(report.competition ?? "Full time").toUpperCase()}</Text>
      </View>

      {/* The scoreboard */}
      <View style={[glassStyle("glass"), { borderRadius: 16, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 12,
        backgroundImage: `linear-gradient(90deg, ${rgba(glowOf(kits.home.shirt, kits.home.trim), 0.2)}, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 55%, ${rgba(glowOf(kits.away.shirt, kits.away.trim), 0.2)}), linear-gradient(180deg, rgba(14,30,52,0.66), rgba(10,22,40,0.74))` } as ViewStyle]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Side club={homeTeam} kit={kits.home} you={youHome} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
            <Digit n={hs} /><Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 22, fontWeight: "900" }}>-</Text><Digit n={as} />
          </View>
          <Side club={awayTeam} kit={kits.away} you={!youHome} />
        </View>
        {stats.shootout && <Text style={{ color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 6, fontSize: 12, fontWeight: "800" }}>Penalties {stats.shootout.home}–{stats.shootout.away}</Text>}
        <View style={{ alignSelf: "center", marginTop: 10, paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999, backgroundColor: rgba(look.color, 0.16), boxShadow: `inset 0px 0px 0px 1px ${rgba(look.color, 0.45)}, 0px 0px 18px ${rgba(look.color, 0.35)}` } as ViewStyle}>
          <Text style={{ color: look.color, fontSize: 11, fontWeight: "900", letterSpacing: 3.3 }}>{look.word}</Text>
        </View>
      </View>

      {ko && (
        <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
          backgroundImage: ko.startsWith("🏆") ? "linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706)" : through ? "linear-gradient(180deg, #34d399, #059669 60%, #065f46)" : "linear-gradient(180deg, #f87171, #b91c1c 60%, #7f1d1d)",
          boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 8px 18px -8px rgba(0,0,0,0.8)" } as ViewStyle}>
          <Text style={{ color: ko.startsWith("🏆") ? "#030712" : "#fff", textAlign: "center", fontWeight: "900", fontSize: 14 }}>{ko}</Text>
        </View>
      )}
      {report.bootsWornOut && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(252,211,77,0.5)" }}>
          <Text style={{ fontSize: 18 }}>🥾</Text>
          <Text style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 12.5 }}>Your boots just wore out. Buy a new pair in the Shop before your next match.</Text>
        </View>
      )}

      {stats.simmed ? (
        <GlowCard glow={theme}>
          <View style={{ paddingVertical: 6, alignItems: "center", backgroundColor: "rgba(14,165,233,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: "#bae6fd", fontSize: 10.5, fontWeight: "900", letterSpacing: 2 }}>⏩ SIMULATED{stats.enteredAt ? ` · ON AT ${stats.enteredAt}'` : ""}</Text>
          </View>
          {starBar}
          {rating}
          <View style={{ flexDirection: "row", gap: 8, padding: 10, paddingTop: 0 }}>
            <StatTile label="Goals" value={stats.goals} lit={stats.goals > 0} />
            <StatTile label="Assists" value={stats.assists} lit={stats.assists > 0} />
          </View>
        </GlowCard>
      ) : (
        <>
          <GlowCard glow="#fbbf24">{starBar}</GlowCard>
          <GlowCard glow={theme}>
            {rating}
            {chancesOpen && stats.chanceLog && (
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 12, paddingVertical: 8 }}>
                {stats.chanceLog.length === 0 && <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 12 }}>No chances came to you.</Text>}
                {stats.chanceLog.map((ch, i) => (
                  <View key={i} style={{ flexDirection: "row", paddingVertical: 2 }}>
                    <Text style={{ color: "rgba(255,255,255,0.75)", width: 40, fontWeight: "900", fontSize: 12 }}>{ch.minute}'</Text>
                    <Text numberOfLines={1} style={{ color: "#fff", flex: 1, fontWeight: "900", fontSize: 12 }}>{CHANCE_KIND_LABEL[ch.kind] ?? ch.kind}</Text>
                    <Text style={{ color: chanceOutcomeGood(ch.outcome) ? "#6ee7b7" : "#fca5a5", fontWeight: "900", fontSize: 12 }}>{CHANCE_OUTCOME_LABEL[ch.outcome as ChanceOutcome] ?? ch.outcome}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlowCard>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <StatTile label="Chances" value={stats.chances} />
            <StatTile label="Goals" value={stats.goals} lit={stats.goals > 0} />
            <StatTile label="Assists" value={stats.assists} lit={stats.assists > 0} />
            <StatTile label="Passes" value={stats.passes} />
          </View>
        </>
      )}

      {/* Boss, team and fans: where each was, and where it is now (green up, red down). */}
      {rel}

      {!stats.simmed && (
        <GlowCard glow="#fbbf24">
          <Text style={{ color: "#fde68a", fontSize: 10.5, fontWeight: "900", letterSpacing: 2, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>PAY</Text>
          {([["Wage", stats.wage], ["Goal Bonus", stats.goalBonus], ["Sponsors", stats.sponsorPay]] as [string, number][]).map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <Text style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: "900" }}>{k}</Text>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{money(v)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", margin: 8, marginTop: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundImage: "linear-gradient(180deg, #34d399, #059669 60%, #065f46)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4)" } as ViewStyle}>
            <Text style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 14 }}>Total Cash</Text>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>{money(stats.totalCash)}</Text>
          </View>
        </GlowCard>
      )}
      {report.energyBack ? <Text style={{ color: "#6ee7b7", textAlign: "center", fontWeight: "800", fontSize: 12 }}>⚡ +{report.energyBack} energy back from the rest days</Text> : null}

      {/* The achievements, one at a time; Continue stays shut until each is seen. */}
      {!allSeen && (
        <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", backgroundImage: "linear-gradient(180deg, rgba(251,191,36,0.22), rgba(120,53,15,0.35))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.25), inset 0px 0px 0px 2px rgba(251,191,36,0.7), 0px 0px 24px rgba(251,191,36,0.3)" } as ViewStyle}>
          <Text style={{ color: "#fcd34d", fontWeight: "900", fontSize: 10, letterSpacing: 2.4 }}>ACHIEVEMENT{achs.length > 1 ? ` ${seen + 1} OF ${achs.length}` : ""}</Text>
          <Text style={{ fontSize: 40, marginTop: 4 }}>⭐</Text>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18, marginTop: 2, textAlign: "center" }}>{achs[seen].label}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 12, textAlign: "center" }}>{achs[seen].description}</Text>
          <LookButton kind="gold" style={{ alignSelf: "stretch", marginTop: 8, paddingVertical: 9, borderRadius: 3 }} onPress={() => setSeen((k) => k + 1)}>
            <Text style={{ color: "#111827", fontSize: 13, fontWeight: "900" }}>{seen + 1 < achs.length ? "Next" : "Done"}</Text>
          </LookButton>
        </View>
      )}
    </Frame>
  );
}

/** One side of the scoreboard: the crest and a short name plate in the kit (outlined so a white kit reads). */
function Side({ club, kit, you }: { club: string; kit: Kit; you: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
      <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}><ClubCrest club={club} size={50} /></View>
      <View style={{ alignSelf: "stretch", marginTop: 4, borderRadius: 6, borderWidth: 1, borderColor: kit.trim, backgroundColor: kit.shirt, paddingHorizontal: 4, paddingVertical: 2 }}>
        <Text numberOfLines={1} style={[{ color: "#fff", fontSize: 11, fontWeight: "900", textAlign: "center" }, OUTLINE]}>{shortClub(club).toUpperCase()}</Text>
      </View>
      <Text style={{ color: "#6ee7b7", fontSize: 8.5, fontWeight: "900", letterSpacing: 2, marginTop: 2, opacity: you ? 1 : 0 }}>YOU</Text>
    </View>
  );
}

/** A big score digit on a white plate. */
function Digit({ n }: { n: number }) {
  return (
    <View style={{ minWidth: 44, height: 52, borderRadius: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, #ffffff, #e2e8f0)", boxShadow: "inset 0px -3px 0px rgba(0,0,0,0.15), 0px 8px 18px -6px rgba(0,0,0,0.8)" } as ViewStyle}>
      <Text style={{ color: "#030712", fontFamily: FONT.display, fontSize: 36, lineHeight: 42 }}>{n}</Text>
    </View>
  );
}

/** A number over a small caps label (lit green when it is a goal or an assist). */
function StatTile({ label, value, lit }: { label: string; value: number; lit?: boolean }) {
  return (
    <View style={[{ flex: 1, borderRadius: 12, paddingVertical: 7, alignItems: "center" },
      (lit ? { backgroundImage: "linear-gradient(180deg, rgba(52,211,153,0.28), rgba(16,185,129,0.1))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.18), inset 0px 0px 0px 1px rgba(52,211,153,0.4)" }
        : { backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.08)" }) as ViewStyle]}>
      <Text style={{ color: lit ? "#6ee7b7" : "#fff", fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** The match rating, big; tap it for your chances. */
function RatingHero({ value, starMan, tap, open }: { value: number; starMan: boolean; tap: boolean; open: boolean }) {
  const color = value >= 8 ? "#6ee7b7" : value >= 7 ? "#fde047" : value >= 6 ? "#ffffff" : "#f87171";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>MATCH RATING</Text>
        {tap && <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>{open ? "Hide chances ▴" : "Your chances ▾"}</Text>}
        {starMan && (
          <View style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle}>
            <Text style={{ color: "#030712", fontSize: 10, fontWeight: "900" }}>★ STAR MAN!</Text>
          </View>
        )}
      </View>
      <Text style={{ color, fontFamily: FONT.display, fontSize: 52, lineHeight: 58, textShadowColor: rgba(color.length === 7 ? color : "#ffffff", 0.5), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 }}>{value.toFixed(1)}</Text>
    </View>
  );
}

/** Your star rating as a bar, this level at its left end and the next at its right (PostMatch StarBar). */
function StarBar({ from, to, toNext, held, gate, extra }: { from: number; to: number; toNext: number; held?: number; gate?: string | number; extra: { label: string; n?: number }[] }) {
  const lo = Math.floor(from), hi = Math.floor(to);
  const left = Math.max(1, hi);
  const pct = Math.max(3, Math.min(100, toNext * 100));
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <FillStar fraction={pct / 100} size={20} />
        <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>STAR RATING</Text>
        {hi > lo && <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900", marginLeft: "auto" }}>{lo} → {hi} ⬆</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ width: 22, textAlign: "center", color: "#fde68a", fontSize: 15, fontWeight: "900" }}>{left}</Text>
        <View style={{ flex: 1, height: 18, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.75)", overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as ViewStyle}>
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: "45%", backgroundColor: "rgba(255,255,255,0.3)" }} />
          </View>
        </View>
        <Text style={{ width: 22, textAlign: "center", color: "#fde68a", fontSize: 15, fontWeight: "900" }}>{left + 1}</Text>
      </View>
      {(held ?? 0) > 0 && <Text style={{ color: "#fef3c7", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 6 }}>Bar full: level {left + 1} lands after your next match (one level a match).</Text>}
      {gate ? <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", marginTop: 6 }}>To go up: {gate}</Text> : null}
      {extra.length > 0 && <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", marginTop: 4 }}>{extra.map((l) => `+ ${l.label}${l.n && l.n > 1 ? ` ×${l.n}` : ""}`).join("   ")}</Text>}
    </View>
  );
}

/** Boss, team or fans: the bar where it is now, green if it rose, red if it fell (PostMatch RelBar). */
function RelBar({ label, from, to }: { label: string; from: number; to: number }) {
  const up = to > from, down = to < from;
  const tint = up ? "#34d399" : down ? "#f87171" : "#e5e7eb";
  const pct = Math.max(0, Math.min(100, to));
  return (
    <View style={{ flex: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, ...(up || down ? { backgroundImage: `linear-gradient(180deg, ${rgba(tint, 0.22)}, ${rgba(tint, 0.08)})` } : { backgroundColor: "rgba(255,255,255,0.06)" }), boxShadow: `inset 0px 0px 0px 1px ${up || down ? rgba(tint, 0.5) : "rgba(255,255,255,0.12)"}` } as ViewStyle}>
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", textAlign: "center", marginBottom: 4 }}>{label}</Text>
      <View style={{ height: 8, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 2, backgroundColor: tint }} />
      </View>
    </View>
  );
}

