/**
 * The feed-bench save (scripts/feed-bench/seed.mts: N matches, real goal
 * recordings) made with Football Twitter ON, for the stills.
 *   npx tsx scripts/football-twitter/seed.mts [matches=20] [out=/tmp/feed-seed-ft.json]
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";

setMediaUpdate({ footballTwitter: true });
process.argv[2] ??= "20";
process.argv[3] ??= "/tmp/feed-seed-ft.json";
await import("../feed-bench/seed.mts");
