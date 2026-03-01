"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ImageEntry {
  file: File;
  preview: string;
  name: string;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const inputId = useId();

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

      // Upload each image directly from the browser to Supabase Storage
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

      // Create the tierlist record
      const res = await fetch("/api/tierlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, images: uploadedImages }),
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

      {/* Image upload */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-300">
            Images{images.length > 0 && ` (${images.length})`}
          </span>
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            + Add Images
          </label>
          <input
            id={inputId}
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
            {images.map((img, i) => (
              <div key={i} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={img.name}
                  className="h-[88px] w-[88px] rounded-lg border-2 border-black object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
                <p className="mt-0.5 max-w-[88px] truncate text-center text-[10px] text-gray-500">
                  {img.name}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 text-xs italic text-gray-600">
            No images yet — click &quot;+ Add Images&quot; to get started
          </div>
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
