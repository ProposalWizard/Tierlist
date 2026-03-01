"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const coverPreview =
    customCover?.preview ??
    (coverIdx !== null ? images[coverIdx]?.preview : null) ??
    images[0]?.preview ??
    null;

  function handleFiles(fileList: FileList) {
    const entries: ImageEntry[] = Array.from(fileList).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, ""),
    }));
    setImages((prev) => [...prev, ...entries]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    // Keep coverIdx pointing at the right image after removal
    setCoverIdx((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function selectCoverFromImages(index: number) {
    setCustomCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    setCoverIdx(index);
  }

  function handleCustomCoverFile(file: File) {
    setCustomCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
    setCoverIdx(null);
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

      // Upload all tierlist images
      const uploadedImages: { name: string; image_url: string }[] = [];
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
      }

      // Determine cover_image_url
      let cover_image_url: string;
      if (customCover) {
        // Upload the custom cover separately
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
        // Use the selected or first tierlist image
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

      {/* Cover Photo */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-300">
          Cover Photo
        </label>
        <div className="flex gap-4 items-start">
          {/* Preview box */}
          <div className="flex-shrink-0 h-28 w-44 overflow-hidden rounded-xl border-2 border-gray-700 bg-gray-800 flex items-center justify-center">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Cover preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs italic text-gray-600 px-2 text-center">
                No cover yet
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 justify-center pt-1">
            <label
              htmlFor={coverInputId}
              className="cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-indigo-500 hover:text-white"
            >
              Upload new image
            </label>
            <input
              id={coverInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { handleCustomCoverFile(file); e.target.value = ""; }
              }}
            />
            {images.length > 0 && (
              <p className="text-xs text-gray-500">
                — or click an image below
              </p>
            )}
            {customCover && (
              <button
                onClick={() => {
                  URL.revokeObjectURL(customCover.preview);
                  setCustomCover(null);
                }}
                className="text-xs text-red-400 hover:text-red-300 text-left"
              >
                Remove custom cover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
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
            accept="image/*"
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
          <div className="flex flex-wrap gap-2 rounded-xl border border-gray-700 bg-gray-900/50 p-3">
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
                    <img
                      src={img.preview}
                      alt={img.name}
                      className={`h-[88px] w-[88px] rounded-lg object-cover border-2 transition-colors ${
                        isCover
                          ? "border-indigo-400"
                          : "border-black hover:border-gray-500"
                      }`}
                    />
                    {/* Cover badge */}
                    {isCover && (
                      <span className="absolute left-1 top-1 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                        Cover
                      </span>
                    )}
                  </button>
                  {/* Remove button */}
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
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 text-xs italic text-gray-600">
            No images yet — click &quot;+ Add Images&quot; to get started
          </div>
        )}
        {images.length > 0 && !customCover && (
          <p className="mt-1.5 text-xs text-gray-600">
            Click any image to use it as the cover photo.
          </p>
        )}
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
