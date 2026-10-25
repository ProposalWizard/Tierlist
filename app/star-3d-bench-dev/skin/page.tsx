"use client";
/**
 * THE BENCH'S SKIN SHEET (Harry, 23 Oct 2026: "we have got to fix this skin
 * colour issue on the 3d guys"). Every skin tone the game offers on the card's
 * 3D man, made by the real headshot maker (lib/star/headshot3d/maker.ts
 * benchHeadshot, not a copy), each beside the same picture with the skin
 * probe's regions (face magenta, neck cyan, upper arm yellow, forearm green,
 * hand blue: toon/shader.ts setToonSkinProbe(2)). The numbers (each region's
 * colour against the tone picked in Settings → Your look) are worked out by
 * scripts/bench3d/skin.mjs + skin_sheet.py from window.__skinSheet.
 *
 *   ?head=h1..h6   which head (default h1)   ?frame=card|head
 */
import { useEffect, useState } from "react";
import { SKIN_TONES, HAIR_COLOURS } from "@/lib/star/playerIdentity";
import { TOON_PLAYER_HEADS, type ToonHead } from "@/lib/star/style3d/toon/bodies";

interface Row { tone: string; hex: string; url: string; probe: string }

export default function BenchSkinSheet() {
  const [rows, setRows] = useState<Row[]>([]);
  const [head, setHead] = useState<ToonHead>("h1");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const h = ((TOON_PLAYER_HEADS as readonly string[]).includes(q.get("head") ?? "") ? q.get("head") : "h1") as ToonHead;
      const frame = q.get("frame") === "head" ? "head" : "card";
      setHead(h);
      const { benchHeadshot } = await import("@/lib/star/headshot3d/maker");
      const out: Row[] = [];
      for (const t of SKIN_TONES) {
        const look = { head: h, body: "c1" as const, skin: t.hex, hair: HAIR_COLOURS[1].hex, shirt: "#d61f26", trim: "#ffffff", shorts: "#ffffff" };
        const r = await benchHeadshot(look, frame);
        if (dead) return;
        if (!r) continue;
        out.push({ tone: t.id, hex: t.hex, url: r.url, probe: r.probe });
        setRows([...out]);
      }
      (window as unknown as { __skinSheet?: unknown }).__skinSheet = { head: h, frame, rows: out };
    })();
    return () => { dead = true; };
  }, []);
  return (
    <div style={{ background: "#0b1220", minHeight: "100vh", color: "#fff", padding: 12, fontFamily: "system-ui, sans-serif" }} data-skin-sheet>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Skin sheet · head {head} · the card&apos;s man (the real headshot maker)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.tone} style={{ background: "#2a3346", borderRadius: 8, padding: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 22, height: 14, background: r.hex, borderRadius: 3, display: "inline-block" }} />{r.tone}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <img src={r.url} alt="" style={{ width: 120, height: 120 }} />
              <img src={r.probe} alt="" style={{ width: 120, height: 120 }} />
            </div>
          </div>
        ))}
      </div>
      {rows.length < SKIN_TONES.length && <div style={{ marginTop: 8 }}>Making {rows.length + 1} of {SKIN_TONES.length}…</div>}
    </div>
  );
}
