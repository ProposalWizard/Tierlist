"use client";
/**
 * components/teamRoom/ChatBubble.tsx — the round chat button, bottom-left on
 * every admin and test page (Harry, 19 Oct 2026, look A). Tap: a box with
 * Chat | To-do (a sheet from the bottom on a phone). A red number = new chat
 * messages; an amber dot = a new job given to you.
 *
 * Mounted once by GlobalNav for admins only, portaled into <body> so it
 * survives full-screen pages. It never sits on a button: if the corner is
 * taken it steps up the screen until it is clear (like the admin tab).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import { useAdminLook } from "@/lib/adminLook";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { bubbleOn, newGivenTasks, unreadChat } from "@/lib/teamRoom/logic";
import { useTeamRoom } from "@/lib/teamRoom/store";
import { ChatThread, RoomGate, TodoList } from "./parts";
import "./teamRoom.css";

const ADMIN_URLS = ADMIN_PAGES.map((p) => p.url);
const OPEN_KEY = "kib-team-pop";
const SIZE = 50;
const TRY = [16, 80, 144, 208, 272];
// Never on a control, and never on words or pictures either (UI lookover, 19 Oct
// 2026: it covered titles, table rows and notes on eight admin pages).
const BUSY = "button, a, input, select, textarea, canvas, img, svg, video, h1, h2, h3, h4, p, label, li, td, th, .ash-side, [role='button'], [data-tour]";

export default function ChatBubble() {
  const path = usePathname() ?? "/";
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !bubbleOn(path, ADMIN_URLS)) return null;
  return createPortal(<Bubble path={path} />, document.body);
}

function Bubble({ path }: { path: string }) {
  const s = useTeamRoom();
  const look = useAdminLook();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "todo">("chat");
  const [bottom, setBottom] = useState(16);
  const [left, setLeft] = useState(16);
  const fab = useRef<HTMLButtonElement>(null);

  // Find a corner spot with nothing to tap underneath.
  const place = useCallback(() => {
    const el = fab.current;
    if (!el) return;
    const prev = el.style.visibility;
    el.style.visibility = "hidden";
    // The admin side menu fills the left edge on a computer: start just right of it.
    const side = document.querySelector(".ash-side")?.getBoundingClientRect();
    const xs = side && side.right > 0 && side.left >= 0 && side.width < window.innerWidth / 2 ? [side.right + 16, 16] : [16];
    // Then the right edge, above the page guide's eye (bottom-right).
    xs.push(window.innerWidth - SIZE - 16);
    // Nowhere free (a full-screen 3D page is all canvas): tuck half of it
    // behind the right edge, above the middle, clear of joysticks and bars.
    let spot = { x: window.innerWidth - SIZE / 2 - 2, b: Math.round(window.innerHeight * 0.55) };
    search: for (const lx of xs) {
      for (const b of (lx > window.innerWidth / 2 ? TRY.slice(1) : TRY)) {
        const cx = lx + SIZE / 2, cy = window.innerHeight - b - SIZE / 2;
        const hits = [-14, 0, 14].flatMap((d) => document.elementsFromPoint(cx + d, cy + d));
        if (!hits.some((h) => h.closest(BUSY) && !h.closest(".tr-vars"))) { spot = { x: lx, b }; break search; }
      }
    }
    el.style.visibility = prev;
    setLeft(spot.x);
    setBottom(spot.b);
  }, []);
  useEffect(() => {
    place();
    const t1 = setTimeout(place, 800);
    const t2 = setTimeout(place, 2500);
    window.addEventListener("resize", place);
    // The side menu folds and unfolds: look again when it does.
    const side = document.querySelector(".ash-side");
    const ro = side && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => place()) : null;
    if (side && ro) ro.observe(side);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", place); ro?.disconnect(); };
  }, [place, path]);

  useEffect(() => { try { const v = sessionStorage.getItem(OPEN_KEY); if (v === "chat" || v === "todo") { setOpen(true); setTab(v); } } catch { /* private */ } }, []);
  useEffect(() => { try { sessionStorage.setItem(OPEN_KEY, open ? tab : ""); } catch { /* private */ } }, [open, tab]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (s.pageOpen) return null;
  const unread = unreadChat(s.messages, s.me, s.read.chat);
  const jobs = newGivenTasks(s.tasks, s.me, s.read.tasks);
  const chatTitle = unread ? `Team chat — ${unread} new` : "Team chat";

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
            <Link className="tr-open" href={`${TEAM_ROOM.home}?tab=${tab}`} onClick={() => setOpen(false)} title="Open the full Team room">Open ↗</Link>
            <button className="tr-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="tr-pop-b">
            <RoomGate>{tab === "chat" ? <ChatThread visible autoFocus={false} /> : <TodoList visible />}</RoomGate>
          </div>
        </div>
      )}
      <button ref={fab} className="tr-fab" style={{ left, bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))` }}
        onClick={() => setOpen(!open)} aria-expanded={open} aria-label={chatTitle} title={chatTitle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" />
        </svg>
        {unread > 0 && <span className="tr-badge">{unread > 99 ? "99+" : unread}</span>}
        {unread === 0 && jobs > 0 && <span className="tr-badge amber dot" />}
      </button>
    </div>
  );
}
