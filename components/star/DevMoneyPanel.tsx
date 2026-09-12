"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { formatMoney } from "@/lib/star/money";

/**
 * DEV MONEY — A TESTING TOOL, NOT A GAMEPLAY MECHANIC.
 *
 * Requested directly: a way to insert money for testing the Investments/
 * Boardroom system (buying stakes, funding a club, negotiating transfers)
 * without grinding for it first. Same unguarded "developers and admins"
 * spirit as `DevSkipPanel` right above it on this same screen — no login
 * role or feature flag gates either one, both just live in Settings for
 * whoever is using this dev build.
 */

const PRESETS = [10_000, 100_000, 1_000_000, 10_000_000];

function money(n: number): string {
  return formatMoney(n);
}

export default function DevMoneyPanel({
  career, onAddMoney,
}: {
  career: CareerState;
  onAddMoney: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(100_000);

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Dev — Add Money</div>
      <p className="mt-1 text-[11px] font-semibold text-white/90">
        For testing Investments/Boardroom without grinding for it. Current balance: ★{formatMoney(career.money)}
      </p>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onAddMoney(p)}
            className="py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black text-white"
          >
            +★{money(p)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-yellow-300 font-black text-sm">★</span>
        <input
          type="number" min={0} step={1000}
          value={amount}
          onChange={e => setAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white tabular-nums"
        />
        <button
          disabled={amount <= 0}
          onClick={() => onAddMoney(amount)}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 font-black text-xs whitespace-nowrap"
        >
          Add
        </button>
      </div>
    </div>
  );
}
