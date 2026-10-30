"use client";

/**
 * /star-guest-dev — GUEST ACCOUNTS test page (Harry, 25 Oct 2026).
 *
 * Shows the whole guest flow without needing the live switch: both ad landing
 * pages (lib/campaigns.ts) and every version of "Save your career" (the
 * upgrade prompt), at phone size. "Try it for real" makes a real guest
 * account, which only works once Supabase's "Allow anonymous sign-ins" is on.
 * Plan: docs/plans/2026-10-25/guest-accounts-plan.md.
 *
 * ?shot=landing:<slug> or ?shot=prompt:<variant> draws one screen alone, full
 * size, for screenshots.
 */

import { useEffect, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import { CAMPAIGNS, campaignFor, type Campaign } from "@/lib/campaigns";
import ManagerTalk from "@/components/star/ManagerTalk";
import { startTrial } from "@/lib/star/trial";
import { simRemaining } from "@/lib/star/trialDev";
import { scoutedOfferForTrial } from "@/lib/star/scoutedPlacement";
import { managerTalkFor } from "@/lib/star/signingTalk";
import { mulberry32 } from "@/lib/star/season";
import { leagueNameFor } from "@/lib/star/calendar";
import { CampaignLandingView } from "@/app/campaign/[campaign]/CampaignLanding";
import { GuestSaveSheet, type GuestSaveVariant } from "@/components/guest/GuestSavePrompt";
import { guestAccountsOn, isGuestUser, turnstileSiteKey } from "@/lib/guest/config";
import { startGuest, upgradeGuestWithGoogle } from "@/lib/guest/start";
import { createClient } from "@/lib/supabase/client";

const VARIANTS: { key: GuestSaveVariant; name: string }[] = [
  { key: "first-match", name: "After the first match" },
  { key: "first-season", name: "After the first season" },
  { key: "daily", name: "Every day from day 7" },
  { key: "taken", name: "Google account already taken" },
];
const SAMPLE_LINE = "Jay Carter · 1 game · 1 goal";
const DAILY_LINE = "Jay Carter · 14 games · 6 goals";
/** The daily card's sample day. */
const SAMPLE_DAY = 9;
const noop = () => {};
/** A fixed trial seed so the picture is the same every time. */
const SAMPLE_SEED = 20261025;

/**
 * The trial's first club for an ad, made by the SAME functions the game uses
 * (scoutedOfferForTrial, as offersForTrial in app/star-dev/page.tsx calls it;
 * managerTalkFor for the screen), on an average sample trial.
 */
function firstClubTalk(c: Campaign, seed = SAMPLE_SEED) {
  const trial = simRemaining({ ...startTrial(seed), ...(c.startLeague ? { startDivision: c.startLeague } : {}) }, "average");
  const offer = scoutedOfferForTrial(trial);
  const talk = managerTalkFor({
    trial, club: offer.club, division: offer.division, clubStrength: offer.strength,
    playerFirstName: c.player.firstName, rng: mulberry32(seed ^ 0x1a9b3), scoutNouns: true,
  });
  return { offer, talk };
}

function FirstClub({ campaign }: { campaign: Campaign }) {
  const { talk } = firstClubTalk(campaign);
  return <ManagerTalk talk={talk} managerName="The manager" onNegotiate={noop} onAccept={noop} onSeeOthers={noop} />;
}

/** A 390 × 844 phone, scaled down. `transform` makes the prompt's fixed
 *  position sit inside the phone instead of over the whole page. */
function Phone({ children, scale = 0.62 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div style={{ width: 390 * scale, height: 844 * scale }} className="overflow-hidden rounded-[22px] border border-white/15 bg-black">
      <div style={{ width: 390, height: 844, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function PromptBackdrop({ variant }: { variant: GuestSaveVariant }) {
  return (
    <div className="relative h-full min-h-[844px] bg-gray-900 p-4 text-white">
      <div className="rounded-2xl bg-white/5 p-4 text-sm font-bold text-white/40">The career&apos;s home screen sits behind the prompt.</div>
      <GuestSaveSheet
        variant={variant}
        day={variant === "daily" ? SAMPLE_DAY : undefined}
        playerLine={variant === "taken" ? undefined : variant === "daily" ? DAILY_LINE : SAMPLE_LINE}
        onSave={noop} onExisting={noop} onLater={noop}
      />
    </div>
  );
}

export default function StarGuestDevPage() {
  const [shot, setShot] = useState<string | null>(null);
  const [who, setWho] = useState<string>("checking…");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setShot(new URLSearchParams(window.location.search).get("shot"));
    createClient().auth.getUser().then(({ data: { user } }) => {
      setWho(!user ? "Signed out" : isGuestUser(user) ? `Guest account ${user.id.slice(0, 8)}…` : `Signed in (${user.email ?? "real account"})`);
    }).catch(() => setWho("Couldn't reach Supabase"));
  }, []);

  if (shot?.startsWith("landing:")) {
    const c = campaignFor(shot.slice(8));
    if (c) return <CampaignLandingView campaign={c} onPlay={noop} />;
  }
  if (shot?.startsWith("prompt:")) {
    const v = VARIANTS.find((x) => x.key === shot.slice(7));
    if (v) return <PromptBackdrop variant={v.key} />;
  }
  if (shot?.startsWith("club:")) {
    const c = campaignFor(shot.slice(5));
    if (c) return <FirstClub campaign={c} />;
  }

  const tryGuest = async () => {
    setResult("Starting…");
    const r = await startGuest({ campaign: "test-page", landing: "/star-guest-dev" });
    setResult(r.ok ? (r.created ? "Made a new guest account." : `Already signed in (${r.isGuest ? "guest" : "real account"}); nothing made.`) : r.message);
    if (r.ok && r.created) setWho("Guest account (just made)");
  };
  const tryUpgrade = async () => {
    const r = await upgradeGuestWithGoogle("/star-guest-dev", "test-page");
    if (r && !r.ok) setResult(r.message);
  };

  return (
    <BroadcastPage title="Guest accounts" sub="Play without signing in, ad landing pages, and Save your career">
      <PanelGrid min={300}>
        <Panel title="The switch">
          <Label>Guest accounts on this build</Label>
          <p className="text-2xl font-black">{guestAccountsOn() ? "ON" : "OFF"}</p>
          <Note>{guestAccountsOn()
            ? "Players see Play now on the game's sign-in screen, the /play/ pages work, and guests get the Save your career prompt."
            : "Nothing guest-related shows on the site. Everything below is a preview only."}</Note>
          <Label>Bot check (Turnstile)</Label>
          <p className="font-bold">{turnstileSiteKey() ? "Set up" : "Not set up"}</p>
          <Label>You right now</Label>
          <p className="font-bold">{who}</p>
        </Panel>
        <Panel title="Try it for real">
          <Note>Makes a real guest account in Supabase. Works only once &quot;Allow anonymous sign-ins&quot; is on there (and the switch above is ON).</Note>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn main onClick={tryGuest} disabled={!guestAccountsOn()}>Start a guest account</Btn>
            <Btn onClick={tryUpgrade} disabled={!guestAccountsOn()}>Save with Google</Btn>
          </div>
          {result && <p className="mt-2 font-bold">{result}</p>}
          <Label>Landing pages</Label>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGNS.map((c) => <Btn key={c.slug} href={`/play/${c.slug}?utm_source=test`}>/play/{c.slug}</Btn>)}
          </div>
        </Panel>
      </PanelGrid>

      <Panel title="Ad landing pages" note="lib/campaigns.ts">
        <div className="flex flex-wrap gap-4">
          {CAMPAIGNS.map((c) => (
            <div key={c.slug}>
              <Label>/play/{c.slug} · {c.source}</Label>
              <Phone><CampaignLandingView campaign={c} onPlay={noop} /></Phone>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Save your career" note="guests only">
        <div className="flex flex-wrap gap-4">
          {VARIANTS.map((v) => (
            <div key={v.key}>
              <Label>{v.name}</Label>
              <Phone><PromptBackdrop variant={v.key} /></Phone>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="First club (custom start point)" note="lib/campaigns.ts startLeague">
        <div className="flex flex-wrap gap-4">
          {CAMPAIGNS.map((c) => {
            const { offer } = firstClubTalk(c);
            return (
              <div key={c.slug}>
                <Label>/play/{c.slug} · {c.startLeague ? `start: ${leagueNameFor(c.startLeague)}` : "normal roll"} · {offer.club} ({leagueNameFor(offer.division)})</Label>
                <Phone><FirstClub campaign={c} /></Phone>
              </div>
            );
          })}
        </div>
      </Panel>
      <PageGuide page="/star-guest-dev" />
    </BroadcastPage>
  );
}
