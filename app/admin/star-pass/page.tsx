"use client";

/**
 * /admin/star-pass — THE REWARD CATALOGUE AND THE STAR PASS LAYOUT
 * (Mikey, 2 Oct 2026).
 *
 * Every reward card in one place, by category (lib/star/rewardCatalogue.ts),
 * and the Star Pass's 100 levels. A reward can sit at ANY level (5 Oct
 * 2026: "2, 4, 6 … or 5, 10, 15 … or 1 to 9"). Tap a level in the grid, tap
 * a card: it goes there. ↑ / ↓ move a card one level, ✕ empties it. Tap a card's status to
 * move it along (idea → designed → in game). + Idea adds a card for
 * something not built yet. 👁 opens a big preview (spin the 3D ones).
 *
 * Look (Harry, 19 Oct 2026, round 3 option B "Tiers"): the Broadcast frame,
 * reward types down the left, the 100 levels as five tiers of 20 (one card
 * each, with the rewards in it), and "Edit tier" opens that tier's levels
 * beside the catalogue.
 *
 * Save writes the layout to the shared star_pass_config row
 * (lib/star/starPassStore.ts); every career's Star Pass reads it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Label } from "@/components/admin/broadcast/BroadcastPage";
import "./star-pass.css";
import RewardArt from "@/components/star/RewardArt";
import { CATEGORIES, fullCatalogue, findCard, type CatalogueItem, type RewardCategory, type RewardStatus } from "@/lib/star/rewardCatalogue";
import { ALL_PASS_LEVELS, PASS_TOP } from "@/lib/star/starPassRewards";
import { defaultLayout, fetchPassLayout, loadPassLayout, savePassLayout, type StarPassLayout } from "@/lib/star/starPassStore";

const STATUS_NEXT: Record<RewardStatus, RewardStatus> = { idea: "designed", designed: "in-game", "in-game": "idea" };
const STATUS_LOOK: Record<RewardStatus, { label: string; bg: string; fg: string }> = {
  idea: { label: "Idea", bg: "#475569", fg: "#ffffff" },
  designed: { label: "Designed", bg: "#2563eb", fg: "#ffffff" },
  "in-game": { label: "In game", bg: "#16a34a", fg: "#ffffff" },
};

/** The 100 levels as five tiers of 20 (the picked look's cards). */
const TIER_SIZE = 20;
const TIER_NAMES = ["Rookie", "Pro", "Star", "Legend", "Icon"];
const TIERS = Array.from({ length: Math.ceil(PASS_TOP / TIER_SIZE) }, (_, i) => ({
  i, name: TIER_NAMES[i] ?? `Tier ${i + 1}`, from: i * TIER_SIZE + 1, to: Math.min(PASS_TOP, (i + 1) * TIER_SIZE),
}));
const tierOf = (lv: number) => Math.min(TIERS.length - 1, Math.floor((lv - 1) / TIER_SIZE));

