/**
 * THE WEBSITE'S BOTTOM BAR (components/star/MainBar.tsx, glass skin):
 *   League · Training · HOME · Phone · PLAY
 * The button of the screen you are on is a light glass pane (Home on Home), PLAY
 * the round green button rising out of the bar. Badges as the website: Training
 * shows the sessions left (amber, with a bolt), Phone the unread count (red);
 * a locked button shows a padlock and says how to open it when tapped.
 *
 *   <BottomBar active="home" />                            wired to the app's screens (useMainBarActions)
 *   <BottomBar active="league" on={{ league: …, play: … }} /> override any button
 *
 * Other screens (Stats, Phone, Shop…) put it at the bottom the same way, so
 * Home is one tap away everywhere, as on the website.
 */
import { useMemo, useState } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
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
    phoneOpen: isOpen(career, "phone"), phoneUnread: unread, playOpen: isOpen(career, "play"), matchInDays: null,
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

export function BottomBar({ active, on }: { active?: BarTab | null; on?: Partial<Record<BarTab, () => void>> }) {
  const career = useCareer();
  const inset = useSafeAreaInsets();
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
  return (
    <View style={{
      flexDirection: "row", alignItems: "flex-end", gap: 4, paddingHorizontal: 6, paddingTop: 5, paddingBottom: Math.max(6, inset.bottom),
      backgroundImage: "linear-gradient(180deg, rgba(30,56,92,0.95), rgba(14,30,52,0.97))",
      borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.28)",
      boxShadow: "0px -6px 16px -8px rgba(0,0,0,0.7)",
    } as ViewStyle}>
      {note && (
        <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: "100%", marginBottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 6, backgroundColor: "rgba(3,7,18,0.95)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(252,211,77,0.4)" }}>
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>🔒 {note.label} is locked —</Text>
          <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "700" }}>{note.hint}</Text>
        </View>
      )}
      <View {...leagueT} style={{ flex: 1 }}><NavBtn label="League" icon="🏆" on={active === "league"} locked={!!locks.league} onPress={() => tap("league", "League")} /></View>
      <View {...trainingT} style={{ flex: 1 }}><NavBtn label="Training" icon="⚽" on={active === "training"} locked={!!locks.training} count={badges.skills} bolt onPress={() => tap("training", "Training")} /></View>
      <View {...homeT} style={{ flex: 1 }}><NavBtn label="Home" icon="🏠" on={active === "home"} locked={false} onPress={() => { if (active !== "home") tap("home", "Home"); }} /></View>
      <View {...phoneT} style={{ flex: 1 }}><NavBtn label="Phone" icon="📱" on={active === "phone"} locked={!!locks.phone} count={badges.media} dot={badges.life === "dot" && !badges.media} onPress={() => tap("phone", "Phone")} /></View>
      <View style={{ flex: 1, alignItems: "center", height: 50 }}>
        <View {...playT} style={{ position: "absolute", top: -22 }}>
          <PlayButton locked={!!locks.play} onPress={() => tap("play", "Play")} />
        </View>
      </View>
    </View>
  );
}

function NavBtn({ label, icon, on, locked, count, bolt, dot, onPress }: { label: string; icon: string; on: boolean; locked: boolean; count?: number; bolt?: boolean; dot?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={[{ flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2 },
      on && ({ backgroundColor: "rgba(255,255,255,0.18)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.34)" } as ViewStyle)]}>
      <Text style={{ fontSize: 18, opacity: locked ? 0.3 : 1 }}>{icon}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: locked ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "900" }}>{label}</Text>
      {locked && <Text style={{ position: "absolute", right: 6, top: 4, fontSize: 10 }}>🔒</Text>}
      {!locked && !!count && count > 0 && (
        <View style={{ position: "absolute", right: 4, top: 3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: bolt ? "#fbbf24" : "#ef4444", borderWidth: 2, borderColor: "#1e3a5c" }}>
          {bolt && <Text style={{ fontSize: 8, marginRight: 1 }}>⚡</Text>}
          <Text style={{ color: bolt ? "#030712" : "#fff", fontSize: 10, fontWeight: "900" }}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
      {!locked && dot && <View style={{ position: "absolute", right: 8, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" }} />}
    </Press>
  );
}
