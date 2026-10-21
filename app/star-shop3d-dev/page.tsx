"use client";

/**
 * 3D SHOP — the test page (Harry, 1 Oct 2026: "still kinda had a different
 * idea of actually playing a 3d person going shopping but you can go ahead
 * and do that in the test area maybe").
 *
 * The same screen a career opens from the Shop page's "Walk the 3D shop
 * (beta)" button (components/star/Shop3D.tsx), here with a club-kit switch,
 * an fps counter and a pretend Buy. Nothing reaches a career and nothing is
 * saved. On the Broadcast frame (A-8, 20 Oct 2026): the shop plays in the
 * stage box; ?bare=1 or ?film=1 opens it full screen as before. Approved 3D
 * Scene Editor edits ticked for "the test page" play here.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn } from "@/components/admin/broadcast/BroadcastPage";
import Shop3D from "@/components/star/Shop3D";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import "../star-3d-area-dev/stage3d.css";

// the test player's name on the back of his Style A shirt (a career sets it from the save)
if (typeof window !== "undefined") setToonYou({ name: "Player" });

export default function Shop3DPage() {
  return <Suspense><Shop3DTest /></Suspense>;
}

function Shop3DTest() {
  const router = useRouter();
  const q = useSearchParams();
  const atDoor = q.get("door") === "1";
  const bare = q.get("bare") === "1" || q.get("film") === "1";
  // its front doors lead out to the 3D garden test page, as in a career
  const shop = (
    <Shop3D key={atDoor ? "door" : "mid"} dev where="test" embedded={!bare} backLabel="3D places" atDoor={atDoor}
      onBack={() => router.push("/admin/star/g/places3d")} onDoor={() => router.push("/star-garden3d-dev?arrive=shop")} />
  );
  if (bare) return <>{shop}<PageGuide page="/star-shop3d-dev" corner="bottom-left" /></>;
  return (
    <>
      <BroadcastPage title="3D shop" sub="Walk the shop: stick or tap to move, drag to look. Its doors lead to the garden." width={1440}>
        <div className="s3-bar">
          <Btn href={atDoor ? "/star-shop3d-dev" : "/star-shop3d-dev?door=1"} title="Start inside the front doors, as from the garden">{atDoor ? "Start in the middle" : "Start at the doors"}</Btn>
          <Btn href="/star-scene-editor-dev?place=shop" title="Camera and light for the shop">Edit in the scene editor ›</Btn>
        </div>
        <div className="s3-stage">{shop}</div>
      </BroadcastPage>
      <PageGuide page="/star-shop3d-dev" corner="bottom-left" />
    </>
  );
}
