"use client";

/**
 * THE TITLE SCREEN — the game's front door, like a console or phone game's
 * main menu.
 *
 * Harry, 28 Sep 2026: "i also want a REAL home screen for the app like that
 * has - new game, load game, settings etc more so for an app than the
 * computer but still want it built now that we have 3d avatar working".
 *
 * You, big, in your club kit under floodlights that flicker on as it opens
 * (or a player in the game's neutral green with no save yet), and five
 * choices: Continue, New Game, Load Game, Settings, and — small — Credits
 * (plus the Play Area in development).
 *
 * It only chooses WHERE to go. Every choice calls the handlers page.tsx
 * already had for Settings' Saves panel (handleSwitchSave,
 * handleStartNewInSlot, handleDeleteSave) or simply steps aside so today's
 * load carries on exactly as before. Nothing about saving or loading
 * changes here.
 *
 * Built from the design kit (components/star/ui). A still picture plus CSS
 * motion — no animation loop.
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { SaveSlotSummary } from "@/lib/star/storage";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { hasClub } from "@/lib/star/calendar";
import { starLevel } from "@/lib/star/starPoints";
import PlayerAvatar, { useAvatarStyle } from "./PlayerAvatar";
import ClubBadge from "./ClubBadge";
import { homeSkyFor, type HomeSky } from "@/lib/star/kickoff";
import { useRenderFailed } from "./StylePicture";
import { KitStyles, PressButton, ClubCard, Shine, Glow, RiseIn, Stadium, clubTheme, rgba, useClubTheme } from "./ui";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

/**
 * Skip the title and go straight in? For automated drivers (the playtest
 * harnesses open /star-dev and expect the dashboard) and anyone who asks:
 *   /star-dev?title=0, localStorage "star-title-skip" = "1", or a browser
 *   driven by Playwright (navigator.webdriver) unless localStorage
 *   "star-title-force" = "1" (how the title screen itself is filmed).
 */
export function titleScreenSkipped(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("title") === "0") return true;
    if (localStorage.getItem("star-title-skip") === "1") return true;
    if (navigator.webdriver && localStorage.getItem("star-title-force") !== "1") return true;
  } catch { /* private mode: show it */ }
  return false;
}

/** A stand-in so the title can show a player before any save exists: the
 *  game's neutral green kit, no club crest of anyone's. */
const NO_SAVE_PLAYER = {
  player: { club: "Knowitball", firstName: "Your", lastName: "Player", position: "ST", age: 17 },
  squadNumber: 10,
  clubKits: {},
} as unknown as CareerState;

export interface TitleScreenProps {
  /** The save that is open now (the last one played), or null. */
  career: CareerState | null;
  saves: SaveSlotSummary[];
  activeSlot: number;
  onContinue: () => void;
  onNewGameInSlot: (slot: number) => void;
  onLoadSlot: (slot: number) => void;
  onDeleteSlot: (slot: number) => void;
  /** Absent when there is no save to have settings for. */
  onSettings?: () => void;
  /** The Tutorial button (P64): replays the pointer tour on a save, or starts a new career, whose first Home runs it. */
  onTutorial?: () => void;
  /** Development only: the Play Area link. */
  showPlayArea?: boolean;
}

