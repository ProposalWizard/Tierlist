/**
 * HOME, as the website's Home (components/star/HomeHub.tsx "New" look + the
 * glass skin): ONE fixed screen, no scrolling.
 *   the top bar (name, age, money, ?, ⚙; star rating and energy)
 *   the stadium picture behind everything (day, sunset or night by kick-off)
 *   the next match, faint over the sky
 *   Rep / Fame / Goals / Assists as glass tiles with their pictures
 *   the league as one line that opens (🏆 PREMIER LEAGUE 1st ▾)
 *   you in the middle, on the pitch
 *   your boots, then the three KIB cans
 *   ‹ STATS and SHOP › (a swipe left or right does the same)
 * The bottom bar (League, Training, Home, Phone, PLAY) is drawn by the tabs
 * screen under this. Training and Phone are in that bar; the Star Pass opens
 * from the star; Sponsors and Relations are apps on the Phone; the main menu
 * is in Settings — as on the website.
 * When the season is over, "End of Season" waits here: you end it yourself.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, PanResponder, type ViewStyle } from "react-native";
import type { CareerState, Fixture } from "@/lib/star/types";
import { nextFixtureFor, byFixtureDate, fixtureLabel } from "@/lib/star/competitions";
import { fixtureDateLabel, fixtureTimestamp, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { homeSkyFor } from "@/lib/star/kickoff";
import { sortLeague } from "@/lib/star/season";
import { shortClub } from "@/lib/star/media/grammar";
import { fameOf } from "@/lib/star/fame";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import { periodDue, dutyNow } from "@/lib/star/intl/career";
import * as flow from "../game/flow";
import { useSession, setSession } from "../game/session";
import { useNav } from "../nav";
import { SCREENS } from "../areas/registry";
import { Press } from "../ui/Press";
import { Backdrop, TopBar, LookButton, CAN, ICON, LOOK, rgba, TEXT_SHADOW } from "../ui/look";
import { ClubCrest, ordinal } from "./career/kit";
import { HomePlayer } from "../three/HomePlayer";
import { useMainBarActions } from "../ui/look/BottomBar";
import { useTourTarget, askTour } from "../ui/tour";
import { StoryBeatPop, goBeat, pointStep } from "./career/StoryBeat";
import { BreakingNewsPage, PotmWinPage } from "./career/NewsMoments";
import { beatText, trainingDayOn, type Beat } from "@/lib/star/story";
import { isOpen, managerTalkDue, markAnnounced, markSeen } from "@/lib/star/unlocks";
import { HELP_TOURS } from "@/lib/star/tours";
import { mechanicDef } from "@/lib/star/mechanics";
import { markSetPieceTold } from "@/lib/star/setPieceTalk";
import { captainMomentDue } from "@/lib/star/managerMoments";
import { trainingLeft } from "@/lib/star/week";
import { loadLineup } from "@/lib/star/lineupStore";
import { getCareer, setCareer } from "../game/store";
import { useHomeFlow, useHomeIsShown, daysToNext } from "./career/Coach";
import { RiseIn } from "./career/lookBits";
import { UnlockPop, EnergyBackToast, ManagerChat, DugoutBanner, CaptainMoment, NeedsChip, DutyRow } from "./career/HomeMoments";

/** The player's box shape (HomeHub FIG_ASPECT) and tallest size. */
const FIG_ASPECT = 172 / 204;
const FIG_MAX_H = 360;
/** The call-up opened by itself once per window (page.tsx's intlDue effect). */
let shownCallUp: string | null = null;

