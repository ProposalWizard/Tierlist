"use client";
import { useCallback, useState } from "react";
import TransferHereWeGo01 from "@/components/star/media/templates/TransferHereWeGo01";
import Graphic from "@/components/star/media/Graphics";
import PortraitPicker from "@/components/star/PortraitPicker";
import type { GraphicSpec } from "@/lib/star/media/types";

/**
 * THE MEDIA LAB
 *
 * A dev bench for the graphics library. Drop a pose PNG and a face onto it and
 * every template re-renders live, in every club's colours, so a design can be
 * judged against the real assets rather than against a mock-up.
 *
 * Nothing here is uploaded anywhere — the files are read into a local blob URL
 * and never leave the browser. It also carries the face-anchor tool: click the
 * pose where the head is and drag to size it, and it prints the three numbers
 * the template needs.
 */

const CLUBS = [
  { name: "Arsenal", primary: "#e11d2e", secondary: "#ffffff" },
  { name: "Manchester City", primary: "#6cabdd", secondary: "#1c2c5b" },
  { name: "Newcastle United", primary: "#111111", secondary: "#ffffff" },
  { name: "Aston Villa", primary: "#670e36", secondary: "#95bfe5" },
  { name: "Norwich City", primary: "#fff200", secondary: "#00a650" },
  { name: "Tottenham Hotspur", primary: "#ffffff", secondary: "#132257" },
];

