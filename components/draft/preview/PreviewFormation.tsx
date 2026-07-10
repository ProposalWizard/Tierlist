// PREVIEW COMPONENT — sample data only, not wired into the real game.
// A redesigned starting-XI pitch view with glowing rings, flags and ratings.
// Uses initial-based avatars (real face photos are a separate data question).

interface P {
  name: string;
  iso: string;      // flagcdn code (e.g. "fr", "gb-eng")
  rating: string;
  x: number;        // 0-100 %
  y: number;        // 0-100 %
  highlight?: boolean;
}

interface Sub {
  name: string;
  iso: string;
  rating: string;
  positions: string;
  posColor: string; // tailwind bg for the position pill
}

const XI: P[] = [
  // Front 3
  { name: "Hazard",  iso: "be",     rating: "97",   x: 16, y: 20 },
  { name: "Martial", iso: "fr",     rating: "93",   x: 50, y: 12 },
  { name: "Diaby",   iso: "fr",     rating: "91",   x: 84, y: 20 },
  // Mid 3
  { name: "Ferreira", iso: "pt",    rating: "100",  x: 27, y: 44 },
  { name: "Gerrard",  iso: "gb-eng", rating: "94.1", x: 50, y: 52, highlight: true },
  { name: "Tadić",    iso: "rs",    rating: "89.2", x: 73, y: 44, highlight: true },
  // Back 4
  { name: "Coloccini",   iso: "ar",     rating: "84.3", x: 12, y: 72, highlight: true },
  { name: "Mee",         iso: "gb-eng", rating: "86",   x: 38, y: 74 },
  { name: "Rice",        iso: "gb-eng", rating: "95",   x: 62, y: 74 },
  { name: "Wan-Bissaka", iso: "gb-eng", rating: "88",   x: 88, y: 72 },
  // GK
  { name: "Cavalieri", iso: "br", rating: "83", x: 50, y: 92 },
];

const SUBS: Sub[] = [
  { name: "Berghuis", iso: "nl", rating: "86", positions: "RW/LW/LM/RM", posColor: "bg-red-500" },
  { name: "Pedro",    iso: "br", rating: "85", positions: "ST/CAM",      posColor: "bg-red-500" },
  { name: "Petrov",   iso: "bg", rating: "92", positions: "CM",          posColor: "bg-emerald-500" },
];

function flag(iso: string) {
  return `https://flagcdn.com/20x15/${iso}.png`;
}

function initials(name: string) {
  return name.replace(/[^A-Za-z\s-]/g, "").split(/[\s-]/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name, highlight, size }: { name: string; highlight?: boolean; size: "pitch" | "sub" }) {
  const dim = size === "pitch" ? "h-12 w-12 sm:h-16 sm:w-16" : "h-12 w-12";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center bg-gradient-to-br from-gray-600 to-gray-800 text-white font-black ${size === "pitch" ? "text-sm sm:text-base" : "text-sm"} ${
        highlight
          ? "ring-2 ring-amber-400 shadow-[0_0_16px_-2px_rgba(251,191,36,0.7)]"
          : "ring-2 ring-emerald-400/70 shadow-[0_0_14px_-4px_rgba(52,211,153,0.6)]"
      }`}
    >
      {initials(name)}
    </div>
  );
}

export default function PreviewFormation() {
  return (
    <div className="mx-auto w-full max-w-md">
      {/* Header */}
      <p className="mb-3 text-center text-sm text-white/70">Tap two players to swap · drag on desktop</p>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="text-xs font-black uppercase tracking-[0.25em] text-white/80">Starting XI Rating</span>
        <span className="text-3xl font-black text-emerald-400 [text-shadow:0_0_20px_rgba(52,211,153,0.5)]">91.5</span>
      </div>

      {/* Pitch */}
      <div
        className="relative w-full overflow-hidden rounded-2xl ring-1 ring-emerald-400/40 shadow-[0_0_40px_-12px_rgba(52,211,153,0.5)]"
        style={{ paddingBottom: "128%", background: "radial-gradient(120% 80% at 50% 0%, #12401a 0%, #0c2e14 45%, #071c0d 100%)" }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 100" preserveAspectRatio="none">
          <g stroke="#5eead4" strokeWidth="0.35" fill="none" opacity="0.18">
            <rect x="4" y="3" width="192" height="94" rx="1" />
            <line x1="4" y1="50" x2="196" y2="50" />
            <circle cx="100" cy="50" r="11" />
            <rect x="34" y="3" width="132" height="16" />
            <rect x="34" y="81" width="132" height="16" />
            <rect x="74" y="3" width="52" height="7" />
            <rect x="74" y="90" width="52" height="7" />
          </g>
        </svg>

        {XI.map((p) => (
          <div
            key={p.name}
            className="absolute flex flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <Avatar name={p.name} highlight={p.highlight} size="pitch" />
            <span className="mt-1 text-[11px] sm:text-xs font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] whitespace-nowrap">
              {p.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={flag(p.iso)} alt="" className="h-2.5 w-auto rounded-[1px]" />
              <span className="text-[11px] font-black text-emerald-400 tabular-nums">{p.rating}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Substitutes */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-gray-900/60 p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em] text-purple-400">Substitutes</p>
        <div className="grid grid-cols-3 gap-3">
          {SUBS.map((s) => (
            <div key={s.name} className="flex flex-col items-center rounded-xl border border-white/5 bg-black/20 p-3">
              <Avatar name={s.name} size="sub" />
              <span className={`mt-2 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white ${s.posColor}`}>{s.positions}</span>
              <span className="mt-1 text-xs font-bold text-white whitespace-nowrap">{s.name}</span>
              <span className="mt-0.5 flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flag(s.iso)} alt="" className="h-2.5 w-auto rounded-[1px]" />
                <span className="text-[11px] font-black text-emerald-400 tabular-nums">{s.rating}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
