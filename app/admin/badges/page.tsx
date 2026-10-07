"use client";

/**
 * /admin/badges — CLUB BADGES (Harry, 7 Oct 2026; BADGES_PLAN.md step 3).
 *
 * Every club's drawn badge in one grid, with the symbol its data gave it and
 * why ("nickname: The Foxes"). Nobody has to tick them off: "Not every single
 * badge needs a symbol, and use the data, not Mikey." A badge that looks
 * wrong can be redone here (another pattern, another symbol, or none) — kept
 * on this device only, and shown in the game on this device too.
 */
import { useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import ClubBadge from "@/components/star/ClubBadge";
import { AUDIT_GROUPS } from "@/lib/star/data/clubAudit";
import { badgeDesign, badgeSvg, PATTERNS, type BadgeOverride } from "@/lib/star/clubBadge";
import { symbolFor, SYMBOL_IDS } from "@/lib/star/badgeSymbols";
import { clearBadgeOverrides, setBadgeOverride, useBadgeOverrides } from "@/lib/star/badgeOverrides";

/** Every club once, under the first list it's in. */
const CLUBS: { club: string; group: string }[] = (() => {
  const seen = new Set<string>();
  const out: { club: string; group: string }[] = [];
  for (const g of AUDIT_GROUPS) for (const club of g.clubs) {
    if (seen.has(club)) continue;
    seen.add(club);
    out.push({ club, group: g.name });
  }
  return out;
})();

const WITH_SYMBOL = CLUBS.filter((c) => symbolFor(c.club)).length;

type Show = "all" | "symbol" | "plain" | "changed";

export default function ClubBadgesPage() {
  const overrides = useBadgeOverrides();
  const [group, setGroup] = useState("All");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [look, setLook] = useState<"new" | "old">("new");
  const [copied, setCopied] = useState(false);

  const shown = useMemo(() => CLUBS.filter((c) =>
    (group === "All" || c.group === group)
    && (!search || c.club.toLowerCase().includes(search.toLowerCase()))
    && (show === "all"
      || (show === "symbol" && symbolFor(c.club))
      || (show === "plain" && !symbolFor(c.club))
      || (show === "changed" && overrides[c.club]))), [group, search, show, overrides]);

  const changed = Object.keys(overrides).length;

  const copyChanges = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(overrides, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: nothing to do */ }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-black">Club Badges</h1>
        <p className="mt-1 text-sm font-bold">
          {WITH_SYMBOL} of {CLUBS.length} clubs get a symbol from their own data. The rest keep a ball or a star.
        </p>
        <p className="mt-1 text-sm font-bold text-amber-300">
          Changes here are saved on this device only. The game on this device shows them too.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded bg-slate-800 px-2 py-2 font-bold text-white">
            <option value="All">All divisions</option>
            {AUDIT_GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
          <select value={show} onChange={(e) => setShow(e.target.value as Show)} className="rounded bg-slate-800 px-2 py-2 font-bold text-white">
            <option value="all">Every badge</option>
            <option value="symbol">With a symbol</option>
            <option value="plain">Ball or star</option>
            <option value="changed">Changed here</option>
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a club"
            className="w-40 rounded bg-slate-800 px-2 py-2 font-bold text-white placeholder:text-white/70" />
          <div className="flex overflow-hidden rounded border border-white/30 font-black">
            {(["new", "old"] as const).map((l) => (
              <button key={l} onClick={() => setLook(l)}
                className={`px-3 py-2 ${look === l ? "bg-white text-slate-950" : "text-white"}`}>
                {l === "new" ? "New" : "Old"}
              </button>
            ))}
          </div>
          {changed > 0 && (
            <>
              <button onClick={copyChanges} className="rounded bg-emerald-600 px-3 py-2 font-black text-white">
                {copied ? "Copied" : `Copy changes (${changed})`}
              </button>
              <button onClick={() => { if (confirm("Undo every change on this device?")) clearBadgeOverrides(); }}
                className="rounded border border-white/30 px-3 py-2 font-black text-white">Undo all</button>
            </>
          )}
          <span className="font-bold">{shown.length} clubs</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map(({ club }) => (
            <BadgeCard key={club} club={club} look={look} override={overrides[club]} />
          ))}
        </div>
      </div>
      <PageGuide page="/admin/badges" />
    </main>
  );
}

function BadgeCard({ club, look, override }: { club: string; look: "new" | "old"; override?: BadgeOverride }) {
  const pick = symbolFor(club);
  const base = badgeDesign(club);
  const d = badgeDesign(club, override);
  const name = d.emblem === "symbol" ? d.symbol : d.emblem === "none" ? "nothing" : d.emblem;
  const why = override
    ? "changed here"
    : pick ? pick.why : base.emblem === "none" ? "star-shaped badge: no emblem" : "no symbol in the data";
  const src = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(club, "a", override))}`,
    [club, override],
  );

  const update = (patch: BadgeOverride, drop: (keyof BadgeOverride)[]) => {
    const next: BadgeOverride = { ...(override ?? {}), ...patch };
    for (const k of drop) delete next[k];
    setBadgeOverride(club, next);
  };
  const nextPattern = () => {
    const p = PATTERNS[(PATTERNS.indexOf(d.pattern) + 1) % PATTERNS.length];
    if (p === base.pattern) update({}, ["pattern"]);
    else update({ pattern: p }, []);
  };
  const emblemValue = override?.symbol ?? (override?.emblem && override.emblem !== "symbol" ? override.emblem : "");
  const setEmblem = (v: string) => {
    if (!v) update({}, ["emblem", "symbol"]);
    else if (v === "ball" || v === "star" || v === "none") update({ emblem: v }, ["symbol"]);
    else update({ symbol: v as BadgeOverride["symbol"] }, ["emblem"]);
  };

  return (
    <div className={`rounded border p-2 ${override ? "border-amber-400" : "border-white/15"} bg-slate-900`}>
      <div className="flex items-center gap-2">
        <div className="grid h-14 w-14 shrink-0 place-items-center">
          {look === "new"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt="" width={56} height={56} />
            : <ClubBadge club={club} size={56} look="old" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black" title={club}>{club}</div>
          <div className="text-xs font-black capitalize text-sky-300">{name}</div>
        </div>
      </div>
      <div className="mt-1 line-clamp-2 text-[11px] font-bold text-white/80" title={why}>{why}</div>
      {look === "new" ? (
        <div className="mt-2 space-y-1">
          <select value={emblemValue} onChange={(e) => setEmblem(e.target.value)} aria-label="Emblem"
            className="w-full rounded bg-slate-700 px-1 py-1 text-xs font-black text-white">
            <option value="">{`Data: ${pick ? pick.symbol : base.emblem}`}</option>
            <option value="ball">Ball</option>
            <option value="star">Star</option>
            <option value="none">Nothing</option>
            {SYMBOL_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={nextPattern} className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs font-black">↻ Pattern</button>
            {override && (
              <button onClick={() => setBadgeOverride(club, null)} className="rounded border border-white/30 px-2 py-1 text-xs font-black">Undo</button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] font-bold text-white/70">Old: real crest if saved, else initials.</div>
      )}
    </div>
  );
}
