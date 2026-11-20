// lib/discord.ts: only a note with a player line is posted, never pings, play link always there.
import assert from "node:assert/strict";
import { updatePost, playerTitle, sendUpdate } from "../../lib/discord";
assert.equal(updatePost({ version: "0.1", title: "Leo's patch notes: X", author: "Leo" }), null);
const p = updatePost({ version: "0.140", title: "Leo's patch notes: The Knowitball Discord", author: "Leo", discord: "We have a Discord now." })!;
assert.deepEqual(p.allowed_mentions.parse, []);
const e = p.embeds[0] as { title: string; description: string; footer: { text: string } };
assert.equal(e.title, "🆕 The Knowitball Discord");
assert.ok(e.description.includes("https://knowitball.co.uk"));
assert.ok(e.footer.text.includes("0.140"));
assert.equal(playerTitle("Harry's patch notes v0.60h: Run"), "Run");
assert.equal(await sendUpdate({ version: "1", title: "t", author: "Leo", discord: "x" }, undefined), "no-webhook");
assert.equal(await sendUpdate({ version: "1", title: "t", author: "Leo" }, "https://example.invalid"), "not-for-players");
console.log("discordUpdates: ok");
