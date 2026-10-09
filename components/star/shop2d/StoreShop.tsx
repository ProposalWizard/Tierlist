"use client";

/**
 * THE NEW 2D SHOP — KIB Cans, Boots and Style as one store (Settings → Look →
 * "Shop: New | Old"; Old is components/star/Shop.tsx, untouched).
 *
 * Harry, 9 Oct 2026: "completely rebuild the shop ui too because right now it
 * sucks". Phone first, 390 × 844, 16 px gutter:
 *   - a hero with the boutique banner and your balance (counts down as you spend);
 *   - three tabs with icons (Cans · Boots · Style);
 *   - framed cards, the frame showing the level (bronze → gold);
 *   - tap a card: its sheet with the level ladder, what the next level gives,
 *     and "View in 3D shop" where the 3D shop has it;
 *   - Buy → a confirm sheet → the purchase moment (burst, emblem, word).
 *
 * Nothing about buying changed: the same handlers as the old shop
 * (page.tsx's handleBuyKib/Boot/Item/FromBlackMarket), the same prices, the
 * boot-sponsor 25%, the FA's banned boots on the black market, the unlock
 * chain on Style, worn-out repairs, "Sold out" for boots bought this visit.
 */
import { useMemo, useRef, useState } from "react";
import type React from "react";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS as BOOTS_FULL_PRICE, LIFESTYLE_ALL_LEVELS, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import { divisionOf } from "@/lib/star/calendar";
import { SHOP_TIERS, weeksOfWallet } from "@/lib/star/economy";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { formatMoney } from "@/lib/star/money";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { fameGainFromBuying, isWornOut, itemLifeSeasons, ownedFame, OWNED_FAME_MAX } from "@/lib/star/fame";
import { STYLE_GROUPS, styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import KibCanIcon from "../KibCanIcon";
import BootPicture from "../BootPicture";
import StylePicture from "../StylePicture";
import { weeksText } from "../ShopSheet";
import { PhoneOpens, SaveUp } from "../StyleShop";
import { SquareBar, Pop } from "../ui";
import {
  art, StoreBackdrop, StoreHero, StoreTabs, SectionTitle, Tag, FramedCard, PriceLine, LevelLadder, GiveChips,
  StoreSheet, GoldButton, ConfirmSheet, PurchaseMoment, rungName, tierColour, type StoreTab, type ConfirmInfo,
} from "./parts";

interface ActionResult { ok: boolean; reason?: string }

const CAN_LOOK: Record<KibCan["id"], { accent: string; frame: number; fx: string }> = {
  basic: { accent: "#fb923c", frame: 1, fx: "fx-energy" },
  premium: { accent: "#60a5fa", frame: 2, fx: "fx-curve" },
  elite: { accent: "#c084fc", frame: 4, fx: "fx-touch" },
};

const BOOT_SHELVES: { title: string; note: string; ids: string[] }[] = [
  { title: "Everyday boots", note: "Power and technique", ids: ["starter", "speed", "power", "control", "elite"] },
  { title: "Special boots", note: "A new ability in a match", ids: ["curl", "maestro"] },
];

/** Which bases the 3D shop has (boots, cars, watches and jewellery, homes, the cans). */
const IN_3D: Set<string> = (() => {
  const s = new Set<string>();
  const d = shopDisplays({}, { h: true });
  for (const k of Object.keys(d) as (keyof typeof d)[]) for (const it of d[k].items) s.add(it.id);
  return s;
})();

function ownedLevelOf(mine: OwnedItem | undefined): number {
  if (!mine) return 0;
  return mine.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === mine.id)?.level ?? 1;
}

interface Props {
  career: CareerState;
  kind: StoreTab;
  onBack: () => void;
  onBuyKib: (can: KibCan) => void;
  onBuyBoot: (boot: Boot) => void;
  onBuyItem: (item: OwnedItem) => void;
  onBuyFromBlackMarket: (boot: Boot, useLawyers: boolean) => ActionResult;
  hud?: React.ReactNode;
  onHome?: () => void;
  focus?: { id: string; level: number } | null;
  /** Switch tab (page.tsx moves the phase, so the help pointers follow). */
  onKind?: (k: StoreTab) => void;
  /** Use a can you hold (page.tsx's handleUseCan). */
  onUseCan?: (id: KibCan["id"]) => void;
  /** Open the 3D shop. */
  onOpen3D?: () => void;
}

type Moment = { art: React.ReactNode; level: number; title: string; word: string; fx?: string };

