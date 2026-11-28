"use client";
import { useCallback, useEffect, useState } from "react";
import {
  allowReplaceOnline, backupCareer, fetchOnlineSlots, loadCareerFromCloud, slotScope, wantsReplaceOnline,
  type OnlineSlotsAnswer, type SaveSlotSummary,
} from "@/lib/star/storage";
import { mergeSaveCards, startCareerAllowed, type OnlineCheck, type OnlineSlot, type SaveCard } from "@/lib/star/onlineSlots";
import { timeAgo } from "@/lib/star/saveClash";
import { PACKED_APP } from "@/lib/app/packed";
import { PressButton, rgba } from "./ui";
import { SetCard, SetHead, SetNote } from "./settingsKit";

/**
 * SAVES — switch between careers, or start a fresh one, without losing any
 * of them.
 *
 * Every slot is always shown, empty or not — nothing to scroll, nothing
 * hidden. The active slot is the one actually on screen right now; picking
 * a different occupied slot switches to it (loadCareerIntoState,
 * app/star-dev/page.tsx, reconciles it against the cloud the same way the
 * very first load of the game always has); picking an empty slot starts a
 * brand new career there, exactly like the very first time this game was
 * ever played, and leaves every other slot untouched.
 *
 * Reskinned 28 Sep 2026 to the home screen's look: a club-lit card, the
 * save you are playing lit in your colour, kit buttons. The club, season
 * and star rating now wrap onto their own line instead of being cut off.
 *
 * Online slots (28 Nov 2026, Harry: his phone showed 1 of his 3 saves). The
 * list also asks the server which slots hold a career (fetchOnlineSlots,
 * merged by lib/star/onlineSlots.ts). A slot made on another device is a
 * real card, "On another device · Open"; Open downloads it through the
 * usual switch (onSwitch → loadCareerIntoState). "Start career" is only
 * offered where the slot is empty here AND online. If the check fails the
 * list says so, and never calls a slot the server has "Empty".
 */

interface Props {
  saves: SaveSlotSummary[];
  activeSlot: number;
  onSwitch: (slot: number) => void;
  onStartNew: (slot: number) => void;
  onDelete: (slot: number) => void;
  /** Your club's colour, to light the card and the save you're playing. */
  glow?: string;
  /** Whose saves (the account scope). Needed for "Replace online copy". */
  accountScope?: string;
  /** For a test page: answer the online check without a server. */
  fetchOnline?: () => Promise<OnlineSlotsAnswer>;
  /** For a test page: show the iPhone note whatever the device. */
  forceIosNote?: boolean;
}

function isAppleTouch(): boolean {
  try {
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  } catch { return false; }
}

function deviceWords(o: OnlineSlot): string {
  return o.device === "phone" ? "from your phone" : o.device === "tablet" ? "from your tablet" : o.device === "computer" ? "from your computer" : "";
}

function headline(o: OnlineSlot): string {
  if (!o.signed) return o.season ? `Season ${o.season}, no club yet` : "No club yet";
  return `Season ${o.season ?? 1}, ${o.club}`;
}

