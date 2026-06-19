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
import BlindRankingsAdmin from "./BlindRankingsAdmin";
import TicTacToeAdmin from "./TicTacToeAdmin";
import TenableAdmin from "./TenableAdmin";

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
  face_center?: FaceCenter | null;
}

/** Extended image entry used in the admin editor — may include staged changes. */
interface VoteEditImage {
  id: string;           // DB id, or `temp-*` for new uploads staged client-side
  name: string;
  image_url: string;    // original URL, blob: URL for staged uploads, unchanged for staged crops
  sort_order: number;
  face_center: FaceCenter | null;
  /** Staged new upload (not yet in storage / DB) */
  isNew?: boolean;
  newFile?: File;
  /** Staged crop result (data URL) — upload + PATCH on save */
  pendingCropDataUrl?: string;
}

interface VoteEditState {
  voteId: string;
  category: string;
  face_detection_enabled: boolean;
  /** Whether face detection was on when the editor opened — used to decide
   *  whether to auto-detect across all images on save when it's been turned on. */
  initial_face_detection_enabled: boolean;
  cover_image_url: string | null;
  /** Which existing image (if any) is staged as the new cover */
  selectedCoverImageId: string | null;
  /** Newly uploaded cover file staged for save */
  customCoverFile: File | null;
  customCoverPreview: string | null;
  /** Cover cropped via the crop overlay — staged as data URL, uploaded on save */
  customCoverCropDataUrl: string | null;
  tiers: VoteTier[];
  images: VoteEditImage[];
  /** DB ids of images staged for deletion on save */
  pendingDeleteImageIds: string[];
  /** Import from another tierlist, staged for save */
  pendingImportSourceId: string | null;
  /** Original names when the editor was opened — used to detect name edits on save */
  initialNames: Record<string, string>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isDirty: boolean;
}

interface AdminImage {
  id: string;
  name: string;
  image_url: string;
  sort_order: number;
  face_center?: FaceCenter | null;
}

