import type { OwnedItem } from "@/lib/star/types";

/**
 * A REAL ICON PER LIFESTYLE ITEM — NOT ONE EMOJI PER CATEGORY.
 *
 * Reported directly: every single item in the shop's Item/Vehicle/Property
 * tabs showed the exact same phone/car/house emoji regardless of which of
 * the 31 items it actually was — "for private islands, you would make an
 * image for private island... instead of the house emoji." Asked for this
 * to go through Adobe; the Adobe connector failed to connect this session
 * (a live dial attempt returned a transport error, not a "not configured"
 * response — see the reply alongside this commit), so there is no path to
 * a generated/photographic image here today. This is the alternative that
 * needed no external tool at all: a real, hand-drawn glyph for every one
 * of the 31 items, following the exact same "no real asset, so draw one"
 * precedent every other visual system in this game already uses (club
 * crests as colour+initials, the match figures as procedural vector art) —
 * simple outlined pictograms rather than photorealistic art, but each one
 * distinct and actually depicting its own item, which is the concrete
 * thing that was broken.
 *
 * Swapping in a real photo later (once Adobe reconnects, or from any other
 * source) needs no redesign here — it's the exact same shape as
 * `KibCan.image` (shopData.ts): add an `image` field to `OwnedItem`, put a
 * file under /public/star/, and have Shop.tsx prefer it when present,
 * falling back to this component otherwise.
 */

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Glyph = () => JSX.Element;

// ── Items ────────────────────────────────────────────────────────────────

const Phone: Glyph = () => (
  <>
    <rect x="7" y="2" width="10" height="20" rx="2" {...stroke} />
    <line x1="10" y1="18.5" x2="14" y2="18.5" {...stroke} />
  </>
);

const Console: Glyph = () => (
  <>
    <rect x="2" y="8" width="20" height="10" rx="4" {...stroke} />
    <line x1="6.5" y1="11" x2="6.5" y2="15" {...stroke} />
    <line x1="4.5" y1="13" x2="8.5" y2="13" {...stroke} />
    <circle cx="16" cy="11.4" r="1" fill="currentColor" />
    <circle cx="18.6" cy="13" r="1" fill="currentColor" />
    <circle cx="16" cy="14.6" r="1" fill="currentColor" />
    <circle cx="13.4" cy="13" r="1" fill="currentColor" />
  </>
);

const Headphones: Glyph = () => (
  <>
    <path d="M4 15 v-3 a8 8 0 0 1 16 0 v3" {...stroke} />
    <rect x="2" y="14" width="4.4" height="7" rx="1.6" {...stroke} />
    <rect x="17.6" y="14" width="4.4" height="7" rx="1.6" {...stroke} />
  </>
);

const MusicPlayer: Glyph = () => (
  <>
    <rect x="7" y="2" width="10" height="17" rx="2" {...stroke} />
    <circle cx="12" cy="16.5" r="2.4" {...stroke} />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
  </>
);

const Tablet: Glyph = () => (
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" {...stroke} />
    <circle cx="12" cy="18.4" r="0.9" fill="currentColor" />
  </>
);

const Smartwatch: Glyph = () => (
  <>
    <path d="M9 6 L9 2.6 h6 L15 6" {...stroke} />
    <path d="M9 18 L9 21.4 h6 L15 18" {...stroke} />
    <rect x="7" y="6" width="10" height="12" rx="3" {...stroke} />
    <line x1="17" y1="10.3" x2="18.3" y2="10.3" {...stroke} />
  </>
);

const Tv: Glyph = () => (
  <>
    <rect x="2" y="4" width="20" height="13" rx="1.4" {...stroke} />
    <line x1="12" y1="17" x2="12" y2="20" {...stroke} />
    <line x1="7.5" y1="20.2" x2="16.5" y2="20.2" {...stroke} />
  </>
);

