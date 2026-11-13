import type { Metadata } from "next";

/** The public home's page details (search engines, shared links). */
const TITLE = "Knowitball: Road to the Golden Ball and more football games";
const DESCRIPTION =
  "Play Road to the Golden Ball, a football career game, in your browser. Plus Draft, Tic Tac Toe, Ten-A-Ball, Rankings and Blind Rankings.";
const OG_IMAGE = { url: "/home/site/og.jpg", width: 1200, height: 630, alt: "Road to the Golden Ball: your player in the stadium" };

export const HOME_METADATA: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Lets a phone or computer offer "Install" for the game from the home page.
  manifest: "/star-app.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Knowitball",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};