interface StagedAdminImage {
  tempId: string;
  file: File;
  preview: string;
  name: string;
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
  /** New images staged for upload on Save */
  stagedNewImages: StagedAdminImage[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  linked_vote_tierlist_id: string | null;
  linked_blind_ranking_id: string | null;
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
  const [tab, setTab] = useState<"tierlists" | "categories" | "vote-tierlists" | "blind-rankings" | "tictactoe" | "tenable">("tierlists");
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
  // Admin image cropping (works for both regular and vote tierlists)
  const [adminCropImage, setAdminCropImage] = useState<{ tierlistId: string; imageId: string; imageUrl: string; imageName: string; isVote?: boolean } | null>(null);
  // Admin cover photo cropping
  const [adminCoverCrop, setAdminCoverCrop] = useState<{ imageUrl: string; tierlistId: string; isVote?: boolean } | null>(null);
  // Custom tiers for creating new vote tierlists
  const DEFAULT_VOTE_TIERS: VoteTier[] = [
    { label: "S", color: "#4ade80" },
    { label: "A", color: "#86efac" },
    { label: "B", color: "#fde047" },
    { label: "C", color: "#fb923c" },
    { label: "D", color: "#f87171" },
  ];
  const [newVoteTiers, setNewVoteTiers] = useState<VoteTier[]>(DEFAULT_VOTE_TIERS);
  // Batch edit state for the expanded vote tierlist editor.
  // All changes within the "Manage" panel stage here; only persist on Save Changes.
  const [voteEditState, setVoteEditState] = useState<VoteEditState | null>(null);
  // Convert regular tierlist to vote tierlist
  const [showConvertPicker, setShowConvertPicker] = useState(false);
  const [convertSourceId, setConvertSourceId] = useState("");
  const [converting, setConverting] = useState(false);
  // Convert regular tierlist to blind ranking
  const [showConvertBlindPicker, setShowConvertBlindPicker] = useState(false);
  const [convertBlindSourceId, setConvertBlindSourceId] = useState("");
  const [convertingBlind, setConvertingBlind] = useState(false);
  // Blind rankings list for linking picker
  const [blindRankingsForPicker, setBlindRankingsForPicker] = useState<{ id: string; title: string }[]>([]);

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
      stagedNewImages: [],
      loading: true,
      saving: false,
      error: null,
      linked_vote_tierlist_id: tl.linked_vote_tierlist_id ?? null,
      linked_blind_ranking_id: (tl as Tierlist & { linked_blind_ranking_id?: string | null }).linked_blind_ranking_id ?? null,
      additional_categories: (tl as Tierlist & { additional_categories?: string[] }).additional_categories ?? [],
      tiers: (tl.tiers as VoteTier[] | undefined) ?? DEFAULT_TIERS,
      face_detection_enabled: tl.face_detection_enabled !== false,
    });
    // Always refresh vote tierlists and blind rankings for pickers (avoid stale data)
    fetch("/api/admin/vote-tierlists")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) { setVotelists(data); setVotelistsLoaded(true); } })
      .catch(() => {});
    fetch("/api/admin/blind-rankings")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBlindRankingsForPicker(data); })
      .catch(() => {});

    // Fetch images + tiers for this tierlist from Supabase
    const supabase = createClient();
    const [{ data: images }, { data: tlData }] = await Promise.all([
      supabase
        .from("tierlist_images")
        .select("id, name, image_url, sort_order, face_center")
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
      // Initial list from admin page doesn't include these columns; pull from full fetch
      const linkedVote = (tlData as { linked_vote_tierlist_id?: string | null } | null)?.linked_vote_tierlist_id;
      const linkedBlind = (tlData as { linked_blind_ranking_id?: string | null } | null)?.linked_blind_ranking_id;
      const additional = (tlData as { additional_categories?: string[] } | null)?.additional_categories;
      return {
        ...prev,
        images: (images as AdminImage[]) ?? [],
        selectedCoverImageId,
        tiers,
        face_detection_enabled: fde !== undefined ? (fde as boolean) : prev.face_detection_enabled,
        linked_vote_tierlist_id: linkedVote !== undefined ? linkedVote : prev.linked_vote_tierlist_id,
        linked_blind_ranking_id: linkedBlind !== undefined ? linkedBlind : prev.linked_blind_ranking_id,
        additional_categories: additional !== undefined ? additional : prev.additional_categories,
        loading: false,
      };
    });
  }

  // ── Close / cancel edit form ───────────────────────────────────────────────
  function closeEdit() {
    if (editState?.customCoverPreview) {
      URL.revokeObjectURL(editState.customCoverPreview);
    }
    editState?.stagedNewImages.forEach((i) => URL.revokeObjectURL(i.preview));
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
          linked_blind_ranking_id: editState.linked_blind_ranking_id,
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

      // Upload staged new images
      if (editState.stagedNewImages.length > 0) {
        const supabaseForImages = editState.customCoverFile ? createClient() : (cover_image_url ? createClient() : createClient());
        for (const staged of editState.stagedNewImages) {
          const { compressImage } = await import("@/lib/imageUtils");
          const compressed = await compressImage(staged.file);
          const path = `${crypto.randomUUID()}.webp`;
          const { error: upErr } = await supabaseForImages.storage
            .from("tierlist-images")
            .upload(path, compressed, { contentType: "image/webp" });
          if (upErr) continue;
          const { data: urlData } = supabaseForImages.storage
            .from("tierlist-images")
            .getPublicUrl(path);
          await fetch(`/api/admin/tierlists/${tierlistId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: staged.name, image_url: urlData.publicUrl }),
          });
        }
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
    if (expandedVoteId === id) {
      handleCloseVoteEdit();
      return;
    }
    const vl = votelists.find((v) => v.id === id);
    if (!vl) return;

    setExpandedVoteId(id);
    setVoteEditState({
      voteId: id,
      category: vl.category,
      face_detection_enabled: vl.face_detection_enabled ?? false,
      initial_face_detection_enabled: vl.face_detection_enabled ?? false,
      cover_image_url: vl.cover_image_url,
      selectedCoverImageId: null,
      customCoverFile: null,
      customCoverPreview: null,
      customCoverCropDataUrl: null,
      tiers: DEFAULT_VOTE_TIERS,
      images: [],
      pendingDeleteImageIds: [],
      pendingImportSourceId: null,
      initialNames: {},
      loading: true,
      saving: false,
      error: null,
      isDirty: false,
    });

    // Fetch images (with face_center) + tiers in parallel
    const supabase = createClient();
    const [imgsRes, tiersRes] = await Promise.all([
      fetch(`/api/admin/vote-tierlists/${id}/images`),
      supabase.from("vote_tierlists").select("tiers").eq("id", id).single(),
    ]);
    const imgs: VoteImage[] = imgsRes.ok ? await imgsRes.json() : [];
    const tiers = (tiersRes.data?.tiers as VoteTier[]) ?? DEFAULT_VOTE_TIERS;
    const editImgs: VoteEditImage[] = imgs.map((i) => ({
      id: i.id,
      name: i.name,
      image_url: i.image_url,
      sort_order: i.sort_order,
      face_center: i.face_center ?? null,
    }));
    const nameMap: Record<string, string> = {};
    for (const i of imgs) nameMap[i.id] = i.name;
    setVoteImagesMap((prev) => ({ ...prev, [id]: imgs }));
    setVoteEditState((prev) => prev && prev.voteId === id
      ? { ...prev, images: editImgs, tiers, initialNames: nameMap, loading: false }
      : prev);

    if (!allTierlists.length) {
      const res = await fetch("/api/admin/tierlists");
      if (res.ok) {
        const data = await res.json();
        setAllTierlists(data);
      }
    }
  }

  // Close the vote edit panel. If there are unsaved changes, ask to confirm
  // unless `force` is true (set internally after a successful save).
  function handleCloseVoteEdit(force = false) {
    if (!force && voteEditState?.isDirty) {
      if (!window.confirm("You have unsaved changes. Discard them?")) return;
    }
    // Clean up object URLs for staged files / previews
    if (voteEditState?.customCoverPreview) URL.revokeObjectURL(voteEditState.customCoverPreview);
    for (const img of voteEditState?.images ?? []) {
      if (img.isNew && img.image_url.startsWith("blob:")) URL.revokeObjectURL(img.image_url);
    }
    setExpandedVoteId(null);
    setVoteEditState(null);
    setImportingVoteId(null);
    setImportSourceId("");
  }

  // What to show in the cover photo preview: staged crop > staged upload > staged pick > current cover
  function getVoteCoverPreview(): string | null {
    if (!voteEditState) return null;
    if (voteEditState.customCoverCropDataUrl) return voteEditState.customCoverCropDataUrl;
    if (voteEditState.customCoverPreview) return voteEditState.customCoverPreview;
    if (voteEditState.selectedCoverImageId) {
      return voteEditState.images.find((i) => i.id === voteEditState.selectedCoverImageId)
        ?.image_url ?? null;
    }
    return voteEditState.cover_image_url;
  }

  // Batch save — commits all staged edits in the vote edit panel.
  async function handleSaveVoteEdit() {
    if (!voteEditState) return;
    const snapshot = voteEditState;
    const { voteId } = snapshot;
    setVoteEditState((p) => p ? { ...p, saving: true, error: null } : p);

    try {
      const supabase = createClient();
      let cover_image_url: string | null = snapshot.cover_image_url;

      // 1. Cover photo
      if (snapshot.customCoverCropDataUrl) {
        const resp = await fetch(snapshot.customCoverCropDataUrl);
        const blob = await resp.blob();
        const path = `cover-crops/${crypto.randomUUID()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images").upload(path, blob, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        cover_image_url = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path).data.publicUrl;
      } else if (snapshot.customCoverFile) {
        const ext = snapshot.customCoverFile.name.split(".").pop() ?? "jpg";
        const path = `vote-covers/${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images").upload(path, snapshot.customCoverFile, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        cover_image_url = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path).data.publicUrl;
      } else if (snapshot.selectedCoverImageId) {
        const picked = snapshot.images.find((i) => i.id === snapshot.selectedCoverImageId);
        if (picked && !picked.isNew) cover_image_url = picked.image_url;
      }

      // 2. Delete any images staged for deletion
      if (snapshot.pendingDeleteImageIds.length > 0) {
        await Promise.all(
          snapshot.pendingDeleteImageIds.map((imgId) =>
            fetch(`/api/admin/vote-tierlists/${voteId}/images/${imgId}`, { method: "DELETE" })
          )
        );
      }

      // 3. Upload new images & apply staged crops
      const finalImages: VoteEditImage[] = [];
      for (const img of snapshot.images) {
        if (img.isNew && img.newFile) {
          // Process (with face detection if enabled) and upload
          const { file: processed, faceCenter } = snapshot.face_detection_enabled
            ? await processImage(img.newFile).catch(() => ({ file: img.newFile as File, faceCenter: null as FaceCenter | null }))
            : { file: img.newFile, faceCenter: null as FaceCenter | null };
          const path = `vote-images/${crypto.randomUUID()}.webp`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("tierlist-images").upload(path, processed, { upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          const publicUrl = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path).data.publicUrl;
          const res = await fetch(`/api/admin/vote-tierlists/${voteId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: img.name || "",
              image_url: publicUrl,
              face_center: snapshot.face_detection_enabled ? faceCenter : null,
            }),
          });
          if (!res.ok) throw new Error("Failed to save image");
          const row = await res.json() as VoteImage;
          // Clean up preview blob URL
          if (img.image_url.startsWith("blob:")) URL.revokeObjectURL(img.image_url);
          finalImages.push({
            id: row.id,
            name: row.name,
            image_url: row.image_url,
            sort_order: row.sort_order,
            face_center: row.face_center ?? null,
          });
        } else if (img.pendingCropDataUrl) {
          const resp = await fetch(img.pendingCropDataUrl);
          const blob = await resp.blob();
          const path = `${crypto.randomUUID()}.png`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("tierlist-images").upload(path, blob, { upsert: false });
          if (uploadError) throw new Error(uploadError.message);
          const publicUrl = supabase.storage.from("tierlist-images").getPublicUrl(uploadData.path).data.publicUrl;
          await fetch(`/api/admin/vote-tierlists/${voteId}/images/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: publicUrl }),
          });
          finalImages.push({
            id: img.id,
            name: img.name,
            image_url: publicUrl,
            sort_order: img.sort_order,
            face_center: img.face_center,
          });
        } else {
          finalImages.push({ ...img });
        }
      }

      // 4. Import from another tierlist if staged
      if (snapshot.pendingImportSourceId) {
        await fetch(`/api/admin/vote-tierlists/${voteId}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_tierlist_id: snapshot.pendingImportSourceId }),
        });
        // Refetch to pick up imported images
        const imgsRes = await fetch(`/api/admin/vote-tierlists/${voteId}/images`);
        if (imgsRes.ok) {
          const serverImgs = await imgsRes.json() as VoteImage[];
          const existing = new Set(finalImages.map((i) => i.id));
          for (const img of serverImgs) {
            if (!existing.has(img.id)) {
              finalImages.push({
                id: img.id,
                name: img.name,
                image_url: img.image_url,
                sort_order: img.sort_order,
                face_center: img.face_center ?? null,
              });
            }
          }
        }
      }

      // 5. PATCH the vote tierlist's scalar fields
      const res = await fetch(`/api/admin/vote-tierlists/${voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: snapshot.category,
          cover_image_url,
          face_detection_enabled: snapshot.face_detection_enabled,
          tiers: snapshot.tiers,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }

      // 6. Reorder images (batch)
      if (finalImages.length > 0) {
        await fetch(`/api/admin/vote-tierlists/${voteId}/images/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: finalImages.map((img, i) => ({ id: img.id, sort_order: i })),
          }),
        });
      }

      // 7. Persist name changes for existing images
      for (const img of finalImages) {
        if (img.isNew) continue;
        const origName = snapshot.initialNames[img.id];
        if (origName !== undefined && img.name !== origName) {
          await fetch(`/api/admin/vote-tierlists/${voteId}/images/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: img.name }),
          }).catch(() => {});
        }
      }

      // 8. If face detection was newly turned ON, run detection on any
      //    image that doesn't already have a face_center (sync — takes a while
      //    for large lists, but no more than running the old "Run detection"
      //    button).
      if (snapshot.face_detection_enabled && !snapshot.initial_face_detection_enabled) {
        for (const img of finalImages) {
          if (img.face_center) continue;
          const fc = await detectFaceFromUrl(img.image_url).catch(() => null);
          if (!fc) continue;
          await fetch(`/api/admin/vote-tierlists/${voteId}/images/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ face_center: fc }),
          }).catch(() => {});
          img.face_center = fc;
        }
      }

      // 8. Sync parent state
      setVotelists((prev) =>
        prev.map((v) =>
          v.id === voteId
            ? {
                ...v,
                category: snapshot.category,
                cover_image_url,
                face_detection_enabled: snapshot.face_detection_enabled,
              }
            : v
        )
      );
      const cleanImages: VoteImage[] = finalImages.map((i) => ({
        id: i.id,
        name: i.name,
        image_url: i.image_url,
        sort_order: i.sort_order,
        face_center: i.face_center,
      }));
      setVoteImagesMap((prev) => ({ ...prev, [voteId]: cleanImages }));

      handleCloseVoteEdit(true);
      showSaveConfirmation("Vote tierlist saved");
    } catch (err) {
      setVoteEditState((p) =>
        p ? { ...p, saving: false, error: err instanceof Error ? err.message : "Something went wrong" } : p
      );
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

  async function handleConvertToVote() {
    if (!convertSourceId) return;
    setConverting(true);
    setVoteError(null);
    try {
      const supabase = createClient();
      const source = tierlists.find((t) => t.id === convertSourceId);
      if (!source) throw new Error("Tierlist not found");

      const { data: fullData } = await supabase
        .from("tierlists")
        .select("title, category, cover_image_url, tiers, face_detection_enabled")
        .eq("id", convertSourceId)
        .single();
      if (!fullData) throw new Error("Could not load tierlist details");

      const res = await fetch("/api/admin/vote-tierlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fullData.title,
          category: fullData.category || "General",
          cover_image_url: fullData.cover_image_url ?? null,
          tiers: fullData.tiers ?? undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create vote tierlist");
      }
      const created = await res.json();

      await fetch(`/api/admin/vote-tierlists/${created.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_tierlist_id: convertSourceId }),
      });

      if (fullData.face_detection_enabled) {
        await fetch(`/api/admin/vote-tierlists/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ face_detection_enabled: true }),
        });
        created.face_detection_enabled = true;
      }

      // Auto-link the regular tierlist to the new vote tierlist
      await fetch(`/api/admin/tierlists/${convertSourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_vote_tierlist_id: created.id }),
      }).catch(() => {});
      setTierlists((prev) =>
        prev.map((t) => t.id === convertSourceId ? { ...t, linked_vote_tierlist_id: created.id } : t)
      );

      setVotelists((prev) => [created, ...prev]);
      setShowConvertPicker(false);
      setConvertSourceId("");
      showSaveConfirmation(`Converted "${fullData.title}" to vote tierlist`);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Conversion failed");
    }
    setConverting(false);
  }

  async function handleConvertToBlind() {
    if (!convertBlindSourceId) return;
    setConvertingBlind(true);
    try {
      const supabase = createClient();
      const source = tierlists.find((t) => t.id === convertBlindSourceId);
      if (!source) throw new Error("Tierlist not found");

      const { data: fullData } = await supabase
        .from("tierlists")
        .select("title, category, cover_image_url, face_detection_enabled")
        .eq("id", convertBlindSourceId)
        .single();
      if (!fullData) throw new Error("Could not load tierlist details");

      const res = await fetch("/api/admin/blind-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fullData.title,
          category: fullData.category || "General",
          cover_image_url: fullData.cover_image_url ?? null,
          num_slots: 10,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create blind ranking");
      }
      const created = await res.json();

      await fetch(`/api/admin/blind-rankings/${created.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_tierlist_id: convertBlindSourceId }),
      });

      if (fullData.face_detection_enabled) {
        await fetch(`/api/admin/blind-rankings/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ face_detection_enabled: true }),
        });
      }

      // Auto-link the regular tierlist to the new blind ranking
      await fetch(`/api/admin/tierlists/${convertBlindSourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_blind_ranking_id: created.id }),
      }).catch(() => {});
      setTierlists((prev) =>
        prev.map((t) => t.id === convertBlindSourceId ? { ...t, linked_blind_ranking_id: created.id } : t)
      );
      setBlindRankingsForPicker((prev) => [{ id: created.id, title: created.title }, ...prev]);

      setShowConvertBlindPicker(false);
      setConvertBlindSourceId("");
      showSaveConfirmation(`Converted "${fullData.title}" to blind ranking`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Conversion failed");
    }
    setConvertingBlind(false);
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

  // ── Admin crop result handler ───────────────────────────────────────────────
  // For vote tierlists: stages the crop in voteEditState (only uploaded on Save).
  // For regular tierlists: uploads immediately (legacy behaviour).
  async function handleAdminCropResult(croppedDataUrl: string) {
    if (!adminCropImage) return;
    const { tierlistId, imageId, isVote } = adminCropImage;

    if (isVote) {
      // Stage on voteEditState — don't persist to storage / DB yet
      setVoteEditState((prev) => {
        if (!prev || prev.voteId !== tierlistId) return prev;
        return {
          ...prev,
          isDirty: true,
          images: prev.images.map((img) =>
            img.id === imageId ? { ...img, pendingCropDataUrl: croppedDataUrl } : img
          ),
        };
      });
      setAdminCropImage(null);
      return;
    }

    // Regular tierlist — upload immediately (legacy flow)
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
      showSaveConfirmation("Image cropped");
    } catch (err) {
      console.error("Crop upload error:", err);
    }
    setAdminCropImage(null);
  }

  // ── Admin cover crop result handler ─────────────────────────────────────────
  // For vote tierlists: stages the cropped cover on voteEditState
  //   (customCoverCropDataUrl); only uploaded on Save Changes.
  // For regular tierlists: uploads immediately.
  async function handleAdminCoverCropResult(croppedDataUrl: string) {
    if (!adminCoverCrop) return;
    const { tierlistId, isVote } = adminCoverCrop;

    if (isVote) {
      setVoteEditState((prev) => {
        if (!prev || prev.voteId !== tierlistId) return prev;
        if (prev.customCoverPreview) URL.revokeObjectURL(prev.customCoverPreview);
        return {
          ...prev,
          isDirty: true,
          customCoverCropDataUrl: croppedDataUrl,
          customCoverFile: null,
          customCoverPreview: null,
          selectedCoverImageId: null,
        };
      });
      setAdminCoverCrop(null);
      return;
    }

    // Regular tierlist — upload immediately (legacy flow)
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
      await fetch(`/api/admin/tierlists/${tierlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_image_url: newUrl }),
      });
      showSaveConfirmation("Cover photo cropped & saved");
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
        <button
          onClick={() => setTab("blind-rankings")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "blind-rankings" ? "bg-amber-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Blind Rankings
        </button>
        <button
          onClick={() => setTab("tictactoe")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "tictactoe" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Tic Tac Toe
        </button>
        <button
          onClick={() => setTab("tenable")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "tenable" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Ten-A-Ball
        </button>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/admin/football/scrape"
            className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
          >
            ⚽ Scrape Data
          </a>
          <a
            href="/admin/football/players"
            className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-400 hover:text-white transition-colors"
          >
            👥 Players DB
          </a>
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
                        {editState.linked_vote_tierlist_id &&
                          !votelists.some((vl) => vl.id === editState.linked_vote_tierlist_id) && (
                            <option value={editState.linked_vote_tierlist_id}>
                              (currently linked — loading…)
                            </option>
                          )}
                        {votelists.map((vl) => (
                          <option key={vl.id} value={vl.id}>{vl.title}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-gray-600">
                        Links this tierlist to a vote tierlist for cross-navigation.
                      </p>
                    </div>

                    {/* Linked Blind Ranking */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-400">
                        Linked Blind Ranking
                      </label>
                      <select
                        value={editState.linked_blind_ranking_id ?? ""}
                        onChange={(e) =>
                          setEditState((p) =>
                            p ? { ...p, linked_blind_ranking_id: e.target.value || null } : p
                          )
                        }
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="">None</option>
                        {editState.linked_blind_ranking_id &&
                          !blindRankingsForPicker.some((br) => br.id === editState.linked_blind_ranking_id) && (
                            <option value={editState.linked_blind_ranking_id}>
                              (currently linked — loading…)
                            </option>
                          )}
                        {blindRankingsForPicker.map((br) => (
                          <option key={br.id} value={br.id}>{br.title}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-gray-600">
                        Adds a &ldquo;Blind Rank This&rdquo; button on the play page that links to this blind ranking.
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
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-xs font-semibold text-gray-400">
                          Images ({editState.images.length + editState.stagedNewImages.length})
                        </label>
                        <label className="cursor-pointer rounded-lg border border-indigo-700 bg-indigo-900/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-800/40 transition-colors">
                          + Add Images
                          <input
                            type="file"
                            multiple
                            accept={ACCEPT_IMAGE_TYPES}
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (!files) return;
                              const newStaged: StagedAdminImage[] = Array.from(files).map((file) => ({
                                tempId: crypto.randomUUID(),
                                file,
                                preview: URL.createObjectURL(file),
                                name: file.name.replace(/\.[^.]+$/, ""),
                              }));
                              setEditState((p) => p ? { ...p, stagedNewImages: [...p.stagedNewImages, ...newStaged] } : p);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {editState.images.length === 0 && editState.stagedNewImages.length === 0 ? (
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
                                          <div
                                            className={`h-20 w-20 rounded-lg border-2 transition-colors ${
                                              isCover
                                                ? "border-indigo-400"
                                                : "border-gray-700 hover:border-gray-500"
                                            }`}
                                            style={{
                                              backgroundImage: `url("${img.image_url}")`,
                                              backgroundSize: "cover",
                                              backgroundPosition: editState.face_detection_enabled && img.face_center
                                                ? `${img.face_center.x}% ${img.face_center.y}%`
                                                : "center",
                                              backgroundRepeat: "no-repeat",
                                            }}
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
                                {/* Staged new images */}
                                {editState.stagedNewImages.map((img) => (
                                  <div key={img.tempId} className="group relative">
                                    <img
                                      src={img.preview}
                                      alt={img.name}
                                      className="h-20 w-20 rounded-lg object-cover border-2 border-amber-700/50"
                                    />
                                    <span className="absolute left-1 top-1 rounded bg-amber-600/80 px-1 text-[9px] font-bold text-white">
                                      NEW
                                    </span>
                                    <button
                                      onClick={() => {
                                        setEditState((p) => {
                                          if (!p) return p;
                                          const target = p.stagedNewImages.find((i) => i.tempId === img.tempId);
                                          if (target) URL.revokeObjectURL(target.preview);
                                          return { ...p, stagedNewImages: p.stagedNewImages.filter((i) => i.tempId !== img.tempId) };
                                        });
                                      }}
                                      title="Remove"
                                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                      ×
                                    </button>
                                    <p className="max-w-[80px] truncate text-center text-[10px] text-gray-500 mt-1">
                                      {img.name}
                                    </p>
                                  </div>
                                ))}
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

          {/* Create / Convert buttons */}
          {!showCreateVote ? (
            <div className="mb-5 flex flex-wrap items-start gap-3">
              <button
                onClick={() => setShowCreateVote(true)}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
              >
                + New Vote Tierlist
              </button>
              {!showConvertPicker ? (
                <button
                  onClick={() => {
                    setShowConvertPicker(true);
                    if (!allTierlists.length) {
                      fetch("/api/admin/tierlists").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setAllTierlists(data); }).catch(() => {});
                    }
                  }}
                  className="rounded-lg border border-purple-700 px-4 py-2 text-sm font-semibold text-purple-300 hover:border-purple-500 hover:text-white"
                >
                  Convert from Tierlist
                </button>
              ) : (
                <div className="flex-1 min-w-[250px] rounded-xl border border-purple-700 bg-gray-900 p-3 space-y-2">
                  <p className="text-xs font-semibold text-purple-300">Convert Regular Tierlist to Vote Tierlist</p>
                  <select
                    value={convertSourceId}
                    onChange={(e) => setConvertSourceId(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">Select a tierlist…</option>
                    {allTierlists.map((tl) => (
                      <option key={tl.id} value={tl.id}>{tl.title}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500">
                    Creates a new vote tierlist with the same title, category, cover, tiers, and images. The original tierlist is kept.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConvertToVote}
                      disabled={!convertSourceId || converting}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
                    >
                      {converting ? "Converting…" : "Convert"}
                    </button>
                    <button
                      onClick={() => { setShowConvertPicker(false); setConvertSourceId(""); }}
                      disabled={converting}
                      className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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

                {/* Expanded editor: batch-save — nothing persists to DB until Save Changes. */}
                {expandedVoteId === vl.id && voteEditState && voteEditState.voteId === vl.id && (
                  <div className="border-t border-gray-700/60 p-4 space-y-4">
                    {voteEditState.loading ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : (
                      <>
                        {/* Cover photo */}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-gray-400">Cover Photo</p>
                          <div className="flex gap-4 items-start">
                            <div className="flex-shrink-0">
                              <p className="mb-1 text-[10px] text-gray-500">Homepage preview</p>
                              <div className={`h-32 w-48 overflow-hidden rounded-xl border-2 transition-colors ${
                                getVoteCoverPreview() ? "border-purple-500" : "border-gray-700 bg-gray-800"
                              }`}>
                                {getVoteCoverPreview() ? (
                                  <ImageWithFallback src={getVoteCoverPreview()!} alt="cover preview"
                                    className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs italic text-gray-600">No cover</div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                              {(voteEditState.customCoverFile || voteEditState.customCoverCropDataUrl) ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-yellow-400">● New cover staged</span>
                                  <button
                                    onClick={() => {
                                      setVoteEditState((p) => {
                                        if (!p) return p;
                                        if (p.customCoverPreview) URL.revokeObjectURL(p.customCoverPreview);
                                        return { ...p, customCoverFile: null, customCoverPreview: null, customCoverCropDataUrl: null, isDirty: true };
                                      });
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300">
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <label className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white">
                                  {voteEditState.cover_image_url ? "Upload new cover" : "Upload cover"}
                                  <input type="file" accept={ACCEPT_IMAGE_TYPES} className="sr-only"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        const preview = URL.createObjectURL(f);
                                        setVoteEditState((p) => {
                                          if (!p) return p;
                                          if (p.customCoverPreview) URL.revokeObjectURL(p.customCoverPreview);
                                          return { ...p, customCoverFile: f, customCoverPreview: preview, customCoverCropDataUrl: null, selectedCoverImageId: null, isDirty: true };
                                        });
                                        e.target.value = "";
                                      }
                                    }} />
                                </label>
                              )}
                              {getVoteCoverPreview() && (
                                <button
                                  onClick={() => setAdminCoverCrop({ imageUrl: getVoteCoverPreview()!, tierlistId: vl.id, isVote: true })}
                                  className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-purple-500 hover:text-white">
                                  Crop cover
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Pick cover from existing images */}
                          {voteEditState.images.filter((i) => !i.isNew).length > 0 && (
                            <div className="mt-2">
                              <p className="mb-1.5 text-[10px] text-gray-500">Or pick from existing images:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {voteEditState.images.filter((i) => !i.isNew).map((img) => {
                                  const isSelected = voteEditState.selectedCoverImageId === img.id;
                                  const isCurrentCover =
                                    !voteEditState.selectedCoverImageId &&
                                    !voteEditState.customCoverFile &&
                                    !voteEditState.customCoverCropDataUrl &&
                                    voteEditState.cover_image_url === img.image_url;
                                  return (
                                    <button
                                      key={img.id}
                                      onClick={() => {
                                        setVoteEditState((p) => {
                                          if (!p) return p;
                                          if (p.customCoverPreview) URL.revokeObjectURL(p.customCoverPreview);
                                          return { ...p, selectedCoverImageId: img.id, customCoverFile: null, customCoverPreview: null, customCoverCropDataUrl: null, isDirty: true };
                                        });
                                      }}
                                      className={`relative rounded-lg border-2 transition-colors ${
                                        isSelected || isCurrentCover ? "border-purple-400" : "border-gray-700 hover:border-gray-500"
                                      }`}
                                      title={`Set "${img.name}" as cover`}
                                    >
                                      <ImageWithFallback src={img.image_url} alt={img.name}
                                        className="h-12 w-12 rounded-md object-cover"
                                        style={voteEditState.face_detection_enabled && img.face_center ? { objectPosition: `${img.face_center.x}% ${img.face_center.y}%` } : undefined} />
                                      {(isSelected || isCurrentCover) && (
                                        <span className="absolute left-0.5 top-0.5 rounded-full bg-purple-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white">
                                          {isSelected ? "Pending" : "Cover"}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Category */}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-gray-400">Category</p>
                          <select
                            value={voteEditState.category || (categories.length > 0 ? categories[0].name : "General")}
                            onChange={(e) => setVoteEditState((p) => p ? { ...p, category: e.target.value, isDirty: true } : p)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                          >
                            {categories.length === 0 && <option value="General">General</option>}
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Face Detection Toggle — runs detection for all images on save when newly turned ON */}
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={voteEditState.face_detection_enabled}
                              onChange={(e) =>
                                setVoteEditState((p) =>
                                  p ? { ...p, face_detection_enabled: e.target.checked, isDirty: true } : p
                                )
                              }
                              className="peer sr-only"
                            />
                            <div className="h-5 w-9 rounded-full bg-gray-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-gray-400 after:transition-all peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                          </label>
                          <span className="text-xs text-gray-300">
                            Face detection {voteEditState.face_detection_enabled ? "ON" : "OFF"}
                          </span>
                        </div>

                        {/* Tier editing */}
                        <div>
                          <p className="mb-2 text-xs font-semibold text-gray-400">Tiers</p>
                          <div className="space-y-1.5 mb-3">
                            {voteEditState.tiers.map((tier, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  value={tier.label}
                                  onChange={(e) => {
                                    setVoteEditState((p) => {
                                      if (!p) return p;
                                      const next = [...p.tiers];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      return { ...p, tiers: next, isDirty: true };
                                    });
                                  }}
                                  className="w-20 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                                />
                                <div className="flex gap-1 flex-wrap">
                                  {TIER_COLOR_OPTIONS.map((c) => (
                                    <button key={c} type="button"
                                      onClick={() => {
                                        setVoteEditState((p) => {
                                          if (!p) return p;
                                          const next = [...p.tiers];
                                          next[idx] = { ...next[idx], color: c };
                                          return { ...p, tiers: next, isDirty: true };
                                        });
                                      }}
                                      className={`h-5 w-5 rounded-full border-2 transition-transform ${tier.color === c ? "border-white scale-110" : "border-transparent hover:scale-110"}`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                                {voteEditState.tiers.length > 1 && (
                                  <button
                                    onClick={() =>
                                      setVoteEditState((p) =>
                                        p ? { ...p, tiers: p.tiers.filter((_, i) => i !== idx), isDirty: true } : p
                                      )
                                    }
                                    className="text-xs text-red-400 hover:text-red-300">×</button>
                                )}
                              </div>
                            ))}
                            <div className="flex gap-3">
                              <button
                                onClick={() =>
                                  setVoteEditState((p) =>
                                    p ? { ...p, tiers: [{ label: "New", color: "#94a3b8" }, ...p.tiers], isDirty: true } : p
                                  )
                                }
                                className="text-xs text-purple-400 hover:text-purple-300">
                                + Add tier to top
                              </button>
                              <button
                                onClick={() =>
                                  setVoteEditState((p) =>
                                    p ? { ...p, tiers: [...p.tiers, { label: "New", color: "#94a3b8" }], isDirty: true } : p
                                  )
                                }
                                className="text-xs text-purple-400 hover:text-purple-300">
                                + Add tier to bottom
                              </button>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-gray-400">Images ({voteEditState.images.length})</p>
                        {voteEditState.images.length === 0 ? (
                          <p className="text-xs italic text-gray-600">No images yet. Add some below.</p>
                        ) : (
                          <>
                            <DndContext
                              sensors={adminDndSensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event: DragEndEvent) => {
                                const { active, over } = event;
                                if (over && active.id !== over.id) {
                                  setVoteEditState((p) => {
                                    if (!p) return p;
                                    const oldIdx = p.images.findIndex((i) => i.id === active.id);
                                    const newIdx = p.images.findIndex((i) => i.id === over.id);
                                    if (oldIdx === -1 || newIdx === -1) return p;
                                    return { ...p, images: arrayMove(p.images, oldIdx, newIdx), isDirty: true };
                                  });
                                }
                              }}
                            >
                              <SortableContext items={voteEditState.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                                <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-950/50 p-3">
                                  {voteEditState.images.map((img) => {
                                    const displayUrl = img.pendingCropDataUrl ?? img.image_url;
                                    const borderClass = img.isNew
                                      ? "border-green-600"
                                      : img.pendingCropDataUrl
                                        ? "border-amber-500"
                                        : "border-gray-700";
                                    return (
                                      <SortableImageCard key={img.id} id={img.id}>
                                        <div className="group relative">
                                          <ImageWithFallback src={displayUrl} alt={img.name}
                                            className={`h-20 w-20 rounded-lg object-cover border-2 ${borderClass}`}
                                            style={voteEditState.face_detection_enabled && img.face_center ? { objectPosition: `${img.face_center.x}% ${img.face_center.y}%` } : undefined} />
                                          <button
                                            onClick={() => {
                                              setVoteEditState((p) => {
                                                if (!p) return p;
                                                const target = p.images.find((i) => i.id === img.id);
                                                if (target?.isNew && target.image_url.startsWith("blob:")) URL.revokeObjectURL(target.image_url);
                                                return {
                                                  ...p,
                                                  images: p.images.filter((i) => i.id !== img.id),
                                                  pendingDeleteImageIds: img.isNew ? p.pendingDeleteImageIds : [...p.pendingDeleteImageIds, img.id],
                                                  selectedCoverImageId: p.selectedCoverImageId === img.id ? null : p.selectedCoverImageId,
                                                  isDirty: true,
                                                };
                                              });
                                            }}
                                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                            ×
                                          </button>
                                          {!img.isNew && (
                                            <div className="flex justify-center gap-1 mt-1">
                                              <button
                                                onClick={() => {
                                                  setAdminCropImage({ tierlistId: vl.id, imageId: img.id, imageUrl: displayUrl, imageName: img.name, isVote: true });
                                                }}
                                                className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-amber-400 hover:bg-gray-700 hover:text-amber-300"
                                                title="Crop image"
                                              >
                                                ✂
                                              </button>
                                            </div>
                                          )}
                                          <input
                                            value={img.name}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setVoteEditState((p) => {
                                                if (!p) return p;
                                                return { ...p, images: p.images.map((i) => i.id === img.id ? { ...i, name: val } : i), isDirty: true };
                                              });
                                            }}
                                            placeholder="Name"
                                            className="mt-0.5 w-20 rounded border border-transparent bg-transparent px-0.5 text-center text-[10px] text-gray-400 placeholder-gray-600 hover:border-gray-600 focus:border-purple-500 focus:bg-gray-800 focus:outline-none"
                                            onClick={(e) => e.stopPropagation()}
                                            onPointerDown={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                      </SortableImageCard>
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>
                            <p className="mt-1.5 text-xs text-gray-600">
                              Drag to reorder · hover × to remove · ✂ to crop · green border = new, amber = cropped
                            </p>
                          </>
                        )}

                        {/* Add images — staged only, uploaded on Save Changes */}
                        <div className="rounded-xl border border-dashed border-gray-700 p-3 space-y-2">
                          <label className="cursor-pointer block rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-purple-500 hover:text-white text-center">
                            Choose images to add
                            <input
                              type="file"
                              accept={ACCEPT_IMAGE_TYPES}
                              multiple
                              className="sr-only"
                              onChange={(e) => {
                                const files = Array.from(e.target.files ?? []);
                                if (files.length === 0) return;
                                const newEntries: VoteEditImage[] = files.map((file) => ({
                                  id: `temp-${crypto.randomUUID()}`,
                                  name: "",
                                  image_url: URL.createObjectURL(file),
                                  sort_order: 0,
                                  face_center: null,
                                  isNew: true,
                                  newFile: file,
                                }));
                                setVoteEditState((p) =>
                                  p ? { ...p, images: [...p.images, ...newEntries], isDirty: true } : p
                                );
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="text-[10px] text-gray-500 text-center">
                            New images upload when you click Save Changes.
                          </p>
                        </div>

                        {/* Import from existing tierlist — staged only */}
                        {voteEditState.pendingImportSourceId ? (
                          <div className="rounded-xl border border-green-800 bg-green-950/30 p-3 flex items-center justify-between">
                            <span className="text-xs text-green-300">
                              ● Will import from: {allTierlists.find((t) => t.id === voteEditState.pendingImportSourceId)?.title ?? "Selected tierlist"}
                            </span>
                            <button
                              onClick={() =>
                                setVoteEditState((p) =>
                                  p ? { ...p, pendingImportSourceId: null, isDirty: true } : p
                                )
                              }
                              className="text-xs text-red-400 hover:text-red-300">
                              Cancel
                            </button>
                          </div>
                        ) : importingVoteId === vl.id ? (
                          <div className="rounded-xl border border-purple-800 bg-purple-950/30 p-3 space-y-2">
                            <p className="text-xs font-semibold text-purple-300">Stage import from tierlist</p>
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
                                onClick={() => {
                                  if (!importSourceId) return;
                                  setVoteEditState((p) =>
                                    p ? { ...p, pendingImportSourceId: importSourceId, isDirty: true } : p
                                  );
                                  setImportingVoteId(null);
                                  setImportSourceId("");
                                }}
                                disabled={!importSourceId}
                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40">
                                Stage import
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

                        {/* Sticky save bar — shows dirty state + Save/Discard */}
                        <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex items-center justify-between border-t border-gray-700 bg-gray-900/95 px-4 py-3 backdrop-blur">
                          <div className="text-xs">
                            {voteEditState.error ? (
                              <span className="text-red-400">{voteEditState.error}</span>
                            ) : voteEditState.isDirty ? (
                              <span className="text-yellow-400">● Unsaved changes</span>
                            ) : (
                              <span className="text-gray-500">No unsaved changes</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCloseVoteEdit()}
                              disabled={voteEditState.saving}
                              className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-gray-400 disabled:opacity-40">
                              {voteEditState.isDirty ? "Discard" : "Close"}
                            </button>
                            <button
                              onClick={handleSaveVoteEdit}
                              disabled={!voteEditState.isDirty || voteEditState.saving}
                              className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40">
                              {voteEditState.saving ? "Saving…" : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      </>
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
      {/* ── Blind Rankings tab ──────────────────────────────────────── */}
      {tab === "blind-rankings" && (
        <div className="space-y-5">
          {!showConvertBlindPicker ? (
            <button
              onClick={() => {
                setShowConvertBlindPicker(true);
                if (!allTierlists.length) {
                  fetch("/api/admin/tierlists").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setAllTierlists(data); }).catch(() => {});
                }
              }}
              className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-300 hover:border-amber-500 hover:text-white"
            >
              Convert Tierlist to Blind Ranking
            </button>
          ) : (
            <div className="rounded-xl border border-amber-700 bg-gray-900 p-3 space-y-2 max-w-md">
              <p className="text-xs font-semibold text-amber-300">Convert Regular Tierlist to Blind Ranking</p>
              <select
                value={convertBlindSourceId}
                onChange={(e) => setConvertBlindSourceId(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Select a tierlist…</option>
                {allTierlists.map((tl) => (
                  <option key={tl.id} value={tl.id}>{tl.title}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500">
                Creates a new blind ranking with 10 slots, copying the title, category, cover, images, and face detection setting. The original tierlist is kept and auto-linked. If you want more or fewer slots, edit the blind ranking after creating it.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConvertToBlind}
                  disabled={!convertBlindSourceId || convertingBlind}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
                >
                  {convertingBlind ? "Converting…" : "Convert"}
                </button>
                <button
                  onClick={() => { setShowConvertBlindPicker(false); setConvertBlindSourceId(""); }}
                  disabled={convertingBlind}
                  className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <BlindRankingsAdmin />
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
      {/* ── Tic Tac Toe tab ─────────────────────────────────────── */}
      {tab === "tictactoe" && <TicTacToeAdmin />}

      {/* ── Tenable tab ──────────────────────────────────────────── */}
      {tab === "tenable" && <TenableAdmin />}

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
