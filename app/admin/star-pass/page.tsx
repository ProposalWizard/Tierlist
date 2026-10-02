"use client";

/**
 * /admin/star-pass — THE REWARD CATALOGUE AND THE STAR PASS LAYOUT
 * (Mikey, 2 Oct 2026).
 *
 * Every reward card in one place, by category (lib/star/rewardCatalogue.ts),
 * and the 20 Star Pass levels (5 … 100). Tap a level, tap a card: it goes
 * there. ↑ / ↓ move a level's card, ✕ empties it. Tap a card's status to
 * move it along (idea → designed → in game). + Idea adds a card for
 * something not built yet. 👁 opens a big preview (spin the 3D ones).
 *
 * Save writes the layout to the shared star_pass_config row
 * (lib/star/starPassStore.ts); every career's Star Pass reads it.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import RewardArt from "@/components/star/RewardArt";
import { CATEGORIES, fullCatalogue, findCard, type CatalogueItem, type RewardCategory, type RewardStatus } from "@/lib/star/rewardCatalogue";
import { REWARD_LEVELS } from "@/lib/star/starPassRewards";
import { defaultLayout, fetchPassLayout, loadPassLayout, savePassLayout, type StarPassLayout } from "@/lib/star/starPassStore";

const STATUS_NEXT: Record<RewardStatus, RewardStatus> = { idea: "designed", designed: "in-game", "in-game": "idea" };
const STATUS_LOOK: Record<RewardStatus, { label: string; bg: string; fg: string }> = {
  idea: { label: "Idea", bg: "#475569", fg: "#ffffff" },
  designed: { label: "Designed", bg: "#2563eb", fg: "#ffffff" },
  "in-game": { label: "In game", bg: "#16a34a", fg: "#ffffff" },
};

export default function StarPassAdmin() {
  const [layout, setLayout] = useState<StarPassLayout>(defaultLayout);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [shared, setShared] = useState<"checking" | "yes" | "missing">("checking");
  const [level, setLevel] = useState<number>(5);
  const [cat, setCat] = useState<RewardCategory>("penalty-runup");
  const [preview, setPreview] = useState<CatalogueItem | null>(null);
  const [idea, setIdea] = useState<{ name: string; note: string } | null>(null);

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
    const i = REWARD_LEVELS.indexOf(level);
    if (i >= 0 && i < REWARD_LEVELS.length - 1) setLevel(REWARD_LEVELS[i + 1]);
  };
  const move = (lv: number, dir: -1 | 1) => {
    const i = REWARD_LEVELS.indexOf(lv), j = i + dir;
    if (j < 0 || j >= REWARD_LEVELS.length) return;
    const other = REWARD_LEVELS[j];
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
  const filled = REWARD_LEVELS.filter((n) => layout.levels[n]).length;

  return (
    <div className="min-h-screen bg-[#0b0f1a] pb-28 text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f1a]/95 px-4 py-3 backdrop-blur">
       <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[18px] font-black uppercase tracking-wide">Star Pass rewards</div>
        <button onClick={() => { change(defaultLayout()); setLevel(5); }} className="rounded px-3 py-2 text-[12px] font-black uppercase text-white ring-1 ring-white/25">Reset</button>
        <button onClick={save} disabled={!dirty} className="rounded px-4 py-2 text-[13px] font-black uppercase text-gray-950 disabled:opacity-40" style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)" }}>Save</button>
       </div>
       <div className="mt-1 text-[12px] font-bold text-white">
        {filled} of {REWARD_LEVELS.length} levels filled
        {shared === "missing" && <span className="text-red-400"> · shared save not set up</span>}
        {msg && <span className={`font-black ${msg.ok ? "text-green-400" : "text-amber-300"}`}> · {msg.text}</span>}
       </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 md:grid-cols-[360px_1fr]">
        {/* The levels. */}
        <div>
          <div className="mb-2 text-[12px] font-black uppercase tracking-widest text-amber-300">Levels</div>
          <div className="space-y-1.5">
            {REWARD_LEVELS.map((n) => {
              const card = findCard(layout.levels[n], catalogue);
              const on = n === level;
              return (
                <div key={n} onClick={() => setLevel(n)} data-level={n} className="flex cursor-pointer items-center gap-2 rounded p-1.5" style={{
                  background: on ? "rgba(253,224,71,.14)" : "rgba(255,255,255,.04)", boxShadow: on ? "inset 0 0 0 2px #fde047" : "inset 0 0 0 1px rgba(255,255,255,.08)",
                }}>
                  <span className="w-9 text-center text-[16px] font-black tabular-nums" style={{ color: n % 10 === 0 ? "#fde047" : "#ffffff" }}>{n}</span>
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded bg-black/40">
                    {card && <RewardArt card={card} w={48} h={48} live={false} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-black">{card ? card.name : on ? "Tap a card →" : "Empty"}</span>
                    {card && <span className="text-[11px] font-bold text-white">{CATEGORIES.find((k) => k.id === card.category)?.label}</span>}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); move(n, 1); }} className="h-8 w-7 rounded text-[14px] font-black ring-1 ring-white/15" aria-label="Move up a level">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); move(n, -1); }} className="h-8 w-7 rounded text-[14px] font-black ring-1 ring-white/15" aria-label="Move down a level">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); clear(n); }} disabled={!card} className="h-8 w-7 rounded text-[13px] font-black ring-1 ring-white/15 disabled:opacity-30" aria-label="Empty this level">✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* The catalogue. */}
        <div>
          <div className="mb-2 text-[12px] font-black uppercase tracking-widest text-amber-300">Catalogue · tap a card to put it at level {level}</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((k) => (
              <button key={k.id} onClick={() => setCat(k.id)} className="rounded px-3 py-1.5 text-[12px] font-black uppercase" style={{
                background: k.id === cat ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.08)", color: k.id === cat ? "#111827" : "#ffffff",
              }}>{k.label} <span className="tabular-nums">{catalogue.filter((c) => c.category === k.id).length}</span></button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((c) => {
              const look = STATUS_LOOK[c.status];
              const at = usedAt[c.id];
              return (
                <div key={c.id} data-card={c.id} className="relative flex flex-col overflow-hidden rounded bg-white/[0.05] ring-1 ring-white/10">
                  <button onClick={() => assign(c)} className="grid h-[120px] place-items-center bg-black/30" aria-label={`Put ${c.name} at level ${level}`}>
                    <RewardArt card={c} w={130} h={115} live={false} />
                  </button>
                  <div className="flex items-center gap-1 px-2 pt-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-black">{c.name}</span>
                    <button onClick={() => setPreview(c)} className="text-[15px]" aria-label="Preview">👁</button>
                  </div>
                  <div className="flex items-center gap-1 px-2 pb-2 pt-1">
                    <button onClick={() => cycleStatus(c)} className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase" style={{ background: look.bg, color: look.fg }}>{look.label}</button>
                    {at != null && <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-black text-gray-950">Lv {at}</span>}
                    {!c.builtIn && <button onClick={() => removeIdea(c)} className="ml-auto text-[11px] font-black text-red-400">Delete</button>}
                  </div>
                </div>
              );
            })}
            {/* + Idea: a card for something not built yet. */}
            {idea ? (
              <div className="flex flex-col gap-1.5 rounded bg-white/[0.05] p-2 ring-1 ring-amber-300/50">
                <input autoFocus value={idea.name} onChange={(e) => setIdea({ ...idea, name: e.target.value })} placeholder="Name" className="rounded bg-black/40 px-2 py-1.5 text-[13px] font-bold text-white placeholder:text-white/60" />
                <textarea value={idea.note} onChange={(e) => setIdea({ ...idea, note: e.target.value })} placeholder="What it is (optional)" rows={3} className="rounded bg-black/40 px-2 py-1.5 text-[12px] font-bold text-white placeholder:text-white/60" />
                <div className="flex gap-1.5">
                  <button onClick={addIdea} className="flex-1 rounded py-1.5 text-[12px] font-black uppercase text-gray-950" style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)" }}>Add</button>
                  <button onClick={() => setIdea(null)} className="rounded px-2 text-[12px] font-black uppercase ring-1 ring-white/25">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIdea({ name: "", note: "" })} className="grid min-h-[170px] place-items-center rounded text-[14px] font-black uppercase text-white ring-1 ring-dashed ring-white/30">+ Idea</button>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="max-w-sm rounded bg-[#111827] p-4 text-center ring-1 ring-white/15" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid place-items-center"><RewardArt card={preview} w={300} h={320} /></div>
            <div className="mt-2 text-[18px] font-black uppercase">{preview.name}</div>
            {preview.note && <div className="mt-1 text-[13px] font-bold text-white">{preview.note}</div>}
            <button onClick={() => setPreview(null)} className="mt-3 rounded px-4 py-2 text-[12px] font-black uppercase ring-1 ring-white/25">Close</button>
          </div>
        </div>
      )}
      <PageGuide page="/admin/star-pass" />
    </div>
  );
}
