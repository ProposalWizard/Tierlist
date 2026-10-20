"use client";
/**
 * components/teamRoom/PointLayer.tsx — "point someone at part of a page"
 * (Harry, 20 Oct 2026: "shift + x means i CAN highlight part of a page and it
 * @'s them to look at it and they see my note").
 *
 * Drawing: Shift+X on a computer, or 👉 Point in the chat on a phone. Drag a
 * box, write a note, pick who. It posts a chat message with a page card.
 *
 * Seeing: the card's link carries the box after #kib-point=… (see
 * lib/teamRoom/extras.ts). Whoever opens it gets the page scrolled to the
 * box, outlined, with the note beside it, until they press Got it (saved in
 * team_acks; this device only until team_room_v2.sql runs).
 *
 * Where the box sits: the nearest element that holds it (a CSS path) plus the
 * box as fractions of that element, so it follows the page if the window is a
 * different size. If that element is gone, the page scroll and window size it
 * was drawn at, scaled to this window, and the note says it is roughly there.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_PEOPLE, type TeamPerson } from "@/lib/teamRoom/config";
import { ackedBy, decodePoint, pointUrl, POINT_KEY, type PointBox } from "@/lib/teamRoom/extras";
import { sendText, setAck, startPointing, stopPointing, teamRoomState, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, nameOfPage } from "./bits";

type Rect = { x: number; y: number; w: number; h: number };
const MIN = 14;

const editable = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

export default function PointLayer({ path }: { path: string }) {
  const s = useTeamRoom();
  const [shown, setShown] = useState<PointBox | null>(null);

  // Shift+X: point mode (never while typing — that is a capital X).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== "x") return;
      if (editable(document.activeElement)) return;
      if (!teamRoomState().me) return;
      e.preventDefault();
      startPointing();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // Opened with a point in the link: show it.
  useEffect(() => {
    const read = () => setShown(decodePoint(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [path]);

  return (
    <>
      {s.pointing && s.me && <Draw me={s.me} />}
      {shown && <Show p={shown} onClose={() => {
        setShown(null);
        try { if (window.location.hash.includes(POINT_KEY)) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch { /* old browser */ }
      }} />}
    </>
  );
}

