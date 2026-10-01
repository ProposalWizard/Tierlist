"use client";

/**
 * THE PHONE AS A HOME SCREEN — apps, not just a feed.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "inside phone we shld
 * just make it a usable hud thing that u can access stuff through anyway not
 * just a social media page / imagine u can go in and play an even worse
 * football game on ur phone / like infinite highlights is just in the phone".
 *
 * A grid of apps inside the same drawn phone (PhoneFrame). Social, Kickabout,
 * League, Fixtures and Messages open INSIDE the phone; Shop, Store, Casino, Owner,
 * Garden, Sponsors and Settings open their real screens. The bar at the
 * bottom of the phone takes you back to the grid.
 *
 * Reskinned in the home screen's look (28 Sep 2026, Harry: "all the pages
 * should just be reskinned to fit the new home screen vibe"): a wallpaper
 * lit in your club's colours, glossy app icons that press in, the four apps
 * you use most in a dock, notification badges that pop, and an app that
 * zooms out of its icon when it opens (and back into it when it closes).
 *
 * Kickabout is the real match (one engine): EnginePlay, playing random
 * highlights one after another the way Infinite Highlights does, drawn
 * small enough to fit the phone's screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { divisionOf, fixtureDate, formatDateNumeric, fixtureDateLabel } from "@/lib/star/calendar";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import { SCENARIO_KINDS, type Scenario } from "@/lib/star/canvasEngine";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import { nextHighlight, newSimMemory, buildSimScenario, pictureKey } from "@/lib/star/gallerySim";
import { mulberry32 } from "@/lib/star/season";
import { formatMoney } from "@/lib/star/money";
import { hasFreshMedia, unreadCount } from "@/lib/star/media/feed";
import { brandsOf } from "@/lib/star/sponsorDeals";
import PhoneFrame from "./PhoneFrame";
import MediaFeed from "./MediaFeed";
import LeagueScreen from "./LeagueScreen";
import EnginePlay from "./EnginePlay";
import ClubBadge from "./ClubBadge";
import type { ChanceResolved } from "./CanvasMatch";
import type { HubPhase } from "./HomeHub";
import { ClubCard, CountUp, PressButton, RiseIn, Glow, Badge, glowOf, rgba, prefersReducedMotion, useClubTheme } from "./ui";

type AppId = "social" | "kickabout" | "league" | "fixtures" | "messages";
type Leave = HubPhase | "settings";
interface App { id: AppId | Leave; label: string; icon: string; bg: [string, string] }

const APPS: App[] = [
  { id: "social", label: "Social", icon: "💬", bg: ["#34d399", "#047857"] },
  { id: "kickabout", label: "Kickabout", icon: "⚽", bg: ["#a3e635", "#15803d"] },
  { id: "league", label: "League", icon: "🏆", bg: ["#fcd34d", "#d97706"] },
  { id: "fixtures", label: "Fixtures", icon: "📅", bg: ["#38bdf8", "#0369a1"] },
  { id: "messages", label: "Messages", icon: "💌", bg: ["#f472b6", "#e11d48"] },
  { id: "shop-kib", label: "Shop", icon: "🛍️", bg: ["#fb923c", "#ea580c"] },
  { id: "store", label: "Store", icon: "🛒", bg: ["#fcd34d", "#7c3aed"] },
  { id: "casino-menu", label: "Casino", icon: "🎰", bg: ["#facc15", "#dc2626"] },
  { id: "sponsors", label: "Sponsors", icon: "🤝", bg: ["#2dd4bf", "#0f766e"] },
  { id: "ownership", label: "Owner", icon: "🏛️", bg: ["#818cf8", "#4338ca"] },
  { id: "garden", label: "Garden", icon: "🌳", bg: ["#22c55e", "#166534"] },
  { id: "achievements", label: "Awards", icon: "⭐", bg: ["#a78bfa", "#6d28d9"] },
  { id: "settings", label: "Settings", icon: "⚙️", bg: ["#9ca3af", "#4b5563"] },
];
/** The dock: the four apps that open inside the phone and get used most. */
const DOCK = new Set<string>(["social", "messages", "fixtures", "kickabout"]);
const INSIDE = new Set<string>(["social", "kickabout", "league", "fixtures", "messages"]);
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const appOf = (id: AppId) => APPS.find((a) => a.id === id)!;

// ── What is unread (per phone, in this browser — a convenience, not state) ──
const SOCIAL_SEEN = "star-phone-social-seen";
const MSGS_SEEN = "star-phone-msgs-seen";
function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private window */ }
}

