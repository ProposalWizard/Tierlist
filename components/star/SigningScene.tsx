"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { fitImage, getFittedHead } from "@/lib/star/faceFit";
import { managerLook, drawManagerHead } from "@/lib/star/managerFace";
import { paintHeroFigure, tint, rgba, luminance, HERO_CHIN_Y, HERO_FACE_H, type HeroLook, type P } from "@/lib/star/heroFigure";
import ClubBadge from "./ClubBadge";
import { Burst, KitStyles } from "./ui";
import { useScannedPortrait } from "./useScannedPortrait";
import { SIGNATURE_D, type ContractTerms } from "./TrialReward";

/**
 * THE SIGNING — you and the manager, sat across a desk, and you sign.
 *
 * Harry, 30 Sep 2026, on the paper contract screen: "The contract showing the
 * real terms is really cool… this isn't that interesting… it'll be cool if we
 * generated the player… with a generated manager of that club and have them
 * sat down together and then you show him actually signing the contract… you
 * get to tap and you would sign." So:
 *
 *   1. The office. Your player (the home screen's A2 figure, in this club's
 *      kit, with your face) and the manager (the same figure in a suit, with
 *      a generated face) in two chairs, the contract on the desk between
 *      them. The terms that matter are on it, big: club, seasons, wage —
 *      plus the shirt number and the bonuses, small.
 *   2. Tap: the camera drops onto the contract and a pen writes your name.
 *   3. Back out: the handshake, confetti, "Welcome to <club>". Continue.
 *
 * About 2.6 s from tap to Continue, and Skip is always there. Everything is
 * drawn by the game's own figure code — no video, so it is always YOUR
 * player in YOUR club's kit. A still canvas, repainted only when the pose
 * changes or a face arrives: no animation loop (the camera and the pen are
 * CSS transitions).
 */

/** The stage, in its own units; scaled to the screen's width. */
const SW = 360, SH = 430;
/** Figure scale on the stage, and where each man's shoulders sit. */
const FIG_S = 0.9;
const YOU_AT: P = [92, 172];
const BOSS_AT: P = [268, 172];
/** Where the desk's back edge is: everything below is desk. */
const DESK_Y = 240;
/** The contract on the desk, in stage units. */
const PAPER = { x: 54, y: 250, w: 242, h: 176 };
/** The signature line on the contract (paper units): where the pen writes. */
const SIG = { x: 132, y: 134, w: 80, h: 22 };
/** The handshake: the far arm held out, in figure design units. */
const REACH = { elbow: [171, 140] as P, hand: [196, 150] as P };
/** Timings, ms. */
const ZOOM_MS = 450, SIGN_MS = 1200, OUT_MS = 450, CHEER_MS = 500;

type Beat = "idle" | "zoom" | "sign" | "shake" | "done";

const money = (n: number) => `★${Math.round(n).toLocaleString("en-GB")}`;

/** Bumps when the readable copies of these pictures have loaded. */
function useFaceTicks(urls: string[]): number {
  const [tick, setTick] = useState(0);
  const key = urls.join("|");
  useEffect(() => {
    let alive = true;
    const offs: (() => void)[] = [];
    for (const url of key.split("|")) {
      const img = fitImage(url);
      const ready = () => { if (alive) setTick((t) => t + 1); };
      if (img.complete && img.naturalWidth) ready();
      else { img.addEventListener("load", ready, { once: true }); offs.push(() => img.removeEventListener("load", ready)); }
    }
    return () => { alive = false; offs.forEach((f) => f()); };
  }, [key]);
  return tick;
}

