"use client";

/**
 * GEMS (TEST) — proves paid things can't be faked (Harry, 7 Oct 2026: "we
 * are DEFINITELY going to have paid items … ideally everything is safe").
 *
 * The whole path, end to end, on the one example paid item (Golden boots):
 *   1. An admin gives their own account gems (+100 gems).
 *   2. Buy → the server checks the price and the balance, takes the gems and
 *      records that this account owns the boots.
 *   3. The boots show, because the SERVER's list says so.
 *   4. "Try to cheat" writes 99,999 gems and the boots into this browser's
 *      storage, then asks the server again: nothing changes.
 *
 * Gems live only in the database (supabase/migrations/star_wallet.sql), never
 * in the career save. See PAID_ITEMS.md.
 */
import { useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Panel } from "@/components/admin/broadcast/BroadcastPage";
import "./gems.css";
import { useWallet } from "@/lib/star/useWallet";
import { useIsAdmin } from "@/lib/useIsAdmin";
import {
  buyPaidItem, buyProblem, canAfford, loadWallet, newIdemKey, owns, type PaidItem,
} from "@/lib/star/wallet";

/** The one example paid item (seeded by the migration). */
const EXAMPLE_ITEM = "test-golden-boots";

/** The browser keys the "Try to cheat" button writes. Nothing reads them. */
const CHEAT_KEYS = ["star-wallet", "star-gems", "star-paid-owned"];

/** The big gem in the "Your gems" banner. */
function Gem() {
  return (
    <svg viewBox="0 0 120 100" className="gm-gem" aria-hidden="true">
      <defs>
        <linearGradient id="gmA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9f3ff" /><stop offset="1" stopColor="#3aa8ff" /></linearGradient>
        <linearGradient id="gmB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5fd8ff" /><stop offset="1" stopColor="#1a4fd6" /></linearGradient>
      </defs>
      <path d="M30 8 H90 L114 36 L60 96 L6 36 Z" fill="url(#gmB)" stroke="#e6faff" strokeWidth="2.5" />
      <path d="M6 36 H114 M30 8 L44 36 L60 8 L76 36 L90 8 M44 36 L60 96 L76 36" fill="none" stroke="#e6faff" strokeWidth="1.6" opacity="0.8" />
      <path d="M30 8 H90 L76 36 H44 Z" fill="url(#gmA)" opacity="0.85" />
    </svg>
  );
}

