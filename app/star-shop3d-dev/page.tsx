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
import { useRouter } from "next/navigation";
import PageGuide from "@/components/admin/PageGuide";
import Shop3D from "@/components/star/Shop3D";

export default function Shop3DPage() {
  const router = useRouter();
  return (
    <>
      <Shop3D dev backLabel="3D area" onBack={() => router.push("/star-3d-area-dev")} />
      <PageGuide page="/star-shop3d-dev" corner="bottom-left" />
    </>
  );
}
