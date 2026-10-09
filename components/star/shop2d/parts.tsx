"use client";

/**
 * THE NEW 2D SHOP — shared pieces: the art, the framed card, the level ladder,
 * the confirm sheet and the purchase moment.
 *
 * Harry, 9 Oct 2026: "completely rebuild the shop ui too because right now it
 * sucks (use higgs for this) … I meant higgs for the UI." Every piece of store
 * dressing (the hero banner, the tab icons, the five card frames, the rank
 * emblems on the ladder, the badges, the burst and the effect glows) is
 * Higgsfield art in public/star/shop2d/ (credits: LICENSE.txt there, packed by
 * tools/shop2d/pack.py). The item pictures are the existing ones
 * (StylePicture, BootPicture, KibCanIcon) — "I don't need new items".
 */
import { useEffect, useState } from "react";
import type React from "react";
import { formatMoney } from "@/lib/star/money";
import { SHOP_TIERS } from "@/lib/star/economy";
import { useCountUp, FloatText, Pop } from "../ui";

export const ART = "/star/shop2d";
export const art = (name: string) => `${ART}/${name}.webp`;

/** Each level's colour: the frame and emblem match (bronze, sapphire, ruby, amethyst, gold). */
export const TIER_COLOUR = ["#c08457", "#60a5fa", "#f87171", "#c084fc", "#fbbf24"] as const;
export const tierColour = (lv: number) => TIER_COLOUR[Math.max(1, Math.min(5, lv)) - 1];
/** The money rung a level is priced for: Starter … World Class. */
export const rungName = (lv: number) => SHOP_TIERS[Math.max(1, Math.min(5, lv)) - 1]?.label ?? `Level ${lv}`;

/** The page behind the store: the hex texture, dark. */
export function StoreBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[#070b16]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: `url(${art("bg")})`, backgroundSize: "420px auto", backgroundRepeat: "repeat" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(251,191,36,.10), transparent 70%), linear-gradient(180deg, rgba(7,11,22,0) 40%, rgba(7,11,22,.9))" }} />
    </div>
  );
}

/** The hero: the boutique banner, the page name and your balance (counts down when you spend). */
export function StoreHero({ title, sub, money, spent, spentText, right }: {
  title: string; sub: string; money: number; spent: number; spentText: string; right?: React.ReactNode;
}) {
  const shown = useCountUp(money, 800);
  return (
    <div data-store-hero className="relative -mx-4 h-[124px] overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: `url(${art("hero")})`, backgroundSize: "cover", backgroundPosition: "center 40%" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,8,16,.92) 0%, rgba(5,8,16,.45) 55%, rgba(5,8,16,.75) 100%), linear-gradient(180deg, transparent 55%, #070b16 100%)" }} />
      <div className="relative flex h-full items-end justify-between gap-3 px-4 pb-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300/90">Store</div>
          <div className="truncate text-[30px] font-black uppercase leading-[0.95] text-white" style={{ textShadow: "0 3px 14px rgba(0,0,0,.8), 0 0 22px rgba(251,191,36,.35)" }}>{title}</div>
          <div className="mt-1 truncate text-[11.5px] font-bold text-white/80">{sub}</div>
        </div>
        <div className="relative shrink-0 text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Balance</div>
          <div data-store-balance className="flex items-center justify-end gap-1 text-[24px] font-black leading-none tabular-nums text-yellow-300" style={{ textShadow: "0 2px 10px rgba(0,0,0,.8), 0 0 16px rgba(250,204,21,.45)" }}>
            <span className="text-[18px]">★</span><Pop value={spent}>{formatMoney(Math.round(shown))}</Pop>
          </div>
          <FloatText trigger={spent} text={spentText} color="#fca5a5" className="right-0 top-[105%]" size={15} />
          {right && <div className="mt-1.5 flex justify-end">{right}</div>}
        </div>
      </div>
    </div>
  );
}

