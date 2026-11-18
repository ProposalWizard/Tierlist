/**
 * STATS, as the website's Stats page (components/star/StatsTabs.tsx): your
 * card, then four tabs: Stats (this season over your career, season by
 * season, the cabinet, per club), Records (your bests, the real-world
 * records), Achievements (group by group), Contract (the paper, and asking
 * for a new deal).
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { careerOverview, shortSeason } from "@/lib/star/careerOverview";
import { RECORDS } from "@/lib/star/records";
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS } from "@/lib/star/achievements";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { shortClub } from "@/lib/star/media/grammar";
import { starStatus } from "@/lib/star/starPoints";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Row, Btn, Tile, ClubCrest, PlayerStandIn, Fill, money, C, R } from "./kit";

type View_ = "stats" | "records" | "achievements" | "contract";
const VIEWS: { id: View_; label: string; icon: string }[] = [
  { id: "stats", label: "Stats", icon: "📊" }, { id: "records", label: "Records", icon: "📜" },
  { id: "achievements", label: "Achievements", icon: "🏅" }, { id: "contract", label: "Contract", icon: "✍️" },
];
let lastView: View_ = "stats";

export function StatsScreen({ career, onBack, onRenew, start }: { career: CareerState; onBack: () => void; onRenew: () => void; start?: View_ }) {
  const [view, setV] = useState<View_>(start ?? lastView);
  const setView = (v: View_) => { lastView = v; setV(v); };
  const p = career.player;
  return (
    <Frame title="Stats" onBack={onBack}>
      {/* Your card (PlayerCard). */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <PlayerStandIn club={career.player.club} number={career.squadNumber} size={84} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>{p.firstName} {p.lastName}</Text>
          {p.nickname ? <Text style={{ color: C.gold, fontWeight: "800" }}>“{p.nickname}”</Text> : null}
          <Text style={{ color: C.dim, marginTop: 2 }}>{p.position} · {p.nationality} · Age {p.age}</Text>
          <Text style={{ color: C.text, marginTop: 4, fontWeight: "800" }}>★ {starStatus(career).stars} · {shortClub(career.player.club)}</Text>
        </View>
      </Card>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {VIEWS.map((v) => (
          <Press key={v.id} onPress={() => setView(v.id)} style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 6, backgroundColor: view === v.id ? C.gold : C.panel }}>
            <Text style={{ fontSize: 18 }}>{v.icon}</Text>
            <Text numberOfLines={1} style={{ color: view === v.id ? "#111" : C.text, fontWeight: "900", fontSize: 11, marginTop: 2 }}>{v.label.toUpperCase()}</Text>
          </Press>
        ))}
      </View>
      {view === "stats" && <StatsTab career={career} />}
      {view === "records" && <RecordsTab career={career} />}
      {view === "achievements" && <AchievementsTab career={career} />}
      {view === "contract" && <ContractTab career={career} onRenew={onRenew} />}
    </Frame>
  );
}

