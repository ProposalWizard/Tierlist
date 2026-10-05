"use client";
/**
 * Tester Access (admin) — the body of /admin/testers.
 *
 * "New tester link" makes /tester/XXXXXX. Copy it, send it. A signed-in
 * person who opens it and presses "Become a tester" gets the Star Career
 * developer tools and the play-only test pages. "Switch off" stops a link;
 * "Remove" takes a tester's access away. Everything goes through
 * /api/admin/testers (service key, admins only).
 */
import { useCallback, useEffect, useState } from "react";

interface LinkRow { code: string; created_at: string; active: boolean; uses: number; note: string | null }
interface TesterRow { userId: string; username: string | null; email: string | null; isAdmin: boolean }

export default function TestersAdmin() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [testers, setTesters] = useState<TesterRow[]>([]);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/testers", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Couldn't load");
      setLinks(d.links ?? []);
      setTesters(d.testers ?? []);
      setMissing(!!d.migrationMissing);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't load", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/testers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Something went wrong");
      setMsg({ text: done, ok: true });
      await load();
      return d;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong", ok: false });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const urlFor = (code: string) => `${origin}/tester/${code}`;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(code));
      setMsg({ text: "Link copied.", ok: true });
    } catch {
      setMsg({ text: "Couldn't copy. Press and hold the link to copy it.", ok: false });
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-gray-950 p-4 pb-24 text-white md:p-8">
      <h1 className="text-2xl font-black">Tester Access</h1>
      <p className="mt-1 text-sm font-semibold">
        Testers get the Star Career developer tools (money, skills, skip ahead, switch club…) and the test pages that only play the game. They can&apos;t change anything other people see.
      </p>

      {missing && (
        <p className="mt-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">
          Not set up yet: run supabase/migrations/tester_access.sql in the Supabase SQL Editor. Until then nobody is a tester and links can&apos;t be made.
        </p>
      )}
      {msg && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold ${msg.ok ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{msg.text}</p>
      )}

      {/* ── Links ── */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-black">Links</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={80}
            placeholder="Who it's for (optional)"
            className="min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/50"
          />
          <button
            disabled={busy || missing}
            onClick={async () => {
              const d = await post({ action: "create", note }, "New link made. Copy it and send it to your tester.");
              if (d) setNote("");
            }}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-black disabled:opacity-50"
          >
            New tester link
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-sm">Loading…</p>
        ) : links.length === 0 ? (
          <p className="mt-3 text-sm">No links yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {links.map((l) => (
              <li key={l.code} className={`rounded-xl bg-black/30 p-3 ${l.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-sm font-bold">{urlFor(l.code)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${l.active ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white"}`}>
                    {l.active ? "On" : "Off"}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold">
                  {l.note ? `${l.note} · ` : ""}Used {l.uses} {l.uses === 1 ? "time" : "times"} · made {new Date(l.created_at).toLocaleDateString()}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => copy(l.code)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black">Copy link</button>
                  <button
                    disabled={busy}
                    onClick={() => post({ action: "set-active", code: l.code, active: !l.active }, l.active ? "Link switched off." : "Link switched on.")}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black disabled:opacity-50"
                  >
                    {l.active ? "Switch off" : "Switch on"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Testers ── */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-black">Testers</h2>
        {loading ? (
          <p className="mt-3 text-sm">Loading…</p>
        ) : testers.length === 0 ? (
          <p className="mt-3 text-sm">No testers yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {testers.map((t) => (
              <li key={t.userId} className="flex items-center gap-2 rounded-xl bg-black/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{t.username ?? t.email ?? "No name yet"}{t.isAdmin ? " · admin" : ""}</div>
                  {t.username && t.email && <div className="truncate text-xs">{t.email}</div>}
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove tester access for ${t.username ?? t.email ?? "this person"}?`)) {
                      post({ action: "remove-tester", userId: t.userId }, "Tester removed.");
                    }
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