export function Home({ career, onQuit, onLeague }: { career: CareerState; onQuit: () => void; onLeague?: () => void }) {
  const nav = useNav();
  const session = useSession();
  const next = nextFixtureFor(career);
  const over = flow.seasonOver(career);
  const intlDue = periodDue(career) !== null;
  const sky = homeSkyFor(career, next);
  const [row, setRow] = useState<{ y: number; h: number } | null>(null);
  // page.tsx's central check: anything earned away from a match unlocks on Home.
  useEffect(() => { flow.settle(); }, [career]);
  // page.tsx: on Home, a named squad opens the call-up at once (phase "dashboard" →
  // "intl-callup" while periodDue), also after the last league match of the season.
  const intlKey = intlDue ? `${career.season}:${periodDue(career)?.label ?? ""}` : null;
  useEffect(() => {
    if (!intlKey || shownCallUp === intlKey) return;
    shownCallUp = intlKey;
    nav.go("career-callup");
  }, [intlKey]);
  void onQuit; // the main menu is in Settings (as on the website)

  // ── What waits on Home, one at a time (page.tsx:5352-5480; the coach's tour itself is
  //    drawn by CoachHost): unlock pop-up → energy toast → tour → story beat → the
  //    manager's set-piece word → "New in your game". ──
  useHomeIsShown();
  const bar = useMainBarActions();
  const home = useHomeFlow(career);
  const beat = home.beat;
  const patch = (fn: (c: CareerState) => CareerState) => { const c = getCareer(); if (c) setCareer(fn(c)); };
  const seeAchievements = () => nav.go("career-stats", { tab: "achievements" });
  const onBeat = (b: Beat) => {
    const go = goBeat(b);
    // "Got it", then the glove swipes right to your card (page.tsx: target "tab-0", swipe "right").
    if (go.point === "tab-0") askTour([{ target: "tab-0", text: "", press: true, swipe: "right" }]);
    else if (go.point) askTour(pointStep(go.point));
    else if (go.screen && SCREENS[go.screen]) nav.go(go.screen, go.params);
  };
  const duty = dutyNow(career);
  const bossDue = managerTalkDue(career);

  const figH = row ? Math.round(Math.max(104, Math.min(FIG_MAX_H, row.h - 4))) : 0;
  const figW = Math.round(figH * FIG_ASPECT);
  // The stadium's hoardings sit just behind his knees (HomeHub goalBoxFor().hoardings).
  const lineY = row ? row.y + row.h - Math.round(figH * 0.48) : undefined;

  // Stats ‹ › Shop: a sideways swipe anywhere on the pitch. A new career has both locked
  // (page.tsx LockedPage: "Stats is locked · Score your first goal").
  const goStats = () => (isOpen(career, "stats") ? nav.go("career-stats") : nav.go("career-locked", { feature: "stats" }));
  const goShop = () => { if (!isOpen(career, "shop")) nav.go("career-locked", { feature: "shop" }); else if (SCREENS.shop) nav.go("shop"); };
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_e, g) => { if (g.dx > 60) swipeTo.current("stats"); else if (g.dx < -60) swipeTo.current("shop"); },
  })).current;
  const swipeTo = useRef<(s: "stats" | "shop") => void>(() => {});
  swipeTo.current = (s) => (s === "stats" ? goStats() : goShop());

  // One chip, most urgent first (HomeHub urgentOnly: only the season's end and the boss's word).
  const chips: { label: string; icon: string; onPress: () => void }[] = [];
  if (over && !intlDue) chips.push({ label: "End of Season", icon: "🏆", onPress: () => nav.go(flow.endSeason().screen) });
  else if (bossDue) chips.push({ label: "Boss wants a word", icon: "🗣️", onPress: bar.phone });
  if (intlDue) chips.push({ label: "Your country's manager has named his squad", icon: "📞", onPress: () => nav.go("career-callup") });
  if (career.placement?.kind === "youth") chips.push({ label: "Youth team: this week", icon: "🎓", onPress: () => nav.go("career-youth") });

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e" }} {...swipe.panHandlers}>
      <Backdrop kind="home" sky={sky} lineY={lineY} />
      <TopBar career={career}
        onHelp={() => askTour(HELP_TOURS.home)}
        onSettings={() => nav.go("career-settings")}
        onStarPass={SCREENS["star-pass"] ? () => nav.go("star-pass") : undefined} />
      {/* The next match and the four numbers rise in each time Home opens (HomeHub RiseIn). */}
      <RiseIn index={0}><NextMatch career={career} next={next} /></RiseIn>
      <RiseIn index={1}><StatTiles career={career} /></RiseIn>
      {duty ? <DutyRow duty={duty} onOpen={onLeague} /> : <LeagueStrip career={career} onOpen={onLeague} />}

      {/* You, centre stage (HomeHub HeroNew). */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", zIndex: 1 }} onLayout={(e) => { const { y, height } = e.nativeEvent.layout; if (!row || row.y !== y || row.h !== height) setRow({ y, h: height }); }}>
        {figH > 0 && <HomePlayer career={career} where="home" width={figW} height={figH} ball />}
        {chips.length > 0 && (
          <View style={{ position: "absolute", left: 10, top: 6, gap: 4, alignItems: "flex-start", maxWidth: "80%" }}>
            {chips.map((c) => <NeedsChip key={c.label} need={c} onPress={c.onPress} />)}
          </View>
        )}
        {/* "In the dugout": the new manager's news, until its ✕ (page.tsx:5621). */}
        {career.managerNews ? <DugoutBanner text={career.managerNews} onDismiss={() => patch((c) => (c.managerNews ? { ...c, managerNews: null } : c))} /> : null}
        {home.energyToast !== null && <EnergyBackToast amount={home.energyToast} onDone={() => setSession({ energyBack: null })} />}
      </View>

      <View style={{ paddingHorizontal: 12, zIndex: 2 }}>
        <BootsLine career={career} />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
          {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} />)}
        </View>
        {/* the swipe pages' arrows (SwipePages `arrows`) */}
        <View style={{ height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 78 }}>
          <Arrow side="left" icon="📊" label="Stats" onPress={goStats} tour="tab-0" />
          <Arrow side="right" icon="🛍️" label="Shop" onPress={goShop} tour="tab-2" />
        </View>
      </View>

      {/* Over Home, one at a time: Player of the Month (full screen), breaking news
          (full screen), then the coach's tour or the next story beat. */}
      {session.potmWin ? <PotmWinPage career={career} award={session.potmWin} onClose={() => setSession({ potmWin: null })} />
        : session.news[0] ? <BreakingNewsPage key={session.news[0].headline} career={career} news={session.news[0]} onClose={flow.dismissNews} />
        : null}
      {/* Something opened: say what, then lead to it through Achievements. */}
      {home.announce.length > 0 && (
        <UnlockPop key={home.announce.join()} features={home.announce}
          onSeeAll={() => { patch((c) => markAnnounced(c, home.announce)); seeAchievements(); }}
          onClose={() => patch((c) => markAnnounced(c, home.announce))} />
      )}
      {beat && <StoryBeatPop key={beat} text={beatText(career, beat)} onGo={() => onBeat(beat)} />}
      {home.setPiece && (
        <ManagerChat key={home.setPiece.duties.join()} name={career.manager?.name || loadLineup(career.player.club)?.manager || "The manager"}
          lines={home.setPiece.lines} onDone={() => { const d = home.setPiece!.duties; patch((c) => markSetPieceTold(c, d)); }} />
      )}
      {home.mech && (() => {
        const m = home.mech!;
        const g = mechanicDef(m).guide;
        const seenIt = () => patch((c) => markSeen(c, `mech-${m}`));
        // Headers and volleys: try them straight away in the Aerial drill (page.tsx tryAerial).
        const tryAerial = m === "aerial" ? () => {
          seenIt();
          const s = trainingLeft(career) > 0 || trainingDayOn(career) ? flow.pickTraining("aerial") : null;
          if (s) nav.go(s.screen, s.params); else nav.go("career-training");
        } : undefined;
        return <StoryBeatPop key={`mech-${m}`} text={{ who: "New in your game", icon: g.icon, title: g.title, line: g.line, button: tryAerial ? "Later" : "Got it" }}
          onTry={tryAerial} tryLabel="Try a header now" onGo={seenIt} />;
      })()}
      {/* Made captain: the manager tells you, once. */}
      {!career.managerNews && captainMomentDue(career) && !home.tour && !beat && home.announce.length === 0 && !session.news[0] && !session.potmWin && (
        <CaptainMoment career={career} onDone={() => patch((c) => ({ ...c, captainMomentPending: false }))} />
      )}
    </View>
  );
}

