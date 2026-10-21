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
 *
 * Broadcast look, option 2 (19 Oct 2026): the test controls are a slanted
 * menu rail on the left, the store itself sits on a lit stage beside it
 * (store.css). StoreView is untouched; only the frame around it is this page's.
 */
import { useEffect, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./store.css";
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
    // The controls start open on a computer (the left rail), folded on a phone.
    try { setControlsOpen(window.matchMedia("(min-width: 900px)").matches); } catch { /* folded */ }
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
    return <div className="min-h-[100dvh] bg-[#03091a]" />;
  }

  // Every action: run the pure rule, keep the new state, report ok/reason.
  const run = (r: { ok: boolean; state: StoreState; reason?: string }) => { setState(r.state); return { ok: r.ok, reason: r.reason }; };

  const divisionLabel = STORE_DIVISIONS.find((d) => d.id === settings.division)?.label;

  // The test controls: a rail on the left on a computer, a fold-out panel on a phone.
  const controls = (
    <Panel>
      <button onClick={() => setControlsOpen((o) => !o)} className="st-toggle" aria-expanded={controlsOpen}>
        <span>⚙ Test controls · {divisionLabel} · <Stars v={settings.weeklyWage} />/wk{settings.dayOffset > 0 ? ` · +${settings.dayOffset} day${settings.dayOffset > 1 ? "s" : ""}` : ""}</span>
        <span aria-hidden>{controlsOpen ? "▲" : "▼"}</span>
      </button>
      {controlsOpen && (
        <div className="st-controls">
          <div>
            <Label>Your level</Label>
            <div className="st-levels">
              {STORE_DIVISIONS.map((d) => (
                <button key={d.id} className="st-level" aria-pressed={settings.division === d.id}
                  onClick={() => setSettings((s) => ({ ...s, division: d.id, weeklyWage: typicalWageFor(d.id) }))}
                >{d.label}</button>
              ))}
            </div>
          </div>
          <label className="st-field">
            <span>Weekly wage ★</span>
            <input type="number" min={1} value={settings.weeklyWage}
              onChange={(e) => setSettings((s) => ({ ...s, weeklyWage: Math.max(1, Math.round(Number(e.target.value) || 1)) }))} />
          </label>
          <label className="st-field">
            <span>Wallet ★</span>
            <input type="number" min={0} value={state.stars}
              onChange={(e) => setState((s) => ({ ...s, stars: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
          </label>
          <label className="st-field">
            <span>Wallet Coins</span>
            <input type="number" min={0} value={state.coins}
              onChange={(e) => setState((s) => ({ ...s, coins: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
          </label>
          <div className="st-row">
            <Btn main onClick={() => setSettings((s) => ({ ...s, dayOffset: s.dayOffset + 1 }))}>Skip a day ›</Btn>
            {settings.dayOffset > 0 && (
              <Btn onClick={() => setSettings((s) => ({ ...s, dayOffset: 0 }))}>Back to today</Btn>
            )}
          </div>
          <button
            onClick={() => { if (window.confirm("Reset purchases? Wallet goes back to ★5,000 and 300 Coins.")) setState(START_STATE); }}
            className="st-reset"
          >Reset purchases</button>
          <Note>A test wallet on this device only. Buying Coins adds them free; no real money is taken.</Note>
        </div>
      )}
    </Panel>
  );

  return (
    <BroadcastPage title="Store test" sub="Try the store and paid items. Nothing here reaches a career."
      actions={<div className="st-wallet"><Stars v={state.stars} /><span>{state.coins.toLocaleString("en-GB")} Coins</span></div>}>
      <div className="st-layout">
        <aside className="st-rail">{controls}</aside>
        <div className="st-stage">
          <div className="st-screen">
            <StoreView
              state={state} ctx={ctx} dateKey={dateKey} now={now} dayOffset={settings.dayOffset}
              testArea back={{ href: "/star-play-dev" }} packs="test"
              onBuy={(id, cur) => run(buy(state, id, cur, ctx, dateKey))}
              onEquip={(id) => run(equip(state, id))}
              onUnequip={(slot) => setState((s) => unequip(s, slot))}
              onUse={(id) => run(spendBoost(state, id))}
              onPack={(id) => run(buyCoinPack(state, id))}
              onSwap={(c) => run(convertCoins(state, c, settings.weeklyWage))}
            />
          </div>
        </div>
      </div>
      <PageGuide page="/star-store-dev" />
    </BroadcastPage>
  );
}
