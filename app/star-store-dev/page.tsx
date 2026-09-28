"use client";

/**
 * STORE — a test area (Harry, 27 Sep 2026): "a test area for a dynamic store
 * with animations and daily specials, animations, accessories, unlockable
 * through both pay and pay to win, a section to buy coins for real money that
 * work with in game scaling."
 *
 * Not wired into a career. It keeps its own wallet and locker in this
 * browser, and the Coins section never takes a payment — Buy just adds the
 * Coins and says so. Every rule lives in lib/star/store/*.ts; the screen is
 * components/star/store/StoreView.tsx, the same one the career's Store uses
 * (28 Sep 2026) — this page only adds the test wallet and test controls.
 */
import { useEffect, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import StoreView from "@/components/star/store/StoreView";
import { dateKeyFor } from "@/lib/star/store/daily";
import {
  START_STATE, buy, equip, unequip, spendBoost, buyCoinPack, convertCoins, sanitizeStoreState,
  type StoreState,
} from "@/lib/star/store/purchase";
import type { PriceContext } from "@/lib/star/store/catalogue";
import {
  STORE_DIVISIONS, shopLevelFor, typicalWageFor, sanitizeTestSettings, DEFAULT_TEST_SETTINGS, type StoreTestSettings,
} from "@/lib/star/store/testArea";

const STATE_KEY = "star-store-test-v1";
const SETTINGS_KEY = "star-store-test-settings-v1";

function load<T>(key: string, fix: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? fix(JSON.parse(raw)) : fallback;
  } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window: this page still works */ }
}

function Stars({ v }: { v: number }) {
  return <span className="tabular-nums"><span className="text-yellow-300">★</span>{Math.round(v).toLocaleString("en-GB")}</span>;
}

export default function StoreTestPage() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<StoreState>(START_STATE);
  const [settings, setSettings] = useState<StoreTestSettings>(DEFAULT_TEST_SETTINGS);
  const [now, setNow] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
    setState(load(STATE_KEY, sanitizeStoreState, START_STATE));
    setSettings(load(SETTINGS_KEY, sanitizeTestSettings, DEFAULT_TEST_SETTINGS));
    setNow(Date.now());
    setReady(true);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    document.body.classList.add("knowitball-immersive");
    return () => { window.clearInterval(t); document.body.classList.remove("knowitball-immersive"); };
  }, []);

  useEffect(() => { if (ready) save(STATE_KEY, state); }, [state, ready]);
  useEffect(() => { if (ready) save(SETTINGS_KEY, settings); }, [settings, ready]);

  const level = shopLevelFor(settings.division);
  const ctx: PriceContext = { weeklyWage: settings.weeklyWage, level };
  const dateKey = dateKeyFor(now || Date.UTC(2026, 8, 27), settings.dayOffset);

  if (!ready) {
    return <div className="min-h-[100dvh] bg-[#05070d]" />;
  }

  // Every action: run the pure rule, keep the new state, report ok/reason.
  const run = (r: { ok: boolean; state: StoreState; reason?: string }) => { setState(r.state); return { ok: r.ok, reason: r.reason }; };

  // The test controls (collapsible), under the store's header.
  const controls = (
        <div className="px-4 pb-2">
          <button
            onClick={() => setControlsOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-left text-[12px] font-bold text-slate-300"
          >
            <span>⚙ Test controls · {STORE_DIVISIONS.find((d) => d.id === settings.division)?.label} · <Stars v={settings.weeklyWage} />/wk{settings.dayOffset > 0 ? ` · +${settings.dayOffset} day${settings.dayOffset > 1 ? "s" : ""}` : ""}</span>
            <span className="text-slate-400">{controlsOpen ? "▲" : "▼"}</span>
          </button>
          {controlsOpen && (
            <div className="mt-2 grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12px]">
              <div>
                <div className="mb-1 font-black text-slate-200">Your level</div>
                <div className="flex flex-wrap gap-1.5">
                  {STORE_DIVISIONS.map((d) => (
                    <button key={d.id}
                      onClick={() => setSettings((s) => ({ ...s, division: d.id, weeklyWage: typicalWageFor(d.id) }))}
                      className={`rounded-full px-2.5 py-1 font-bold ${settings.division === d.id ? "bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/70" : "bg-white/5 text-slate-400"}`}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-200">Weekly wage ★</span>
                <input type="number" min={1} value={settings.weeklyWage}
                  onChange={(e) => setSettings((s) => ({ ...s, weeklyWage: Math.max(1, Math.round(Number(e.target.value) || 1)) }))}
                  className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right font-bold" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-200">Wallet ★</span>
                <input type="number" min={0} value={state.stars}
                  onChange={(e) => setState((s) => ({ ...s, stars: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                  className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right font-bold" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-200">Wallet Coins</span>
                <input type="number" min={0} value={state.coins}
                  onChange={(e) => setState((s) => ({ ...s, coins: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                  className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right font-bold" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setSettings((s) => ({ ...s, dayOffset: s.dayOffset + 1 }))} className="rounded-lg bg-white/10 px-3 py-1.5 font-black">Skip a day ›</button>
                {settings.dayOffset > 0 && (
                  <button onClick={() => setSettings((s) => ({ ...s, dayOffset: 0 }))} className="rounded-lg bg-white/5 px-3 py-1.5 font-bold text-slate-300">Back to today</button>
                )}
                <button
                  onClick={() => { if (window.confirm("Reset purchases? Wallet goes back to ★5,000 and 300 Coins.")) setState(START_STATE); }}
                  className="ml-auto rounded-lg bg-rose-500/15 px-3 py-1.5 font-black text-rose-200"
                >Reset purchases</button>
              </div>
            </div>
          )}
        </div>

  );

  return (
    <StoreView
      state={state} ctx={ctx} dateKey={dateKey} now={now} dayOffset={settings.dayOffset}
      testArea back={{ href: "/star-play-dev" }} controls={controls} packs="test"
      onBuy={(id, cur) => run(buy(state, id, cur, ctx, dateKey))}
      onEquip={(id) => run(equip(state, id))}
      onUnequip={(slot) => setState((s) => unequip(s, slot))}
      onUse={(id) => run(spendBoost(state, id))}
      onPack={(id) => run(buyCoinPack(state, id))}
      onSwap={(c) => run(convertCoins(state, c, settings.weeklyWage))}
    >
      <PageGuide page="/star-store-dev" />
    </StoreView>
  );
}
