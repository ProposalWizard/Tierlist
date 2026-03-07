"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tierlist, Category } from "@/lib/types";

interface VotelistAdmin {
  id: string;
  title: string;
  cover_image_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface VoteImage {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
}

interface AdminImage {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
}

interface EditState {
  title: string;
  category: string;
  /** The current cover URL (may change during editing) */
  cover_image_url: string | null;
  /** Which image ID from the grid is actively selected as cover (null = use cover_image_url as-is) */
  selectedCoverImageId: string | null;
  /** A new cover file the admin just uploaded */
  customCoverFile: File | null;
  customCoverPreview: string | null;
  images: AdminImage[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export default function AdminPanel({
  initialTierlists,
}: {
  initialTierlists: Tierlist[];
}) {
  const [tab, setTab] = useState<"tierlists" | "categories" | "vote-tierlists">("tierlists");
  const [tierlists, setTierlists] = useState<Tierlist[]>(initialTierlists);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Categories state ───────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catEditName, setCatEditName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // ── Vote Tierlists state ───────────────────────────────────────────────────
  const [votelists, setVotelists] = useState<VotelistAdmin[]>([]);
  const [votelistsLoaded, setVotelistsLoaded] = useState(false);
  const [expandedVoteId, setExpandedVoteId] = useState<string | null>(null);
  const [voteImagesMap, setVoteImagesMap] = useState<Record<string, VoteImage[]>>({});
  const [showCreateVote, setShowCreateVote] = useState(false);
  const [newVoteTitle, setNewVoteTitle] = useState("");
  const [newVoteCoverFile, setNewVoteCoverFile] = useState<File | null>(null);
  const [newVoteCoverPreview, setNewVoteCoverPreview] = useState<string | null>(null);
  const [newVoteCreating, setNewVoteCreating] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [addImgFiles, setAddImgFiles] = useState<Record<string, File[]>>({});
  const [addImgSaving, setAddImgSaving] = useState<Record<string, boolean>>({});
  const [togglingVoteId, setTogglingVoteId] = useState<string | null>(null);
  const [deleteVoteConfirmId, setDeleteVoteConfirmId] = useState<string | null>(null);
  const [deletingVote, setDeletingVote] = useState(false);
  const [importingVoteId, setImportingVoteId] = useState<string | null>(null);
  const [allTierlists, setAllTierlists] = useState<{ id: string; title: string }[]>([]);
  const [importSourceId, setImportSourceId] = useState<string>("");
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
  }, []);

