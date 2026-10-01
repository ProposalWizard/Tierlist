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
import PlayerAvatar, { useAvatarStyle } from "@/components/star/legacy/PlayerAvatar";
import ClubBadge from "@/components/star/ClubBadge";
import { KitStyles, Stadium, Pitch, PressButton, ClubCard, Shine, Glow, RiseIn, clubTheme, rgba, useClubTheme } from "@/components/star/legacy/ui";

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
  // Never taller than about half the screen, so a short menu (no save yet)
  // does not blow him up to fill it.
  const avH = Math.max(150, Math.min(stage.h - 6, 520, Math.round(stage.vh * 0.47)));
  const avW = Math.min(stage.w, Math.round(avH * 0.86));

  const firstEmpty = saves.find((s) => s.empty)?.slot;
  const newGame = () => {
    if (!career) return p.onNewGameInSlot(activeSlot);
    if (firstEmpty !== undefined) return p.onNewGameInSlot(firstEmpty);
    setSheet("full");
  };
  const signed = !!career && hasClub(career);
  const shown = career ?? NO_SAVE_PLAYER;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-[#04070e] text-white"
      onPointerMove={onMove}
      style={{ touchAction: "manipulation" }}
    >
      <KitStyles />
      {/* The stadium, fading up out of the dark while the floodlights
          flicker on, with a slow camera drift and the pointer's lean. */}
      <div className="absolute inset-0" style={{ transform: `translate3d(${-tilt.x * 10}px, ${-tilt.y * 6}px, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
        <div className="kit-fade absolute inset-[-6%]">
          <div className="kit-drift absolute inset-0">
            <Stadium glow={theme.glow} intro big pitch={false} />
          </div>
        </div>
        <Motes />
      </div>
      {/* Vignette, so the menu reads over the lights. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 75% at 50% 42%, transparent 45%, rgba(0,0,0,.55) 100%), linear-gradient(180deg, rgba(0,0,0,.35) 0%, transparent 22%, transparent 52%, rgba(2,4,10,.92) 82%)" }} />

      <div className="relative mx-auto flex h-full max-w-md flex-col px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        <Wordmark glow={theme.glow} />

        {/* You. */}
        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-end justify-center">
          {!career && (
            <div className="kit-rise absolute inset-x-0 top-[15%] text-center" style={{ animationDelay: "900ms" }}>
              <div className="text-[13px] font-black uppercase tracking-[0.1em] text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.8)" }}>Every legend starts with a trial</div>
              <div className="mt-1 text-[11.5px] font-bold text-white/65">Make your player. Earn a contract. Go.</div>
            </div>
          )}
          <div className="kit-rise absolute inset-x-0 bottom-0 flex justify-center" style={{ animationDelay: "520ms" }}>
            {/* The lean lives on its own wrapper: a finished rise-in holds
                its end state, which would override a transform set here. */}
            <div className="relative" style={{ transform: `translate3d(${tilt.x * 5}px, 0, 0)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" }}>
              {/* The patch of pitch he stands on, lit in the club colour. */}
              <Glow color={theme.glow} alpha={0.45} className="bottom-[2%] left-1/2 h-[18%] w-[80%] -translate-x-1/2 blur-2xl" />
              <Pitch className="-bottom-[7%] left-1/2 h-[20%] w-[190%] -translate-x-1/2" />
              <div className="kib-breathe">
                <PlayerAvatar career={shown} width={avW} height={avH} look={look} />
              </div>
            </div>
          </div>
        </div>

        {/* The menu. */}
        <div className="relative -mt-3 space-y-2">
          {career ? (
            <RiseIn index={0} delay={760}>
              <PressButton variant="primary" pulse onClick={p.onContinue} className="relative w-full overflow-hidden rounded-2xl px-4 py-2.5 text-left" size="none">
                <Shine loop every={4.5} />
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-[18px]" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>▶</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[19px] font-black uppercase leading-none tracking-wide">Continue</div>
                    <div className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] font-bold text-white/90">
                      {signed && <ClubBadge club={career.player.club} kit={{ shirt: theme.shirt, trim: theme.trim }} size={16} />}
                      <span className="truncate">
                        {signed
                          ? `${short(career.player.club)} · Season ${career.season}`
                          : `${career.player.firstName} ${career.player.lastName} · ${career.retired ? "Retired" : "No club yet"}`}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-gradient-to-b from-yellow-200 to-amber-400 px-2 py-1 text-[13px] font-black tabular-nums text-gray-950" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), 0 3px 8px -2px rgba(0,0,0,.4)" }}>
                    ★ {(career.stars ?? 1).toFixed(1)}
                  </span>
                </div>
              </PressButton>
            </RiseIn>
          ) : null}
          <RiseIn index={career ? 1 : 0} delay={760}>
            <MenuButton icon="＋" label="New Game" primary={!career} onClick={newGame} />
          </RiseIn>
          <RiseIn index={career ? 2 : 1} delay={760}>
            <MenuButton icon="▤" label="Load Game" hint={`${saves.filter((s) => !s.empty).length} of ${saves.length} saves`} onClick={() => setSheet("load")} />
          </RiseIn>
          {p.onSettings && (
            <RiseIn index={career ? 3 : 2} delay={760}>
              <MenuButton icon="⚙" label="Settings" onClick={p.onSettings} />
            </RiseIn>
          )}
          <RiseIn index={career ? 4 : 3} delay={760}>
            <div className="flex items-center justify-center gap-4 pt-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
              {p.showPlayArea && <a href="/star-play-dev" className="kib-press hover:text-white">Play Area</a>}
              {p.showPlayArea && <span className="text-white/25">·</span>}
              <button onClick={() => setSheet("credits")} className="kib-press uppercase hover:text-white">Credits</button>
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
      <div className="relative inline-block px-1" style={{ filter: `drop-shadow(0 3px 0 rgba(0,0,0,.5)) drop-shadow(0 0 18px ${rgba(glow, 0.55)})` }}>
        <div
          className="kit-text-shine pr-1 text-[40px] font-black italic leading-[1.05] tracking-[-0.04em] min-[380px]:text-[44px]"
          style={{ backgroundImage: "linear-gradient(100deg, #f8fafc 0%, #e2e8f0 38%, #ffffff 46%, #fde68a 50%, #ffffff 54%, #e2e8f0 62%, #f8fafc 100%)" }}
        >
          KNOWITBALL
        </div>
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-300/80" />
        <span className="text-[10.5px] font-black uppercase tracking-[0.32em] text-amber-200" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>Road to the Ballon d&apos;Or</span>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-300/80" />
      </div>
    </div>
  );
}

