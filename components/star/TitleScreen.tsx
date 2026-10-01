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
import { KitStyles, PressButton, ClubCard, Shine, Glow, RiseIn, clubTheme, rgba, useClubTheme } from "./ui";

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

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-[#04100a] text-white"
      onPointerMove={onMove}
      style={{ touchAction: "manipulation" }}
    >
      <KitStyles />
      {/* THE SET (v0.23, P82: "this whole pitch with the football, the name of
          it, the background's like a net. Our guy should be standing … on the
          left"): the goal's net behind, the pitch under him, a ball at his
          feet. Our own colours — the net is lit in your club's colour — and no
          store badges. A still picture; the net leans a little with the finger. */}
      <div className="absolute inset-0" style={{ transform: `translate3d(${-tilt.x * 8}px, ${-tilt.y * 4}px, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
        <div className="kit-fade absolute inset-[-4%]">
          <GoalNet glow={theme.glow} />
          <PitchFloor />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 70% at 30% 52%, transparent 40%, rgba(0,0,0,.5) 100%), linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 24%)" }} />

      <div className="relative mx-auto h-full max-w-md" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <Wordmark glow={theme.glow} />
        {!career && (
          <div className="kit-rise mt-1 text-center" style={{ animationDelay: "900ms" }}>
            <div className="text-[13px] font-black uppercase tracking-[0.1em] text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.8)" }}>Every legend starts with a trial</div>
          </div>
        )}

        {/* You, on the left, standing on the pitch with the ball at your feet. */}
        <div ref={stageRef} className="pointer-events-none absolute bottom-[9%] left-[-16%] h-[54%] w-[88%]">
          <div className="kit-rise absolute inset-x-0 bottom-0 flex justify-center" style={{ animationDelay: "520ms" }}>
            <div className="relative" style={{ transform: `translate3d(${tilt.x * 4}px, 0, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
              <Glow color={theme.glow} alpha={0.4} className="bottom-[1%] left-1/2 h-[10%] w-[90%] -translate-x-1/2 blur-xl" />
              <div className="kib-breathe">
                <PlayerAvatar career={shown} width={avW} height={avH} look={look} />
              </div>
            </div>
          </div>
        </div>
        <TitleBall className="kit-rise absolute bottom-[3.5%] left-[36%]" style={{ animationDelay: "700ms" }} />

        {/* The menu: flush to the right edge, slanted like a boot's tongue. */}
        <div className="absolute bottom-[4%] right-0 w-[50%] space-y-2">
          {career ? (
            <RiseIn index={0} delay={760}>
              <MenuButton primary icon="▶" label="Continue" onClick={p.onContinue}
                hint={club ? <span className="flex items-center gap-1">{<ClubBadge club={career.player.club} kit={{ shirt: theme.shirt, trim: theme.trim }} size={13} />}{club} · S{career.season}</span> : (career.retired ? "Retired" : "No club yet")}
                badge={<span className="bg-gradient-to-b from-yellow-200 to-amber-400 px-1.5 py-0.5 text-[13px] font-black leading-none tabular-nums text-gray-950">★{starLevel(career)}</span>} />
            </RiseIn>
          ) : null}
          <RiseIn index={career ? 1 : 0} delay={760}>
            <MenuButton primary={!career} icon="＋" label="New game" onClick={newGame} />
          </RiseIn>
          <RiseIn index={career ? 2 : 1} delay={760}>
            <MenuButton icon="▤" label="Load game" hint={`${saves.filter((s) => !s.empty).length}/${saves.length}`} onClick={() => setSheet("load")} />
          </RiseIn>
          {p.onSettings && (
            <RiseIn index={career ? 3 : 2} delay={760}>
              <MenuButton icon="⚙" label="Settings" onClick={p.onSettings} />
            </RiseIn>
          )}
          <RiseIn index={career ? 4 : 3} delay={760}>
            <div className="flex items-center justify-end gap-3 pr-3 pt-0.5 text-[12px] font-black uppercase tracking-[0.16em] text-white/75" style={{ textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>
              {p.showPlayArea && <a href="/star-play-dev" className="kib-press">Play Area</a>}
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

function Wordmark({ glow }: { glow: string }) {
  return (
    <div className="kit-drop-in relative z-10 text-center" style={{ animationDelay: "280ms" }}>
      <div className="relative inline-block px-1" style={{ filter: `drop-shadow(0 3px 0 rgba(0,0,0,.55)) drop-shadow(0 0 18px ${rgba(glow, 0.55)})` }}>
        <div
          className="kit-text-shine pr-1 text-[46px] font-black italic leading-[1.02] tracking-[-0.03em] min-[380px]:text-[52px]"
          style={{ backgroundImage: "linear-gradient(100deg, #f8fafc 0%, #e2e8f0 38%, #ffffff 46%, #fde68a 50%, #ffffff 54%, #e2e8f0 62%, #f8fafc 100%)" }}
        >
          KNOWITBALL
        </div>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/80" />
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>Road to the Ballon d&apos;Or</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/80" />
      </div>
    </div>
  );
}

/** One menu row: flat, flush to the right edge, a slanted left edge. */
function MenuButton({ icon, label, hint, badge, primary = false, onClick }: { icon: string; label: string; hint?: React.ReactNode; badge?: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`kib-press relative flex w-full items-center gap-2 overflow-hidden pl-5 pr-2 text-left ${primary ? "h-[58px] text-white" : "h-[46px] text-white"}`}
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
        {hint && <span className="mt-1 block truncate text-[12px] font-black uppercase leading-none tracking-wide text-white/80">{hint}</span>}
      </span>
      {badge}
    </button>
  );
}

/** The net behind the goal, lit in your club's colour: a mesh of diamonds,
 *  the crossbar along the top and a post down the right-hand side. */
function GoalNet({ glow }: { glow: string }) {
  return (
    <div className="absolute inset-x-0 top-0 h-[68%]" aria-hidden>
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 30% 100%, ${rgba(glow, 0.5)} 0%, transparent 70%), linear-gradient(180deg, #03100a 0%, #07210f 70%, #0a2d16 100%)` }} />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.26) 0 1.5px, transparent 1.5px 17px), repeating-linear-gradient(-45deg, rgba(255,255,255,.26) 0 1.5px, transparent 1.5px 17px)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 55%, transparent 100%)",
        }}
      />
      {/* crossbar and post */}
      <div className="absolute inset-x-0 top-[4%] h-[9px] bg-white/90" style={{ boxShadow: "0 3px 10px rgba(0,0,0,.6), 0 0 18px rgba(255,255,255,.25)" }} />
      <div className="absolute bottom-0 right-[6%] top-[4%] w-[9px] bg-white/85" style={{ boxShadow: "0 0 14px rgba(255,255,255,.2)" }} />
    </div>
  );
}

/** The pitch he stands on: mown bands, the goal line and the six-yard box in chalk. */
function PitchFloor() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[34%]" aria-hidden>
      <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(180deg, #23823f 0 38px, #1c6e34 38px 76px)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 38%, rgba(0,0,0,.25) 100%)" }} />
      <div className="absolute inset-x-0 top-0 h-[3px] bg-white/85" />
      <div className="absolute left-[8%] top-0 h-[52%] w-[3px] bg-white/55" />
      <div className="absolute left-[8%] top-[52%] h-[3px] w-[62%] bg-white/55" />
    </div>
  );
}

/** A big match ball with a soft shadow, at his feet. */
function TitleBall({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style} aria-hidden>
      <svg width="84" height="88" viewBox="0 0 96 100">
        <ellipse cx="50" cy="90" rx="38" ry="8" fill="rgba(0,0,0,.45)" />
        <circle cx="46" cy="46" r="42" fill="#fff" stroke="#0f172a" strokeWidth="2" />
        <path d="M46 24 62 36 56 55H36L30 36Z" fill="#111827" />
        <path d="M46 24V8M62 36 78 30M56 55 66 70M36 55 26 70M30 36 14 30" stroke="#111827" strokeWidth="2.4" fill="none" />
        <path d="M78 30 84 46 72 58 66 70M14 30 8 46 20 58 26 70" stroke="#cbd5e1" strokeWidth="1.6" fill="none" />
        <ellipse cx="34" cy="28" rx="13" ry="7" fill="rgba(255,255,255,.65)" transform="rotate(-30 34 28)" />
      </svg>
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