interface Msg { from: string; icon: string; text: string; tone: [string, string] }
/** Messages — a sketch of what the phone could tell you. Built from real
 *  career facts; the wording is placeholder. */
function buildMessages(career: CareerState): Msg[] {
  const next = career.fixtures.filter((f) => !f.played).sort((a, b) => a.week - b.week)[0];
  const msgs: Msg[] = [];
  if (career.managerNews) msgs.push({ from: "The club", icon: "🏟️", text: career.managerNews, tone: ["#60a5fa", "#1d4ed8"] });
  if (next) msgs.push({ from: career.manager?.name ? `Gaffer (${career.manager.name})` : "Gaffer", icon: "🧢", text: `${short(next.opponent)} next. Be ready.`, tone: ["#34d399", "#047857"] });
  msgs.push({ from: "Agent", icon: "💼", text: `${career.contract.seasonsRemaining} season${career.contract.seasonsRemaining === 1 ? "" : "s"} left on your deal at ★${formatMoney(career.contract.wage)} a week.`, tone: ["#fbbf24", "#b45309"] });
  if (career.energy < 60) msgs.push({ from: "Physio", icon: "🩺", text: `Energy's at ${Math.round(career.energy)}%. Rest up or drink a can.`, tone: ["#f87171", "#b91c1c"] });
  msgs.push({ from: "Mum", icon: "❤️", text: "Proud of you. Eat something green.", tone: ["#f472b6", "#be185d"] });
  return msgs;
}
const msgKey = (m: Msg) => `${m.from}|${m.text}`;

export default function PhoneHome({ career, onToggleLike, onLeave }: {
  career: CareerState;
  onToggleLike?: (postId: string) => void;
  onLeave: (ph: Leave) => void;
}) {
  const theme = useClubTheme(career);
  const [app, setApp] = useState<AppId | null>(null);
  const [closing, setClosing] = useState(false);
  /** The app has finished zooming open. The real match sizes its canvas
   *  once, when it mounts, so Kickabout waits for this (mid-zoom it would
   *  measure a pitch a seventh of the size). */
  const [settled, setSettled] = useState(true);
  /** Where the app zooms out of: the tapped icon's centre, in the screen. */
  const [origin, setOrigin] = useState("50% 50%");
  const screenRef = useRef<HTMLDivElement>(null);
  const dateLabel = formatDateNumeric(
    fixtureDate(career.player.startYear, career.season, career.week, "saturday", divisionOf(career)),
  ).replace(/\/\d{2}$/, "");

  // The phone's size: a real phone's shape, but a little wider than the feed's
  // old 390:844 so the apps have room on a small screen.
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const on = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      const h = r.height - 8;
      const w = Math.min(r.width - 16, Math.round(h * 0.6));
      setSize({ w, h });
    };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Badges. Read once the page is in the browser (localStorage), then kept
  // in state so opening an app clears its badge straight away.
  const msgs = useMemo(() => buildMessages(career), [career]);
  const [seenMsgs, setSeenMsgs] = useState<Set<string> | null>(null);
  const [socialSeen, setSocialSeen] = useState<number | null>(null);
  useEffect(() => {
    try { setSeenMsgs(new Set(JSON.parse(readLS(MSGS_SEEN) ?? "[]") as string[])); } catch { setSeenMsgs(new Set()); }
    const s = Number(readLS(SOCIAL_SEEN));
    setSocialSeen(Number.isFinite(s) && s > 0 ? s : -1);
  }, []);
  const lastPostAt = useMemo(() => Math.max(0, ...(career.media?.posts ?? []).map((p) => p.at)), [career.media]);
  const badges: Partial<Record<AppId | Leave, number>> = {
    // Sponsor offers waiting for an answer (lib/star/sponsorDeals.ts).
    sponsors: brandsOf(career).offers.length,
    messages: seenMsgs ? msgs.filter((m) => !seenMsgs.has(msgKey(m))).length : 0,
    // Never opened here before: only what the last match stirred up counts,
    // not a whole season of history.
    social: socialSeen === null ? 0 : socialSeen === -1 ? (hasFreshMedia(career) ? 1 : 0) : unreadCount(career, socialSeen),
  };
  const markSeen = (id: AppId) => {
    if (id === "messages") {
      const all = new Set(Array.from(seenMsgs ?? []).concat(msgs.map(msgKey)));
      setSeenMsgs(all);
      writeLS(MSGS_SEEN, JSON.stringify(Array.from(all).slice(-40)));
    }
    if (id === "social") {
      setSocialSeen(lastPostAt || 1);
      writeLS(SOCIAL_SEEN, String(lastPostAt || 1));
    }
  };

  const open = (id: AppId | Leave, from?: HTMLElement | null) => {
    if (!INSIDE.has(id)) return onLeave(id as Leave);
    const box = screenRef.current?.getBoundingClientRect();
    const r = from?.getBoundingClientRect();
    if (box && r) setOrigin(`${Math.round(r.left + r.width / 2 - box.left)}px ${Math.round(r.top + r.height / 2 - box.top)}px`);
    setClosing(false);
    markSeen(id as AppId);
    setSettled(false);
    setApp(id as AppId);
    setTimeout(() => setSettled(true), prefersReducedMotion() ? 0 : 420);
  };
  const goHome = () => {
    if (prefersReducedMotion()) { setApp(null); return; }
    setClosing(true);
    setTimeout(() => { setApp(null); setClosing(false); }, 230);
  };

  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      {size && (
        <div style={{ width: size.w, height: size.h }}>
          <PhoneFrame statusLabel={dateLabel} wallpaper={wallpaper(theme.glow, theme.trim)} rim={theme.glow}>
            <div ref={screenRef} className="relative flex min-h-0 flex-1 flex-col">
              {app === null && <Grid career={career} glow={theme.glow} badges={badges} onOpen={open} />}
              {app !== null && (
                <div
                  key={app}
                  className={`${closing ? "kit-app-close" : "kit-app-open"} flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[22px]`}
                  style={{ transformOrigin: origin, background: `radial-gradient(110% 38% at 50% 0%, ${rgba(theme.glow, 0.24)} 0%, transparent 70%), linear-gradient(180deg, #0b1220, #05080f)` }}
                >
                  {app === "social" && <MediaFeed career={career} mode="browse" onToggleLike={onToggleLike} inPhone />}
                  {app === "kickabout" && <Kickabout ready={settled} />}
                  {app === "league" && (
                    <AppShell app={appOf("league")}>
                      <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-[12px]"><LeagueScreen career={career} compact /></div>
                    </AppShell>
                  )}
                  {app === "fixtures" && <Fixtures career={career} glow={theme.glow} />}
                  {app === "messages" && <Messages msgs={msgs} />}
                  <div className="flex shrink-0 justify-center pb-0.5 pt-1">
                    <PressButton
                      variant="secondary"
                      size="none"
                      onClick={goHome}
                      aria-label="Home"
                      className="rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white/85"
                    >
                      ◀ Home
                    </PressButton>
                  </div>
                </div>
              )}
            </div>
          </PhoneFrame>
        </div>
      )}
    </div>
  );
}

