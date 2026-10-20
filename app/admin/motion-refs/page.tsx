"use client";
/**
 * app/admin/motion-refs/page.tsx — Motion references (Harry, 20 Oct 2026:
 * "you should be able to see what I mean and compare it to the real movement,
 * the real look of a person"). One card per reference clip: the clip, a still
 * of our game, and an empty "Ours" slot for our rebuilt clip of the same scene.
 * The list is lib/motionRefs.ts; the files are public/admin/motion-refs/.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BroadcastPage, Note, Pill } from "@/components/admin/broadcast/BroadcastPage";
import PageGuide from "@/components/admin/PageGuide";
import { MOTION_REFS, ROUND_NAME, ROUND_RECIPE, motionRefsFor, oursUrl, type MotionRef, type MotionView } from "@/lib/motionRefs";
import "./motion-refs.css";

const VIEW_KEY = "kib-motion-refs-view";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

/** A clip: muted, loops, plays while on screen, tap to pause, half-speed button. */
function Clip({ src, poster, label }: { src: string; poster?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const held = useRef(false); // the person paused it: stay paused
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !held.current) v.play().catch(() => {});
      else if (!e.isIntersecting) v.pause();
    }, { threshold: 0.5 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const toggle = () => {
    const v = ref.current; if (!v) return;
    if (v.paused) { held.current = false; v.play().catch(() => {}); setPaused(false); }
    else { held.current = true; v.pause(); setPaused(true); }
  };
  const speed = () => {
    const v = ref.current; if (!v) return;
    const next = !slow; v.playbackRate = next ? 0.5 : 1; setSlow(next);
  };
  return (
    <div className="mr-clip">
      <div className="mr-frame">
        <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={label} onClick={toggle} />
        {paused && <span className="mr-paused" aria-hidden>Paused</span>}
      </div>
      <div className="mr-ctrl">
        <button className="mr-btn" onClick={toggle}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
        <button className="mr-btn" aria-pressed={slow} onClick={speed}>½× speed</button>
      </div>
    </div>
  );
}

/** Our clip of the same scene. Empty until a file with the scene's name is added. */
function Ours({ scene }: { scene: string }) {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => live && setHas(true);
    v.onerror = () => live && setHas(false);
    v.src = oursUrl(scene);
    return () => { live = false; v.onloadedmetadata = null; v.onerror = null; v.removeAttribute("src"); v.load(); };
  }, [scene]);
  return (
    <div className="mr-side">
      <div className="bc-label">Ours</div>
      {has ? <Clip src={oursUrl(scene)} label={`Our clip: ${scene}`} /> : (
        <div className="mr-empty" data-pending={has === null}>
          <b>{has === null ? "Looking…" : "Empty"}</b>
          {has === false && <span>Our clip shows here when it is made.</span>}
        </div>
      )}
    </div>
  );
}

function Card({ m }: { m: MotionRef }) {
  const still = m.game ?? m.start;
  return (
    <article className="mr-card" data-base={m.base} data-round={m.round}>
      <header className="mr-head">
        <h2>{m.title}</h2>
        <span className="mr-tags">
          {m.base && <span className="mr-tag mr-base">Base standard</span>}
          <span className="mr-tag" title={ROUND_RECIPE[m.round]}>{ROUND_NAME[m.round]}</span>
        </span>
      </header>
      <p className="mr-what">{m.what}</p>
      <div className="mr-body">
        <div className="mr-ref">
          <div className="bc-label">Real person</div>
          <Clip src={m.video} poster={m.start ?? m.game} label={`Reference: ${m.title}`} />
        </div>
        <div className="mr-side">
          <div className="bc-label">Our game</div>
          {still ? (
            <div className="mr-still">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={still} alt={`${m.title}: ${m.game ? "a still of our game" : "the picture the clip starts from"}`} loading="lazy" />
            </div>
          ) : <div className="mr-empty"><b>No still</b></div>}
          <span className="mr-cap">{m.game ? (m.gameNote ?? "A still of our game") : "No game still saved. This is the clip's start picture."}</span>
        </div>
        <Ours scene={m.scene} />
      </div>
      <footer className="mr-foot">{ROUND_NAME[m.round]}: {ROUND_RECIPE[m.round]}</footer>
    </article>
  );
}

export default function MotionRefsPage() {
  const [view, setView] = useState<MotionView>("hq");
  useEffect(() => { const v = read(VIEW_KEY); if (v === "hq" || v === "r1" || v === "all") setView(v); }, []);
  const pick = (v: MotionView) => { setView(v); write(VIEW_KEY, v); };
  const n = useMemo(() => ({ hq: motionRefsFor("hq").length, r1: motionRefsFor("r1").length, all: MOTION_REFS.length }), []);
  const shown = useMemo(() => motionRefsFor(view), [view]);
  return (
    <>
      <BroadcastPage title="Motion references" sub={`${n.all} clips of real-looking people doing our cut-scene moments. Compare them with our own movement.`} width={1200}>
        <div className="mr-pills" role="group" aria-label="Round">
          <Pill on={view === "hq"} onClick={() => pick("hq")}>HQ (base standard) {n.hq}</Pill>
          <Pill on={view === "r1"} onClick={() => pick("r1")}>First round {n.r1}</Pill>
          <Pill on={view === "all"} onClick={() => pick("all")}>All {n.all}</Pill>
        </div>
        <Note>
          Made on Higgsfield from stills of our game. The five base-standard scenes come first. Every clip loops, plays while you can see it and has no sound.
          Tap a clip to pause it. The first-round handshake is left out: it shows a small dark mark on the shirt that looks like a brand logo.
        </Note>
        <div className="mr-grid">
          {shown.map((m) => <Card key={`${m.round}-${m.scene}`} m={m} />)}
        </div>
      </BroadcastPage>
      <PageGuide page="/admin/motion-refs" />
    </>
  );
}