function StatsTab({ career }: { career: CareerState }) {
  const o = useMemo(() => careerOverview(career), [career]);
  const seasonTrophies = career.trophies.filter((t) => t.season === career.season).length;
  const team = o.honours.filter((h) => h.competition !== "Golden Ball");
  const awards = [...o.honours.filter((h) => h.competition === "Golden Ball"), ...o.individual];
  return (
    <>
      <Label color={C.dim}>This season · career below</Label>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Tile label="Apps" value={career.seasonStats.appearances} sub={`${career.careerStats.appearances} career`} />
        <Tile label="Goals" value={career.seasonStats.goals} sub={`${career.careerStats.goals} career`} />
        <Tile label="Assists" value={career.seasonStats.assists} sub={`${career.careerStats.assists} career`} />
        <Tile label="Trophies" value={seasonTrophies} color={seasonTrophies ? C.gold : C.text} sub={`${career.trophies.length} career`} />
      </View>
      <Card>
        <Label>Season by season</Label>
        {[...o.seasons].reverse().map((s) => (
          <View key={s.season} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: C.gold, fontWeight: "900", width: 52 }}>{s.label}</Text>
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800", flex: 1 }}>{shortClub(s.club)}{s.live ? " · now" : ""}</Text>
              <Text style={{ color: C.dim }}>{s.stats ? `${s.stats.apps} · ${s.stats.goals}G · ${s.stats.assists}A` : "—"}</Text>
            </View>
            {(s.trophies.length > 0 || s.awards.length > 0) && <Text style={{ color: C.gold, fontSize: 12, marginTop: 2, marginLeft: 60 }}>{[...s.trophies, ...s.awards].join(" · ")}</Text>}
          </View>
        ))}
      </Card>
      <Card>
        <Label>{`The cabinet · ${o.totals.trophies}`}</Label>
        {team.length ? team.map((h) => <Row key={h.competition} k={`🏆 ${h.competition}`} v={`×${h.count}`} sub={h.seasons.join(", ")} />) : <Text style={{ color: C.dim }}>Nothing on the shelf yet.</Text>}
        {awards.length > 0 && <View style={{ marginTop: 8 }}><Label color={C.dim}>Your awards</Label>{awards.map((h) => <Row key={h.competition} k={`🏅 ${h.competition}`} v={`×${h.count}`} sub={h.seasons.join(", ")} />)}</View>}
      </Card>
      <Card>
        <Label>Per club</Label>
        {o.clubs.map((cl) => (
          <View key={cl.club} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <ClubCrest club={cl.club} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>{shortClub(cl.club)}</Text>
              <Text style={{ color: C.dim, fontSize: 11 }}>{cl.years} · {cl.seasons} season{cl.seasons === 1 ? "" : "s"}</Text>
            </View>
            <Text style={{ color: C.text, fontWeight: "800" }}>{cl.apps} · {cl.goals}G · {cl.assists}A</Text>
          </View>
        ))}
      </Card>
      {(career.caps ?? 0) > 0 && (
        <Card><Label>Your country</Label><Row k={career.player.nationality} v={`${career.caps} caps · ${career.internationalGoals ?? 0} goals`} /></Card>
      )}
    </>
  );
}

function RecordsTab({ career }: { career: CareerState }) {
  const b = career.careerBests ?? {};
  const s = (n: number) => `Season ${shortSeason(career.player.startYear, n)}`;
  const vs = (o: string) => `v ${shortClub(o)}`;
  return (
    <>
      <Card>
        <Label>Your bests</Label>
        <Row k="🚀 Furthest goal" v={b.furthestGoal ? `${b.furthestGoal.metres} m` : "—"} sub={b.furthestGoal ? `${vs(b.furthestGoal.opponent)} · ${s(b.furthestGoal.season)}` : undefined} />
        <Row k="🎯 Furthest assist (your pass)" v={b.furthestAssist ? `${b.furthestAssist.metres} m` : "—"} sub={b.furthestAssist ? `${vs(b.furthestAssist.opponent)} · ${s(b.furthestAssist.season)}` : undefined} />
        <Row k="⚽ Most goals in a game" v={b.mostGoalsMatch ? String(b.mostGoalsMatch.goals) : "—"} sub={b.mostGoalsMatch ? `${vs(b.mostGoalsMatch.opponent)} · ${s(b.mostGoalsMatch.season)}` : undefined} />
        <Row k="📈 Most goals in a season" v={b.mostGoalsSeason ? String(b.mostGoalsSeason.goals) : "—"} sub={b.mostGoalsSeason ? s(b.mostGoalsSeason.season) : undefined} />
        <Row k="🅰️ Most assists in a season" v={b.mostAssistsSeason ? String(b.mostAssistsSeason.assists) : "—"} sub={b.mostAssistsSeason ? s(b.mostAssistsSeason.season) : undefined} />
        <Row k="🎁 Most assists in a game" v={b.mostAssistsMatch ? String(b.mostAssistsMatch.assists) : "—"} sub={b.mostAssistsMatch ? `${vs(b.mostAssistsMatch.opponent)} · ${s(b.mostAssistsMatch.season)}` : undefined} />
        <Row k="⏱️ Fastest goal" v={b.fastestGoal ? `${b.fastestGoal.minute}'` : "—"} sub={b.fastestGoal ? `${vs(b.fastestGoal.opponent)} · ${s(b.fastestGoal.season)}` : undefined} />
        <Row k="💥 Biggest win" v={b.biggestWin ? `${b.biggestWin.us}–${b.biggestWin.them}` : "—"} sub={b.biggestWin ? `${vs(b.biggestWin.opponent)} · ${s(b.biggestWin.season)}` : undefined} />
        <Row k="🔥 Longest scoring run" v={career.feats?.bestScoringRun ? `${career.feats.bestScoringRun} game${career.feats.bestScoringRun === 1 ? "" : "s"}` : "—"} sub={career.feats?.bestScoringRunSeason ? s(career.feats.bestScoringRunSeason) : undefined} />
        <Row k="🧢 Caps" v={String(career.caps ?? 0)} sub={(career.internationalGoals ?? 0) > 0 ? `${career.internationalGoals} international goals` : undefined} />
      </Card>
      <Card>
        <Label>{`Real-world records · ${RECORDS.filter((r) => r.progress(career) >= r.value).length} beaten`}</Label>
        {RECORDS.map((r) => {
          const pr = r.progress(career);
          return (
            <View key={r.id} style={{ paddingVertical: 7 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: C.text, fontWeight: "800", flex: 1 }}>{r.label}</Text>
                <Text style={{ color: pr >= r.value ? C.green : C.text, fontWeight: "900" }}>{pr} / {r.value}</Text>
              </View>
              <Text style={{ color: C.dim, fontSize: 11, marginBottom: 4 }}>{r.holder} · {r.achieved}</Text>
              <Fill value={(pr / r.value) * 100} color={pr >= r.value ? C.green : C.gold} height={5} />
            </View>
          );
        })}
      </Card>
    </>
  );
}

