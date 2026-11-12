"use client";

import { useEffect, useState } from "react";

/**
 * "Install on your phone" (Harry, 12 Nov 2026: "on web on mobile it pushes you
 * to download it as an app"). The site had no install button before this: the
 * game only told an iPhone to use Add to Home Screen (DeviceSettings.tsx).
 *
 *  - Android / Chrome / Edge: the browser hands the page an install offer;
 *    the button opens the browser's own "Install app?" box.
 *  - iPhone / iPad: no site may open that box, so the button shows the two
 *    steps (Share, then Add to Home Screen).
 *  - Anything else: one line on where the browser keeps "Install app".
 */
interface InstallOffer extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton() {
  const [offer, setOffer] = useState<InstallOffer | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onOffer = (e: Event) => { e.preventDefault(); setOffer(e as InstallOffer); };
    const onDone = () => { setInstalled(true); setOffer(null); };
    window.addEventListener("beforeinstallprompt", onOffer);
    window.addEventListener("appinstalled", onDone);
    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer);
      window.removeEventListener("appinstalled", onDone);
    };
  }, []);

  async function tap() {
    if (offer) {
      try {
        await offer.prompt();
        const choice = await offer.userChoice;
        if (choice.outcome === "accepted") setInstalled(true);
      } catch {}
      setOffer(null);
      return;
    }
    setTip((v) => !v);
  }

  if (installed) {
    return <div className="kh-get-item kh-get-done"><PhoneIcon /><span><b>Installed</b><small>Open it from your home screen</small></span></div>;
  }

  return (
    <div className="kh-get-install">
      <button type="button" className="kh-get-item kh-get-btn" onClick={tap} aria-expanded={offer ? undefined : tip}>
        <PhoneIcon />
        <span><b>Install on your phone</b><small>Free. Opens like an app.</small></span>
      </button>
      {tip && !offer && (
        ios ? (
          <ol className="kh-get-tip">
            <li><span className="kh-step">1</span>Tap Share in Safari</li>
            <li><span className="kh-step">2</span>Tap Add to Home Screen</li>
          </ol>
        ) : (
          <p className="kh-get-tip">Open your browser&apos;s menu and choose &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</p>
        )
      )}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M12 7v7M9 11.5l3 3 3-3" />
    </svg>
  );
}
