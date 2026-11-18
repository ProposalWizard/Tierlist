/**
 * THE END OF A CAREER (page.tsx: farewell-invite, farewell-sheets,
 * farewell-walkout, farewell-match, farewell-result, legacy) and the Hall of
 * Fame (the title screen's door; HallOfFame.tsx).
 *
 * The farewell sides are the game's own (lib/star/farewell.ts farewellSides).
 * The match itself is a STAND-IN until the match area can play a farewell
 * (CanvasMatch with farewell.offAt): flow.playFarewell plays it out with the
 * game's own match simulator on the farewell's stand-in career and seed.
 * The guard of honour and the standing ovation are 3D: not on the phone.
 */
import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { FAREWELL_OFF_AT, RIVALS_KITS, type FarewellSides } from "@/lib/star/farewell";
import { testimonialFor, CAREER_SEASONS } from "@/lib/star/retirement";
import { careerOverview } from "@/lib/star/careerOverview";
import { shortNameOf } from "@/lib/star/realSquad";
import { shortClub } from "@/lib/star/media/grammar";
import { formatMoney } from "@/lib/star/money";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import type { HallEntry } from "@/lib/star/hallOfFame";
import * as flow from "../../game/flow";
import { usePhoneHall, removeFromPhoneHall } from "../../world/hall";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Row, Btn, ClubCrest, StandInNote, Tile, C } from "./kit";

function names(ids: (string | null)[], pool: { id: string; name: string }[], youName?: string): string[] {
  return ids.filter((x): x is string => !!x).map((id) => (id === "you" ? youName ?? "You" : shortNameOf(pool.find((p) => p.id === id)?.name ?? id)));
}
function Side({ title, club, list, gold }: { title: string; club?: string; list: string[]; gold?: boolean }) {
  return (
    <Card tone={gold ? C.gold : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {club ? <ClubCrest club={club} size={26} /> : <View style={{ width: 26, height: 26, borderRadius: 3, backgroundColor: RIVALS_KITS.home.shirt, alignItems: "center", justifyContent: "center" }}><Text style={{ color: RIVALS_KITS.home.trim, fontWeight: "900", fontSize: 10 }}>XI</Text></View>}
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 15, flex: 1 }}>{title}</Text>
      </View>
      <Text style={{ color: C.text, fontSize: 12, lineHeight: 18 }}>{list.join(" · ")}</Text>
    </Card>
  );
}

