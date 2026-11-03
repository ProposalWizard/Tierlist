"use client";

/**
 * The cookie banner (lib/cookieConsent.ts). Shown until the visitor picks
 * Accept or No thanks; either answer is remembered on this device. Accept
 * loads Google Analytics and PostHog; No thanks loads neither. Small and at
 * the bottom, above everything, so it never sits on a match for long.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { COOKIE_CONSENT_EVENT, cookieChoice, setCookieChoice, type CookieChoice } from "@/lib/cookieConsent";

const GA_ID = "G-ZEGDB8YDZZ";

export default function CookieConsent() {
  // Read after mount: localStorage does not exist on the server.
  const [choice, setChoice] = useState<CookieChoice | null | "unknown">("unknown");
  useEffect(() => {
    setChoice(cookieChoice());
    const on = () => setChoice(cookieChoice());
    window.addEventListener(COOKIE_CONSENT_EVENT, on);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, on);
  }, []);

  return (
    <>
      {/* Google Analytics: only after a yes. */}
      {choice === "yes" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {choice === null && (
        <div
          role="dialog"
          aria-label="Cookies"
          data-cookie-banner
          className="fixed inset-x-0 bottom-0 z-[200] p-3 sm:p-4"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-4 text-gray-900 shadow-2xl ring-1 ring-black/10">
            <p className="text-sm leading-snug">
              We&apos;d like to use cookies to see how people play, so we can make the game better.
              They&apos;re off until you say yes.{" "}
              <Link href="/legal#cookies" className="font-semibold underline">Cookie policy</Link>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                data-cookie-accept
                onClick={() => setCookieChoice("yes")}
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
              >
                Accept
              </button>
              <button
                type="button"
                data-cookie-reject
                onClick={() => setCookieChoice("no")}
                className="flex-1 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-bold text-gray-900 active:scale-[0.98]"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The legal page's button: forget the choice, so the banner asks again. */
export function ChangeCookieChoice() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { setCookieChoice(null); setDone(true); }}
      className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20"
    >
      {done ? "Choose again in the box below" : "Change your cookie choice"}
    </button>
  );
}
