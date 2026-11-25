/**
 * THE WEBSITE'S BOTTOM BAR (components/star/MainBar.tsx, glass skin):
 *   League · Training · HOME · Phone · PLAY
 * The button of the screen you are on has a green line under its word; Home on
 * Home is a light glass pane; PLAY is the round green button rising out of the
 * bar. Badges as the website: Training shows the sessions left (amber, with a
 * bolt), Phone the unread count (red); on a full screen (`plain`: League, Shop,
 * Sponsors, Star Pass) no numbers, only a red dot on Phone. A locked button
 * shows a padlock and says how to open it when tapped.
 *
 *   <BottomBar active="home" />                            wired to the app's screens (useMainBarActions)
 *   <BottomBar active="league" on={{ league: …, play: … }} /> override any button
 *
 * Other screens (Stats, Phone, Shop…) put it at the bottom the same way, so
 * Home is one tap away everywhere, as on the website.
 */
import { useMemo, useState } from "react";
import { Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState, Fixture } from "@/lib/star/types";
import { nextFixtureFor } from "@/lib/star/competitions";
import { fixtureTimestamp, divisionOf } from "@/lib/star/calendar";
import { barBadges, type BarBadges } from "@/lib/star/needsYou";
import { appInstalled, isOpen, lockHint, managerTalkDue, newAppCount } from "@/lib/star/unlocks";
import { trainingLeft } from "@/lib/star/week";
import { buildMessages, msgKey, socialUnread } from "@/lib/star/phoneUnread";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { useCareer } from "../../game/store";
import * as flow from "../../game/flow";
import { useNav } from "../../nav";
import { readSeenMsgs, readSocialSeen } from "../../world/seen";
import { Press } from "../Press";
import { PlayButton } from "./Buttons";
import { useTourTarget } from "../tour";
import { LockIcon } from "../LockIcon";
import { NO_SHADOW } from "./tokens";

export type BarTab = "league" | "training" | "home" | "phone" | "play";

/** Where each button goes from any screen (the tabs screen opens League or Home in place). */
export function useMainBarActions(): Record<BarTab, () => void> {
  const nav = useNav();
  const career = useCareer();
  return {
    league: () => { nav.home(); nav.replace("tabs", { tab: "league" }); },
    home: () => nav.home(),
    training: () => nav.go("career-training"),
    // The manager's word comes through the Phone while it is due (page.tsx navTo).
    phone: () => { if (career && managerTalkDue(career)) nav.go("career-relationship-game", { kind: "boss" }); else nav.go("phone"); },
    play: () => { if (career && flow.seasonOver(career)) nav.go(flow.endSeason().screen); else nav.go("career-prematch"); },
  };
}

/** What still needs you, from the career (lib/star/needsYou.ts barBadges, the phone's own "seen" store). */
/** Days to the next match, 0 = today (HomeHub daysToNext: the day after your last game is "today"); null with none ahead. */
function daysToMatch(career: CareerState): number | null {
  try {
    const next = nextFixtureFor(career);
    if (!next) return null;
    const div = divisionOf(career);
    const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
    const nextTs = ts(next);
    const before = career.fixtures.filter((f) => f.played).map(ts).filter((t) => t <= nextTs);
    const lastTs = before.length ? Math.max(...before) : nextTs - 5 * 86400000;
    const today = Number.isFinite(lastTs) ? lastTs + 86400000 : nextTs - 5 * 86400000;
    return Math.max(0, Math.round((nextTs - today) / 86400000));
  } catch { return null; }
}
function badgesFor(career: CareerState) {
  let unread = 0;
  try {
    const seen = readSeenMsgs();
    unread = buildMessages(career, null).filter((m) => !seen.has(msgKey(m))).length
      + (appInstalled(career, "social") ? socialUnread(career, readSocialSeen()) : 0)
      + newAppCount(career);
  } catch { /* no count */ }
  let offers = 0;
  try { offers = brandsOf(career).offers.length; } catch { /* none */ }
  return barBadges({
    seasonOver: flow.seasonOver(career), bossTalkDue: managerTalkDue(career), sponsorOffers: offers,
    sponsorsOpen: isOpen(career, "sponsors"), trainingLeft: trainingLeft(career), trainingOpen: isOpen(career, "training"),
    phoneOpen: isOpen(career, "phone"), phoneUnread: unread, playOpen: isOpen(career, "play"), matchInDays: daysToMatch(career),
  });
}

/** Buttons still locked in the unlock chain (page.tsx navLocked). */
function locksFor(career: CareerState): Partial<Record<BarTab, string>> {
  if (!career.unlocks) return {};
  const talk = managerTalkDue(career);
  return {
    ...(isOpen(career, "league") ? {} : { league: lockHint(career, "league") }),
    ...(isOpen(career, "play") ? {} : { play: lockHint(career, "play") }),
    ...(isOpen(career, "training") ? {} : { training: lockHint(career, "training") }),
    ...(talk || isOpen(career, "phone") ? {} : { phone: lockHint(career, "phone") }),
  };
}

