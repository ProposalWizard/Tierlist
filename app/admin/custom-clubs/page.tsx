"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES, compressImage } from "@/lib/imageUtils";
import { fetchLeagueSquads } from "@/lib/star/leagueSquads";
import { KitSwatch } from "@/components/star/Investments";
import LineupBuilder from "@/components/star/LineupBuilder";
import type { LeagueSquad } from "@/lib/star/types";
import PageGuide from "@/components/admin/PageGuide";

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
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-xs text-white/60 mb-3">
          <Link href="/admin" className="hover:text-white transition-colors">Admin</Link>
          <span className="mx-1.5">/</span>
          <span className="text-white/85">Custom Clubs</span>
        </div>
        <h1 className="text-2xl font-black mb-1">Custom Clubs</h1>
        <p className="text-sm text-white/70 mb-4">
          Invent a fake club — kit, badge, stadium, and a full roster built from scratch. Vote it into a real
          competition from the Rule Book once it&apos;s ready.
        </p>

        {error && (
          <div className="mb-3 rounded-lg bg-red-950/60 border border-red-700 px-3 py-2 text-sm text-red-200">{error}</div>
        )}

        <div className="grid md:grid-cols-[240px_1fr] gap-4">
          {/* ── Club list ── */}
          <div>
            <div className="flex gap-1.5 mb-2">
              <input
                value={newClubName}
                onChange={e => setNewClubName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createClub()}
                placeholder="New club name…"
                className="flex-1 min-w-0 rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm"
              />
              <button
                onClick={createClub}
                disabled={creating || !newClubName.trim()}
                className="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-xs"
              >
                + Add
              </button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {loading && <div className="px-3 py-4 text-xs text-white/60">Loading…</div>}
              {!loading && clubs.length === 0 && (
                <div className="px-3 py-4 text-xs text-white/60">No custom clubs yet — add one above.</div>
              )}
              {clubs.map(c => (
                <button
                  key={c.name}
                  onClick={() => { setSelected(c.name); setTab("kit"); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-black/30 last:border-b-0 ${
                    selected === c.name ? "bg-emerald-900/40" : "hover:bg-gray-800"
                  }`}
                >
                  <KitSwatch kit={{ shirt: c.home_shirt, trim: c.home_trim }} size={24} />
                  <span className="text-sm font-bold truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Selected club editor ── */}
          <div>
            {!selectedClub && (
              <div className="text-sm text-white/60 py-10 text-center">Pick a club on the left, or create a new one.</div>
            )}
            {selectedClub && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-black">{selectedClub.name}</h2>
                  <button
                    onClick={() => deleteClub(selectedClub.name)}
                    className="text-[10px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest"
                  >
                    Delete club
                  </button>
                </div>
                <div className="flex gap-1 mb-3">
                  {(["kit", "squad", "lineup"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase ${tab === t ? "bg-emerald-600" : "bg-gray-800 text-white/70"}`}
                    >
                      {t === "kit" ? "Kit & badge" : t}
                    </button>
                  ))}
                </div>

                {tab === "kit" && <KitAndBadgeEditor club={selectedClub} onSaved={loadClubs} />}
                {tab === "squad" && <SquadEditor club={selectedClub.name} />}
                {tab === "lineup" && <LineupTab club={selectedClub.name} />}
              </div>
            )}
          </div>
        </div>
      </div>
      <PageGuide page="/admin/custom-clubs" />
    </div>
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
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Badge</div>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-14 h-14 object-contain bg-gray-800 rounded" />
          ) : (
            <div className="w-14 h-14 rounded bg-gray-800 grid place-items-center text-[9px] text-white/50">None</div>
          )}
          <label className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-black cursor-pointer">
            {uploading ? "Uploading…" : "Upload badge"}
            <input
              type="file" accept={ACCEPT_IMAGE_TYPES} className="hidden" disabled={uploading}
              onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Stadium</div>
        <input
          value={stadiumName} onChange={e => setStadiumName(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Kit — home &amp; away</div>
        <div className="grid grid-cols-2 gap-3">
          {([
            ["Home", homeShirt, setHomeShirt, homeTrim, setHomeTrim],
            ["Away", awayShirt, setAwayShirt, awayTrim, setAwayTrim],
          ] as const).map(([label, shirt, setShirt, trim, setTrim]) => (
            <div key={label}>
              <div className="text-[9px] font-bold text-white/70 mb-1">{label}</div>
              <div className="flex items-center gap-2">
                <KitSwatch kit={{ shirt, trim }} size={40} />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={shirt} onChange={e => setShirt(e.target.value)} className="w-6 h-6 rounded" />
                    <span className="text-[9px] text-white/60">Shirt</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={trim} onChange={e => setTrim(e.target.value)} className="w-6 h-6 rounded" />
                    <span className="text-[9px] text-white/60">Trim</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {message && <div className="text-xs text-emerald-300 font-bold">{message}</div>}
      <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm">
        {saving ? "Saving…" : "Save"}
      </button>
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
    <div>
      {error && <div className="mb-2 text-xs text-red-300">{error}</div>}
      <button onClick={() => setEditing("new")} className="w-full mb-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-black text-sm">
        + Create a new player
      </button>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {loading && <div className="px-3 py-4 text-xs text-white/60">Loading…</div>}
        {!loading && players.length === 0 && <div className="px-3 py-4 text-xs text-white/60">No players yet.</div>}
        {players.map(p => (
          <div key={p.sofifa_id} className="flex items-center gap-2 px-3 py-2 border-b border-black/30 last:border-b-0">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" className="w-9 h-9 rounded-full object-cover bg-gray-800" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-800" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{p.name}</div>
              <div className="text-[10px] text-white/60">
                {p.positions} · OVR {p.overall} · Age {p.age} · {p.nationality || "—"}
                {p.world_class_potential ? " · World Class" : p.high_potential ? " · High Potential" : ""}
              </div>
            </div>
            <button onClick={() => setEditing(p.sofifa_id)} className="px-2.5 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black">Edit</button>
            <button onClick={() => deletePlayer(p.sofifa_id)} className="px-2.5 py-1 rounded-md bg-red-700/80 hover:bg-red-600 text-[10px] font-black">Delete</button>
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
    <div className="space-y-3">
      <div className="text-sm font-black">{player ? "Edit player" : "New player"}</div>
      {error && <div className="text-xs text-red-300">{error}</div>}

      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-16 h-16 rounded-full object-cover bg-gray-800" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-800" />
        )}
        <label className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs font-black cursor-pointer">
          {uploading ? "Uploading…" : "Upload face"}
          <input type="file" accept={ACCEPT_IMAGE_TYPES} className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && uploadFace(e.target.files[0])} />
        </label>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Name</div>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm" />
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Position(s) — every one he can play</div>
        <div className="flex flex-wrap gap-1">
          {VALID_POSITIONS.map(pos => (
            <button
              key={pos} onClick={() => togglePos(pos)}
              className={`px-2 py-1 rounded text-[10px] font-black ${positions.includes(pos) ? "bg-emerald-500 text-emerald-950" : "bg-gray-700 text-white/80"}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Overall (40-99)</div>
          <input type="number" min={40} max={99} value={overall} onChange={e => setOverall(e.target.value)} className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm" />
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Age</div>
          <input type="number" min={15} max={45} value={age} onChange={e => setAge(e.target.value)} className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm" />
        </div>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Nationality</div>
        <input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="e.g. England" className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 text-sm" />
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Potential</div>
        <div className="flex gap-1">
          {(["none", "high", "worldClass"] as const).map(t => (
            <button
              key={t} onClick={() => setPotential(t)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase ${potential === t ? "bg-emerald-600 text-white" : "bg-gray-700 text-white/80"}`}
            >
              {t === "none" ? "Ordinary" : t === "high" ? "High Potential" : "World Class"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-black text-sm">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-black text-sm">
          {saving ? "Saving…" : "Save"}
        </button>
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

  if (!squad) return <div className="text-xs text-white/60 py-6 text-center">Loading squad…</div>;
  if (squad.players.length === 0) {
    return <div className="text-xs text-white/60 py-6 text-center">Create some players in the Squad tab first — a lineup needs a real roster to pick from.</div>;
  }
  return <LineupBuilder clubs={[club]} squads={[squad]} initialClub={club} />;
}