function MenuButton({ icon, label, hint, primary = false, onClick }: { icon: string; label: string; hint?: string; primary?: boolean; onClick: () => void }) {
  return (
    <PressButton
      variant={primary ? "primary" : "secondary"}
      pulse={primary}
      size="none"
      onClick={onClick}
      className="relative flex h-[48px] w-full items-center gap-3 overflow-hidden rounded-2xl px-4 text-left"
    >
      {primary && <Shine loop every={4.5} />}
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[14px] text-white/90">{icon}</span>
      <span className="flex-1 text-[15px] font-black uppercase tracking-wide">{label}</span>
      {hint && <span className="text-[10.5px] font-bold text-white/55">{hint}</span>}
      <span className="text-[15px] text-white/40">›</span>
    </PressButton>
  );
}

/** Dust drifting up through the floodlight beams. */
function Motes() {
  const motes = Array.from({ length: 16 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    top: `${30 + ((i * 53) % 55)}%`,
    size: 1.5 + (i % 3),
    dx: `${((i * 29) % 40) - 20}px`,
    dur: `${5 + (i % 5)}s`,
    delay: `${(i * 0.45) % 5}s`,
  }));
  return (
    <div className="pointer-events-none absolute inset-0">
      {motes.map((m, i) => (
        <span
          key={i}
          className="kit-mote absolute rounded-full bg-white"
          style={{ left: m.left, top: m.top, width: m.size, height: m.size, boxShadow: "0 0 6px rgba(255,255,255,.8)", ["--dx" as string]: m.dx, ["--dur" as string]: m.dur, ["--delay" as string]: m.delay } as React.CSSProperties}
        />
      ))}
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
                      {s.signed ? `${short(s.club ?? "")} · Season ${s.season}` : "No club yet"} · <span className="text-amber-300">★{s.starRating?.toFixed(1)}</span>
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
