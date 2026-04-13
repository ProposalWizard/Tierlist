/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
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
    return [
      {
        source: "/play/:id*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/vote/:id*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
