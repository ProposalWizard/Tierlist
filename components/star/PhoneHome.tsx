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
 * League, Fixtures and Messages open INSIDE the phone; Shop, Casino, Owner,
 * Garden, Sponsors and Settings open their real screens. The bar at the
 * bottom of the phone takes you back to the grid.
 *
 * Kickabout is the real match (one engine): EnginePlay, playing random
 * highlights one after another the way Infinite Highlights does, drawn
 * small enough to fit the phone's screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { divisionOf, fixtureDate, formatDateNumeric, fixtureDateLabel } from "@/lib/star/calendar";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { SCENARIO_KINDS, type Scenario } from "@/lib/star/canvasEngine";
import { withoutSwitchedOff } from "@/lib/star/switchedOffKinds";
import { nextHighlight, newSimMemory, buildSimScenario, pictureKey } from "@/lib/star/gallerySim";
import { mulberry32 } from "@/lib/star/season";
import { formatMoney } from "@/lib/star/money";
import PhoneFrame from "./PhoneFrame";
import MediaFeed from "./MediaFeed";
import LeagueScreen from "./LeagueScreen";
import EnginePlay from "./EnginePlay";
import type { ChanceResolved } from "./CanvasMatch";
import type { HubPhase } from "./HomeHub";

type AppId = "social" | "kickabout" | "league" | "fixtures" | "messages";
type Leave = HubPhase | "settings";

const APPS: { id: AppId | Leave; label: string; icon: string; bg: string }[] = [
  { id: "social", label: "Social", icon: "💬", bg: "from-emerald-400 to-emerald-600" },
  { id: "kickabout", label: "Kickabout", icon: "⚽", bg: "from-lime-400 to-green-700" },
  { id: "league", label: "League", icon: "🏆", bg: "from-amber-300 to-amber-600" },
  { id: "fixtures", label: "Fixtures", icon: "📅", bg: "from-sky-400 to-sky-700" },
  { id: "messages", label: "Messages", icon: "💌", bg: "from-pink-400 to-rose-600" },
  { id: "shop-kib", label: "Shop", icon: "🛍️", bg: "from-orange-400 to-orange-600" },
  { id: "casino-menu", label: "Casino", icon: "🎰", bg: "from-yellow-400 to-red-600" },
  { id: "sponsors", label: "Sponsors", icon: "🤝", bg: "from-teal-400 to-teal-700" },
  { id: "ownership", label: "Owner", icon: "🏛️", bg: "from-indigo-400 to-indigo-700" },
  { id: "garden", label: "Garden", icon: "🌳", bg: "from-green-500 to-green-800" },
  { id: "achievements", label: "Awards", icon: "⭐", bg: "from-violet-400 to-violet-700" },
  { id: "settings", label: "Settings", icon: "⚙️", bg: "from-gray-400 to-gray-600" },
];
const INSIDE = new Set<string>(["social", "kickabout", "league", "fixtures", "messages"]);
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

