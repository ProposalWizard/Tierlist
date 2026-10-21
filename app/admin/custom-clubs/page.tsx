"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES, compressImage } from "@/lib/imageUtils";
import { fetchLeagueSquads } from "@/lib/star/leagueSquads";
import { KitSwatch } from "@/components/star/Investments";
import LineupBuilder from "@/components/star/LineupBuilder";
import type { LeagueSquad } from "@/lib/star/types";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./custom-clubs.css";

/**
 * CUSTOM CLUBS — CREATE A WHOLE FAKE CLUB FROM SCRATCH.
 *
 * Requested directly: a name, a kit (real colours, not a scraped one), a
 * badge, a stadium name, and a real roster of invented players (name,
 * rating, potential tier, age, nationality, a face) — every one of them
 * editable again after creation, plus a real lineup for it. All of it
 * later votable into a real competition via the Rule Book
 * (RuleBookScreen.tsx's own "Custom Clubs" section).
 *
 * Deliberately reuses as much of this game's REAL machinery as possible
 * rather than building a parallel system: a custom player is a genuine
 * `sofifa_players` row (only a `custom:`-prefixed id marks it as invented),
 * so `fetchLeagueSquads` — the exact function real career squads use — just
 * works for it, and so does the shared `LineupBuilder` component below.
 *
 * Layout: option 1 of the 19 Oct 2026 lookover, on the Broadcast frame — the
 * clubs list on the left, the picked club's editor on the right (stacked on a
 * phone). Page-only styling: custom-clubs.css.
 */

const VALID_POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

interface CustomClub {
  name: string;
  stadium_name: string;
  home_shirt: string;
  home_trim: string;
  away_shirt: string;
  away_trim: string;
}

interface CustomPlayerRow {
  sofifa_id: string;
  name: string;
  positions: string | null;
  overall: number | null;
  age: number | null;
  nationality: string | null;
  image_url: string | null;
  high_potential: boolean;
  world_class_potential: boolean;
}