export default function MediaLab() {
  const [pose, setPose] = useState<string | null>(null);
  const [face, setFace] = useState<string | null>(null);
  const [anchor, setAnchor] = useState({ x: 0.5, y: 0.17, size: 0.135 });
  const [neckY, setNeckY] = useState(0.235);
  const [faceLift, setFaceLift] = useState(1);
  const [figureScale, setFigureScale] = useState(1);
  const [figureY, setFigureY] = useState(0);
  const [treatment, setTreatment] = useState(0.85);
  const [club, setClub] = useState(0);

  const read = (file: File, set: (s: string) => void) => {
    const r = new FileReader();
    r.onload = () => set(String(r.result));
    r.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent, set: (s: string) => void) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) read(f, set);
  }, []);

  const c = CLUBS[club];

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-black uppercase tracking-wide">Media Lab</h1>
        <p className="mt-1 text-[12px] font-bold text-white/70">
          Drop your pose PNG below. Nothing is uploaded — it stays in this browser tab.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
          {/* ── Controls ── */}
          <div className="space-y-3">
            <Drop label="Pose image" src={pose} onDrop={e => onDrop(e, setPose)}
              onPick={f => read(f, setPose)} onClear={() => setPose(null)} />
            <Drop label="Face image (optional)" src={face} onDrop={e => onDrop(e, setFace)}
              onPick={f => read(f, setFace)} onClear={() => setFace(null)} />

            <div className="rounded-lg border border-white/15 bg-gray-800 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Club colours</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {CLUBS.map((k, i) => (
                  <button
                    key={k.name}
                    onClick={() => setClub(i)}
                    className={`rounded px-1.5 py-2 text-[10px] font-black leading-tight transition ${
                      i === club ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"}`}
                    style={{ background: k.primary, color: k.primary === "#ffffff" || k.primary === "#fff200" ? "#111" : "#fff" }}
                  >
                    {k.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <Slider label="Treatment" value={treatment} onChange={setTreatment}
              hint="0 = raw photo · 1 = full duotone" />
            <Slider label="Face X" value={anchor.x} onChange={x => setAnchor(a => ({ ...a, x }))} />
            <Slider label="Face Y" value={anchor.y} onChange={y => setAnchor(a => ({ ...a, y }))} />
            <Slider label="Face size" value={anchor.size} max={0.4} onChange={size => setAnchor(a => ({ ...a, size }))} />
            <Slider label="Neck line" value={neckY} max={0.6} onChange={setNeckY}
              hint="everything above this is cut off the pose" />
            <Slider label="Face brightness" value={faceLift} max={2} onChange={setFaceLift}
              hint="match the face's exposure to the arms" />
            <Slider label="Figure size" value={figureScale} max={2.2} onChange={setFigureScale}
              hint="fill the frame — crop him around the thigh" />
            <Slider label="Figure up / down" value={figureY} min={-0.4} max={0.4} onChange={setFigureY} />

            <div className="rounded-lg border border-white/15 bg-gray-800 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Anchor</div>
              <code className="mt-1 block break-all text-[11px] font-bold text-emerald-300">
                {`{ x: ${anchor.x.toFixed(3)}, y: ${anchor.y.toFixed(3)}, size: ${anchor.size.toFixed(3)}, `
                  + `neckY: ${neckY.toFixed(3)}, faceLift: ${faceLift.toFixed(2)}, `
                  + `figureScale: ${figureScale.toFixed(2)}, figureY: ${figureY.toFixed(3)} }`}
              </code>
            </div>
          </div>

          {/* ── Output ── */}
          <div>
            <div className="mx-auto w-full max-w-[340px]">
              <TransferHereWeGo01
                playerName="Michael Sancho"
                fromClub={CLUBS[(club + 3) % CLUBS.length].name}
                toClub={c.name}
                fee="£65m"
                poseSrc={pose ?? undefined}
                faceSrc={face ?? undefined}
                faceAnchor={anchor}
                neckY={neckY}
                faceLift={faceLift}
                figureScale={figureScale}
                figureY={figureY}
                kitPrimary={c.primary}
                kitSecondary={c.secondary}
                treatment={treatment}
              />
            </div>

            <div className="mt-6 text-[10px] font-black uppercase tracking-widest text-white/70">
              Same template, every club
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CLUBS.map(k => (
                <TransferHereWeGo01
                  key={k.name}
                  playerName="Michael Sancho"
                  toClub={k.name}
                  fee="£65m"
                  poseSrc={pose ?? undefined}
                  faceSrc={face ?? undefined}
                  faceAnchor={anchor}
                  neckY={neckY}
                  faceLift={faceLift}
                  figureScale={figureScale}
                  figureY={figureY}
                  kitPrimary={k.primary}
                  kitSecondary={k.secondary}
                  treatment={treatment}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── The typed cards ──
            The templates above need assets; these need nothing but data, so
            they belong on the same bench where they can be judged at the width
            a post actually renders at rather than full-screen. */}
        <div className="mt-8">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white/70">Post cards</h2>
          <div className="mt-3 flex max-w-3xl flex-wrap items-start gap-4">
            <div className="w-full max-w-sm space-y-4">
              <Graphic spec={SAMPLE_NOMINEES} />
              <Graphic spec={SAMPLE_WINNER} />
              <Graphic spec={SAMPLE_WINNER_YOU} />
              <Graphic spec={SAMPLE_WINNER_PHOTO} />
              <PortraitPicker value={undefined} onChange={() => {}} club="Liverpool" number={19} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A stand-in for a photograph somebody took of themselves — a face-shaped thing
 * against a room-coloured background, which is exactly the case the duotone
 * exists to handle. Inline, because the bench must not need the network.
 */
const PLACEHOLDER_PHOTO =
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
       <rect width="200" height="200" fill="#8a9a7b"/>
       <rect y="130" width="200" height="70" fill="#6b7a5e"/>
       <ellipse cx="100" cy="88" rx="46" ry="54" fill="#e0b48f"/>
       <path d="M40 200 C40 150 70 138 100 138 C130 138 160 150 160 200 Z" fill="#3f4a5a"/>
       <path d="M56 74 C60 34 140 34 144 74 C144 52 128 38 100 38 C72 38 56 52 56 74 Z" fill="#4a3527"/>
     </svg>`);

/** A busy August, for judging the shortlist card. */
const SAMPLE_NOMINEES: GraphicSpec = {
  type: "potmNominees",
  month: "August",
  nominees: [
    { name: "Mikey Vass", club: "Liverpool", goals: 6, assists: 2, isYou: true, number: 19 },
    { name: "R. Calafiori", club: "Arsenal", goals: 5, assists: 1, isYou: false, face: FACE(243812) },
    { name: "J. Grealish", club: "Everton", goals: 4, assists: 3, isYou: false, face: FACE(209331) },
    { name: "M. Guehi", club: "Crystal Palace", goals: 4, assists: 0, isYou: false, face: FACE(235243) },
    { name: "E. Haaland", club: "Manchester City", goals: 4, assists: 0, isYou: false, face: FACE(239085) },
    { name: "J. Pedro", club: "Chelsea", goals: 3, assists: 2, isYou: false, face: FACE(247635) },
    { name: "A. Semenyo", club: "AFC Bournemouth", goals: 3, assists: 1, isYou: false },
    { name: "D. Szoboszlai", club: "Tottenham Hotspur", goals: 2, assists: 4, isYou: false, face: FACE(233419) },
  ],
};

/** Somebody else winning it, which is nine months in ten. */
const SAMPLE_WINNER: GraphicSpec = {
  type: "potmWinner",
  month: "September",
  firstName: "Erling",
  lastName: "Haaland",
  club: "Manchester City",
  goals: 6,
  assists: 1,
  isYou: false,
  face: FACE(239085),
  runnerUp: "Calafiori",
  yourPlace: 4,
};

/** …and the month you win it, where there is no photograph to use. */
const SAMPLE_WINNER_YOU: GraphicSpec = {
  type: "potmWinner",
  month: "October",
  firstName: "Mikey",
  lastName: "Vass",
  club: "Liverpool",
  goals: 7,
  assists: 3,
  isYou: true,
  number: 19,
  runnerUp: "Haaland",
};

/** The same, once you have taken a picture — the treated case. */
const SAMPLE_WINNER_PHOTO: GraphicSpec = {
  ...SAMPLE_WINNER_YOU,
  month: "November",
  number: undefined,
  face: PLACEHOLDER_PHOTO,
  own: true,
};

/** The portrait URL the importer writes, for judging the card against real ones.
 *  Semenyo above is deliberately left without one — the monogram fallback has to
 *  be looked at too, because a partly-imported division will produce it. */
function FACE(id: number): string {
  const s = String(id).padStart(6, "0");
  return `https://cdn.sofifa.net/players/${s.slice(0, 3)}/${s.slice(3)}/26_120.png`;
}

function Drop({ label, src, onDrop, onPick, onClear }: {
  label: string; src: string | null;
  onDrop: (e: React.DragEvent) => void;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      className="rounded-lg border-2 border-dashed border-white/25 bg-gray-800 p-3 text-center"
    >
      <div className="text-[10px] font-black uppercase tracking-widest text-white/70">{label}</div>
      {src ? (
        <>
          <img src={src} alt="" className="mx-auto mt-2 h-24 object-contain" />
          <button onClick={onClear} className="mt-1 text-[10px] font-bold text-red-400 hover:text-red-300">
            remove
          </button>
        </>
      ) : (
        <p className="mt-2 text-[11px] font-bold text-white/60">Drag a PNG here</p>
      )}
      <label className="mt-2 inline-block cursor-pointer rounded bg-white/10 px-2 py-1 text-[10px] font-black text-white hover:bg-white/20">
        Choose file
        <input type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      </label>
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string;
}) {
  return (
    <div className="rounded-lg border border-white/15 bg-gray-800 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-white">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={0.005} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-emerald-500"
      />
      {hint && <p className="mt-1 text-[9px] font-bold text-white/55">{hint}</p>}
    </div>
  );
}
