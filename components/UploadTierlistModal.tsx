"use client";

import { useState, useId, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAllowedImageType, ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import CropOverlay from "./CropOverlay";

interface ImageEntry {
  id: string;
  name: string;
  image_url: string; // blob URL or existing Supabase URL
  file?: File;       // present only for locally-added images
  face_center?: { x: number; y: number } | null;
}

interface Props {
  images: ImageEntry[];
  onClose: () => void;
}

export default function UploadTierlistModal({ images, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names: string[] = data.map((c: { name: string }) => c.name);
          setCategories(names);
          setCategory(names[0]);
        }
      })
      .catch(() => {});
  }, []);
  // Index into images[] chosen as the cover photo
  const [coverIdx, setCoverIdx] = useState(0);
  // Separately uploaded cover (takes priority over coverIdx)
  const [customCover, setCustomCover] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  const router = useRouter();
  const coverInputId = useId();

  const coverPreviewUrl: string | null =
    customCover?.preview ?? images[coverIdx]?.image_url ?? null;

  const handleCoverCrop = useCallback((croppedDataUrl: string) => {
    // Convert data URL to File for upload
    fetch(croppedDataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], "cover-cropped.png", { type: "image/png" });
        setCustomCover((prev) => {
          if (prev) URL.revokeObjectURL(prev.preview);
          return { file, preview: croppedDataUrl };
        });
      })
      .catch(() => {
        setError("Failed to process cropped image. Please try again.");
      })
      .finally(() => {
        // Always close the crop overlay so it can never get stuck open
        setShowCrop(false);
      });
  }, []);

  // Ignore close requests while an upload is in progress — dismissing mid-upload
  // orphans storage uploads and can create duplicate tierlists on reopen.
  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  function handleCustomCoverFile(file: File) {
    if (!isAllowedImageType(file)) {
      setError("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    setCustomCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }

  async function handleUpload() {
    if (!title.trim()) { setError("Please enter a name for the tierlist."); return; }
    if (images.length === 0) { setError("Add at least one image to the board first."); return; }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      // Upload each image — re-use existing Supabase URLs, only upload new files.
      // Track uploaded paths for delayed cleanup if the tierlist save fails.
      const uploadedImages: {
        name: string;
        image_url: string;
        face_center: { x: number; y: number } | null;
      }[] = [];
      const uploadedPaths: string[] = [];
      for (const img of images) {
        if (img.file) {
          // Locally added image — upload to Supabase Storage
          const ext = img.file.name.split(".").pop() ?? "jpg";
          const path = `${crypto.randomUUID()}.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("tierlist-images")
            .upload(path, img.file, { upsert: false });
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data: urlData } = supabase.storage
            .from("tierlist-images")
            .getPublicUrl(uploadData.path);
          uploadedImages.push({
            name: img.name,
            image_url: urlData.publicUrl,
            face_center: img.face_center ?? null,
          });
          uploadedPaths.push(uploadData.path);
        } else {
          // Image already has a Supabase URL — use it directly
          uploadedImages.push({
            name: img.name,
            image_url: img.image_url,
            face_center: img.face_center ?? null,
          });
        }
      }

      // Track uploads for delayed cleanup (non-blocking)
      if (uploadedPaths.length > 0) {
        supabase.from("uploaded_images").insert(
          uploadedPaths.map((p) => ({ storage_path: p, is_used: false }))
        ).then(() => {});
      }

      // Determine cover image URL
      let cover_image_url: string;
      if (customCover) {
        const ext = customCover.file.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images")
          .upload(path, customCover.file, { upsert: false });
        if (uploadError) throw new Error(`Cover upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage
          .from("tierlist-images")
          .getPublicUrl(uploadData.path);
        cover_image_url = urlData.publicUrl;
      } else {
        cover_image_url =
          uploadedImages[coverIdx]?.image_url ?? uploadedImages[0]?.image_url ?? "";
      }

      const res = await fetch("/api/tierlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          cover_image_url,
          images: uploadedImages,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to upload tierlist");
      }

      // Mark uploaded images as used (non-blocking)
      if (uploadedPaths.length > 0) {
        supabase.from("uploaded_images")
          .update({ is_used: true })
          .in("storage_path", uploadedPaths)
          .then(() => {});
      }

      router.push("/tierlists");
      router.refresh();
    } catch (err) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Upload Tierlist</h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-white">
              Tierlist Name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Premier League Players"
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-white">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-indigo-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Cover photo */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-white">
              Cover Photo
            </label>

            {/* Preview — matches homepage card dimensions exactly */}
            <p className="mb-1 text-[10px] text-white">This is how it will look on the homepage</p>
            <div
              className={`mb-3 h-32 w-48 overflow-hidden rounded-xl border-2 transition-colors ${
                coverPreviewUrl ? "border-indigo-500" : "border-gray-700 bg-gray-800"
              }`}
            >
              {coverPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreviewUrl} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs italic text-white">
                  No cover selected
                </div>
              )}
            </div>

            {/* Pick from images on board */}
            {images.length > 0 && !customCover && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs text-white">
                  Click an image to use it as the cover:
                </p>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setCoverIdx(i)}
                      className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                        coverIdx === i ? "border-indigo-400" : "border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.image_url}
                        alt={img.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upload custom cover + crop */}
            <div className="flex items-center gap-3 flex-wrap">
              {coverPreviewUrl && (
                <button
                  type="button"
                  onClick={() => setShowCrop(true)}
                  className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-indigo-500 hover:text-white"
                >
                  Crop Cover
                </button>
              )}
              <label
                htmlFor={coverInputId}
                className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-indigo-500 hover:text-white"
              >
                Upload custom cover
              </label>
              <input
                id={coverInputId}
                type="file"
                accept={ACCEPT_IMAGE_TYPES}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { handleCustomCoverFile(file); e.target.value = ""; }
                }}
              />
              {customCover && (
                <button
                  onClick={() => {
                    URL.revokeObjectURL(customCover.preview);
                    setCustomCover(null);
                  }}
                  className="text-xs text-red-400 transition-colors hover:text-red-300"
                >
                  Remove custom cover
                </button>
              )}
            </div>
          </div>

          {/* Images summary */}
          <div>
            <p className="text-sm font-semibold text-white">
              Images ({images.length})
            </p>
            <p className="mt-0.5 text-xs text-white">
              All {images.length} image{images.length !== 1 ? "s" : ""} from your
              board will be included.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-6 py-4">
          <button
            onClick={handleUpload}
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Uploading images…" : "Upload Tierlist"}
          </button>
        </div>
      </div>

      {/* Cover crop overlay */}
      {showCrop && coverPreviewUrl && (
        <CropOverlay
          imageUrl={coverPreviewUrl}
          imageName="Cover Photo"
          aspectRatio={3 / 2}
          onCrop={handleCoverCrop}
          onCancel={() => setShowCrop(false)}
        />
      )}
    </div>
  );
}
