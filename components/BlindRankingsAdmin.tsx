"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import { processImage, detectFaceFromUrl } from "@/lib/faceDetection";
import type { BlindRanking, BlindRankingImage } from "@/lib/types";
import CropOverlay from "@/components/CropOverlay";

interface StagedNewImage {
  tempId: string;
  file: File;
  preview: string;
  name: string;
  pendingCropDataUrl?: string;
}

interface EditState {
  id: string;
  title: string;
  description: string;
  category: string;
  num_slots: number;
  is_active: boolean;
  face_detection_enabled: boolean;
  cover_image_url: string | null;
  newCoverFile: File | null;
  newCoverPreview: string | null;
  pendingCoverCropDataUrl: string | null;
  existingImages: BlindRankingImage[];
  nameChanges: Record<string, string>;
  pendingDeleteIds: string[];
  pendingCrops: Record<string, string>;
  stagedImages: StagedNewImage[];
  loading: boolean;
  dirty: boolean;
}

export default function BlindRankingsAdmin() {
  const [rankings, setRankings] = useState<BlindRanking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlots, setNewSlots] = useState(10);
  const [creating, setCreating] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [toast, setToast] = useState("");
  const coverRef = useRef<HTMLInputElement>(null);
  const [cropTarget, setCropTarget] = useState<{ imageUrl: string; imageName: string; type: "image" | "cover" | "staged"; id: string; aspectRatio?: number } | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function loadRankings() {
    const res = await fetch("/api/admin/blind-rankings");
    if (res.ok) setRankings(await res.json());
    setLoaded(true);
  }

  useEffect(() => { loadRankings(); }, []);

  async function createRanking() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    const res = await fetch("/api/admin/blind-rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), num_slots: newSlots }),
    });
    if (res.ok) {
      setNewTitle("");
      setNewSlots(10);
      await loadRankings();
      showToast("Blind ranking created");
    }
    setCreating(false);
  }

  async function deleteRanking(id: string) {
    if (!confirm("Delete this blind ranking and all its images?")) return;
    const res = await fetch(`/api/admin/blind-rankings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRankings((prev) => prev.filter((r) => r.id !== id));
      if (editState?.id === id) setEditState(null);
      showToast("Deleted");
    }
  }

  async function openEdit(ranking: BlindRanking) {
    if (editState?.dirty && !confirm("You have unsaved changes. Discard them?")) return;
    const res = await fetch(`/api/admin/blind-rankings/${ranking.id}/images`);
    let images: BlindRankingImage[] = [];
    if (res.ok) {
      images = await res.json();
    } else {
      const errBody = await res.text().catch(() => "");
      console.error(`Failed to load blind ranking images (${res.status}):`, errBody);
      showToast(`Failed to load images: ${res.status}`);
    }
    setEditState({
      id: ranking.id,
      title: ranking.title,
      description: ranking.description ?? "",
      category: ranking.category ?? "General",
      num_slots: ranking.num_slots,
      is_active: ranking.is_active,
      face_detection_enabled: ranking.face_detection_enabled ?? false,
      cover_image_url: ranking.cover_image_url,
      newCoverFile: null,
      newCoverPreview: null,
      pendingCoverCropDataUrl: null,
      existingImages: images,
      nameChanges: {},
      pendingDeleteIds: [],
      pendingCrops: {},
      stagedImages: [],
      loading: false,
      dirty: false,
    });
  }

  function closeEdit() {
    if (editState?.dirty && !confirm("You have unsaved changes. Discard them?")) return;
    editState?.stagedImages.forEach((i) => URL.revokeObjectURL(i.preview));
    if (editState?.newCoverPreview) URL.revokeObjectURL(editState.newCoverPreview);
    setEditState(null);
  }

  function markDirty() {
    setEditState((s) => s && { ...s, dirty: true });
  }

  function stageImages(files: FileList) {
    const newStaged: StagedNewImage[] = Array.from(files).map((file) => ({
      tempId: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: "",
    }));
    setEditState((s) => s && { ...s, stagedImages: [...s.stagedImages, ...newStaged], dirty: true });
  }

  function removeStagedImage(tempId: string) {
    setEditState((s) => {
      if (!s) return s;
      const img = s.stagedImages.find((i) => i.tempId === tempId);
      if (img) URL.revokeObjectURL(img.preview);
      return { ...s, stagedImages: s.stagedImages.filter((i) => i.tempId !== tempId), dirty: true };
    });
  }

  function stageDeleteExisting(imageId: string) {
    setEditState((s) => s && {
      ...s,
      pendingDeleteIds: [...s.pendingDeleteIds, imageId],
      dirty: true,
    });
  }

  function stageCover(file: File) {
    setEditState((s) => {
      if (!s) return s;
      if (s.newCoverPreview) URL.revokeObjectURL(s.newCoverPreview);
      return { ...s, newCoverFile: file, newCoverPreview: URL.createObjectURL(file), pendingCoverCropDataUrl: null, dirty: true };
    });
  }

  function handleCropResult(croppedDataUrl: string) {
    if (!cropTarget || !editState) return;

    if (cropTarget.type === "cover") {
      setEditState((s) => s && { ...s, pendingCoverCropDataUrl: croppedDataUrl, dirty: true });
    } else if (cropTarget.type === "image") {
      setEditState((s) => s && {
        ...s,
        pendingCrops: { ...s.pendingCrops, [cropTarget.id]: croppedDataUrl },
        dirty: true,
      });
    } else if (cropTarget.type === "staged") {
      setEditState((s) => s && {
        ...s,
        stagedImages: s.stagedImages.map((i) =>
          i.tempId === cropTarget.id ? { ...i, pendingCropDataUrl: croppedDataUrl } : i
        ),
        dirty: true,
      });
    }
    setCropTarget(null);
  }

  async function dataUrlToFile(dataUrl: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], `cropped-${crypto.randomUUID()}.png`, { type: "image/png" });
  }

  async function handleSave() {
    if (!editState || editState.loading) return;
    setEditState((s) => s && { ...s, loading: true });

    try {
      const supabase = createClient();

      // 1. Upload cover if changed
      let coverUrl = editState.cover_image_url;
      if (editState.pendingCoverCropDataUrl) {
        const file = await dataUrlToFile(editState.pendingCoverCropDataUrl);
        const compressed = await compressImage(file);
        const path = `blind-rankings/covers/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (!error) {
          const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
          coverUrl = data.publicUrl;
        }
      } else if (editState.newCoverFile) {
        const compressed = await compressImage(editState.newCoverFile);
        const path = `blind-rankings/covers/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (!error) {
          const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
          coverUrl = data.publicUrl;
        }
      }

      // 2. Delete pending images
      for (const imageId of editState.pendingDeleteIds) {
        await fetch(`/api/admin/blind-rankings/${editState.id}/images/${imageId}`, {
          method: "DELETE",
        });
      }

      // 3. Upload staged new images (with face detection if enabled)
      for (const staged of editState.stagedImages) {
        let fileToUpload: File;
        let faceCenter: { x: number; y: number } | null = null;

        if (staged.pendingCropDataUrl) {
          fileToUpload = await dataUrlToFile(staged.pendingCropDataUrl);
        } else {
          fileToUpload = staged.file;
        }

        if (editState.face_detection_enabled) {
          const result = await processImage(fileToUpload);
          faceCenter = result.faceCenter;
        }

        const compressed = await compressImage(fileToUpload);
        const path = `blind-rankings/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (error) continue;
        const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
        await fetch(`/api/admin/blind-rankings/${editState.id}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: staged.name, image_url: data.publicUrl, face_center: faceCenter }),
        });
      }

      // 4. Upload cropped existing images
      for (const [imageId, cropDataUrl] of Object.entries(editState.pendingCrops)) {
        const file = await dataUrlToFile(cropDataUrl);
        const compressed = await compressImage(file);
        const path = `blind-rankings/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (error) continue;
        const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
        const patchBody: Record<string, unknown> = { image_url: data.publicUrl };
        if (editState.face_detection_enabled) {
          const fc = await detectFaceFromUrl(data.publicUrl);
          if (fc) patchBody.face_center = fc;
        }
        await fetch(`/api/admin/blind-rankings/${editState.id}/images/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
      }

      // 5. Save name changes for existing images
      for (const [imageId, newName] of Object.entries(editState.nameChanges)) {
        await fetch(`/api/admin/blind-rankings/${editState.id}/images/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });
      }

      // 6. Run face detection on existing images if toggled on and they lack face_center
      if (editState.face_detection_enabled) {
        const needsDetection = editState.existingImages.filter(
          (img) => !img.face_center && !editState.pendingDeleteIds.includes(img.id) && !editState.pendingCrops[img.id]
        );
        for (const img of needsDetection) {
          const fc = await detectFaceFromUrl(img.image_url);
          if (fc) {
            await fetch(`/api/admin/blind-rankings/${editState.id}/images/${img.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ face_center: fc }),
            });
          }
        }
      }

      // 7. PATCH the ranking metadata
      await fetch(`/api/admin/blind-rankings/${editState.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editState.title,
          description: editState.description || null,
          category: editState.category,
          num_slots: editState.num_slots,
          is_active: editState.is_active,
          face_detection_enabled: editState.face_detection_enabled,
          cover_image_url: coverUrl,
        }),
      });

      // Cleanup previews
      editState.stagedImages.forEach((i) => URL.revokeObjectURL(i.preview));
      if (editState.newCoverPreview) URL.revokeObjectURL(editState.newCoverPreview);

      // Reload and re-open edit (without dirty check since we just saved)
      await loadRankings();
      const imgRes = await fetch(`/api/admin/blind-rankings/${editState.id}/images`);
      const freshImages: BlindRankingImage[] = imgRes.ok ? await imgRes.json() : [];
      setEditState({
        id: editState.id,
        title: editState.title,
        description: editState.description,
        category: editState.category,
        num_slots: editState.num_slots,
        is_active: editState.is_active,
        face_detection_enabled: editState.face_detection_enabled,
        cover_image_url: coverUrl,
        newCoverFile: null,
        newCoverPreview: null,
        pendingCoverCropDataUrl: null,
        existingImages: freshImages,
        nameChanges: {},
        pendingDeleteIds: [],
        pendingCrops: {},
        stagedImages: [],
        loading: false,
        dirty: false,
      });
      showToast("All changes saved");
    } catch {
      showToast("Save failed");
    }

    setEditState((s) => s && { ...s, loading: false });
  }

  const visibleExistingImages = editState
    ? editState.existingImages.filter((i) => !editState.pendingDeleteIds.includes(i.id))
    : [];

  const totalImageCount = visibleExistingImages.length + (editState?.stagedImages.length ?? 0);

  if (!loaded) {
    return <div className="py-8 text-center text-gray-200">Loading blind rankings...</div>;
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-pulse rounded-lg border border-green-700 bg-green-900/90 px-4 py-3 text-sm font-semibold text-green-300 shadow-lg">
          {toast}
        </div>
      )}

      {cropTarget && (
        <CropOverlay
          imageUrl={cropTarget.imageUrl}
          imageName={cropTarget.imageName}
          aspectRatio={cropTarget.aspectRatio}
          onCrop={handleCropResult}
          onCancel={() => setCropTarget(null)}
        />
      )}

      {/* Create new */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-white">Title</label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Best Premier League Strikers"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && createRanking()}
          />
        </div>
        <div className="w-24">
          <label className="mb-1 block text-xs font-semibold text-white">Slots</label>
          <input
            type="number"
            value={newSlots}
            onChange={(e) => setNewSlots(Number(e.target.value))}
            min={3}
            max={25}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          onClick={createRanking}
          disabled={!newTitle.trim() || creating}
          className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          + Create
        </button>
      </div>

      {/* Rankings list */}
      {rankings.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/50"
            onClick={() => editState?.id === r.id ? closeEdit() : openEdit(r)}
          >
            <div className="flex items-center gap-3">
              {r.cover_image_url && (
                <img src={r.cover_image_url} alt="" className="h-8 w-12 rounded object-cover" />
              )}
              <div>
                <span className="font-semibold text-white">{r.title}</span>
                <span className="ml-3 text-xs text-gray-200">{r.num_slots} slots</span>
                {typeof r.view_count === "number" && r.view_count > 0 && (
                  <span className="ml-2 text-xs text-gray-300">{r.view_count} views</span>
                )}
                {!r.is_active && (
                  <span className="ml-2 rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                    Inactive
                  </span>
                )}
                {editState?.id === r.id && editState.dirty && (
                  <span className="ml-2 rounded bg-yellow-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                    Unsaved
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/blind-rankings/${r.id}`}
                target="_blank"
                className="rounded border border-gray-600 px-2 py-1 text-xs text-white hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); deleteRanking(r.id); }}
                className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Expanded edit form */}
          {editState?.id === r.id && (
            <div className="border-t border-gray-800 px-4 py-4 space-y-4">
              {/* Title + settings */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 block text-xs font-semibold text-white">Title</label>
                  <input
                    value={editState.title}
                    onChange={(e) => { setEditState((s) => s && { ...s, title: e.target.value }); markDirty(); }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-semibold text-white">Slots</label>
                  <input
                    type="number"
                    value={editState.num_slots}
                    onChange={(e) => { setEditState((s) => s && { ...s, num_slots: Number(e.target.value) }); markDirty(); }}
                    min={3}
                    max={25}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-xs font-semibold text-white">Category</label>
                  <input
                    value={editState.category}
                    onChange={(e) => { setEditState((s) => s && { ...s, category: e.target.value }); markDirty(); }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-white">Description</label>
                <input
                  value={editState.description}
                  onChange={(e) => { setEditState((s) => s && { ...s, description: e.target.value }); markDirty(); }}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Cover image */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-white">Cover Image</label>
                {(editState.pendingCoverCropDataUrl || editState.newCoverPreview || editState.cover_image_url) ? (
                  <div className="relative inline-block">
                    <img
                      src={editState.pendingCoverCropDataUrl || editState.newCoverPreview || editState.cover_image_url!}
                      alt="Cover"
                      className="h-24 w-36 rounded-lg object-cover border border-gray-700"
                    />
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      <button
                        onClick={() => {
                          const src = editState.newCoverPreview || editState.cover_image_url;
                          if (src) setCropTarget({ imageUrl: src, imageName: "Cover", type: "cover", id: "cover", aspectRatio: 3 / 2 });
                        }}
                        className="rounded bg-gray-800/80 px-2 py-0.5 text-[10px] text-gray-300 hover:text-white"
                      >
                        Crop
                      </button>
                      <button
                        onClick={() => { coverRef.current?.click(); }}
                        className="rounded bg-gray-800/80 px-2 py-0.5 text-[10px] text-gray-300 hover:text-white"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => coverRef.current?.click()}
                    className="rounded-lg border border-dashed border-gray-600 px-4 py-2 text-xs text-gray-200 hover:border-gray-400 hover:text-gray-300"
                  >
                    + Add cover
                  </button>
                )}
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && stageCover(e.target.files[0])}
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editState.is_active}
                    onChange={(e) => { setEditState((s) => s && { ...s, is_active: e.target.checked }); markDirty(); }}
                    className="rounded"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editState.face_detection_enabled}
                    onChange={(e) => { setEditState((s) => s && { ...s, face_detection_enabled: e.target.checked }); markDirty(); }}
                    className="rounded"
                  />
                  Face Detection
                </label>
              </div>

              {/* Images */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Player Bank ({totalImageCount} images)
                  </span>
                  <label className="cursor-pointer rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-800/40 transition-colors">
                    + Add Images
                    <input
                      type="file"
                      multiple
                      accept={ACCEPT_IMAGE_TYPES}
                      className="hidden"
                      onChange={(e) => e.target.files && stageImages(e.target.files)}
                    />
                  </label>
                </div>

                {totalImageCount === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-300">
                    No images yet. Upload player photos to build the bank.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {/* Existing images (not pending delete) */}
                    {visibleExistingImages.map((img) => (
                      <div key={img.id} className="group relative rounded-lg border border-gray-700 bg-gray-800 overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={editState.pendingCrops[img.id] || img.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                            style={editState.face_detection_enabled && img.face_center && !editState.pendingCrops[img.id]
                              ? { objectPosition: `${img.face_center.x}% ${img.face_center.y}%` }
                              : {}}
                          />
                        </div>
                        <div className="px-2 py-1.5">
                          <input
                            value={editState.nameChanges[img.id] ?? img.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditState((s) => s && {
                                ...s,
                                nameChanges: { ...s.nameChanges, [img.id]: val },
                                dirty: true,
                              });
                            }}
                            placeholder="Name (optional)"
                            className="w-full bg-transparent text-[11px] text-gray-300 placeholder-gray-600 focus:text-white focus:outline-none truncate"
                          />
                        </div>
                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                          <button
                            onClick={() => setCropTarget({ imageUrl: img.image_url, imageName: img.name, type: "image", id: img.id })}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white"
                            title="Crop"
                          >
                            ✂
                          </button>
                          <button
                            onClick={() => stageDeleteExisting(img.id)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                          >
                            x
                          </button>
                        </div>
                        {editState.pendingCrops[img.id] && (
                          <span className="absolute top-1 left-1 rounded bg-indigo-600/80 px-1 text-[9px] font-bold text-white">CROPPED</span>
                        )}
                      </div>
                    ))}
                    {/* Staged new images */}
                    {editState.stagedImages.map((img) => (
                      <div key={img.tempId} className="group relative rounded-lg border border-amber-700/50 bg-gray-800 overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                          <img src={img.pendingCropDataUrl || img.preview} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="px-2 py-1.5">
                          <input
                            value={img.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditState((s) => s && {
                                ...s,
                                stagedImages: s.stagedImages.map((i) => i.tempId === img.tempId ? { ...i, name: val } : i),
                              });
                            }}
                            placeholder="Name (optional)"
                            className="w-full bg-transparent text-[11px] text-gray-300 placeholder-gray-600 focus:text-white focus:outline-none truncate"
                          />
                        </div>
                        <span className="absolute top-1 left-1 rounded bg-amber-600/80 px-1 text-[9px] font-bold text-white">NEW</span>
                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                          <button
                            onClick={() => setCropTarget({ imageUrl: img.preview, imageName: img.name || "New image", type: "staged", id: img.tempId })}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white"
                            title="Crop"
                          >
                            ✂
                          </button>
                          <button
                            onClick={() => removeStagedImage(img.tempId)}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save bar */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-800 pt-4">
                {editState.dirty && (
                  <span className="text-xs text-yellow-400">You have unsaved changes</span>
                )}
                <button
                  onClick={handleSave}
                  disabled={editState.loading}
                  className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {editState.loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {rankings.length === 0 && (
        <p className="py-8 text-center text-gray-200">No blind rankings yet. Create one above.</p>
      )}
    </div>
  );
}