export default function StarPassAdmin() {
  const [layout, setLayout] = useState<StarPassLayout>(defaultLayout);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [shared, setShared] = useState<"checking" | "yes" | "missing">("checking");
  const [level, setLevel] = useState<number>(5);
  const [cat, setCat] = useState<RewardCategory>("penalty-runup");
  const [preview, setPreview] = useState<CatalogueItem | null>(null);
  const [idea, setIdea] = useState<{ name: string; note: string } | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayout(loadPassLayout());
    fetchPassLayout().then(({ layout: l, migrationMissing }) => {
      setShared(migrationMissing ? "missing" : "yes");
      if (l) setLayout(l);
    });
  }, []);

  const catalogue = useMemo(() => fullCatalogue(layout.ideas, layout.status), [layout]);
  const usedAt = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [lv, id] of Object.entries(layout.levels)) m[id] = Number(lv);
    return m;
  }, [layout]);
  const change = (l: StarPassLayout) => { setLayout(l); setDirty(true); setMsg(null); };

  const assign = (card: CatalogueItem) => {
    const levels = { ...layout.levels };
    for (const [lv, id] of Object.entries(levels)) if (id === card.id) delete levels[Number(lv)]; // a card sits at one level
    levels[level] = card.id;
    change({ ...layout, levels });
  };
  const move = (lv: number, dir: -1 | 1) => {
    const other = lv + dir;
    if (other < 1 || other > PASS_TOP) return;
    const levels = { ...layout.levels };
    const a = levels[lv], b = levels[other];
    if (b) levels[lv] = b; else delete levels[lv];
    if (a) levels[other] = a; else delete levels[other];
    change({ ...layout, levels });
    setLevel(other);
  };
  const clear = (lv: number) => { const levels = { ...layout.levels }; delete levels[lv]; change({ ...layout, levels }); };
  const cycleStatus = (card: CatalogueItem) => change({ ...layout, status: { ...layout.status, [card.id]: STATUS_NEXT[card.status] } });
  const addIdea = () => {
    if (!idea?.name.trim()) return;
    const card: CatalogueItem = {
      id: `idea-${Date.now().toString(36)}`, name: idea.name.trim(), category: cat, status: "idea",
      grant: { kind: "collectible", slot: "trophy" }, art: { icon: "💡", color: "#94a3b8" }, note: idea.note.trim() || undefined,
    };
    change({ ...layout, ideas: [...layout.ideas, card] });
    setIdea(null);
  };
  const removeIdea = (card: CatalogueItem) => {
    const levels = { ...layout.levels };
    for (const [lv, id] of Object.entries(levels)) if (id === card.id) delete levels[Number(lv)];
    change({ ...layout, ideas: layout.ideas.filter((i) => i.id !== card.id), levels });
  };
  const save = async () => {
    const r = await savePassLayout(layout);
    setDirty(false);
    setMsg(r.shared ? { text: "Saved for everyone", ok: true } : { text: `Saved on this device only (${r.reason})`, ok: false });
  };

  const cards = catalogue.filter((c) => c.category === cat);
  const filledLevels = ALL_PASS_LEVELS.filter((n) => layout.levels[n]);
  const filled = filledLevels.length;
  const tier = TIERS[tierOf(level)];
  // The rows: every level in the open tier with a card, plus the one you've picked.
  const rowLevels = Array.from(new Set([...filledLevels.filter((n) => n >= tier.from && n <= tier.to), level])).sort((a, b) => a - b);
  const openTier = (t: (typeof TIERS)[number]) => {
    if (tierOf(level) !== t.i) setLevel(t.from);
    // On a phone the tier's levels sit below the cards: bring them up.
    requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const catButtons = (cls: string) => CATEGORIES.map((k) => (
    <button key={k.id} onClick={() => setCat(k.id)} aria-pressed={k.id === cat} className={cls}>
      <span>{k.label}</span> <b>{catalogue.filter((c) => c.category === k.id).length}</b>
    </button>
  ));

  return (
    <BroadcastPage
      title="Star Pass"
      sub={<>
        {filled} {filled === 1 ? "reward" : "rewards"} on the road
        {shared === "missing" && <span className="sp-warn"> · shared save not set up</span>}
        {msg && <span className={msg.ok ? "sp-ok" : "sp-warn"}> · {msg.text}</span>}
      </>}
      actions={<>
        <Btn onClick={() => { change(defaultLayout()); setLevel(5); }}>Reset</Btn>
        <Btn main onClick={save} disabled={!dirty}>Save</Btn>
      </>}
    >
      <div className="sp-layout">
        {/* Reward types (the catalogue's tabs), down the left on a computer. */}
        <aside className="sp-rail">
          <Label>Reward types</Label>
          <div className="sp-types">{catButtons("sp-type")}</div>
        </aside>

        <div className="sp-main">
          {/* The five tiers. */}
          <div className="sp-tiers">
            {TIERS.map((t) => {
              const lvls = ALL_PASS_LEVELS.filter((n) => n >= t.from && n <= t.to);
              const inTier = lvls.filter((n) => layout.levels[n]);
              const shown = inTier.slice(0, 3).map((n) => findCard(layout.levels[n], catalogue)).filter((c): c is CatalogueItem => !!c);
              const open = tierOf(level) === t.i;
              return (
                <section key={t.i} className="sp-tier" data-open={open ? "true" : undefined} data-tier={t.i + 1}>
                  <h3>{t.name} <span>(levels {t.from}–{t.to})</span></h3>
                  <div className="sp-tier-pic">
                    {shown.length ? shown.map((c) => (
                      <span key={c.id} className="sp-tier-art"><RewardArt card={c} w={92} h={92} live={false} /></span>
                    )) : <span className="sp-tier-empty">No rewards yet</span>}
                  </div>
                  <div className="sp-tier-foot">
                    <div className="sp-tier-count">
                      <b>{inTier.length}/{lvls.length}</b> levels filled
                      <span className="sp-bar"><i style={{ width: `${(inTier.length / lvls.length) * 100}%` }} /></span>
                    </div>
                    <button className="sp-edit" aria-pressed={open} onClick={() => openTier(t)}>{open ? "Editing" : "Edit tier"}</button>
                  </div>
                </section>
              );
            })}
          </div>

          {/* The open tier: its levels and the catalogue. */}
          <div className="sp-edit-grid" ref={editRef}>
            <Panel title={`${tier.name} · levels ${tier.from}–${tier.to}`} note="tap a level to pick it">
              {/* This tier's 20 levels. Gold: has a reward. Ringed: picked. */}
              <div className="sp-levels" data-level-grid>
                {ALL_PASS_LEVELS.filter((n) => n >= tier.from && n <= tier.to).map((n) => (
                  <button key={n} onClick={() => setLevel(n)} data-pick-level={n} aria-label={`Level ${n}`}
                    className="sp-lv" data-has={layout.levels[n] ? "true" : undefined} aria-pressed={n === level}>{n}</button>
                ))}
              </div>
              <Label>On the road</Label>
              <div className="sp-rows">
                {rowLevels.map((n) => {
                  const card = findCard(layout.levels[n], catalogue);
                  const on = n === level;
                  return (
                    <div key={n} onClick={() => setLevel(n)} data-level={n} className="sp-row" data-on={on ? "true" : undefined}>
                      <span className="sp-row-n" data-ten={n % 10 === 0 ? "true" : undefined}>{n}</span>
                      <span className="sp-row-art">{card && <RewardArt card={card} w={48} h={48} live={false} />}</span>
                      <span className="sp-row-txt">
                        <b>{card ? card.name : on ? "Tap a card →" : "Empty"}</b>
                        {card && <span>{CATEGORIES.find((k) => k.id === card.category)?.label}</span>}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); move(n, 1); }} className="sp-sq" aria-label="Move up a level">↑</button>
                      <button onClick={(e) => { e.stopPropagation(); move(n, -1); }} className="sp-sq" aria-label="Move down a level">↓</button>
                      <button onClick={(e) => { e.stopPropagation(); clear(n); }} disabled={!card} className="sp-sq" aria-label="Empty this level">✕</button>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Catalogue" note={`tap a card to put it at level ${level}`}>
              {/* On a phone the reward types sit here (the left rail is hidden). */}
              <div className="sp-chips">{catButtons("sp-chip")}</div>
              <div className="sp-cards">
                {cards.map((c) => {
                  const look = STATUS_LOOK[c.status];
                  const at = usedAt[c.id];
                  return (
                    <div key={c.id} data-card={c.id} className="sp-card">
                      <button onClick={() => assign(c)} className="sp-card-pic" aria-label={`Put ${c.name} at level ${level}`}>
                        <RewardArt card={c} w={130} h={115} live={false} />
                      </button>
                      <div className="sp-card-name">
                        <b>{c.name}</b>
                        <button onClick={() => setPreview(c)} className="sp-eye" aria-label="Preview">👁</button>
                      </div>
                      <div className="sp-card-tags">
                        <button onClick={() => cycleStatus(c)} className="sp-tag" style={{ background: look.bg, color: look.fg }}>{look.label}</button>
                        {at != null && <span className="sp-tag sp-lvtag">Lv {at}</span>}
                        {!c.builtIn && <button onClick={() => removeIdea(c)} className="sp-del">Delete</button>}
                      </div>
                    </div>
                  );
                })}
                {/* + Idea: a card for something not built yet. */}
                {idea ? (
                  <div className="sp-idea">
                    <input autoFocus value={idea.name} onChange={(e) => setIdea({ ...idea, name: e.target.value })} placeholder="Name" />
                    <textarea value={idea.note} onChange={(e) => setIdea({ ...idea, note: e.target.value })} placeholder="What it is (optional)" rows={3} />
                    <div className="sp-idea-btns">
                      <Btn main onClick={addIdea}>Add</Btn>
                      <Btn onClick={() => setIdea(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIdea({ name: "", note: "" })} className="sp-add">+ Idea</button>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {preview && (
        <div className="sp-modal" onClick={() => setPreview(null)}>
          <div className="sp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-art"><RewardArt card={preview} w={300} h={320} /></div>
            <h3>{preview.name}</h3>
            {preview.note && <p>{preview.note}</p>}
            <Btn onClick={() => setPreview(null)}>Close</Btn>
          </div>
        </div>
      )}
      <PageGuide page="/admin/star-pass" />
    </BroadcastPage>
  );
}
