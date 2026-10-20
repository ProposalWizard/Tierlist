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
 *
 *   ?files=/star/people3d/toon-q1.glb,…   measure body files being judged instead
 *     (bodies.ts TOON_BODY_SETS), keyed by their model name; faces.mjs --files writes
 *     them to faceFileLandmarks.ts.
 */
import { useEffect, useRef, useState } from "react";
import { BroadcastPage, Panel, Note } from "@/components/admin/broadcast/BroadcastPage";
import { TOON_HEADS, TOON_HEAD_LABEL, type ToonHead } from "@/lib/star/style3d/toon/bodies";
import { measureToonFace, type ToonFaceMeasure } from "@/lib/star/style3d/toon/faceMeasure";

export default function ToonFacesPage() {
  const [rows, setRows] = useState<{ head: string; m: ToonFaceMeasure; pic: string }[]>([]);
  const [todo, setTodo] = useState<number>(TOON_HEADS.length);
  const [err, setErr] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    (async () => {
      try {
        const out: { head: string; m: ToonFaceMeasure; pic: string }[] = [];
        const files = (new URLSearchParams(window.location.search).get("files") ?? "").split(",").filter(Boolean);
        setTodo(files.length || TOON_HEADS.length);
        // a judged body file is keyed by its model name: toon-q1 for /star/people3d/toon-q1.glb
        const jobs: { key: string; head: ToonHead; file?: string }[] = files.length
          ? files.map((f) => ({ key: f.split("/").pop()!.replace(/\.glb$/, ""), head: "h1" as ToonHead, file: f }))
          : TOON_HEADS.map((h) => ({ key: h, head: h }));
        for (const j of jobs) {
          const r = await measureToonFace(j.head, j.file);
          out.push({ head: j.key, ...r });
          setRows([...out]);
        }
        (window as unknown as { __toonFaces?: unknown }).__toonFaces = Object.fromEntries(out.map((r) => [r.head, r.m]));
      } catch (e) { setErr(String((e as Error).message ?? e)); }
    })();
  }, []);
  return (
    <BroadcastPage title="Style A faces" sub="Where each head's eyes, brows and mouth are, measured off its own picture. Red: the eye openings. Blue: the irises. Green: the mouth.">
      {err && <Note>{err}</Note>}
      {rows.length < todo && <Note>Measuring {rows.length + 1} of {todo}…</Note>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {rows.map((r) => (
          <Panel key={r.head} title={`${r.head} · ${TOON_HEAD_LABEL[r.head as ToonHead] ?? "judged body"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.pic} alt="" width={330} />
            <pre style={{ fontSize: 10, maxWidth: 330, whiteSpace: "pre-wrap" }}>{JSON.stringify(r.m)}</pre>
          </Panel>
        ))}
      </div>
    </BroadcastPage>
  );
}
