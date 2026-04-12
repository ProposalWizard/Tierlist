"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import { processImage, detectFaceFromUrl, type FaceCenter } from "@/lib/faceDetection";
import ImageWithFallback from "./ImageWithFallback";
import CropOverlay from "./CropOverlay";
import type { Tierlist, Category, VoteTier } from "@/lib/types";
import { TIER_COLOR_OPTIONS } from "@/lib/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface VotelistAdmin {
  id: string;
  title: string;
  category: string;
  cover_image_url: string | null;
  is_active: boolean;
  created_at: string;
  face_detection_enabled?: boolean;
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
  /** Image IDs staged for deletion (only deleted on Save) */
  pendingDeleteImageIds: string[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Linked vote tierlist ID (for cross-navigation) */
  linked_vote_tierlist_id: string | null;
  /** Additional categories this tierlist should appear in */
  additional_categories: string[];
  /** Custom tier rows (labels + colors) */
  tiers: VoteTier[];
  /** Whether face detection auto-centering is enabled */
  face_detection_enabled: boolean;
}

/** Small sortable wrapper used for drag-and-drop image reordering in admin. */
function SortableImageCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function AdminPanel({
  initialTierlists,
}: {
  initialTierlists: Tierlist[];
}) {
  const [tab, setTab] = useState<"tierlists" | "categories" | "vote-tierlists">("tierlists");
  const adminDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);

  function showSaveConfirmation(message: string) {
    setSaveConfirmation(message);
    setTimeout(() => setSaveConfirmation(null), 3000);
  }
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
  // Category homepage ordering settings
  const [catSettings, setCatSettings] = useState<Record<string, { sort_method: string; pinned_ids: string[] }>>({});
  const [catSettingsSaving, setCatSettingsSaving] = useState<Record<string, boolean>>({});

  // ── Vote Tierlists state ───────────────────────────────────────────────────
  const [votelists, setVotelists] = useState<VotelistAdmin[]>([]);
  const [votelistsLoaded, setVotelistsLoaded] = useState(false);
  const [expandedVoteId, setExpandedVoteId] = useState<string | null>(null);
  const [voteImagesMap, setVoteImagesMap] = useState<Record<string, VoteImage[]>>({});
  const [showCreateVote, setShowCreateVote] = useState(false);
  const [newVoteTitle, setNewVoteTitle] = useState("");
  const [newVoteCategory, setNewVoteCategory] = useState("");
  const [newVoteCoverFile, setNewVoteCoverFile] = useState<File | null>(null);
  const [newVoteCoverPreview, setNewVoteCoverPreview] = useState<string | null>(null);
  const [newVoteCreating, setNewVoteCreating] = useState(false);
  const [newVoteImageFiles, setNewVoteImageFiles] = useState<File[]>([]);
  const [newVoteImportSourceId, setNewVoteImportSourceId] = useState("");
  const [newVoteShowImport, setNewVoteShowImport] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [addImgFiles, setAddImgFiles] = useState<Record<string, File[]>>({});
  const [addImgSaving, setAddImgSaving] = useState<Record<string, boolean>>({});
  const [togglingVoteId, setTogglingVoteId] = useState<string | null>(null);
  const [deleteVoteConfirmId, setDeleteVoteConfirmId] = useState<string | null>(null);
  const [deletingVote, setDeletingVote] = useState(false);
  const [importingVoteId, setImportingVoteId] = useState<string | null>(null);
  const [allTierlists, setAllTierlists] = useState<{ id: string; title: string }[]>([]);
  const [importSourceId, setImportSourceId] = useState<string>("");
  // Vote tierlist rename
  const [editingVoteTitleId, setEditingVoteTitleId] = useState<string | null>(null);
  const [editVoteTitleValue, setEditVoteTitleValue] = useState("");
  const [savingVoteTitle, setSavingVoteTitle] = useState(false);
  // Manual pin picker search (includes both regular + vote tierlists)
  const [pinPickerSearch, setPinPickerSearch] = useState<Record<string, string>>({});
  // All items for pin picker: regular tierlists + vote tierlists combined
  const [allPinItems, setAllPinItems] = useState<{ id: string; title: string; is_vote: boolean }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  // Admin image cropping (works for both regular and vote tierlists)
  const [adminCropImage, setAdminCropImage] = useState<{ tierlistId: string; imageId: string; imageUrl: string; imageName: string; isVote?: boolean } | null>(null);
  // Admin cover photo cropping
  const [adminCoverCrop, setAdminCoverCrop] = useState<{ imageUrl: string; tierlistId: string; isVote?: boolean } | null>(null);
  // Vote tierlist cover photo editing
  const [voteCoverFile, setVoteCoverFile] = useState<File | null>(null);
  const [voteCoverPreview, setVoteCoverPreview] = useState<string | null>(null);
  const [voteCoverUploading, setVoteCoverUploading] = useState(false);
  // Custom tiers for creating new vote tierlists
  const DEFAULT_VOTE_TIERS: VoteTier[] = [
    { label: "S", color: "#4ade80" },
    { label: "A", color: "#86efac" },
    { label: "B", color: "#fde047" },
    { label: "C", color: "#fb923c" },
    { label: "D", color: "#f87171" },
  ];
  const [newVoteTiers, setNewVoteTiers] = useState<VoteTier[]>(DEFAULT_VOTE_TIERS);
  // Tier editing for existing vote tierlists
  const [editingTiersId, setEditingTiersId] = useState<string | null>(null);
  const [editTiers, setEditTiers] = useState<VoteTier[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);

  // Build allPinItems whenever tierlists or votelists change
  useEffect(() => {
    const regular = initialTierlists.map((tl) => ({ id: tl.id, title: tl.title, is_vote: false }));
    const vote = votelists.map((vl) => ({ id: vl.id, title: vl.title, is_vote: true }));
    setAllPinItems([...regular, ...vote]);
  }, [initialTierlists, votelists]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
    fetch("/api/admin/category-settings")
      .then((r) => r.json())
      .then((data: { category: string; sort_method: string; pinned_ids: string[] }[]) => {
        if (Array.isArray(data)) {
          const map: Record<string, { sort_method: string; pinned_ids: string[] }> = {};
          for (const s of data) map[s.category] = { sort_method: s.sort_method, pinned_ids: s.pinned_ids ?? [] };
          setCatSettings(map);
        }
      })
      .catch(() => {});
    // Also load vote tierlists for pin picker
    fetch("/api/admin/vote-tierlists")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) { setVotelists(data); setVotelistsLoaded(true); } })
      .catch(() => {});
  }, []);

  async function saveCatSetting(catName: string, sortMethod: string, pinnedIds?: string[]) {
    setCatSettingsSaving((prev) => ({ ...prev, [catName]: true }));
    try {
      const res = await fetch("/api/admin/category-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: catName, sort_method: sortMethod, pinned_ids: pinnedIds ?? catSettings[catName]?.pinned_ids ?? [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setCatSettings((prev) => ({ ...prev, [catName]: { sort_method: data.sort_method, pinned_ids: data.pinned_ids ?? [] } }));
        showSaveConfirmation(`"${catName}" settings saved`);
      }
    } catch { /* ignore */ }
    setCatSettingsSaving((prev) => ({ ...prev, [catName]: false }));
  }

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
      showSaveConfirmation("Category renamed");
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
      showSaveConfirmation("Category added");
    } else {
      const d = await res.json().catch(() => ({}));
      setCatError(d.error ?? "Failed to add");
    }
  }

  async function deleteCategory(id: string) {
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const newCategories = [...categories];
    const temp = newCategories[idx];
    newCategories[idx] = newCategories[swapIdx];
    newCategories[swapIdx] = temp;
    setCategories(newCategories);

    // Update sort_order for both swapped categories
    const sortA = idx;
    const sortB = swapIdx;
    try {
      await Promise.all([
        fetch(`/api/admin/categories/${newCategories[idx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: idx }),
        }),
        fetch(`/api/admin/categories/${newCategories[swapIdx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: swapIdx }),
        }),
      ]);
      showSaveConfirmation("Category order updated");
    } catch {
      // Revert on failure
      setCategories(categories);
    }
  }

  // ── Open the edit form for a tierlist ──────────────────────────────────────
  const DEFAULT_TIERS: VoteTier[] = [
    { label: "S", color: "#4ade80" },
    { label: "A", color: "#86efac" },
    { label: "B", color: "#fde047" },
    { label: "C", color: "#fb923c" },
    { label: "D", color: "#f87171" },
  ];

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
      pendingDeleteImageIds: [],
      loading: true,
      saving: false,
      error: null,
      linked_vote_tierlist_id: tl.linked_vote_tierlist_id ?? null,
      additional_categories: (tl as Tierlist & { additional_categories?: string[] }).additional_categories ?? [],
      tiers: (tl.tiers as VoteTier[] | undefined) ?? DEFAULT_TIERS,
      face_detection_enabled: tl.face_detection_enabled !== false,
    });
    // Ensure vote tierlists are loaded for the linked tierlist picker
    if (!votelistsLoaded) {
      fetch("/api/admin/vote-tierlists")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) { setVotelists(data); setVotelistsLoaded(true); } })
        .catch(() => {});
    }

    // Fetch images + tiers for this tierlist from Supabase
    const supabase = createClient();
    const [{ data: images }, { data: tlData }] = await Promise.all([
      supabase
        .from("tierlist_images")
        .select("id, name, image_url, sort_order")
        .eq("tierlist_id", tl.id)
        .order("sort_order"),
      supabase
        .from("tierlists")
        .select("*")
        .eq("id", tl.id)
        .single(),
    ]);

    setEditState((prev) => {
      if (!prev) return prev;
      // Pre-select whichever image is already the cover
      const selectedCoverImageId =
        images?.find((img) => img.image_url === tl.cover_image_url)?.id ?? null;
      // Use tiers from DB if available (column may not exist yet)
      const tiers = (tlData?.tiers as VoteTier[] | undefined) ?? prev.tiers;
      // Use face_detection_enabled from DB if available
      const fde = tlData?.face_detection_enabled;
      return {
        ...prev,
        images: (images as AdminImage[]) ?? [],
        selectedCoverImageId,
        tiers,
        face_detection_enabled: fde !== undefined ? (fde as boolean) : prev.face_detection_enabled,
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
          linked_vote_tierlist_id: editState.linked_vote_tierlist_id,
          additional_categories: editState.additional_categories,
          tiers: editState.tiers,
          face_detection_enabled: editState.face_detection_enabled,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      // Delete images that were staged for removal
      if (editState.pendingDeleteImageIds.length > 0) {
        await Promise.all(
          editState.pendingDeleteImageIds.map((imageId) =>
            fetch(`/api/admin/tierlists/${tierlistId}/images/${imageId}`, { method: "DELETE" })
          )
        );
      }

      // Update image sort orders (batch)
      const sortUpdates = editState.images.map((img, i) => ({ id: img.id, sort_order: i }));
      await fetch(`/api/admin/tierlists/${tierlistId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: sortUpdates }),
      });

      // Update the local list so the row shows the new values immediately
      setTierlists((prev) =>
        prev.map((tl) =>
          tl.id === tierlistId
            ? {
                ...tl,
                title: editState.title,
                category: editState.category,
                cover_image_url: cover_image_url ?? tl.cover_image_url,
                linked_vote_tierlist_id: editState.linked_vote_tierlist_id,
                additional_categories: editState.additional_categories,
                tiers: editState.tiers,
                face_detection_enabled: editState.face_detection_enabled,
              }
            : tl
        )
      );

      closeEdit();
      showSaveConfirmation("Tierlist saved");
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

  // ── Stage a single image for deletion (only persisted on Save) ──────────────
  function handleDeleteImage(_tierlistId: string, imageId: string) {
    setEditState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: prev.images.filter((img) => img.id !== imageId),
        pendingDeleteImageIds: [...prev.pendingDeleteImageIds, imageId],
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
    if (expandedVoteId === id) { setExpandedVoteId(null); setEditingTiersId(null); return; }
    setExpandedVoteId(id);
    if (!voteImagesMap[id]) {
      const res = await fetch(`/api/admin/vote-tierlists/${id}/images`);
      if (res.ok) {
        const imgs = await res.json();
        setVoteImagesMap((prev) => ({ ...prev, [id]: imgs }));
      }
    }
    // Auto-load tiers for editing
    const supabase = createClient();
    const { data } = await supabase.from("vote_tierlists").select("tiers").eq("id", id).single();
    const tiers = (data?.tiers as VoteTier[]) ?? DEFAULT_VOTE_TIERS;
    setEditTiers(tiers);
    setEditingTiersId(id);
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
      const supabase = createClient();
      let cover_image_url: string | null = null;
      if (newVoteCoverFile) {
        const ext = newVoteCoverFile.name.split(".").pop() ?? "jpg";
        const path = `vote-covers/${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images")
          .upload(path, newVoteCoverFile, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
        cover_image_url = urlData.publicUrl;
      }
      const categoryToUse = newVoteCategory || (categories.length > 0 ? categories[0].name : "General");
      const res = await fetch("/api/admin/vote-tierlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newVoteTitle.trim(), category: categoryToUse, cover_image_url, tiers: newVoteTiers }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create");
      }
      const created = await res.json();
      const createdId = created.id;

      // Upload images if any were added
      if (newVoteImageFiles.length > 0) {
        await Promise.all(
          newVoteImageFiles.map(async (file) => {
            const { file: processed } = await processImage(file).catch(() => ({ file, faceCenter: null }));
            const ext = "webp";
            const path = `vote-images/${crypto.randomUUID()}.${ext}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("tierlist-images")
              .upload(path, processed, { upsert: false });
            if (uploadError) throw new Error(uploadError.message);
            const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
            await fetch(`/api/admin/vote-tierlists/${createdId}/images`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: urlData.publicUrl }),
            });
          })
        );
      }

      // Import from existing tierlist if selected
      if (newVoteImportSourceId) {
        await fetch(`/api/admin/vote-tierlists/${createdId}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_tierlist_id: newVoteImportSourceId }),
        });
      }

      setVotelists((prev) => [created, ...prev]);
      setNewVoteTitle("");
      setNewVoteCategory("");
      if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview);
      setNewVoteCoverFile(null);
      setNewVoteCoverPreview(null);
      setNewVoteTiers(DEFAULT_VOTE_TIERS);
      setNewVoteImageFiles([]);
      setNewVoteImportSourceId("");
      setNewVoteShowImport(false);
      setShowCreateVote(false);
      showSaveConfirmation("Vote tierlist created");
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

  async function handleSaveVoteTitle(id: string) {
    const title = editVoteTitleValue.trim();
    if (!title) return;
    setSavingVoteTitle(true);
    const res = await fetch(`/api/admin/vote-tierlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setVotelists((prev) => prev.map((v) => v.id === id ? { ...v, title } : v));
      setEditingVoteTitleId(null);
      showSaveConfirmation("Vote tierlist renamed");
    }
    setSavingVoteTitle(false);
  }

  async function handleVoteCoverUpload(voteId: string) {
    if (!voteCoverFile) return;
    setVoteCoverUploading(true);
    try {
      const supabase = createClient();
      const ext = voteCoverFile.name.split(".").pop() ?? "jpg";
      const path = `vote-covers/${crypto.randomUUID()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("tierlist-images")
        .upload(path, voteCoverFile, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
      const cover_image_url = urlData.publicUrl;
      const res = await fetch(`/api/admin/vote-tierlists/${voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_image_url }),
      });
      if (!res.ok) throw new Error("Failed to update cover");
      setVotelists((prev) => prev.map((v) => v.id === voteId ? { ...v, cover_image_url } : v));
      if (voteCoverPreview) URL.revokeObjectURL(voteCoverPreview);
      setVoteCoverFile(null);
      setVoteCoverPreview(null);
      showSaveConfirmation("Cover photo saved");
    } catch {
      // silently fail — user can retry
    } finally {
      setVoteCoverUploading(false);
    }
  }

  async function handleSaveTiers(voteId: string) {
    if (editTiers.length === 0) return;
    setSavingTiers(true);
    const res = await fetch(`/api/admin/vote-tierlists/${voteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers: editTiers }),
    });
    if (res.ok) {
      setEditingTiersId(null);
      showSaveConfirmation("Tiers saved");
    }
    setSavingTiers(false);
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
      // Check if this vote tierlist has face detection enabled
      const vl = votelists.find((v) => v.id === voteId);
      const faceEnabled = vl?.face_detection_enabled ?? false;
      const newImgs = await Promise.all(
        files.map(async (file) => {
          const { file: processed, faceCenter } = await processImage(file).catch(
            () => ({ file, faceCenter: null as FaceCenter | null })
          );
          const ext = "webp";
          const path = `vote-images/${crypto.randomUUID()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("tierlist-images")
            .upload(path, processed, { upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
          const res = await fetch(`/api/admin/vote-tierlists/${voteId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: urlData.publicUrl,
              face_center: faceEnabled ? faceCenter : null,
            }),
          });
          if (!res.ok) throw new Error("Failed to save image");
          return res.json() as Promise<VoteImage>;
        })
      );
      setVoteImagesMap((prev) => ({ ...prev, [voteId]: [...(prev[voteId] ?? []), ...newImgs] }));
      setAddImgFiles((prev) => ({ ...prev, [voteId]: [] }));
      showSaveConfirmation(`${newImgs.length} image${newImgs.length === 1 ? "" : "s"} uploaded`);
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
      showSaveConfirmation(`${images?.length ?? 0} images imported`);
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

  // ── Admin crop result handler ───────────────────────────────────────────────
  async function handleAdminCropResult(croppedDataUrl: string) {
    if (!adminCropImage) return;
    const { tierlistId, imageId, isVote } = adminCropImage;
    try {
      const resp = await fetch(croppedDataUrl);
      const blob = await resp.blob();
      const file = new File([blob], "cropped.png", { type: "image/png" });
      const supabase = createClient();
      const path = `${crypto.randomUUID()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("tierlist-images")
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
      const newUrl = urlData.publicUrl;

      if (isVote) {
        // Update vote tierlist image
        await fetch(`/api/admin/vote-tierlists/${tierlistId}/images/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: newUrl }),
        });
        setVoteImagesMap((prev) => ({
          ...prev,
          [tierlistId]: (prev[tierlistId] ?? []).map((img) =>
            img.id === imageId ? { ...img, image_url: newUrl } : img
          ),
        }));
      } else {
        // Update regular tierlist image
        await fetch(`/api/admin/tierlists/${tierlistId}/images/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: newUrl }),
        });
        setEditState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            images: prev.images.map((img) =>
              img.id === imageId ? { ...img, image_url: newUrl } : img
            ),
          };
        });
      }
      showSaveConfirmation("Image cropped");
    } catch (err) {
      console.error("Crop upload error:", err);
    }
    setAdminCropImage(null);
  }

  // ── Admin cover crop result handler ─────────────────────────────────────────
  async function handleAdminCoverCropResult(croppedDataUrl: string) {
    if (!adminCoverCrop) return;
    const { tierlistId, isVote } = adminCoverCrop;
    try {
      const resp = await fetch(croppedDataUrl);
      const blob = await resp.blob();
      const file = new File([blob], "cover-cropped.png", { type: "image/png" });
      const supabase = createClient();
      const path = `cover-crops/${crypto.randomUUID()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("tierlist-images")
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path);
      const newUrl = urlData.publicUrl;

      if (isVote) {
        const res = await fetch(`/api/admin/vote-tierlists/${tierlistId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cover_image_url: newUrl }),
        });
        if (res.ok) {
          setVotelists((prev) => prev.map((v) => v.id === tierlistId ? { ...v, cover_image_url: newUrl } : v));
          showSaveConfirmation("Cover photo cropped & saved");
        }
      } else {
        // Regular tierlist — update editState cover
        setEditState((prev) => {
          if (!prev) return prev;
          if (prev.customCoverPreview) URL.revokeObjectURL(prev.customCoverPreview);
          return {
            ...prev,
            cover_image_url: newUrl,
            customCoverFile: null,
            customCoverPreview: null,
            selectedCoverImageId: null,
          };
        });
        // Save to DB
        await fetch(`/api/admin/tierlists/${tierlistId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cover_image_url: newUrl }),
        });
        showSaveConfirmation("Cover photo cropped & saved");
      }
    } catch (err) {
      console.error("Cover crop error:", err);
    }
    setAdminCoverCrop(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const editCoverPreview = getEditCoverPreview();

  return (
    <div>
      {/* ── Save confirmation toast ─────────────────────────────────── */}
      {saveConfirmation && (
        <div className="fixed top-4 right-4 z-50 animate-pulse rounded-lg border border-green-700 bg-green-900/90 px-4 py-3 text-sm font-semibold text-green-300 shadow-lg">
          ✓ {saveConfirmation}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 border-b border-gray-800 pb-2">
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
        <div className="ml-auto">
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/admin/export");
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `tierlist-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showSaveConfirmation("Backup downloaded");
              } catch {
                showSaveConfirmation("Export failed");
              }
            }}
            className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
          >
            Export Backup
          </button>
        </div>
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
                  <button
                    onClick={() => moveCategory(cat.id, "up")}
                    disabled={categories.indexOf(cat) === 0}
                    className="rounded-lg border border-gray-600 px-2 py-1.5 text-xs font-semibold text-gray-300 hover:border-indigo-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveCategory(cat.id, "down")}
                    disabled={categories.indexOf(cat) === categories.length - 1}
                    className="rounded-lg border border-gray-600 px-2 py-1.5 text-xs font-semibold text-gray-300 hover:border-indigo-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    ↓
                  </button>
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

          {/* ── Homepage ordering per category ── */}
          {categories.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-white">Homepage Display Order</h3>
              <p className="mb-4 text-xs text-gray-500">
                Control how tierlists are ordered in each category on the homepage (max 6 shown).
              </p>
              <div className="space-y-2">
                {categories.map((cat) => {
                  const setting = catSettings[cat.name];
                  const method = setting?.sort_method ?? "recent";
                  const isSaving = catSettingsSaving[cat.name] ?? false;
                  return (
                    <div key={cat.id} className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-sm font-semibold text-white">{cat.name}</span>
                        <select
                          value={method}
                          onChange={(e) => saveCatSetting(cat.name, e.target.value)}
                          disabled={isSaving}
                          className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                        >
                          <option value="recent">Most recent</option>
                          <option value="views">Highest views</option>
                          <option value="likes">Most liked</option>
                          <option value="manual">Manual (pin specific tierlists)</option>
                        </select>
                        {isSaving && <span className="text-xs text-gray-500">Saving…</span>}
                      </div>
                      {method === "manual" && (() => {
                        const pinnedIds = setting?.pinned_ids ?? [];
                        const search = (pinPickerSearch[cat.name] ?? "").toLowerCase();
                        const filtered = allPinItems.filter((item) =>
                          item.title.toLowerCase().includes(search)
                        );
                        return (
                          <div className="mt-3">
                            <p className="mb-2 text-[10px] text-gray-500">
                              Select up to 6 tierlists to pin (in order). Click to add/remove. Vote tierlists are labelled.
                            </p>
                            {/* Pinned order */}
                            {pinnedIds.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {pinnedIds.map((pid, idx) => {
                                  const item = allPinItems.find((t) => t.id === pid);
                                  return (
                                    <span key={pid} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${item?.is_vote ? "border-purple-600 bg-purple-900/40 text-purple-300" : "border-indigo-600 bg-indigo-900/40 text-indigo-300"}`}>
                                      <span className={`font-bold ${item?.is_vote ? "text-purple-400" : "text-indigo-400"}`}>{idx + 1}.</span>
                                      {item?.is_vote && <span className="rounded bg-purple-800/60 px-1 text-[8px] font-bold text-purple-300">Vote</span>}
                                      {item?.title ?? pid.slice(0, 8) + "…"}
                                      <button
                                        onClick={() => {
                                          const next = pinnedIds.filter((id) => id !== pid);
                                          saveCatSetting(cat.name, "manual", next);
                                          setCatSettings((prev) => ({
                                            ...prev,
                                            [cat.name]: { sort_method: "manual", pinned_ids: next },
                                          }));
                                        }}
                                        className={`ml-0.5 hover:text-white ${item?.is_vote ? "text-purple-400" : "text-indigo-400"}`}
                                      >×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {/* Search input */}
                            <input
                              type="text"
                              value={pinPickerSearch[cat.name] ?? ""}
                              onChange={(e) => setPinPickerSearch((prev) => ({ ...prev, [cat.name]: e.target.value }))}
                              placeholder="Search tierlists and vote tierlists…"
                              className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
                            />
                            {/* Results */}
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800">
                              {filtered.length === 0 ? (
                                <p className="px-3 py-2 text-[10px] text-gray-600">No results.</p>
                              ) : filtered.slice(0, 30).map((item) => {
                                const pinned = pinnedIds.includes(item.id);
                                const canAdd = !pinned && pinnedIds.length < 6;
                                return (
                                  <button
                                    key={item.id}
                                    disabled={!pinned && !canAdd}
                                    onClick={() => {
                                      const next = pinned
                                        ? pinnedIds.filter((id) => id !== item.id)
                                        : [...pinnedIds, item.id];
                                      saveCatSetting(cat.name, "manual", next);
                                      setCatSettings((prev) => ({
                                        ...prev,
                                        [cat.name]: { sort_method: "manual", pinned_ids: next },
                                      }));
                                    }}
                                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                                      pinned
                                        ? "bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50"
                                        : canAdd
                                        ? "text-gray-300 hover:bg-gray-700"
                                        : "cursor-not-allowed text-gray-600"
                                    }`}
                                  >
                                    <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border text-[9px] flex items-center justify-center ${pinned ? "border-indigo-500 bg-indigo-600 text-white" : "border-gray-600"}`}>
                                      {pinned && "✓"}
                                    </span>
                                    {item.is_vote && <span className="rounded bg-purple-800/60 px-1 py-0.5 text-[8px] font-bold text-purple-300 flex-shrink-0">Vote</span>}
                                    <span className="truncate">{item.title}</span>
                                    {pinned && (
                                      <span className="ml-auto text-[9px] text-indigo-400">
                                        #{pinnedIds.indexOf(item.id) + 1}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {pinnedIds.length >= 6 && (
                              <p className="mt-1 text-[10px] text-yellow-600">Maximum 6 tierlists pinned.</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-white">{tl.title}</p>
                  {((tl as Tierlist & { additional_categories?: string[] }).additional_categories?.length ?? 0) > 0 && (
                    <span className="flex-shrink-0 text-yellow-400 text-sm" title={`Also in: ${(tl as Tierlist & { additional_categories?: string[] }).additional_categories!.join(", ")}`}>★</span>
                  )}
                </div>
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

                    {/* Additional Categories */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">
                        Additional Categories
                      </label>
                      <p className="mb-2 text-[10px] text-gray-500">
                        Select extra categories this tierlist should also appear in (besides the primary one above).
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {categories
                          .filter((c) => c.name !== editState.category)
                          .map((c) => {
                            const checked = editState.additional_categories.includes(c.name);
                            return (
                              <label
                                key={c.id}
                                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  checked
                                    ? "border-indigo-500 bg-indigo-900/40 text-indigo-300"
                                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setEditState((p) => {
                                      if (!p) return p;
                                      const next = checked
                                        ? p.additional_categories.filter((n) => n !== c.name)
                                        : [...p.additional_categories, c.name];
                                      return { ...p, additional_categories: next };
                                    })
                                  }
                                  className="sr-only"
                                />
                                <span
                                  className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                                    checked
                                      ? "border-indigo-500 bg-indigo-600 text-white"
                                      : "border-gray-600"
                                  }`}
                                >
                                  {checked && "✓"}
                                </span>
                                {c.name}
                              </label>
                            );
                          })}
                      </div>
                    </div>

                    {/* Cover Photo */}
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-400">
                        Cover Photo
                      </label>
                      <div className="flex gap-4 items-start">
                        {/* Preview — matches homepage card dimensions exactly */}
                        <div className="flex-shrink-0">
                          <p className="mb-1 text-[10px] text-gray-500">Homepage preview</p>
                          <div
                            className={`h-32 w-48 overflow-hidden rounded-xl border-2 transition-colors ${
                              editCoverPreview
                                ? "border-indigo-500"
                                : "border-gray-700 bg-gray-800"
                            }`}
                          >
                            {editCoverPreview ? (
                              <ImageWithFallback src={editCoverPreview} alt="cover preview"
                                className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs italic text-gray-600">
                                No cover
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-2 pt-1">
                          <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white">
                            Upload new cover
                            <input
                              type="file"
                              accept={ACCEPT_IMAGE_TYPES}
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
                          {editCoverPreview && (
                            <button
                              onClick={() => setAdminCoverCrop({ imageUrl: editCoverPreview, tierlistId: tl.id })}
                              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white"
                            >
                              Crop cover
                            </button>
                          )}
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

                    {/* Linked Vote Tierlist */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">
                        Linked Vote Tierlist
                      </label>
                      <select
                        value={editState.linked_vote_tierlist_id ?? ""}
                        onChange={(e) =>
                          setEditState((p) =>
                            p ? { ...p, linked_vote_tierlist_id: e.target.value || null } : p
                          )
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">None</option>
                        {votelists.map((vl) => (
                          <option key={vl.id} value={vl.id}>{vl.title}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-gray-600">
                        Links this tierlist to a vote tierlist for cross-navigation.
                      </p>
                    </div>

                    {/* Tiers */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-400">Tiers</label>
                      <div className="space-y-1.5">
                        {editState.tiers.map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              value={tier.label}
                              onChange={(e) =>
                                setEditState((p) => {
                                  if (!p) return p;
                                  const next = [...p.tiers];
                                  next[idx] = { ...next[idx], label: e.target.value };
                                  return { ...p, tiers: next };
                                })
                              }
                              className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                              placeholder="Label"
                            />
                            <div className="flex gap-1">
                              {TIER_COLOR_OPTIONS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() =>
                                    setEditState((p) => {
                                      if (!p) return p;
                                      const next = [...p.tiers];
                                      next[idx] = { ...next[idx], color: c };
                                      return { ...p, tiers: next };
                                    })
                                  }
                                  className={`h-5 w-5 rounded-full border-2 transition-transform ${
                                    tier.color === c ? "border-white scale-110" : "border-transparent hover:scale-110"
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            {editState.tiers.length > 1 && (
                              <button
                                onClick={() =>
                                  setEditState((p) =>
                                    p ? { ...p, tiers: p.tiers.filter((_, i) => i !== idx) } : p
                                  )
                                }
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex gap-3">
                        <button
                          onClick={() =>
                            setEditState((p) =>
                              p ? { ...p, tiers: [{ label: "New", color: "#94a3b8" }, ...p.tiers] } : p
                            )
                          }
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          + Add tier to top
                        </button>
                        <button
                          onClick={() =>
                            setEditState((p) =>
                              p ? { ...p, tiers: [...p.tiers, { label: "New", color: "#94a3b8" }] } : p
                            )
                          }
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          + Add tier to bottom
                        </button>
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
                          <DndContext
                            sensors={adminDndSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event: DragEndEvent) => {
                              const { active, over } = event;
                              if (over && active.id !== over.id) {
                                setEditState((prev) => {
                                  if (!prev) return prev;
                                  const oldIdx = prev.images.findIndex((i) => i.id === active.id);
                                  const newIdx = prev.images.findIndex((i) => i.id === over.id);
                                  if (oldIdx === -1 || newIdx === -1) return prev;
                                  return { ...prev, images: arrayMove(prev.images, oldIdx, newIdx) };
                                });
                              }
                            }}
                          >
                            <SortableContext items={editState.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                              <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-950/50 p-3">
                                {editState.images.map((img) => {
                                  const isCover =
                                    !editState.customCoverPreview &&
                                    (editState.selectedCoverImageId === img.id ||
                                      (!editState.selectedCoverImageId &&
                                        img.image_url === editState.cover_image_url));
                                  return (
                                    <SortableImageCard key={img.id} id={img.id}>
                                      <div className="group relative">
                                        <button
                                          type="button"
                                          onClick={() => selectImageAsCover(img.id)}
                                          title="Set as cover"
                                          className="block focus:outline-none"
                                        >
                                          <ImageWithFallback
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
                                        {/* Crop button */}
                                        <div className="flex justify-center gap-1 mt-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAdminCropImage({ tierlistId: tl.id, imageId: img.id, imageUrl: img.image_url, imageName: img.name });
                                            }}
                                            className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-amber-400 hover:bg-gray-700 hover:text-amber-300"
                                            title="Crop image"
                                          >
                                            ✂
                                          </button>
                                        </div>
                                        <p className="max-w-[80px] truncate text-center text-[10px] text-gray-500">
                                          {img.name}
                                        </p>
                                      </div>
                                    </SortableImageCard>
                                  );
                                })}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <p className="mt-1.5 text-xs text-gray-600">
                            Drag to reorder · click to set as cover · hover × to remove
                          </p>
                        </>
                      )}
                    </div>

                    {/* Face Detection Toggle */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={editState.face_detection_enabled}
                          onChange={(e) =>
                            setEditState((p) =>
                              p ? { ...p, face_detection_enabled: e.target.checked } : p
                            )
                          }
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-gray-400 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                      </label>
                      <span className="text-xs text-gray-300">
                        Face detection {editState.face_detection_enabled ? "ON" : "OFF"}
                      </span>
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
              {/* Category */}
              <select
                value={newVoteCategory}
                onChange={(e) => setNewVoteCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                {categories.length === 0 && <option value="">General</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
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
                    <input type="file" accept={ACCEPT_IMAGE_TYPES} className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { const p = URL.createObjectURL(f); if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview); setNewVoteCoverFile(f); setNewVoteCoverPreview(p); e.target.value = ""; } }}
                    />
                  </label>
                )}
              </div>
              {/* Tier editor */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-400">Tiers</p>
                <div className="space-y-1.5">
                  {newVoteTiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={tier.label}
                        onChange={(e) => {
                          const next = [...newVoteTiers];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setNewVoteTiers(next);
                        }}
                        className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Label"
                      />
                      <div className="flex gap-1">
                        {TIER_COLOR_OPTIONS.map((c) => (
                          <button key={c} type="button"
                            onClick={() => { const next = [...newVoteTiers]; next[idx] = { ...next[idx], color: c }; setNewVoteTiers(next); }}
                            className={`h-5 w-5 rounded-full border-2 transition-transform ${tier.color === c ? "border-white scale-110" : "border-transparent hover:scale-110"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      {newVoteTiers.length > 1 && (
                        <button onClick={() => setNewVoteTiers((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-red-400 hover:text-red-300">×</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-3">
                  <button onClick={() => setNewVoteTiers((prev) => [{ label: "New", color: "#94a3b8" }, ...prev])}
                    className="text-xs text-purple-400 hover:text-purple-300">
                    + Add tier to top
                  </button>
                  <button onClick={() => setNewVoteTiers((prev) => [...prev, { label: "New", color: "#94a3b8" }])}
                    className="text-xs text-purple-400 hover:text-purple-300">
                    + Add tier to bottom
                  </button>
                </div>
              </div>

              {/* Images section */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-400">Images</p>
                {newVoteImageFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {newVoteImageFiles.map((f, i) => (
                      <div key={i} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-gray-600">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setNewVoteImageFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white opacity-0 group-hover:opacity-100"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white">
                    + Add images
                    <input
                      type="file"
                      accept={ACCEPT_IMAGE_TYPES}
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setNewVoteImageFiles((prev) => [...prev, ...files]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-500">
                    {newVoteImageFiles.length > 0 ? `${newVoteImageFiles.length} image${newVoteImageFiles.length === 1 ? "" : "s"} ready` : "Optional — add after creation too"}
                  </span>
                </div>
              </div>

              {/* Import from existing tierlist */}
              <div>
                {!newVoteShowImport ? (
                  <button
                    onClick={() => {
                      setNewVoteShowImport(true);
                      if (!allTierlists.length) {
                        fetch("/api/admin/tierlists").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setAllTierlists(data); }).catch(() => {});
                      }
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300"
                  >
                    ↙ Import images from existing tierlist
                  </button>
                ) : (
                  <div className="rounded-lg border border-purple-800 bg-purple-950/30 p-3 space-y-2">
                    <p className="text-xs font-semibold text-purple-300">Import images from tierlist</p>
                    <select
                      value={newVoteImportSourceId}
                      onChange={(e) => setNewVoteImportSourceId(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Select a tierlist…</option>
                      {allTierlists.map((tl) => (
                        <option key={tl.id} value={tl.id}>{tl.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setNewVoteShowImport(false); setNewVoteImportSourceId(""); }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Cancel import
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleCreateVote} disabled={newVoteCreating || !newVoteTitle.trim()}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                  {newVoteCreating ? "Creating…" : "Create"}
                </button>
                <button onClick={() => { setShowCreateVote(false); setNewVoteTitle(""); setNewVoteCategory(""); setNewVoteTiers(DEFAULT_VOTE_TIERS); setNewVoteImageFiles([]); setNewVoteImportSourceId(""); setNewVoteShowImport(false); if (newVoteCoverPreview) URL.revokeObjectURL(newVoteCoverPreview); setNewVoteCoverFile(null); setNewVoteCoverPreview(null); }}
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
                    {editingVoteTitleId === vl.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editVoteTitleValue}
                          onChange={(e) => setEditVoteTitleValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveVoteTitle(vl.id); if (e.key === "Escape") setEditingVoteTitleId(null); }}
                          className="flex-1 rounded-lg border border-purple-600 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleSaveVoteTitle(vl.id)} disabled={savingVoteTitle}
                          className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                          {savingVoteTitle ? "…" : "Save"}
                        </button>
                        <button onClick={() => setEditingVoteTitleId(null)}
                          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-white">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingVoteTitleId(vl.id); setEditVoteTitleValue(vl.title); }}
                        className="group flex items-center gap-1.5 text-left"
                        title="Click to rename"
                      >
                        <p className="truncate text-sm font-semibold text-white group-hover:text-purple-300">{vl.title}</p>
                        <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">✏️</span>
                      </button>
                    )}
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

                    {/* Cover photo */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-400">Cover Photo</p>
                      <div className="flex gap-4 items-start">
                        {/* Preview — matches homepage card dimensions */}
                        <div className="flex-shrink-0">
                          <p className="mb-1 text-[10px] text-gray-500">Homepage preview</p>
                          <div className={`h-32 w-48 overflow-hidden rounded-xl border-2 transition-colors ${
                            (voteCoverPreview || vl.cover_image_url) ? "border-purple-500" : "border-gray-700 bg-gray-800"
                          }`}>
                            {(voteCoverPreview || vl.cover_image_url) ? (
                              <ImageWithFallback src={voteCoverPreview || vl.cover_image_url!} alt="cover preview"
                                className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs italic text-gray-600">No cover</div>
                            )}
                          </div>
                        </div>
                        {/* Controls */}
                        <div className="flex flex-col gap-2 pt-1">
                          {voteCoverPreview ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVoteCoverUpload(vl.id)}
                                disabled={voteCoverUploading}
                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                                {voteCoverUploading ? "Saving…" : "Save cover"}
                              </button>
                              <button
                                onClick={() => { if (voteCoverPreview) URL.revokeObjectURL(voteCoverPreview); setVoteCoverFile(null); setVoteCoverPreview(null); }}
                                className="text-xs text-red-400 hover:text-red-300">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white">
                              {vl.cover_image_url ? "Upload new cover" : "Upload cover"}
                              <input type="file" accept={ACCEPT_IMAGE_TYPES} className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    if (voteCoverPreview) URL.revokeObjectURL(voteCoverPreview);
                                    setVoteCoverFile(f);
                                    setVoteCoverPreview(URL.createObjectURL(f));
                                    e.target.value = "";
                                  }
                                }} />
                            </label>
                          )}
                          {vl.cover_image_url && (
                            <button
                              onClick={() => setAdminCoverCrop({ imageUrl: vl.cover_image_url!, tierlistId: vl.id, isVote: true })}
                              className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-purple-500 hover:text-white">
                              Crop cover
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Pick cover from existing images */}
                      {voteImagesMap[vl.id] && voteImagesMap[vl.id].length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1.5 text-[10px] text-gray-500">Or pick from existing images:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {voteImagesMap[vl.id].map((img) => (
                              <button
                                key={img.id}
                                onClick={async () => {
                                  const res = await fetch(`/api/admin/vote-tierlists/${vl.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ cover_image_url: img.image_url }),
                                  });
                                  if (res.ok) {
                                    setVotelists((prev) => prev.map((v) => v.id === vl.id ? { ...v, cover_image_url: img.image_url } : v));
                                    showSaveConfirmation("Cover photo updated");
                                  }
                                }}
                                className={`relative rounded-lg border-2 transition-colors ${
                                  vl.cover_image_url === img.image_url
                                    ? "border-purple-400"
                                    : "border-gray-700 hover:border-gray-500"
                                }`}
                                title={`Set "${img.name}" as cover`}
                              >
                                <ImageWithFallback
                                  src={img.image_url}
                                  alt={img.name}
                                  className="h-12 w-12 rounded-md object-cover"
                                />
                                {vl.cover_image_url === img.image_url && (
                                  <span className="absolute left-0.5 top-0.5 rounded-full bg-purple-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white">
                                    Cover
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-400">Category</p>
                      <select
                        value={vl.category ?? (categories.length > 0 ? categories[0].name : "General")}
                        onChange={async (e) => {
                          const category = e.target.value;
                          const res = await fetch(`/api/admin/vote-tierlists/${vl.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ category }),
                          });
                          if (res.ok) {
                            setVotelists((prev) => prev.map((v) => v.id === vl.id ? { ...v, category } : v));
                            showSaveConfirmation("Category saved");
                          }
                        }}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                      >
                        {categories.length === 0 && <option value="General">General</option>}
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Face Detection Toggle */}
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={vl.face_detection_enabled ?? false}
                          onChange={async (e) => {
                            const enabled = e.target.checked;
                            const res = await fetch(`/api/admin/vote-tierlists/${vl.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ face_detection_enabled: enabled }),
                            });
                            if (res.ok) {
                              setVotelists((prev) =>
                                prev.map((v) => v.id === vl.id ? { ...v, face_detection_enabled: enabled } : v)
                              );
                              showSaveConfirmation(enabled ? "Face detection enabled" : "Face detection disabled");
                            }
                          }}
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-gray-400 after:transition-all peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                      </label>
                      <span className="text-xs text-gray-300">
                        Face detection {(vl.face_detection_enabled ?? false) ? "ON" : "OFF"}
                      </span>
                      {(vl.face_detection_enabled ?? false) && (voteImagesMap[vl.id]?.length ?? 0) > 0 && (
                        <button
                          onClick={async () => {
                            const imgs = voteImagesMap[vl.id] ?? [];
                            if (imgs.length === 0) return;
                            showSaveConfirmation("Running face detection…");
                            let updated = 0;
                            for (const img of imgs) {
                              const fc = await detectFaceFromUrl(img.image_url).catch(() => null);
                              if (!fc) continue;
                              // Save face_center to DB via the vote image PATCH endpoint
                              await fetch(`/api/admin/vote-tierlists/${vl.id}/images/${img.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ face_center: fc }),
                              }).catch(() => {});
                              updated++;
                            }
                            showSaveConfirmation(`Detected faces for ${updated}/${imgs.length} images`);
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300"
                        >
                          Run detection on all images
                        </button>
                      )}
                    </div>

                    {/* Tier editing (always visible when expanded) */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-gray-400">Tiers</p>
                        <button onClick={() => handleSaveTiers(vl.id)} disabled={savingTiers || editingTiersId !== vl.id}
                          className="text-[10px] text-green-400 hover:text-green-300 disabled:opacity-50">
                          {savingTiers ? "Saving…" : "Save tiers"}
                        </button>
                      </div>
                      {editingTiersId === vl.id && (
                        <div className="space-y-1.5 mb-3">
                          {editTiers.map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                value={tier.label}
                                onChange={(e) => {
                                  const next = [...editTiers];
                                  next[idx] = { ...next[idx], label: e.target.value };
                                  setEditTiers(next);
                                }}
                                className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                              />
                              <div className="flex gap-1 flex-wrap">
                                {TIER_COLOR_OPTIONS.map((c) => (
                                  <button key={c} type="button"
                                    onClick={() => { const next = [...editTiers]; next[idx] = { ...next[idx], color: c }; setEditTiers(next); }}
                                    className={`h-5 w-5 rounded-full border-2 transition-transform ${tier.color === c ? "border-white scale-110" : "border-transparent hover:scale-110"}`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                              {editTiers.length > 1 && (
                                <button onClick={() => setEditTiers((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-xs text-red-400 hover:text-red-300">×</button>
                              )}
                            </div>
                          ))}
                          <div className="flex gap-3">
                            <button onClick={() => setEditTiers((prev) => [{ label: "New", color: "#94a3b8" }, ...prev])}
                              className="text-xs text-purple-400 hover:text-purple-300">
                              + Add tier to top
                            </button>
                            <button onClick={() => setEditTiers((prev) => [...prev, { label: "New", color: "#94a3b8" }])}
                              className="text-xs text-purple-400 hover:text-purple-300">
                              + Add tier to bottom
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-gray-400">Images ({voteImagesMap[vl.id]?.length ?? 0})</p>
                    {!(voteImagesMap[vl.id]) ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : voteImagesMap[vl.id].length === 0 ? (
                      <p className="text-xs italic text-gray-600">No images yet. Add some below.</p>
                    ) : (
                      <>
                        <DndContext
                          sensors={adminDndSensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event: DragEndEvent) => {
                            const { active, over } = event;
                            if (over && active.id !== over.id) {
                              const imgs = [...voteImagesMap[vl.id]];
                              const oldIdx = imgs.findIndex((i) => i.id === active.id);
                              const newIdx = imgs.findIndex((i) => i.id === over.id);
                              if (oldIdx === -1 || newIdx === -1) return;
                              const reordered = arrayMove(imgs, oldIdx, newIdx);
                              setVoteImagesMap((prev) => ({ ...prev, [vl.id]: reordered }));
                              fetch(`/api/admin/vote-tierlists/${vl.id}/images/reorder`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ images: reordered.map((im, i) => ({ id: im.id, sort_order: i })) }),
                              });
                            }
                          }}
                        >
                          <SortableContext items={voteImagesMap[vl.id].map((i) => i.id)} strategy={rectSortingStrategy}>
                            <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-950/50 p-3">
                              {voteImagesMap[vl.id].map((img) => (
                                <SortableImageCard key={img.id} id={img.id}>
                                  <div className="group relative">
                                    <ImageWithFallback src={img.image_url} alt={img.name}
                                      className="h-20 w-20 rounded-lg object-cover border-2 border-gray-700" />
                                    <button
                                      onClick={() => handleDeleteVoteImage(vl.id, img.id)}
                                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                      ×
                                    </button>
                                    {/* Crop button */}
                                    <div className="flex justify-center gap-1 mt-1">
                                      <button
                                        onClick={() => {
                                          setAdminCropImage({ tierlistId: vl.id, imageId: img.id, imageUrl: img.image_url, imageName: img.name, isVote: true });
                                        }}
                                        className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-amber-400 hover:bg-gray-700 hover:text-amber-300"
                                        title="Crop image"
                                      >
                                        ✂
                                      </button>
                                    </div>
                                    <p className="mt-0.5 max-w-[80px] truncate text-center text-[10px] text-gray-500">{img.name}</p>
                                  </div>
                                </SortableImageCard>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <p className="mt-1.5 text-xs text-gray-600">
                          Drag to reorder · hover × to remove · ✂ to crop
                        </p>
                      </>
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
                            accept={ACCEPT_IMAGE_TYPES}
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
      {/* Admin image crop overlay */}
      {adminCropImage && (
        <CropOverlay
          imageUrl={adminCropImage.imageUrl}
          imageName={adminCropImage.imageName}
          onCrop={handleAdminCropResult}
          onCancel={() => setAdminCropImage(null)}
        />
      )}
      {/* Admin cover crop overlay (landscape 3:2) */}
      {adminCoverCrop && (
        <CropOverlay
          imageUrl={adminCoverCrop.imageUrl}
          imageName="Cover Photo"
          aspectRatio={3 / 2}
          onCrop={handleAdminCoverCropResult}
          onCancel={() => setAdminCoverCrop(null)}
        />
      )}
    </div>
  );
}
