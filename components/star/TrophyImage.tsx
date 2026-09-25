"use client";
import { trophyArt } from "@/lib/star/trophyArt";

/**
 * A trophy's real picture, sized by its height; the given emoji when that
 * trophy has no picture yet (see lib/star/trophyArt.ts).
 */
export default function TrophyImage({ name, height, fallback = "🏆", className = "" }: {
  name: string;
  height: number;
  fallback?: string;
  className?: string;
}) {
  const src = trophyArt(name);
  if (!src) {
    return <span className={className} style={{ fontSize: height * 0.75, lineHeight: `${height}px` }} aria-hidden>{fallback}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] ${className}`}
      style={{ height, width: "auto" }}
      draggable={false}
    />
  );
}