/** A small gem, the picture on a paid item that has no drawing of its own. */
function SmallGem() {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <path d="M30 8 H90 L114 36 L60 96 L6 36 Z" fill="#2fa9ff" stroke="#e6faff" strokeWidth="3" />
      <path d="M6 36 H114 M44 36 L60 96 L76 36" fill="none" stroke="#e6faff" strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

function Boot({ gold }: { gold: boolean }) {
  const body = gold ? "#f5c542" : "#4b5563";
  const edge = gold ? "#a8761a" : "#1f2937";
  return (
    <svg viewBox="0 0 120 70" aria-label={gold ? "Golden boots" : "Locked boots"}>
      <path d="M12 18 L52 14 L58 34 L104 40 Q114 42 112 52 L110 56 L14 56 Q8 56 8 48 Z" fill={body} stroke={edge} strokeWidth="3" />
      <path d="M14 56 L110 56 L108 62 L16 62 Z" fill={edge} />
      {[24, 44, 64, 84, 100].map(x => <circle key={x} cx={x} cy={65} r="3" fill={edge} />)}
      {[26, 34, 42].map(x => <line key={x} x1={x} y1={22} x2={x + 6} y2={36} stroke={gold ? "#fff7d6" : "#9ca3af"} strokeWidth="2" />)}
      {!gold && <text x="60" y="38" textAnchor="middle" fontSize="18" fill="#e5e7eb">🔒</text>}
    </svg>
  );
}

export default function WalletTestPage() {
  const w = useWallet();
  const admin = useIsAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cheatNote, setCheatNote] = useState<string | null>(null);
  /** What the cheat check found, shown as a ledger: this browser vs the server. */
  const [cheatRows, setCheatRows] = useState<{ gems: string; boots: string } | null>(null);

  const refresh = () => loadWallet({ force: true });

  async function buy(item: PaidItem) {
    setBusy(item.id); setNote(null);
    const r = await buyPaidItem(item);
    setBusy(null);
    if (r.ok) setNote(r.alreadyOwned ? `You already own ${item.name}. Nothing was charged.` : `Bought ${item.name}. ${r.gems} gems left.`);
    else setNote(buyProblem(r.error, r.price));
  }

  async function giveGems() {
    setBusy("grant"); setNote(null);
    try {
      const res = await fetch("/api/admin/wallet/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100, idem_key: newIdemKey() }),
      });
      const d = await res.json().catch(() => ({}));
      setNote(res.ok ? `+100 gems. You now have ${d.gems}.` : (d.error ?? "That didn't work."));
    } catch {
      setNote("No connection.");
    }
    setBusy(null);
    await refresh();
  }

  async function tryToCheat() {
    const before = w.gems;
    try {
      window.localStorage.setItem("star-wallet", JSON.stringify({ gems: 99999, owned: [EXAMPLE_ITEM] }));
      window.localStorage.setItem("star-gems", "99999");
      window.localStorage.setItem("star-paid-owned", JSON.stringify([EXAMPLE_ITEM]));
    } catch { /* private window: the point still stands */ }
    const after = await refresh();
    setCheatRows(after.status === "ok"
      ? { gems: after.gems.toLocaleString("en-GB"), boots: owns(after, EXAMPLE_ITEM) ? "Owned (really bought)" : "Locked" }
      : { gems: after.message ?? after.status, boots: "Locked" });
    setCheatNote(
      after.status === "ok"
        ? `Wrote 99,999 gems and the boots into this browser. The server still says ${after.gems} gems (was ${before}), and the boots are ${owns(after, EXAMPLE_ITEM) ? "owned because you really bought them" : "still locked"}.`
        : `Wrote 99,999 gems into this browser. The server says: ${after.message ?? after.status} Nothing changed.`,
    );
  }

  function clearCheat() {
    try { CHEAT_KEYS.forEach(k => window.localStorage.removeItem(k)); } catch { /* nothing to clear */ }
    setCheatRows(null);
    setCheatNote("Cleared the fake values from this browser.");
  }

  const example = w.catalogue.find(i => i.id === EXAMPLE_ITEM);
  const gold = owns(w, EXAMPLE_ITEM);
  const ownedOthers = w.catalogue.filter(i => i.id !== EXAMPLE_ITEM && owns(w, i.id));

  return (
    <BroadcastPage
      title="Gems test"
      sub="Paid things live on the server, not in the save. This page proves it."
      width={1200}
      actions={<Btn onClick={refresh}>Refresh</Btn>}
    >
      <section className="gm-hero">
        <Gem />
        <div className="gm-hero-text">
          <span className="gm-your">Your gems</span>
          <div className="gm-count">{w.status === "ok" ? w.gems.toLocaleString("en-GB") : "—"}<small>gems</small></div>
          {w.status === "loading" && <p className="gm-msg">Asking the server…</p>}
          {w.status === "signed-out" && (
            <p className="gm-msg">{w.message} <Link href="/auth?next=/star-wallet-dev">Sign in</Link></p>
          )}
          {(w.status === "off" || w.status === "error") && <p className="gm-msg" data-warn="true">{w.message}</p>}
        </div>
        {admin && w.status === "ok" && (
          <div className="gm-hero-side">
            <Btn main onClick={giveGems} disabled={busy !== null}>+100 gems (admin test)</Btn>
          </div>
        )}
      </section>

      <h2 className="gm-h">Paid items</h2>
      {w.catalogue.length === 0 && <p className="gm-line">{w.status === "ok" || w.status === "signed-out" ? "Nothing for sale." : "—"}</p>}
      {w.catalogue.length > 0 && (
        <div className="gm-cards">
          {w.catalogue.map(item => {
            const have = owns(w, item.id);
            return (
              <div key={item.id} className="gm-card">
                <div className="gm-card-pic">{item.id === EXAMPLE_ITEM ? <Boot gold={have} /> : <SmallGem />}</div>
                <b>{item.name}</b>
                <span>💎 {item.price}</span>
                <div className="gm-buy">
                  {have ? (
                    <span className="gm-buy-own">Owned</span>
                  ) : (
                    <button
                      className="gm-buy-btn"
                      onClick={() => buy(item)}
                      disabled={busy !== null || w.status !== "ok" || !canAfford(w, item)}
                    >
                      {busy === item.id ? "Buying…" : "Buy"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {note && <p className="gm-line">{note}</p>}
      {example && w.status === "ok" && !gold && !canAfford(w, example) && (
        <p className="gm-line">Not enough gems for {example.name} ({example.price}).</p>
      )}

      <h2 className="gm-h">Owned items</h2>
      <div className="gm-owned">
        <div className="gm-tile" data-locked={gold ? undefined : "true"}>
          <Boot gold={gold} />
          <b>Golden boots</b>
          <span>{gold ? "Owned. The server's list says so." : "Locked."}</span>
        </div>
        {ownedOthers.map(item => (
          <div key={item.id} className="gm-tile">
            <SmallGem />
            <b>{item.name}</b>
            <span>Owned.</span>
          </div>
        ))}
      </div>

      <Panel title="Try to cheat" note="this browser vs the server">
        <p className="gm-line">Writes 99,999 gems and the boots into this browser, the way someone with dev tools would, then asks the server again.</p>
        <div className="gm-row">
          <Btn onClick={tryToCheat}>Try to cheat</Btn>
          <Btn onClick={clearCheat}>Clear it</Btn>
        </div>
        {cheatRows && (
          <table className="gm-ledger">
            <thead><tr><th>Where</th><th>Gems</th><th>Golden boots</th></tr></thead>
            <tbody>
              <tr><td>This browser (fake)</td><td className="gm-down">99,999</td><td className="gm-down">Owned</td></tr>
              <tr><td>The server</td><td className="gm-up">{cheatRows.gems}</td><td className="gm-up">{cheatRows.boots}</td></tr>
            </tbody>
          </table>
        )}
        {cheatNote && <p className="gm-line">{cheatNote}</p>}
      </Panel>

      <PageGuide page="/star-wallet-dev" />
    </BroadcastPage>
  );
}
