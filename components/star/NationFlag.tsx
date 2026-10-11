"use client";

/**
 * A nation's flag, drawn (lib/star/nationFlags.ts) — never a network image,
 * so it shows when flagcdn is blocked or slow. Rounded corners and a thin
 * light edge so a white flag (England, Japan) still reads on a white page.
 */
import { flagMarkup } from "@/lib/star/nationFlags";
import { nationKits } from "@/lib/star/international";

export default function NationFlag({ nation, width = 30, className = "", rounded = 3 }: {
  nation: string;
  /** Height is two-thirds of this. */
  width?: number;
  className?: string;
  rounded?: number;
}) {
  const kits = nationKits(nation);
  const h = Math.round((width * 2) / 3);
  const id = `nf-${nation.replace(/[^a-z]/gi, "")}-${width}`;
  return (
    <svg
      data-nation-flag={nation}
      viewBox="0 0 30 20" width={width} height={h} preserveAspectRatio="none"
      className={`shrink-0 ${className}`} role="img" aria-label={`${nation} flag`}
    >
      <defs><clipPath id={id}><rect width="30" height="20" rx={(rounded * 30) / width} /></clipPath></defs>
      <g clipPath={`url(#${id})`} dangerouslySetInnerHTML={{ __html: flagMarkup(nation, [kits.home.shirt, kits.home.trim]) }} />
      <rect x="0.4" y="0.4" width="29.2" height="19.2" rx={(rounded * 30) / width} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="0.8" />
    </svg>
  );
}
