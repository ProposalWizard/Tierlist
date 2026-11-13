import Link from "next/link";
import ObjectivesToast from "@/components/ObjectivesToast";
import { MAIN_GAME, MORE_GAMES, type HomeLook } from "./games";
import { STORE_LINKS } from "./storeLinks";
import TileArt from "./TileArt";
import LoadingIntro from "./LoadingIntro";
import InstallButton from "./InstallButton";
import BetaSignup from "./BetaSignup";
import "./home.css";

/**
 * THE PUBLIC HOME (Harry, 12 Nov 2026, from his recording).
 *
 * "Road to the Golden Ball is like the main thing on the site. Play now." /
 * "A Friv style … then we have our games kind of laid out." / "Try the beta,
 * sign up … buy it on Steam or download it on the App Store."
 *
 * One page, one order, three looks (paint and layout in home.css):
 *   a  Stadium night   dark, the game's stadium, a gold PLAY NOW
 *   b  Friv Classic    bright, chunky picture tiles, the game is the giant tile
 *   c  Clean arcade    light, big type, the game shown on a phone
 * Order: loading picture, the game, Get the game, Join the beta, More games,
 * contact. Nothing here is invented: no player counts, no reviews, no prices,
 * no store links until a store page exists (storeLinks.ts).
 *
 * To make this the real home: app/page.tsx returns <PublicHome look="…" />
 * and exports HOME_METADATA (meta.ts).
 */
