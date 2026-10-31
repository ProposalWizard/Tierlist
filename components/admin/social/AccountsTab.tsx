"use client";
/** Accounts: every account the feed uses — change how it looks and how often it posts, or make new ones. */
import { useMemo, useState } from "react";
import type { AccountOverride, Archetype, AvatarGlyph, CustomAccount, Platform } from "@/lib/star/media/types";
import { ARCHETYPES, makePost, newCustomAccount, nowClock, withStudio, type AccountRow } from "@/lib/star/media/studioTools";
import Avatar from "@/components/star/media/Avatar";
import PostCard from "@/components/star/media/PostCard";
import { Btn } from "@/components/admin/broadcast/BroadcastPage";
import { Check, Colour, Field, Num, Select, Text, fmt, useStudio } from "./kit";

const GLYPHS: AvatarGlyph[] = ["crest", "trophy", "ball", "newspaper", "megaphone", "chart", "scoop", "play", "mic", "scarf", "shirt", "grin", "cup", "flag", "quote", "grid", "drum", "boot"];
const PLATFORMS: Platform[] = ["x", "instagram", "youtube", "tiktok", "news"];
const KIND_WORDS: Record<Archetype, string> = {
  club: "Club", league: "League", competition: "Cup / competition", broadsheet: "Newspaper", tabloid: "Tabloid", insider: "Transfer insider",
  stats: "Stats page", aggregator: "News page", pundit: "Pundit", fan: "Fan", rivalFan: "Rival fan", teammate: "Team-mate / you", meme: "Meme page",
};

