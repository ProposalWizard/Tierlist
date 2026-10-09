"use client";

/**
 * THE SHOP PAGE (Home's right swipe), New look. There is no front page any
 * more: swiping or tapping to this page opens the Showroom straight away
 * (app/star-dev/page.tsx's SwipePages onIndex). Harry, 9 Oct 2026: the
 * framed-card grid ("KNOWITBALL STORE", four framed doors) was "horrendous";
 * "showroom swipe + feed" is the shop. Sponsors, Casino, the Store and the 3D
 * shop are small doors at the end of the Showroom's category rail.
 *
 * So this page is only what you see WHILE you swipe across to the shop: the
 * shop window — your boots lit up on the dark showroom wall, the category
 * icons underneath. Tapping it opens the Showroom too. The Old look still uses
 * ShopPage.tsx.
 */
import type { CareerState } from "@/lib/star/types";
import { baseIdOf } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import type { HubPhase } from "../HomeHub";
import { art } from "./parts";
// Not imported from ShowroomShop: that screen is lazy-loaded; this page is not.
const ICONS = ["cans", "boots", "drip", "gadgets", "cars", "homes", "holiday"];

export default function StoreLanding({ career, onOpen }: { career: CareerState; onOpen: (ph: HubPhase) => void; sponsorsLock?: string }) {
  const boot = career.currentBoot;
  const lv = Math.max(1, Math.min(5, boot.level ?? 1));
  return (
    <button type="button" onClick={() => onOpen("shop-kib")} data-store-landing data-tour="shop-style"
      className="relative block h-[calc(100dvh-170px)] min-h-[420px] w-full overflow-hidden text-left">
      <div aria-hidden className="absolute inset-[-20px]" style={{ background: `url(${art("wall")}) center 40% / cover`, filter: "blur(10px) brightness(.42) saturate(.8)" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(70% 45% at 50% 42%, rgba(255,255,255,.14), transparent 70%), linear-gradient(180deg, rgba(5,8,15,.3), rgba(5,8,15,.9) 85%)" }} />
      <div className="relative flex h-full flex-col items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/star/shop2d/items/boot-${baseIdOf(boot)}-L${lv}.webp`} alt="" draggable={false} className="w-full max-w-[420px] select-none object-contain" />
        <div className="mt-2 text-[34px] font-black uppercase leading-none text-white">Shop</div>
        <div className="mt-1 text-[13px] font-black tabular-nums text-amber-300">★{formatMoney(career.money)}</div>
        <div className="mt-4 flex gap-2">
          {ICONS.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c} src={art(`icon-${c}`)} alt="" className="h-7 w-7" draggable={false} />
          ))}
        </div>
      </div>
    </button>
  );
}