const GamingPc: Glyph = () => (
  <>
    <rect x="5" y="2" width="11" height="20" rx="1.4" {...stroke} />
    <circle cx="9.6" cy="5.2" r="0.9" fill="currentColor" />
    <line x1="7" y1="12" x2="13.6" y2="12" {...stroke} />
    <line x1="7" y1="15" x2="13.6" y2="15" {...stroke} />
    <line x1="18" y1="4" x2="18" y2="20" {...stroke} />
  </>
);

const Suit: Glyph = () => (
  <>
    <path d="M6 4 L9 2.2 L12 5 L15 2.2 L18 4 L20.4 9 L17 10.4 V22 H7 V10.4 L3.6 9 Z" {...stroke} />
    <path d="M10.6 4.4 L12 6.4 L13.4 4.4 L12.8 14 L12 17 L11.2 14 Z" {...stroke} />
  </>
);

const SilverChain: Glyph = () => (
  <>
    <path d="M4 6 Q6 9.4 8 6 Q10 9.4 12 6 Q14 9.4 16 6 Q18 9.4 20 6" {...stroke} />
    <path d="M4 6 Q6 2.6 8 6 Q10 2.6 12 6 Q14 2.6 16 6 Q18 2.6 20 6" {...stroke} />
  </>
);

const ArtPiece: Glyph = () => (
  <>
    <line x1="12" y1="1.4" x2="12" y2="3.4" {...stroke} />
    <rect x="3" y="3.4" width="18" height="16" rx="1" {...stroke} />
    <path d="M6 15.5 L9.5 10.5 L12.5 13.5 L15 10 L18.5 15.5 Z" {...stroke} />
    <circle cx="16.5" cy="7.5" r="1.5" {...stroke} />
  </>
);

const GoldWatch: Glyph = () => (
  <>
    <path d="M9.4 6 L9.4 3 h5.2 L14.6 6" {...stroke} />
    <path d="M9.4 18 L9.4 21 h5.2 L14.6 18" {...stroke} />
    <circle cx="12" cy="12" r="6.2" {...stroke} />
    <line x1="12" y1="12" x2="12" y2="8.4" {...stroke} />
    <line x1="12" y1="12" x2="14.6" y2="13.4" {...stroke} />
  </>
);

const DiamondNecklace: Glyph = () => (
  <>
    <path d="M3 5 Q12 12 21 5" {...stroke} />
    <path d="M12 12 L15 15.4 L12 21 L9 15.4 Z" {...stroke} />
    <line x1="9" y1="15.4" x2="15" y2="15.4" {...stroke} />
  </>
);

const DiamondRolex: Glyph = () => (
  <>
    <path d="M8.6 6.4 L8.6 2.6 h6.8 L15.4 6.4" {...stroke} />
    <path d="M8.6 17.6 L8.6 21.4 h6.8 L15.4 17.6" {...stroke} />
    <circle cx="12" cy="12" r="6.6" {...stroke} />
    {Array.from({ length: 12 }).map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const x1 = 12 + Math.sin(a) * 5.4, y1 = 12 - Math.cos(a) * 5.4;
      const x2 = 12 + Math.sin(a) * 6.6, y2 = 12 - Math.cos(a) * 6.6;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...stroke} strokeWidth={1} />;
    })}
    <line x1="12" y1="12" x2="12" y2="8.6" {...stroke} />
    <line x1="12" y1="12" x2="14.4" y2="13.2" {...stroke} />
    <path d="M12 4.4 L12.7 5.7 L12 7 L11.3 5.7 Z" fill="currentColor" stroke="none" />
  </>
);

// ── Vehicles ─────────────────────────────────────────────────────────────

function Wheels({ cx1, cx2, cy, r }: { cx1: number; cx2: number; cy: number; r: number }) {
  return (
    <>
      <circle cx={cx1} cy={cy} r={r} {...stroke} />
      <circle cx={cx2} cy={cy} r={r} {...stroke} />
    </>
  );
}

