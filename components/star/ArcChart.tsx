import type { CareerOverviewData } from "@/lib/star/careerOverview";

/**
 * Goals and assists, season by season (Mikey's playtest, 21 Oct 2026: "a very
 * good concept … but it doesn't look right … more like a proper realistic data
 * graphic"). Was one bar per season stretched to fill the width, so two
 * seasons made two huge blocks, coloured by club, with ages under them.
 *
 * Now: a pair of thin bars per season (goals amber, assists blue: checked
 * with the dataviz validator, 30 ΔE apart, 25 for colour-blind eyes), the
 * number on top of each, a 0 / half / top scale on the left, the season under
 * each pair, a legend, and the best season crowned. A season still being
 * played is lighter and says "so far". Hover (or a long press) on a pair
 * gives the season's numbers.
 */
const ARC_GOALS = "#f59e0b";
const ARC_ASSISTS = "#38bdf8";

/** A bar rounded at the top (radius up to 3) and square on the baseline. */
function topRounded(x: number, base: number, w: number, h: number): string {
  const r = Math.min(3, w / 2, h);
  const t = base - h;
  return `M${x},${base}V${t + r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + r}V${base}Z`;
}

export function ArcChart({ o }: { o: CareerOverviewData }) {
  const W = 340, H = 156, top = 28, bottom = 30, left = 22;
  const n = Math.max(1, o.arc.length);
  const max = Math.max(1, ...o.arc.map(a => Math.max(a.goals ?? 0, a.assists ?? 0)));
  // A tidy top for the scale: 5, 10, 20, 30, …
  const step = max <= 5 ? 5 : max <= 10 ? 10 : Math.ceil(max / 10) * 10;
  const plotW = W - left;
  const slot = plotW / n;
  const bar = Math.max(4, Math.min(16, slot * 0.3));
  const gap = 2;
  const base = H - bottom;
  const y = (v: number) => top + (base - top) * (1 - v / step);
  const peak = o.peak?.season;
  // Every value labelled while it fits; past 10 seasons, only the best.
  const labelAll = n <= 10;
  // Season labels: every one while they fit, else every other (first and last always).
  const every = slot >= 30 ? 1 : 2;
  const shortLabel = (l: string) => (l.length >= 7 ? `${l.slice(2, 4)}/${l.slice(-2)}` : l);
  return (
    <div>
      <div className="mb-1 flex items-center gap-3 text-[10px] font-black uppercase tracking-wider text-white/75">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ARC_GOALS }} />Goals</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ARC_ASSISTS }} />Assists</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Goals and assists by season">
        {[0, 0.5, 1].map(f => (
          <g key={f}>
            <line x1={left} x2={W} y1={y(step * f)} y2={y(step * f)} stroke={f === 0 ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.1)"} strokeDasharray={f === 0 ? undefined : "3 4"} />
            <text x={left - 4} y={y(step * f) + 3} textAnchor="end" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.6)">{Math.round(step * f)}</text>
          </g>
        ))}
        {o.arc.map((a, k) => {
          const cx = left + k * slot + slot / 2;
          const isPeak = a.season === peak;
          const op = a.live ? 0.5 : 1;
          const bars = [
            { v: a.goals, c: ARC_GOALS, x: cx - gap / 2 - bar },
            { v: a.assists, c: ARC_ASSISTS, x: cx + gap / 2 },
          ];
          const showLabels = labelAll || isPeak;
          return (
            <g key={a.season}>
              <title>{`${a.label}${a.live ? " (so far)" : ""}: ${a.goals ?? 0} goals, ${a.assists ?? 0} assists`}</title>
              {/* A hit area the width of the season, so hovering is easy. */}
              <rect x={left + k * slot} y={top} width={slot} height={base - top} fill="transparent" />
              {a.goals === undefined && a.assists === undefined ? (
                <text x={cx} y={base - 4} textAnchor="middle" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.45)">—</text>
              ) : bars.map((b, i) => {
                const v = b.v ?? 0;
                const h = Math.max(v > 0 ? 3 : 0, base - y(v));
                return (
                  <g key={i}>
                    {/* Rounded at the top only, square on the baseline. */}
                    {h > 0 && <path d={topRounded(b.x, base, bar, h)} fill={b.c} opacity={op} />}
                    {showLabels && <text x={b.x + bar / 2} y={base - h - 3} textAnchor="middle" fontSize="9" fontWeight="900" fill="rgba(255,255,255,.92)">{v}</text>}
                  </g>
                );
              })}
              {isPeak && <text x={cx} y={Math.max(11, y(Math.max(a.goals ?? 0, a.assists ?? 0)) - (showLabels ? 15 : 4))} textAnchor="middle" fontSize="10">👑</text>}
              {(k % every === 0 || k === n - 1) && (
                <text x={cx} y={base + 12} textAnchor="middle" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.75)">{shortLabel(a.label)}</text>
              )}
              {a.live && <text x={cx} y={base + 23} textAnchor="middle" fontSize="8" fontWeight="800" fill="rgba(255,255,255,.55)">so far</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
