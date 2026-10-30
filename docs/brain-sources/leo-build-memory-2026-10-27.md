# Vercel build ran out of memory (Leo's chat, 27 Oct 2026)

The deploy of b8e0abc7 (PR #810, keeper catches) failed on Vercel.
Reproduced locally: `next build` at Node's default heap (about 2.2 GB here)
runs out of memory on b8e0abc7 AND on 738dd0fd before it, so the build was
already at the edge. Fix (PR #811, 5d771856): package.json runs
`node --max-old-space-size=6144 node_modules/next/dist/bin/next build`.
A plain `npm run build` then passes; peak about 6.5 GB across next's
processes (Vercel's build machine has 8 GB). Deploy of 5d771856: success.