export default function StoreShop({ career, kind, onBack, onBuyKib, onBuyBoot, onBuyItem, onBuyFromBlackMarket, hud, onHome, focus, onKind, onUseCan, onOpen3D }: Props) {
  const [tabLocal, setTabLocal] = useState<StoreTab>(kind);
  const tab = onKind ? kind : tabLocal;
  const setTab = (t: StoreTab) => { if (onKind) onKind(t); else setTabLocal(t); };
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);

  // ── Spending: the balance counts down and "−★X" floats off it ───────────
  const [spent, setSpent] = useState({ n: 0, text: "" });
  const spend = (price: number) => setSpent((s) => ({ n: s.n + 1, text: `−★${formatMoney(price)}` }));
  const [confirm, setConfirm] = useState<null | { info: ConfirmInfo; run: (lawyers: boolean) => string | void }>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  /** Boot levels bought on this visit: "Sold out" until you leave (as the old shelf). */
  const [soldOut, setSoldOut] = useState<Set<string>>(() => new Set());

  const sub = tab === "kib" ? "Energy and match boosts" : tab === "boots" ? "Power, technique and abilities" : "Cars, homes, drip — fame";
  const title = tab === "kib" ? "KIB Cans" : tab === "boots" ? "Boots" : "Style";

  return (
    <div data-store-shop data-sk-tone="calm" className="relative min-h-[100dvh] overflow-x-hidden text-white">
      <StoreBackdrop />
      <div className="relative mx-auto w-full max-w-md px-4 pb-[84px]">
        <div className="sticky top-0 z-30 -mx-4 bg-[#070b16]/95">{hud}</div>
        <StoreHero
          title={title} sub={sub} money={career.money} spent={spent.n} spentText={spent.text}
          right={onOpen3D ? (
            <button onClick={onOpen3D} data-store-open3d className="kib-press rounded-[3px] bg-black/55 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 ring-1 ring-amber-300/50">🕶️ 3D shop ›</button>
          ) : undefined}
        />
        <div className="pb-1 pt-1">
          <StoreTabs tab={tab} onTab={setTab} />
        </div>

        {tab === "kib" && <CansTab career={career} onUseCan={onUseCan} ask={(c) => {
          const price = kibCanPrice(c, career.contract.wage);
          const look = CAN_LOOK[c.id];
          setConfirm({
            info: { title: c.name, sub: kibCanEffectLabel(c), level: look.frame, price, verb: "Buy", art: <KibCanIcon can={c} className="h-[84px] w-[56px]" /> },
            run: () => {
              onBuyKib(c); spend(price); setConfirm(null);
              setMoment({ art: <div className="flex justify-center"><KibCanIcon can={c} className="h-[150px] w-[100px]" /></div>, level: look.frame, title: `${c.name} — ${kibCanEffectLabel(c)}`, word: "+1 Can!", fx: look.fx });
            },
          });
        }} />}

        {tab === "boots" && <BootsTab onOpen3D={onOpen3D} career={career} homeLevel={homeLevel} focus={focus} soldOut={soldOut}
          ask={(b, black) => {
            const lv = b.level ?? 1;
            const pic = <BootPicture base={baseIdOf(b)} level={lv} className="w-full" />;
            const done = (price: number) => {
              spend(price); setConfirm(null);
              setSoldOut((s) => new Set(s).add(b.id));
              setMoment({ art: <BootPicture base={baseIdOf(b)} level={lv} className="w-full" />, level: lv, title: `${b.name} L${lv} — ${b.matches} matches`, word: "Equipped!", fx: b.extraTouch ? "fx-touch" : b.curve ? "fx-curve" : "fx-power" });
            };
            setConfirm({
              info: {
                title: `${b.name} L${lv}`, sub: `+${b.power} power · +${b.technique} technique · ${b.matches} matches`, level: lv, price: b.price, verb: black ? "Buy" : "Buy",
                art: pic, note: "You put them on straight away.",
                blackMarket: black ? { lawyerFee: LAWYER_FEE, lawyerPrice: (l) => blackMarketPrice(b.price) + (l ? LAWYER_FEE : 0) } : undefined,
              },
              run: (lawyers) => {
                if (black) {
                  const r = onBuyFromBlackMarket(b, lawyers);
                  if (!r.ok) return r.reason ?? "Failed";
                  done(blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0));
                  return;
                }
                if (career.money < b.price) return "Not enough money";
                onBuyBoot(b);
                done(b.price);
              },
            });
          }} />}

        {tab === "lifestyle" && <StyleTab onOpen3D={onOpen3D} career={career} focus={focus} homeLevel={homeLevel}
          ask={(it, mine) => {
            const base = baseIdOf(it);
            const lv = it.level ?? 1;
            const worn = !!mine && isWornOut(mine);
            const verb = mine && !worn ? "Upgrade" : mine && worn && (LIFESTYLE_ALL_LEVELS.filter((l) => baseIdOf(l) === base).length === 1) ? "Repair" : "Buy";
            setConfirm({
              info: {
                title: levelName(it), sub: `${familyName(it)} · ${fameText(fameGainFromBuying(career.ownedItems, it))} fame`, level: lv, price: it.price, verb,
                art: <StylePicture base={base} level={lv} className="w-full" />,
                note: mine && !worn ? `Replaces your ${levelName(mine)}.` : undefined,
              },
              run: () => {
                if (career.money < it.price) return "Not enough money";
                onBuyItem(it); spend(it.price); setConfirm(null);
                setMoment({ art: <StylePicture base={base} level={lv} className="w-full" />, level: lv, title: levelName(it), word: verb === "Upgrade" ? "Upgraded!" : verb === "Repair" ? "Repaired!" : "Yours!" });
              },
            });
          }} />}
      </div>

      {/* Bottom bar: Back · Home (the HUD's money and energy stay up top). */}
      <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)", background: "linear-gradient(180deg, rgba(7,11,22,.9), rgba(7,11,22,.98))", boxShadow: "inset 0 1px 0 rgba(251,191,36,.35)" }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-2">
          <button onClick={onBack} className="kib-press flex h-[54px] items-center justify-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-white"><span className="text-[18px] text-amber-300">‹</span>Back</button>
          <button onClick={onHome ?? onBack} className="kib-press flex h-[54px] items-center justify-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-white" style={{ boxShadow: "inset 1px 0 0 rgba(255,255,255,.08)" }}>🏠 Home</button>
        </div>
      </div>

      {confirm && <ConfirmSheet info={confirm.info} money={career.money} onCancel={() => setConfirm(null)} onConfirm={confirm.run} />}
      {moment && <PurchaseMoment art={moment.art} level={moment.level} title={moment.title} word={moment.word} fx={moment.fx} onDone={() => setMoment(null)} />}
    </div>
  );
}

