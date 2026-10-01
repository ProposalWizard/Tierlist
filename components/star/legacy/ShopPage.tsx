"use client";

/**
 * THE RIGHT SWIPE PAGE — shops and the casino.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "stats/records left -
 * shops/casino right". Big tiles into the real screens; what you already own
 * sits underneath (ShopItemsCard, moved here from the Stats page).
 *
 * Reskinned in the home screen's look (28 Sep 2026): your money counts like
 * Home's, the Store and Casino are lit hero cards with a sweep of light, the
 * four smaller shops are glass tiles with glowing icons, and every tile
 * presses in. Everything rises in each time the page is swiped to.
 */
import type { CareerState } from "@/lib/star/types";
import ShopItemsCard from "@/components/star/legacy/ShopItemsCard";
import { formatMoney } from "@/lib/star/money";
import type { HubPhase } from "@/components/star/legacy/HomeHub";
import { ClubCard, CountUp, RiseIn, Glow, Shine, useClubTheme, rgba, tint } from "@/components/star/legacy/ui";

const TILES: { ph: HubPhase; icon: string; label: string; sub: string; color: string }[] = [
  { ph: "shop-kib", icon: "🥤", label: "KIB Cans", sub: "Energy and boot boosts", color: "#fb923c" },
  { ph: "shop-boots", icon: "👟", label: "Boots", sub: "Power, technique, curl", color: "#38bdf8" },
  { ph: "shop-lifestyle", icon: "💎", label: "Style", sub: "Cars, houses, drip", color: "#e879f9" },
  { ph: "sponsors", icon: "🤝", label: "Sponsors", sub: "Deals and objectives", color: "#34d399" },
];

export default function ShopPage({ career, onOpen }: { career: CareerState; onOpen: (ph: HubPhase) => void }) {
  const { glow } = useClubTheme(career);
  return (
    <div className="space-y-2.5 pb-3">
      <RiseIn onPageActive index={0}>
        <ClubCard glow={glow} className="flex items-center justify-between rounded-2xl px-3 py-2.5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Your money</div>
            <div className="text-[10.5px] font-bold text-white/55">
              <span className="text-amber-200">{(career.coins ?? 0).toLocaleString("en-GB")}</span> Coins
            </div>
          </div>
          <div className="text-[24px] font-black tabular-nums text-yellow-200" style={{ textShadow: "0 0 14px rgba(253,224,71,.45), 0 2px 6px rgba(0,0,0,.6)" }}>
            ★ <CountUp value={career.money} ms={900} format={(n) => formatMoney(Math.round(n))} />
          </div>
        </ClubCard>
      </RiseIn>
      <RiseIn onPageActive index={1}>
        <Hero
          onClick={() => onOpen("store")}
          icon="🛒"
          title="Store"
          sub="Daily specials, run-ups, accessories, boosts, Coins"
          chip={`${(career.coins ?? 0).toLocaleString("en-GB")} Coins · Open →`}
          colors={["#fbbf24", "#7c3aed"]}
        />
      </RiseIn>
      <RiseIn onPageActive index={2}>
        <Hero
          onClick={() => onOpen("casino-menu")}
          icon="🎰"
          title="Casino"
          sub="Slots, blackjack, horse racing, bets on the season"
          chip="Open →"
          colors={["#facc15", "#dc2626"]}
        />
      </RiseIn>
      <RiseIn onPageActive index={3}>
        <div className="grid grid-cols-2 gap-2">
          {TILES.map((t) => (
            <button
              key={t.ph}
              onClick={() => onOpen(t.ph)}
              className="kib-press relative overflow-hidden rounded-2xl p-3 text-left"
              style={{
                background: `radial-gradient(90% 80% at 0% 0%, ${rgba(t.color, 0.34)} 0%, transparent 65%), linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96))`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(t.color, 0.3)}, 0 10px 22px -12px ${rgba(t.color, 0.6)}`,
              }}
            >
              <span
                className="relative grid h-10 w-10 place-items-center rounded-xl text-[22px]"
                style={{ background: `linear-gradient(160deg, ${tint(t.color, 0.25)}, ${tint(t.color, -0.35)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.45), 0 6px 12px -4px ${rgba(t.color, 0.7)}` }}
              >
                {t.icon}
              </span>
              <div className="mt-1.5 text-[14px] font-black text-white">{t.label}</div>
              <div className="text-[10px] font-bold text-white/65">{t.sub}</div>
            </button>
          ))}
        </div>
      </RiseIn>
      {/* "Your shop items" lives here only — it was on Home too (Mikey,
          28 Sep 2026). */}
      <RiseIn onPageActive index={4}>
        <ShopItemsCard career={career} onOpenShop={() => onOpen("shop-kib")} glow={glow} />
      </RiseIn>
    </div>
  );
}

/** A big lit tile — the Store and the Casino. */
function Hero({ onClick, icon, title, sub, chip, colors }: {
  onClick: () => void; icon: string; title: string; sub: string; chip: string; colors: [string, string];
}) {
  const [a, b] = colors;
  return (
    <button
      onClick={onClick}
      className="kib-press relative block w-full overflow-hidden rounded-2xl p-4 text-left"
      style={{
        background: `radial-gradient(80% 120% at 0% 0%, ${rgba(a, 0.5)} 0%, transparent 60%), radial-gradient(70% 120% at 100% 100%, ${rgba(b, 0.45)} 0%, transparent 60%), linear-gradient(180deg, #172033, #0a0f1a)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px ${rgba(a, 0.4)}, 0 14px 28px -14px ${rgba(b, 0.8)}, 0 2px 6px rgba(0,0,0,.35)`,
      }}
    >
      <Shine loop every={5} />
      <div className="relative flex items-center gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center">
          <Glow color={a} alpha={0.55} pulse className="inset-0 blur-lg" />
          <span className="relative text-[38px] leading-none" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.5))" }}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[22px] font-black uppercase leading-none tracking-wide text-white" style={{ textShadow: `0 2px 10px ${rgba(b, 0.7)}` }}>{title}</div>
          <div className="mt-1 text-[11px] font-bold leading-snug text-white/75">{sub}</div>
        </div>
      </div>
      <div className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black text-amber-200 ring-1 ring-white/10">
        {chip}
      </div>
    </button>
  );
}

