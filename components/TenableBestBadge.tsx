"use client";
/** Your best on a Ten-A-Ball challenge (this device), on its card. New look preview only. */
import { useEffect, useState } from "react";
import { readBests } from "@/lib/tenable/best";

export default function TenableBestBadge({ id }: { id: string }) {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => { const b = readBests()[id]; setBest(typeof b === "number" ? b : null); }, [id]);
  if (best === null) return <p className="mt-1 text-xs text-white/80">Not played yet</p>;
  return <p className="mt-1 text-xs font-bold text-emerald-400">Best {best}/10{best === 10 ? " ⭐" : ""}</p>;
}
