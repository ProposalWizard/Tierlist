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
import { careerOverview } from "@/lib/star/careerOverview";
import { clubGlow } from "../../world/ui";
import * as flow from "../../game/flow";
import { useNav } from "../../nav";
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
  const nav = useNav();
  const stats = career.lastSeasonAwardStats;
  if (!stats) return <Frame title="Season awards"><Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} /></Frame>;
  // The website's order and words (SeasonAwardsScreen.tsx AWARD_META): trophies first, then the league's awards.
  const awards: [string, string, typeof stats.goldenBoot, string][] = [
    ["👟", "Golden Boot", stats.goldenBoot, "goals"], ["🎯", "Assist King", stats.assistKing, "assists"], ["🧤", "Golden Glove", stats.goldenGlove, "clean sheets"],
    ["🌟", "Player of the Season", stats.playerOfSeason, "votes"], ["💎", "Young Player of the Season", stats.youngPlayerOfSeason, "votes"],
  ];
  const trophies = trophyWinners(career, stats);
  return (
    <Frame kicker={`Season ${stats.season}`} title="Season Awards"
      footer={<Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} />}>
      <Card>
        <Label>Trophies</Label>
        {trophies.map((t) => <Row key={t.competition} k={t.competition} v={t.club ? `${shortClub(t.club)}${t.isYou ? " (You)" : ""}` : "Not contested this season"} color={t.isYou ? C.green : C.text} />)}
      </Card>
      <Card>
        <Label>{`${stats.leagueName} Awards`}</Label>
        {awards.map(([icon, name, w, unit]) => (
          <Row key={name} k={`${icon} ${name}`} sub={w ? `${w.name}${w.isYou ? " (You)" : ""} · ${shortClub(w.club)}` : "No qualifying player this season"} v={w ? `${w.value} ${unit}` : ""} color={w?.isYou ? C.green : C.text} />
        ))}
      </Card>
      {stats.teamOfSeason.length > 0 && (
        <Card>
          <Label>Team of the Season</Label>
          {stats.teamOfSeason.map((m, i) => <Row key={i} k={`${m.label ?? m.role} · ${m.name}`} v={shortClub(m.club)} color={m.isYou ? C.green : C.text} />)}
        </Card>
      )}
      {(career.lastSeasonRecords?.length ?? 0) > 0 && (
        <Card tone={C.gold}>
          <Label>Your records broken</Label>
          {career.lastSeasonRecords!.map((r) => <Row key={r.label + r.unlocked} k={`🏆 ${r.label}`} v="" sub={r.unlocked} />)}
        </Card>
      )}
      {career.lastWorld && <Btn kind="plain" label="🌍 Every league and cup" onPress={() => nav.go("season-review")} />}
    </Frame>
  );
}

/** The career as bars, one per season, in each club's colour; the last season gold (CareerEnd.tsx SeasonTrack). */
function SeasonTrack({ career, endLabel }: { career: CareerState; endLabel?: string }) {
  const played = career.season;
  const cap = CAREER_SEASONS ?? Math.max(played + 1, 1);
  const o = useMemo(() => careerOverview(career), [career]);
  const firstAge = o.seasons[0]?.age ?? career.player.age - (career.season - 1);
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        {Array.from({ length: cap }, (_, k) => {
          const season = k + 1, last = season === cap, done = season <= played;
          const club = o.seasons[k]?.club;
          return <View key={season} style={{ flex: 1, height: last ? 30 : 22, borderRadius: 2, opacity: done || last ? 1 : 0.6,
            backgroundColor: last ? C.gold : done ? (club ? clubGlow(club) : "rgba(255,255,255,0.35)") : "rgba(255,255,255,0.08)" }} />;
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ color: C.dim, fontSize: 11, fontWeight: "900" }}>Age {firstAge}</Text>
        <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900" }}>{endLabel ?? `Last season · age ${firstAge + cap - 1}`}</Text>
      </View>
    </Card>
  );
}

export function FinalSeasonScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const cap = CAREER_SEASONS ?? career.season + 1;
  return (
    <Frame kicker={`Season ${career.season} is over`} title="Final season" footer={<Btn label="Continue" onPress={() => go(flow.playOn())} />}>
      <Card tone={C.gold}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>Season {cap} is your last before retirement.</Text>
        <Text style={{ color: "#fde68a", fontSize: 16, fontWeight: "800", marginTop: 4 }}>End your career the right way.</Text>
      </Card>
      <SeasonTrack career={career} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <ClubCrest club={career.player.club} size={22} />
        <Text style={{ color: C.text, fontWeight: "700", flexShrink: 1 }}>Stay at {shortClub(career.player.club)}, or choose a club for the last one.</Text>
      </View>
    </Frame>
  );
}

export function RetirementScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const v = careerVerdict(career);
  const t = testimonialFor(career);
  const s = career.careerStats;
  return (
    <Frame kicker={`${CAREER_SEASONS ?? career.season} seasons`} title="The final whistle" footer={<Btn label="🥾 Hang them up" onPress={() => go(flow.retireNow())} />}>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>That was your last season. Time to hang them up.</Text>
      <SeasonTrack career={career} endLabel={`Age ${career.player.age} · the end`} />
      <Card tone={C.gold}>
        <Text style={{ color: C.gold, fontSize: 22, fontWeight: "900", textAlign: "center" }}>{v.title}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
          {([["Apps", s.appearances], ["Goals", s.goals], ["Trophies", career.trophies.length]] as const).map(([label, value]) => (
            <View key={label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 6, paddingVertical: 8, alignItems: "center" }}>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: "900" }}>{value}</Text>
              <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>{label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </Card>
      {t && (
        <Card tone={C.gold} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ClubCrest club={t.club} size={26} />
          <Text style={{ flex: 1, color: C.text, fontWeight: "800" }}>{shortClub(t.club)} put on a testimonial for you</Text>
          <Text style={{ color: "#fde68a", fontSize: 18, fontWeight: "900" }}>{money(t.payout)}</Text>
        </Card>
      )}
    </Frame>
  );
}
