"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { formatMoney } from "@/lib/star/money";
import { CountUp, FloatText, PressButton, useTrigger } from "./ui";
import { SetCard, SetHead, SetNote, SetDivider } from "./settingsKit";

/**
 * DEV MONEY — A TESTING TOOL, NOT A GAMEPLAY MECHANIC.
 *
 * Requested directly: a way to insert money for testing the Investments/
 * Boardroom system (buying stakes, funding a club, negotiating transfers)
 * without grinding for it first. Same unguarded "developers and admins"
 * spirit as `DevSkipPanel` right above it on this same screen — no login
 * role or feature flag gates either one, both just live in Settings for
 * whoever is using this dev build.
 *
 * Reskinned 28 Sep 2026 (the home screen's look): a gold-lit card, the
 * balance and Coins count up to their new value, and the amount floats up
 * off them. Same handlers, same amounts.
 */

const PRESETS = [10_000, 100_000, 1_000_000, 10_000_000];
/** Store Coins top-ups (50 Coins = one week of your wage). */
const COIN_PRESETS = [100, 500, 1_000, 5_000];
const TONE = "#f59e0b";

function money(n: number): string {
  return formatMoney(n);
}

export default function DevMoneyPanel({
  career, onAddMoney, onAddCoins,
}: {
  career: CareerState;
  onAddMoney: (amount: number) => void;
  /** Dev: + Coins for testing the Store. */
  onAddCoins?: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(100_000);
  const [added, fireAdded] = useTrigger();
  const [addedText, setAddedText] = useState("");
  const [coined, fireCoined] = useTrigger();
  const [coinText, setCoinText] = useState("");

  const add = (n: number) => { onAddMoney(n); setAddedText(`+★${money(n)}`); fireAdded(); };
  const addCoins = (n: number) => { onAddCoins?.(n); setCoinText(`+${n.toLocaleString("en-GB")}`); fireCoined(); };

  return (
    <SetCard tone={TONE} strength={0.22} className="mt-2.5 p-3">
      <SetHead tone={TONE}>Dev — Add Money</SetHead>
      <SetNote>For testing Investments/Boardroom without grinding for it.</SetNote>
      <div className="relative mt-2 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.55), inset 0 0 0 1px rgba(253,224,71,.18)" }}>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">Current balance</span>
        <span className="text-[16px] font-black tabular-nums text-yellow-200">★<CountUp value={career.money} ms={800} format={(n) => formatMoney(Math.round(n))} /></span>
        <FloatText trigger={added} text={addedText} color="#fde047" className="right-6 top-0" size={14} />
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {PRESETS.map(p => (
          <PressButton
            key={p}
            variant="primary"
            size="none"
            onClick={() => add(p)}
            className="rounded-lg py-1.5 text-[10px] font-black"
          >
            +★{money(p)}
          </PressButton>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-black text-yellow-300">★</span>
        <input
          type="number" min={0} step={1000}
          value={amount}
          onChange={e => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className="kit-input min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm tabular-nums text-white"
        />
        <PressButton
          variant="primary"
          size="none"
          disabled={amount <= 0}
          onClick={() => add(amount)}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black"
        >
          Add
        </PressButton>
      </div>

      {onAddCoins && (
        <>
          <SetDivider />
          <SetHead tone="#fbbf24">+ Coins (Store)</SetHead>
          <div className="relative mt-1 text-[11px] font-semibold text-white/90">
            Current: <span className="font-black tabular-nums text-amber-200"><CountUp value={career.coins ?? 0} ms={700} format={(n) => Math.round(n).toLocaleString("en-GB")} /></span> Coins
            <FloatText trigger={coined} text={coinText} color="#fbbf24" className="left-24 top-0" size={13} />
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {COIN_PRESETS.map(p => (
              <PressButton
                key={p}
                variant="gold"
                size="none"
                onClick={() => addCoins(p)}
                className="rounded-lg py-1.5 text-[10px] font-black"
              >
                +{p.toLocaleString("en-GB")}
              </PressButton>
            ))}
          </div>
        </>
      )}
    </SetCard>
  );
}
