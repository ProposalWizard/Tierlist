"use client";

/**
 * components/ImageWithFallback.tsx
 *
 * Drop-in replacement for <img> that shows a placeholder
 * when the image fails to load (e.g. missing storage object).
 */

import { useState, useEffect } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Fallback text shown when the image cannot be loaded */
  fallbackText?: string;
  /**
   * An IMAGE to show instead, when the real one cannot be loaded.
   *
   * For a player portrait this is the silhouette (`lib/silhouette.ts`). It
   * matters because "no photo" and "a photo that 404s" used to look completely
   * different on screen: a player with no `image_url` at all fell to a
   * silhouette, while a player whose URL had gone dead — which is most of them
   * since SoFIFA's CDN started refusing anonymous requests — rendered as a
   * broken or empty box, because nothing was watching for the failure.
   * Reported as exactly that: the placeholder only ever showed up on the
   * invented players.
   */
  fallbackSrc?: string;
}

export default function ImageWithFallback({
  fallbackText = "Image unavailable",
  fallbackSrc,
  className,
  alt,
  style,
  src,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed && fallbackSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackSrc}
        alt=""
        aria-hidden
        className={className}
        style={style}
        title={alt}
      />
    );
  }

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800 text-[10px] text-white ${className ?? ""}`}
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
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
