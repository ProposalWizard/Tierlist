import type { Metadata } from "next";
import BetaSignup from "@/components/home/BetaSignup";
import { DISCORD_INVITE } from "@/lib/discord";
import "@/components/home/home.css";

/**
 * /beta — "Get your beta code" (Harry, 28 Nov 2026: "make sure the get your
 * code links to the right thing to actually get your codes").
 *
 * The Discord's #get-your-code channel links here. Today it puts your email
 * in the queue (beta_signups, source from ?from=discord|tiktok|…). The codes
 * themselves (one-use, one account, sent in waves) are the next build:
 * see patch notes 0.149, "THE CLOSED BETA".
 */
export const metadata: Metadata = {
  title: "Get your beta code",
  description: "Join the Knowitball closed beta: get in the queue, join the Discord, and get your code when your wave opens.",
  alternates: { canonical: "/beta" },
};

const SOURCES = ["discord", "tiktok", "instagram", "youtube"];

export default function BetaPage({ searchParams }: { searchParams?: { from?: string } }) {
  const from = SOURCES.includes(String(searchParams?.from)) ? String(searchParams?.from) : "beta";
  return (
    <div className="kh kh-c kh-d" data-page="beta">
      <main className="kh-main">
        <section className="kh-beta" aria-labelledby="kh-beta-title">
          <p style={{ margin: "8px 0 10px" }}><span className="kh-beta-tag">Closed beta · opening soon</span></p>
          <h1 id="kh-beta-title" className="kh-h2">Get your beta code</h1>
          <ol className="kh-sub" style={{ paddingLeft: 22, display: "grid", gap: 8, textAlign: "left", listStyle: "decimal" }}>
            <li><b>Get in the queue.</b> Leave your email below.</li>
            <li><b>Join the Discord.</b> Codes, news and the first test days happen there.</li>
            <li><b>Get your code.</b> Codes go out in waves of 20 to 30 every few days, in the order people joined. Each code works once, on one account.</li>
          </ol>
          <BetaSignup source={from} />
          {DISCORD_INVITE && (
            <p className="kh-sub" style={{ marginTop: 16 }}>
              <a className="kh-beta-tag" style={{ display: "inline-block", padding: "10px 16px", textDecoration: "none" }} href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer">
                Join the Discord →
              </a>
            </p>
          )}
          <p className="kh-sub" style={{ marginTop: 12 }}>The first 100 players get the <b>Founding Player</b> role, for good.</p>
        </section>
      </main>
    </div>
  );
}
