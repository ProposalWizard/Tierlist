---
id: FACT-3D-003
type: fact
client: 3d
tags: [admin, team, three-d]
status: live
date: 2026-11-27
source: "lib/star/perfSample.ts:6-14"
summary: The speed recorder sends a sample every 5 s for team accounts (admins, testers) and ?fps=1 phones only, at most 2 hours a tab; read it with scripts/perf-report.mts.
---
Each sample: screen, 3D place, recent taps, fps, worst frame, draws, pixel ratio, rung, GPU, device. Supabase star_perf_samples plus PostHog perf_sample. The pure rules: lib/star/perfSample.ts; the browser half: lib/star/perfRecorder.ts.