export function FarewellInviteScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f = flow.currentFarewell();
  if (!f) return <Frame title="Retired"><Btn label="Continue" onPress={() => go(flow.retireWith())} /></Frame>;
  const sides: FarewellSides = f.sides;
  const why = whyLines(sides);
  const you = `${career.player.firstName[0]}. ${career.player.lastName}`;
  return (
    <Frame kicker="One last game" title="Your farewell match"
      footer={<View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Btn kind="plain" label="⏭ Skip" onPress={() => go(flow.skipFarewell())} /></View>
        <View style={{ flex: 1.6 }}><Btn kind="gold" label="▶ Play it" onPress={() => go({ screen: "career-farewell-sheets" })} /></View>
      </View>}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <ClubCrest club={sides.host} size={26} />
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{shortClub(sides.host)} want to say goodbye.</Text>
      </View>
      <Side title={sides.ours.name} club={sides.host} list={names(sides.ours.lineup.xi, sides.ours.players, you)} gold />
      <Side title={sides.rivals.name} list={names(sides.rivals.lineup.xi, sides.rivals.players)} />
      {why.map((w) => <Text key={w} numberOfLines={1} style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>{w}</Text>)}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[["⚽", "Every chance is yours"], ["⚡", "No energy"], ["👏", `Off at ${FAREWELL_OFF_AT}'`]].map(([i, t]) => (
          <View key={t} style={{ flex: 1, backgroundColor: "rgba(255,255,255,.05)", borderRadius: 6, paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 18 }}>{i}</Text>
            <Text style={{ color: C.text, fontSize: 10, fontWeight: "900", marginTop: 4, textAlign: "center" }}>{t.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}
function whyLines(sides: FarewellSides): string[] {
  {
    const xi = new Set(sides.rivals.lineup.xi.filter((id): id is string => !!id));
    const starters = sides.rivals.who.filter((r) => xi.has(r.id));
    const golden = starters.filter((r) => r.ballonDor).slice(0, 2).map((r) => `🏅 ${shortNameOf(r.name)} · ${r.why}`);
    const clubs: string[] = [];
    const seen = new Set<string>();
    for (const r of starters) {
      if (r.ballonDor || seen.has(r.club) || r.why === "One of the best around" || r.why === "A rival") continue;
      seen.add(r.club);
      clubs.push(`🏆 ${shortClub(r.club)} · ${r.why}`);
    }
    return [...golden, ...clubs.slice(0, 2)];
  }
}

/** The team sheets (VersusScreen), then kick off. */
export function FarewellSheetsScreen({ career, go, onBack }: { career: CareerState; go: (s: flow.Step) => void; onBack: () => void }) {
  const f = flow.currentFarewell();
  if (!f) return <Frame title="Retired"><Btn label="Continue" onPress={() => go(flow.retireWith())} /></Frame>;
  const you = `${career.player.firstName[0]}. ${career.player.lastName}`;
  return (
    <Frame kicker="Farewell match" title="One last game" onBack={onBack} footer={<Btn kind="gold" label="KICK OFF" onPress={() => go(flow.playFarewell())} />}>
      <Side title={f.sides.ours.name} club={f.sides.host} list={names(f.sides.ours.lineup.xi, f.sides.ours.players, you)} gold />
      <Side title={`Bench`} club={f.sides.host} list={names(f.sides.ours.lineup.bench ?? [], f.sides.ours.players)} />
      <Side title={f.sides.rivals.name} list={names(f.sides.rivals.lineup.xi, f.sides.rivals.players)} />
      <StandInNote>Stand-in: the farewell is played out by the game's match simulator until the match area can play it on the phone. The guard of honour and the standing ovation are 3D and not on the phone yet.</StandInNote>
    </Frame>
  );
}

export function FarewellResultScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const f = flow.currentFarewell();
  const stats = f?.stats;
  if (!f || !stats) return <Frame title="Full time"><Btn label="🥾 Hang them up" onPress={() => go(flow.finishFarewell())} /></Frame>;
  const t = testimonialFor(career);
  const us = stats.homeScore, them = stats.awayScore;
  const verdict = us > them ? "A win to finish" : us === them ? "All square" : "The rivals spoil it";
  const ours = [...(stats.goalEvents ?? [])].sort((a, b) => a.minute - b.minute).map((g) => ({ you: g.isUserGoal, text: `${g.minute}' ${g.isUserGoal ? "You" : shortNameOf(g.scorer)}` }));
  const theirs = [...(stats.oppGoalEvents ?? [])].sort((a, b) => a.minute - b.minute).map((g) => `${g.minute}' ${shortNameOf(g.scorer)}`);
  return (
    <Frame kicker="Full time · Farewell" title={verdict} footer={<Btn kind="gold" label="🥾 Hang them up" onPress={() => go(flow.finishFarewell())} />}>
      <Card tone={C.gold}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, alignItems: "center" }}><ClubCrest club={f.sides.host} size={40} /><Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 12, marginTop: 4 }}>{f.sides.ours.name}</Text></View>
          <Text style={{ color: C.text, fontSize: 40, fontWeight: "900" }}>{us}–{them}</Text>
          <View style={{ flex: 1, alignItems: "center" }}><View style={{ width: 40, height: 40, borderRadius: 3, backgroundColor: RIVALS_KITS.home.shirt, alignItems: "center", justifyContent: "center" }}><Text style={{ color: RIVALS_KITS.home.trim, fontWeight: "900" }}>XI</Text></View><Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 12, marginTop: 4 }}>{f.sides.rivals.name}</Text></View>
        </View>
        {(ours.length > 0 || theirs.length > 0) && (
          <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}>
            <View style={{ flex: 1 }}>{ours.map((g, i) => <Text key={i} style={{ color: g.you ? "#fde68a" : C.text, textAlign: "right", fontSize: 12, fontWeight: "700" }}>{g.text} ⚽</Text>)}</View>
            <View style={{ flex: 1 }}>{theirs.map((g, i) => <Text key={i} style={{ color: C.text, fontSize: 12, fontWeight: "700" }}>⚽ {g}</Text>)}</View>
          </View>
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tile label="Goals" value={stats.goals} /><Tile label="Assists" value={stats.assists} /><Tile label="Rating" value={(Math.round((stats.rating ?? 0) * 10) / 10).toFixed(1)} />
      </View>
      <Card><Text style={{ color: C.text, fontWeight: "800" }}>👏 Off at {FAREWELL_OFF_AT}' to a standing ovation</Text></Card>
      {t && <Card><Row k={`${shortClub(t.club)} pay your testimonial`} v={`★${formatMoney(t.payout)}`} color="#fde68a" /></Card>}
    </Frame>
  );
}

