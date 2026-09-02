"use client";
import { useState } from "react";
import type { KibCan } from "@/lib/star/shopData";

/**
 * ONE CAN, DRAWN.
 *
 * A real product shot when `can.image` loads, the flat colour block it
 * always used to be otherwise — the same "drop the file in later and it
 * upgrades automatically" pattern TrialReward.tsx's contract art already
 * uses, via the image's own onError rather than anything fetched or checked
 * up front. Shared between the shop list and the dashboard's owned-cans
 * card so both upgrade together the moment the art exists.
 *
 * `object-contain`, not `object-cover`: the real shots are cut out on a
 * transparent background now (no white box behind the can), so there is
 * nothing left to crop TO — `cover` was clipping the glow effect on the
 * Elite can top and bottom to fill a container shaped nothing like the
 * photo, reported directly ("the bottom and the top part of that effect are
 * cut out"). `contain` shows the whole shot, letterboxed by nothing since
 * the surrounding pixels are transparent rather than a visible bar.
 */
export default function KibCanIcon({ can, className = "h-14 w-10" }: { can: KibCan; className?: string }) {
  const [imgOk, setImgOk] = useState(true);

  if (imgOk) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={can.image}
        alt=""
        className={`${className} shrink-0 object-contain`}
        onError={() => setImgOk(false)}
      />
    );
  }

  return (
    <div className={`${className} ${can.color} flex shrink-0 items-center justify-center rounded-lg border-2 border-black/40`}>
      <span className="text-[8px] font-black text-white">KIB</span>
    </div>
  );
}
