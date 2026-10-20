"use client";
/**
 * WHERE EACH STYLE A HEAD'S FACE IS — measured off the head's own painted
 * picture (3D plan step 4: "after measuring its eye and mouth spots on the
 * eight Style A heads"). Each head is drawn flat from the front with no light
 * (orthographic, rest pose); the eye whites, irises, brows and the lips are
 * found by colour, and their places read back in rest-pose metres. The numbers
 * go into lib/star/style3d/toon/faceLandmarks.ts (scripts/bench3d/faces.mjs
 * reads window.__toonFaces off this page). Each head's picture shows what was
 * found, drawn over it, so a bad find is seen at once.
 */
import { useEffect, useRef, useState } from "react";
import { BroadcastPage, Panel, Note } from "@/components/admin/broadcast/BroadcastPage";
import { TOON_HEADS, TOON_HEAD_LABEL, type ToonHead } from "@/lib/star/style3d/toon/bodies";
import { measureToonFace, type ToonFaceMeasure } from "@/lib/star/style3d/toon/faceMeasure";

export default function ToonFacesPage() {
  const [rows, setRows] = useState<{ head: ToonHead; m: ToonFaceMeasure; pic: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const out: { head: ToonHead; m: ToonFaceMeasure; pic: string }[] = [];
        for (const h of TOON_HEADS) {
          const r = await measureToonFace(h);
          out.push({ head: h, ...r });
          setRows([...out]);
        }
        (window as unknown as { __toonFaces?: unknown }).__toonFaces = Object.fromEntries(out.map((r) => [r.head, r.m]));
      } catch (e) { setErr(String((e as Error).message ?? e)); }
    })();
  }, []);
  return (
    <BroadcastPage title="Style A faces" sub="Where each head's eyes, brows and mouth are, measured off its own picture. Red: the eye openings. Blue: the irises. Green: the mouth.">
      {err && <Note>{err}</Note>}
      {rows.length < TOON_HEADS.length && <Note>Measuring {rows.length + 1} of {TOON_HEADS.length}…</Note>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {rows.map((r) => (
          <Panel key={r.head} title={`${r.head} · ${TOON_HEAD_LABEL[r.head]}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.pic} alt="" width={330} />
            <pre style={{ fontSize: 10, maxWidth: 330, whiteSpace: "pre-wrap" }}>{JSON.stringify(r.m)}</pre>
          </Panel>
        ))}
      </div>
    </BroadcastPage>
  );
}
