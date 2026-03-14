"use client";

/**
 * components/ImageWithFallback.tsx
 *
 * Drop-in replacement for <img> that shows a placeholder
 * when the image fails to load (e.g. missing storage object).
 */

import { useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Fallback text shown when the image cannot be loaded */
  fallbackText?: string;
}

export default function ImageWithFallback({
  fallbackText = "Image unavailable",
  className,
  alt,
  style,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800 text-[10px] text-gray-500 ${className ?? ""}`}
        style={style}
        title={alt}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
