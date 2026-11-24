"use client";

/**
 * components/ImageWithFallback.tsx
 *
 * Drop-in replacement for <img> that shows a placeholder
 * when the image fails to load (e.g. missing storage object).
 */

import { useState, useEffect, useRef } from "react";

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
  // Until the real picture arrives, the fallback picture sits behind it
  // (24 Nov 2026): a slow portrait showed as an empty dark circle for a second
  // or more ("faces take time to load"). Taken away once loaded, because
  // portraits are cut-outs and the silhouette would show through them.
  const [loaded, setLoaded] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailed(false);
    // Already in the browser cache (or loaded before this page woke up): no
    // load event will come, so check the picture itself.
    const img = imgRef.current;
    setLoaded(!!img && img.complete && img.naturalWidth > 0);
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
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={!loaded && fallbackSrc ? { backgroundImage: `url(${fallbackSrc})`, backgroundSize: "cover", backgroundPosition: "center", ...style } : style}
      loading="lazy"
      referrerPolicy="no-referrer"
      decoding="async"
      onLoad={(e) => { setLoaded(true); rest.onLoad?.(e); }}
      onError={() => setFailed(true)}
    />
  );
}