export default function SaveSlotsPanel({ saves, activeSlot, onSwitch, onStartNew, onDelete, glow = "#10b981", accountScope, fetchOnline, forceIosNote }: Props) {
  // Two taps to delete, on the screen — no browser box, which exits full screen.
  const [armed, setArmed] = useState<number | null>(null);
  const [armedReplace, setArmedReplace] = useState<number | null>(null);
  const [warned, setWarned] = useState<number | null>(null);
  const [check, setCheck] = useState<OnlineCheck>(PACKED_APP ? "device-only" : "checking");
  const [online, setOnline] = useState<OnlineSlot[] | null>(null);
  const [replacing, setReplacing] = useState<Set<number>>(() => new Set());
  const [iosNote, setIosNote] = useState(!!forceIosNote);
  const [now, setNow] = useState(0);

  const refresh = useCallback(() => {
    if (PACKED_APP) return;
    setCheck("checking");
    void (fetchOnline ?? fetchOnlineSlots)().then((a) => {
      setNow(Date.now());
      if (a.check === "ok") { setOnline(a.slots); setCheck("ok"); }
      else { setOnline(null); setCheck(a.check); }
    });
  }, [fetchOnline]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!forceIosNote && !PACKED_APP) setIosNote(isAppleTouch()); }, [forceIosNote]);
  useEffect(() => {
    if (!accountScope) return;
    setReplacing(new Set(saves.filter((s) => wantsReplaceOnline(slotScope(accountScope, s.slot))).map((s) => s.slot)));
  }, [accountScope, saves]);

  const cards: SaveCard<SaveSlotSummary>[] = mergeSaveCards(saves, online, check);

  return (
    <SetCard tone={glow}>
      <SetHead>Saves</SetHead>
      <SetNote>
        Keep up to {saves.length} careers going and switch between them, or start a brand new one without losing the others.
      </SetNote>
      {check === "device-only" && (
        <SetNote className="mt-1.5"><span data-saves-note="device-only" className="font-black">Saves on this device only.</span></SetNote>
      )}
      {check === "failed" && (
        <div data-saves-note="failed" className="mt-1.5 flex items-center gap-2 rounded-lg bg-amber-500/15 px-2 py-1.5" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }}>
          <p className="flex-1 text-[11px] font-black leading-snug text-amber-100">Couldn&apos;t check your other devices.</p>
          <PressButton variant="secondary" size="none" onClick={refresh} className="rounded-lg px-2 py-1 text-[10px] font-black">Try again</PressButton>
        </div>
      )}
      {check === "ok" && (
        <SetNote className="mt-1.5" dim>
          <span data-saves-note="account">Your saves live with your account, so every device you sign in on sees the same ones{iosNote ? " — the Home Screen app and Safari too" : ""}.</span>
        </SetNote>
      )}
      {iosNote && check === "device-only" && (
        <SetNote className="mt-1.5" dim>
          Playing from the Home Screen and from Safari keeps separate saves on this phone — sign in to see them all.
        </SetNote>
      )}

      <div className="mt-2 space-y-1.5">
        {cards.map((card) => {
          const save = card.local ?? { slot: card.slot, empty: true };
          const isActive = card.slot === activeSlot;
          const o = card.online;
          const onlineOnly = card.kind === "online";
          return (
            <div
              key={card.slot}
              data-save-card={card.kind}
              className="rounded-xl p-2"
              style={isActive
                ? { background: `linear-gradient(90deg, ${rgba(glow, 0.32)}, ${rgba(glow, 0.1)})`, boxShadow: `inset 0 0 0 1px ${rgba(glow, 0.7)}, inset 0 1px 0 rgba(255,255,255,.12), 0 0 16px -6px ${rgba(glow, 0.9)}` }
                : onlineOnly
                  ? { background: "linear-gradient(180deg, rgba(56,189,248,.14), rgba(56,189,248,.04))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 0 1px rgba(56,189,248,.4)" }
                  : { background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 0 1px rgba(255,255,255,.06)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-black tabular-nums"
                  style={isActive
                    ? { background: `linear-gradient(180deg, ${rgba(glow, 0.95)}, ${rgba(glow, 0.6)})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }
                    : { background: "rgba(3,7,18,.6)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)" }}
                >
                  {card.slot}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Save {card.slot}</span>
                    {isActive && (
                      <span className="rounded-full bg-emerald-400/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200" style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,.45)" }}>
                        Playing
                      </span>
                    )}
                    {onlineOnly && (
                      <span className="rounded-full bg-sky-400/25 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-sky-100" style={{ boxShadow: "inset 0 0 0 1px rgba(56,189,248,.5)" }}>
                        On another device
                      </span>
                    )}
                    {(save.retired || (onlineOnly && o?.retired)) && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-200">
                        Retired
                      </span>
                    )}
                  </div>
                  {onlineOnly && o ? (
                    <>
                      <div className="mt-0.5 truncate text-[12px] font-black text-white">{o.playerName}</div>
                      <div className="text-[10.5px] font-bold leading-snug text-white">
                        {headline(o)} · updated {timeAgo(o.updatedAt, now || Date.now())}{deviceWords(o) ? ` ${deviceWords(o)}` : ""}
                      </div>
                    </>
                  ) : card.kind === "unknown" ? (
                    <div className="mt-0.5 text-[11px] text-white">
                      Not on this device{check === "checking" ? " · checking online…" : " · not checked online"}
                    </div>
                  ) : save.empty ? (
                    <div className="mt-0.5 text-[11px] text-white">Empty</div>
                  ) : (
                    <>
                      <div className="mt-0.5 truncate text-[12px] font-black text-white">{save.playerName}</div>
                      <div className="text-[10.5px] font-bold leading-snug text-white">
                        {/* A save with no club is a trial in progress — a real
                            career nobody has signed yet (see hasClub,
                            calendar.ts). Naming it rather than printing an
                            empty club keeps it from reading as a broken or
                            spare slot to start over on. */}
                        {save.signed
                          ? <>{save.club} · Season {save.season} · <span className="text-yellow-200">★{save.starRating}</span></>
                          : <>No club yet · <span className="text-yellow-200">★{save.starRating}</span></>}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-1 min-[380px]:flex-row min-[380px]:items-center">
                  {onlineOnly ? (
                    <>
                      <PressButton data-save-open variant="primary" size="none" onClick={() => onSwitch(card.slot)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-black">
                        Open
                      </PressButton>
                      <PressButton
                        data-save-start-blocked
                        size="none"
                        onClick={() => setWarned(warned === card.slot ? null : card.slot)}
                        className="rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white/70"
                        style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
                      >
                        Start career
                      </PressButton>
                    </>
                  ) : save.empty ? (
                    <PressButton
                      variant="primary"
                      size="none"
                      disabled={card.kind === "unknown" && check === "checking"}
                      onClick={() => {
                        const can = startCareerAllowed(card);
                        if (can.ok) onStartNew(card.slot); else setWarned(card.slot);
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-[10px] font-black"
                    >
                      Start career
                    </PressButton>
                  ) : (
                    <>
                      {!isActive && (
                        <PressButton variant="secondary" size="none" onClick={() => onSwitch(card.slot)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-black">
                          Switch
                        </PressButton>
                      )}
                      <PressButton
                        size="none"
                        onClick={() => { if (armed === card.slot) { setArmed(null); onDelete(card.slot); setTimeout(refresh, 1500); } else setArmed(card.slot); }}
                        className="rounded-lg px-2.5 py-1.5 text-[10px] font-black text-red-100"
                        style={{ background: "linear-gradient(180deg, rgba(248,113,113,.28), rgba(220,38,38,.14))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(248,113,113,.55)" }}
                      >
                        {armed === card.slot ? "Sure? Tap again" : isActive ? "Delete & start over" : "Delete"}
                      </PressButton>
                    </>
                  )}
                </div>
              </div>

              {warned === card.slot && (
                <p data-save-warning role="alert" className="mt-1.5 rounded-lg bg-amber-500/20 px-2 py-1.5 text-[11px] font-black leading-snug text-amber-100" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)" }}>
                  {startCareerAllowed(card).why}
                </p>
              )}

              {card.kind === "here" && card.onlineDiffers && o && (
                <div data-save-differs className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/15 px-2 py-1.5" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.4)" }}>
                  <p className="min-w-0 flex-1 text-[10.5px] font-bold leading-snug text-amber-100">
                    {replacing.has(card.slot)
                      ? "This career will replace the online copy at the next save."
                      : `Online, this slot holds a different career: ${o.playerName}, ${headline(o)}${deviceWords(o) ? `, ${deviceWords(o)}` : ""}. It is kept until you choose.`}
                  </p>
                  {accountScope && !replacing.has(card.slot) && (
                    <PressButton
                      size="none"
                      onClick={() => {
                        if (armedReplace !== card.slot) { setArmedReplace(card.slot); return; }
                        setArmedReplace(null);
                        // The online career is backed up on this device
                        // first (30 days). No backup, no replace.
                        void loadCareerFromCloud(card.slot).then((c) => {
                          if (!c || !backupCareer(accountScope, card.slot, c.career, "replaced online from Saves")) return;
                          allowReplaceOnline(slotScope(accountScope, card.slot));
                          setReplacing((r) => new Set(r).add(card.slot));
                        });
                      }}
                      className="rounded-lg px-2 py-1 text-[10px] font-black text-red-100"
                      style={{ background: "rgba(220,38,38,.18)", boxShadow: "inset 0 0 0 1px rgba(248,113,113,.55)" }}
                    >
                      {armedReplace === card.slot ? `Sure? ${o.playerName} goes` : "Replace online copy"}
                    </PressButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SetCard>
  );
}
