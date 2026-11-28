/**
 * app/support/page.tsx — Support page (the web address Apple and Google ask for
 * when an app is listed). Plain page, no sign-in needed.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Knowitball: contact us, report a bug, or delete your account.",
  alternates: { canonical: "/support" },
};

const EMAIL = "knowitballcontact@gmail.com";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-black tracking-tight text-white">Support</h1>
        <p className="mb-10 text-sm text-white">
          Help with Knowitball and Road to the Golden Ball, on the website and in the apps.
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-white">
          <section id="contact">
            <h2 className="mb-2 text-lg font-bold">Contact us</h2>
            <p className="mb-2">
              Email{" "}
              <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>. We read every
              message and usually reply within 2 days.
            </p>
          </section>

          <section id="bug">
            <h2 className="mb-2 text-lg font-bold">Report a bug</h2>
            <p className="mb-2">Please tell us:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>what you were doing when it went wrong</li>
              <li>what you expected to happen, and what happened instead</li>
              <li>your phone or computer (for example iPhone 15, or Chrome on Windows)</li>
              <li>a screenshot, if you can</li>
            </ul>
          </section>

          <section id="faq">
            <h2 className="mb-2 text-lg font-bold">Common questions</h2>
            <h3 className="mt-3 font-semibold">Where is my saved game?</h3>
            <p>
              If you are signed in, it is saved to your account and follows you to any device.
              If you are not signed in, it is saved only on the phone or browser you played on.
              Clearing your browser data or uninstalling the app deletes an unsigned-in save.
            </p>
            <h3 className="mt-3 font-semibold">I cannot sign in.</h3>
            <p>
              We use Google sign-in. Check you are using the same Google account as before, then
              try again. If it still fails, email us the time it happened.
            </p>
            <h3 className="mt-3 font-semibold">Are you connected to real clubs or players?</h3>
            <p>
              No. Knowitball is an independent project and is not affiliated with or endorsed by
              any club, league or player. Names are used for information and entertainment.
              See <Link className="underline" href="/legal#ip">Privacy and Terms</Link>.
            </p>
          </section>

          <section id="delete-account">
            <h2 className="mb-2 text-lg font-bold">Delete your account and data</h2>
            <p className="mb-2">
              Fastest: sign in, open <Link className="underline" href="/profile">Profile</Link>,
              scroll to the bottom and press &quot;Delete my account&quot;. Or by email:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Email{" "}
                <a className="underline" href={`mailto:${EMAIL}?subject=Delete%20my%20account`}>{EMAIL}</a>{" "}
                with the subject &quot;Delete my account&quot;.
              </li>
              <li>Send it from the email address you sign in with, so we know it is you.</li>
              <li>
                We delete your account, saved games, tierlists, votes and uploaded images within
                30 days, then confirm by email.
              </li>
            </ol>
            <p className="mt-2">
              Not signed in? There is nothing on our servers to delete. Uninstalling the app or
              clearing your browser data removes your save.
            </p>
          </section>

          <p>
            <Link className="underline" href="/legal">Privacy Policy and Terms of Use</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
