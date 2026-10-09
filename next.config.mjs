import { withSentryConfig } from "@sentry/nextjs/config";
import { writeAssetVersions } from "./scripts/perf3d/asset-versions.mjs";

// The 3D files' content hashes (lib/star/three3d/assetVersions.ts), refreshed
// at every build and dev start so the deployed list always matches the
// deployed files: the 3D loaders ask for /star/x?v=<hash>, served below as
// immutable (lib/star/three3d/assetUrl.ts). Never fails the build.
try { writeAssetVersions(); } catch (e) { console.warn("asset versions not refreshed:", e?.message ?? e); }

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "http", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "cagkgfketucousksgtbk.supabase.co" },
    ],
  },
  experimental: {
    optimizePackageImports: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "@supabase/supabase-js"],
    // instrumentation.ts (Sentry's server/edge init) is still opt-in on
    // Next.js 14 — stable without this flag from 15 on.
    instrumentationHook: true,
    // The patch notes archive shows each version's kept artifact page, read
    // from patch-notes/ at request time (lib/patchNotePageServe.ts). Files a
    // route reads by a computed path are not traced into the serverless
    // bundle on their own, so the folder is listed here or Vercel 404s them.
    outputFileTracingIncludes: {
      "/api/admin/patch-notes/page": ["./patch-notes/**/*"],
      "/api/admin/patch-notes/file/[...path]": ["./patch-notes/**/*"],
    },
  },
  // face-api.js depends on node-fetch (which needs 'encoding') and
  // references 'fs' for model loading.  Neither is needed at build
  // time or on the server — face detection runs purely client-side.
  // Tell webpack to replace these with empty stubs so the build
  // doesn't fail on Vercel.
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      encoding: false,
    };
    return config;
  },
  // Prevent Vercel CDN / browser from caching dynamic pages.
  // Ensures logged-in and logged-out users always get fresh data.
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // camera=(self): the star career photo picker's "Take a photo" needs the
      // camera on this origin (webcam via getUserMedia, phone camera via a
      // capture input). `camera=()` blocked both outright, on every page —
      // still denied to any embedded third-party frame.
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // A 3D file asked for by its content hash (/star/x.glb?v=1a2b3c4d,
        // lib/star/three3d/assetUrl.ts) never changes: keep it a year, never
        // ask again. Without ?v= it keeps the default (ask every time).
        source: "/star/:path*",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/play/:id*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/vote/:id*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/admin",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

// Wraps the build with Sentry's webpack plugin for source-map upload —
// harmless without SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN set (it just
// skips the upload with a warning rather than failing the build), so this
// is safe to ship before those exist. `silent: true` keeps that warning out
// of normal build output; set it to false locally if source maps aren't
// uploading and the reason isn't obvious.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