export default function AccountsTab() {
  const { rows, media } = useStudio();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Archetype | "" | "persona">("");
  const [open, setOpen] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const shown = useMemo(() => rows.filter(r =>
    (!kind || (kind === "persona" ? !!r.account.persona && r.account.archetype !== "club" : r.account.archetype === kind))
    && (!q || `${r.account.name} ${r.account.handle} ${r.key}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, kind]);
  const changed = Object.keys(media.studio?.accountOverrides ?? {}).length;

  return (
    <div className="ss-col">
      <div className="ss-grid3">
        <Field label="Search"><Text value={q} onChange={setQ} placeholder="name or @handle" /></Field>
        <Field label="Kind"><Select value={kind} onChange={setKind} options={[{ value: "", label: "Every kind" }, { value: "persona", label: "Football Twitter (made-up accounts)" }, ...ARCHETYPES.map(a => ({ value: a, label: KIND_WORDS[a] }))]} /></Field>
        <Field label=" "><Btn main onClick={() => { setMaking(true); setOpen(null); }}>+ New account</Btn></Field>
      </div>
      <div className="ss-sub">{rows.length} accounts · {changed} changed · {(media.studio?.customAccounts ?? []).length} made here. Changes show on every post at once (old ones too) and are used for every new post the game makes.</div>
      {making && <NewAccount onDone={() => setMaking(false)} />}
      <div className="ss-list">
        {shown.map(r => (
          <div key={r.key}>
            <div className="ss-item" data-open={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>
              <Avatar initials={r.account.avatar.initials} tint={r.account.avatar.tint} tint2={r.account.avatar.tint2} glyph={r.account.avatar.glyph} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="ss-row" style={{ gap: 6 }}>
                  <b style={{ fontSize: 14 }}>{r.account.name}</b>
                  {r.account.verified && <span title="Blue tick">✔️</span>}
                  <span className="ss-sub">{r.account.handle}</span>
                  <span className="ss-chip">{KIND_WORDS[r.account.archetype]}</span>
                  {r.account.personaLabel && r.account.archetype !== "club" && <span className="ss-chip" data-tone="green">{r.account.personaLabel}</span>}
                  {r.custom && <span className="ss-chip" data-tone="green">made here</span>}
                  {media.studio?.accountOverrides?.[r.key] && <span className="ss-chip" data-tone="amber">changed</span>}
                  {r.account.weight === 0 && <span className="ss-chip" data-tone="red">muted</span>}
                  {r.account.weight !== undefined && r.account.weight > 0 && r.account.weight !== 1 && <span className="ss-chip">posts ×{+r.account.weight.toFixed(2)}</span>}
                </div>
                <div className="ss-sub">{fmt(r.account.followers)} followers · {r.posts} posts in the save{r.account.allegiance ? ` · ${r.account.allegiance.polarity > 0 ? "for" : "against"} ${r.account.allegiance.club}` : ""}</div>
              </div>
            </div>
            {open === r.key && <AccountEditor row={r} onClose={() => setOpen(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountEditor({ row, onClose }: { row: AccountRow; onClose: () => void }) {
  const { media, apply, confirm, career } = useStudio();
  const saved = media.studio?.accountOverrides?.[row.key] ?? {};
  const custom = row.custom ? (media.studio?.customAccounts ?? []).find(a => a.handle === row.key) : undefined;
  const [o, setO] = useState<AccountOverride>(saved);
  const [c, setC] = useState<CustomAccount | undefined>(custom);
  const base = row.original;
  const look = c
    ? { name: c.name, handle: c.handle, verified: c.verified, followers: c.followers, platform: c.platform, ...c.avatar, weight: c.weight }
    : { name: o.name ?? base.name, handle: o.handle ?? base.handle, verified: o.verified ?? base.verified, followers: o.followers ?? base.followers, platform: o.platform ?? base.platform,
        initials: o.initials ?? base.avatar.initials, tint: o.tint ?? base.avatar.tint, tint2: o.tint2 ?? base.avatar.tint2, glyph: o.glyph ?? base.avatar.glyph, weight: o.weight };
  const set = (k: string, v: unknown) => {
    if (c) {
      if (["initials", "tint", "tint2", "glyph"].includes(k)) setC({ ...c, avatar: { ...c.avatar, [k]: v } });
      else setC({ ...c, [k]: v });
    } else setO({ ...o, [k]: v === "" ? undefined : v });
  };
  const save = () => {
    if (c) apply(`Change ${c.name}`, m => withStudio(m, st => ({ ...st, customAccounts: (st.customAccounts ?? []).map(a => (a.handle === row.key ? c : a)) })));
    else apply(`Change ${row.account.name}`, m => withStudio(m, st => {
      const clean = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as AccountOverride;
      const all = { ...(st.accountOverrides ?? {}) };
      if (Object.keys(clean).length) all[row.key] = clean; else delete all[row.key];
      return { ...st, accountOverrides: all };
    }));
  };
  const sample = makePost({
    id: "acct-preview", at: nowClock(career), scope: "club", followers: look.followers,
    author: { handle: look.handle, name: look.name, archetype: row.account.archetype, platform: look.platform, verified: look.verified, initials: look.initials, tint: look.tint, tint2: look.tint2, glyph: look.glyph },
    text: `This is how a post by ${look.name} looks.`,
  });
  return (
    <div className="ss-editor">
      <div className="ss-layout" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,390px)" }}>
        <div className="ss-col">
          <div className="ss-grid2">
            <Field label="Name"><Text value={look.name} onChange={v => set("name", v)} /></Field>
            <Field label="Handle"><Text value={look.handle} onChange={v => set("handle", v)} /></Field>
            <Field label="Followers"><Num value={look.followers} min={0} onChange={v => set("followers", v)} /></Field>
            <Field label="App"><Select value={look.platform} onChange={v => set("platform", v)} options={PLATFORMS.map(p => ({ value: p, label: p }))} /></Field>
            <Field label="Letters on the picture"><Text value={look.initials} onChange={v => set("initials", v.slice(0, 3))} /></Field>
            <Field label="Drawing">
              <Select value={(look.glyph ?? "") as string} onChange={v => set("glyph", v || undefined)} options={[{ value: "", label: "Letters only" }, ...GLYPHS.map(g => ({ value: g, label: g }))]} />
            </Field>
            <Field label="Colour"><Colour value={look.tint} onChange={v => set("tint", v)} /></Field>
            <Field label="Second colour"><Colour value={look.tint2 ?? look.tint} onChange={v => set("tint2", v)} /></Field>
          </div>
          <div className="ss-row">
            <Check value={look.verified} onChange={v => set("verified", v)} label="Blue tick" />
          </div>
          <Field label={`How often it posts: ${look.weight === undefined ? "as the game decides" : look.weight === 0 ? "never (muted)" : `×${look.weight}`}`}>
            <span className="ss-row" style={{ flexWrap: "nowrap" }}>
              <input type="range" min={0} max={5} step={0.25} value={look.weight ?? 1} onChange={e => set("weight", Number(e.target.value))} style={{ flex: 1 }} />
              <Btn onClick={() => set("weight", undefined)}>As the game</Btn>
              <Btn onClick={() => set("weight", 0)}>Mute</Btn>
            </span>
          </Field>
          {c && (
            <div className="ss-grid2">
              <Field label="Kind"><Select value={c.archetype} onChange={archetype => setC({ ...c, archetype })} options={ARCHETYPES.map(a => ({ value: a, label: KIND_WORDS[a] }))} /></Field>
              <Field label="Side (club)">
                <Select value={c.allegiance?.club ?? ""} onChange={club => setC({ ...c, allegiance: club ? { club, polarity: c.allegiance?.polarity ?? 1 } : undefined })}
                  options={[{ value: "", label: "Nobody's (neutral)" }, ...career.league.map(t => ({ value: t.name, label: t.name }))]} />
              </Field>
              {c.allegiance && <Field label="For or against"><Select value={c.allegiance.polarity > 0 ? "for" : "against"} onChange={v => setC({ ...c, allegiance: { ...c.allegiance!, polarity: v === "for" ? 1 : -1 } })} options={[{ value: "for", label: "For them" }, { value: "against", label: "Against them (enjoys their bad days)" }]} /></Field>}
            </div>
          )}
          <div className="ss-row">
            <Btn main onClick={save}>Save account</Btn>
            {!c && Object.keys(saved).length > 0 && <Btn onClick={() => confirm("Back to the game's own?", `${row.original.name} goes back to how the game made it.`, () => { apply(`Reset ${row.original.name}`, m => withStudio(m, st => { const all = { ...(st.accountOverrides ?? {}) }; delete all[row.key]; return { ...st, accountOverrides: all }; })); onClose(); })}>Back to the game&apos;s own</Btn>}
            {c && <button className="bc-btn ss-danger" onClick={() => confirm(`Delete ${c.name}?`, "The account stops posting. Its old posts stay in the feed.", () => { apply(`Delete ${c.name}`, m => withStudio(m, st => ({ ...st, customAccounts: (st.customAccounts ?? []).filter(a => a.handle !== row.key) }))); onClose(); })}>Delete account</button>}
            <Btn onClick={onClose}>Close</Btn>
          </div>
          {!c && <div className="ss-sub">The game&apos;s own: {base.name} · {base.handle} · {fmt(base.followers)} followers.</div>}
        </div>
        <div className="ss-col">
          <span className="ss-sub">Preview</span>
          <div className="ss-card-preview"><PostCard post={sample} now={nowClock(career)} /></div>
        </div>
      </div>
    </div>
  );
}

function NewAccount({ onDone }: { onDone: () => void }) {
  const { apply, career, flash } = useStudio();
  const [a, setA] = useState<CustomAccount>(() => newCustomAccount("", "fan"));
  const save = () => {
    const name = a.name.trim();
    if (!name) { flash("Give it a name."); return; }
    const acc = { ...a, name, handle: a.handle.startsWith("@") ? a.handle : `@${a.handle}` };
    if (acc.handle === "@") acc.handle = newCustomAccount(name, a.archetype).handle;
    apply(`New account ${name}`, m => withStudio(m, st => ({ ...st, customAccounts: [...(st.customAccounts ?? []).filter(x => x.handle !== acc.handle), acc] })));
    onDone();
  };
  return (
    <div className="ss-editor">
      <b>New account</b>
      <div className="ss-grid3">
        <Field label="Name"><Text value={a.name} onChange={name => setA({ ...a, name, avatar: { ...a.avatar, initials: name.split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase() } })} placeholder="The Kop End" /></Field>
        <Field label="Handle"><Text value={a.handle} onChange={handle => setA({ ...a, handle })} placeholder="@thekopend" /></Field>
        <Field label="Kind (how it writes)"><Select value={a.archetype} onChange={archetype => setA({ ...a, archetype })} options={ARCHETYPES.map(k => ({ value: k, label: KIND_WORDS[k] }))} /></Field>
        <Field label="Followers"><Num value={a.followers} min={0} onChange={followers => setA({ ...a, followers })} /></Field>
        <Field label="Colour"><Colour value={a.avatar.tint} onChange={tint => setA({ ...a, avatar: { ...a.avatar, tint } })} /></Field>
        <Field label="Drawing"><Select value={(a.avatar.glyph ?? "") as string} onChange={g => setA({ ...a, avatar: { ...a.avatar, glyph: (g || undefined) as AvatarGlyph | undefined } })} options={[{ value: "", label: "Letters only" }, ...GLYPHS.map(g => ({ value: g, label: g }))]} /></Field>
        <Field label="Side (club)">
          <Select value={a.allegiance?.club ?? ""} onChange={club => setA({ ...a, allegiance: club ? { club, polarity: 1 } : undefined })}
            options={[{ value: "", label: "Nobody's (neutral)" }, ...career.league.map(t => ({ value: t.name, label: t.name }))]} />
        </Field>
        <Field label=" "><Check value={a.verified} onChange={verified => setA({ ...a, verified })} label="Blue tick" /></Field>
      </div>
      <div className="ss-sub">It joins the cast straight away: the game picks it to post about the subjects its kind cares about (a Fan about goals and drama, a Stats page about numbers…). A side makes it care only about that club.</div>
      <div className="ss-row">
        <Avatar initials={a.avatar.initials || "?"} tint={a.avatar.tint} tint2={a.avatar.tint2} glyph={a.avatar.glyph} size={40} />
        <Btn main onClick={save}>Make account</Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </div>
  );
}