/** HomeHub's lastFive: your last five results (club or country). */
function lastFive(career: CareerState, international: boolean) {
  return career.fixtures
    .filter((f) => f.played && f.homeScore !== undefined && f.awayScore !== undefined && (f.kind === "international") === international)
    .sort(byFixtureDate(career)).slice(-5)
    .map((f) => { const us = f.home ? f.homeScore! : f.awayScore!, them = f.home ? f.awayScore! : f.homeScore!; return us > them ? "W" : us === them ? "D" : "L"; });
}
const shadow = TEXT_SHADOW;

/** The next match: faint, so the sky shows through (HomeHub NextMatch). */
function NextMatch({ career, next }: { career: CareerState; next: Fixture | null }) {
  const five = lastFive(career, next?.kind === "international");
  const form = (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {five.map((r, i) => (
        <View key={i} style={{ width: 15, height: 15, alignItems: "center", justifyContent: "center", backgroundColor: r === "W" ? "#10b981" : r === "D" ? "#6b7280" : "#dc2626" }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{r}</Text>
        </View>
      ))}
    </View>
  );
  if (!next) {
    return (
      <View style={{ height: 40, marginTop: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(8,20,38,0.3)" }}>
        <Text style={[{ color: "#fff", fontWeight: "900", fontSize: 12, flex: 1 }, shadow]}>Season complete — the awards are next</Text>
        {form}
      </View>
    );
  }
  const mine = flow.myTeam(career, next);
  const home = next.home ? mine : next.opponent;
  const away = next.home ? next.opponent : mine;
  const comp = next.competition ?? (next.kind && next.kind !== "league" ? fixtureLabel(next) : leagueNameFor(divisionOf(career)));
  const days = daysToNext(career, next);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
  const date = fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career));
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, height: 92 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: 15 }}>
        <Text style={[{ color: LOOK.emerald300, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }, shadow]}>NEXT MATCH</Text>
        <Text numberOfLines={1} style={[{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "900", letterSpacing: 1, maxWidth: "62%" }, shadow]}>{comp.toUpperCase()}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 4, marginTop: 2 }}>
        <Side club={home} you={home === mine} />
        <View style={{ height: 34, width: 18, alignItems: "center", justifyContent: "center" }}><Text style={[{ color: "rgba(255,255,255,0.9)", fontSize: 16, fontWeight: "900" }, shadow]}>v</Text></View>
        <Side club={away} you={away === mine} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 16, marginTop: 2 }}>
        <Text style={[{ color: "#fff", fontWeight: "900", fontSize: 11 }, shadow]}>{date ?? `Week ${next.week}`}</Text>
        <View style={{ backgroundColor: days <= 1 ? "#fbbf24" : "rgba(255,255,255,0.12)", paddingHorizontal: 6 }}>
          <Text style={{ color: days <= 1 ? "#030712" : "#fde68a", fontWeight: "900", fontSize: 10, lineHeight: 15 }}>⏱ {when}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {form}
      </View>
    </View>
  );
}

