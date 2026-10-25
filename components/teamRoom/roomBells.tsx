"use client";
/**
 * components/teamRoom/roomBells.tsx — the 🔔 in each channel's top bar (plan
 * U12, A6): Every new message / Only @mentions / Off (+ Only when red in
 * #health), Mute for 1 hour, and "Pop-ups on this computer". A channel set to
 * Off shows 🔕 in the list. Your choices follow you to every device (kept in
 * your account, lib/teamRoom/bells.ts); the pop-up switch is per computer.
 *
 * Computer pop-ups (like WhatsApp): while the admin is open in a tab, a new
 * message your bell asks for shows as a system pop-up when the tab is hidden
 * or you are in another channel (lib/teamRoom/popups.ts). With the tab
 * closed, the phone/computer push does it (the same buzz as the phone).
 */
import { useEffect, useState } from "react";
import { BELL_WORD, RED_CHANNELS, bellFor, mutedNow, type Bell } from "@/lib/teamRoom/bells";
import { muteChannel, setBell, useTeamRoom } from "@/lib/teamRoom/store";
import { popupState, requestPopups, setPopupsOn, usePopupState } from "@/lib/teamRoom/popups";
import type { Channel } from "@/lib/teamRoom/channels";

export function BellMenu({ channel }: { channel: Channel }) {
  const s = useTeamRoom();
  const pop = usePopupState();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (open) setNow(Date.now()); }, [open]);
  useEffect(() => { setOpen(false); }, [channel.slug]);
  const bell = bellFor(s.bells, channel.slug);
  const muted = mutedNow(s.bells, channel.slug, now);
  const choices: Bell[] = (RED_CHANNELS as readonly string[]).includes(channel.slug) ? ["all", "red", "mentions", "off"] : ["all", "mentions", "off"];
  const pick = async (b: Bell) => { const r = await setBell(channel.slug, b); setErr(r.ok ? null : r.error); };
  const quiet = bell === "off" || muted;
  return (
    <span className="trr-pop-anchor">
      <button className={`trr-iconbtn${quiet ? " quiet" : ""}`} aria-expanded={open} aria-label={`Buzzes for #${channel.name}: ${muted ? "muted" : BELL_WORD[bell]}`}
        title={`Buzz me for #${channel.name}: ${muted ? "muted" : BELL_WORD[bell]}`} onClick={() => setOpen(!open)}>
        <BellIcon off={quiet} />
      </button>
      {open && (<>
        <div className="trr-menu-scrim" onClick={() => setOpen(false)} />
        <div className="trr-menu trr-bellmenu" role="menu" aria-label={`Buzz me for #${channel.name}`}>
          <p className="lbl">Buzz me for #{channel.name}</p>
          {choices.map((b) => (
            <button key={b} role="menuitemradio" aria-checked={bell === b} onClick={() => pick(b)}>
              <span className="tick">{bell === b ? "✓" : ""}</span>{BELL_WORD[b]}{b === "off" && <small>still goes bold</small>}
            </button>
          ))}
          <div className="sep" />
          <p className="lbl">Also</p>
          <button role="menuitemcheckbox" aria-checked={muted} onClick={async () => { const r = await muteChannel(channel.slug, muted ? null : 3600_000); setErr(r.ok ? null : r.error); setNow(Date.now()); }}>
            <span className="tick">{muted ? "✓" : ""}</span>{muted ? `Muted until ${new Date(s.bells.mute[channel.slug]).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · unmute` : "Mute for 1 hour"}
          </button>
          <button role="menuitemcheckbox" aria-checked={pop === "on"} disabled={pop === "unsupported" || pop === "blocked"}
            onClick={async () => { if (pop === "on") setPopupsOn(false); else await requestPopups(); }}
            title={pop === "blocked" ? "Pop-ups are blocked for this site in the browser's settings" : "A pop-up on this computer when a message comes in, by the choice above"}>
            <span className="tick">{pop === "on" ? "✓" : ""}</span>Pop-ups on this computer
            {pop === "blocked" && <small>blocked in the browser</small>}{pop === "unsupported" && <small>not in this browser</small>}
          </button>
          <small className="trr-menu-note">Your choice follows you to every device. DMs and @mentions always buzz unless a channel is Off or muted.</small>
          {err && <span className="tr-err">{err}</span>}
        </div>
      </>)}
    </span>
  );
}

/** For the list: 🔕 after a channel that is Off or muted. */
export function useQuiet(slug: string) {
  const s = useTeamRoom();
  return bellFor(s.bells, slug) === "off" || mutedNow(s.bells, slug, Date.now());
}

export { popupState };

export const BellIcon = ({ off }: { off?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" />{off && <path d="M4 4l16 16" />}
  </svg>
);
