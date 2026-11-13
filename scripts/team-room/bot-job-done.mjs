#!/usr/bin/env node
/**
 * scripts/team-room/bot-job-done.mjs — a Claude chat tells the Team room
 * thread what it did with a job its owner's bot handed on (13 Nov 2026).
 *
 *   node scripts/team-room/bot-job-done.mjs <job number> <token> "one or two plain sentences"
 *
 * The number and token come with the job (scripts/hooks/bot-jobs-hook.mjs).
 * The words appear in the thread as "<Name>'s Claude replied". Once per job.
 */
const [id, token, ...rest] = process.argv.slice(2);
const text = rest.join(" ").trim();
if (!id || !token || !text) { console.error('Use: node scripts/team-room/bot-job-done.mjs <job number> <token> "what was done"'); process.exit(1); }
const url = (process.env.DEV_BOT_JOBS_DONE_URL || "https://knowitball.co.uk/api/dev-bot-jobs/done").trim();
try {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: Number(id), token, text }), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.ok) console.log("Posted in the thread.");
  else { console.error(`Not posted: ${j.error ?? r.status}`); process.exit(1); }
} catch (e) { console.error(`Could not reach the site: ${e.message}`); process.exit(1); }