const Motorbike: Glyph = () => (
  <>
    <Wheels cx1={5.5} cx2={18.5} cy={18} r={3.4} />
    <path d="M5.5 18 L10 12 L14 12 L18.5 18" {...stroke} />
    <path d="M14 12 L16.4 8" {...stroke} />
    <path d="M10 12 L8.4 8.6" {...stroke} />
    <rect x="9.4" y="9.6" width="3" height="2.6" rx="0.6" {...stroke} />
  </>
);

const SedanCar: Glyph = () => (
  <>
    <path d="M2 16 L3.4 11.4 Q4.4 9.8 6.4 9.8 H16.8 Q18.4 9.8 19.2 11.2 L21 16 Z" {...stroke} />
    <path d="M7 9.8 L8.4 6.4 H14.6 L16.8 9.8" {...stroke} />
    <Wheels cx1={6.6} cx2={17.4} cy={16.6} r={2.4} />
  </>
);

const Hatchback: Glyph = () => (
  <>
    <path d="M2 16 L3.4 11.6 Q4.4 10 6.4 10 H15 Q17 10 17.6 11.2 L18.6 16 H21 L20.2 16 Z" {...stroke} />
    <path d="M7 10 L8.4 6.8 H13.4 L15 10" {...stroke} />
    <line x1="18.6" y1="16" x2="21" y2="16" {...stroke} />
    <Wheels cx1={6.4} cx2={16.8} cy={16.6} r={2.4} />
  </>
);

const Suv: Glyph = () => (
  <>
    <path d="M2 16.4 L3 9.4 Q3.6 8 5.4 8 H18 Q19.8 8 20.4 9.6 L21.4 16.4 Z" {...stroke} />
    <line x1="3" y1="9.4" x2="20.4" y2="9.6" {...stroke} />
    <line x1="6" y1="6.6" x2="10" y2="6.6" {...stroke} />
    <line x1="13" y1="6.6" x2="17" y2="6.6" {...stroke} />
    <Wheels cx1={6.4} cx2={17.6} cy={17} r={2.8} />
  </>
);

const SportsCar: Glyph = () => (
  <>
    <path d="M1.5 16.4 Q4 12.4 8 11.6 Q13 10.4 18.6 12 Q21 12.6 22 16.4 Z" {...stroke} />
    <path d="M8 11.6 Q10.4 9 13.6 9.6 Q16 10 17.6 12" {...stroke} />
    <rect x="18.4" y="10.4" width="2.6" height="1.2" rx="0.3" {...stroke} />
    <Wheels cx1={5.6} cx2={18} cy={17} r={2.6} />
  </>
);

const ClassicCar: Glyph = () => (
  <>
    <path d="M2 15.6 Q3 9.4 8.4 9.4 H14 Q16 9.4 16.8 11 L19.6 11.4 Q21.6 11.6 21.6 13.6 V15.6 Z" {...stroke} />
    <path d="M9.4 9.4 L10.2 6.4 H13.8 L14.6 9.4" {...stroke} />
    <circle cx="4.6" cy="15.6" r="0.7" fill="currentColor" />
    <Wheels cx1={6.2} cx2={18} cy={16.6} r={3} />
  </>
);

const Supercar: Glyph = () => (
  <>
    <path d="M1.4 16.6 Q3.6 11.8 8 11 L17.4 10.6 Q20.6 10.8 22.2 16.6 Z" {...stroke} />
    <path d="M8 11 L11.6 7.4 L16 8 L17.4 10.6" {...stroke} />
    <path d="M15 8.4 L15.6 6.4 M18.4 8.4 L19 6.4" {...stroke} />
    <Wheels cx1={5.6} cx2={18.2} cy={17} r={2.6} />
  </>
);