// ── The career overview (CareerOverview.tsx: the legacy screen) ──
export function OverviewBody({ career }: { career: CareerState }) {
  const o = useMemo(() => careerOverview(career, { calendarYears: leoUpdateOn("bugFixes") }), [career]);
  return (
    <>
      <Card tone={C.gold} style={{ alignItems: "center" }}>
        <Text style={{ color: C.gold, fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{`${o.nation} · ${o.position} · ${o.years}`.toUpperCase()}</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: 4 }}>{o.name}</Text>
        <Text style={{ color: C.gold, fontSize: 16, fontWeight: "900", marginTop: 6 }}>{o.verdict.title}</Text>
        <Text style={{ color: C.text, marginTop: 4, textAlign: "center" }}>{o.verdict.summary}</Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tile label="Apps" value={o.totals.apps} /><Tile label="Goals" value={o.totals.goals} color={C.green} /><Tile label="Assists" value={o.totals.assists} color="#f59e0b" />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Tile label="Trophies" value={o.totals.trophies} color={C.gold} /><Tile label="Golden Balls" value={o.totals.ballonDors} color={C.gold} /><Tile label="Caps" value={o.totals.caps} />
      </View>
      {o.farewell?.played && <Card><Text style={{ color: C.text, fontWeight: "800" }}>Farewell at {shortClub(o.farewell.club)}: {o.farewell.yourScore}–{o.farewell.theirScore} v {o.farewell.opponent}{o.farewell.goals ? ` · ${o.farewell.goals} goal${o.farewell.goals === 1 ? "" : "s"}` : ""}</Text></Card>}
      {o.honours.length > 0 && (
        <Card>
          <Label>Honours</Label>
          {o.honours.map((h) => <Row key={h.competition} k={h.competition} sub={h.seasons.join(", ")} v={`×${h.count}`} color={C.gold} />)}
          {o.individual.map((h) => <Row key={h.competition} k={h.competition} sub={h.seasons.join(", ")} v={`×${h.count}`} />)}
        </Card>
      )}
      <Card>
        <Label>Clubs</Label>
        {o.clubs.map((c) => (
          <View key={c.club + c.firstSeason} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <ClubCrest club={c.club} size={30} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "900" }}>{c.club}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{c.years} · {c.apps} apps · {c.goals} goals · {c.assists} assists</Text>
              {c.trophies.length > 0 && <Text style={{ color: C.gold, fontSize: 11 }}>{c.trophies.map((t) => `${t.competition}${t.count > 1 ? ` ×${t.count}` : ""}`).join(" · ")}</Text>}
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <Label>Season by season</Label>
        {o.seasons.map((s) => (
          <Row key={s.season} k={`${s.label} · ${shortClub(s.club)}`} sub={[...s.trophies, ...s.awards, s.ballonDorRank === 1 ? "Golden Ball" : ""].filter(Boolean).join(" · ") || undefined}
            v={s.stats ? `${s.stats.goals}G ${s.stats.assists}A` : "—"} />
        ))}
      </Card>
      {o.records.length > 0 && (
        <Card>
          <Label>Records</Label>
          {o.records.map((r, i) => <Row key={i} k={`${r.icon} ${r.label}`} v={String(r.value)} />)}
        </Card>
      )}
    </>
  );
}

export function LegacyScreen({ career, onHall, onNewCareer, onMenu }: { career: CareerState; onHall: () => void; onNewCareer: () => void; onMenu: () => void }) {
  return (
    <Frame kicker={`${CAREER_SEASONS ?? career.season} seasons`} title="Career overview"
      footer={<View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Btn kind="gold" small label="🏛️ Hall of Fame" onPress={onHall} /></View>
        <View style={{ flex: 1 }}><Btn small label="＋ New career" onPress={onNewCareer} /></View>
        <View style={{ flex: 0.7 }}><Btn kind="plain" small label="☰ Menu" onPress={onMenu} /></View>
      </View>}>
      <OverviewBody career={career} />
    </Frame>
  );
}

// ── The Hall of Fame ──
export function HallOfFameScreen({ onBack }: { onBack: () => void }) {
  const book = usePhoneHall();
  const [open, setOpen] = useState<HallEntry | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  if (open) {
    return (
      <Frame kicker="Hall of Fame" title={open.card.name} onBack={() => setOpen(null)}>
        <OverviewBody career={open.career} />
      </Frame>
    );
  }
  return (
    <Frame kicker="Your careers" title="Hall of Fame" onBack={onBack}>
      {book.entries.map((e) => (
        <Press key={e.id} onPress={() => setOpen(e)}>
          <Card tone={e.card.ballonDors ? C.gold : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ClubCrest club={e.card.mainClub} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{e.card.name}</Text>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800" }}>{e.card.title}</Text>
                <Text style={{ color: C.dim, fontSize: 12 }}>{e.card.position} · {e.card.nation} · {e.card.seasons} seasons from {e.card.firstYear}</Text>
                <Text style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{e.card.apps} apps · {e.card.goals} goals · {e.card.assists} assists · {e.card.trophies} trophies{e.card.ballonDors ? ` · ${e.card.ballonDors} Golden Ball${e.card.ballonDors === 1 ? "" : "s"}` : ""}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
              {armed === e.id ? (
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Press onPress={() => { setArmed(null); removeFromPhoneHall(e.id); }}><Text style={{ color: C.red, fontWeight: "900", fontSize: 12 }}>SURE?</Text></Press>
                  <Press onPress={() => setArmed(null)}><Text style={{ color: C.dim, fontWeight: "900", fontSize: 12 }}>NO</Text></Press>
                </View>
              ) : <Press onPress={() => setArmed(e.id)}><Text style={{ color: C.red, fontWeight: "900", fontSize: 11 }}>REMOVE</Text></Press>}
            </View>
          </Card>
        </Press>
      ))}
      {book.entries.length < 3 && Array.from({ length: 3 - book.entries.length }, (_, k) => (
        <View key={`empty-${k}`} style={{ height: 78, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
          {k === 0 ? <Text style={{ color: "rgba(255,255,255,0.45)", fontWeight: "900", fontSize: 12, letterSpacing: 1 }}>RETIRE A CAREER TO FILL THIS</Text> : null}
        </View>
      ))}
    </Frame>
  );
}
