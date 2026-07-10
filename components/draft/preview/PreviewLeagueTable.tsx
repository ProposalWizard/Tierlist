// PREVIEW COMPONENT — sample data only, not wired into the real game.
// A redesigned Premier League table with neon framing, qualification-zone
// accents and a highlighted champion row.

interface Row {
  pos: number;
  club: string;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
}

// Sample season table (your club highlighted at the top).
const TABLE: Row[] = [
  { pos: 1,  club: "Mikerz FC",       w: 26, d: 4,  l: 8,  gd: 51,  pts: 82 },
  { pos: 2,  club: "Man City",        w: 25, d: 6,  l: 7,  gd: 48,  pts: 81 },
  { pos: 3,  club: "Liverpool",       w: 24, d: 5,  l: 9,  gd: 38,  pts: 77 },
  { pos: 4,  club: "KnowItBaller FC", w: 24, d: 5,  l: 9,  gd: 36,  pts: 77 },
  { pos: 5,  club: "Leo FC",          w: 23, d: 5,  l: 10, gd: 22,  pts: 74 },
  { pos: 6,  club: "Aston Villa",     w: 20, d: 2,  l: 16, gd: 7,   pts: 62 },
  { pos: 7,  club: "Chelsea",         w: 17, d: 10, l: 11, gd: 15,  pts: 61 },
  { pos: 8,  club: "Newcastle",       w: 17, d: 8,  l: 13, gd: 0,   pts: 59 },
  { pos: 9,  club: "Arsenal",         w: 15, d: 11, l: 12, gd: 15,  pts: 56 },
  { pos: 10, club: "Man United",      w: 17, d: 5,  l: 16, gd: 14,  pts: 56 },
  { pos: 11, club: "Brighton",        w: 16, d: 7,  l: 15, gd: 6,   pts: 55 },
  { pos: 12, club: "Tottenham",       w: 15, d: 10, l: 13, gd: -5,  pts: 55 },
  { pos: 13, club: "Brentford",       w: 12, d: 10, l: 16, gd: -13, pts: 46 },
  { pos: 14, club: "Hamuko29 FC",     w: 11, d: 7,  l: 20, gd: -9,  pts: 40 },
  { pos: 15, club: "Everton",         w: 9,  d: 12, l: 17, gd: -24, pts: 39 },
  { pos: 16, club: "Swansea",         w: 10, d: 6,  l: 22, gd: -44, pts: 36 },
  { pos: 17, club: "Southampton",     w: 10, d: 5,  l: 23, gd: -21, pts: 35 },
  { pos: 18, club: "Leeds",           w: 8,  d: 6,  l: 24, gd: -31, pts: 30 },
  { pos: 19, club: "Wolves",          w: 5,  d: 9,  l: 24, gd: -48, pts: 24 },
  { pos: 20, club: "Norwich",         w: 4,  d: 7,  l: 27, gd: -55, pts: 19 },
];

const YOUR_CLUB = "Mikerz FC";

type Zone = "champion" | "ucl" | "uel" | "releg" | "mid";

function zoneOf(pos: number): Zone {
  if (pos === 1) return "champion";
  if (pos <= 5) return "ucl";
  if (pos <= 7) return "uel";
  if (pos >= 18) return "releg";
  return "mid";
}

const EDGE: Record<Zone, string> = {
  champion: "bg-amber-400",
  ucl: "bg-blue-500",
  uel: "bg-emerald-500",
  releg: "bg-red-500",
  mid: "bg-transparent",
};

const BADGE: Record<Zone, string> = {
  champion: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40",
  ucl: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40",
  uel: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40",
  releg: "bg-red-500/15 text-red-300 ring-1 ring-red-500/40",
  mid: "bg-white/5 text-white/70",
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-[11px] font-semibold text-white/70 whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function PreviewLeagueTable() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Gradient-border frame + outer neon glow */}
      <div className="rounded-[26px] bg-gradient-to-br from-teal-400/50 via-white/5 to-amber-400/40 p-[1.5px] shadow-[0_0_50px_-12px_rgba(45,212,191,0.45),0_25px_60px_-25px_rgba(251,191,36,0.35)]">
        <div className="rounded-[25px] bg-[#0a0f1c] p-4 sm:p-5">
          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-1">
            <LegendDot color="bg-amber-400" label="Champion" />
            <LegendDot color="bg-blue-500" label="Champions League" />
            <LegendDot color="bg-emerald-500" label="Europa League" />
            <LegendDot color="bg-red-500" label="Relegation" />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/20">
            {/* Header */}
            <div className="grid grid-cols-[2.5rem_1fr_2rem_2rem_2rem_3rem_3rem] items-center gap-1 border-b border-white/10 px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-white/50">
              <div className="text-center">#</div>
              <div>Club</div>
              <div className="text-center">W</div>
              <div className="text-center">D</div>
              <div className="text-center">L</div>
              <div className="text-center">GD</div>
              <div className="text-center">PTS</div>
            </div>

            {TABLE.map((r) => {
              const zone = zoneOf(r.pos);
              const isYou = r.club === YOUR_CLUB;
              return (
                <div key={r.pos} className="relative">
                  {/* Zone edge */}
                  <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${EDGE[zone]}`} />
                  <div
                    className={`grid grid-cols-[2.5rem_1fr_2rem_2rem_2rem_3rem_3rem] items-center gap-1 px-3 py-3 transition-colors ${
                      isYou
                        ? "bg-gradient-to-r from-amber-400/20 via-amber-400/[0.06] to-transparent ring-1 ring-inset ring-amber-400/50"
                        : "border-b border-white/5 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex justify-center">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black tabular-nums ${BADGE[zone]}`}>
                        {r.pos}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <span className={`truncate text-[15px] font-bold ${isYou ? "text-emerald-400" : "text-white"}`}>
                        {r.club}
                      </span>
                      {r.pos === 1 && <span className="text-sm">🏆</span>}
                    </div>
                    <div className="text-center text-sm font-semibold tabular-nums text-white/80">{r.w}</div>
                    <div className="text-center text-sm font-semibold tabular-nums text-white/80">{r.d}</div>
                    <div className="text-center text-sm font-semibold tabular-nums text-white/80">{r.l}</div>
                    <div className={`text-center text-sm font-bold tabular-nums ${r.gd > 0 ? "text-emerald-400" : r.gd < 0 ? "text-red-400" : "text-white/70"}`}>
                      {r.gd > 0 ? `+${r.gd}` : r.gd}
                    </div>
                    <div className={`text-center text-base font-black tabular-nums ${isYou ? "text-amber-300" : "text-white"}`}>
                      {r.pts}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
