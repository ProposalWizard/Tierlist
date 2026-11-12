import type { Metadata } from "next";
import Link from "next/link";
import PublicHome from "@/components/home/PublicHome";
import { HOME_METADATA } from "@/components/home/meta";
import { HOME_LOOKS, pickLook } from "@/components/home/games";

/**
 * TEST PAGE for the new public home (Harry, 12 Nov 2026). The real home
 * (app/page.tsx) is untouched until he picks a look.
 *   /home-new-dev?look=a   Stadium night
 *   /home-new-dev?look=b   Friv Classic
 *   /home-new-dev?look=c   Clean arcade
 * Add &bare=1 to hide the little look switch (used for the pictures).
 */
export const metadata: Metadata = {
  ...HOME_METADATA,
  alternates: undefined,
  robots: { index: false, follow: false },
};

export default function HomeNewDevPage({ searchParams }: { searchParams: { look?: string | string[]; bare?: string; pitch?: string } }) {
  const look = pickLook(searchParams.look);
  return (
    <>
      {!searchParams.bare && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-gray-900 px-3 py-2 text-xs font-bold text-white">
          <span className="text-gray-300">Test page. Look:</span>
          {HOME_LOOKS.map((l) => (
            <Link
              key={l.id}
              href={`/home-new-dev?look=${l.id}`}
              className={`rounded-md px-3 py-2 ${l.id === look ? "bg-white text-gray-950" : "bg-gray-800 text-white hover:bg-gray-700"}`}
            >
              {l.id.toUpperCase()} {l.name}
            </Link>
          ))}
        </div>
      )}
      <PublicHome look={look} pitch={searchParams.pitch === "1" || searchParams.pitch === "2" || searchParams.pitch === "3" ? searchParams.pitch : undefined} />
    </>
  );
}