function Side({ club, you }: { club: string; you: boolean }) {
  return (
    <View style={{ width: 104, alignItems: "center" }}>
      <View style={[{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }, you && ({ boxShadow: "0px 0px 12px rgba(110,231,183,0.6)" } as ViewStyle)]}>
        <ClubCrest club={club} size={32} />
      </View>
      <Text numberOfLines={1} style={[{ color: you ? LOOK.emerald300 : "#fff", fontWeight: "900", fontSize: 11.5 }, shadow]}>{shortClub(club)}</Text>
    </View>
  );
}

/** Rep, Fame, Goals, Assists (HomeHub StatTiles): a 3D picture, one big number, a label. */
function StatTiles({ career }: { career: CareerState }) {
  const fame = fameOf(career);
  const ps = career.seasonStats;
  const tiles = [
    { key: "rep", label: "Rep", value: Math.round(career.reputation), icon: ICON.world, color: "#0ea5e9", bar: career.reputation as number | undefined },
    { key: "fame", label: "Fame", value: fame, icon: ICON.fame, color: "#d946ef", bar: Math.min(100, fame) as number | undefined },
    { key: "goals", label: "Goals", value: ps.goals, icon: ICON.ball, color: "#22c55e", bar: undefined },
    { key: "assists", label: "Assists", value: ps.assists, icon: ICON.boot, color: "#f59e0b", bar: undefined },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 6, height: 66, paddingHorizontal: 12, marginTop: 4 }}>
      {tiles.map((t) => (
        <View key={t.key} style={{
          flex: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center",
          backgroundImage: `radial-gradient(90% 80% at 50% 0%, ${rgba(t.color, 0.38)} 0%, ${rgba(t.color, 0)} 75%), linear-gradient(180deg, rgba(5,8,15,0.72), rgba(5,8,15,0.72))`,
          boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1.5px ${rgba(t.color, 0.6)}, 0px 6px 14px -8px ${rgba(t.color, 0.8)}`,
        } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Image source={t.icon} resizeMode="contain" style={{ width: 22, height: 22 }} />
            <Text style={{ color: "#fff", fontSize: 23, fontWeight: "900", textShadowColor: rgba(t.color, 0.7), textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }}>{t.value}</Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginTop: 4 }}>{t.label.toUpperCase()}</Text>
          {t.bar !== undefined && (
            <View style={{ position: "absolute", left: 6, right: 6, bottom: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
              <View style={{ width: `${Math.max(0, Math.min(100, t.bar))}%`, height: "100%", borderRadius: 2, backgroundColor: t.color }} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

/** The league as one line that opens (MiniLeague LeagueDropdown): 🏆 PREMIER LEAGUE · 1st ▾. */
function LeagueStrip({ career, onOpen }: { career: CareerState; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => (career.league?.length ? sortLeague(career.league) : []), [career.league]);
  const me = rows.findIndex((t) => t.name === career.player.club);
  if (me < 0) return null;
  const from = Math.max(0, Math.min(rows.length - 5, me - 2));
  return (
    <View style={{ marginTop: 4, zIndex: 3 }}>
      <Press onPress={() => setOpen((o) => !o)} style={{ height: 24, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, ...(open ? { backgroundColor: "rgb(4,16,10)" } : { backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.12))" }) } as ViewStyle}>
        <Text numberOfLines={1} style={[{ flex: 1, color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }, shadow]}>🏆 {leagueNameFor(divisionOf(career)).toUpperCase()}</Text>
        {open && onOpen && (
          <Press onPress={onOpen} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>FULL TABLE ›</Text>
          </Press>
        )}
        <Text style={[{ color: "#fef08a", fontSize: 13, fontWeight: "900" }, shadow]}>{me + 1}<Text style={{ fontSize: 9 }}>{ordinal(me + 1).replace(/^\d+/, "")}</Text></Text>
        <Text style={[{ color: "#fff", fontSize: 12, fontWeight: "900", transform: [{ rotate: open ? "180deg" : "0deg" }] }, shadow]}>▾</Text>
      </Press>
      {open && (
        <View style={{ position: "absolute", left: 0, right: 0, top: 24, backgroundColor: "rgb(4,16,10)", paddingHorizontal: 12, paddingBottom: 6, boxShadow: "0px 8px 18px rgba(0,0,0,0.5)" } as ViewStyle}>
          {rows.slice(from, from + 5).map((t, k) => {
            const you = t.name === career.player.club;
            return (
              <View key={t.name} style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 24, paddingHorizontal: 6, backgroundColor: you ? "rgba(52,211,153,0.16)" : "transparent" }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", width: 20, fontWeight: "800", fontSize: 12 }}>{from + k + 1}</Text>
                <ClubCrest club={t.name} size={16} />
                <Text numberOfLines={1} style={{ flex: 1, color: you ? LOOK.emerald300 : "#fff", fontWeight: "800", fontSize: 12 }}>{shortClub(t.name)}</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", width: 26, textAlign: "right", fontSize: 12 }}>{t.played}</Text>
                <Text style={{ color: "#fff", width: 30, textAlign: "right", fontWeight: "900", fontSize: 12 }}>{t.points}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** The boots line over the cans (HomeHub BootsLine). */
function BootsLine({ career }: { career: CareerState }) {
  const b = career.currentBoot;
  const left = b?.matches ?? 0;
  const gives = [b?.power ? `Pow +${b.power}` : "", b?.technique ? `Tec +${b.technique}` : "", b?.curve ? "Curve" : "", b?.extraTouch ? "Extra touch" : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ height: 24, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "rgba(5,8,15,0.72)", boxShadow: "inset 0px 0px 0px 1px rgba(251,146,60,0.55)" } as ViewStyle}>
        <Text style={{ fontSize: 13 }}>👟</Text>
        {left > 0
          ? <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "900", flexShrink: 1 }}>{b.name}{gives ? <Text style={{ color: "#fde68a" }}>  {gives}</Text> : null}<Text style={{ color: "rgba(255,255,255,0.7)" }}>  · {left} {left === 1 ? "match" : "matches"} left</Text></Text>
          : <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900" }}>No boots: buy a pair in the Shop</Text>}
      </View>
    </View>
  );
}

const ACCENT: Record<KibCan["id"], string> = { basic: "#fb923c", premium: "#60a5fa", elite: "#c084fc" };

/** One can (HomeHub CanTile `mini`): the can and its name side by side, Use and Buy under them. */
function CanTile({ can: c, career }: { can: KibCan; career: CareerState }) {
  const accent = ACCENT[c.id];
  const useT = useTourTarget(`can-use-${c.id}`);
  const count = career.kibCans[c.id];
  const price = kibCanPrice(c, career.contract.wage);
  const ready = !!(c.effect && career.kibAbility?.[c.effect]);
  const full = !c.effect && career.energy >= 100;
  const canUse = count > 0 && !ready && !full;
  const effect = c.effect === "curve" ? `Curve shots${c.restore ? ` +${c.restore}` : ""}` : c.effect === "extraTouch" ? `Extra touch${c.restore ? ` +${c.restore}` : ""}` : `+${c.restore} energy`;
  const name = c.name.replace(" KIB Can", "");
  return (
    <View style={{
      flex: 1, borderRadius: 12, padding: 6, overflow: "hidden",
      backgroundImage: `radial-gradient(90% 70% at 30% 30%, ${rgba(accent, 0.34)} 0%, ${rgba(accent, 0)} 70%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))`,
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.12), inset 0px 0px 0px 1px ${rgba(accent, 0.35)}, 0px 6px 14px -8px ${rgba(accent, 0.6)}`,
    } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 22, height: 40 }}>
          <Image source={CAN[c.id]} resizeMode="contain" style={{ width: 22, height: 40 }} />
          <View style={{ position: "absolute", right: -9, top: -4, minWidth: 22, paddingHorizontal: 4, borderRadius: 999, backgroundImage: `linear-gradient(180deg, ${rgba(accent, 0.75)}, ${accent})` } as ViewStyle}>
            <Text style={{ color: "#030712", fontSize: 10.5, fontWeight: "900", lineHeight: 15, textAlign: "center" }}>×{count}</Text>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: name.length > 5 ? 10.5 : 12.5, fontWeight: "900", paddingLeft: 4 }}>{name}</Text>
          <Text numberOfLines={2} style={{ color: "rgba(255,255,255,0.8)", fontSize: 9.5, fontWeight: "700", lineHeight: 11 }}>{effect}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
        <View {...useT} style={{ flex: 1 }}>
          <LookButton kind="accent" accent={accent} small disabled={!canUse} onPress={() => flow.useCan(c.id)} style={{ borderRadius: 6, paddingVertical: 4 }}>
            <Text style={{ color: canUse ? "#111" : "#fff", fontSize: 10.5, fontWeight: "900" }}>{ready ? "✓" : full ? "FULL" : "USE"}</Text>
          </LookButton>
        </View>
        <LookButton kind="dark" small disabled={career.money < price} onPress={() => flow.buyCan(c)} style={{ flex: 1, borderRadius: 6, paddingVertical: 4 }}>
          <Text style={{ color: "#fef08a", fontSize: 10, fontWeight: "900" }}>★{formatMoney(price)}</Text>
        </LookButton>
      </View>
    </View>
  );
}

/** ‹ 📊 STATS / SHOP 🛍️ › (ui/Nav.tsx Arrow). */
function Arrow({ side, icon, label, onPress, tour }: { side: "left" | "right"; icon: string; label: string; onPress: () => void; tour?: string }) {
  const t = useTourTarget(tour ?? `arrow-${side}`, onPress);
  return (
    <View {...t}>
    <Press onPress={onPress} style={{ height: 24, flexDirection: side === "left" ? "row" : "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 6, borderRadius: 2, backgroundColor: "rgba(8,20,38,0.34)", opacity: 0.8 }}>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>{side === "left" ? "◀" : "▶"}</Text>
      <Text style={{ fontSize: 12 }}>{icon}</Text>
      <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>{label.toUpperCase()}</Text>
    </Press>
    </View>
  );
}
