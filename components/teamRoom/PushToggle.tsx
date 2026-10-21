"use client";
/**
 * components/teamRoom/PushToggle.tsx — "Turn on phone notifications", per
 * device (lib/teamRoom/push.ts). Top of the To-do and the Team chat.
 *
 * On: a buzz when someone @'s you, replies to you, points at something for
 * you or gives you a job. Shows this device's state: On / Off / blocked /
 * not supported / iPhone outside the Home Screen app / not switched on yet.
 */
import { sendTest, turnOffPush, turnOnPush, usePush } from "@/lib/teamRoom/push";

const Bell = ({ off }: { off?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

export default function PushToggle() {
  const v = usePush();
  const s = v.state;
  const line = (cls: string, text: string, off = true) => (
    <div className={`tr-push ${cls}`} data-push-state={s}><Bell off={off} /><span>{text}</span></div>
  );
  if (s === "checking") return line("muted", "Checking phone notifications…", false);
  if (s === "unsupported") return line("muted", "Phone notifications: not supported in this browser.");
  if (s === "notReady") return line("muted", "Phone notifications aren't switched on yet (one Vercel setting).");
  if (s === "signedOut") return line("muted", "Sign in to turn on phone notifications.");
  if (s === "iphone") return line("tip", "On iPhone: Share → Add to Home Screen, open KIB Admin from there, then turn this on.");
  if (s === "blocked") return line("tip", "Notifications are blocked for this site. Allow them in the phone's settings for KIB Admin (or the browser's site settings), then reload.");
  const on = s === "on";
  return (
    <div className={`tr-push${on ? " on" : ""}`} data-push-state={s}>
      <Bell off={!on} />
      <span className="tx">
        {on ? <b>Phone notifications: On</b> : <b>Phone notifications: Off</b>}
        <small>{v.error ?? v.note ?? (on ? "On for this device." : "A buzz when someone @'s you, replies to you or gives you a job.")}</small>
      </span>
      {on ? (
        <span className="acts">
          <button className="tr-btn ghost" onClick={() => sendTest()}>Send a test</button>
          <button className="tr-btn ghost" onClick={() => turnOffPush()}>Turn off</button>
        </span>
      ) : (
        <button className="tr-btn" onClick={() => turnOnPush()} disabled={s === "working"}>{s === "working" ? "…" : "Turn on phone notifications"}</button>
      )}
    </div>
  );
}
