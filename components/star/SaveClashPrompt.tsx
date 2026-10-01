"use client";

/**
 * TWO DIFFERENT SAVES — WHICH ONE DO YOU WANT TO KEEP?
 *
 * Harry, 30 Sep 2026. Shown instead of the game when this device's copy of a
 * save and the cloud's copy have both moved on without each other — the
 * phone played offline while the PC played online, say. Until now the later
 * write simply won and the other session vanished without a word. The rule
 * that decides "diverged" versus "just older" is lib/star/saveClash.ts.
 *
 * Two cards: where each copy came from, how far it has got, and when it was
 * last played. The one not picked goes to a free save slot. With no free
 * slot, the prompt says so up front and a pick asks once more before the
 * other is let go — never silently.
 */
import { useState } from "react";
import type { SaveClash } from "@/lib/star/storage";
import { summariseSave, timeAgo, deviceName } from "@/lib/star/saveClash";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import ClubBadge from "./ClubBadge";
import { PressButton, rgba, clubTheme } from "./ui";
import { Screen, Kicker } from "./ui/Screen";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

type Side = "local" | "cloud";

export default function SaveClashPrompt({ clash, onKeep, onLater }: {
  clash: SaveClash;
  onKeep: (keep: Side) => void;
  /** No free slot: play this device's copy without uploading it, ask again next time. */
  onLater: () => void;
}) {
  const [confirm, setConfirm] = useState<Side | null>(null);
  const now = Date.now();
  const glow = clubTheme(clash.local.career.player.club || clash.cloud.career.player.club).glow;
  const spare = clash.spareSlot;

  const pick = (side: Side) => {
    if (spare !== null) onKeep(side);
    else setConfirm(side);
  };

  const card = (side: Side) => {
    const copy = side === "local" ? clash.local : clash.cloud;
    const s = summariseSave(copy.career);
    const theme = clubTheme(s.club ?? "", copy.career);
    const where = side === "local" ? "This device" : "Another device";
    const what = side === "cloud" && clash.cloud.device ? `Saved from a ${deviceName(clash.cloud.device)}` : side === "local" ? "Saved here" : "Saved in the cloud";
    const chosen = confirm === side;
    return (
      <div
        key={side}
        data-testid={`clash-card-${side}`}
        className="rounded-2xl p-3"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, ${rgba(theme.glow, 0.26)} 0%, transparent 55%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96)))`,
          boxShadow: chosen
            ? `inset 0 0 0 2px ${rgba(theme.glow, 0.95)}, 0 0 18px -6px ${rgba(theme.glow, 0.9)}`
            : `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(theme.glow, 0.25)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">{where}</span>
          <span className="shrink-0 text-[10.5px] font-bold text-white/70">{timeAgo(copy.savedAt, now)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          {s.club ? <ClubBadge club={s.club} size={34} /> : <div className="h-[34px] w-[34px] shrink-0 rounded-full bg-white/10" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-black text-white">{s.playerName}</div>
            <div className="truncate text-[12px] font-bold text-white/85">{s.club ? short(s.club) : "No club yet"}</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Season" value={String(s.season)} />
          <Stat label="Week" value={String(s.week)} />
          <Stat label="Played" value={String(s.matchesPlayed)} />
        </div>
        <div className="mt-2 text-[10.5px] font-bold text-white/60">{what}</div>
        <PressButton
          variant={chosen ? "danger" : "primary"}
          size="none"
          data-testid={`clash-keep-${side}`}
          onClick={() => (chosen ? onKeep(side) : pick(side))}
          className="mt-2.5 w-full rounded-xl py-2.5 text-[13px] font-black uppercase tracking-wide"
        >
          {chosen ? "Keep this · delete the other" : "Keep this one"}
        </PressButton>
      </div>
    );
  };

  return (
    <Screen glow={glow} className="max-w-sm px-4 pb-6 pt-5">
      <div data-testid="save-clash-prompt" className="w-full">
        <Kicker color="#fcd34d">Save clash</Kicker>
        <div className="mt-2 text-[22px] font-black leading-tight text-white">Which progress do you want to keep?</div>
        <p className="mt-1 text-[13px] font-bold leading-snug text-white/85">
          This career was played on two devices without syncing, so there are two different saves.
        </p>
        <div
          className="mt-2.5 rounded-xl px-3 py-2 text-[12px] font-bold leading-snug"
          style={spare !== null
            ? { background: "rgba(16,185,129,.14)", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.4)", color: "#d1fae5" }
            : { background: "rgba(245,158,11,.16)", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)", color: "#fef3c7" }}
        >
          {spare !== null
            ? <>The other one won&apos;t be lost — it moves to <b>Save {spare}</b>.</>
            : <>All save slots are full, so the one you don&apos;t keep will be <b>deleted</b>. To keep both, tap <b>Decide later</b>, free a slot in Settings → Saves, then open the game again.</>}
        </div>

        <div className="mt-3 space-y-2.5">
          {card("local")}
          {card("cloud")}
        </div>

        {confirm && (
          <PressButton
            variant="secondary"
            size="none"
            data-testid="clash-cancel"
            onClick={() => setConfirm(null)}
            className="mt-3 w-full rounded-xl py-2.5 text-[13px] font-black uppercase tracking-wide text-white"
          >
            Cancel
          </PressButton>
        )}
        {spare === null && !confirm && (
          <PressButton
            variant="secondary"
            size="none"
            data-testid="clash-later"
            onClick={onLater}
            className="mt-3 w-full rounded-xl py-2.5 text-[12px] font-black uppercase tracking-wide text-white"
          >
            Decide later
          </PressButton>
        )}
        {spare === null && !confirm && (
          <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-white/65">
            Plays this device&apos;s save without uploading it. Both copies stay as they are, and you&apos;ll be asked again.
          </p>
        )}
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg py-1.5" style={{ background: "rgba(3,7,18,.55)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
      <div className="text-[16px] font-black tabular-nums text-white">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/60">{label}</div>
    </div>
  );
}
