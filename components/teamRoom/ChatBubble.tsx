"use client";
/**
 * components/teamRoom/ChatBubble.tsx — the round chat button, bottom-left on
 * every admin and test page (Harry, 19 Oct 2026, look A). Tap: a box with
 * Chat | To-do (a sheet from the bottom on a phone). A red number = new chat
 * messages; an amber dot = a new job given to you.
 *
 * Mounted once by GlobalNav for admins only, portaled into <body> so it
 * survives full-screen pages.
 *
 * Where it sits (Harry, 20 Oct 2026: "fixed at bottom left on every page …
 * as long as, if it is covering something, I can still press it"): always
 * bottom left (just right of the admin side menu on a computer), small, and
 * only the round button itself takes taps, so anything it does not cover is
 * pressable. While you scroll or drag it fades to 40% and lets every tap
 * through, so what is under it shows and can be pressed. Over a control it
 * stays half see-through so you can see what is beneath. (It used to hop up
 * the screen to dodge things; that is gone.)
 *
 * A PAGE'S OWN BOTTOM CONTROLS (B13, 20 Oct 2026). A page can mark a control
 * near the bottom-left with `data-bubble-clear` (BUBBLE_CLEAR); the bubble
 * then sits just above it instead of on it. Only marked controls move it, so
 * it never wanders. First used for "Next line ›" in the Manager's Office and
 * the dialogue bar in the 3D signing, which it covered on a phone.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import { useAdminLook } from "@/lib/adminLook";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { BUBBLE_CLEAR, BUBBLE_EDGE as EDGE, BUBBLE_SIZE as SIZE, bubbleBottom, bubbleOn, newGivenTasks, unreadChat } from "@/lib/teamRoom/logic";
import { newPushedJobs } from "@/lib/teamRoom/jobs";
import { waitingOnMe } from "@/lib/teamRoom/extras";
import { startPointing, useTeamRoom } from "@/lib/teamRoom/store";
import { ChatThread, RoomGate, TodoList } from "./parts";
import PointLayer from "./PointLayer";
import "./teamRoom.css";

const ADMIN_URLS = ADMIN_PAGES.map((p) => p.url);
const OPEN_KEY = "kib-team-pop";
/** How long it stays faded after the last scroll or drag. */
const QUIET_MS = 700;
const CONTROL = "button, a, input, select, textarea, label, [role='button'], [role='slider'], [role='tab']";

export default function ChatBubble() {
  const path = usePathname() ?? "/";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !bubbleOn(path, ADMIN_URLS)) return null;
  // The point layer (Shift+X, and showing a point someone sent) stays on even
  // while the full chat page hides the bubble.
  return createPortal(<><Bubble path={path} /><PointLayer path={path} /></>, document.body);
}

