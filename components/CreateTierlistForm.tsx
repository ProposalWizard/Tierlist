console.log("🚨 CREATE PAGE IS RUNNING");

"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage, isAllowedImageType, ACCEPT_IMAGE_TYPES } from "@/lib/imageUtils";
import { processImage } from "@/lib/faceDetection";

interface ImageEntry {
  file: File;
  preview: string;
  name: string;
}

interface CustomCover {
  file: File;
  preview: string;
}

const CATEGORIES = [
  "Football",
  "Basketball",
  "Movies & TV",
  "Music",
  "Gaming",
  "Food & Drink",
  "Animals",
  "Other",
];

export default function CreateTierlistForm() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  // Index into `images` chosen as cover, or null to fall back to first image
  const [coverIdx, setCoverIdx] = useState<number | null>(null);
  // Separately uploaded cover (takes priority over coverIdx)
  const [customCover, setCustomCover] = useState<CustomCover | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const imagesInputId = useId();
  const coverInputId = useId();

  // The preview URL to show in the cover photo box
  const effectiveCoverIdx = coverIdx !== null ? coverIdx : 0;
  const coverPreviewUrl: string | null =
    customCover?.preview ??
    (images.length > 0 ? images[effectiveCoverIdx]?.preview ?? images[0]?.preview : null) ??
    null;

  async function handleFiles(fileList: FileList) {
    // Validate file types before processing
    const allowed = Array.from(fileList).filter((f) => {
      if (!isAllowedImageType(f)) return false;
      return true;
    });
    if (allowed.length < fileList.length) {
      setError("Only JPG, PNG, or WEBP images are allowed.");
    }
    if (allowed.length === 0) return;

    const entries: ImageEntry[] = [];
    for (const file of allowed) {
      const compressed = await compressImage(file).catch(() => file);
      // Face-detect and crop around face if found
      const processed = await processImage(compressed).catch(() => compressed);
      entries.push({
        file: processed,
        preview: URL.createObjectURL(processed),
        name: file.name.replace(/\.[^/.]+$/, ""),
      });
    }
    setImages((prev) => [...prev, ...entries]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setCoverIdx((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function selectCoverFromImages(index: number) {
    if (customCover) {
      URL.revokeObjectURL(customCover.preview);
      setCustomCover(null);
    }
    setCoverIdx(index);
  }

  async function handleCustomCoverFile(file: File) {
    if (!isAllowedImageType(file)) {
      setError("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    const compressed = await compressImage(file).catch(() => file);
    setCustomCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file: compressed, preview: URL.createObjectURL(compressed) };
    });
    setCoverIdx(null);
  }

  function removeCustomCover() {
    if (customCover) {
      URL.revokeObjectURL(customCover.preview);
      setCustomCover(null);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Please enter a name for the tierlist.");
      return;
    }
    if (images.length === 0) {
      setError("Please add at least one image.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      // Upload all tierlist images and track paths for cleanup
      const uploadedImages: { name: string; image_url: string }[] = [];
      const uploadedPaths: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("tierlist-images")
          .upload(path, img.file, { upsert: false });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage
          .from("tierlist-images")
          .getPublicUrl(uploadData.path);
        uploadedImages.push({ name: img.name, image_url: urlData.publicUrl });
        uploadedPaths.push(uploadData.path);
      }

      // Track uploads for delayed cleanup (non-blocking)
      if (uploadedPaths.length > 0) {
        supabase.from("uploaded_images").insert(
          uploadedPaths.map((p) => ({ storage_path: p, is_used: false }))
        ).then(() => {});
      }

      // Determine cover_image_url
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
        const idx = coverIdx !== null ? coverIdx : 0;
        cover_image_url = uploadedImages[idx]?.image_url ?? uploadedImages[0].image_url;
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
        throw new Error(body.error ?? "Failed to save tierlist");
      }

      // Mark uploaded images as used (non-blocking)
      if (uploadedPaths.length > 0) {
        supabase.from("uploaded_images")
          .update({ is_used: true })
          .in("storage_path", uploadedPaths)
          .then(() => {});
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-300">
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
        <label className="mb-1 block text-sm font-semibold text-gray-300">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-indigo-500 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Images + Cover Photo (combined section) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-300">
            Images{images.length > 0 && ` (${images.length})`}
          </span>
          <label
            htmlFor={imagesInputId}
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            + Add Images
          </label>
          <input
            id={imagesInputId}
            type="file"
            accept={ACCEPT_IMAGE_TYPES}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {images.length > 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-3">
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => {
                const isCover =
                  !customCover &&
                  (coverIdx === i || (coverIdx === null && i === 0));
                return (
                  <div key={i} className="group relative">
                    <button
                      type="button"
                      onClick={() => selectCoverFromImages(i)}
                      className="block focus:outline-none"
                      title="Set as cover photo"
                    >
                     {/* eslint-disable-next-line @next/next/no-img-element */}
{(() => {
  const face = (img.file as File & { __face?: any }).__face;

  return (
    <div className="w-[88px] h-[88px] overflow-hidden rounded-lg">
      <img
        src={img.preview}
        alt="uploaded"
        className="w-full h-full object-cover"
        style={{
          objectPosition: face
            ? `${(face.centerX / face.width) * 100}% ${(face.centerY / face.height) * 100}%`
            : "50% 50%",
        }}
      />
    </div>
  );
})()}
                      {isCover && (
                        <span className="absolute left-1 top-1 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                          Cover
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                    <p className="mt-0.5 max-w-[88px] truncate text-center text-[10px] text-gray-500">
                      {img.name}
                    </p>
                  </div>
                );
              })}
            </div>
            {!customCover && (
              <p className="mt-2 text-xs text-gray-500">
                Click any image to set it as the cover photo.
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 text-xs italic text-gray-600">
            No images yet — click &quot;+ Add Images&quot; to get started
          </div>
        )}
      </div>

      {/* Cover Photo */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-300">
          Cover Photo
        </label>

        {/* Preview — uses background-image so blob URLs always render */}
        <div
          className={`mb-3 h-36 w-full rounded-xl border-2 bg-cover bg-center bg-no-repeat transition-colors ${
            coverPreviewUrl ? "border-indigo-500" : "border-gray-700 bg-gray-800"
          }`}
          style={coverPreviewUrl ? { backgroundImage: `url("${coverPreviewUrl}")` } : {}}
        >
          {!coverPreviewUrl && (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-xs italic text-gray-500 px-4 text-center leading-relaxed">
                Add images above — the first one becomes the cover automatically.
                <br />
                Click any image to pick a different one, or upload a custom cover below.
              </span>
            </div>
          )}
        </div>

        {/* Upload custom cover */}
        <div className="flex items-center gap-3">
          <label
            htmlFor={coverInputId}
            className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white"
          >
            Upload custom cover image
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
              onClick={removeCustomCover}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Remove custom cover
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Uploading & Saving…" : "Save Tierlist"}
      </button>
    </div>
  );
}
