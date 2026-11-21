/**
 * STATS, as the website's Stats page (components/star/StatsTabs.tsx) in the
 * packed app's look: the top bar, your FIFA-style card whole with the four
 * tabs stacked beside it (Stats, Records, Achievements, Contract), then the
 * tab: Stats (this season over your career, season by season, the cabinet,
 * goals and assists by season, per club, your country), Records (your bests,
 * the real-world records), Achievements (group by group), Contract (the
 * paper, and asking for a new deal). The bottom bar at the foot.
 */
import { useMemo, useState } from "react";
import { View, Text, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { careerOverview, shortSeason } from "@/lib/star/careerOverview";
import { RECORDS } from "@/lib/star/records";
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS } from "@/lib/star/achievements";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { shortClub } from "@/lib/star/media/grammar";
import { Press } from "../../ui/Press";
import { FONT, rgba } from "../../ui/look";
import { Frame, Card, Label, Row, Btn, ClubCrest, Fill, money, C, R } from "./kit";
import { PlayerCardView } from "./PlayerCard";
import { Heading, Blank, clubGlow } from "./lookBits";

import { AchievementWall, ContractPaper } from "./Achievements";
type View_ = "stats" | "records" | "achievements" | "contract";
const VIEWS: { id: View_; label: string; icon: string }[] = [
  { id: "stats", label: "Stats", icon: "📊" }, { id: "records", label: "Records", icon: "🏅" },
  { id: "achievements", label: "Achievements", icon: "⭐" }, { id: "contract", label: "Contract", icon: "📝" },
];
let lastView: View_ = "stats";

