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
import { BroadcastPage, Btn, Pill } from "@/components/admin/broadcast/BroadcastPage";
import "./badges.css";
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
    <BroadcastPage
      title="Club badges"
      sub={`${WITH_SYMBOL} of ${CLUBS.length} clubs get a symbol from their own data. The rest keep a ball or a star.`}
    >
      <div className="cb-tools">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a club"
          className="cb-field cb-search" aria-label="Search a club" />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="cb-field cb-gold" aria-label="Division">
          <option value="All">All divisions</option>
          {AUDIT_GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value as Show)} className="cb-field" aria-label="Which badges">
          <option value="all">Every badge</option>
          <option value="symbol">With a symbol</option>
          <option value="plain">Ball or star</option>
          <option value="changed">Changed here</option>
        </select>
        <div className="cb-look">
          <Pill on={look === "new"} onClick={() => setLook("new")}>New</Pill>
          <Pill on={look === "old"} onClick={() => setLook("old")}>Old</Pill>
        </div>
      </div>
      <div className="cb-status">
        <span className="cb-count">{shown.length} clubs found</span>
        <span className="cb-device">Changes save on this device only. The game on this device shows them too.</span>
        {changed > 0 && (
          <span className="cb-changes">
            <Btn main onClick={copyChanges}>{copied ? "Copied" : `Copy changes (${changed})`}</Btn>
            <Btn onClick={() => { if (confirm("Undo every change on this device?")) clearBadgeOverrides(); }}>Undo all</Btn>
          </span>
        )}
      </div>

      <div className="cb-grid">
        {shown.map(({ club }) => (
          <BadgeCard key={club} club={club} look={look} override={overrides[club]} />
        ))}
      </div>
      <PageGuide page="/admin/badges" />
    </BroadcastPage>
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
    <div className="cb-card" data-changed={override ? "true" : undefined}>
      <div className="cb-disc">
        {look === "new"
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt="" width={64} height={64} />
          : <ClubBadge club={club} size={64} look="old" />}
      </div>
      <div className="cb-text">
        <div className="cb-name" title={club}>{club}</div>
        <div className="cb-sym">{name}</div>
        <div className="cb-why" title={why}>{why}</div>
      </div>
      {look === "new" ? (
        <div className="cb-ctl">
          <select value={emblemValue} onChange={(e) => setEmblem(e.target.value)} aria-label="Emblem" className="cb-field cb-small">
            <option value="">{`Data: ${pick ? pick.symbol : base.emblem}`}</option>
            <option value="ball">Ball</option>
            <option value="star">Star</option>
            <option value="none">Nothing</option>
            {SYMBOL_IDS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="cb-row">
            <button onClick={nextPattern} className="cb-mini">↻ Pattern</button>
            {override && (
              <button onClick={() => setBadgeOverride(club, null)} className="cb-mini cb-undo">Undo</button>
            )}
          </div>
        </div>
      ) : (
        <div className="cb-ctl cb-oldnote">Old: real crest if saved, else initials.</div>
      )}
    </div>
  );
}