// ── Drawing ───────────────────────────────────────────────────────────────
function Draw({ me }: { me: TeamPerson }) {
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Rect | null>(null);
  const [phase, setPhase] = useState<"draw" | "note">("draw");
  const [note, setNote] = useState("");
  const [to, setTo] = useState<TeamPerson[]>(TEAM_PEOPLE.filter((p) => p !== me));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") stopPointing(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const down = (e: React.PointerEvent) => {
    if (phase !== "draw" || (e.target as HTMLElement).closest(".tr-pt-bar")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setBox({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };
  const move = (e: React.PointerEvent) => {
    const s0 = start.current;
    if (!s0) return;
    setBox({ x: Math.min(s0.x, e.clientX), y: Math.min(s0.y, e.clientY), w: Math.abs(e.clientX - s0.x), h: Math.abs(e.clientY - s0.y) });
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    setBox((b) => {
      if (b && b.w >= MIN && b.h >= MIN) { setPhase("note"); return b; }
      return null;
    });
  };

  const send = async () => {
    if (!box || busy) return;
    if (to.length === 0) { setErr("Pick who should look."); return; }
    setBusy(true); setErr(null);
    const el = root.current;
    if (el) el.style.display = "none"; // so the page underneath can be found
    const anchor = anchorFor(box);
    if (el) el.style.display = "";
    const here = window.location.pathname + window.location.search;
    const p: PointBox = {
      v: 1, id: Math.random().toString(36).slice(2, 10), by: me, to, n: note.trim().slice(0, 300),
      pn: (nameOfPage(window.location.pathname) || document.title).slice(0, 60),
      ...anchor, ...box, sx: window.scrollX, sy: window.scrollY, vw: window.innerWidth, vh: window.innerHeight,
    };
    const body = `${to.map((x) => `@${x}`).join(" ")} 👉 ${p.n || "look here"}\n${pointUrl(here, p)}`;
    const r = await sendText(body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setSent(`Sent to ${to.join(" and ")}`);
    setTimeout(() => stopPointing(), 1100);
  };

  return (
    <div ref={root} className="tr-vars tr tr-pt-draw" data-phase={phase} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="tr-pt-bar" onPointerDown={(e) => e.stopPropagation()}>
        <span>{phase === "draw" ? <><b>Drag a box</b> over the part you mean<em> · scroll first on a phone</em></> : <b>Add a note and pick who</b>}</span>
        {phase === "note" && <button className="tr-btn ghost" onClick={() => { setPhase("draw"); setBox(null); }}>Redraw</button>}
        <button className="tr-btn ghost" onClick={() => stopPointing()}>Cancel</button>
      </div>
      {box && <div className="tr-pt-box drawing" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
      {phase === "note" && box && (
        <div className="tr-pt-form" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Point note">
          {sent ? <p className="tr-pt-sent">✓ {sent}</p> : (<>
            <textarea autoFocus rows={2} value={note} maxLength={300} placeholder="What should they look at?" aria-label="Your note"
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <div className="tr-pt-who">
              <span className="tr-muted">For</span>
              {TEAM_PEOPLE.filter((p) => p !== me).map((p) => (
                <button key={p} aria-pressed={to.includes(p)} onClick={() => setTo((t) => (t.includes(p) ? t.filter((x) => x !== p) : [...t, p]))}>
                  <Av p={p} sm />@{p}
                </button>
              ))}
              <button className="tr-btn" style={{ marginLeft: "auto" }} onClick={send} disabled={busy}>{busy ? "…" : "Send"}</button>
            </div>
            {err && <p className="tr-err">{err}</p>}
          </>)}
        </div>
      )}
    </div>
  );
}

/** The nearest element that holds the whole box, as a CSS path, and the box as fractions of it. */
function anchorFor(b: Rect): Pick<PointBox, "sel" | "ex" | "ey" | "ew" | "eh"> {
  try {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const hits = document.elementsFromPoint(cx, cy).filter((e) => !e.closest(".tr-vars") && e !== document.documentElement && e !== document.body);
    let el: Element | null = hits[0] ?? null;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= b.x + 4 && r.top <= b.y + 4 && r.right >= b.x + b.w - 4 && r.bottom >= b.y + b.h - 4 && r.width > 0 && r.height > 0) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) return {};
    const sel = cssPath(el);
    if (!sel || document.querySelector(sel) !== el) return {};
    const r = el.getBoundingClientRect();
    return { sel, ex: (b.x - r.left) / r.width, ey: (b.y - r.top) / r.height, ew: b.w / r.width, eh: b.h / r.height };
  } catch { return {}; }
}

function cssPath(el: Element): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let depth = 0; cur && cur !== document.body && depth < 30; depth++) {
    const id = cur.id;
    if (id && /^[A-Za-z][\w-]*$/.test(id) && document.querySelectorAll(`#${CSS.escape(id)}`).length === 1) { parts.unshift(`#${CSS.escape(id)}`); return parts.join(" > "); }
    const tour = cur.getAttribute("data-tour");
    if (tour && document.querySelectorAll(`[data-tour="${CSS.escape(tour)}"]`).length === 1) { parts.unshift(`[data-tour="${CSS.escape(tour)}"]`); return parts.join(" > "); }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  return parts.length ? `body > ${parts.join(" > ")}` : null;
}

// ── Seeing ────────────────────────────────────────────────────────────────
function locate(p: PointBox): (Rect & { exact: boolean; el: Element | null }) {
  if (p.sel) {
    try {
      const el = document.querySelector(p.sel);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        return { x: r.left + (p.ex ?? 0) * r.width, y: r.top + (p.ey ?? 0) * r.height, w: (p.ew ?? 1) * r.width, h: (p.eh ?? 1) * r.height, exact: true, el };
      }
    } catch { /* bad selector */ }
  }
  const k = window.innerWidth / (p.vw || window.innerWidth);
  return { x: (p.x + p.sx) * k - window.scrollX, y: p.y + p.sy - window.scrollY, w: p.w * k, h: p.h, exact: false, el: null };
}

