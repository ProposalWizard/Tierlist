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
import { useWallet } from "@/lib/star/useWallet";
import { useIsAdmin } from "@/lib/useIsAdmin";
import {
  buyPaidItem, buyProblem, canAfford, loadWallet, newIdemKey, owns, type PaidItem,
} from "@/lib/star/wallet";

/** The one example paid item (seeded by the migration). */
const EXAMPLE_ITEM = "test-golden-boots";

/** The browser keys the "Try to cheat" button writes. Nothing reads them. */
const CHEAT_KEYS = ["star-wallet", "star-gems", "star-paid-owned"];

function Boot({ gold }: { gold: boolean }) {
  const body = gold ? "#f5c542" : "#4b5563";
  const edge = gold ? "#a8761a" : "#1f2937";
  return (
    <svg viewBox="0 0 120 70" className="h-20 w-auto" aria-label={gold ? "Golden boots" : "Locked boots"}>
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
    setCheatNote(
      after.status === "ok"
        ? `Wrote 99,999 gems and the boots into this browser. The server still says ${after.gems} gems (was ${before}), and the boots are ${owns(after, EXAMPLE_ITEM) ? "owned because you really bought them" : "still locked"}.`
        : `Wrote 99,999 gems into this browser. The server says: ${after.message ?? after.status} Nothing changed.`,
    );
  }

  function clearCheat() {
    try { CHEAT_KEYS.forEach(k => window.localStorage.removeItem(k)); } catch { /* nothing to clear */ }
    setCheatNote("Cleared the fake values from this browser.");
  }

  const example = w.catalogue.find(i => i.id === EXAMPLE_ITEM);
  const gold = owns(w, EXAMPLE_ITEM);

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#0b1220] px-4 pb-24 pt-6 text-white">
      <h1 className="text-2xl font-black">Gems (test)</h1>
      <p className="mt-1 text-sm font-bold">Paid things live on the server, not in the save. This page proves it.</p>

      <section className="mt-5 rounded-2xl bg-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-black tabular-nums">💎 {w.status === "ok" ? w.gems.toLocaleString("en-GB") : "—"}</div>
          <button onClick={refresh} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold">Refresh</button>
        </div>
        {w.status === "loading" && <p className="mt-2 text-sm font-bold">Asking the server…</p>}
        {w.status === "signed-out" && (
          <p className="mt-2 text-sm font-bold">{w.message} <Link href="/auth?next=/star-wallet-dev" className="underline">Sign in</Link></p>
        )}
        {(w.status === "off" || w.status === "error") && <p className="mt-2 text-sm font-bold text-amber-300">{w.message}</p>}
        {admin && w.status === "ok" && (
          <button onClick={giveGems} disabled={busy !== null} className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 font-black disabled:opacity-50">
            +100 gems (admin test)
          </button>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white/10 p-4">
        <h2 className="text-lg font-black">The example paid item</h2>
        <div className="mt-2 flex items-center gap-4">
          <Boot gold={gold} />
          <div className="text-sm font-bold">
            {gold ? "Golden boots: owned. The server's list says so." : "Golden boots: locked."}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-white/10 p-4">
        <h2 className="text-lg font-black">Paid items</h2>
        {w.catalogue.length === 0 && <p className="mt-2 text-sm font-bold">{w.status === "ok" || w.status === "signed-out" ? "Nothing for sale." : "—"}</p>}
        <ul className="mt-2 space-y-2">
          {w.catalogue.map(item => {
            const have = owns(w, item.id);
            return (
              <li key={item.id} className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
                <div>
                  <div className="font-black">{item.name}</div>
                  <div className="text-sm font-bold">💎 {item.price}</div>
                </div>
                {have ? (
                  <span className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-black">Owned</span>
                ) : (
                  <button
                    onClick={() => buy(item)}
                    disabled={busy !== null || w.status !== "ok" || !canAfford(w, item)}
                    className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-black disabled:opacity-40"
                  >
                    {busy === item.id ? "Buying…" : "Buy"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {note && <p className="mt-3 text-sm font-bold">{note}</p>}
        {example && w.status === "ok" && !gold && !canAfford(w, example) && (
          <p className="mt-2 text-sm font-bold">Not enough gems for {example.name} ({example.price}).</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white/10 p-4">
        <h2 className="text-lg font-black">Try to cheat</h2>
        <p className="mt-1 text-sm font-bold">Writes 99,999 gems and the boots into this browser, the way someone with dev tools would, then asks the server again.</p>
        <div className="mt-3 flex gap-2">
          <button onClick={tryToCheat} className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-black">Try to cheat</button>
          <button onClick={clearCheat} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-bold">Clear it</button>
        </div>
        {cheatNote && <p className="mt-3 text-sm font-bold">{cheatNote}</p>}
      </section>

      <PageGuide page="/star-wallet-dev" />
    </main>
  );
}
