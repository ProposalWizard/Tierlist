#!/usr/bin/env node
/**
 * scripts/discord/setup-server.mjs — build the Knowitball Discord from
 * blueprint.json (Leo, 19 Nov 2026). Read README.md first.
 *
 *   node scripts/discord/setup-server.mjs --guild <server id>            # look only: prints what it WOULD make
 *   node scripts/discord/setup-server.mjs --guild <server id> --apply    # make the missing roles + channels, post the welcome
 *   ... --apply --community     # also switch on Community (rules channel, updates channel, safety levels)
 *   ... --apply --onboarding    # also set Onboarding (the two "pick your games / pings" questions); needs Community
 *
 * Needs a bot in the server with Administrator (or Manage Roles + Manage
 * Channels + Manage Webhooks + Manage Server). Token: DISCORD_BOT_TOKEN, or
 * none when the cloud session's network secret for discord.com adds it.
 *
 * Safe to run again: everything is matched by name and only what is missing is
 * made. Messages are posted only into channels it made in the same run.
 * Prints the #updates webhook URL ONCE (when it makes it): put it in Vercel as
 * DISCORD_UPDATES_WEBHOOK. Never commit it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BP = JSON.parse(readFileSync(join(here, "blueprint.json"), "utf8"));
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has = (k) => args.includes(k);
const GUILD = arg("--guild");
const APPLY = has("--apply");
if (!GUILD) { console.error("Give the server id: --guild <id> (Discord: Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID)."); process.exit(1); }

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN || "proxy-adds-it";
const T = { text: 0, voice: 2, category: 4, announcement: 5, stage: 13, forum: 15 };
const VIEW = 1n << 10n, SEND = 1n << 11n, SEND_THREADS = 1n << 38n;

async function api(method, path, body) {
  for (let tries = 0; tries < 5; tries++) {
    const r = await fetch(API + path, {
      method,
      headers: { authorization: `Bot ${TOKEN}`, "content-type": "application/json", "user-agent": "KnowitballSetup (https://knowitball.co.uk, 1.0)" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise((s) => setTimeout(s, Math.ceil((j.retry_after ?? 1) * 1000) + 100)); continue; }
    const text = await r.text();
    const json = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 300)}`);
    return json;
  }
  throw new Error(`${method} ${path}: rate limited 5 times`);
}

const hex = (c) => (c ? parseInt(c.replace("#", ""), 16) : 0);
const log = (s) => console.log(s);
const plan = [];

const guild = await api("GET", `/guilds/${GUILD}`);
log(`Server: ${guild.name} (${GUILD})${APPLY ? "" : "  — LOOK ONLY, add --apply to make things"}`);
const everyone = GUILD; // the @everyone role id is the server id

// ── Roles ──
const roles = await api("GET", `/guilds/${GUILD}/roles`);
const roleId = {};
for (const r of BP.roles) {
  const found = roles.find((x) => x.name === r.name);
  if (found) { roleId[r.key] = found.id; continue; }
  plan.push(`role  ${r.name}`);
  if (APPLY) {
    const made = await api("POST", `/guilds/${GUILD}/roles`, { name: r.name, color: hex(r.color), hoist: !!r.hoist, mentionable: !!r.mentionable, permissions: "0" });
    roleId[r.key] = made.id;
  }
}

// ── Channels ──
const chans = await api("GET", `/guilds/${GUILD}/channels`);
const chanId = {};
const madeNow = new Set();
let webhookUrl = null;
const community = (guild.features ?? []).includes("COMMUNITY");

function overwrites(c) {
  const ow = [];
  if (c.private) {
    ow.push({ id: everyone, type: 0, allow: "0", deny: String(VIEW) });
    for (const k of c.private) if (roleId[k]) ow.push({ id: roleId[k], type: 0, allow: String(VIEW | SEND), deny: "0" });
  } else if (c.readOnly) {
    ow.push({ id: everyone, type: 0, allow: "0", deny: String(SEND | SEND_THREADS) });
    for (const k of ["staff", "mod"]) if (roleId[k]) ow.push({ id: roleId[k], type: 0, allow: String(SEND), deny: "0" });
  }
  return ow;
}

for (const cat of BP.categories) {
  let catId = chans.find((x) => x.type === T.category && x.name === cat.name)?.id;
  if (!catId) {
    plan.push(`category  ${cat.name}`);
    if (APPLY) catId = (await api("POST", `/guilds/${GUILD}/channels`, { name: cat.name, type: T.category })).id;
  }
  for (const c of cat.channels) {
    const want = T[c.type ?? "text"];
    const found = chans.find((x) => x.name === c.name && x.type !== T.category);
    if (found) { chanId[c.key] = found.id; continue; }
    // Announcement and forum channels need Community; without it they become ordinary text channels.
    const type = (want === T.announcement || want === T.forum) && !community && !has("--community") ? T.text : want;
    plan.push(`channel  #${c.name}  (${Object.keys(T).find((k) => T[k] === type)}) in ${cat.name}`);
    if (!APPLY) continue;
    const body = { name: c.name, type, parent_id: catId, permission_overwrites: overwrites(c) };
    if (c.topic && type !== T.voice) body.topic = c.topic;
    let made;
    try { made = await api("POST", `/guilds/${GUILD}/channels`, body); }
    catch (e) { if (type !== T.text && type !== T.voice) { made = await api("POST", `/guilds/${GUILD}/channels`, { ...body, type: T.text }); log(`  (#${c.name} made as a text channel: ${e.message.slice(0, 80)})`); } else throw e; }
    chanId[c.key] = made.id;
    madeNow.add(c.key);
  }
}

// ── Webhook for #updates ──
for (const cat of BP.categories) for (const c of cat.channels) {
  if (!c.webhook) continue;
  if (!chanId[c.key]) { plan.push(`webhook  ${c.webhook} in #${c.name}`); continue; }
  const hooks = await api("GET", `/channels/${chanId[c.key]}/webhooks`);
  if (hooks.some((h) => h.name === c.webhook)) continue;
  plan.push(`webhook  ${c.webhook} in #${c.name}`);
  if (APPLY) { const h = await api("POST", `/channels/${chanId[c.key]}/webhooks`, { name: c.webhook }); webhookUrl = `https://discord.com/api/webhooks/${h.id}/${h.token}`; }
}

// ── Welcome messages (only into channels made this run, so nothing is posted twice) ──
const fill = (s) => s.replace(/<#(\w+)>/g, (m, k) => (chanId[k] ? `<#${chanId[k]}>` : `#${k}`));
for (const [key, embeds] of Object.entries(BP.messages)) {
  if (!madeNow.has(key) && chanId[key]) continue;
  plan.push(`post  ${embeds.length} message(s) in #${key}`);
  if (!APPLY || !chanId[key]) continue;
  for (const e of embeds) await api("POST", `/channels/${chanId[key]}/messages`, { embeds: [{ title: e.title, description: fill(e.description), color: hex(e.color) }], allowed_mentions: { parse: [] } });
}

// ── Community ──
if (has("--community") && !community) {
  plan.push("switch on Community (rules: #rules, team updates: #mod-log, members must have a verified email, scan all media)");
  if (APPLY) await api("PATCH", `/guilds/${GUILD}`, { features: [...(guild.features ?? []), "COMMUNITY"], rules_channel_id: chanId.rules, public_updates_channel_id: chanId.modlog, verification_level: 1, explicit_content_filter: 2 });
}

// ── Onboarding ──
if (has("--onboarding")) {
  plan.push(`onboarding: ${BP.onboarding.prompts.length} questions, ${BP.onboarding.defaultChannels.length} default channels`);
  if (APPLY) {
    let n = BigInt(Date.now() - 1420070400000) << 22n; // fresh snowflake-shaped ids
    const id = () => String(n++);
    const prompts = BP.onboarding.prompts.map((p) => ({
      id: id(), type: 0, title: p.title, single_select: !!p.single, required: false, in_onboarding: true,
      options: p.options.map((o) => ({ id: id(), title: o.title, description: o.description, emoji: { name: o.emoji }, role_ids: o.roles.map((k) => roleId[k]).filter(Boolean), channel_ids: o.channels.map((k) => chanId[k]).filter(Boolean) })),
    }));
    await api("PUT", `/guilds/${GUILD}/onboarding`, { prompts, default_channel_ids: BP.onboarding.defaultChannels.map((k) => chanId[k]).filter(Boolean), enabled: true, mode: 0 });
  }
}

log(plan.length ? `\n${APPLY ? "Made" : "Would make"} (${plan.length}):\n  ${plan.join("\n  ")}` : "\nNothing missing: the server matches the blueprint.");
if (webhookUrl) log(`\n#updates webhook (put in Vercel as DISCORD_UPDATES_WEBHOOK, never in git):\n${webhookUrl}`);