// ── Cans ──────────────────────────────────────────────────────────────────

function CansTab({ career, ask, onUseCan }: { career: CareerState; ask: (c: KibCan) => void; onUseCan?: (id: KibCan["id"]) => void }) {
  return (
    <>
      <SectionTitle note={`Energy ${Math.round(career.energy ?? 0)}/100`}>KIB Cans</SectionTitle>
      <div className="grid grid-cols-3 gap-2" data-can-cards>
        {KIB_CANS.map((c) => {
          const look = CAN_LOOK[c.id];
          const price = kibCanPrice(c, career.contract.wage);
          const can = career.money >= price;
          const owned = career.kibCans[c.id] ?? 0;
          const waiting = !!c.effect && !!career.kibAbility?.[c.effect];
          const useBlocked = owned === 0 || waiting || (!c.effect && (career.energy ?? 0) >= 100);
          return (
            <div key={c.id} data-can-card={c.id} className="flex flex-col">
              <button onClick={() => ask(c)} className="kib-press block w-full text-left" aria-label={`Buy ${c.name}`}>
                <FramedCard level={look.frame}>
                  <img src={art(look.fx)} alt="" aria-hidden className="absolute inset-[-6%] h-[112%] w-[112%] object-contain opacity-90" />
                  <KibCanIcon can={c} className="relative h-[86px] w-[56px] drop-shadow-[0_6px_10px_rgba(0,0,0,.7)]" />
                  <span className="absolute left-0 top-0"><Tag kind="blue">×<Pop value={owned}>{owned}</Pop></Tag></span>
                </FramedCard>
              </button>
              <div className="mt-1 text-center text-[12px] font-black leading-tight text-white">{c.name.replace(" KIB Can", "")}</div>
              {/* The effect, big: +N energy, or the boot ability it gives. */}
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
                {c.effect === "curve" && <span className="rounded-[3px] bg-sky-500 px-1 py-0.5 text-[9px] font-black leading-none text-white">CURVE</span>}
                {c.effect === "extraTouch" && <span className="rounded-[3px] bg-fuchsia-500 px-1 py-0.5 text-[9px] font-black leading-none text-white">TOUCH</span>}
                {c.restore > 0 && <span className="text-[12px] font-black leading-none text-orange-300">+{c.restore}⚡</span>}
              </div>
              <div className="mt-0.5 min-h-[24px] text-center text-[9.5px] font-bold leading-tight text-white/70">{c.effect ? "for your next match" : "energy now"}</div>
              <PriceLine price={price} can={can} />
              <button onClick={() => ask(c)} disabled={!can} data-can-buy={c.id}
                className="kib-press mt-1 rounded-[3px] py-1.5 text-[11px] font-black uppercase tracking-wide disabled:opacity-45"
                style={{ background: can ? "linear-gradient(180deg,#fde68a,#f59e0b)" : "rgba(255,255,255,.08)", color: can ? "#1c1203" : "#fff" }}>
                {can ? "Buy" : "Not enough"}
              </button>
              {onUseCan && (
                <button onClick={() => onUseCan(c.id)} disabled={useBlocked} data-can-use={c.id}
                  className="kib-press mt-1 rounded-[3px] py-1 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-white/20 disabled:opacity-35">
                  {waiting ? "Ready next match" : "Use one"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-[4px] bg-white/[0.04] p-2.5 text-[11px] font-bold leading-snug text-white/80 ring-1 ring-white/10">
        Cans cost a slice of your weekly wage, so they stay worth something as you go up.
      </div>
    </>
  );
}

// ── Boots ─────────────────────────────────────────────────────────────────

function BootsTab({ career, homeLevel, focus, soldOut, ask, onOpen3D }: {
  onOpen3D?: () => void;
  career: CareerState; homeLevel: number; focus?: { id: string; level: number } | null; soldOut: Set<string>;
  ask: (b: Boot, blackMarket: boolean) => void;
}) {
  const bootDeal = hasBootDeal(career);
  const boots = useMemo(() => (bootDeal ? BOOTS_FULL_PRICE.map((b) => ({ ...b, price: bootPrice(career, b.price) })) : BOOTS_FULL_PRICE), [bootDeal, career]);
  const banned = new Set(ruleBookFor(career, "FA").bannedItems);
  const levelsOf = (base: string) => boots.filter((b) => baseIdOf(b) === base).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(() =>
    focus && boots.some((b) => baseIdOf(b) === focus.id) ? { base: focus.id, level: focus.level } : null);
  const cur = career.currentBoot;
  const wearing = baseIdOf(cur);
  const fullMatches = BOOTS_FULL_PRICE.find((b) => b.id === cur.id)?.matches ?? Math.max(cur.matches, 1);

  return (
    <>
      {/* What you have on: the boost and the matches left. */}
      <SectionTitle>Equipped</SectionTitle>
      <div data-equipped-boot className="relative flex items-center gap-3 overflow-hidden rounded-[4px] p-2.5 ring-1 ring-amber-300/40" style={{ background: "linear-gradient(110deg, rgba(251,191,36,.16), rgba(7,11,22,.6) 60%)" }}>
        <div className="relative w-[118px] shrink-0">
          <img src={art(cur.extraTouch ? "fx-touch" : cur.curve ? "fx-curve" : "fx-power")} alt="" aria-hidden className="absolute inset-[-20%] h-[140%] w-[140%] object-contain opacity-70" />
          <BootPicture base={wearing} level={cur.level ?? 1} className={`relative w-full ${cur.matches > 0 ? "" : "opacity-40 grayscale"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <img src={art(`rank-${Math.max(1, Math.min(5, cur.level ?? 1))}`)} alt="" className="h-[22px] w-[22px]" />
            <span className="truncate text-[15px] font-black text-white">{cur.name}{cur.level ? ` L${cur.level}` : ""}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-[3px] bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/40">+{cur.power} Power</span>
            <span className="rounded-[3px] bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/40">+{cur.technique} Tech</span>
            {cur.curve && cur.matches > 0 && <span className="rounded-[3px] bg-sky-500 px-1 py-0.5 text-[9px] font-black leading-none text-white">CURVE</span>}
            {cur.extraTouch && cur.matches > 0 && <span className="rounded-[3px] bg-fuchsia-500 px-1 py-0.5 text-[9px] font-black leading-none text-white">TOUCH</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <SquareBar value={Math.max(2, Math.min(100, (cur.matches / fullMatches) * 100))} colors={cur.matches > 0 ? ["#f59e0b", "#fde047"] : ["#ef4444", "#f87171"]} className="h-[10px] min-w-0 flex-1" animate square />
            <span className="shrink-0 text-[12px] font-black tabular-nums text-white"><Pop value={cur.matches}>{cur.matches}</Pop> <span className="text-[10px] text-white/70">left</span></span>
          </div>
          {cur.matches <= 0 && <div className="mt-0.5 text-[10.5px] font-black text-red-300">Worn out — no boost until you buy a pair</div>}
        </div>
      </div>
      {bootDeal && <div className="mt-2 rounded-[4px] bg-emerald-500/15 px-2.5 py-1.5 text-[11.5px] font-black text-emerald-100 ring-1 ring-emerald-400/50">👟 Boot sponsor: 25% off every pair.</div>}

      {BOOT_SHELVES.map((shelf) => (
        <div key={shelf.title}>
          <SectionTitle note={shelf.note}>{shelf.title}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {shelf.ids.map((id) => {
              const levels = levelsOf(id);
              if (!levels.length) return null;
              const shown = levels.find((b) => b.level === homeLevel) ?? levels[0];
              const lv = shown.level ?? 1;
              const isBanned = banned.has(id);
              const sold = soldOut.has(shown.id);
              const can = career.money >= shown.price;
              return (
                <div key={id} data-boot-card={id} className="flex flex-col">
                  <button onClick={() => setSheet({ base: id, level: lv })} className="kib-press block w-full text-left" aria-label={`${shown.name}, all five levels`}>
                    <FramedCard level={lv} glow={tierColour(lv)} dim={sold}>
                      <BootPicture base={id} level={lv} className="w-full drop-shadow-[0_8px_10px_rgba(0,0,0,.7)]" />
                      <span className="absolute left-0 top-0 flex flex-col items-start gap-0.5">
                        {wearing === id && <Tag kind="green">Equipped</Tag>}
                        {isBanned && <Tag kind="red">Banned</Tag>}
                        {sold && <Tag kind="red">Sold out</Tag>}
                      </span>
                      <span className="absolute bottom-0 right-0"><img src={art(`rank-${lv}`)} alt={`Level ${lv}`} className="h-[24px] w-[24px]" /></span>
                    </FramedCard>
                  </button>
                  <div className="mt-1 truncate text-center text-[12px] font-black leading-tight text-white">{shown.name}</div>
                  <div className="flex items-center justify-center gap-1 text-[10.5px] font-black leading-tight text-emerald-300">
                    <span>+{shown.power}P</span><span>+{shown.technique}T</span>
                    {shown.curve && <span className="rounded-[3px] bg-sky-500 px-1 py-0.5 text-[8px] leading-none text-white">CURVE</span>}
                    {shown.extraTouch && <span className="rounded-[3px] bg-fuchsia-500 px-1 py-0.5 text-[8px] leading-none text-white">TOUCH</span>}
                  </div>
                  <div className="text-center text-[9.5px] font-bold leading-tight text-white/65">{shown.matches} matches</div>
                  <PriceLine price={isBanned ? blackMarketPrice(shown.price) : shown.price} can={can} />
                  {!sold && (
                    <button onClick={() => ask(shown, isBanned)} disabled={!isBanned && !can} data-buy-now={id}
                      className="kib-press mt-1 rounded-[3px] py-1.5 text-[11px] font-black uppercase tracking-wide disabled:opacity-45"
                      style={isBanned ? { background: "linear-gradient(180deg,#f87171,#b91c1c)", color: "#fff" } : { background: can ? "linear-gradient(180deg,#fde68a,#f59e0b)" : "rgba(255,255,255,.08)", color: can ? "#1c1203" : "#fff" }}>
                      {isBanned ? "Black market" : can ? "Buy now" : "Not enough"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {sheet && (() => {
        const levels = levelsOf(sheet.base);
        const b = levels.find((x) => x.level === sheet.level) ?? levels[0];
        const lv = b.level ?? 1;
        const isBanned = banned.has(sheet.base);
        const sold = soldOut.has(b.id);
        const mineLv = wearing === sheet.base ? cur.level ?? 0 : 0;
        const mineB = levels.find((x) => x.level === mineLv);
        const next = levels.find((x) => (x.level ?? 0) === Math.max(mineLv, 0) + 1);
        const can = career.money >= b.price;
        return (
          <StoreSheet open onClose={() => setSheet(null)} title={b.name} accent={tierColour(lv)}>
            <div className="mx-auto w-[66%]">
              <FramedCard level={lv} glow={tierColour(lv)} dim={sold}>
                <img src={art(b.extraTouch ? "fx-touch" : b.curve ? "fx-curve" : "fx-power")} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain opacity-60" />
                <BootPicture base={sheet.base} level={lv} className="relative w-full" />
              </FramedCard>
            </div>
            <div className="mt-1 text-center">
              <div className="text-[22px] font-black leading-tight text-white">{b.name} <span style={{ color: tierColour(lv) }}>L{lv}</span></div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">{rungName(lv)} level{isBanned ? " · banned by the FA" : ""}</div>
            </div>
            <LevelLadder selected={lv} onPick={(l) => setSheet({ base: sheet.base, level: l })}
              rungs={levels.map((x) => ({ level: x.level ?? 1, price: x.price, owned: wearing === sheet.base && (x.level ?? 0) === mineLv, sold: soldOut.has(x.id) }))} />
            {next && next.level !== lv && (
              <button onClick={() => setSheet({ base: sheet.base, level: next.level ?? 1 })} className="kib-press mt-2 flex w-full items-center gap-2 rounded-[4px] bg-amber-400/10 p-2 text-left ring-1 ring-amber-300/40" data-next-upgrade>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Next up ›</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">L{next.level}: +{next.power} Pow · +{next.technique} Tec · {next.matches} games</span>
              </button>
            )}
            <div className="mt-2">
              <GiveChips items={[
                { label: "Power", value: `+${b.power}`, delta: mineB && b.power > mineB.power ? `▲ ${b.power - mineB.power} on yours` : undefined, color: "#6ee7b7" },
                { label: "Technique", value: `+${b.technique}`, delta: mineB && b.technique > mineB.technique ? `▲ ${b.technique - mineB.technique} on yours` : undefined, color: "#6ee7b7" },
                { label: "Matches", value: `${b.matches}`, color: "#fde68a" },
              ]} />
            </div>
            {b.curve && <div className="mt-2 rounded-[4px] bg-sky-500/15 p-2 text-[11.5px] font-bold text-sky-100 ring-1 ring-sky-400/40">Swipe while a shot is in the air to bend, lift or dip it.</div>}
            {b.extraTouch && <div className="mt-2 rounded-[4px] bg-fuchsia-500/15 p-2 text-[11.5px] font-bold text-fuchsia-100 ring-1 ring-fuchsia-400/40">Touch Mode: after you strike it, chase it down for a second touch.</div>}
            <div className="mt-2 flex items-center justify-between px-0.5 text-[10.5px] font-bold text-white/75">
              <span>{weeksText(weeksOfWallet(b.price / b.matches, career.contract.wage))} of income per match</span>
              {IN_3D.has(sheet.base) && <ThreeDLink onOpen3D={onOpen3D} />}
            </div>
            <div className="mt-2">
              {sold ? (
                <div className="rounded-[4px] bg-white/[0.06] py-3 text-center text-[13px] font-black uppercase tracking-wide text-red-300 ring-1 ring-red-400/40">Sold out — back next visit</div>
              ) : isBanned ? (
                <GoldButton danger onClick={() => { setSheet(null); ask(b, true); }}>Buy from shady guys ★{formatMoney(blackMarketPrice(b.price))}</GoldButton>
              ) : (
                <GoldButton disabled={!can} onClick={() => { setSheet(null); ask(b, false); }}>{can ? `Buy now ★${formatMoney(b.price)}` : "Not enough money"}</GoldButton>
              )}
            </div>
          </StoreSheet>
        );
      })()}
    </>
  );
}

/** "View in 3D shop" — only on things the 3D shop has. */
function ThreeDLink({ onOpen3D }: { onOpen3D?: () => void }) {
  if (!onOpen3D) return null;
  return <button onClick={onOpen3D} data-view-3d className="kib-press shrink-0 rounded-[3px] bg-black/40 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 ring-1 ring-amber-300/50">🕶️ View in 3D shop ›</button>;
}

// ── Style ─────────────────────────────────────────────────────────────────

const GROUP_ICON: Record<StyleGroup, string> = { drip: "icon-drip", gadgets: "icon-gadgets", cars: "icon-cars", homes: "icon-homes", holiday: "icon-holiday" };

function StyleTab({ career, focus, homeLevel, ask, onOpen3D }: {
  onOpen3D?: () => void;
  career: CareerState; focus?: { id: string; level: number } | null; homeLevel: number;
  ask: (it: OwnedItem, mine: OwnedItem | undefined) => void;
}) {
  // The unlock chain (lib/star/unlocks.ts): on a new career only the phone is open.
  const lockOf = career.unlocks ? (base: string) => {
    const need = styleUnlockStar(base);
    const stars = starsNow(career);
    return stars >= need ? null : Math.min(1, stars / need);
  } : undefined;
  const focusItem = focus ? LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === focus.id) : undefined;
  const [group, setGroup] = useState<StyleGroup>(() => (focusItem ? styleGroupOf(focusItem)
    : lockOf && !career.ownedItems.some((o) => baseIdOf(o) === "phone") ? "gadgets" : "drip"));
  const [sheet, setSheet] = useState<{ base: string; level: number } | null>(() =>
    focusItem && focus && lockOf?.(focus.id) == null ? { base: focus.id, level: focus.level } : null);
  const groupsRef = useRef<HTMLDivElement>(null);

  const bases = useMemo(() => {
    const seen = new Map<string, OwnedItem[]>();
    for (const i of LIFESTYLE_ALL_LEVELS) {
      const b = baseIdOf(i);
      if (!seen.has(b)) seen.set(b, []);
      seen.get(b)!.push(i);
    }
    seen.forEach((v) => { v.sort((a, b) => (a.level ?? 0) - (b.level ?? 0)); });
    return seen;
  }, []);
  const owned = career.ownedItems;
  const mineOf = (base: string) => owned.find((o) => baseIdOf(o) === base);
  const stuffFame = ownedFame(owned);
  const groupBases = Array.from(bases.keys()).filter((b) => styleGroupOf(bases.get(b)![0]) === group);
  const info = STYLE_GROUPS.find((g) => g.id === group)!;

  return (
    <>
      {/* Fame from your stuff, always on screen (Harry, 30 Sep 2026) — a
          banner with its own bar (Harry, 9 Oct: "a proper banner with progress"). */}
      <div data-style-fame className="relative mt-3 overflow-hidden rounded-[4px] p-2.5 ring-1 ring-amber-300/50"
        style={{ background: `linear-gradient(90deg, rgba(7,11,22,.92), rgba(7,11,22,.55)), url(${art("hero")}) center 35% / cover` }}>
        <div className="flex items-center gap-2.5">
          <img src={art(`rank-${Math.max(1, Math.min(5, Math.ceil((stuffFame / OWNED_FAME_MAX) * 5)))}`)} alt="" className="h-[42px] w-[42px] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-black uppercase tracking-[0.16em] text-amber-200">Fame from your stuff</span>
              <span className="text-[22px] font-black leading-none tabular-nums text-amber-300" style={{ textShadow: "0 0 14px rgba(251,191,36,.5)" }}>{fameText(stuffFame)}</span>
            </div>
            <div className="mt-1.5 h-[12px] w-full overflow-hidden bg-black/50 ring-1 ring-amber-300/40"><div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.max(3, Math.min(100, (stuffFame / OWNED_FAME_MAX) * 100))}%`, boxShadow: "0 0 10px rgba(253,224,71,.7)" }} /></div>
            <div className="mt-1 text-[10.5px] font-bold text-white/80">{owned.filter((o) => !isWornOut(o)).length} things working for you · better levels give more</div>
          </div>
        </div>
      </div>

      {/* The five groups: chunky tabs, icon over word. */}
      <div ref={groupsRef} className="mt-2.5 grid grid-cols-5 gap-1.5" data-style-groups>
        {STYLE_GROUPS.map((g) => {
          const on = g.id === group;
          return (
            <button key={g.id} onClick={() => setGroup(g.id)} data-style-group={g.id}
              className="kib-press flex h-[70px] flex-col items-center justify-center gap-0.5 rounded-[4px]"
              style={{ background: on ? "linear-gradient(180deg, rgba(251,191,36,.30), rgba(120,53,15,.35))" : "rgba(255,255,255,.05)", boxShadow: on ? "inset 0 0 0 1.5px rgba(253,224,71,.9), 0 6px 16px -8px rgba(251,191,36,.9)" : "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
              <img src={art(GROUP_ICON[g.id])} alt="" className={`h-[40px] w-[40px] ${on ? "" : "opacity-65 saturate-50"}`} />
              <span className={`text-[11px] font-black uppercase leading-none tracking-wide ${on ? "text-white" : "text-white/70"}`}>{g.label}</span>
            </button>
          );
        })}
      </div>
      <SectionTitle note={info.note.length > 34 ? undefined : info.note}>{info.label}</SectionTitle>

      {/* Big cards, two to a row, like the boots. */}
      <div className="grid grid-cols-2 gap-2.5" data-style-grid={group}>
        {groupBases.map((base) => {
          const levels = bases.get(base)!;
          const mine = mineOf(base);
          const worn = !!mine && isWornOut(mine);
          const ownLv = ownedLevelOf(mine);
          const yours = !!mine && !worn;
          const affordable = levels.filter((l) => (l.level ?? 1) <= homeLevel && l.price <= career.money);
          const showLv = yours ? ownLv : (affordable[affordable.length - 1]?.level ?? 1);
          const item = levels.find((l) => l.level === showLv) ?? levels[0];
          const lock = lockOf?.(base) ?? null;
          const nextItem = yours ? levels.find((l) => (l.level ?? 0) === ownLv + 1) ?? null : item;
          const nextPrice = nextItem ? nextItem.price : null;
          const fame = yours ? fameFromOwned(owned, mine!) : fameGainFromBuying(owned, item);
          const flash = base === "phone" && !!lockOf && !yours;
          const single = levels.length === 1;
          const can = nextPrice !== null && career.money >= nextPrice;
          if (lock !== null) {
            return (
              <div key={base} data-item-card={base} data-locked className="flex flex-col">
                <FramedCard level={showLv} dim>
                  <StylePicture base={base} level={showLv} className="w-full opacity-30 grayscale" />
                  <span className="absolute inset-0 grid place-items-center text-[30px]">🔒</span>
                </FramedCard>
                <div className="mt-1 truncate text-center text-[13px] font-black text-white/75">{familyName(item)}</div>
                <div className="text-center text-[10.5px] font-black text-amber-300">Higher star rating</div>
                <div className="mx-2 mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.max(4, Math.round(lock * 100))}%` }} /></div>
              </div>
            );
          }
          const open = () => setSheet({ base, level: yours ? Math.min(levels.length, ownLv + (ownLv < levels.length ? 1 : 0)) : showLv });
          return (
            <div key={base} data-item-card={base} data-tour={base === "phone" ? "phone-tile" : undefined} className={`flex flex-col ${flash ? "kit-tile-flash" : ""}`}>
              <button onClick={open} className="kib-press block w-full text-left" aria-label={`${familyName(item)}, all levels`}>
                <FramedCard level={showLv} glow={tierColour(showLv)}>
                  <StylePicture base={base} level={showLv} className="w-full drop-shadow-[0_8px_10px_rgba(0,0,0,.7)]" />
                  <span className="absolute left-0 top-0 flex flex-col items-start gap-0.5">
                    {yours && <Tag kind="green">Owned L{ownLv}</Tag>}
                    {worn && <Tag kind="red">Worn out</Tag>}
                  </span>
                  {!single && <span className="absolute bottom-0 right-0"><img src={art(`rank-${showLv}`)} alt={`Level ${showLv}`} className="h-[30px] w-[30px]" /></span>}
                  <span className="absolute bottom-0.5 left-0 rounded-[3px] bg-black/65 px-1.5 py-0.5 text-[11px] font-black text-amber-300 ring-1 ring-amber-300/40">{fameText(fame)} fame</span>
                </FramedCard>
              </button>
              <div className="mt-1 truncate text-center text-[13.5px] font-black leading-tight text-white">{levelName(item)}</div>
              <div className="truncate text-center text-[10px] font-bold text-white/65">{familyName(item)}{single ? "" : ` · ${rungName(showLv)}`}</div>
              {/* Owned → what the next tier is; not owned → this one's price. */}
              {yours && nextItem ? (
                <div className="mt-0.5 truncate text-center text-[10.5px] font-black text-sky-200">Next: L{nextItem.level} {levelName(nextItem)}</div>
              ) : yours ? (
                <div className="mt-0.5 text-center text-[10.5px] font-black text-emerald-300">Top level reached</div>
              ) : null}
              <PriceLine price={nextPrice} can={can} label={yours && nextPrice !== null ? "Upgrade" : undefined} />
              {nextPrice !== null && (
                <button onClick={open} data-style-buy={base}
                  className="kib-press mt-1 rounded-[3px] py-1.5 text-[11px] font-black uppercase tracking-wide"
                  style={can ? { background: yours ? "linear-gradient(180deg,#7dd3fc,#0284c7)" : "linear-gradient(180deg,#fde68a,#f59e0b)", color: yours ? "#04121f" : "#1c1203" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}>
                  {!can ? "Save up" : yours ? "Upgrade" : worn ? "Replace" : "Buy"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {group === "holiday" && <div className="mt-2 text-center text-[11px] font-bold text-white/70">Only these three so far.</div>}

      {sheet && (() => {
        const levels = bases.get(sheet.base)!;
        const it = levels.find((l) => l.level === sheet.level) ?? levels[0];
        const base = sheet.base;
        const mine = mineOf(base);
        const worn = !!mine && isWornOut(mine);
        const ownLv = ownedLevelOf(mine);
        const blocked = !!mine && !worn && (it.level ?? 0) <= ownLv;
        const canBuy = !blocked && career.money >= it.price;
        const gain = fameGainFromBuying(owned, it);
        const nowFame = mine && !worn ? fameFromOwned(owned, mine) : 0;
        const life = itemLifeSeasons(it);
        const lv = it.level ?? 1;
        const next = levels.find((l) => (l.level ?? 0) === ownLv + 1);
        const verb = mine && !worn ? "Upgrade" : mine && worn && levels.length === 1 ? "Repair" : "Buy";
        return (
          <StoreSheet open onClose={() => setSheet(null)} title={familyName(it)} accent={tierColour(lv)}>
            <div className="mx-auto w-[62%]">
              <FramedCard level={lv} glow={tierColour(lv)}>
                <StylePicture base={base} level={lv} className="w-full" />
                {mine && !worn && ownLv === lv && <span className="absolute left-0 top-0"><Tag kind="green">Owned</Tag></span>}
              </FramedCard>
            </div>
            <div className="mt-1 text-center">
              <div className="text-[21px] font-black leading-tight text-white">{levelName(it)}</div>
              {levels.length > 1 && <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: tierColour(lv) }}>Level {lv} · {rungName(lv)}</div>}
            </div>
            {base === "phone" && <PhoneOpens />}
            {levels.length > 1 && (
              <LevelLadder selected={lv} onPick={(l) => setSheet({ base, level: l })}
                rungs={levels.map((l) => ({ level: l.level ?? 1, price: l.price, owned: !!mine && !worn && (l.level ?? 0) === ownLv }))} />
            )}
            {next && next.level !== lv && levels.length > 1 && (
              <button onClick={() => setSheet({ base, level: next.level ?? 1 })} className="kib-press mt-2 flex w-full items-center gap-2 rounded-[4px] bg-amber-400/10 p-2 text-left ring-1 ring-amber-300/40" data-next-upgrade>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Next up ›</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-black text-white">L{next.level} {levelName(next)}: {fameText(fameGainFromBuying(owned, next))} fame</span>
              </button>
            )}
            <div className="mt-2">
              <GiveChips items={[
                { label: mine && !worn ? `fame (now ${fameText(nowFame)})` : "Fame", value: fameText(gain), color: "#fcd34d" },
                { label: "Lasts", value: life === null ? "Forever" : `${life} season${life === 1 ? "" : "s"}`, color: "#ffffff" },
                { label: "Of income", value: weeksText(weeksOfWallet(it.price, career.contract.wage)), color: "#93c5fd" },
              ]} />
            </div>
            {levels.length > 1 && lv === 5 && (
              <div className="mt-2 flex items-center gap-2 rounded-[4px] bg-yellow-400/10 p-2 ring-1 ring-yellow-300/40">
                <img src={art("rank-5")} alt="" className="h-8 w-8" />
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-yellow-200">Level 5 unlock</div>
                  <div className="text-[10.5px] font-bold text-white/75">To be decided — nothing extra yet.</div>
                </div>
              </div>
            )}
            {!blocked && career.money < it.price && <SaveUp have={career.money} need={it.price} wage={career.contract.wage} />}
            {IN_3D.has(base) && onOpen3D && <div className="mt-2 flex justify-end"><ThreeDLink onOpen3D={onOpen3D} /></div>}
            <div className="mt-2">
              <GoldButton disabled={!canBuy} onClick={() => { setSheet(null); ask(it, mine); }}>
                {blocked ? (ownLv === lv ? "You own this one" : `You own level ${ownLv}`) : career.money < it.price ? "Not enough money" : `${verb} ★${formatMoney(it.price)}`}
              </GoldButton>
            </div>
          </StoreSheet>
        );
      })()}
    </>
  );
}