export function StatsScreen({ career, onBack, onRenew, start }: { career: CareerState; onBack: () => void; onRenew: () => void; start?: View_ }) {
  const [view, setV] = useState<View_>(start ?? lastView);
  const setView = (v: View_) => { lastView = v; setV(v); };
  return (
    <Frame title="Stats" top bar bare
      // The swipe hint back to Home (the website's SwipePages arrow on the Stats page).
      footer={<View style={{ height: 22, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingRight: 84 }}>
        <Press onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.85 }}>
          <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>HOME</Text>
          <Text style={{ fontSize: 12 }}>🏠</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>▶</Text>
        </Press>
      </View>}>
      {/* Your card, whole, with the four tabs stacked in the gap to its right. */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
        <PlayerCardView career={career} />
        <View style={{ flex: 1, gap: 6, paddingVertical: 4 }}>
          {VIEWS.map((v) => {
            const on = v.id === view;
            return (
              <Press key={v.id} onPress={() => setView(v.id)} style={[{ flex: 1, minHeight: 44, borderRadius: 4, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
                (on ? { backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5)" }
                  : { backgroundColor: "rgba(8,20,38,0.7)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.34)" }) as ViewStyle]}>
                <Text style={{ fontSize: 18 }}>{v.icon}</Text>
                <Text numberOfLines={1} style={{ color: on ? "#030712" : "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 0.4 }}>{v.label.toUpperCase()}</Text>
              </Press>
            );
          })}
        </View>
      </View>
      {view === "stats" && <StatsTab career={career} />}
      {view === "records" && <RecordsTab career={career} />}
      {view === "achievements" && <AchievementWall career={career} />}
      {view === "contract" && <ContractPaper career={career} onRenew={onRenew} />}
    </Frame>
  );
}

/** This season big, your career under it (StatsTabs.tsx SeasonCareer). */
function SeasonCareer({ label, season, total, gold }: { label: string; season: number; total: number; gold?: boolean }) {
  return (
    <View style={{ flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
      <Text style={{ color: gold && season > 0 ? "#fcd34d" : "#fff", fontSize: 26, lineHeight: 28, fontWeight: "900" }}>{season}</Text>
      <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1, marginTop: 3 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", marginTop: 3 }}>{total} <Text style={{ fontSize: 9, color: "rgba(253,230,138,0.7)" }}>career</Text></Text>
    </View>
  );
}

/** Small numbers with a label under each (StatsTabs.tsx Nums). */
function Nums({ cells }: { cells: [string, number][] }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {cells.map(([l, v]) => (
        <View key={l} style={{ width: 32, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 16, lineHeight: 19 }}>{v}</Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 }}>{l.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

const COL = { season: 54, num: 26, avg: 34 };

function StatsTab({ career }: { career: CareerState }) {
  const o = useMemo(() => careerOverview(career), [career]);
  const seasonTrophies = career.trophies.filter((t) => t.season === career.season).length;
  const team = o.honours.filter((h) => h.competition !== "Golden Ball");
  const awards = [...o.honours.filter((h) => h.competition === "Golden Ball"), ...o.individual];
  const nation = career.player.nationality || "England";
  const intlAssists = (career.international?.matches ?? []).reduce((s, m) => s + m.assists, 0);
  const intlTrophies = career.trophies.filter((t) => t.club === nation).length;
  const head = (l: string, w?: number, left?: boolean) => (
    <Text key={l} style={[{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1 }, w ? { width: w, textAlign: left ? "left" : "center" } : { flex: 1 }]}>{l.toUpperCase()}</Text>
  );
  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 2, marginBottom: -4 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>THIS SEASON</Text>
        <Text style={{ color: "rgba(253,230,138,0.9)", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>CAREER BELOW</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <SeasonCareer label="Apps" season={career.seasonStats.appearances} total={career.careerStats.appearances} />
        <SeasonCareer label="Goals" season={career.seasonStats.goals} total={career.careerStats.goals} />
        <SeasonCareer label="Assists" season={career.seasonStats.assists} total={career.careerStats.assists} />
        <SeasonCareer label="Trophies" season={seasonTrophies} total={career.trophies.length} gold />
      </View>

      <Heading>Season by season</Heading>
      <View>
        <View style={{ flexDirection: "row", paddingHorizontal: 8, gap: 4, marginBottom: 4 }}>
          {head("Season", COL.season, true)}{head("Club")}{head("G", COL.num)}{head("A", COL.num)}{head("Avg", COL.avg)}
        </View>
        <View style={{ gap: 4 }}>
          {[...o.seasons].reverse().map((s) => {
            const glow = clubGlow(s.club, career);
            return (
              <View key={s.season} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, backgroundImage: `linear-gradient(90deg, ${rgba(glow, 0.22)}, rgba(255,255,255,0.03) 60%)`, boxShadow: `inset 3px 0px 0px ${glow}, inset 0px 0px 0px 1px rgba(255,255,255,0.06)` } as ViewStyle}>
                <View style={{ width: COL.season }}>
                  <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "900" }}>{s.label}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: "700" }}>age {s.age}{s.live ? " · now" : ""}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ClubCrest club={s.club} size={20} />
                    <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "900", flexShrink: 1 }}>{shortClub(s.club)}</Text>
                  </View>
                  {(s.trophies.length > 0 || s.awards.length > 0)
                    ? <Text numberOfLines={1} style={{ color: "#fde68a", fontSize: 10, fontWeight: "800", marginTop: 2 }}>{[...s.trophies.map((t) => `🏆 ${t}`), ...s.awards.map((a) => `🏅 ${a}`)].join("  ")}</Text>
                    : <View style={{ marginTop: 3 }}><Blank w={64} h={10} /></View>}
                </View>
                {s.stats ? (
                  <>
                    <Text style={{ width: COL.num, textAlign: "center", color: "#fff", fontFamily: FONT.display, fontSize: 16 }}>{s.stats.goals}</Text>
                    <Text style={{ width: COL.num, textAlign: "center", color: "rgba(255,255,255,0.85)", fontFamily: FONT.display, fontSize: 16 }}>{s.stats.assists}</Text>
                    <Text style={{ width: COL.avg, textAlign: "center", color: "#fde68a", fontSize: 11.5, fontWeight: "900" }}>{s.stats.avgRating ? s.stats.avgRating.toFixed(1) : "—"}</Text>
                  </>
                ) : (
                  <>
                    <View style={{ width: COL.num, alignItems: "center" }}><Blank /></View>
                    <View style={{ width: COL.num, alignItems: "center" }}><Blank /></View>
                    <View style={{ width: COL.avg, alignItems: "center" }}><Blank w={28} /></View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <Heading right={o.totals.trophies}>The cabinet</Heading>
      <Cabinet items={team} />
      {awards.length > 0 && (
        <>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8, marginTop: 4, marginBottom: -4 }}>YOUR AWARDS</Text>
          <Cabinet items={awards} />
        </>
      )}

      <Heading>Goals &amp; assists by season</Heading>
      <ArcChart arc={o.arc} peak={o.peak?.season} />

      <Heading>Per club</Heading>
      <View style={{ gap: 4 }}>
        {o.clubs.map((cl) => (
          <View key={cl.club} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundImage: `linear-gradient(90deg, ${rgba(clubGlow(cl.club, career), 0.2)}, rgba(255,255,255,0.03) 60%)`, boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.06)" } as ViewStyle}>
            <ClubCrest club={cl.club} size={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: "#fff", fontWeight: "900", fontSize: 12.5 }}>{shortClub(cl.club)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700" }}>{cl.years} · {cl.seasons} season{cl.seasons === 1 ? "" : "s"}</Text>
            </View>
            <Nums cells={[["Apps", cl.apps], ["G", cl.goals], ["A", cl.assists]]} />
          </View>
        ))}
      </View>

      <Heading>International</Heading>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
        <ClubCrest club={nation} size={22} />
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontWeight: "900", fontSize: 12.5 }}>{nation}</Text>
        <Nums cells={[["Caps", career.caps ?? 0], ["G", career.internationalGoals ?? 0], ["A", intlAssists], ["🏆", intlTrophies]]} />
      </View>
    </>
  );
}

/** The trophy shelf: four empty, blacked-out places before the first trophy (house rule). */
function Cabinet({ items }: { items: { competition: string; count: number }[] }) {
  if (items.length === 0) {
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[0, 1, 2, 3].map((k) => <View key={k} style={{ flex: 1, height: 66, borderRadius: 6, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.2), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle} />)}
      </View>
    );
  }
  const rows: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r, k) => (
        <View key={k} style={{ flexDirection: "row", gap: 6 }}>
          {[0, 1, 2, 3].map((j) => {
            const h = r[j];
            if (!h) return <View key={j} style={{ flex: 1 }} />;
            return (
              <View key={j} style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingBottom: 6, paddingHorizontal: 3, backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.3))", boxShadow: "inset 0px -3px 0px rgba(120,72,24,0.85), inset 0px 0px 0px 1px rgba(255,255,255,0.07)" } as ViewStyle}>
                <Text style={{ fontSize: 30 }}>{h.competition === "Golden Ball" ? "🥇" : /Boot/.test(h.competition) ? "👟" : /Player|Award|Team/.test(h.competition) ? "🏅" : "🏆"}</Text>
                <View style={{ position: "absolute", right: 3, top: 3, backgroundColor: "#fbbf24", borderRadius: 2, paddingHorizontal: 3 }}><Text style={{ color: "#030712", fontSize: 11, fontWeight: "900" }}>×{h.count}</Text></View>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: "900", marginTop: 4 }}>{h.competition.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Goals and assists, season by season (components/star/ArcChart.tsx): thin bar pairs on a 0 / half / top scale. */
const ARC_GOALS = "#f59e0b";
const ARC_ASSISTS = "#38bdf8";
function ArcChart({ arc, peak }: { arc: { season: number; label: string; goals?: number; assists?: number; live: boolean }[]; peak?: number }) {
  const H = 112;
  const max = Math.max(1, ...arc.map((a) => Math.max(a.goals ?? 0, a.assists ?? 0)));
  const step = max <= 5 ? 5 : max <= 10 ? 10 : Math.ceil(max / 10) * 10;
  const short = (l: string) => (l.length >= 7 ? `${l.slice(2, 4)}/${l.slice(-2)}` : l);
  const every = arc.length > 10 ? 2 : 1;
  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 6 }}>
        {[["Goals", ARC_GOALS], ["Assists", ARC_ASSISTS]].map(([l, c]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>{l.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 20, height: H, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4 }}>
          {[1, 0.5, 0].map((f) => <Text key={f} style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "800", marginVertical: -6 }}>{Math.round(step * f)}</Text>)}
        </View>
        <View style={{ flex: 1, height: H }}>
          {[0, 0.5, 1].map((f) => <View key={f} style={{ position: "absolute", left: 0, right: 0, top: H * (1 - f), height: 1, backgroundColor: f === 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)" }} />)}
          <View style={{ flexDirection: "row", flex: 1 }}>
            {arc.map((a) => (
              <View key={a.season} style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2, opacity: a.live ? 0.5 : 1 }}>
                {a.goals === undefined && a.assists === undefined
                  ? <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "800", marginBottom: 2 }}>—</Text>
                  : ([[a.goals ?? 0, ARC_GOALS], [a.assists ?? 0, ARC_ASSISTS]] as [number, string][]).map(([v, c], i) => (
                    <View key={i} style={{ alignItems: "center" }}>
                      {arc.length <= 10 || a.season === peak ? <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 9, fontWeight: "900" }}>{v}</Text> : null}
                      <View style={{ width: 12, height: Math.max(v > 0 ? 3 : 0, (H - 14) * (v / step)), backgroundColor: c, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                    </View>
                  ))}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginLeft: 20, marginTop: 4 }}>
        {arc.map((a, k) => (
          <View key={a.season} style={{ flex: 1, alignItems: "center" }}>
            {(k % every === 0 || k === arc.length - 1) ? <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "800" }}>{short(a.label)}</Text> : null}
            {a.live ? <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 8, fontWeight: "800" }}>so far</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** StatsTabs.tsx Fold: a card that opens and shuts on a tap of its heading (▾ open, ▸ shut). */
function Fold({ title, right, startOpen = false, children }: { title: string; right?: string; startOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <Card>
      <Press onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: -2 }}>
        <Text style={{ width: 12, color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{open ? "▾" : "▸"}</Text>
        <View style={{ flex: 1 }}><Label>{title}</Label></View>
        {right ? <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "900" }}>{right}</Text> : null}
      </Press>
      {open ? <View style={{ marginTop: 6 }}>{children}</View> : null}
    </Card>
  );
}

function RecordsTab({ career }: { career: CareerState }) {
  const b = career.careerBests ?? {};
  const s = (n: number) => `Season ${shortSeason(career.player.startYear, n)}`;
  const vs = (o: string) => `v ${shortClub(o)}`;
  return (
    <>
      {/* Open to start, folds away on a tap (StatsTabs.tsx; Mikey, 23 Oct 2026). */}
      <Fold title="Your bests" startOpen>
        {!career.careerBests && <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "700", marginBottom: 6 }}>Furthest goal/assist and match bests start counting from now on this save.</Text>}
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
      </Fold>
      <Fold title="Real-world records" right={`${RECORDS.filter((r) => r.progress(career) >= r.value).length} / ${RECORDS.length}`}>
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
      </Fold>
    </>
  );
}