const PrivateJet: Glyph = () => (
  <>
    <path d="M1.5 12.2 Q9 10.6 12 10.6 Q15 10.6 22.5 12.2 Q15 13.4 12 13.4 Q9 13.4 1.5 12.2 Z" {...stroke} />
    <path d="M9.4 11.6 L4 7.4 L6.6 7.4 L11.4 11" {...stroke} />
    <path d="M9.4 13.2 L4 17.4 L6.6 17.4 L11.4 13.8" {...stroke} />
    <path d="M17.4 11 L20.4 8.6 L19 11" {...stroke} />
    <circle cx="8.6" cy="12.2" r="0.6" fill="currentColor" />
  </>
);

// ── Properties ───────────────────────────────────────────────────────────

const StudioFlat: Glyph = () => (
  <>
    <rect x="6" y="7" width="12" height="15" rx="0.6" {...stroke} />
    <line x1="6" y1="7" x2="18" y2="7" {...stroke} />
    <rect x="9.4" y="10.4" width="3" height="3" {...stroke} />
    <rect x="10.4" y="17.4" width="3.2" height="4.6" {...stroke} />
  </>
);

const CityApartment: Glyph = () => (
  <>
    <rect x="5" y="2" width="14" height="20" rx="0.6" {...stroke} />
    {[5.4, 9.4, 13.4].map((y) => (
      <g key={y}>
        <rect x="7.6" y={y} width="2.6" height="2.6" {...stroke} />
        <rect x="13.8" y={y} width="2.6" height="2.6" {...stroke} />
      </g>
    ))}
    <rect x="10.4" y="18.4" width="3.2" height="3.6" {...stroke} />
  </>
);

const Penthouse: Glyph = () => (
  <>
    <rect x="5" y="10" width="14" height="12" rx="0.6" {...stroke} />
    <rect x="8" y="13.4" width="3" height="3" {...stroke} />
    <rect x="13" y="13.4" width="3" height="3" {...stroke} />
    <path d="M6.4 9.2 V4.6 H17.6 V9.2" {...stroke} />
    <line x1="8.4" y1="4.6" x2="8.4" y2="9.2" {...stroke} />
    <line x1="12" y1="4.6" x2="12" y2="9.2" {...stroke} />
    <line x1="15.6" y1="4.6" x2="15.6" y2="9.2" {...stroke} />
  </>
);

const HorseStable: Glyph = () => (
  <>
    <path d="M3 11.4 L12 5 L21 11.4 V21.4 H3 Z" {...stroke} />
    <path d="M9.2 21.4 V14.6 Q9.2 12.4 12 12.4 Q14.8 12.4 14.8 14.6 V21.4" {...stroke} />
    <path d="M10 7.4 A2 2 0 1 0 14 7.4" {...stroke} strokeWidth={1.2} />
  </>
);

const SuburbanHouse: Glyph = () => (
  <>
    <path d="M2.6 11.6 L12 3.4 L21.4 11.6" {...stroke} />
    <path d="M5 10.2 V21 H19 V10.2" {...stroke} />
    <rect x="10.2" y="14.6" width="3.6" height="6.4" {...stroke} />
    <rect x="7" y="13" width="2.6" height="2.6" {...stroke} />
  </>
);

const BeachVilla: Glyph = () => (
  <>
    <path d="M2 22 Q2.4 18.6 5.4 18.4 Q5 15 8.4 13.6 Q8 10.2 11 8" {...stroke} strokeWidth={1.3} />
    <path d="M8.6 10.4 L8 12.4 L10.2 11.6 Z" fill="currentColor" stroke="none" />
    <path d="M9.4 9.6 L7.4 10 L9 11.6 Z" fill="currentColor" stroke="none" />
    <path d="M13.6 14.2 H22 L20.6 18.4 H15 Z" {...stroke} />
    <rect x="15.6" y="18.4" width="5.8" height="3.6" {...stroke} />
    <rect x="17.4" y="19.4" width="2" height="2.6" {...stroke} />
  </>
);

