---
id: FACT-UI-027
type: fact
client: ui
tags: [economy, ui]
status: live
date: 2026-11-28
source: "components/star/ThreeDNotice.tsx:8-20"
summary: When the browser gives the page no WebGL, the game says so once per visit (bottom notice with the fix steps) instead of silently showing the flat garden, shop and house.
---
27 Nov 2026: Mikey saw the flat garden on his computer and phone; Chrome's chrome://gpu said "WebGL: Disabled, hardware acceleration disabled" (Chrome 157, relaunch brought 158 and fixed it; the phone fixed itself later without a restart). Console: "THREE.WebGLRenderer: A WebGL context could not be created". The 3D garden falls back to the drawn GardenScreen on any start error (Garden3D.tsx). ThreeDNotice (mounted in app/star-dev/layout.tsx) probes WebGL 2.5 s after the game opens (webglProbe.ts); if none, it shows the notice with three steps (reopen the browser, turn graphics acceleration on, update browser and driver); "Got it" hides it for the visit (sessionStorage). No counter: PostHog is wired but its key is not set in Vercel (checked 27 Nov: no website events in 30 days).
