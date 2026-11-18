/**
 * THE END OF THE SEASON, in page.tsx's order: the Golden Ball night (a text
 * version of BallonDorNight / BallonDor: the shortlist from tenth to first),
 * the final-season notice or the final whistle, then (after the rollover) the
 * season's awards (SeasonAwardsScreen: the individual awards, every trophy
 * handed out, the Team of the Season).
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { computeBallonDorShortlist } from "@/lib/star/ballonDor";
import { trophyWinners } from "@/lib/star/seasonAwards";
import { careerVerdict, testimonialFor, CAREER_SEASONS } from "@/lib/star/retirement";
import { shortClub } from "@/lib/star/media/grammar";
import * as flow from "../../game/flow";
import { Frame, Card, Label, Row, Btn, ClubCrest, money, C } from "./kit";

export function GoldenBallScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const result = useMemo(() => computeBallonDorShortlist(career), [career]);
  const { entries, playerRank, playerNominated } = result;
  const [shown, setShown] = useState(entries.length < 3 ? entries.length : 0);
  const won = playerRank === 1;
  const all = shown >= entries.length;
  // Revealed from the bottom of the list up, the winner last.
  const revealed = entries.slice(entries.length - shown);
  return (
    <Frame kicker={`Season ${career.season}`} title="The Golden Ball"
      footer={all ? <Btn kind="gold" label="Continue" onPress={() => go(flow.ballonDorContinue(won))} />
        : <Btn kind="gold" label={shown === entries.length - 1 ? "And the winner is…" : `Reveal ${ordinalPlace(entries.length - shown)}`} onPress={() => setShown((n) => n + 1)} />}>
      <Card tone={C.gold}>
        <Text style={{ color: C.text, fontSize: 15 }}>
          {playerNominated ? `You are on the shortlist of ${entries.length}.` : "You are not on the shortlist this year."}
        </Text>
      </Card>
      {[...revealed].reverse().map((e) => (
        <Card key={`${e.rank}-${e.name}`} tone={e.rank === 1 ? C.gold : e.isPlayer ? C.green : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: e.rank === 1 ? C.gold : C.dim, fontSize: 22, fontWeight: "900", width: 34 }}>{e.rank}</Text>
            <ClubCrest club={e.club} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: e.isPlayer ? C.green : C.text, fontWeight: "900", fontSize: 16 }}>{e.name}{e.isPlayer ? " (you)" : ""}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{shortClub(e.club)} · {e.goals} goals · {e.assists} assists · {e.rating.toFixed(1)}</Text>
              {e.trophies.length > 0 && <Text style={{ color: C.gold, fontSize: 12 }}>{e.trophies.join(" · ")}</Text>}
            </View>
          </View>
        </Card>
      ))}
      {all && won && <Text style={{ color: C.gold, fontSize: 22, fontWeight: "900", textAlign: "center" }}>🏆 You have won the Golden Ball!</Text>}
    </Frame>
  );
}
const ordinalPlace = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} place`;

export function SeasonAwardsScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const stats = career.lastSeasonAwardStats;
  if (!stats) return <Frame title="Season awards"><Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} /></Frame>;
  const awards: [string, typeof stats.goldenBoot, string][] = [
    ["Golden Boot", stats.goldenBoot, "goals"], ["Most assists", stats.assistKing, "assists"], ["Golden Glove", stats.goldenGlove, "clean sheets"],
    ["Young Player of the Season", stats.youngPlayerOfSeason, ""], ["Player of the Season", stats.playerOfSeason, ""],
  ];
  const trophies = trophyWinners(career, stats);
  return (
    <Frame kicker={stats.leagueName} title={`Season ${stats.season} awards`}
      footer={<Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} />}>
      <Card>
        <Label>Awards</Label>
        {awards.map(([name, w, unit]) => (
          <Row key={name} k={name} sub={w ? `${w.name} · ${shortClub(w.club)}` : "—"} v={w ? (unit ? `${w.value} ${unit}` : w.isYou ? "You!" : "") : ""} color={w?.isYou ? C.green : C.text} />
        ))}
      </Card>
      <Card>
        <Label>Trophies</Label>
        {trophies.map((t) => <Row key={t.competition} k={t.competition} v={t.club ? `${shortClub(t.club)}${t.isGuess ? " ?" : ""}` : "—"} color={t.isYou ? C.green : C.text} />)}
      </Card>
      {stats.teamOfSeason.length > 0 && (
        <Card>
          <Label>Team of the Season</Label>
          {stats.teamOfSeason.map((m, i) => <Row key={i} k={`${m.label ?? m.role} · ${m.name}`} v={shortClub(m.club)} color={m.isYou ? C.green : C.text} />)}
        </Card>
      )}
    </Frame>
  );
}

export function FinalSeasonScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const cap = CAREER_SEASONS ?? career.season + 1;
  return (
    <Frame kicker={`Season ${career.season} is over`} title="Final season" footer={<Btn label="Continue" onPress={() => go(flow.playOn())} />}>
      <Card tone={C.gold}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Season {cap} is your last before retirement.</Text>
        <Text style={{ color: C.text, marginTop: 8 }}>End your career the right way.</Text>
        <Text style={{ color: C.dim, marginTop: 12 }}>Stay at {shortClub(career.player.club)}, or choose a club for the last one.</Text>
      </Card>
    </Frame>
  );
}

export function RetirementScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const v = careerVerdict(career);
  const t = testimonialFor(career);
  const s = career.careerStats;
  return (
    <Frame kicker={`${CAREER_SEASONS ?? career.season} seasons`} title="The final whistle" footer={<Btn label="🥾 Hang them up" onPress={() => go(flow.retireNow())} />}>
      <Card tone={C.gold}>
        <Text style={{ color: C.gold, fontSize: 20, fontWeight: "900" }}>{v.title}</Text>
        <Text style={{ color: C.text, marginTop: 6 }}>{v.summary}</Text>
      </Card>
      <Card>
        <Row k="Appearances" v={String(s.appearances)} />
        <Row k="Goals" v={String(s.goals)} />
        <Row k="Assists" v={String(s.assists)} />
        <Row k="Trophies" v={String(career.trophies.length)} />
        <Row k="Clubs" v={String(v.clubs.length)} />
        {t && <Row k={`Testimonial at ${shortClub(t.club)}`} v={money(t.payout)} />}
      </Card>
    </Frame>
  );
}