export default function PhoneHome({ career, onToggleLike, onLeave }: {
  career: CareerState;
  onToggleLike?: (postId: string) => void;
  onLeave: (ph: Leave) => void;
}) {
  const [app, setApp] = useState<AppId | null>(null);
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

  const open = (id: AppId | Leave) => (INSIDE.has(id) ? setApp(id as AppId) : onLeave(id as Leave));

  return (
    <div ref={boxRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      {size && (
        <div style={{ width: size.w, height: size.h }}>
          <PhoneFrame statusLabel={dateLabel}>
            {app === null && <Grid career={career} onOpen={open} />}
            {app === "social" && <MediaFeed career={career} mode="browse" onToggleLike={onToggleLike} inPhone />}
            {app === "kickabout" && <Kickabout />}
            {app === "league" && (
              <AppShell title="League" icon="🏆">
                <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-[12px]"><LeagueScreen career={career} /></div>
              </AppShell>
            )}
            {app === "fixtures" && <Fixtures career={career} />}
            {app === "messages" && <Messages career={career} />}
            {app !== null && (
              <button
                onClick={() => setApp(null)}
                aria-label="Home"
                className="mx-auto mt-1 shrink-0 rounded-full bg-white/10 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white/80 active:bg-white/20"
              >
                ◀ Home
              </button>
            )}
          </PhoneFrame>
        </div>
      )}
    </div>
  );
}

function Grid({ career, onOpen }: { career: CareerState; onOpen: (id: AppId | Leave) => void }) {
  const next = career.fixtures.filter((f) => !f.played).sort((a, b) => a.week - b.week)[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-2">
      {/* A widget, the way a phone's home screen has one. */}
      {next && (
        <div className="rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Next match</div>
          <div className="truncate text-[13px] font-black text-white">
            {next.home ? `${short(career.player.club)} v ${short(next.opponent)}` : `${short(next.opponent)} v ${short(career.player.club)}`}
          </div>
          <div className="text-[10px] font-bold text-white/60">
            {fixtureDateLabel(career.player.startYear, career.season, next.week, next.kind, divisionOf(career))} · ★ {formatMoney(career.money)} in the bank
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
        {APPS.map((a) => (
          <button key={a.id} onClick={() => onOpen(a.id)} className="flex flex-col items-center gap-1 active:scale-90">
            <span className={`grid aspect-square w-full max-w-[52px] place-items-center rounded-[14px] bg-gradient-to-br ${a.bg} text-[24px] shadow-lg shadow-black/40`}>
              {a.icon}
            </span>
            <span className="w-full truncate text-center text-[9.5px] font-bold text-white/90">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppShell({ title, icon, children, right }: { title: string; icon: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-3 pb-1.5 pt-0.5">
        <span className="text-[15px]">{icon}</span>
        <span className="flex-1 text-[13px] font-black text-white">{title}</span>
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
function Kickabout() {
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
    const r = areaRef.current?.getBoundingClientRect();
    if (r) setW(Math.floor(Math.min(r.width - 8, (r.height - 4) * (5 / 8))));
  }, []);
  return (
    <AppShell
      title="Kickabout"
      icon="⚽"
      right={<span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black tabular-nums text-emerald-200">{score.goals} / {score.chances}</span>}
    >
      <div ref={areaRef} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden pt-1">
        {w > 0 && (
          <div style={{ width: w }}>
            <EnginePlay openOn={openOn} bare fitParent onChanceResolved={onResolved} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Fixtures({ career }: { career: CareerState }) {
  const list = [...career.fixtures].sort((a, b) => a.week - b.week);
  const upcoming = list.filter((f) => !f.played).slice(0, 12);
  const played = list.filter((f) => f.played).slice(-4).reverse();
  const row = (f: (typeof list)[number]) => {
    const date = fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career));
    const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
    return (
      <div key={`${f.week}-${f.opponent}-${f.kind}`} className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="w-16 shrink-0 text-[10px] font-bold text-white/55">{date}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{f.home ? "v" : "@"} {short(f.opponent)}</span>
        <span className="shrink-0 text-[10px] font-bold text-white/50">{f.competition ?? "League"}</span>
        {f.played && <span className="shrink-0 text-[11px] font-black tabular-nums text-amber-200">{us}-{them}</span>}
      </div>
    );
  };
  return (
    <AppShell title="Fixtures" icon="📅">
      <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto">
        {played.length > 0 && <div className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-white/50">Results</div>}
        {played.map(row)}
        <div className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-white/50">Coming up</div>
        {upcoming.map(row)}
      </div>
    </AppShell>
  );
}

/** Messages — a sketch of what the phone could tell you. Built from real
 *  career facts; the wording is placeholder. */
function Messages({ career }: { career: CareerState }) {
  const next = career.fixtures.filter((f) => !f.played).sort((a, b) => a.week - b.week)[0];
  const msgs: { from: string; icon: string; text: string }[] = [];
  if (career.managerNews) msgs.push({ from: "The club", icon: "🏟️", text: career.managerNews });
  if (next) msgs.push({ from: career.manager?.name ? `Gaffer (${career.manager.name})` : "Gaffer", icon: "🧢", text: `${short(next.opponent)} next. Be ready.` });
  msgs.push({ from: "Agent", icon: "💼", text: `${career.contract.seasonsRemaining} season${career.contract.seasonsRemaining === 1 ? "" : "s"} left on your deal at ★${formatMoney(career.contract.wage)} a week.` });
  if (career.energy < 60) msgs.push({ from: "Physio", icon: "🩺", text: `Energy's at ${Math.round(career.energy)}%. Rest up or drink a can.` });
  msgs.push({ from: "Mum", icon: "❤️", text: "Proud of you. Eat something green." });
  return (
    <AppShell title="Messages" icon="💌">
      <div className="kib-noscroll min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pt-2">
        {msgs.map((m, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl bg-white/[0.06] p-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[16px]">{m.icon}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-black text-white">{m.from}</div>
              <div className="text-[11px] font-bold text-white/70">{m.text}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
