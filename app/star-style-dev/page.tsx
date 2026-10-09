"use client";

/**
 * STYLE TESTING (Harry, 9 Oct 2026): "make a completely new test area called
 * style testing where you can toggle between and test gameplay, cutscenes
 * etc." The five shortlisted art styles (plus Mix) on real 3D gameplay with a
 * fixed tilted camera, the 2D "fake 3D" look, and cut scenes.
 * Testers and admins only. Nothing is saved.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import StyleTest3D from "@/components/star/StyleTest3D";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

export default function StarStyleDevPage() {
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");
  useEffect(() => {
    if (offlineDevPlayEnabled()) { setGate("ok"); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setGate("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : {};
        setGate(d.isAdmin || d.isTester ? "ok" : "denied");
      } catch { setGate("denied"); }
    });
  }, []);

  if (gate === "loading") return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  if (gate === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div><div className="text-lg font-black mb-1">Testers only</div><div className="text-sm text-gray-400">This is a development sandbox.</div></div>
      </div>
    );
  }
  return (
    <>
      <StyleTest3D />
      <PageGuide page="/star-style-dev" corner="bottom-left" />
    </>
  );
}