export default function PublicHome({ look, v }: { look: HomeLook; v?: "1" | "2" | "3" }) {
  return (
    <div className={`kh kh-${look === "d" ? "c kh-d" : look}${look === "b" && v ? ` kh-bv-${v}` : ""}${look === "d" ? ` kh-dv-${v === "2" ? "2" : "1"}` : ""}`} data-home-look={look}>
      <LoadingIntro />
      <ObjectivesToast />

      {look === "d" && <HomeTabs active="home" />}

      <main className="kh-main">
        {/* 1. The game */}
        <section className="kh-hero" aria-labelledby="kh-hero-title">
          <div className="kh-hero-in">
            <div className="kh-hero-copy">
              <p className="kh-kicker"><span className="kh-beta-tag">Beta</span><span>Play it now in your browser</span></p>
              <h1 id="kh-hero-title" className="kh-title">Road to the <span className="kh-gold">Golden Ball</span></h1>
              <p className="kh-line">{MAIN_GAME.line}</p>
              <Link href={MAIN_GAME.href} className="kh-play" prefetch={false}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg>
                Play now
              </Link>
            </div>
            <HeroMedia look={look === "d" ? "c" : look} />
          </div>
        </section>

        <div className="kh-band">
          {/* 2. Get the game */}
          <section className="kh-get" aria-labelledby="kh-get-title">
            <h2 id="kh-get-title" className="kh-h2">Get the game</h2>
            <div className="kh-get-row">
              <InstallButton />
              {STORE_LINKS.map((s) =>
                s.href ? (
                  <a key={s.id} href={s.href} className="kh-get-item kh-get-btn" rel="noopener">
                    <StoreIcon id={s.id} /><span><b>{s.name}</b><small>Get it here</small></span>
                  </a>
                ) : (
                  <div key={s.id} className="kh-get-item kh-get-soon">
                    <StoreIcon id={s.id} /><span><b>{s.name}</b><small>Coming soon</small></span>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* 3. Join the beta */}
          <section className="kh-beta" aria-labelledby="kh-beta-title">
            <h2 id="kh-beta-title" className="kh-h2">Join the beta</h2>
            <p className="kh-sub">The game is still being built. Leave your email and we&apos;ll tell you when there is news.</p>
            <BetaSignup />
          </section>
        </div>

        {/* 4. More games */}
        <section className="kh-more" aria-labelledby="kh-more-title">
          <h2 id="kh-more-title" className="kh-h2">More games</h2>
          <ul className="kh-grid">
            {look === "d" && (
              <li className="kh-cell kh-cell-main">
                <Link href={MAIN_GAME.href} className="kh-tile" prefetch={false}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="kh-tile-art"><img src="/home/site/hero-player.webp" width={750} height={709} alt="" loading="lazy" decoding="async" /></span>
                  <span className="kh-tile-text">
                    <span className="kh-tile-name">Golden Ball</span>
                    <span className="kh-tile-line">Your football career</span>
                  </span>
                </Link>
              </li>
            )}
            {MORE_GAMES.map((g) => (
              <li key={g.id} className="kh-cell">
                <Link href={g.href} className="kh-tile" prefetch={false}>
                  <span className="kh-tile-art"><TileArt id={g.id} /></span>
                  <span className="kh-tile-text">
                    <span className="kh-tile-name">{g.name}</span>
                    <span className="kh-tile-line">{g.line}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 5. Contact */}
        <footer className="kh-foot">
          <span>Questions or ideas? <a href="mailto:knowitballcontact@gmail.com">knowitballcontact@gmail.com</a></span>
          <span className="kh-foot-links"><Link href="/legal">Privacy and Terms</Link><Link href="/credits">Credits</Link></span>
        </footer>
      </main>
    </div>
  );
}

/** Home | All games. The second tab is the games and nothing else. */
export function HomeTabs({ active }: { active: "home" | "games" }) {
  return (
    <nav className="kh-tabs" aria-label="Home sections">
      <Link href="/" className={`kh-tab${active === "home" ? " kh-tab-on" : ""}`} aria-current={active === "home" ? "page" : undefined}>Home</Link>
      <Link href="/games" className={`kh-tab${active === "games" ? " kh-tab-on" : ""}`} aria-current={active === "games" ? "page" : undefined}>All games</Link>
    </nav>
  );
}

/** The All games tab (/games): every game as a tile, names only. */
export function AllGames() {
  return (
    <div className="kh kh-c kh-d kh-dv-2 kh-all" data-home-look="d">
      <HomeTabs active="games" />
      <main className="kh-main">
        <h1 className="kh-sr">All games</h1>
        <ul className="kh-grid">
          <li className="kh-cell kh-cell-main">
            <Link href={MAIN_GAME.href} className="kh-tile" prefetch={false}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="kh-tile-art"><img src="/home/site/hero-player.webp" width={750} height={709} alt="" decoding="async" /></span>
              <span className="kh-tile-text"><span className="kh-tile-name">Golden Ball</span></span>
            </Link>
          </li>
          {MORE_GAMES.map((g) => (
            <li key={g.id} className="kh-cell">
              <Link href={g.href} className="kh-tile" prefetch={false}>
                <span className="kh-tile-art"><TileArt id={g.id} /></span>
                <span className="kh-tile-text"><span className="kh-tile-name">{g.name}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/** The real pictures from the game. Each look frames them its own way. */
function HeroMedia({ look }: { look: HomeLook }) {
  if (look === "c") {
    return (
      <div className="kh-hero-media kh-devices" aria-hidden={false}>
        <div className="kh-card-back">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/site/game-match.webp" width={378} height={790} alt="A match in the game, seen from above" decoding="async" />
        </div>
        <div className="kh-phone">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/site/game-home.webp" width={390} height={844} alt="The game's home screen: your player in the stadium before the next match" decoding="async" fetchPriority="high" />
        </div>
      </div>
    );
  }
  return (
    <div className="kh-hero-media kh-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home/site/hero-player.webp" width={750} height={709} alt="Your player in the stadium, a picture from the game" decoding="async" fetchPriority="high" />
      {look === "a" && (
        <div className="kh-shot-side">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/site/game-goal.webp" width={378} height={674} alt="A goal celebration in the game" decoding="async" />
        </div>
      )}
    </div>
  );
}

function StoreIcon({ id }: { id: "appStore" | "steam" }) {
  if (id === "appStore") {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="M9 16l4.5-8M15 16l-2.2-3.9M7.5 16h9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="5" width="19" height="13" rx="2.5" />
      <path d="M9 21h6M12 18v3M7 11.5h4M9 9.5v4" /><circle cx="16" cy="11.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
