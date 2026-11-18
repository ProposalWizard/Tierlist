import type { TileId } from "./games";

/**
 * Drawn tile pictures for the home's game grid: one per game, each its own
 * colour and shape so a tile is known at a glance (Harry, 12 Nov 2026: a Friv
 * style grid of picture tiles). Pure SVG: no image files.
 */
const FONT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

export function Ball({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#fff" stroke="#11151c" strokeWidth="2.5" />
      <path d="M24 14.5l9 6.6-3.4 10.6H18.4L15 21.1z" fill="#11151c" />
      <path d="M24 14.5V3M33 21.1l10.4-3.6M29.6 31.7l6.6 9M18.4 31.7l-6.6 9M15 21.1L4.6 17.5" stroke="#11151c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Draft() {
  const card = (x: number, y: number, r: number, fill: string) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-27" y="-38" width="54" height="76" rx="7" fill={fill} stroke="#fff" strokeWidth="3" />
      <circle cx="0" cy="-10" r="11" fill="#1b1407" opacity=".85" />
      <path d="M-17 22c2-13 32-13 34 0v6h-34z" fill="#1b1407" opacity=".85" />
    </g>
  );
  return (
    <>
      <rect width="200" height="200" fill="#12813f" />
      {[0, 2, 4].map((i) => <rect key={i} x="0" y={i * 40} width="200" height="40" fill="#0f7438" />)}
      <circle cx="100" cy="100" r="46" fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="3" />
      <path d="M0 100h200" stroke="#ffffff" strokeOpacity=".55" strokeWidth="3" />
      {card(58, 108, -14, "#d8dde6")}
      {card(142, 108, 14, "#d99a5b")}
      {card(100, 96, 0, "#f6c945")}
    </>
  );
}

function TicTacToe() {
  const X = (cx: number, cy: number) => (
    <path d={`M${cx - 15} ${cy - 15}l30 30M${cx + 15} ${cy - 15}l-30 30`} stroke="#ff5d8f" strokeWidth="10" strokeLinecap="round" />
  );
  const O = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="15" fill="none" stroke="#ffd43b" strokeWidth="9" />;
  return (
    <>
      <rect width="200" height="200" fill="#4c1d95" />
      <path d="M78 26v148M122 26v148M26 78h148M26 122h148" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      {X(52, 52)}{O(100, 52)}{X(148, 100)}{O(52, 148)}{X(100, 100)}{O(148, 148)}
      <g transform="translate(82 130) scale(.75)">
        <circle cx="24" cy="24" r="22" fill="#fff" stroke="#11151c" strokeWidth="3" />
        <path d="M24 14.5l9 6.6-3.4 10.6H18.4L15 21.1z" fill="#11151c" />
      </g>
    </>
  );
}

function Tenable() {
  return (
    <>
      <rect width="200" height="200" fill="#c2410c" />
      <path d="M0 200L200 60v140z" fill="#9a3412" />
      <text x="16" y="118" fontFamily={FONT} fontWeight="900" fontSize="92" fill="#fff" letterSpacing="-4">10</text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x="128" y={30 + i * 25} width="58" height="17" rx="4" fill={i < 4 ? "#22c55e" : "#fff"} fillOpacity={i < 4 ? 1 : 0.28} />
          {i < 4 && <path d={`M135 ${39 + i * 25}l4 4 8-8`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />}
        </g>
      ))}
      <text x="18" y="160" fontFamily={FONT} fontWeight="900" fontSize="19" fill="#ffe8d6">ANSWERS</text>
    </>
  );
}

function Rankings() {
  const rows: [string, string][] = [["S", "#ff7f7f"], ["A", "#ffbf7f"], ["B", "#ffe97f"], ["C", "#9be37f"], ["D", "#7fbfff"]];
  const counts = [3, 4, 2, 3, 1];
  return (
    <>
      <rect width="200" height="200" fill="#161b26" />
      {rows.map(([l, c], i) => (
        <g key={l}>
          <rect x="14" y={14 + i * 35} width="172" height="31" rx="5" fill="#252c3b" />
          <rect x="14" y={14 + i * 35} width="36" height="31" rx="5" fill={c} />
          <text x="32" y={37 + i * 35} textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="20" fill="#161b26">{l}</text>
          {Array.from({ length: counts[i] }).map((_, k) => (
            <g key={k}>
              <rect x={57 + k * 30} y={17.5 + i * 35} width="24" height="24" rx="4" fill="#e5e9f2" />
              <circle cx={69 + k * 30} cy={26 + i * 35} r="4.5" fill="#5b6478" />
              <path d={`M${61 + k * 30} ${41.5 + i * 35}c1-9 15-9 16 0z`} fill="#5b6478" />
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

function Blind() {
  return (
    <>
      <rect width="200" height="200" fill="#0f766e" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="14" y={18 + i * 34} width="78" height="27" rx="6" fill={i === 1 || i === 3 ? "#fff" : "#fff"} fillOpacity={i === 1 || i === 3 ? 0.95 : 0.22} />
          <text x="26" y={38 + i * 34} fontFamily={FONT} fontWeight="900" fontSize="17" fill={i === 1 || i === 3 ? "#0f766e" : "#fff"}>{i + 1}</text>
          {(i === 1 || i === 3) && <rect x="44" y={27 + i * 34} width="38" height="9" rx="4.5" fill="#0f766e" opacity=".55" />}
        </g>
      ))}
      <g transform="rotate(8 146 100)">
        <rect x="110" y="48" width="72" height="104" rx="10" fill="#fde047" stroke="#fff" strokeWidth="4" />
        <text x="146" y="124" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="68" fill="#0b4f49">?</text>
      </g>
    </>
  );
}

const ART: Record<TileId, () => JSX.Element> = { draft: Draft, ttt: TicTacToe, tenable: Tenable, rankings: Rankings, blind: Blind };

export default function TileArt({ id, className }: { id: TileId; className?: string }) {
  const Art = ART[id];
  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden focusable="false">
      <Art />
    </svg>
  );
}
