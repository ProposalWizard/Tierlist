"use client";

/**
 * 3D SHOP — the test page (Harry, 1 Oct 2026: "still kinda had a different
 * idea of actually playing a 3d person going shopping but you can go ahead
 * and do that in the test area maybe").
 *
 * The same screen a career opens from the Shop page's "Walk the 3D shop
 * (beta)" button (components/star/Shop3D.tsx), here with a club-kit switch,
 * an fps counter and a pretend Buy. Nothing reaches a career and nothing is
 * saved.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import PageGuide from "@/components/admin/PageGuide";
import Shop3D from "@/components/star/Shop3D";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";

// the test player's name on the back of his Style A shirt (a career sets it from the save)
if (typeof window !== "undefined") setToonYou({ name: "Player" });

export default function Shop3DPage() {
  return <Suspense><Shop3DTest /></Suspense>;
}

function Shop3DTest() {
  const router = useRouter();
  const q = useSearchParams();
  // its front doors lead out to the 3D garden test page, as in a career
  return (
    <>
      <Shop3D dev backLabel="3D area" atDoor={q.get("door") === "1"} onBack={() => router.push("/star-3d-area-dev")} onDoor={() => router.push("/star-garden3d-dev?arrive=shop")} />
      <PageGuide page="/star-shop3d-dev" corner="bottom-left" />
    </>
  );
}
