"use client";
/**
 * components/SiteLook.tsx — keeps the New look preview on <html> as you move
 * between pages, takes ?look=v2 / ?look=off / ?theme=dark|light (admins only),
 * and shows the small "New look" pill while it is on (lib/siteLook/look.ts).
 * Draws nothing for anyone without the preview cookie.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { applyLook, lookFromCookie, scopeOf, setLookCookie, setThemeCookie, type Theme } from "@/lib/siteLook/look";

export default function SiteLook() {
  const path = usePathname() ?? "/";
  const isAdmin = useIsAdmin();
  const [look, setLook] = useState<{ on: boolean; theme: Theme }>({ on: false, theme: "light" });
  const [open, setOpen] = useState(false);

  // Read the cookie; take a ?look / ?theme link (only an admin's browser keeps it).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (isAdmin && q.get("look")) setLookCookie(q.get("look") === "v2");
    if (isAdmin && (q.get("theme") === "dark" || q.get("theme") === "light")) setThemeCookie(q.get("theme") as Theme);
    setLook(lookFromCookie(document.cookie));
  }, [path, isAdmin]);

  useEffect(() => { applyLook(document.documentElement, look, path); }, [look, path]);

  if (!look.on || scopeOf(path) === "game") return null;
  const set = (next: { on: boolean; theme: Theme }) => { setLookCookie(next.on); setThemeCookie(next.theme); setLook(next); };
  return (
    <div data-look-pill className="fixed bottom-3 left-3 z-[60] text-[13px] font-bold" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {open ? (
        <div className="flex items-center gap-1 rounded-full p-1 shadow-lg" style={{ background: "#12151a", color: "#fff" }}>
          {(["light", "dark"] as const).map((t) => (
            <button key={t} onClick={() => set({ on: true, theme: t })} className="rounded-full px-3 py-1.5"
              style={look.theme === t ? { background: "#0a7a3d", color: "#fff" } : { color: "#fff" }}>{t === "light" ? "Light" : "Dark"}</button>
          ))}
          <button onClick={() => { set({ on: false, theme: look.theme }); setOpen(false); }} className="rounded-full px-3 py-1.5" style={{ color: "#fff" }}>Turn off</button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full px-2 py-1.5" style={{ color: "#fff" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="rounded-full px-3 py-1.5 shadow-lg" style={{ background: "#12151a", color: "#fff" }}>
          ● New look {look.theme === "dark" ? "(dark)" : ""}
        </button>
      )}
    </div>
  );
}
