"use client";
import { useState } from "react";
import { looksScanned, SCAN_LAYOUT } from "@/lib/star/faceScanLayout";

/**
 * YOUR OWN PHOTO, FILLING ITS TILE.
 *
 * A scanned photo (faceScan.ts) is a see-through square with the head in the
 * middle third, so dropped into a tile as it is the face came out small with
 * empty space round it. Mikey, 28 Sep 2026: "that looks very odd … it should
 * basically fill the screen just like these faces do". A scan is zoomed in
 * on the face and shown as it is, like the stock faces. It gets no duotone:
 * that treatment is for an ordinary photo with a background of its own.
 * An ordinary cropped photo still gets the duotone.
 */
const ZOOM = 1.55;

export default function OwnPortraitImg({ src, duotone, className = "", children }: {
  src: string;
  /** The club-colour layers, drawn only over an ordinary photo. */
  children?: React.ReactNode;
  /** Filter for an ordinary (not scanned) photo. */
  duotone: React.CSSProperties["filter"];
  className?: string;
}) {
  const [scan, setScan] = useState<boolean | null>(null);
  const check = (img: HTMLImageElement) => {
    try {
      const w = img.naturalWidth, h = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const x = c.getContext("2d");
      if (!x) { setScan(false); return; }
      x.drawImage(img, 0, 0);
      const a = (px: number, py: number) => x.getImageData(px, py, 1, 1).data[3];
      setScan(looksScanned(src, w, h, [a(1, 1), a(w - 2, 1), a(1, h - 2), a(w - 2, h - 2)]));
    } catch { setScan(false); }
  };
  // Midway between the eyes and the chin, so the whole face stays in.
  const oy = ((SCAN_LAYOUT.eyeY + SCAN_LAYOUT.chinY) / 2) * 100;
  return (
    <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={src}
      alt=""
      onLoad={(e) => check(e.currentTarget)}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      style={scan
        ? { transform: `scale(${ZOOM})`, transformOrigin: `50% ${oy}%` }
        : { filter: duotone, opacity: scan === null ? 0 : 1 }}
    />
    {scan === false && children}
    </>
  );
}
