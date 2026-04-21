"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageUtils";

interface StagedImage {
  tempId: string;
  file: File;
  preview: string;
  name: string;
}

export default function CreateBlindRanking() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [numSlots, setNumSlots] = useState(10);
  const [images, setImages] = useState<StagedImage[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addImages(files: FileList) {
    const newImages: StagedImage[] = Array.from(files).map((file) => ({
      tempId: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: "",
    }));
    setImages((prev) => [...prev, ...newImages]);
  }

  function removeImage(tempId: string) {
    setImages((prev) => {
      const img = prev.find((i) => i.tempId === tempId);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.tempId !== tempId);
    });
  }

  function updateName(tempId: string, name: string) {
    setImages((prev) => prev.map((i) => i.tempId === tempId ? { ...i, name } : i));
  }

  function addCover(file: File) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  }

  async function handleSubmit() {
    if (!title.trim()) { setError("Title is required"); return; }
    if (images.length < numSlots) { setError(`Need at least ${numSlots} images (you have ${images.length})`); return; }
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();

      let coverUrl: string | null = null;
      if (coverFile) {
        const compressed = await compressImage(coverFile);
        const path = `blind-rankings/covers/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (!upErr) {
          const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
          coverUrl = data.publicUrl;
        }
      }

      const uploadedImages: { image_url: string; name: string }[] = [];
      for (const img of images) {
        const compressed = await compressImage(img.file);
        const path = `blind-rankings/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from("tierlist-images")
          .upload(path, compressed, { contentType: "image/webp" });
        if (upErr) continue;
        const { data } = supabase.storage.from("tierlist-images").getPublicUrl(path);
        uploadedImages.push({ image_url: data.publicUrl, name: img.name });
      }

      const res = await fetch("/api/blind-rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          num_slots: numSlots,
          cover_image_url: coverUrl,
          images: uploadedImages,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        setSubmitting(false);
        return;
      }

      const { id } = await res.json();
      router.push(`/blind-rankings/${id}`);
    } catch {
      setError("Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-300">Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best Premier League Strikers 2025/26"
          className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-300">Description <span className="text-gray-600">(optional)</span></label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Rank the best strikers blind!"
          className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Slots */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-300">Number of ranking slots</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3}
            max={20}
            value={numSlots}
            onChange={(e) => setNumSlots(Number(e.target.value))}
            className="flex-1 accent-amber-500"
          />
          <span className="w-10 text-center text-lg font-bold text-amber-400">{numSlots}</span>
        </div>
        <p className="mt-1 text-xs text-gray-600">Players will rank their top {numSlots}</p>
      </div>

      {/* Cover image */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-gray-300">Cover Image <span className="text-gray-600">(optional)</span></label>
        {coverPreview ? (
          <div className="relative inline-block">
            <img src={coverPreview} alt="Cover" className="h-32 w-48 rounded-xl object-cover border border-gray-700" />
            <button
              onClick={removeCover}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white"
            >
              x
            </button>
          </div>
        ) : (
          <button
            onClick={() => coverRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-gray-700 px-6 py-4 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
          >
            + Add cover photo
          </button>
        )}
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && addCover(e.target.files[0])}
        />
      </div>

      {/* Player images */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-300">
            Player Images * <span className="text-gray-600">({images.length} added, need at least {numSlots})</span>
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-800/40 transition-colors"
          >
            + Add Images
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && addImages(e.target.files)}
          />
        </div>

        {images.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-gray-700 py-12 text-center hover:border-gray-500 transition-colors"
          >
            <p className="text-sm text-gray-500">Click to upload player photos</p>
            <p className="mt-1 text-xs text-gray-600">Add more images than slots for variety</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {images.map((img) => (
              <div key={img.tempId} className="group relative rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
                <div className="aspect-square overflow-hidden">
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="px-2 py-2">
                  <input
                    value={img.name}
                    onChange={(e) => updateName(img.tempId, e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full bg-transparent text-xs text-gray-300 placeholder-gray-600 focus:text-white focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => removeImage(img.tempId)}
                  className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600/90 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-amber-600 px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Blind Ranking"}
        </button>
      </div>
    </div>
  );
}