export default function TitleScreen(p: TitleScreenProps) {
  const { career, saves, activeSlot } = p;
  const theme = useClubTheme(career);
  const look = useAvatarStyle();
  const [sheet, setSheet] = useState<null | "load" | "full" | "credits">(null);

  // Parallax: the stadium drifts against the pointer, the player a little
  // the other way — the "camera" leans with your finger or mouse.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e: React.PointerEvent) => {
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    setTilt({ x: (e.clientX / w) * 2 - 1, y: (e.clientY / h) * 2 - 1 });
  };

  // The player fills whatever height the menu leaves.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 300, h: 260, vh: 664 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight, vh: window.innerHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const firstEmpty = saves.find((s) => s.empty)?.slot;
  const newGame = () => {
    if (!career) return p.onNewGameInSlot(activeSlot);
    if (firstEmpty !== undefined) return p.onNewGameInSlot(firstEmpty);
    setSheet("full");
  };
  const signed = !!career && hasClub(career);
  const shown = career ?? NO_SAVE_PLAYER;

  // The player stands on the left, as tall as the stage he is given.
  const avH = Math.max(150, Math.min(stage.h - 4, 560));
  const avW = Math.min(stage.w, Math.round(avH * 0.86));
  const club = signed && career ? short(career.player.club) : null;
  // The stand and sky behind the goal, as on Home: day, sunset or night by
  // the next match's kick-off (lib/star/kickoff.ts); sunset with no match yet
  // (Harry's favourite).
  const next = career ? [...career.fixtures].filter((f) => !f.played).sort((a, b) => a.week - b.week)[0] ?? null : null;
  const sky: HomeSky = career && next ? homeSkyFor(career, next) : "sunset";
  const plate = `/home/title-stadium-${sky}.webp`;
  const plateFailed = useRenderFailed(plate);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-[#04100a] text-white"
      onPointerMove={onMove}
      style={{ touchAction: "manipulation" }}
    >
      <KitStyles />
      {/* THE SET. v0.24 (Harry, 2 Oct 2026, P2-18: "the background needs to
          be like a stadium"): a generated stadium seen from the pitch
          (public/home/title-stadium-<sky>.webp). If it fails to load, the
          v0.23 set (the stand plate and a drawn pitch) shows instead.
          v0.25 (Harry and Mikey, 2 Oct 2026, P39): no goal. He stands on the
          halfway line, so a goal behind him made no sense; the full stadium
          stays. */}
      <div className="absolute inset-0" style={{ transform: `translate3d(${-tilt.x * 8}px, ${-tilt.y * 4}px, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
        {plateFailed ? (
          <div className="kit-fade absolute inset-[-4%]">
            <Stadium glow={theme.glow} intro big pitch={false} floods={false} />
            <SkyPlate sky={sky} />
            {sky !== "day" && <Floodlights />}
            <PitchFloor />
          </div>
        ) : (
          <div className="kit-fade absolute inset-[-4%]">
            <div className="absolute inset-0" aria-hidden style={{ backgroundImage: `url(${plate})`, backgroundSize: "cover", backgroundPosition: "center 62%" }} />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 70% at 30% 52%, transparent 40%, rgba(0,0,0,.5) 100%), linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 24%)" }} />

      <div className="relative mx-auto h-full max-w-md" style={{ paddingTop: "max(44px, calc(env(safe-area-inset-top) + 26px))" }}>
        <Wordmark glow={theme.glow} />
        {!career && (
          <div className="kit-rise mt-1 text-center" style={{ animationDelay: "900ms" }}>
            <div className="text-[13px] font-black uppercase tracking-[0.1em] text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.8)" }}>Every legend starts with a trial</div>
          </div>
        )}

        {/* You, on the left, standing on the pitch with the ball at your feet. */}
        {/* v0.24 (P2-17: "move him … higher up in the stadium … a bit further
            behind"): on the stadium set he stands further up the pitch and a
            little smaller, just in front of the goal. */}
        <div ref={stageRef} className={`pointer-events-none absolute ${plateFailed ? "bottom-[9%] left-[-18.5%] h-[54%] w-[88%]" : "bottom-[19%] left-[-13%] h-[45%] w-[80%]"}`}>
          <div className="kit-rise absolute inset-x-0 bottom-0 flex justify-center" style={{ animationDelay: "520ms" }}>
            <div className="relative" style={{ transform: `translate3d(${tilt.x * 4}px, 0, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
              <Glow color={theme.glow} alpha={0.4} className="bottom-[1%] left-1/2 h-[10%] w-[90%] -translate-x-1/2 blur-xl" />
              <div className="kib-breathe">
                <PlayerAvatar career={shown} width={avW} height={avH} look={look} />
              </div>
            </div>
          </div>
        </div>
        <TitleBall className={`kit-rise absolute ${plateFailed ? "bottom-[3.5%] left-[26%]" : "bottom-[15.5%] left-[28%]"}`} size={plateFailed ? 68 : 54} style={{ animationDelay: "700ms" }} />

        {/* The menu: slanted like a boot's tongue, 16 px in from the right
            edge (it used to run into the edge with no gutter). */}
        <div className="absolute bottom-[4%] right-4 w-[50%] space-y-2">
          {career ? (
            <RiseIn index={0} delay={760}>
              <MenuButton primary icon="▶" label="Continue" onClick={p.onContinue}
                // Club on one line, season on the next: "CHELSEA · S1" on one
                // line was cut to "CHELSEA · S" at 390 px.
                hint={club ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1"><span className="shrink-0"><ClubBadge club={career.player.club} kit={{ shirt: theme.shirt, trim: theme.trim }} size={13} /></span><span className="truncate">{club}</span></span>
                    <span className="whitespace-nowrap">Season {career.season}</span>
                  </span>
                ) : (career.retired ? "Retired" : "No club yet")}
                badge={<span className="bg-gradient-to-b from-yellow-200 to-amber-400 px-1.5 py-0.5 text-[13px] font-black leading-none tabular-nums text-gray-950">★{starLevel(career)}</span>} />
            </RiseIn>
          ) : null}
          <RiseIn index={career ? 1 : 0} delay={760}>
            <MenuButton primary={!career} icon="＋" label="New game" onClick={newGame} />
          </RiseIn>
          <RiseIn index={career ? 2 : 1} delay={760}>
            <MenuButton icon="▤" label="Load game" hint={`${saves.filter((s) => !s.empty).length}/${saves.length}`} onClick={() => setSheet("load")} />
          </RiseIn>
          {p.onTutorial && (
            <RiseIn index={career ? 3 : 2} delay={760}>
              <MenuButton icon="?" label="Tutorial" onClick={p.onTutorial} />
            </RiseIn>
          )}
          {p.onSettings && (
            <RiseIn index={career ? 4 : 3} delay={760}>
              <MenuButton icon="⚙" label="Settings" onClick={p.onSettings} />
            </RiseIn>
          )}
          <RiseIn index={career ? 5 : 4} delay={760}>
            <div className="flex items-center justify-end gap-3 pr-3 pt-0.5 text-[12px] font-black uppercase tracking-[0.16em] text-white/75" style={{ textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>
              {p.showPlayArea && <a href="/star-play-dev" className="kib-press whitespace-nowrap">Play Area</a>}
              {p.showPlayArea && <span className="text-white/30">·</span>}
              <button onClick={() => setSheet("credits")} className="kib-press uppercase">Credits</button>
            </div>
          </RiseIn>
        </div>
      </div>

      {(sheet === "load" || sheet === "full") && (
        <LoadSheet
          saves={saves}
          activeSlot={activeSlot}
          full={sheet === "full"}
          career={career}
          onClose={() => setSheet(null)}
          onLoad={(s) => { setSheet(null); p.onLoadSlot(s); }}
          onNew={(s) => { setSheet(null); p.onNewGameInSlot(s); }}
          onDelete={p.onDeleteSlot}
        />
      )}
      {sheet === "credits" && <Credits onClose={() => setSheet(null)} />}
    </div>
  );
}

/** The name, big (P64: "you can't even see the name of the game"): ONE line,
 *  KNOWITBALL, filling the width (Harry, 1 Oct 2026: "don't split knowit-ball").
 *  The size is measured, so it fills the screen in whatever font the phone has. */
function Wordmark({ glow }: { glow: string }) {
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(76);
  useEffect(() => {
    const fit = () => {
      const el = box.current, pr = probe.current;
      if (!el || !pr) return;
      // The probe is "KNOWITBALL" at 100px: scale so it fills 94% of the column, within 120px.
      const w = pr.getBoundingClientRect().width;
      if (w > 0) setPx(Math.max(36, Math.min(120, Math.floor((el.clientWidth * 0.94 * 100) / w))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, []);
  const word = "kit-text-shine block font-black italic uppercase tracking-[-0.04em]";
  const fill = { backgroundImage: "linear-gradient(100deg, #f8fafc 0%, #e2e8f0 38%, #ffffff 46%, #fde68a 50%, #ffffff 54%, #e2e8f0 62%, #f8fafc 100%)", fontSize: px, lineHeight: 0.9, paddingRight: "0.08em" } as const;
  return (
    <div ref={box} className="kit-drop-in relative z-10 text-center" style={{ animationDelay: "280ms" }}>
      <span ref={probe} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap font-black italic uppercase tracking-[-0.04em]" style={{ fontSize: 100 }}>KNOWITBALL</span>
      <div className="relative inline-block px-1" style={{ filter: `drop-shadow(0 4px 0 rgba(0,0,0,.6)) drop-shadow(0 0 22px ${rgba(glow, 0.6)})` }}>
        <span className={`${word} whitespace-nowrap`} style={fill}>KNOWITBALL</span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/80" />
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>Road to the Ballon d&apos;Or</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/80" />
      </div>
    </div>
  );
}

/** Two floodlight banks high in the corners, their beams falling inward and
 *  down onto the pitch (P65: "something about those headlights I like … put
 *  the headlight light coming down"). */
function Floodlights() {
  const lamp = (side: "left" | "right", delay: string) => (
    <div key={side} className="kit-flicker absolute top-[5.5%] rounded-[3px] bg-slate-800 p-[2px]"
      style={{ [side]: "2%", width: 50, height: 21, boxShadow: "0 0 18px 6px rgba(235,245,255,.7)", animationDelay: delay } as React.CSSProperties}>
      <div className="h-full w-full rounded-[2px]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.4px, rgba(255,255,255,.4) 2px, transparent 2.6px)", backgroundSize: "7px 5px" }} />
    </div>
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* The two beams: from each lamp bank down and in, widening onto the pitch. */}
      <svg className="kit-flicker absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ filter: "blur(3px)", mixBlendMode: "screen" }}>
        <defs>
          <linearGradient id="tb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eaf3ff" stopOpacity=".55" />
            <stop offset=".6" stopColor="#eaf3ff" stopOpacity=".16" />
            <stop offset="1" stopColor="#eaf3ff" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <polygon points="10,6 19,6 66,100 8,100" fill="url(#tb)" />
        <polygon points="81,6 90,6 92,100 34,100" fill="url(#tb)" />
      </svg>
      {lamp("left", "0ms")}{lamp("right", "260ms")}
      {/* The pool of light on the pitch. */}
      <div className="absolute inset-x-0 bottom-[6%] h-[40%]" style={{ background: "radial-gradient(60% 70% at 50% 60%, rgba(235,245,255,.22), transparent 75%)", mixBlendMode: "screen" }} />
    </div>
  );
}

/** One menu row: flat, flush to the right edge, a slanted left edge. */
function MenuButton({ icon, label, hint, badge, primary = false, onClick }: { icon: string; label: string; hint?: React.ReactNode; badge?: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`kib-press relative flex w-full items-center gap-2 overflow-hidden pl-5 pr-2 text-left ${primary ? "min-h-[54px] py-1.5 text-white" : "h-[42px] text-white"}`}
      style={{
        clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%)",
        background: primary ? "linear-gradient(180deg, #34d399, #059669)" : "linear-gradient(180deg, rgba(10,50,28,.92), rgba(5,32,17,.96))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), inset -1px 0 0 rgba(255,255,255,.2)",
      }}
    >
      {primary && <Shine loop every={4.5} />}
      <span className="shrink-0 text-[17px] leading-none text-white/90">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-black uppercase leading-none tracking-wide ${primary ? "text-[22px]" : "text-[18px]"}`}>{label}</span>
        {hint && <span className={`mt-1 block min-w-0 text-[12px] font-black uppercase leading-none tracking-tight text-white/80 ${typeof hint === "string" ? "truncate" : ""}`}>{hint}</span>}
      </span>
      {badge}
    </button>
  );
}

/** The stand behind the goal and the sky above it (public/home/, the same
 *  three pictures as Home). Its grass meets the goal line at 52%. */
function SkyPlate({ sky }: { sky: HomeSky }) {
  return (
    <div
      className="absolute inset-x-0 top-0 h-[52%]"
      aria-hidden
      style={{ backgroundImage: `url(/home/tall-${sky}.webp)`, backgroundSize: "cover", backgroundPosition: "center bottom" }}
    />
  );
}

/** The pitch he stands on: mown bands, the goal line and the six-yard box in chalk. */
function PitchFloor() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[48%]" aria-hidden>
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(180deg, #23823f 0 38px, #1c6e34 38px 76px)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 38%, rgba(0,0,0,.25) 100%)" }} />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-white/85" />
      <div className="absolute left-[8%] top-0 h-[52%] w-[3px] bg-white/55" />
      <div className="absolute left-[8%] top-[52%] h-[3px] w-[62%] bg-white/55" />
    </div>
  );
}

/** The ball at his feet: the match's own ball (public/star/ball.png, the
 *  one the real match draws), with a soft shadow on the grass under it.
 *  v0.25 (Harry and Mikey, 2 Oct 2026, P39: "the ball needs changing"): it
 *  was a hand-drawn ball with one black patch. */
const BALL_SRC = "/star/ball.png";
function TitleBall({ className = "", style, size = 68 }: { className?: string; style?: React.CSSProperties; size?: number }) {
  return (
    <div className={className} style={{ ...style, width: size, height: Math.round(size * 1.12) }} aria-hidden>
      <div className="absolute inset-x-[4%] bottom-0 h-[20%] rounded-[50%]" style={{ background: "radial-gradient(closest-side, rgba(0,0,0,.55), transparent)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BALL_SRC} alt="" draggable={false} className="absolute left-0 top-0 block select-none" style={{ width: size, height: size, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))" }} />
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="kit-rise w-full max-w-md rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-slate-900 to-[#070b14] p-4 sm:rounded-3xl"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", boxShadow: "0 -20px 50px -20px rgba(0,0,0,.9)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[18px] font-black uppercase tracking-wide">{title}</div>
          <button onClick={onClose} className="kib-press grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadSheet({ saves, activeSlot, full, career, onClose, onLoad, onNew, onDelete }: {
  saves: SaveSlotSummary[]; activeSlot: number; full: boolean; career: CareerState | null;
  onClose: () => void; onLoad: (slot: number) => void; onNew: (slot: number) => void; onDelete: (slot: number) => void;
}) {
  // Delete asks "Sure?" here instead of a browser box (which exits full screen).
  const [armed, setArmed] = useState<number | null>(null);
  return (
    <Sheet title="Load Game" onClose={onClose}>
      {full && (
        <div className="mb-3 rounded-xl bg-amber-400/15 px-3 py-2 text-[12px] font-bold text-amber-100 ring-1 ring-amber-300/30">
          All {saves.length} saves are in use. Delete one to start a new game.
        </div>
      )}
      <div className="space-y-2">
        {saves.map((s, i) => {
          const active = s.slot === activeSlot && !!career;
          const t = clubTheme(s.club ?? "", s.slot === activeSlot ? career : null);
          return (
            <RiseIn key={s.slot} index={i} step={70}>
              {s.empty ? (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-[18px] text-white/40">＋</span>
                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Save {s.slot}</div>
                    <div className="text-[13px] font-bold text-white/60">Empty</div>
                  </div>
                  <PressButton variant="secondary" size="sm" onClick={() => onNew(s.slot)}>New game</PressButton>
                </div>
              ) : (
                <ClubCard glow={t.glow} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="relative grid h-10 w-10 shrink-0 place-items-center">
                    <Glow color={t.glow} alpha={0.5} className="inset-0 blur-md" />
                    {s.signed && s.club ? <div className="relative"><ClubBadge club={s.club} kit={{ shirt: t.shirt, trim: t.trim }} size={36} /></div> : <span className="relative text-[20px]">⚽</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Save {s.slot}</span>
                      {active && <span className="rounded-full bg-emerald-400/20 px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-widest text-emerald-200">Last played</span>}
                      {s.retired && <span className="rounded-full bg-amber-400/20 px-1.5 py-[1px] text-[8.5px] font-black uppercase tracking-widest text-amber-200">Retired</span>}
                    </div>
                    <div className="truncate text-[14px] font-black text-white">{s.playerName}</div>
                    <div className="truncate text-[11px] font-bold text-white/65">
                      {s.signed ? `${short(s.club ?? "")} · Season ${s.season}` : "No club yet"} · <span className="text-amber-300">★{s.starRating}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <PressButton variant="primary" size="sm" onClick={() => onLoad(s.slot)}>Play</PressButton>
                    {armed === s.slot ? (
                      <div className="flex gap-1">
                        <button onClick={() => { setArmed(null); onDelete(s.slot); }} className="kib-press rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">Sure?</button>
                        <button onClick={() => setArmed(null)} className="kib-press rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setArmed(s.slot)} className="kib-press text-[10px] font-black uppercase tracking-wider text-red-300 hover:text-red-200">Delete</button>
                    )}
                  </div>
                </ClubCard>
              )}
            </RiseIn>
          );
        })}
      </div>
    </Sheet>
  );
}

function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Credits" onClose={onClose}>
      <div className="space-y-3 text-center">
        <div className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-[26px] font-black italic tracking-tight text-transparent">KNOWITBALL</div>
        <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-200">Road to the Ballon d&apos;Or</div>
        <div className="space-y-1 text-[13px] font-bold text-white/85">
          <div>Made by Harry, Mikey and Leo</div>
          <div className="text-white/60">knowitball.co.uk</div>
        </div>
        <PressButton variant="secondary" size="md" onClick={onClose} className="w-full">Back</PressButton>
      </div>
    </Sheet>
  );
}