const Mansion: Glyph = () => (
  <>
    <path d="M2.6 12 L7 7.6 L11.4 12" {...stroke} />
    <path d="M12.6 12 L17 7.6 L21.4 12" {...stroke} />
    <path d="M4 10.8 V21.4 H20 V10.8" {...stroke} />
    <rect x="10" y="14.6" width="4" height="6.8" {...stroke} />
    <line x1="7" y1="14.6" x2="7" y2="21.4" {...stroke} strokeWidth={1.2} />
    <line x1="17" y1="14.6" x2="17" y2="21.4" {...stroke} strokeWidth={1.2} />
  </>
);

const CountryEstate: Glyph = () => (
  <>
    <path d="M4 12.4 L11.6 6 L19.2 12.4" {...stroke} />
    <path d="M6 11 V21 H17.6 V11" {...stroke} />
    <rect x="10.6" y="14.8" width="3.4" height="6.2" {...stroke} />
    <path d="M18.6 17 Q20.2 15 21.8 17 Q20.6 15.6 21.8 14.4" {...stroke} strokeWidth={1.2} />
    <path d="M1.4 21.4 h5.2 M15.4 21.4 h7.2" {...stroke} strokeWidth={1.3} />
  </>
);

const PrivateIsland: Glyph = () => (
  <>
    <path d="M3 17.4 Q7 15.6 11 17 Q15.4 18.6 21 17" {...stroke} strokeWidth={1.3} />
    <path d="M2 20.2 Q7 18.6 12 20 Q16.4 21.2 22 19.8" {...stroke} strokeWidth={1.3} />
    <path d="M6.6 17.2 Q7 12.8 12.6 12 Q17.4 11.4 18 15.4 Q17 17.8 12.4 17.6 Q9 17.4 6.6 17.2 Z" {...stroke} />
    <path d="M11.4 12.2 V4.4" {...stroke} strokeWidth={1.3} />
    <path d="M11.4 5 Q8.4 4.6 7.4 7.4 Q10.2 7.4 11.4 5 Z" fill="currentColor" stroke="none" />
    <path d="M11.4 7 Q14.8 6 15.4 9.2 Q12.4 9 11.4 7 Z" fill="currentColor" stroke="none" />
  </>
);

const ICONS: Record<string, Glyph> = {
  phone: Phone,
  console: Console,
  headphones: Headphones,
  music: MusicPlayer,
  tablet: Tablet,
  smartwatch: Smartwatch,
  tv: Tv,
  "gaming-pc": GamingPc,
  suit: Suit,
  silver: SilverChain,
  art: ArtPiece,
  gold: GoldWatch,
  diamond: DiamondNecklace,
  rolex: DiamondRolex,

  bike: Motorbike,
  "car-1": SedanCar,
  "car-2": Hatchback,
  suv: Suv,
  "car-3": SportsCar,
  classic: ClassicCar,
  "car-4": Supercar,
  jet: PrivateJet,

  "flat-1": StudioFlat,
  "flat-2": CityApartment,
  penthouse: Penthouse,
  stable: HorseStable,
  "house-1": SuburbanHouse,
  villa: BeachVilla,
  "house-2": Mansion,
  estate: CountryEstate,
  island: PrivateIsland,
};

/** Per-category background so the badge still reads at a glance which tab
 *  an item belongs to, even before the glyph itself is read. */
const CATEGORY_BG: Record<OwnedItem["category"], string> = {
  item: "bg-gradient-to-br from-sky-600 to-sky-800",
  vehicle: "bg-gradient-to-br from-rose-600 to-rose-800",
  property: "bg-gradient-to-br from-amber-600 to-amber-800",
};

export default function LifestyleIcon({ id, category }: { id: string; category: OwnedItem["category"] }) {
  const Icon = ICONS[id];
  return (
    <div className={`w-10 h-10 shrink-0 rounded flex items-center justify-center text-white ${CATEGORY_BG[category]}`}>
      <svg width="26" height="26" viewBox="0 0 24 24">
        {Icon ? <Icon /> : <circle cx="12" cy="12" r="7" {...stroke} />}
      </svg>
    </div>
  );
}
