"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  imageUrl: string;
  imageName: string;
  onClose: () => void;
}

export default function ZoomOverlay({ imageUrl, imageName, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const MIN = 0.5;
  const MAX = 4;

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setScale((prev) =>
      Math.min(MAX, Math.max(MIN, prev - e.deltaY * 0.0015))
    );
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Image — stops click from bubbling to backdrop */}
      <div
        className="max-w-[90vw] max-h-[90vh]"
        style={{ transform: `scale(${scale})`, transition: "transform 0.08s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageName}
          draggable={false}
          className="block max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
        />
      </div>

      <p className="pointer-events-none absolute bottom-4 text-xs text-white select-none">
        Scroll to zoom · Click outside to close · Press Esc to exit
      </p>
    </div>
  );
}