/** The office behind, the chairs, the two men and the desk. */
function paintOffice(
  ctx: CanvasRenderingContext2D,
  o: { you: HeroLook; boss: HeroLook; club: { shirt: string; trim: string }; shake: boolean },
) {
  const faceStyle = loadFaceStyle();
  const fakeFaceStyle = loadFakeFaceStyle();
  const { shirt } = o.club;

  // ── The wall: dark, in the club's colour, a warm light behind the crest ──
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, tint(shirt, -0.72));
  wall.addColorStop(1, tint(shirt, -0.86));
  ctx.fillStyle = wall; ctx.fillRect(0, 0, SW, DESK_Y + 2);
  const lamp = ctx.createRadialGradient(SW / 2, 66, 6, SW / 2, 66, 170);
  lamp.addColorStop(0, "rgba(255,226,170,0.32)"); lamp.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, SW, DESK_Y);
  // Wood panelling on the lower wall.
  const panel = ctx.createLinearGradient(0, 132, 0, DESK_Y);
  panel.addColorStop(0, "#2a1a10"); panel.addColorStop(1, "#160d07");
  ctx.fillStyle = panel; ctx.fillRect(0, 132, SW, DESK_Y - 132);
  ctx.fillStyle = "rgba(255,210,150,0.10)"; ctx.fillRect(0, 132, SW, 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
  for (let x = 30; x < SW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 136); ctx.lineTo(x, DESK_Y); ctx.stroke(); }
  // A thin club-colour stripe along the panelling's top.
  ctx.fillStyle = rgba(shirt, 0.55); ctx.fillRect(0, 128, SW, 4);

  // ── Two leather chairs ──
  for (const [cx] of [YOU_AT, BOSS_AT]) {
    const g = ctx.createLinearGradient(cx - 62, 0, cx + 62, 0);
    g.addColorStop(0, "#3b2418"); g.addColorStop(0.5, "#24150d"); g.addColorStop(1, "#120a06");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 58, DESK_Y);
    ctx.lineTo(cx - 60, 140);
    ctx.quadraticCurveTo(cx - 58, 108, cx, 104);
    ctx.quadraticCurveTo(cx + 58, 108, cx + 60, 140);
    ctx.lineTo(cx + 58, DESK_Y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,220,180,0.18)";
    for (const [dx, dy] of [[-34, 128], [0, 120], [34, 128], [-34, 158], [34, 158]]) {
      ctx.beginPath(); ctx.arc(cx + dx, dy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── The two men. You on the left facing right; the manager mirrored ──
  const reach = o.shake ? REACH : undefined;
  ctx.save();
  ctx.translate(YOU_AT[0] - 101 * FIG_S, YOU_AT[1] - 96 * FIG_S);
  ctx.scale(FIG_S, FIG_S);
  paintHeroFigure(ctx, o.you, faceStyle, fakeFaceStyle, { shadow: false, reach });
  ctx.restore();

  ctx.save();
  ctx.translate(BOSS_AT[0] + 101 * FIG_S, BOSS_AT[1] - 96 * FIG_S);
  ctx.scale(-FIG_S, FIG_S);
  paintHeroFigure(ctx, o.boss, faceStyle, fakeFaceStyle, { shadow: false, reach });
  // A suit: the white shirt in the jacket's V, lapels, and a tie in the club colour.
  ctx.fillStyle = "#eef1f5";
  ctx.beginPath(); ctx.moveTo(90, 83); ctx.lineTo(112, 83); ctx.lineTo(101, 112); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint(shirt, luminance(shirt) > 0.7 ? -0.35 : 0);
  ctx.beginPath(); ctx.moveTo(98, 87); ctx.lineTo(104, 87); ctx.lineTo(105.5, 96); ctx.lineTo(103, 126); ctx.lineTo(101, 129); ctx.lineTo(99, 126); ctx.lineTo(96.5, 96); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(86, 84); ctx.lineTo(95, 104); ctx.lineTo(101, 132); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(116, 84); ctx.lineTo(107, 104); ctx.lineTo(101, 132); ctx.stroke();
  ctx.restore();

  // ── The desk: a dark wood top running to the bottom of the frame ──
  const top = ctx.createLinearGradient(0, DESK_Y, 0, SH);
  top.addColorStop(0, "#4a2e1b"); top.addColorStop(0.35, "#5c3a22"); top.addColorStop(1, "#6e4528");
  ctx.fillStyle = top; ctx.fillRect(0, DESK_Y, SW, SH - DESK_Y);
  // The back edge catches the lamp; the men cast a soft shadow on the wood.
  ctx.fillStyle = "rgba(255,214,160,0.28)"; ctx.fillRect(0, DESK_Y, SW, 2);
  for (const [cx] of [YOU_AT, BOSS_AT]) {
    const sh = ctx.createRadialGradient(cx, DESK_Y + 4, 2, cx, DESK_Y + 4, 70);
    sh.addColorStop(0, "rgba(0,0,0,0.38)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh; ctx.fillRect(cx - 80, DESK_Y, 160, 40);
  }
  // Grain.
  ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const y = DESK_Y + 14 + i * 19;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(SW * 0.3, y - 4, SW * 0.6, y + 5, SW, y - 1); ctx.stroke();
  }
}

/** "Keith Andrews" → "K. Andrews", so the desk plate never cuts a name off. */
function plateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && !/^the$/i.test(parts[0]) ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

export default function SigningScene({
  career, club, playerName, managerName, terms, onDone,
}: {
  career: CareerState;
  /** The club whose contract this is (the parent club on a loan). */
  club: string;
  playerName: string;
  managerName: string;
  terms?: ContractTerms;
  onDone: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useState(1);
  const [beat, setBeat] = useState<Beat>("idle");
  const timers = useRef<number[]>([]);

  // ── Who is in the room ──
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const scanned = useScannedPortrait(career.player.portrait);
  const youFace = scanned ?? career.player.portrait ?? DEFAULT_FAKE_FACE;
  // Harry, 1 Oct 2026 (P49): "Let's stop with the real faces, unless it's your
  // guy ... that's not Keith Andrews." Only YOUR face is a photo; the manager
  // is a drawn head, the same man every time and a different one from the next
  // club's (P72, P90: lib/star/managerFace.ts, skin and hair loosely his own).
  const bossLook = managerLook(managerName);
  const tick = useFaceTicks([youFace]);
  // The paper must show the whole deal even when the caller sent none (P56:
  // "the only thing on the contract is shirt number 19").
  const c = career.contract;
  const t: ContractTerms = {
    wage: terms?.wage ?? c?.wage, seasons: terms?.seasons ?? c?.seasonsRemaining,
    goalBonus: terms?.goalBonus ?? c?.goalBonus, assistBonus: terms?.assistBonus ?? c?.assistBonus,
    appearanceFee: terms?.appearanceFee ?? c?.appearanceFee, loyaltyBonus: terms?.loyaltyBonus ?? c?.loyaltyBonus,
    position: terms?.position ?? career.player.position,
  };
  const number = terms?.squadNumber ?? career.squadNumber ?? null;
  const rows: [string, string][] = [
    ["Length", t.seasons ? `${t.seasons} season${t.seasons === 1 ? "" : "s"}` : ""],
    ["Wage", t.wage ? `${money(t.wage)} / wk` : ""],
    ["Shirt", number != null ? `#${number}` : ""],
    ["Position", t.position ?? ""],
    ["Goal bonus", t.goalBonus ? money(t.goalBonus) : ""],
    ["Assist bonus", t.assistBonus ? money(t.assistBonus) : ""],
    ["Appearance", t.appearanceFee ? money(t.appearanceFee) : ""],
    ["Loyalty", t.loyaltyBonus ? money(t.loyaltyBonus) : ""],
  ];
  const shown = rows.filter(([, v]) => v).slice(0, 8);

  // The stage scales to the column's width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / SW);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Paint: on a size change, when a face arrives, and once more for the handshake.
  const shake = beat === "shake" || beat === "done";
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const px = Math.max(1, k * dpr);
    canvas.width = Math.round(SW * px);
    canvas.height = Math.round(SH * px);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    const youFit = getFittedHead(youFace);
    paintOffice(ctx, {
      club: kit,
      shake,
      you: {
        shirt: kit.shirt, shorts: kit.trim, trim: kit.trim,
        skin: youFit?.skin ?? skinToneHex(career.player.skinTone),
        number, fitted: youFit,
      },
      boss: {
        shirt: "#1d2430", shorts: "#141922", trim: "#e9edf2",
        skin: bossLook.skin,
        number: null, fitted: null,
        drawHead: (c) => drawManagerHead(c, 101, HERO_CHIN_Y, HERO_FACE_H, bossLook),
      },
    });
  }, [k, tick, shake, kit.shirt, kit.trim, youFace, number, career.player.skinTone, managerName, kit, bossLook]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const start = () => {
    if (beat !== "idle") return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setBeat("done"); return; }
    setBeat("zoom");
    const at = (ms: number, b: Beat) => { timers.current.push(window.setTimeout(() => setBeat(b), ms)); };
    at(ZOOM_MS, "sign");
    at(ZOOM_MS + SIGN_MS, "shake");
    at(ZOOM_MS + SIGN_MS + OUT_MS + CHEER_MS, "done");
  };
  const onStage = () => { if (beat === "idle") start(); else if (beat === "done") onDone(); };

  // ── The camera: onto the signature line, then back out ──
  // Close enough that the contract fills the frame, the whole of it in view.
  const zoomK = 1.42;
  const focusX = PAPER.x + PAPER.w / 2, focusY = PAPER.y + PAPER.h / 2;
  const zoomed = beat === "zoom" || beat === "sign";
  const tx = Math.min(0, Math.max(SW - SW * zoomK, SW / 2 - focusX * zoomK));
  const ty = Math.min(0, Math.max(SH - SH * zoomK, SH / 2 - focusY * zoomK));
  const camera: React.CSSProperties = {
    transformOrigin: "0 0",
    transform: zoomed ? `translate(${tx}px, ${ty}px) scale(${zoomK})` : "none",
    transition: `transform ${zoomed ? ZOOM_MS : OUT_MS}ms cubic-bezier(.4,.1,.25,1)`,
  };
  const signed = beat === "sign" || beat === "shake" || beat === "done";


  return (
    <div className="min-h-screen bg-gray-950 px-4 pb-8 pt-4 text-white">
      <KitStyles />
      <style>{SCENE_CSS}</style>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-[13px] font-black uppercase tracking-[0.14em] text-amber-300">
            Signing for {club}
          </div>
          {/* Hidden, not removed, at the end: the row keeps its height. */}
          <button onClick={onDone} disabled={beat === "done"}
            className={`min-h-[36px] shrink-0 rounded-full bg-white/10 px-3 text-[12px] font-black uppercase tracking-wide text-white ${beat === "done" ? "invisible" : ""}`}>
            Skip
          </button>
        </div>

        <div ref={wrapRef} className="relative w-full overflow-hidden rounded-2xl" style={{ height: SH * k, boxShadow: "0 18px 40px -16px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.08)" }}>
          <div
            data-signing-scene
            role="button"
            aria-label={beat === "idle" ? "Tap to sign the contract" : beat === "done" ? "Continue" : "Signing"}
            onClick={onStage}
            className="absolute left-0 top-0 cursor-pointer select-none"
            style={{ width: SW, height: SH, transform: `scale(${k})`, transformOrigin: "0 0" }}
          >
            <div className="absolute inset-0" style={camera}>
              <canvas ref={canvasRef} style={{ width: SW, height: SH, display: "block" }} />

              {/* The crest on the wall. */}
              <div className="absolute transition-opacity duration-300" style={{ opacity: shake ? 0 : 1, left: SW / 2 - 30, top: 34, filter: "drop-shadow(0 0 14px rgba(255,220,160,.35)) drop-shadow(0 3px 4px rgba(0,0,0,.7))" }}>
                <ClubBadge club={club} kit={kit} size={60} />
              </div>

              {/* The manager's name plate on the desk. */}
              <div className="absolute rounded-[3px] px-1.5 py-[2px] text-center font-serif text-[8.5px] font-bold leading-tight"
                style={{ left: 300, top: DESK_Y + 6, width: 58, background: "linear-gradient(180deg,#e7c86f,#b8913d)", color: "#2a1c08", boxShadow: "0 2px 3px rgba(0,0,0,.5)" }}>
                <div className="truncate">{plateName(managerName)}</div>
                <div className="text-[6.5px] uppercase tracking-[0.12em] opacity-80">Manager</div>
              </div>

              {/* The contract, lying on the desk. */}
              <div className="absolute" style={{ left: PAPER.x, top: PAPER.y, width: PAPER.w, height: PAPER.h, perspective: 600 }}>
                <div className="relative h-full w-full rounded-[3px] px-3 pb-2 pt-2 font-serif text-[#1b140a]"
                  style={{
                    background: "linear-gradient(180deg,#fbf8f0,#efe9da)",
                    boxShadow: "0 10px 18px -6px rgba(0,0,0,.75), inset 0 0 0 1px rgba(160,120,40,.35)",
                    transform: "rotateX(12deg)", transformOrigin: "50% 100%",
                  }}>
                  <div className="text-center text-[7px] font-bold uppercase tracking-[0.3em] text-[#8a6a23]">Professional contract</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <ClubBadge club={club} kit={kit} size={20} />
                    <span className="truncate text-[17px] font-black leading-none">{club}</span>
                  </div>
                  {/* The whole deal: length, wage, shirt, position and every bonus. */}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    {shown.map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-1 border-b border-[#3b2f1c]/20 pb-px leading-none">
                        <span className="text-[7.5px] font-bold uppercase tracking-wide text-[#6b5630]">{label}</span>
                        <span className="truncate text-[11.5px] font-black tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Two signature lines: the club has signed; yours waits. */}
                  <div className="absolute inset-x-3" style={{ top: SIG.y - 2 }}>
                    <div className="relative" style={{ height: SIG.h + 6 }}>
                      <svg viewBox="0 0 300 60" className="absolute" style={{ left: 2, top: 2, width: 72, height: 20 }} aria-hidden>
                        <path d="M10 40 C 30 10, 50 50, 70 26 S 110 18, 130 36 S 170 44, 200 22 S 250 30, 290 26" fill="none" stroke="#1e3a8a" strokeWidth="5" strokeLinecap="round" />
                      </svg>
                      <svg viewBox="0 0 300 60" className="absolute" style={{ left: SIG.x - 12 - 2, top: 0, width: SIG.w + 4, height: SIG.h + 2 }} aria-hidden>
                        <path d={SIGNATURE_D} fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                          pathLength={1}
                          style={{
                            strokeDasharray: 1, strokeDashoffset: signed ? 0 : 1,
                            transition: beat === "sign" ? `stroke-dashoffset ${SIGN_MS - 100}ms cubic-bezier(.45,.1,.4,1)` : "none",
                          }} />
                      </svg>
                      {beat === "idle" && (
                        <div className="sign-pulse absolute text-[8px] font-black uppercase tracking-wide text-[#b45309]" style={{ left: SIG.x - 12, top: 6 }}>
                          ✕ sign here
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border-t border-[#3b2f1c]/70 pt-[1px] text-[6.5px] font-bold uppercase tracking-wide text-[#5b4a2c]">For {club}</div>
                      <div className="truncate border-t border-[#3b2f1c]/70 pt-[1px] text-[6.5px] font-bold uppercase tracking-wide text-[#5b4a2c]">{playerName}</div>
                    </div>
                  </div>

                  {/* The pen: it travels along your line while the name is written. */}
                  {(beat === "zoom" || beat === "sign") && (
                    <div className="pointer-events-none absolute"
                      style={{
                        left: 12 + SIG.x - 12 + (beat === "sign" ? SIG.w - 4 : -2),
                        top: SIG.y - 22,
                        transition: beat === "sign" ? `left ${SIGN_MS - 100}ms cubic-bezier(.45,.1,.4,1)` : "none",
                      }}>
                      <div className={beat === "sign" ? "pen-write" : ""}>
                        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden style={{ transform: "rotate(-38deg)", transformOrigin: "4px 36px", filter: "drop-shadow(1px 3px 2px rgba(0,0,0,.45))" }}>
                          <path d="M4 36 L8 27 L10 29 Z" fill="#1f2937" />
                          <rect x="8" y="2" width="6" height="27" rx="2.5" transform="rotate(20 11 15)" fill="#111827" />
                          <rect x="9.3" y="3" width="2" height="22" rx="1" transform="rotate(20 11 15)" fill="#d4af37" opacity=".85" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* The cheer. Outside the camera, so it is not zoomed. */}
            {(beat === "shake" || beat === "done") && (
              <>
                <Burst trigger={1} colors={[kit.shirt, kit.trim, "#fde047", "#ffffff"]} count={30} spread={1.3} className="left-1/2 top-[44%]" />
                <div className="welcome-in pointer-events-none absolute inset-x-0 top-[22px] text-center">
                  <div className="text-[20px] font-black uppercase leading-none tracking-tight text-amber-300"
                    style={{ textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 14px rgba(0,0,0,.8)" }}>
                    Welcome to
                  </div>
                  <div className="mt-1 text-[26px] font-black uppercase leading-none text-white"
                    style={{ textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 14px rgba(0,0,0,.8)" }}>
                    {club}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={beat === "done" ? onDone : start}
          disabled={beat !== "idle" && beat !== "done"}
          className="mt-4 min-h-[52px] w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-[15px] font-black uppercase tracking-widest text-amber-950 shadow-[0_6px_18px_-4px_rgba(251,191,36,0.6)] transition active:scale-[0.99] disabled:opacity-50"
        >
          {beat === "idle" ? "Tap to sign" : beat === "done" ? "Continue" : "Signing…"}
        </button>
      </div>
    </div>
  );
}

const SCENE_CSS = `
  @keyframes sign-pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  .sign-pulse { animation: sign-pulse 1.2s ease-in-out infinite; }
  @keyframes pen-write { 0%,100% { transform: translateY(0); } 25% { transform: translateY(-3px); } 50% { transform: translateY(2px); } 75% { transform: translateY(-2px); } }
  .pen-write { animation: pen-write .22s linear infinite; }
  @keyframes welcome-in { 0% { opacity: 0; transform: scale(.7); } 60% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
  .welcome-in { animation: welcome-in .45s cubic-bezier(.3,.7,.4,1) both; }
  @media (prefers-reduced-motion: reduce) { .sign-pulse, .pen-write, .welcome-in { animation: none !important; } }
`;
