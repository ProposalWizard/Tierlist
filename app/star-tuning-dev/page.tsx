"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import { TUNABLES, type TunableDef } from "@/lib/star/tuning";
import {
  getTuning, getTuningOverrides, setTuningOverride, resetTuning, resetAllTuning,
  getPriceOverride, setPriceOverride, resetPriceOverride,
} from "@/lib/star/tuningStore";
import { KIB_CANS_DEFAULT, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT } from "@/lib/star/shopDefaults";
import "./balance.css";

/**
 * BALANCE NUMBERS — every game-balance number the star career game ships
 * with ("an area where I can customize every single thing that is done using
 * numbers... without having to just keep asking you"). Admin/tester only.
 *
 * Broadcast look, Harry's pick A (19 Oct 2026): the groups on the left, the
 * picked group's dials in the middle, Reset everything in a bar at the
 * bottom. Same controls as the old TuningEditor (components/star, now unused
 * here): number box + Reset per number (plus a slider), shop prices per item,
 * Reset everything (asks first). Everything writes to this browser only
 * (lib/star/tuningStore.ts) — nothing saves to a database or commits.
 */

const CATEGORY_ORDER = ["Energy", "Training", "Rating", "Sponsorships", "Contracts", "Transfers"];
const SHOP = "Shop prices";
const ALL = "Everything";
const TAB_KEY = "balance-numbers-tab";

function TunableRow({ def, onChange }: { def: TunableDef; onChange: () => void }) {
  const isOverridden = def.key in getTuningOverrides();
  const value = getTuning(def.key);
  const set = (n: number) => { if (Number.isFinite(n)) { setTuningOverride(def.key, n); onChange(); } };
  return (
    <div className="bn-row" data-tunable={def.key}>
      <div className="bn-row-top">
        <span className="bn-name">{def.label}</span>
        {isOverridden && <span className="bn-edited">edited</span>}
        <input type="number" className="bn-num" value={value} min={def.min} max={def.max} step={def.step}
          onChange={(e) => set(Number(e.target.value))} aria-label={def.label} />
        <button className="bn-reset" onClick={() => { resetTuning(def.key); onChange(); }} disabled={!isOverridden}
          title={`Reset to ${def.default}`}>Reset</button>
      </div>
      <input type="range" className="bn-slider" min={def.min} max={def.max} step={def.step}
        value={Math.min(def.max, Math.max(def.min, value))} onChange={(e) => set(Number(e.target.value))}
        aria-label={`${def.label} slider`} />
      <p className="bn-desc">{def.description} <span className="bn-def">Default {def.default}</span></p>
    </div>
  );
}

interface PriceField { field: string; label: string; base: number }

function PriceRow({ catalogue, itemId, name, fields, onChange }: {
  catalogue: string; itemId: string; name: string; fields: PriceField[]; onChange: () => void;
}) {
  return (
    <div className="bn-row bn-price">
      <span className="bn-name">{name}</span>
      <div className="bn-fields">
        {fields.map(({ field, label, base }) => {
          const override = getPriceOverride(catalogue, itemId, field);
          return (
            <label key={field} className="bn-field">
              <span>{label}</span>
              <input type="number" className="bn-num" value={override ?? base}
                onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) { setPriceOverride(catalogue, itemId, field, n); onChange(); } }} />
              <button className="bn-reset" onClick={() => { resetPriceOverride(catalogue, itemId, field); onChange(); }}
                disabled={override === null} title={`Reset to ${base}`}>↺</button>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ShopPanels({ onChange }: { onChange: () => void }) {
  return (
    <>
      <Panel title="Shop — KIB Cans" note="Price and energy per can">
        {KIB_CANS_DEFAULT.map((c) => (
          <PriceRow key={c.id} catalogue="kibCans" itemId={c.id} name={c.name} onChange={onChange}
            fields={[{ field: "price", label: "★", base: c.price }, { field: "restore", label: "⚡", base: c.restore }]} />
        ))}
      </Panel>
      <Panel title="Shop — Boots" note="Price only">
        {BOOTS_CATALOGUE_DEFAULT.map((b) => (
          <PriceRow key={b.id} catalogue="boots" itemId={b.id} name={b.name} onChange={onChange}
            fields={[{ field: "price", label: "★", base: b.price }]} />
        ))}
      </Panel>
      <Panel title="Shop — Lifestyle" note="Price only">
        {LIFESTYLE_ITEMS_DEFAULT.map((it) => (
          <PriceRow key={it.id} catalogue="lifestyle" itemId={it.id} name={it.name} onChange={onChange}
            fields={[{ field: "price", label: "★", base: it.price }]} />
        ))}
      </Panel>
    </>
  );
}

function Editor() {
  const [, setRevision] = useState(0);
  const bump = () => setRevision((r) => r + 1);
  const grouped = useMemo(() => {
    const map = new Map<string, TunableDef[]>();
    for (const d of TUNABLES) { if (!map.has(d.category)) map.set(d.category, []); map.get(d.category)!.push(d); }
    return map;
  }, []);
  const categories = [...CATEGORY_ORDER, ...Array.from(grouped.keys()).filter((c) => !CATEGORY_ORDER.includes(c))]
    .filter((c) => grouped.get(c)?.length);
  const tabs = [...categories, SHOP, ALL];
  const [tab, setTabState] = useState(categories[0]);
  useEffect(() => {
    try { const t = localStorage.getItem(TAB_KEY); if (t && tabs.includes(t)) setTabState(t); } catch { /* no storage */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setTab = (t: string) => { setTabState(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* no storage */ } };
  const overrides = getTuningOverrides();
  const editedIn = (c: string) => (grouped.get(c) ?? []).filter((d) => d.key in overrides).length;

  const panelFor = (c: string) => (
    <Panel key={c} title={c} note={`${grouped.get(c)!.length} numbers`}>
      <div className="bn-rows">{grouped.get(c)!.map((def) => <TunableRow key={def.key} def={def} onChange={bump} />)}</div>
    </Panel>
  );

  return (
    <div className="bn-layout">
      <nav className="bn-nav" aria-label="Groups">
        {tabs.map((t) => (
          <button key={t} className="bn-tab" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}{editedIn(t) > 0 && <span className="bn-count">{editedIn(t)}</span>}
          </button>
        ))}
      </nav>
      <div className="bn-main">
        <Note>Saved at once, in this browser only. Most numbers take effect the <b>next time the game loads</b> — reload to see an edit.</Note>
        {tab === ALL ? <>{categories.map(panelFor)}<ShopPanels onChange={bump} /></>
          : tab === SHOP ? <ShopPanels onChange={bump} />
          : panelFor(tab)}
      </div>
      <div className="bn-bar">
        <span className="bn-bar-note">{Object.keys(overrides).length} numbers edited</span>
        <Btn main onClick={() => { if (confirm("Reset every tuning value and shop price back to default?")) { resetAllTuning(); bump(); } }}>
          Reset everything to default
        </Btn>
      </div>
    </div>
  );
}

export default function StarTuningDevPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setState("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : { isAdmin: false };
        setState(d.isAdmin || d.isTester ? "ok" : "denied");
      } catch {
        setState("denied");
      }
    });
  }, []);

  return (
    <BroadcastPage title="Balance numbers" sub="Tuning tool · every price, fee and gain the game runs on" width={1300}>
      {state === "loading" && <Panel><Note>Loading…</Note></Panel>}
      {state === "denied" && <Panel title="Admin only"><Note>This is a development tool.</Note></Panel>}
      {state === "ok" && <Editor />}
      <PageGuide page="/star-tuning-dev" />
    </BroadcastPage>
  );
}