function scroller(el: Element | null): Element | null {
  for (let cur = el?.parentElement ?? null; cur && cur !== document.body; cur = cur.parentElement) {
    const o = getComputedStyle(cur).overflowY;
    if ((o === "auto" || o === "scroll") && cur.scrollHeight > cur.clientHeight + 4) return cur;
  }
  return null;
}

function Show({ p, onClose }: { p: PointBox; onClose: () => void }) {
  const s = useTeamRoom();
  const [r, setR] = useState(() => locate(p));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const got = ackedBy(s.acks, "point", p.id);
  const mine = !!s.me && got.includes(s.me);

  const relocate = useCallback(() => setR(locate(p)), [p]);
  // Bring it into view (upper part of the screen; the note sits below), then
  // follow the page while it scrolls, resizes or finishes loading.
  useEffect(() => {
    const bring = () => {
      const now = locate(p);
      const want = window.innerHeight * 0.36 - (now.y + Math.min(now.h, window.innerHeight * 0.4) / 2);
      if (Math.abs(want) < 24) return;
      const box = scroller(now.el);
      if (box) box.scrollBy({ top: -want, behavior: "smooth" }); else window.scrollBy({ top: -want, behavior: "smooth" });
    };
    const t1 = setTimeout(bring, 250);
    const t2 = setTimeout(bring, 1400);
    const tick = setInterval(relocate, 500);
    const stopTick = setTimeout(() => clearInterval(tick), 6000);
    window.addEventListener("scroll", relocate, true);
    window.addEventListener("resize", relocate);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(stopTick); clearInterval(tick); window.removeEventListener("scroll", relocate, true); window.removeEventListener("resize", relocate); };
  }, [p, relocate]);

  const gotIt = async () => {
    setBusy(true);
    const res = await setAck("point", p.id, true);
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    if (s.v2 === "off") { setMsg("Got it — saved on this device only until team_room_v2.sql runs."); setTimeout(onClose, 1800); return; }
    onClose();
  };

  const phone = typeof window !== "undefined" && window.innerWidth < 640;
  const below = r.y + r.h + 12;
  const noteTop = phone ? undefined : below + 190 < window.innerHeight ? below : Math.max(12, r.y - 190);
  const noteLeft = phone ? undefined : Math.max(12, Math.min(r.x, window.innerWidth - 352));
  return (
    <div className="tr-vars tr tr-pt-show" aria-live="polite">
      <div className="tr-pt-box shown" style={{ left: r.x - 4, top: r.y - 4, width: r.w + 8, height: r.h + 8 }} />
      <div className={`tr-pt-note${phone ? " sheet" : ""}`} style={phone ? undefined : { top: noteTop, left: noteLeft }} role="dialog" aria-label={`${p.by} pointed here`}>
        <div className="h"><Av p={p.by} sm /><b>{p.by} pointed here</b>
          <button className="tr-x" onClick={onClose} aria-label="Close" title="Close (the point stays in the chat)">✕</button></div>
        {p.n && <p className="n">“{p.n}”</p>}
        {!r.exact && <p className="tr-muted">The page has changed since; this is roughly where it was.</p>}
        <div className="f">
          <span className="who">For {p.to.map((x) => <span key={x} className={got.includes(x) ? "on" : ""}><Av p={x} xs off={!got.includes(x)} />{got.includes(x) ? " ✓" : ""}</span>)}</span>
          {mine ? <span className="tr-pt-sent">✓ You&apos;ve got it</span>
            : <button className="tr-btn" onClick={gotIt} disabled={busy || !s.me}>{busy ? "…" : "Got it"}</button>}
        </div>
        {msg && <p className="tr-muted" style={{ marginTop: 6 }}>{msg}</p>}
        {!s.me && <p className="tr-muted" style={{ marginTop: 6 }}>Open the team chat once to pick your name, then press Got it.</p>}
      </div>
    </div>
  );
}
