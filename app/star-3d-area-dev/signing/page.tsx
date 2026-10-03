"use client";

/**
 * SIGNING SCENE — LIVE 3D (Harry, 2 Oct 2026: "Make the cutscene 3D live …
 * if they choose a skin tone, if they have a face picture, or if they have
 * any accessories, put that in there … do all of the movement stuff as well").
 *
 * The same scene the career plays (components/star/SigningScene3D.tsx) with
 * the sample terms, and a picker for the look so it can be tested without a
 * career: skin tone, face picture, hair, every store accessory, the aviators.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import PageGuide from "@/components/admin/PageGuide";
import { SKIN_TONES, type SkinTone } from "@/lib/star/playerIdentity";
import { FAKE_FACES } from "@/lib/star/fakeFaces";
import { fitImage, getFittedHead, type FittedHead } from "@/lib/star/faceFit";
import { ACCESSORIES, SLOT_LABEL } from "@/lib/star/store/catalogue";
import { SAMPLE_TERMS, contractRows, signingLines, wornAccessories, SIGNING3D_ACCESSORY_SLOTS } from "@/lib/star/signing3d";
import { managerLook } from "@/lib/star/managerFace";
import { kitsOf } from "@/lib/star/kits";
import type { SigningHairStyle, SigningYou } from "@/lib/star/signing3dScene";

const SigningScene3D = dynamic(() => import("@/components/star/SigningScene3D"), { ssr: false });

const INK = "#f8fafc";
const HAIR_COLOURS = [["#17110d", "Black"], ["#3d2616", "Brown"], ["#b88a4a", "Fair"], ["#d7b26a", "Blond"]] as const;

export default function Signing3dPage() {
  const [skin, setSkin] = useState<SkinTone>("fair");
  const [face, setFace] = useState<number>(0); // -1 = the model's own face
  const [hairStyle, setHairStyle] = useState<SigningHairStyle>("short");
  const [hair, setHair] = useState<string>("#3d2616");
  const [worn, setWorn] = useState<Record<string, string>>({});
  const [aviators, setAviators] = useState(false);
  // ?club=Name: sign for another club (its home kit on you and on the walls).
  const [club, setClub] = useState<string>(SAMPLE_TERMS.club);
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // Read the URL once, so a still can be set up from a link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("skin"); if (s && SKIN_TONES.some((t) => t.id === s)) setSkin(s as SkinTone);
    const f = q.get("face"); if (f != null) setFace(Number(f));
    const h = q.get("hair"); if (h === "short" || h === "long" || h === "buzz" || h === "none") setHairStyle(h);
    const acc = q.get("acc");
    if (acc) {
      const w: Record<string, string> = {};
      for (const id of acc.split(",")) { const a = ACCESSORIES.find((x) => x.id === id); if (a) w[a.slot] = a.id; }
      setWorn(w);
    }
    if (q.get("aviators") === "1") setAviators(true);
    const cl = q.get("club"); if (cl) setClub(cl);
  }, []);

  // The face picture, fitted the way the home avatar fits it.
  const faceUrl = face >= 0 ? FAKE_FACES[face] : null;
  const [fitted, setFitted] = useState<FittedHead | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (!faceUrl) { setFitted(null); return; }
    const img = fitImage(faceUrl);
    const done = () => {
      const f = getFittedHead(faceUrl);
      (window as unknown as { __fitted?: unknown }).__fitted = f; // for test stills
      setFitted(f);
    };
    if (img.complete && img.naturalWidth) { done(); return; }
    setFitted(null);
    img.addEventListener("load", done, { once: true });
    return () => img.removeEventListener("load", done);
  }, [faceUrl]);
  const waitingForFace = !mounted || (!!faceUrl && !fitted);

  const kit = kitsOf(club).home;
  const you: SigningYou = useMemo(() => ({
    skin: SKIN_TONES.find((t) => t.id === skin)!.hex,
    face: fitted,
    accessories: wornAccessories(worn),
    aviators,
    kit,
    number: SAMPLE_TERMS.number,
    hair,
    hairStyle,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [skin, fitted, worn, aviators, hair, hairStyle, kit.shirt, kit.trim]);

  const look = managerLook(SAMPLE_TERMS.manager);
  const manager = { skin: look.skin, hairColour: look.hairColour, grey: look.grey, beard: look.beard !== "none", bald: look.hair === "bald", buzz: look.hair === "buzz" || look.hair === "receding" || look.hair === "ring" };
  const contract = {
    club, playerName: SAMPLE_TERMS.playerName, managerName: SAMPLE_TERMS.manager,
    rows: contractRows({ seasons: SAMPLE_TERMS.seasons, wage: SAMPLE_TERMS.wage, number: SAMPLE_TERMS.number, position: SAMPLE_TERMS.position, season: "2026/27" }),
    shirt: kit.shirt, trim: kit.trim,
  };

  const chip = (on: boolean): React.CSSProperties => ({
    padding: "7px 10px", fontSize: 12, fontWeight: 800, borderRadius: 8, border: "none",
    background: on ? INK : "rgba(255,255,255,.1)", color: on ? "#07090f" : INK,
  });

  return (
    <main>
      {!waitingForFace && (
        <SigningScene3D
          you={you}
          manager={manager}
          contract={contract}
          lines={signingLines({ seasons: SAMPLE_TERMS.seasons, number: SAMPLE_TERMS.number })}
          title={`Signing for ${club}`}
          onDone={() => setReplay((r) => r + 1)}
          doneLabel="Continue (replays here)"
          replayKey={replay}
          topRight={
            <>
              <Link href="/star-3d-area-dev" aria-label="Back" style={{ ...chip(false), minHeight: 36, display: "flex", alignItems: "center", textDecoration: "none", borderRadius: 999 }}>‹</Link>
              <button onClick={() => setReplay((r) => r + 1)} style={{ ...chip(false), minHeight: 36, borderRadius: 999 }}>↺</button>
              <button data-picker onClick={() => setOpen((o) => !o)} style={{ ...chip(open), minHeight: 36, borderRadius: 999 }}>Your player</button>
            </>
          }
        />
      )}

      {open && (
        <div style={{ position: "fixed", left: 8, right: 8, top: 58, maxHeight: "62vh", overflowY: "auto", zIndex: 40, padding: 12, borderRadius: 12, background: "rgba(8,10,16,.94)", color: INK, fontFamily: "system-ui, sans-serif", boxShadow: "0 12px 30px rgba(0,0,0,.6)" }}>
          <Section title="Skin tone">
            {SKIN_TONES.map((t) => (
              <button key={t.id} data-skin={t.id} onClick={() => setSkin(t.id)} aria-label={t.label}
                style={{ width: 30, height: 30, borderRadius: 15, border: t.id === skin ? "3px solid #fff" : "2px solid rgba(255,255,255,.2)", background: t.hex }} />
            ))}
          </Section>
          <Section title="Face picture">
            <button onClick={() => setFace(-1)} style={chip(face === -1)}>Model&apos;s own</button>
            {FAKE_FACES.map((f, i) => (
              <button key={f} onClick={() => setFace(i)} style={{ ...chip(face === i), padding: 2, width: 38, height: 38, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt={`Face ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
              </button>
            ))}
          </Section>
          <Section title="Hair">
            {(["short", "long", "buzz", "none"] as const).map((h) => (
              <button key={h} onClick={() => setHairStyle(h)} style={chip(hairStyle === h)}>{h[0].toUpperCase() + h.slice(1)}</button>
            ))}
            {HAIR_COLOURS.map(([c, n]) => (
              <button key={c} onClick={() => setHair(c)} aria-label={n} style={{ width: 26, height: 26, borderRadius: 13, background: c, border: hair === c ? "3px solid #fff" : "2px solid rgba(255,255,255,.2)" }} />
            ))}
          </Section>
          {SIGNING3D_ACCESSORY_SLOTS.map((slot) => (
            <Section key={slot} title={SLOT_LABEL[slot]}>
              <button onClick={() => setWorn((w) => { const n = { ...w }; delete n[slot]; return n; })} style={chip(!worn[slot])}>None</button>
              {ACCESSORIES.filter((a) => a.slot === slot).map((a) => (
                <button key={a.id} data-acc={a.id} onClick={() => setWorn((w) => ({ ...w, [slot]: a.id }))} style={chip(worn[slot] === a.id)}>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: a.color, marginRight: 5, boxShadow: "0 0 0 1px rgba(0,0,0,.4)" }} />{a.name}
                </button>
              ))}
            </Section>
          ))}
          <Section title="Star Pass">
            <button onClick={() => setAviators((v) => !v)} style={chip(aviators)}>Gold Aviators</button>
          </Section>
          <button onClick={() => setOpen(false)} style={{ ...chip(true), width: "100%", marginTop: 4, padding: "10px 0" }}>Done</button>
        </div>
      )}
      <PageGuide page="/star-3d-area-dev/signing" corner="bottom-left" />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>{children}</div>
    </div>
  );
}