export function BottomBar({ active, on, plain }: {
  active?: BarTab | null; on?: Partial<Record<BarTab, () => void>>;
  /** The website's bar on a full screen (League, Shop, Sponsors, Star Pass: page.tsx mainBarRaw): no numbers, only a red dot on Phone while something is unread. */
  plain?: boolean;
}) {
  const career = useCareer();
  const inset = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const go = { ...useMainBarActions(), ...on };
  const [note, setNote] = useState<{ label: string; hint: string } | null>(null);
  // Named for the coach tour (ui/tour.tsx), as the website's data-tour names.
  const trainingT = useTourTarget("nav-training"), phoneT = useTourTarget("nav-phone"), playT = useTourTarget("nav-play");
  const leagueT = useTourTarget("nav-league"), homeT = useTourTarget("home");
  // worked out again only when the career changes
  const badges = useMemo<BarBadges>(() => (career ? badgesFor(career) : {}), [career]);
  const locks = useMemo<Partial<Record<BarTab, string>>>(() => (career ? locksFor(career) : {}), [career]);
  if (!career) return null;
  const tap = (t: BarTab, label: string) => {
    const hint = locks[t];
    if (hint) { setNote({ label, hint }); setTimeout(() => setNote((n) => (n?.label === label ? null : n)), 2600); return; }
    go[t]();
  };
  // the website's words: 12 px from 380 wide, 11 px under it
  const small = width < 380;
  const phoneDot = plain ? !!badges.media || badges.life === "dot" : badges.life === "dot" && !badges.media;
  return (
    <View style={{
      // MainBar.tsx + glassLook 5: 4 above, 6 at the sides and below, 4 between; see-through blue-slate, a light line on top
      flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 6, paddingTop: 4, paddingBottom: Math.max(6, inset.bottom),
      backgroundColor: "rgba(14,30,52,0.56)",
      borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.28)",
      boxShadow: "0px -6px 16px -8px rgba(0,0,0,0.7)",
    } as ViewStyle}>
      {note && (
        <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: "100%", marginBottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: "rgba(3,7,18,0.95)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(252,211,77,0.4)" }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>🔒 {note.label} is locked —</Text>
          <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "700" }}>{note.hint}</Text>
        </View>
      )}
      <View {...leagueT} style={{ flex: 1 }}><NavBtn small={small} label="League" icon="🏆" on={active === "league"} locked={!!locks.league} onPress={() => tap("league", "League")} /></View>
      <View {...trainingT} style={{ flex: 1 }}><NavBtn small={small} label="Training" icon="⚽" on={active === "training"} locked={!!locks.training} count={plain ? undefined : badges.skills} bolt onPress={() => tap("training", "Training")} /></View>
      <View {...homeT} style={{ flex: 1 }}><NavBtn small={small} label="Home" icon="🏠" home on={active === "home"} locked={false} onPress={() => { if (active !== "home") tap("home", "Home"); }} /></View>
      <View {...phoneT} style={{ flex: 1 }}><NavBtn small={small} label="Phone" icon="📱" on={active === "phone"} locked={!!locks.phone} count={plain ? undefined : badges.media} dot={phoneDot} onPress={() => tap("phone", "Phone")} /></View>
      {/* PLAY: 66 round, rising 20 above its 46-tall place (MainBar PlayBtn `-mt-5`) */}
      <View style={{ flex: 1, alignItems: "center", height: 46 }}>
        <View {...playT} style={{ position: "absolute", top: -20 }}>
          <PlayButton locked={!!locks.play} onPress={() => tap("play", "Play")} />
        </View>
      </View>
    </View>
  );
}

/**
 * One button (MainBar NavBtn / HomeBtn, glass skin): 50 tall, the 18 px picture on an 18 line, 2 under it the
 * word (12 on a 15 line; 11 on 13.75 under 380 wide). The button you are on has a green line under its word;
 * only Home, when you are on Home, is a light pane.
 */
function NavBtn({ label, icon, on, home, locked, count, bolt, dot, small, onPress }: { label: string; icon: string; on: boolean; home?: boolean; locked: boolean; count?: number; bolt?: boolean; dot?: boolean; small?: boolean; onPress: () => void }) {
  const size = small ? 11 : 12;
  return (
    <Press onPress={onPress} style={[{ height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2 },
      home && on && ({ backgroundColor: "rgba(255,255,255,0.18)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.34)" } as ViewStyle)]}>
      {/* drawn on a 22 line so no phone cuts the picture's top; it still takes 18 */}
      <Text style={[{ fontSize: 18, lineHeight: 22, marginVertical: -2, opacity: locked ? 0.3 : 1 }, home && { textShadowColor: "rgba(253,224,71,0.8)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 }]}>{icon}</Text>
      <Text numberOfLines={1} style={[{ maxWidth: "100%", color: home && on ? "#ffffff" : "rgba(255,255,255,0.88)", fontSize: size, lineHeight: size * 1.25, fontWeight: "900", opacity: locked ? 0.6 : 1 }, !(on || home) && NO_SHADOW]}>{label}</Text>
      {on && !home && <View style={{ position: "absolute", bottom: 4, width: 20, height: 3, borderRadius: 2, backgroundColor: "#34d399" }} />}
      {locked && <View style={{ position: "absolute", right: 6, top: 6 }}><LockIcon size={12} color="#d1d5db" /></View>}
      {!locked && !!count && count > 0 && (
        <View style={{ position: "absolute", right: 4, top: 4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: bolt ? "#fbbf24" : "#ef4444", boxShadow: "0px 0px 0px 2px rgba(255,255,255,0.26)" } as ViewStyle}>
          {bolt && <Text style={{ fontSize: 9, lineHeight: 11, marginVertical: -1, marginLeft: -2, marginRight: 1 }}>⚡</Text>}
          <Text style={{ color: bolt ? "#030712" : "#fff", fontSize: 10.5, lineHeight: 10.5, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
      {!locked && dot && !count && <View style={{ position: "absolute", right: 8, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444", boxShadow: "0px 0px 0px 2px rgba(255,255,255,0.26)" } as ViewStyle} />}
    </Press>
  );
}
