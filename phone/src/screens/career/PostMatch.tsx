/**
 * POST-MATCH, as the website's (components/star/PostMatch.tsx), in its order:
 * full time card (both clubs, the score, Win/Draw/Defeat), the knockout line,
 * worn-out boots, the star rating bar, the match rating (tap for every chance),
 * chances / goals / assists / passes, the boss / team / fans bars, the pay,
 * the achievements one at a time, then Continue.
 * Reads the report flow.completeMatch saved (game/session.ts).
 */
import { useState } from "react";
import { View, Text } from "react-native";
import { shortClub } from "@/lib/star/media/grammar";
import { CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood, type ChanceOutcome } from "@/lib/star/chanceLog";
import type { CareerState } from "@/lib/star/types";
import * as flow from "../../game/flow";
import { useSession } from "../../game/session";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Row, Btn, MoveBar, Fill, Tile, ClubCrest, money, C } from "./kit";

const LOOK = { win: { word: "WIN", color: "#34d399" }, draw: { word: "DRAW", color: "#fbbf24" }, loss: { word: "DEFEAT", color: "#f87171" } } as const;

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
  const us = stats.homeScore, them = stats.awayScore;
  const result = us > them ? "win" : us < them ? "loss" : "draw";
  const look = LOOK[result];
  const hs = youHome ? stats.homeScore : stats.awayScore;
  const as = youHome ? stats.awayScore : stats.homeScore;
  const ko = report.knockout;
  const through = !!ko && (ko.startsWith("🏆") || ko.startsWith("Into") || ko.startsWith("Through"));
  const achs = flow.achievementCards(report.achievements);
  const allSeen = seen >= achs.length;
  const ratingColor = stats.rating >= 8 ? "#6ee7b7" : stats.rating >= 7 ? "#fde047" : stats.rating >= 6 ? "#ffffff" : "#f87171";
  const levelUp = Math.floor(report.starTo) > Math.floor(report.starFrom);

  return (
    <Frame kicker={report.competition ?? "Full time"} title={report.competition ? "Full time" : "Match report"}
      footer={<Btn label="Continue →" disabled={!allSeen} onPress={() => go(flow.postMatchContinue())} />}>
      {/* The scoreboard */}
      <Card tone={look.color}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Side club={homeTeam} you={youHome} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Digit n={hs} /><Text style={{ color: C.dim, fontSize: 24, fontWeight: "900" }}>–</Text><Digit n={as} />
          </View>
          <Side club={awayTeam} you={!youHome} />
        </View>
        {stats.shootout && <Text style={{ color: C.dim, textAlign: "center", marginTop: 6 }}>Penalties {stats.shootout.home}–{stats.shootout.away}</Text>}
        <Text style={{ color: look.color, textAlign: "center", fontWeight: "900", letterSpacing: 4, marginTop: 8 }}>{look.word}</Text>
      </Card>

      {ko && (
        <View style={{ borderRadius: 14, padding: 12, backgroundColor: ko.startsWith("🏆") ? C.gold : through ? "#059669" : "#b91c1c" }}>
          <Text style={{ color: ko.startsWith("🏆") ? "#111" : C.text, textAlign: "center", fontWeight: "900" }}>{ko}</Text>
        </View>
      )}
      {report.bootsWornOut && (
        <Card tone={C.gold}><Text style={{ color: C.text, fontWeight: "800" }}>🥾 Your boots just wore out. Buy a new pair in the Shop before your next match.</Text></Card>
      )}

      {/* Star rating */}
      <Card tone="rgba(245,197,66,0.4)">
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: C.gold, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>STAR RATING</Text>
          <Text style={{ color: C.text, fontWeight: "900" }}>{levelUp ? `${Math.floor(report.starFrom)} → ${Math.floor(report.starTo)} ⬆` : `${Math.floor(report.starTo)}`}</Text>
        </View>
        <Fill value={Math.max(3, report.star.toNext * 100)} color={C.gold} height={12} />
        {report.star.gate ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>To go up: {report.star.gate}</Text> : null}
        {report.star.extra.length > 0 && (
          <View style={{ marginTop: 6 }}>
            {report.star.extra.map((l, i) => <Text key={i} style={{ color: C.dim, fontSize: 12 }}>+ {l.label}{l.n && l.n > 1 ? ` ×${l.n}` : ""}</Text>)}
          </View>
        )}
      </Card>

      {/* Match rating; tap for every chance that came to you. */}
      <Press onPress={() => setChancesOpen((o) => !o)} disabled={!stats.chanceLog}>
        <Card>
          {stats.simmed && <Text style={{ color: "#7dd3fc", textAlign: "center", fontWeight: "900", letterSpacing: 2, fontSize: 11, marginBottom: 6 }}>⏩ SIMULATED{stats.enteredAt ? ` · ON AT ${stats.enteredAt}'` : ""}</Text>}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: C.dim, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>MATCH RATING</Text>
              {stats.starMan && <Text style={{ color: C.gold, fontWeight: "900", marginTop: 4 }}>★ Star Man!</Text>}
              {stats.chanceLog && <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{chancesOpen ? "Tap to close" : "Tap for your chances"}</Text>}
            </View>
            <Text style={{ color: ratingColor, fontSize: 46, fontWeight: "900" }}>{stats.rating.toFixed(1)}</Text>
          </View>
          {chancesOpen && stats.chanceLog?.length === 0 && <Text style={{ color: C.text, fontWeight: "700", marginTop: 8 }}>No chances came to you.</Text>}
          {chancesOpen && stats.chanceLog?.map((ch, i) => (
            <View key={i} style={{ flexDirection: "row", paddingVertical: 5, borderTopWidth: i ? 0 : 1, borderTopColor: C.line, marginTop: i ? 0 : 8 }}>
              <Text style={{ color: C.dim, width: 40 }}>{ch.minute}'</Text>
              <Text style={{ color: C.text, flex: 1 }}>{CHANCE_KIND_LABEL[ch.kind] ?? ch.kind}</Text>
              <Text style={{ color: chanceOutcomeGood(ch.outcome) ? C.green : C.red, fontWeight: "800" }}>{CHANCE_OUTCOME_LABEL[ch.outcome as ChanceOutcome] ?? ch.outcome}</Text>
            </View>
          ))}
        </Card>
      </Press>

      {stats.simmed ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile label="Goals" value={stats.goals} color={stats.goals ? C.green : C.text} />
          <Tile label="Assists" value={stats.assists} color={stats.assists ? C.green : C.text} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile label="Chances" value={stats.chances} />
          <Tile label="Goals" value={stats.goals} color={stats.goals ? C.green : C.text} />
          <Tile label="Assists" value={stats.assists} color={stats.assists ? C.green : C.text} />
          <Tile label="Passes" value={stats.passes} />
        </View>
      )}

      {/* Boss, team and fans: where each was, sliding to where it is now. */}
      <Card>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <MoveBar label="Boss" from={report.rel.before.boss} to={report.rel.after.boss} />
          <MoveBar label="Team" from={report.rel.before.team} to={report.rel.after.team} />
          <MoveBar label="Fans" from={report.rel.before.fans} to={report.rel.after.fans} />
        </View>
      </Card>

      {!stats.simmed && (
        <Card tone="rgba(245,197,66,0.35)">
          <Label>Pay</Label>
          <Row k="Wage" v={money(stats.wage)} />
          <Row k="Goal Bonus" v={money(stats.goalBonus)} />
          <Row k="Sponsors" v={money(stats.sponsorPay)} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#059669", borderRadius: 12, padding: 12, marginTop: 6 }}>
            <Text style={{ color: C.text, fontWeight: "900" }}>Total Cash</Text>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 17 }}>{money(stats.totalCash)}</Text>
          </View>
        </Card>
      )}
      {report.energyBack ? <Text style={{ color: C.green, textAlign: "center", fontWeight: "800" }}>⚡ +{report.energyBack} energy back from the rest days</Text> : null}

      {!allSeen && (
        <Card tone={C.gold}>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11, letterSpacing: 2 }}>ACHIEVEMENT {seen + 1} OF {achs.length}</Text>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 18, marginTop: 4 }}>🏅 {achs[seen].label}</Text>
          <Text style={{ color: C.dim, marginTop: 4 }}>{achs[seen].description}</Text>
          <View style={{ marginTop: 10 }}><Btn small kind="gold" label="Next" onPress={() => setSeen((k) => k + 1)} /></View>
        </Card>
      )}
    </Frame>
  );
}

function Side({ club, you }: { club: string; you: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <ClubCrest club={club} size={52} />
      <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", marginTop: 6 }}>{shortClub(club)}</Text>
      <Text style={{ color: C.green, fontSize: 9, fontWeight: "900", letterSpacing: 2, opacity: you ? 1 : 0 }}>YOU</Text>
    </View>
  );
}
function Digit({ n }: { n: number }) {
  return (
    <View style={{ minWidth: 46, height: 54, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
      <Text style={{ color: "#0b0f0d", fontSize: 34, fontWeight: "900" }}>{n}</Text>
    </View>
  );
}