/** The three shop tabs with their icons. */
export type StoreTab = "kib" | "boots" | "lifestyle";
const TABS: { id: StoreTab; label: string; icon: string }[] = [
  { id: "kib", label: "Cans", icon: "icon-cans" },
  { id: "boots", label: "Boots", icon: "icon-boots" },
  { id: "lifestyle", label: "Style", icon: "icon-style" },
];
export function StoreTabs({ tab, onTab }: { tab: StoreTab; onTab: (t: StoreTab) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="tablist" data-store-tabs>
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            data-store-tab={t.id}
            onClick={() => onTab(t.id)}
            className="kib-press relative flex h-[50px] items-center justify-center gap-1.5 overflow-hidden rounded-[4px]"
            style={{
              background: on ? "linear-gradient(180deg, rgba(251,191,36,.28), rgba(120,53,15,.35))" : "rgba(255,255,255,.04)",
              boxShadow: on ? "inset 0 0 0 1.5px rgba(253,224,71,.85), 0 6px 18px -8px rgba(251,191,36,.8)" : "inset 0 0 0 1px rgba(255,255,255,.1)",
            }}
          >
            <img src={art(t.icon)} alt="" className={`h-[34px] w-[34px] ${on ? "" : "opacity-70 saturate-50"}`} />
            <span className={`text-[14px] font-black uppercase tracking-wide ${on ? "text-white" : "text-white/70"}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A section title on the gold divider. */
export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="relative mb-2 mt-4">
      <img src={art("divider")} alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-full -translate-x-1/2 -translate-y-1/2 object-cover opacity-80" />
      <div className="relative flex items-center justify-between">
        <span className="bg-[#070b16] pr-2 text-[13px] font-black uppercase tracking-[0.18em] text-amber-200">{children}</span>
        {note && <span className="bg-[#070b16] pl-2 text-[10.5px] font-bold text-white/70">{note}</span>}
      </div>
    </div>
  );
}

/** A small text badge on a Higgsfield tag. */
export function Tag({ kind, children, className = "" }: { kind: "green" | "blue" | "gold" | "red" | "violet"; children: React.ReactNode; className?: string }) {
  if (kind === "gold") {
    return (
      <span className={`relative inline-grid h-[30px] w-[30px] place-items-center ${className}`}>
        <img src={art("badge-gold")} alt="" className="absolute inset-0 h-full w-full" />
        <span className="relative -mt-1 text-[11px] font-black text-amber-950">{children}</span>
      </span>
    );
  }
  const bg = kind === "green" ? "badge-green" : kind === "blue" ? "badge-blue" : null;
  const flat = kind === "red" ? "linear-gradient(180deg,#ef4444,#991b1b)" : "linear-gradient(180deg,#c084fc,#7e22ce)";
  return (
    <span
      className={`inline-flex h-[18px] items-center whitespace-nowrap pl-2.5 pr-1.5 text-[9.5px] font-black uppercase leading-none tracking-wide text-white ${className}`}
      style={bg
        ? { backgroundImage: `url(${art(bg)})`, backgroundSize: "100% 100%", textShadow: "0 1px 2px rgba(0,0,0,.6)" }
        : { background: flat, borderRadius: 3, paddingLeft: 6, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}
    >
      {children}
    </span>
  );
}

/** A card in its level's frame, the item's picture in the window. */
export function FramedCard({ level, children, glow, dim = false, className = "" }: {
  level: number; children: React.ReactNode; glow?: string; dim?: boolean; className?: string;
}) {
  const lv = Math.max(1, Math.min(5, level));
  return (
    <div className={`relative aspect-[3/4] w-full ${className}`}>
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: `url(${art(`frame-${lv}`)})`, backgroundSize: "100% 100%", filter: dim ? "grayscale(1) brightness(.6)" : undefined }} />
      {glow && <div aria-hidden className="absolute inset-[16%] rounded-full blur-xl" style={{ background: glow, opacity: 0.35 }} />}
      <div className="absolute inset-[9%_8%] flex items-center justify-center">{children}</div>
    </div>
  );
}

/** The price strip under a card. */
export function PriceLine({ price, can, label }: { price: number | null; can: boolean; label?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1 text-[12.5px] font-black tabular-nums ${can ? "text-yellow-300" : "text-white/55"}`}>
      {label && <span className="text-[9.5px] font-black uppercase tracking-wide text-white/70">{label}</span>}
      {price === null ? <span className="text-emerald-300">MAXED</span> : <>★{formatMoney(price)}</>}
    </div>
  );
}

// ── The level ladder ────────────────────────────────────────────────────