function Bubble({ path }: { path: string }) {
  const s = useTeamRoom();
  const look = useAdminLook();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "todo">("chat");
  const [bottom, setBottom] = useState(EDGE);
  const [left, setLeft] = useState(EDGE);
  const [quiet, setQuiet] = useState(false);
  const [over, setOver] = useState(false);
  const fab = useRef<HTMLButtonElement>(null);

  // Always the bottom-left corner. On a computer the admin side menu fills the
  // left edge, so it sits just right of the menu (not on "Back to Knowitball").
  // Above a control the page marked with data-bubble-clear (BUBBLE_CLEAR).
  const place = useCallback(() => {
    const side = document.querySelector(".ash-side")?.getBoundingClientRect();
    const onScreen = side && side.width > 0 && side.left >= 0 && side.right > 0 && side.width < window.innerWidth / 2;
    const x = onScreen ? Math.round(side.right + EDGE) : EDGE;
    setLeft(x);
    const marked = Array.from(document.querySelectorAll(`[${BUBBLE_CLEAR}]`))
      .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    setBottom(bubbleBottom(x, window.innerHeight, marked));
  }, []);
  // A marked control can appear or move after load (a 3D stage loading in).
  useEffect(() => { const id = setInterval(place, 1000); return () => clearInterval(id); }, [place]);
  useEffect(() => {
    place();
    const t = setTimeout(place, 800);
    window.addEventListener("resize", place);
    const side = document.querySelector(".ash-side");
    const ro = side && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => place()) : null;
    if (side && ro) ro.observe(side);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); ro?.disconnect(); };
  }, [place, path]);

  // Scrolling or dragging: fade to 40% and let taps through for a moment.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    let down = false;
    const hush = () => { setQuiet(true); if (t) clearTimeout(t); t = setTimeout(() => setQuiet(false), QUIET_MS); };
    const onDown = (e: PointerEvent) => { down = !(e.target as Element | null)?.closest?.(".tr-fab"); };
    const onMove = () => { if (down) hush(); };
    const onUp = () => { down = false; };
    window.addEventListener("scroll", hush, { passive: true, capture: true });
    window.addEventListener("wheel", hush, { passive: true });
    window.addEventListener("touchmove", hush, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("scroll", hush, { capture: true });
      window.removeEventListener("wheel", hush);
      window.removeEventListener("touchmove", hush);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Sitting over a button or link: half see-through, so you can see it is there.
  useEffect(() => {
    const look = () => {
      const el = fab.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.bottom - 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6]];
      setOver(pts.some(([x, y]) => document.elementsFromPoint(x, y).some((h) => !h.closest(".tr-vars") && h.closest(CONTROL))));
    };
    look();
    const id = setInterval(look, 1000);
    return () => clearInterval(id);
  }, [path, left, bottom]);

  useEffect(() => { try { const v = sessionStorage.getItem(OPEN_KEY); if (v === "chat" || v === "todo") { setOpen(true); setTab(v); } } catch { /* private */ } }, []);
  useEffect(() => { try { sessionStorage.setItem(OPEN_KEY, open ? tab : ""); } catch { /* private */ } }, [open, tab]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  // Opening a point from the chat: get the box out of the way of the page.
  useEffect(() => {
    const h = () => { if (window.location.hash.includes("kib-point=")) setOpen(false); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  useEffect(() => { if (s.pointing) setOpen(false); }, [s.pointing]);

  if (s.pageOpen || s.pointing) return null;
  const unread = unreadChat(s.messages, s.me, s.read.chat);
  const jobs = newGivenTasks(s.tasks, s.me, s.read.tasks) + newPushedJobs(s.jobs, s.tasks, s.me, s.seenJobs);
  const waiting = waitingOnMe(s.messages, s.me, s.marks, s.acks).length;
  const chatTitle = [unread ? `${unread} new` : "", waiting ? `${waiting} waiting on you` : ""].filter(Boolean).join(", ");

  return (
    <div className="tr-vars tr" data-look={look}>
      {open && <div className="tr-scrim" onClick={() => setOpen(false)} />}
      {open && (
        <div className="tr-pop" style={{ bottom: Math.min(bottom + SIZE + 10, Math.max(8, window.innerHeight - 590)), left: Math.max(8, Math.min(left, window.innerWidth - 392)) }} role="dialog" aria-label="Team room">
          <div className="tr-pop-h">
            <span className={`tr-live${s.live ? " on" : ""}`} title={s.live ? "Live" : "Not live — checking once a minute"} />
            <div className="tr-seg" role="group" aria-label="Team room part">
              <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>Chat{unread > 0 && tab !== "chat" && <span className="tr-badge">{unread}</span>}</button>
              <button aria-pressed={tab === "todo"} onClick={() => setTab("todo")}>To-do{jobs > 0 && tab !== "todo" && <span className="tr-badge amber dot" />}</button>
            </div>
            <button className="tr-open tr-pointbtn" onClick={() => startPointing()} disabled={!s.me} title="Point at part of this page (Shift+X on a computer)">👉 Point</button>
            <Link className="tr-open" href={`${TEAM_ROOM.home}?tab=${tab}`} onClick={() => setOpen(false)} title="Open the full Team room">Open ↗</Link>
            <button className="tr-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="tr-pop-b">
            <RoomGate>{tab === "chat" ? <ChatThread visible autoFocus={false} /> : <TodoList visible />}</RoomGate>
          </div>
        </div>
      )}
      <button ref={fab} className="tr-fab" data-quiet={quiet && !open ? "true" : undefined} data-over={over && !open ? "true" : undefined}
        style={{ left, bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))` }}
        onClick={() => setOpen(!open)} aria-expanded={open} aria-label={chatTitle ? `Team chat — ${chatTitle}` : "Team chat"} title={chatTitle ? `Team chat — ${chatTitle}` : "Team chat (Shift+X points at part of the page)"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" />
        </svg>
        {unread > 0 && <span className="tr-badge">{unread > 99 ? "99+" : unread}</span>}
        {waiting > 0 && <span className="tr-badge at" title={`${waiting} waiting on you`}>@</span>}
        {unread === 0 && waiting === 0 && jobs > 0 && <span className="tr-badge amber dot" />}
      </button>
    </div>
  );
}
