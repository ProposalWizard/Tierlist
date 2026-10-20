"use client";

/**
 * STYLE TESTING (Harry, 9 Oct 2026): "make a completely new test area called
 * style testing where you can toggle between and test gameplay, cutscenes
 * etc." The five shortlisted art styles (plus Mix) on real 3D gameplay with a
 * fixed tilted camera, the 2D "fake 3D" look, and cut scenes.
 * Testers and admins only. Nothing is saved.
 * On the Broadcast frame (A-8, 20 Oct 2026): the test plays in the stage box.
 * ?clean=1 (the stills and film tools) and ?bare=1 open it full screen exactly
 * as before.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn } from "@/components/admin/broadcast/BroadcastPage";
import StyleTest3D from "@/components/star/StyleTest3D";
import BackArrow from "@/components/admin/BackArrow";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import "../star-3d-area-dev/stage3d.css";

export default function StarStyleDevPage() {
  const [gate, setGate] = useState<"loading" | "ok" | "denied">("loading");
  const [bare, setBare] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setBare(q.get("clean") === "1" || q.get("bare") === "1");
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

  if (gate === "loading") return <BroadcastPage title="Art styles + cut-scene director"><div className="bc-note">Loading…</div></BroadcastPage>;
  if (gate === "denied") {
    return (
      <BroadcastPage title="Testers only" sub="This is a development sandbox.">
        <div className="bc-note">Sign in as a tester or an admin to use it.</div>
      </BroadcastPage>
    );
  }
  if (bare) {
    return (
      <>
        <StyleTest3D header={
          <div className="flex items-center gap-2">
            <BackArrow />
            <b className="text-[15px] font-black uppercase italic">Art styles + cut-scene director</b>
          </div>
        } />
        <PageGuide page="/star-style-dev" corner="bottom-left" />
      </>
    );
  }
  return (
    <>
      <BroadcastPage title="Art styles + cut-scene director" sub="Five art looks on real 3D play, the goal / signing / walk-out cut scenes, the Cut-scene Director." width={1440}>
        <div className="s3-bar">
          <Btn href="/admin/scene-generator" title="Make a cut scene from a game moment">Scene generator ›</Btn>
          <Btn href="/star-scene-editor-dev?place=director" title="Camera and light for a cut scene">Scene editor ›</Btn>
        </div>
        <div className="s3-stage s3-tall"><StyleTest3D embedded /></div>
      </BroadcastPage>
      <PageGuide page="/star-style-dev" corner="bottom-left" />
    </>
  );
}