  async function saveCategoryName(id: string) {
    if (!catEditName.trim()) return;
    setCatSaving(true);
    setCatError(null);
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catEditName.trim() }),
    });
    setCatSaving(false);
    if (res.ok) {
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: catEditName.trim() } : c));
      setEditingCatId(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setCatError(d.error ?? "Failed to save");
    }
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    setCatError(null);
    const res = await fetch(`/api/admin/categories/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setCatSaving(false);
    if (res.ok) {
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setNewCatName("");
    } else {
      const d = await res.json().catch(() => ({}));
      setCatError(d.error ?? "Failed to add");
    }
  }

  async function deleteCategory(id: string) {
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Open the edit form for a tierlist ──────────────────────────────────────
  async function openEdit(tl: Tierlist) {
    setEditingId(tl.id);
    setEditState({
      title: tl.title,
      category: tl.category ?? "Other",
      cover_image_url: tl.cover_image_url,
      selectedCoverImageId: null,
      customCoverFile: null,
      customCoverPreview: null,
      images: [],
      loading: true,
      saving: false,
      error: null,
    });

    // Fetch images for this tierlist from Supabase (publicly readable)
    const supabase = createClient();
    const { data: images } = await supabase
      .from("tierlist_images")
      .select("id, name, image_url, sort_order")
      .eq("tierlist_id", tl.id)
      .order("sort_order");

    setEditState((prev) => {
      if (!prev) return prev;
      // Pre-select whichever image is already the cover
      const selectedCoverImageId =
        images?.find((img) => img.image_url === tl.cover_image_url)?.id ?? null;
      return {
        ...prev,
        images: (images as AdminImage[]) ?? [],
        selectedCoverImageId,
        loading: false,
      };
    });
  }

  // ── Close / cancel edit form ───────────────────────────────────────────────
  function closeEdit() {
    if (editState?.customCoverPreview) {
      URL.revokeObjectURL(editState.customCoverPreview);
    }
    setEditingId(null);
    setEditState(null);
  }

  // ── Compute what the cover preview should show in the edit form ────────────
  function getEditCoverPreview(): string | null {
    if (!editState) return null;
    if (editState.customCoverPreview) return editState.customCoverPreview;
    if (editState.selectedCoverImageId) {
      return (
        editState.images.find((i) => i.id === editState.selectedCoverImageId)
          ?.image_url ?? null
      );
    }
    return editState.cover_image_url;
  }

  // ── Handle new custom cover file selection ────────────────────────────────
  function handleCoverFileChange(file: File) {
    const newPreview = URL.createObjectURL(file);
    setEditState((prev) => {
      if (!prev) return prev;
      if (prev.customCoverPreview) URL.revokeObjectURL(prev.customCoverPreview);
      return {
        ...prev,
        customCoverFile: file,
        customCoverPreview: newPreview,
        selectedCoverImageId: null,
      };
    });
  }

  function removeCustomCover() {
    setEditState((prev) => {
      if (!prev) return prev;
      if (prev.customCoverPreview) URL.revokeObjectURL(prev.customCoverPreview);
      return { ...prev, customCoverFile: null, customCoverPreview: null };
    });
  }

  // ── Click an image in grid to set as cover ─────────────────────────────────
  function selectImageAsCover(imageId: string) {
    setEditState((prev) => {
      if (!prev) return prev;
      if (prev.customCoverPreview) URL.revokeObjectURL(prev.customCoverPreview);
      return {
        ...prev,
        selectedCoverImageId: imageId,
        customCoverFile: null,
        customCoverPreview: null,
      };
    });
  }

  // ── Save edits ─────────────────────────────────────────────────────────────
  async function handleSaveEdit(tierlistId: string) {
    if (!editState) return;
    setEditState((p) => (p ? { ...p, saving: true, error: null } : p));

    try {
      let cover_image_url: string | null = editState.cover_image_url;

      // If admin uploaded a brand-new cover, upload to storage first
      if (editState.customCoverFile) {
        const supabase = createClient();
        const ext = editState.customCoverFile.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images")
          .upload(path, editState.customCoverFile, { upsert: false });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage
          .from("tierlist-images")
          .getPublicUrl(uploadData.path);
        cover_image_url = urlData.publicUrl;
      } else if (editState.selectedCoverImageId) {
        // Use one of the existing images
        cover_image_url =
          editState.images.find((i) => i.id === editState.selectedCoverImageId)
            ?.image_url ?? cover_image_url;
      }

      const res = await fetch(`/api/admin/tierlists/${tierlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editState.title,
          category: editState.category,
          cover_image_url,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      // Update the local list so the row shows the new values immediately
      setTierlists((prev) =>
        prev.map((tl) =>
          tl.id === tierlistId
            ? {
                ...tl,
                title: editState.title,
                category: editState.category,
                cover_image_url: cover_image_url ?? tl.cover_image_url,
              }
            : tl
        )
      );

      closeEdit();
    } catch (err) {
      setEditState((p) =>
        p
          ? {
              ...p,
              saving: false,
              error: err instanceof Error ? err.message : "Something went wrong",
            }
          : p
      );
    }
  }

  // ── Delete a single image from a tierlist ──────────────────────────────────
  async function handleDeleteImage(tierlistId: string, imageId: string) {
    const res = await fetch(
      `/api/admin/tierlists/${tierlistId}/images/${imageId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;

    setEditState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.filter((img) => img.id !== imageId),
        selectedCoverImageId:
          prev.selectedCoverImageId === imageId
            ? null
            : prev.selectedCoverImageId,
      };
    });
  }

  // ── Delete entire tierlist ─────────────────────────────────────────────────
  async function handleDeleteTierlist(tierlistId: string) {
    setDeleting(true);
    const res = await fetch(`/api/admin/tierlists/${tierlistId}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (res.ok) {
      setTierlists((prev) => prev.filter((tl) => tl.id !== tierlistId));
      setDeleteConfirmId(null);
      if (editingId === tierlistId) closeEdit();
    }
  }

  // ── Vote Tierlists helpers ─────────────────────────────────────────────────
  async function loadVotelists() {
    if (votelistsLoaded) return;
    const res = await fetch("/api/admin/vote-tierlists");
    if (res.ok) {
      const data = await res.json();
      setVotelists(data);
    }
    setVotelistsLoaded(true);
  }

  async function handleExpandVote(id: string) {
    if (expandedVoteId === id) { setExpandedVoteId(null); return; }
    setExpandedVoteId(id);
    if (!voteImagesMap[id]) {
      const res = await fetch(`/api/admin/vote-tierlists/${id}/images`);
      if (res.ok) {
        const imgs = await res.json();
        setVoteImagesMap((prev) => ({ ...prev, [id]: imgs }));
      }
    }
    if (!allTierlists.length) {
      const res = await fetch("/api/admin/tierlists");
      if (res.ok) {
        const data = await res.json();
        setAllTierlists(data);
      }
    }
  }

  async function handleCreateVote() {
    if (!newVoteTitle.trim()) return;
    setNewVoteCreating(true);
    setVoteError(null);
    try {
      let cover_image_url: string | null = null;
      if (newVoteCoverFile) {
        const supabase = createClient();
        const ext = newVoteCoverFile.name.split(".").pop() ?? "jpg";
        const path = `vote-covers/${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images")
          .upload(path, newVoteCoverFile, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
        cover_image_url = urlData.publicUrl;
      }
      const res = await fetch("/api/admin/vote-tierlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newVoteTitle.trim(), cover_image_url }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create");
      }
      const created = await res.json();
      setVotelists((prev) => [created, ...prev]);
      setNewVoteTitle("");
      if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview);
      setNewVoteCoverFile(null);
      setNewVoteCoverPreview(null);
      setShowCreateVote(false);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Something went wrong");
    }
    setNewVoteCreating(false);
  }

  async function handleToggleVoteActive(vl: VotelistAdmin) {
    setTogglingVoteId(vl.id);
    const res = await fetch(`/api/admin/vote-tierlists/${vl.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !vl.is_active }),
    });
    if (res.ok) {
      setVotelists((prev) => prev.map((v) => v.id === vl.id ? { ...v, is_active: !vl.is_active } : v));
    }
    setTogglingVoteId(null);
  }

  async function handleDeleteVote(id: string) {
    setDeletingVote(true);
    const res = await fetch(`/api/admin/vote-tierlists/${id}`, { method: "DELETE" });
    setDeletingVote(false);
    if (res.ok) {
      setVotelists((prev) => prev.filter((v) => v.id !== id));
      setDeleteVoteConfirmId(null);
      if (expandedVoteId === id) setExpandedVoteId(null);
    }
  }

  async function handleAddImages(voteId: string) {
    const files = addImgFiles[voteId] ?? [];
    if (!files.length) return;
    setAddImgSaving((prev) => ({ ...prev, [voteId]: true }));
    try {
      const supabase = createClient();
      const newImgs = await Promise.all(
        files.map(async (file) => {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `vote-images/${crypto.randomUUID()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("tierlist-images")
            .upload(path, file, { upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
          const res = await fetch(`/api/admin/vote-tierlists/${voteId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: urlData.publicUrl }),
          });
          if (!res.ok) throw new Error("Failed to save image");
          return res.json() as Promise<VoteImage>;
        })
      );
      setVoteImagesMap((prev) => ({ ...prev, [voteId]: [...(prev[voteId] ?? []), ...newImgs] }));
      setAddImgFiles((prev) => ({ ...prev, [voteId]: [] }));
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to add images");
    }
    setAddImgSaving((prev) => ({ ...prev, [voteId]: false }));
  }

  async function handleImportFromTierlist(voteId: string) {
    if (!importSourceId) return;
    setImportLoading(true);
    try {
      const res = await fetch(`/api/admin/vote-tierlists/${voteId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_tierlist_id: importSourceId }),
      });
      if (!res.ok) throw new Error("Import failed");
      const { images } = await res.json() as { imported: number; images: VoteImage[] };
      setVoteImagesMap((prev) => ({ ...prev, [voteId]: [...(prev[voteId] ?? []), ...(images ?? [])] }));
      setImportingVoteId(null);
      setImportSourceId("");
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Import failed");
    }
    setImportLoading(false);
  }

  async function handleDeleteVoteImage(voteId: string, imageId: string) {
    const res = await fetch(`/api/admin/vote-tierlists/${voteId}/images/${imageId}`, { method: "DELETE" });
    if (res.ok) {
      setVoteImagesMap((prev) => ({
        ...prev,
        [voteId]: (prev[voteId] ?? []).filter((img) => img.id !== imageId),
      }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const editCoverPreview = getEditCoverPreview();

  return (
    <div>
      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setTab("tierlists")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "tierlists" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Tierlists ({tierlists.length})
        </button>
        <button
          onClick={() => setTab("categories")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "categories" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => { setTab("vote-tierlists"); loadVotelists(); }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "vote-tierlists" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Vote Tierlists {votelistsLoaded ? `(${votelists.length})` : ""}
        </button>
      </div>

      {/* ── Categories tab ─────────────────────────────────────────────── */}
      {tab === "categories" && (
        <div className="space-y-3">
          {catError && <p className="text-sm text-red-400">{catError}</p>}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3">
              {editingCatId === cat.id ? (
                <>
                  <input
                    value={catEditName}
                    onChange={(e) => setCatEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCategoryName(cat.id); if (e.key === "Escape") setEditingCatId(null); }}
                    className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveCategoryName(cat.id)} disabled={catSaving}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {catSaving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setEditingCatId(null)}
                    className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-gray-400">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-white">{cat.name}</span>
                  <button onClick={() => { setEditingCatId(cat.id); setCatEditName(cat.name); }}
                    className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-indigo-500 hover:text-white">
                    Rename
                  </button>
                  <button onClick={() => deleteCategory(cat.id)}
                    className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-500">
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Add new category */}
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-700 px-4 py-3">
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
              placeholder="New category name…"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
            />
            <button onClick={addCategory} disabled={catSaving || !newCatName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── Tierlists tab ──────────────────────────────────────────────── */}
      {tab === "tierlists" && (
      <div>
      <p className="mb-4 text-sm text-gray-400">
        {tierlists.length} tierlist{tierlists.length !== 1 ? "s" : ""} total
      </p>

      {tierlists.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 p-16 text-center text-sm italic text-gray-600">
          No tierlists yet.
        </div>
      )}

      <div className="space-y-2">
        {tierlists.map((tl) => (
          <div
            key={tl.id}
            className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900"
          >
            {/* ── Collapsed row ─────────────────────────────────────── */}
            <div className="flex items-center gap-3 p-4">
              {/* Cover thumbnail */}
              <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-800 bg-cover bg-center"
                style={tl.cover_image_url ? { backgroundImage: `url("${tl.cover_image_url}")` } : {}}
              >
                {!tl.cover_image_url && (
                  <div className="flex h-full w-full items-center justify-center text-xl">🏆</div>
                )}
              </div>

              {/* Title + meta */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{tl.title}</p>
                <p className="text-xs text-gray-500">
                  {tl.category ?? "—"} ·{" "}
                  {new Date(tl.created_at).toLocaleDateString()} ·{" "}
                  👁 {(tl.view_count ?? 0).toLocaleString()}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {editingId === tl.id ? (
                  <button
                    onClick={closeEdit}
                    className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={() => openEdit(tl)}
                    className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirmId(tl.id)}
                  className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* ── Expanded edit form ─────────────────────────────────── */}
            {editingId === tl.id && editState && (
              <div className="border-t border-gray-700/60 p-4">
                {editState.loading ? (
                  <p className="py-6 text-center text-sm text-gray-400">
                    Loading images…
                  </p>
                ) : (
                  <div className="space-y-5">
                    {/* Title */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">
                        Title
                      </label>
                      <input
                        value={editState.title}
                        onChange={(e) =>
                          setEditState((p) =>
                            p ? { ...p, title: e.target.value } : p
                          )
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">
                        Category
                      </label>
                      <select
                        value={editState.category}
                        onChange={(e) =>
                          setEditState((p) =>
                            p ? { ...p, category: e.target.value } : p
                          )
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cover Photo */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-400">
                        Cover Photo
                      </label>
                      <div className="flex gap-4 items-start">
                        {/* Preview */}
                        <div
                          className={`h-28 w-44 flex-shrink-0 rounded-xl border-2 bg-cover bg-center bg-no-repeat transition-colors ${
                            editCoverPreview
                              ? "border-indigo-500"
                              : "border-gray-700 bg-gray-800"
                          }`}
                          style={
                            editCoverPreview
                              ? { backgroundImage: `url("${editCoverPreview}")` }
                              : {}
                          }
                        >
                          {!editCoverPreview && (
                            <div className="flex h-full w-full items-center justify-center text-xs italic text-gray-600">
                              No cover
                            </div>
                          )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-2 pt-1">
                          <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white">
                            Upload new cover
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  handleCoverFileChange(f);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                          {editState.customCoverPreview && (
                            <button
                              onClick={removeCustomCover}
                              className="text-left text-xs text-red-400 transition-colors hover:text-red-300"
                            >
                              Remove upload
                            </button>
                          )}
                          {editState.images.length > 0 &&
                            !editState.customCoverPreview && (
                              <p className="text-xs text-gray-600">
                                Or click an image below
                              </p>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Images */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-400">
                        Images ({editState.images.length})
                      </label>
                      {editState.images.length === 0 ? (
                        <p className="text-xs italic text-gray-600">
                          No images in this tierlist.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-950/50 p-3">
                            {editState.images.map((img) => {
                              const isCover =
                                !editState.customCoverPreview &&
                                (editState.selectedCoverImageId === img.id ||
                                  (!editState.selectedCoverImageId &&
                                    img.image_url === editState.cover_image_url));
                              return (
                                <div key={img.id} className="group relative">
                                  <button
                                    type="button"
                                    onClick={() => selectImageAsCover(img.id)}
                                    title="Set as cover"
                                    className="block focus:outline-none"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={img.image_url}
                                      alt={img.name}
                                      className={`h-20 w-20 rounded-lg object-cover border-2 transition-colors ${
                                        isCover
                                          ? "border-indigo-400"
                                          : "border-gray-700 hover:border-gray-500"
                                      }`}
                                    />
                                    {isCover && (
                                      <span className="absolute left-1 top-1 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                        Cover
                                      </span>
                                    )}
                                  </button>
                                  {/* Remove image button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteImage(tl.id, img.id);
                                    }}
                                    title="Remove image"
                                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                                  >
                                    ×
                                  </button>
                                  <p className="mt-0.5 max-w-[80px] truncate text-center text-[10px] text-gray-500">
                                    {img.name}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-1.5 text-xs text-gray-600">
                            Click to set as cover · hover and click × to remove
                          </p>
                        </>
                      )}
                    </div>

                    {/* Error */}
                    {editState.error && (
                      <p className="text-sm text-red-400">{editState.error}</p>
                    )}

                    {/* Footer buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => handleSaveEdit(tl.id)}
                        disabled={editState.saving}
                        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {editState.saving ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        onClick={closeEdit}
                        className="rounded-lg border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete Tierlist?</h3>
            <p className="mt-2 text-sm text-gray-400">
              This will permanently delete the tierlist, all its images, and the
              associated storage files. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => handleDeleteTierlist(deleteConfirmId)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {/* ── Vote Tierlists tab ─────────────────────────────────────────── */}
      {tab === "vote-tierlists" && (
        <div>
          {voteError && <p className="mb-3 text-sm text-red-400">{voteError}</p>}

          {/* Create button / form */}
          {!showCreateVote ? (
            <button
              onClick={() => setShowCreateVote(true)}
              className="mb-5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
            >
              + New Vote Tierlist
            </button>
          ) : (
            <div className="mb-5 rounded-xl border border-purple-700 bg-gray-900 p-4 space-y-3">
              <p className="text-sm font-semibold text-purple-300">New Vote Tierlist</p>
              <input
                value={newVoteTitle}
                onChange={(e) => setNewVoteTitle(e.target.value)}
                placeholder="Title…"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              />
              {/* Cover image upload */}
              <div className="flex items-center gap-3">
                {newVoteCoverPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newVoteCoverPreview} alt="cover" className="h-16 w-24 rounded-lg object-cover border border-gray-600" />
                    <button
                      onClick={() => { if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview); setNewVoteCoverFile(null); setNewVoteCoverPreview(null); }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
                    >×</button>
                  </div>
                ) : (
                  <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white">
                    Upload cover (optional)
                    <input type="file" accept="image/*" className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { const p = URL.createObjectURL(f); if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview); setNewVoteCoverFile(f); setNewVoteCoverPreview(p); e.target.value = ""; } }}
                    />
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateVote} disabled={newVoteCreating || !newVoteTitle.trim()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                  {newVoteCreating ? "Creating…" : "Create"}
                </button>
                <button onClick={() => { setShowCreateVote(false); setNewVoteTitle(""); if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview); setNewVoteCoverFile(null); setNewVoteCoverPreview(null); }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-300 hover:border-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!votelistsLoaded && <p className="text-sm text-gray-500">Loading…</p>}
          {votelistsLoaded && votelists.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-700 p-16 text-center text-sm italic text-gray-600">
              No vote tierlists yet.
            </div>
          )}

          <div className="space-y-2">
            {votelists.map((vl) => (
              <div key={vl.id} className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
                {/* Row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-700 bg-gray-800 bg-cover bg-center"
                    style={vl.cover_image_url ? { backgroundImage: `url("${vl.cover_image_url}")` } : {}}>
                    {!vl.cover_image_url && <div className="flex h-full w-full items-center justify-center text-xl">🗳️</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{vl.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-semibold ${vl.is_active ? "text-green-400" : "text-gray-500"}`}>
                        {vl.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-gray-600">· {new Date(vl.created_at).toLocaleDateString()}</span>
                      {voteImagesMap[vl.id] !== undefined && (
                        <span className="text-xs text-gray-600">· {voteImagesMap[vl.id].length} images</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleExpandVote(vl.id)}
                      className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white">
                      {expandedVoteId === vl.id ? "Close" : "Manage"}
                    </button>
                    <button
                      onClick={() => handleToggleVoteActive(vl)}
                      disabled={togglingVoteId === vl.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        vl.is_active
                          ? "border-yellow-800 text-yellow-400 hover:border-yellow-500"
                          : "border-green-800 text-green-400 hover:border-green-500"
                      }`}>
                      {togglingVoteId === vl.id ? "…" : vl.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => setDeleteVoteConfirmId(vl.id)}
                      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-500">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded image management */}
                {expandedVoteId === vl.id && (
                  <div className="border-t border-gray-700/60 p-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-400">Images</p>
                    {!(voteImagesMap[vl.id]) ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : voteImagesMap[vl.id].length === 0 ? (
                      <p className="text-xs italic text-gray-600">No images yet. Add some below.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {voteImagesMap[vl.id].map((img) => (
                          <div key={img.id} className="group relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.image_url} alt={img.name}
                              className="h-20 w-20 rounded-lg object-cover border-2 border-gray-700" />
                            <button
                              onClick={() => handleDeleteVoteImage(vl.id, img.id)}
                              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                              ×
                            </button>
                            <p className="mt-0.5 max-w-[80px] truncate text-center text-[10px] text-gray-500">{img.name}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add images */}
                    <div className="rounded-xl border border-dashed border-gray-700 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white flex-1 text-center">
                          {(addImgFiles[vl.id]?.length ?? 0) > 0
                            ? `${addImgFiles[vl.id].length} file${addImgFiles[vl.id].length === 1 ? "" : "s"} selected`
                            : "Choose images"}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              setAddImgFiles((p) => ({ ...p, [vl.id]: files }));
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          onClick={() => handleAddImages(vl.id)}
                          disabled={addImgSaving[vl.id] || !(addImgFiles[vl.id]?.length)}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40">
                          {addImgSaving[vl.id] ? "Uploading…" : "Upload"}
                        </button>
                      </div>
                      {/* Previews */}
                      {(addImgFiles[vl.id]?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {addImgFiles[vl.id].map((f, i) => (
                            <div key={i} className="relative h-12 w-12 overflow-hidden rounded-lg border border-gray-600">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Import from existing tierlist */}
                    {importingVoteId === vl.id ? (
                      <div className="rounded-xl border border-purple-800 bg-purple-950/30 p-3 space-y-2">
                        <p className="text-xs font-semibold text-purple-300">Import images from tierlist</p>
                        <select
                          value={importSourceId}
                          onChange={(e) => setImportSourceId(e.target.value)}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Select a tierlist…</option>
                          {allTierlists.map((tl) => (
                            <option key={tl.id} value={tl.id}>{tl.title}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleImportFromTierlist(vl.id)}
                            disabled={importLoading || !importSourceId}
                            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40">
                            {importLoading ? "Importing…" : "Import"}
                          </button>
                          <button
                            onClick={() => { setImportingVoteId(null); setImportSourceId(""); }}
                            className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setImportingVoteId(vl.id)}
                        className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-purple-600 hover:text-purple-300 text-left">
                        ↙ Import images from existing tierlist
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Delete vote tierlist modal */}
          {deleteVoteConfirmId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white">Delete Vote Tierlist?</h3>
                <p className="mt-2 text-sm text-gray-400">
                  This will permanently delete the vote tierlist, all its images, and all votes. This cannot be undone.
                </p>
                <div className="mt-5 flex gap-3">
                  <button onClick={() => handleDeleteVote(deleteVoteConfirmId)} disabled={deletingVote}
                    className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                    {deletingVote ? "Deleting…" : "Delete"}
                  </button>
                  <button onClick={() => setDeleteVoteConfirmId(null)} disabled={deletingVote}
                    className="flex-1 rounded-lg border border-gray-600 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-400 disabled:opacity-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
