import { withSentryConfig } from "@sentry/nextjs/config";

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
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
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