/** The home screen's wallpaper: your club's colours glowing out of the dark. */
function wallpaper(glow: string, trim: string): React.CSSProperties {
  const second = glowOf(trim, glow);
  return {
    background: `radial-gradient(120% 55% at 15% 0%, ${rgba(glow, 0.62)} 0%, transparent 62%), radial-gradient(100% 50% at 100% 100%, ${rgba(second, 0.38)} 0%, transparent 60%), linear-gradient(165deg, #0c1629 0%, #05080f 70%)`,
  };
}

function AppIcon({ app, size = 50, badge = 0, index = 0, onOpen, label = true }: {
  app: App; size?: number; badge?: number; index?: number; label?: boolean;
  onOpen: (id: AppId | Leave, from?: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <button onClick={() => onOpen(app.id, ref.current)} className="kib-press flex min-w-0 flex-col items-center gap-1">
      <span
        ref={ref}
        className="kit-icon-in relative grid aspect-square place-items-center rounded-[28%]"
        style={{
          width: size,
          animationDelay: `${index * 26}ms`,
          fontSize: size * 0.48,
          background: `linear-gradient(160deg, ${app.bg[0]}, ${app.bg[1]})`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), inset 0 -3px 6px rgba(0,0,0,.25), 0 7px 14px -6px rgba(0,0,0,.8)",
        }}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-[6%] top-[4%] h-[46%] rounded-t-[40%] bg-gradient-to-b from-white/35 to-transparent" />
        <span className="relative" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))" }}>{app.icon}</span>
        <Badge count={badge} delay={380 + index * 26} />
      </span>
      {label && <span className="w-full truncate text-center text-[9.5px] font-bold text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.9)" }}>{app.label}</span>}
    </button>
  );
}

