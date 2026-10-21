/**
 * app/credits/page.tsx — the public credits page (Harry, D8, 21 Oct 2026:
 * credits in "Settings + public /credits").
 *
 * Every outside source the game uses, with the exact credit it asks for. It
 * reads the ONE list in lib/star/dataCredits.ts, the same list Settings → More
 * → Data credits shows, so the two can never disagree. Public: no sign-in
 * (middleware.ts only guards /tierlist and /create). Linked from the site
 * footer and the sitemap.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DATA_CREDITS, CREDIT_GROUPS } from "@/lib/star/dataCredits";

export const metadata: Metadata = {
  title: "Credits",
  description: "The free football data, 3D models, voices and fonts Knowitball uses, and the credit each one asks for.",
  alternates: { canonical: "/credits" },
};

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-black tracking-tight text-white">Credits</h1>
        <p className="mb-8 text-sm text-white">
          Knowitball&apos;s football games use free data, models, voices and fonts made by other people.
          Each one is free to use with credit. Thank you to all of them.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-white">
          {CREDIT_GROUPS.map((g) => {
            const lines = DATA_CREDITS.filter((c) => c.use === g.use);
            if (lines.length === 0) return null;
            return (
              <section key={g.use} data-credit-group={g.use}>
                <h2 className="mb-1 text-lg font-bold text-white">{g.title}</h2>
                {g.note && <p className="mb-3 text-xs text-white/70">{g.note}</p>}
                <ul className="space-y-2">
                  {lines.map((c) => (
                    <li key={c.id} data-credit-line={c.id} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
                      <p>{c.line}</p>
                      <p className="mt-1 text-xs text-white/60">
                        {c.source} · {c.licence}{c.note ? ` · ${c.note}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section>
            <h2 className="mb-1 text-lg font-bold text-white">Licences</h2>
            <p className="text-xs text-white/70">
              CC BY 4.0: <a className="text-indigo-400 hover:underline" href="https://creativecommons.org/licenses/by/4.0/">creativecommons.org/licenses/by/4.0</a>.
              {" "}Changes made means the data was reduced to averages and counts, or moved onto our own pitch.
              No single real match is replayed. Every licence text ships with the files it covers.
            </p>
          </section>

          <p className="text-xs text-white/70">
            Something missing or wrong? Email{" "}
            <a href="mailto:knowitballcontact@gmail.com" className="text-indigo-400 hover:underline">knowitballcontact@gmail.com</a>.
            {" "}See also <Link href="/legal" className="text-indigo-400 hover:underline">Privacy and Terms</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
