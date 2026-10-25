"use client";

/**
 * The landing page itself: the ad's words, one button. The button makes a
 * guest account with the campaign and the link's UTM words on it
 * (lib/guest/start.ts), leaves the "start this campaign's career" note
 * (lib/guest/campaignCareer.ts) and opens the game, which goes straight into
 * the trial. A player already signed in (guest or real) keeps their account.
 *
 * `preview` (the test page) draws it without the button doing anything.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { pitchFont } from "@/components/star/ui/pitchFont";
import { utmFrom, type Campaign } from "@/lib/campaigns";
import { startGuest, track } from "@/lib/guest/start";
import { setPendingCampaign } from "@/lib/guest/campaignCareer";

export function CampaignLandingView({ campaign: c, busy, error, onPlay }: {
  campaign: Campaign;
  busy?: boolean;
  error?: string | null;
  onPlay: () => void;
}) {
  const [a, b] = c.colours;
  return (
    <div className={`${pitchFont.variable} relative min-h-[100dvh] overflow-hidden bg-gray-950 text-white`}>
      {/* The site's top menu and footer hide while this marker is on the page (globals.css). */}
      <div data-star-game hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true"
        style={{ background: `radial-gradient(120% 60% at 50% 0%, ${a}55 0%, transparent 60%), radial-gradient(90% 50% at 50% 100%, ${b}33 0%, transparent 70%)` }} />
      {/* Pitch lines, faint. */}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] w-full opacity-[0.07]" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <g fill="none" stroke="white" strokeWidth="2">
          <rect x="20" y="20" width="350" height="400" />
          <circle cx="195" cy="20" r="60" />
          <rect x="95" y="200" width="200" height="120" />
          <rect x="145" y="260" width="100" height="60" />
        </g>
      </svg>

      <main className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-8 pt-10">
        <p className="text-center text-[11px] font-black uppercase tracking-[0.25em] text-white/60">Knowitball · Road to Ballon d&apos;Or</p>
        <h1 className="mt-6 text-center text-[44px] uppercase leading-[0.95] tracking-wide" style={{ fontFamily: "var(--font-pitch), Impact, sans-serif" }}>
          {c.headline}
        </h1>
        <p className="mt-4 text-center text-base font-bold text-white/80">{c.sub}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {c.points.map((p) => (
            <span key={p} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black text-white/85">{p}</span>
          ))}
        </div>

        {/* The ready-made player: a shirt with his name and number. */}
        <div className="mx-auto mt-8 flex flex-col items-center">
          <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="kit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={a} />
                <stop offset="1" stopColor={b} />
              </linearGradient>
            </defs>
            <path d="M38 14 L22 22 L6 44 L22 56 L30 48 L30 110 L90 110 L90 48 L98 56 L114 44 L98 22 L82 14 C78 24 70 28 60 28 C50 28 42 24 38 14 Z" fill="url(#kit)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            <text x="60" y="56" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" letterSpacing="1">{c.player.lastName.toUpperCase()}</text>
            <text x="60" y="96" textAnchor="middle" fontSize="38" fontWeight="900" fill="white" style={{ fontFamily: "var(--font-pitch), Impact, sans-serif" }}>{c.player.preferredNumber}</text>
          </svg>
          <p className="mt-2 text-sm font-black">{c.player.firstName} {c.player.lastName}</p>
          <p className="text-xs font-bold text-white/55">Age 16 · Striker · Trial today</p>
        </div>

        <div className="mt-auto pt-8">
          {error && <p className="mb-3 text-center text-sm font-bold text-amber-300">{error}</p>}
          <button
            type="button"
            onClick={onPlay}
            disabled={busy}
            className="w-full rounded-2xl px-5 py-4 text-lg font-black text-gray-950 shadow-lg active:scale-95 disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${a}, ${b})` }}
          >
            {busy ? "Getting your boots…" : `${c.cta} →`}
          </button>
          <p className="mt-3 text-center text-xs font-bold text-white/50">{c.footnote}</p>
          <p className="mt-4 text-center text-xs font-bold text-white/40">
            Already play? <a href="/auth?next=/star-dev" className="underline">Sign in</a>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function CampaignLanding({ campaign }: { campaign: Campaign }) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utm = utmFrom(params, campaign);

  useEffect(() => {
    track("campaign_landing_viewed", { campaign: campaign.slug, ...utm });
    // Once per page view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.slug]);

  const play = async () => {
    setBusy(true); setError(null);
    track("campaign_play_clicked", { campaign: campaign.slug, ...utm });
    const r = await startGuest({ campaign: campaign.slug, utm, landing: `/play/${campaign.slug}` });
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    setPendingCampaign(campaign.slug);
    window.location.assign(`/star-dev?from=${encodeURIComponent(campaign.slug)}`);
  };

  return <CampaignLandingView campaign={campaign} busy={busy} error={error} onPlay={play} />;
}