export interface Rung { level: number; price: number; owned?: boolean; sold?: boolean }

/**
 * THE LEVEL LADDER — five emblems on one line, bronze to gold. The one you
 * own has a tick, the one you are looking at is lit; tap one to look at it.
 */
export function LevelLadder({ rungs, selected, onPick }: { rungs: Rung[]; selected: number; onPick: (lv: number) => void }) {
  const ownedLv = Math.max(0, ...rungs.filter((r) => r.owned).map((r) => r.level));
  const n = rungs.length;
  return (
    <div data-level-ladder className="relative mt-3 rounded-[4px] bg-black/30 px-1 pb-2 pt-2.5 ring-1 ring-white/10">
      <div aria-hidden className="absolute left-[10%] right-[10%] top-[30px] h-[4px] rounded-full bg-white/10" />
      <div aria-hidden className="absolute left-[10%] top-[30px] h-[4px] rounded-full" style={{ width: `${n > 1 ? Math.max(0, (ownedLv - 1) / (n - 1)) * 80 : 0}%`, background: "linear-gradient(90deg,#c08457,#60a5fa,#f87171,#c084fc,#fbbf24)" }} />
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
        {rungs.map((r) => {
          const on = r.level === selected;
          const above = r.level > ownedLv;
          return (
            <button key={r.level} onClick={() => onPick(r.level)} onMouseEnter={() => onPick(r.level)} data-rung={r.level}
              className="kib-press flex flex-col items-center gap-0.5">
              <span className="relative grid h-[44px] w-[44px] place-items-center">
                {on && <span aria-hidden className="absolute inset-[-6px] rounded-full blur-md" style={{ background: tierColour(r.level), opacity: 0.55 }} />}
                <img src={art(`rank-${r.level}`)} alt="" className={`relative transition ${on ? "h-[44px] w-[44px]" : "h-[34px] w-[34px]"} ${above && !on ? "opacity-55 saturate-50" : ""} ${r.sold ? "grayscale" : ""}`} />
                {r.owned && <span className="absolute -bottom-0.5 -right-0.5 grid h-[16px] w-[16px] place-items-center rounded-full bg-emerald-400 text-[10px] font-black text-emerald-950 ring-2 ring-[#070b16]">✓</span>}
              </span>
              <span className={`text-[10px] font-black uppercase leading-none ${on ? "text-white" : "text-white/65"}`}>{n === 1 ? "" : `L${r.level}`}</span>
              <span className={`text-[10px] font-black leading-none tabular-nums ${r.sold ? "text-red-300" : on ? "text-yellow-300" : "text-yellow-300/60"}`}>{r.sold ? "SOLD" : formatMoney(r.price)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "What it gives": a row of stat chips, a delta beside each when upgrading. */
export function GiveChips({ items }: { items: { label: string; value: string; delta?: string; color: string }[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(3, items.length)}, minmax(0,1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="rounded-[4px] bg-white/[0.05] px-1.5 py-1.5 text-center ring-1 ring-white/10">
          <div className="text-[16px] font-black leading-tight tabular-nums" style={{ color: it.color }}>{it.value}</div>
          <div className="text-[9.5px] font-black uppercase tracking-wide text-white/70">{it.label}</div>
          {it.delta && <div className="text-[10px] font-black text-emerald-300">{it.delta}</div>}
        </div>
      ))}
    </div>
  );
}

/** The detail sheet's backdrop: the gold panel art. */
export function StoreSheet({ open, onClose, title, accent = "#fbbf24", children }: {
  open: boolean; onClose: () => void; title: React.ReactNode; accent?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" data-store-sheet>
      <style>{`@keyframes stSheetUp{from{transform:translateY(48px);opacity:0}to{transform:none;opacity:1}}@keyframes stFade{from{opacity:0}to{opacity:1}}`}</style>
      <button aria-label="Close" data-sheet-close onClick={onClose} className="absolute inset-0 bg-black/70" style={{ animation: "stFade .18s ease-out" }} />
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overflow-x-hidden px-4 pb-6 pt-2"
        style={{
          background: `linear-gradient(180deg, rgba(10,15,30,.86), rgba(7,11,22,.97)), url(${art("panel")}) center top / cover`,
          borderTop: `2px solid ${accent}`,
          boxShadow: `0 -14px 44px -12px ${accent}aa, inset 0 1px 0 rgba(255,255,255,.12)`,
          animation: "stSheetUp .24s cubic-bezier(.2,.9,.3,1.1)",
        }}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/25" />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>{title}</div>
          <button onClick={onClose} aria-label="Close" className="kib-press grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[18px] font-black leading-none text-white">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The big gold buy button. */
export function GoldButton({ children, disabled, onClick, danger = false, className = "", ...rest }: {
  children: React.ReactNode; disabled?: boolean; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; danger?: boolean; className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      {...rest}
      disabled={disabled}
      onClick={onClick}
      className={`kib-press relative w-full overflow-hidden rounded-[4px] py-3 text-[15px] font-black uppercase tracking-wide disabled:cursor-not-allowed ${className}`}
      style={disabled
        ? { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }
        : danger
          ? { background: "linear-gradient(180deg,#f87171,#b91c1c)", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 8px 20px -8px rgba(220,38,38,.9)" }
          : { background: "linear-gradient(180deg,#fde68a,#f59e0b 55%,#d97706)", color: "#1c1203", boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), inset 0 -2px 0 rgba(120,53,15,.5), 0 8px 22px -8px rgba(245,158,11,.95)" }}
    >
      {!disabled && <span aria-hidden className="st-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent)" }} />}
      <span className="relative">{children}</span>
      <style>{`@keyframes stShine{0%,70%{transform:translateX(0)}100%{transform:translateX(420%)}}.st-shine{animation:stShine 3.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.st-shine{animation:none;display:none}}`}</style>
    </button>
  );
}

// ── Confirm, then the purchase moment ───────────────────────────────────

export interface ConfirmInfo {
  title: string;
  sub?: string;
  level: number;
  price: number;
  art: React.ReactNode;
  verb: string;
  note?: string;
  /** The black market: lawyers and the risk. */
  blackMarket?: { lawyerFee: number; lawyerPrice: (lawyers: boolean) => number };
}

/** "Are you sure?" — the item, its price, what you'll have left. */
export function ConfirmSheet({ info, money, onCancel, onConfirm }: {
  info: ConfirmInfo; money: number; onCancel: () => void;
  /** Return a reason to show it (a failed black-market buy); nothing on success. */
  onConfirm: (lawyers: boolean) => string | void;
}) {
  const [lawyers, setLawyers] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const price = info.blackMarket ? info.blackMarket.lawyerPrice(lawyers) : info.price;
  const after = money - price;
  const ok = after >= 0;
  return (
    <StoreSheet open onClose={onCancel} title={info.blackMarket ? "Black market" : "Confirm purchase"} accent={info.blackMarket ? "#ef4444" : "#fbbf24"}>
      <div data-confirm-sheet className="flex items-center gap-3">
        <div className="w-[96px] shrink-0"><FramedCard level={info.level}>{info.art}</FramedCard></div>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-black leading-tight text-white">{info.title}</div>
          {info.sub && <div className="mt-0.5 text-[11.5px] font-bold text-white/80">{info.sub}</div>}
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-[4px] bg-white/[0.06] py-1.5 ring-1 ring-white/10">
              <div className="text-[15px] font-black tabular-nums text-yellow-300">★{formatMoney(price)}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-white/65">Price</div>
            </div>
            <div className="rounded-[4px] bg-white/[0.06] py-1.5 ring-1 ring-white/10">
              <div className={`text-[15px] font-black tabular-nums ${ok ? "text-white" : "text-red-300"}`}>{ok ? `★${formatMoney(after)}` : `−★${formatMoney(-after)}`}</div>
              <div className="text-[9px] font-black uppercase tracking-wide text-white/65">{ok ? "Left after" : "Short"}</div>
            </div>
          </div>
        </div>
      </div>
      {info.note && <div className="mt-2 text-[11px] font-bold text-white/80">{info.note}</div>}
      {info.blackMarket && (
        <div className="mt-3 rounded-[4px] bg-red-950/60 p-2.5 ring-1 ring-red-600/70">
          <div className="text-[11px] font-bold text-red-100">Banned by the FA — a real chance of getting caught buying it anyway.</div>
          <label className="mt-2 flex items-center gap-2 text-[11px] font-bold text-white/90">
            <input type="checkbox" checked={lawyers} onChange={(e) => setLawyers(e.target.checked)} />
            Hire lawyers first (★{formatMoney(info.blackMarket.lawyerFee)} — cuts the risk a lot, doesn&apos;t remove it)
          </label>
        </div>
      )}
      {msg && <div className="mt-2 rounded-[4px] bg-red-500/15 p-2 text-center text-[11.5px] font-black text-red-200 ring-1 ring-red-400/40">{msg}</div>}
      <div className="mt-3 grid grid-cols-[1fr_1.8fr] gap-2">
        <button onClick={onCancel} className="kib-press rounded-[4px] bg-white/[0.08] py-3 text-[14px] font-black uppercase tracking-wide text-white ring-1 ring-white/15">Cancel</button>
        <GoldButton data-confirm-buy danger={!!info.blackMarket} disabled={!ok} onClick={() => { const r = onConfirm(lawyers); if (r) setMsg(r); }}>
          {ok ? `${info.verb} ★${formatMoney(price)}` : "Not enough money"}
        </GoldButton>
      </div>
    </StoreSheet>
  );
}

/**
 * THE PURCHASE MOMENT — the screen dims, the gold burst spins out, the thing
 * you bought drops in on its level's emblem, and a word says what happened.
 * Tap to skip; it closes itself after about 1.7 s.
 */
export function PurchaseMoment({ art: node, level, title, word = "Purchased!", fx, onDone }: {
  art: React.ReactNode; level: number; title: string; word?: string; fx?: string; onDone: () => void;
}) {
  useEffect(() => { const t = setTimeout(onDone, 1750); return () => clearTimeout(t); }, [onDone]);
  return (
    <button data-purchase-moment onClick={onDone} aria-label="Continue" className="fixed inset-0 z-[80] grid place-items-center bg-black/75" style={{ animation: "stFade .15s ease-out" }}>
      <style>{`
        @keyframes stBurst{0%{transform:scale(.2) rotate(0);opacity:0}25%{opacity:1}100%{transform:scale(1.25) rotate(40deg);opacity:.0}}
        @keyframes stGlow{0%{transform:scale(.5);opacity:0}30%{opacity:.9}100%{transform:scale(1.1);opacity:.6}}
        @keyframes stDrop{0%{transform:translateY(-60px) scale(.4);opacity:0}55%{transform:translateY(6px) scale(1.12);opacity:1}75%{transform:translateY(-3px) scale(.97)}100%{transform:none}}
        @keyframes stWord{0%,30%{transform:translateY(16px) scale(.8);opacity:0}60%{transform:none;opacity:1}100%{transform:none;opacity:1}}
        @keyframes stFade{from{opacity:0}to{opacity:1}}
        @media (prefers-reduced-motion: reduce){[data-purchase-moment] *{animation:none!important}}
      `}</style>
      <div className="relative grid h-[340px] w-[340px] place-items-center">
        <img src={art("burst")} alt="" className="absolute inset-0 h-full w-full" style={{ animation: "stBurst 1.6s ease-out both" }} />
        {fx && <img src={art(fx)} alt="" className="absolute inset-[18%] h-[64%] w-[64%]" style={{ animation: "stGlow 1s ease-out both" }} />}
        <div className="relative flex flex-col items-center">
          <img src={art(`rank-${Math.max(1, Math.min(5, level))}`)} alt="" className="mb-[-10px] h-[40px] w-[40px]" style={{ animation: "stDrop .6s .1s cubic-bezier(.2,.9,.3,1.2) both" }} />
          <div className="w-[170px]" style={{ animation: "stDrop .7s cubic-bezier(.2,.9,.3,1.2) both" }}>{node}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(50%+130px)] text-center">
        <div className="text-[34px] font-black uppercase leading-none text-yellow-300" style={{ animation: "stWord .9s ease-out both", textShadow: "0 3px 16px rgba(0,0,0,.9), 0 0 24px rgba(250,204,21,.6)" }}>{word}</div>
        <div className="mt-1 text-[14px] font-black text-white" style={{ animation: "stWord 1.1s ease-out both" }}>{title}</div>
      </div>
    </button>
  );
}
