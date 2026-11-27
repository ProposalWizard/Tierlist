---
id: FACT-DAT-015
type: fact
client: dat
tags: [data]
status: live
date: 2026-11-27
source: "supabase/migrations/star_perf_samples.sql:9-23"
summary: star_perf_samples.sql is PENDING (NOT RUN); until it runs the speed recorder's Supabase inserts get a 404 and stop quietly, PostHog still gets them.
---
Run it in the Supabase SQL Editor. It also adds a nightly job that deletes samples older than 30 days.
