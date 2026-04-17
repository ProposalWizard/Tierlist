/**
 * app/robots.ts
 *
 * Next.js 14 auto-generates /robots.txt from this file.
 * Tells search engine crawlers which pages they can and can't access.
 *
 * Allowed: all public pages (home, find, legal, play/*, vote/*)
 * Disallowed:
 *  - /admin        — admin panel, must never be indexed
 *  - /api/*        — API routes, not pages
 *  - /auth/*       — login / OAuth callback
 *  - /profile/*    — user-specific pages
 *  - /create       — auth-gated, not useful to index
 */

import type { MetadataRoute } from "next";

const BASE_URL = "https://knowitball.co.uk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/auth/", "/profile", "/create"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