function AchievementsTab({ career }: { career: CareerState }) {
  const done = new Set(career.achievements);
  const got = ACHIEVEMENTS.filter((a) => done.has(a.id)).length;
  // A plain list, group by group: it sits inside the page's own scroll (a
  // FlatList inside a ScrollView would fight it for the finger).
  return (
    <Card>
      <Label>{`${got} of ${ACHIEVEMENTS.length} unlocked`}</Label>
      {ACHIEVEMENT_GROUPS.map((g) => (
        <View key={g}>
          <Text style={{ color: C.gold, fontWeight: "900", marginTop: 12, marginBottom: 4 }}>{g}</Text>
          {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
            const on = done.has(a.id);
            return (
              <View key={a.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, opacity: on ? 1 : 0.5 }}>
                <Text style={{ fontSize: 22, width: 30 }}>{on ? a.icon : "🔒"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: on ? C.text : C.dim, fontWeight: "900" }}>{a.label}</Text>
                  <Text style={{ color: C.dim, fontSize: 12 }}>{a.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function ContractTab({ career, onRenew }: { career: CareerState; onRenew: () => void }) {
  const c = career.contract;
  const clauses = clauseSummary(c);
  return (
    <Card style={{ backgroundColor: "#f4efe2", borderRadius: R.card }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <ClubCrest club={c.club} size={34} />
        <View>
          <Text style={{ color: "#1c1917", fontWeight: "900", fontSize: 17 }}>{c.club}</Text>
          <Text style={{ color: "#57534e", fontSize: 12 }}>Player contract</Text>
        </View>
      </View>
      {([
        ["League", leagueNameFor(divisionOf(career))], ["Position", career.player.position],
        ["Shirt", career.squadNumber ? `No. ${career.squadNumber}` : "—"], ["Seasons left", String(c.seasonsRemaining)],
        ["Wage", `${money(c.wage)} / week`], ["Goal bonus", money(c.goalBonus)], ["Assist bonus", money(c.assistBonus)],
      ] as [string, string][]).map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(120,90,40,0.25)" }}>
          <Text style={{ color: "#57534e", fontWeight: "800", fontSize: 12 }}>{k.toUpperCase()}</Text>
          <Text style={{ color: "#1c1917", fontWeight: "900" }}>{v}</Text>
        </View>
      ))}
      <Text style={{ color: "#57534e", fontWeight: "900", marginTop: 10, fontSize: 12 }}>CLAUSES</Text>
      {clauses.length ? clauses.map((cl) => <Text key={cl.label} style={{ color: "#1c1917", marginTop: 4 }}>• {cl.label}: {cl.detail}</Text>) : <Text style={{ color: "#57534e", marginTop: 4 }}>None.</Text>}
      <Text style={{ color: "#1c1917", fontStyle: "italic", fontSize: 18, marginTop: 14 }}>{career.player.firstName} {career.player.lastName}</Text>
      <View style={{ marginTop: 12 }}><Btn label="Ask for a new deal" onPress={onRenew} /></View>
    </Card>
  );
}
