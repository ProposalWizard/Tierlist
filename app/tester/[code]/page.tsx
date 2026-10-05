/**
 * /tester/[code] — a tester link (Harry, 5 Oct 2026: "a 'tester access' link
 * and accounts that we will use for our testers to be able to have god mode
 * too").
 *
 * Signed out: asks them to sign in with Google and comes straight back here
 * (/auth?next=… carries the code through sign-in and the username step).
 * Signed in: one button, "Become a tester". Pressing it (not just opening the
 * page) does the change, so a link preview in a chat app can't use the link.
 *
 * Links are made and switched off on /admin/testers.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { roleOf } from "@/lib/admin";
import { findLink, normaliseTesterCode, outcomeForLink, testerLinkPath, type ClaimOutcome, type TesterClient } from "@/lib/testerLinks";
import ClaimButton from "./ClaimButton";

export const metadata: Metadata = {
  title: "Tester access",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const MESSAGES: Record<Exclude<ClaimOutcome, "joined">, { title: string; body: string }> = {
  already: { title: "You're already a tester", body: "Nothing to do. The developer tools are in Road to Ballon d'Or → Settings." },
  off: { title: "This link is switched off", body: "Ask the Knowitball team for a new one." },
  unknown: { title: "This link doesn't work", body: "Check you copied all of it, or ask the Knowitball team for a new one." },
  "not-ready": { title: "Tester links aren't switched on yet", body: "Try again later, or ask the Knowitball team." },
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-black/40 p-5 text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">🧪 Tester access</div>
        <h1 className="mt-2 text-xl font-black text-white">{title}</h1>
        <div className="mt-3 text-sm font-semibold text-white">{children}</div>
      </div>
    </main>
  );
}

export default async function TesterLinkPage({ params }: { params: { code: string } }) {
  const code = normaliseTesterCode(params.code);
  if (!code) {
    return <Card title={MESSAGES.unknown.title}><p>{MESSAGES.unknown.body}</p></Card>;
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!userId) {
    return (
      <Card title="Sign in to become a tester">
        <p>Testers play the career with the developer tools switched on. Sign in with your Google account, then you come straight back here.</p>
        <Link
          href={`/auth?next=${encodeURIComponent(testerLinkPath(code))}`}
          className="mt-4 inline-block rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-black"
        >
          Sign in with Google
        </Link>
        <p className="mt-3 text-[11px] text-white/80">If you don&apos;t land back here, open this link again once you&apos;re signed in.</p>
      </Card>
    );
  }

  let blocked: ClaimOutcome | null;
  try {
    blocked = outcomeForLink(await findLink(createServiceClient() as unknown as TesterClient, code));
  } catch {
    blocked = "not-ready";
  }
  if (!blocked && (await roleOf(userId)) !== "player") blocked = "already";

  if (blocked && blocked !== "joined") {
    const m = MESSAGES[blocked];
    return (
      <Card title={m.title}>
        <p>{m.body}</p>
        {blocked === "already" && (
          <Link href="/star-dev" className="mt-4 inline-block rounded-xl bg-white/10 px-5 py-2.5 text-sm font-black text-white">Open the career</Link>
        )}
      </Card>
    );
  }

  return (
    <Card title="Become a tester">
      <p>You&apos;ll get the developer tools in Road to Ballon d&apos;Or (Settings → Developer tools) and the team&apos;s test pages. Any career you use the tools on is marked &quot;Tester save&quot;.</p>
      <ClaimButton code={code} />
    </Card>
  );
}