async function uploadImage(file: File, folder: string): Promise<string> {
  const compressed = await compressImage(file);
  const supabase = createClient();
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { data, error } = await supabase.storage.from("tierlist-images").upload(path, compressed, { upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(data.path);
  return urlData.publicUrl;
}

function potentialOf(p: { high_potential: boolean; world_class_potential: boolean }): "none" | "high" | "worldClass" {
  if (p.world_class_potential) return "worldClass";
  if (p.high_potential) return "high";
  return "none";
}

export default function CustomClubsAdminPage() {
  const [clubs, setClubs] = useState<CustomClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newClubName, setNewClubName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"kit" | "squad" | "lineup">("kit");

  const loadClubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/custom-clubs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setClubs(json.clubs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const createClub = async () => {
    if (!newClubName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/custom-clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClubName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create");
      setNewClubName("");
      await loadClubs();
      setSelected(json.club.name);
      setTab("kit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const deleteClub = async (name: string) => {
    if (!confirm(`Delete "${name}" and every player on its roster? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/custom-clubs?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      if (selected === name) setSelected(null);
      await loadClubs();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to delete");
    }
  };

  const selectedClub = clubs.find(c => c.name === selected) ?? null;

  return (
    <BroadcastPage title="Custom clubs" sub="Invent a club: kit, badge, stadium and a squad. Vote it into a real competition from the Rule Book." width={1280}>
      {error && <div className="cc-error">{error}</div>}

      <div className="cc-layout">
        {/* ── Club list ── */}
        <Panel title="Clubs list" note={loading ? "Loading…" : `${clubs.length}`}>
          <div className="cc-add">
            <input
              value={newClubName}
              onChange={e => setNewClubName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createClub()}
              placeholder="New club name…"
              className="cc-input"
            />
            <Btn main onClick={createClub} disabled={creating || !newClubName.trim()}>+ Add</Btn>
          </div>
          <div className="cc-clubs">
            {loading && <Note>Loading…</Note>}
            {!loading && clubs.length === 0 && <Note>No custom clubs yet. Add one above.</Note>}
            {clubs.map(c => (
              <button
                key={c.name}
                onClick={() => { setSelected(c.name); setTab("kit"); }}
                className="cc-club"
                aria-pressed={selected === c.name}
              >
                <KitSwatch kit={{ shirt: c.home_shirt, trim: c.home_trim }} size={34} />
                <span>{c.name}</span>
                {selected === c.name && <i aria-hidden>✓</i>}
              </button>
            ))}
          </div>
        </Panel>

        {/* ── Selected club editor ── */}
        <Panel
          title={selectedClub ? `Edit club: ${selectedClub.name}` : "Edit club"}
          note={selectedClub ? (
            <button onClick={() => deleteClub(selectedClub.name)} className="cc-del">Delete club</button>
          ) : undefined}
        >
          {!selectedClub && <div className="cc-empty">Pick a club on the left, or add a new one.</div>}
          {selectedClub && (
            <>
              <div className="cc-tabs">
                {(["kit", "squad", "lineup"] as const).map(t => (
                  <Pill key={t} on={tab === t} onClick={() => setTab(t)}>
                    {t === "kit" ? "Kit & badge" : t}
                  </Pill>
                ))}
              </div>

              {tab === "kit" && <KitAndBadgeEditor club={selectedClub} onSaved={loadClubs} />}
              {tab === "squad" && <SquadEditor club={selectedClub.name} />}
              {tab === "lineup" && <LineupTab club={selectedClub.name} />}
            </>
          )}
        </Panel>
      </div>
      <PageGuide page="/admin/custom-clubs" />
    </BroadcastPage>
  );
}

// ── Kit, badge, and stadium name ────────────────────────────────────────
function KitAndBadgeEditor({ club, onSaved }: { club: CustomClub; onSaved: () => void }) {
  const [stadiumName, setStadiumName] = useState(club.stadium_name);
  const [homeShirt, setHomeShirt] = useState(club.home_shirt);
  const [homeTrim, setHomeTrim] = useState(club.home_trim);
  const [awayShirt, setAwayShirt] = useState(club.away_shirt);
  const [awayTrim, setAwayTrim] = useState(club.away_trim);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setStadiumName(club.stadium_name);
    setHomeShirt(club.home_shirt); setHomeTrim(club.home_trim);
    setAwayShirt(club.away_shirt); setAwayTrim(club.away_trim);
    setMessage(null);
    const supabase = createClient();
    supabase.from("club_logos").select("logo_url").eq("club", club.name).maybeSingle()
      .then(({ data }) => setLogoUrl(data?.logo_url ?? null));
  }, [club]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/custom-clubs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: club.name, stadium_name: stadiumName, home_shirt: homeShirt, home_trim: homeTrim, away_shirt: awayShirt, away_trim: awayTrim }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setMessage("Saved.");
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const url = await uploadImage(file, "custom-club-logos");
      // club_logos is public-read only — no anon write policy — so this
      // goes through the admin API route's service-role client, not a
      // direct client-side write (which RLS would silently refuse).
      const res = await fetch("/api/admin/custom-clubs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: club.name, logo_url: url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save badge");
      setLogoUrl(url);
      setMessage("Badge uploaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cc-kit">
      <div className="cc-kit-main">
        <div className="cc-field">
          <Label>Stadium</Label>
          <input value={stadiumName} onChange={e => setStadiumName(e.target.value)} className="cc-input" />
        </div>

        <div className="cc-field">
          <Label>Kit colours: home &amp; away</Label>
          <div className="cc-kits">
            {([
              ["Home", homeShirt, setHomeShirt, homeTrim, setHomeTrim],
              ["Away", awayShirt, setAwayShirt, awayTrim, setAwayTrim],
            ] as const).map(([label, shirt, setShirt, trim, setTrim]) => (
              <div key={label} className="cc-kitcard">
                <b>{label}</b>
                <KitSwatch kit={{ shirt, trim }} size={72} />
                <div className="cc-swatches">
                  <label className="cc-swatch">
                    <input type="color" value={shirt} onChange={e => setShirt(e.target.value)} />
                    <span>Shirt</span>
                  </label>
                  <label className="cc-swatch">
                    <input type="color" value={trim} onChange={e => setTrim(e.target.value)} />
                    <span>Trim</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cc-field cc-badge">
        <Label>Badge</Label>
        <label className="cc-drop">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            <span className="cc-drop-icon" aria-hidden>⇪</span>
          )}
          <span>{uploading ? "Uploading…" : "Upload badge"}</span>
          <input
            type="file" accept={ACCEPT_IMAGE_TYPES} className="hidden" disabled={uploading}
            onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
          />
        </label>
      </div>

      <div className="cc-foot">
        {message && <div className="cc-msg">{message}</div>}
        <Btn main onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
      </div>
    </div>
  );
}

// ── Squad: create/edit/delete players from scratch ──────────────────────
function SquadEditor({ club }: { club: string }) {
  const [players, setPlayers] = useState<CustomPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/custom-clubs/players?club=${encodeURIComponent(club)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setPlayers(json.players ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [club]);

  useEffect(() => { load(); setEditing(null); }, [load]);

  const deletePlayer = async (sofifa_id: string) => {
    if (!confirm("Delete this player?")) return;
    const res = await fetch(`/api/admin/custom-clubs/players?sofifa_id=${encodeURIComponent(sofifa_id)}`, { method: "DELETE" });
    if (res.ok) load();
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? "Failed to delete"); }
  };

  if (editing) {
    return (
      <PlayerForm
        club={club}
        player={editing === "new" ? null : players.find(p => p.sofifa_id === editing) ?? null}
        onDone={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="cc-squad">
      {error && <div className="cc-error">{error}</div>}
      <div className="cc-squad-head">
        <Label>Squad list</Label>
        <Btn main onClick={() => setEditing("new")}>+ Create a new player</Btn>
      </div>
      <div className="cc-rows">
        {loading && <Note>Loading…</Note>}
        {!loading && players.length === 0 && <Note>No players yet.</Note>}
        {players.map(p => (
          <div key={p.sofifa_id} className="cc-row">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" className="cc-face" />
            ) : (
              <div className="cc-face" />
            )}
            <div className="cc-row-txt">
              <b>{p.name}</b>
              <span>
                {p.positions} · OVR {p.overall} · Age {p.age} · {p.nationality || "—"}
                {p.world_class_potential ? " · World Class" : p.high_potential ? " · High Potential" : ""}
              </span>
            </div>
            <button onClick={() => setEditing(p.sofifa_id)} className="cc-mini">Edit</button>
            <button onClick={() => deletePlayer(p.sofifa_id)} className="cc-mini" data-danger="true">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerForm({ club, player, onDone, onCancel }: {
  club: string; player: CustomPlayerRow | null; onDone: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(player?.name ?? "");
  const [positions, setPositions] = useState<string[]>((player?.positions ?? "").split(/[^A-Za-z]+/).filter(Boolean));
  const [overall, setOverall] = useState(String(player?.overall ?? 65));
  const [age, setAge] = useState(String(player?.age ?? 24));
  const [nationality, setNationality] = useState(player?.nationality ?? "");
  const [potential, setPotential] = useState<"none" | "high" | "worldClass">(player ? potentialOf(player) : "none");
  const [imageUrl, setImageUrl] = useState(player?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePos = (pos: string) => setPositions(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);

  const uploadFace = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, "custom-players");
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim() || positions.length === 0) { setError("A name and at least one position are required."); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        club, name: name.trim(), positions: positions.join(", "),
        overall: Number(overall), age: Number(age), nationality: nationality.trim(),
        potential, image_url: imageUrl,
      };
      const res = player
        ? await fetch("/api/admin/custom-clubs/players", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sofifa_id: player.sofifa_id, ...body }),
          })
        : await fetch("/api/admin/custom-clubs/players", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cc-form">
      <div className="cc-form-title">{player ? "Edit player" : "New player"}</div>
      {error && <div className="cc-error">{error}</div>}

      <div className="cc-face-row">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="cc-face cc-face-big" />
        ) : (
          <div className="cc-face cc-face-big" />
        )}
        <label className="cc-mini cc-upload">
          {uploading ? "Uploading…" : "Upload face"}
          <input type="file" accept={ACCEPT_IMAGE_TYPES} className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && uploadFace(e.target.files[0])} />
        </label>
      </div>

      <div className="cc-field">
        <Label>Name</Label>
        <input value={name} onChange={e => setName(e.target.value)} className="cc-input" />
      </div>

      <div className="cc-field">
        <Label>Position(s): every one he can play</Label>
        <div className="cc-chips">
          {VALID_POSITIONS.map(pos => (
            <Pill key={pos} on={positions.includes(pos)} onClick={() => togglePos(pos)}>{pos}</Pill>
          ))}
        </div>
      </div>

      <div className="cc-two">
        <div className="cc-field">
          <Label>Overall (40-99)</Label>
          <input type="number" min={40} max={99} value={overall} onChange={e => setOverall(e.target.value)} className="cc-input" />
        </div>
        <div className="cc-field">
          <Label>Age</Label>
          <input type="number" min={15} max={45} value={age} onChange={e => setAge(e.target.value)} className="cc-input" />
        </div>
      </div>

      <div className="cc-field">
        <Label>Nationality</Label>
        <input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. England" className="cc-input" />
      </div>

      <div className="cc-field">
        <Label>Potential</Label>
        <div className="cc-chips">
          {(["none", "high", "worldClass"] as const).map(t => (
            <Pill key={t} on={potential === t} onClick={() => setPotential(t)}>
              {t === "none" ? "Ordinary" : t === "high" ? "High Potential" : "World Class"}
            </Pill>
          ))}
        </div>
      </div>

      <div className="cc-foot">
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn main onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </div>
    </div>
  );
}

// ── Lineup: the exact same builder a real career uses ────────────────────
function LineupTab({ club }: { club: string }) {
  const [squad, setSquad] = useState<LeagueSquad | null>(null);

  useEffect(() => {
    setSquad(null);
    fetchLeagueSquads([club]).then(squads => setSquad(squads[0] ?? { club, players: [] }));
  }, [club]);

  if (!squad) return <div className="cc-empty">Loading squad…</div>;
  if (squad.players.length === 0) {
    return <div className="cc-empty">Add some players in the Squad tab first. A lineup needs a squad to pick from.</div>;
  }
  return <div className="cc-lineup"><LineupBuilder clubs={[club]} squads={[squad]} initialClub={club} /></div>;
}