function Grid({ career, glow, badges, onOpen }: {
  career: CareerState; glow: string; badges: Partial<Record<AppId, number>>;
  onOpen: (id: AppId | Leave, from?: HTMLElement | null) => void;
}) {
  const next = career.fixtures.filter((f) => !f.played).sort((a, b) => a.week - b.week)[0];
  const grid = APPS.filter((a) => !DOCK.has(a.id));
  const dock = APPS.filter((a) => DOCK.has(a.id));
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
      {/* A widget, the way a phone's home screen has one. */}
      {next ? <NextMatchWidget career={career} next={next} /> : (
        <ClubCard glow={glow} className="rounded-[20px] px-3 py-2">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Season complete</div>
          <div className="text-[11px] font-bold text-white/75">★ {formatMoney(career.money)} in the bank</div>
        </ClubCard>
      )}
      <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-2.5">
        {grid.map((a, i) => (
          <AppIcon key={a.id} app={a} index={i} badge={badges[a.id as AppId] ?? 0} onOpen={onOpen} />
        ))}
      </div>
      <div className="min-h-0 flex-1" />
      {/* The dock. */}
      <div
        className="mb-1 grid grid-cols-4 gap-2 rounded-[22px] px-2.5 pb-2 pt-2"
        style={{ background: "rgba(255,255,255,.11)", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), 0 8px 20px -10px rgba(0,0,0,.8)" }}
      >
        {dock.map((a, i) => (
          <AppIcon key={a.id} app={a} index={grid.length + i} badge={badges[a.id as AppId] ?? 0} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function NextMatchWidget({ career, next }: { career: CareerState; next: CareerState["fixtures"][number] }) {
  const me = career.player.club;
  const home = next.home ? me : next.opponent;
  const away = next.home ? next.opponent : me;
  const hk = kitsOf(home, career.clubKits?.[home]).home;
  const ak = kitsOf(away, career.clubKits?.[away]).home;
  return (
    <ClubCard duel={[glowOf(hk.shirt, hk.trim), glowOf(ak.shirt, ak.trim)]} className="kit-rise relative overflow-hidden rounded-[20px] px-3 pb-2 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[8.5px] font-black uppercase tracking-[0.2em] text-emerald-300">Next match</span>
        <span className="truncate pl-2 text-[9.5px] font-black text-white/70">
          {fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career))}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Crest club={home} kit={hk} />
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-black text-white">
          {short(home)} <span className="text-white/45">v</span> {short(away)}
        </div>
        <Crest club={away} kit={ak} />
      </div>
      <div className="mt-1 text-center text-[10px] font-bold text-white/65">
        ★ <CountUp value={career.money} format={(n) => formatMoney(Math.round(n))} className="font-black text-yellow-200" /> in the bank
      </div>
    </ClubCard>
  );
}

function Crest({ club, kit }: { club: string; kit: { shirt: string; trim: string } }) {
  return (
    <div className="relative grid h-8 w-8 shrink-0 place-items-center">
      <Glow color={glowOf(kit.shirt, kit.trim)} alpha={0.5} className="inset-0 blur-md" />
      <div className="relative" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
        <ClubBadge club={club} kit={kit} size={28} />
      </div>
    </div>
  );
}

function AppShell({ app, children, right }: { app: App; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 pb-2 pt-1.5">
        <span
          className="relative grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[15px]"
          style={{ background: `linear-gradient(160deg, ${app.bg[0]}, ${app.bg[1]})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 4px 8px -3px rgba(0,0,0,.7)" }}
        >
          {app.icon}
        </span>
        <span className="flex-1 text-[14px] font-black tracking-tight text-white">{app.label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * KICKABOUT — Infinite Highlights on your phone. The real match through
 * EnginePlay, one random chance after another, with a running score.
 */
function Kickabout({ ready }: { ready: boolean }) {
  const stream = useRef<{ rng: () => number; mem: ReturnType<typeof newSimMemory>; last?: string } | null>(null);
  if (!stream.current) stream.current = { rng: mulberry32((Date.now() & 0xffff) + 7), mem: newSimMemory() };
  const kinds = withoutSwitchedOff(SCENARIO_KINDS);
  const openOn = useCallback((): Scenario => {
    const st = stream.current!;
    const spec = nextHighlight(kinds, st.rng, st.mem, st.last);
    const sc = buildSimScenario(spec ?? { kind: "one_on_one", seed: 1 } as never);
    st.last = pictureKey(sc);
    return sc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [score, setScore] = useState({ goals: 0, chances: 0 });
  const onResolved = useCallback((r: ChanceResolved) => {
    setScore((s) => ({ goals: s.goals + (r.outcome === "goal" ? 1 : 0), chances: s.chances + 1 }));
  }, []);

  // The pitch is 5:8. Fit it to the phone's screen by height as well as width.
  const areaRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    // Layout size, not the on-screen box: the app may still be zooming in.
    const el = areaRef.current;
    if (ready && el) setW(Math.floor(Math.min(el.clientWidth - 8, (el.clientHeight - 4) * (5 / 8))));
  }, [ready]);
  return (
    <AppShell
      app={appOf("kickabout")}
      right={
        <span className="rounded-full bg-gradient-to-b from-emerald-400/30 to-emerald-600/20 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-emerald-100 ring-1 ring-emerald-300/30">
          ⚽ {score.goals} / {score.chances}
        </span>
      }
    >
      <div ref={areaRef} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-1">
        {w > 0 && (
          <div style={{ width: w }} className="overflow-hidden rounded-xl" >
            <EnginePlay openOn={openOn} bare fitParent onChanceResolved={onResolved} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Fixtures({ career, glow }: { career: CareerState; glow: string }) {
  const list = [...career.fixtures].sort((a, b) => a.week - b.week);
  const upcoming = list.filter((f) => !f.played).slice(0, 12);
  const played = list.filter((f) => f.played).slice(-4).reverse();
  const row = (f: (typeof list)[number], i: number, next = false) => {
    const date = fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career));
    const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
    const res = f.played && us !== undefined && them !== undefined ? (us > them ? "W" : us === them ? "D" : "L") : null;
    const tone = res === "W" ? "from-emerald-400 to-emerald-600" : res === "L" ? "from-red-500 to-red-700" : "from-gray-400 to-gray-600";
    const body = (
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="w-[44px] shrink-0 text-[9px] font-bold leading-tight text-white/60">{date}</span>
        <ClubBadge club={f.opponent} kit={kitsOf(f.opponent, career.clubKits?.[f.opponent]).home} size={20} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{f.home ? "v" : "@"} {short(f.opponent)}</span>
        <span className="max-w-[58px] shrink-0 truncate rounded-full bg-white/[0.08] px-1.5 py-[1px] text-[8px] font-black uppercase tracking-wide text-white/60">{f.competition ?? "League"}</span>
        {f.played && (
          <span className={`flex shrink-0 items-center gap-1 rounded-md bg-gradient-to-b ${tone} px-1.5 py-[1px] text-[11px] font-black tabular-nums text-white shadow`}>
            {us}-{them}
          </span>
        )}
      </div>
    );
    return (
      <RiseIn key={`${f.week}-${f.opponent}-${f.kind}`} index={i} step={35}>
        {next ? (
          <ClubCard glow={glow} className="relative mx-2 mb-1 rounded-xl">
            <span className="absolute -top-1.5 right-2 rounded-full bg-emerald-400 px-1.5 text-[8px] font-black uppercase tracking-widest text-gray-950">Next</span>
            {body}
          </ClubCard>
        ) : (
          <div className="mx-2 mb-1 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.06]">{body}</div>
        )}
      </RiseIn>
    );
  };
  return (
    <AppShell app={appOf("fixtures")}>
      <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto pb-1">
        {played.length > 0 && <div className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Results</div>}
        {played.map((f, i) => row(f, i))}
        <div className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Coming up</div>
        {upcoming.map((f, i) => row(f, played.length + i, i === 0))}
      </div>
    </AppShell>
  );
}

function Messages({ msgs }: { msgs: Msg[] }) {
  return (
    <AppShell app={appOf("messages")}>
      <div className="kib-noscroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pt-2.5">
        <div className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Today</div>
        {msgs.map((m, i) => (
          <RiseIn key={i} index={i} step={70}>
            <div className="flex items-end gap-2">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px]"
                style={{ background: `linear-gradient(160deg, ${m.tone[0]}, ${m.tone[1]})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 4px 8px -3px rgba(0,0,0,.7)" }}
              >
                {m.icon}
              </span>
              <div className="min-w-0 max-w-[82%]">
                <div className="mb-0.5 pl-1 text-[9.5px] font-black text-white/60">{m.from}</div>
                <div
                  className="rounded-2xl rounded-bl-md px-3 py-1.5 text-[11.5px] font-bold leading-snug text-white"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.07))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)" }}
                >
                  {m.text}
                </div>
              </div>
            </div>
          </RiseIn>
        ))}
      </div>
    </AppShell>
  );
}
