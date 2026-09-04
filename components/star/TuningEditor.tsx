"use client";
import { useMemo, useState } from "react";
import { TUNABLES, type TunableDef } from "@/lib/star/tuning";
import {
  getTuning, getTuningOverrides, setTuningOverride, resetTuning, resetAllTuning,
  getPriceOverride, setPriceOverride, resetPriceOverride,
} from "@/lib/star/tuningStore";
import { KIB_CANS_DEFAULT, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT } from "@/lib/star/shopDefaults";

/**
 * THE TUNING EDITOR.
 *
 * Every number in lib/star/tuning.ts's registry, grouped by category, plus a
 * separate section for the shop catalogues' per-item prices (a different
 * shape — one field on one row of an array, not a bare named number). Both
 * write straight to localStorage via tuningStore.ts; nothing here talks to
 * Supabase or affects any other player's game. See tuning.ts's own header
 * for the full "why" and what's deliberately left out.
 *
 * Read-modify-write on every keystroke, not a big form + Save button: a
 * change is already durable the moment it's typed, same as the game's other
 * localStorage-backed settings. The one thing every value here shares is
 * that it only actually applies the NEXT time the app loads — module-load
 * snapshots, not live state — so that caveat is said once, up top, rather
 * than repeated per row.
 */

const CATEGORY_ORDER = ["Energy", "Training", "Rating", "Sponsorships", "Contracts", "Transfers"];

function groupByCategory(defs: TunableDef[]): Map<string, TunableDef[]> {
  const map = new Map<string, TunableDef[]>();
  for (const d of defs) {
    if (!map.has(d.category)) map.set(d.category, []);
    map.get(d.category)!.push(d);
  }
  return map;
}

function TunableRow({ def, revision, onChange }: { def: TunableDef; revision: number; onChange: () => void }) {
  const overrides = getTuningOverrides();
  const isOverridden = def.key in overrides;
  const value = getTuning(def.key);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-white">{def.label}</span>
          {isOverridden && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300">
              edited
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[10.5px] leading-snug text-white/50">{def.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={def.min}
          max={def.max}
          step={def.step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) { setTuningOverride(def.key, n); onChange(); }
          }}
          className="w-20 rounded-md bg-gray-900 px-2 py-1.5 text-right text-[12px] font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400/60"
        />
        <button
          onClick={() => { resetTuning(def.key); onChange(); }}
          disabled={!isOverridden}
          title={`Reset to ${def.default}`}
          className="rounded-md px-2 py-1.5 text-[10px] font-bold text-white/40 transition hover:text-white disabled:opacity-20 disabled:hover:text-white/40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

interface PriceField { field: string; label: string; base: number }

function PriceCatalogueRow({ catalogue, itemId, name, fields, onChange }: {
  catalogue: string; itemId: string; name: string; fields: PriceField[]; onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{name}</div>
      {fields.map(({ field, label, base }) => {
        const override = getPriceOverride(catalogue, itemId, field);
        const isOverridden = override !== null;
        const value = override ?? base;
        return (
          <div key={field} className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] font-bold text-white/40">{label}</span>
            <input
              type="number"
              value={value}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) { setPriceOverride(catalogue, itemId, field, n); onChange(); }
              }}
              className="w-16 rounded-md bg-gray-900 px-1.5 py-1 text-right text-[11px] font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-400/60"
            />
            <button
              onClick={() => { resetPriceOverride(catalogue, itemId, field); onChange(); }}
              disabled={!isOverridden}
              title={`Reset to ${base}`}
              className="text-[10px] font-bold text-white/40 transition hover:text-white disabled:opacity-20 disabled:hover:text-white/40"
            >
              ↺
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function TuningEditor() {
  const [revision, setRevision] = useState(0);
  const bump = () => setRevision((r) => r + 1);
  const grouped = useMemo(() => groupByCategory(TUNABLES), []);
  const categories = [...CATEGORY_ORDER, ...Array.from(grouped.keys()).filter((c) => !CATEGORY_ORDER.includes(c))];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[11.5px] leading-snug text-amber-100">
        Changes here are saved instantly in this browser, but only take effect the <b>next time the app loads</b> —
        most of these are read once, when the game starts, not live mid-session. Reload (or start a new session) to see an edit.
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => { if (confirm("Reset every tuning value and shop price back to default?")) { resetAllTuning(); bump(); } }}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-red-300 transition hover:bg-red-500/20"
        >
          Reset everything to default
        </button>
      </div>

      {categories.map((category) => {
        const defs = grouped.get(category);
        if (!defs?.length) return null;
        return (
          <section key={category}>
            <h2 className="mb-2 text-[13px] font-black uppercase tracking-widest text-white/80">{category}</h2>
            <div className="space-y-1.5">
              {defs.map((def) => (
                <TunableRow key={def.key} def={def} revision={revision} onChange={bump} />
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="mb-1 text-[13px] font-black uppercase tracking-widest text-white/80">Shop — KIB Cans</h2>
        <p className="mb-2 text-[10.5px] text-white/50">Price and restore amount are both editable per can.</p>
        <div className="space-y-1.5">
          {KIB_CANS_DEFAULT.map((c) => (
            <PriceCatalogueRow
              key={c.id} catalogue="kibCans" itemId={c.id} name={c.name}
              fields={[{ field: "price", label: "★", base: c.price }, { field: "restore", label: "⚡", base: c.restore }]}
              onChange={bump}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[13px] font-black uppercase tracking-widest text-white/80">Shop — Boots</h2>
        <p className="mb-2 text-[10.5px] text-white/50">Only price is editable — stats and durability are what the boot is.</p>
        <div className="space-y-1.5">
          {BOOTS_CATALOGUE_DEFAULT.map((b) => (
            <PriceCatalogueRow
              key={b.id} catalogue="boots" itemId={b.id} name={b.name}
              fields={[{ field: "price", label: "★", base: b.price }]}
              onChange={bump}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-[13px] font-black uppercase tracking-widest text-white/80">Shop — Lifestyle</h2>
        <p className="mb-2 text-[10.5px] text-white/50">Only price is editable — lifestyle value is what the item is.</p>
        <div className="space-y-1.5">
          {LIFESTYLE_ITEMS_DEFAULT.map((it) => (
            <PriceCatalogueRow
              key={it.id} catalogue="lifestyle" itemId={it.id} name={it.name}
              fields={[{ field: "price", label: "★", base: it.price }]}
              onChange={bump}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
