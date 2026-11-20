// Send one command to drive.mjs:  node phone/tools/playtest/cmd.mjs '<js body>'   (PT_PORT, default 7777)
const body = process.argv.slice(2).join(" ") || "return 'ping'";
const r = await fetch(`http://127.0.0.1:${process.env.PT_PORT || 7777}/`, { method: "POST", body });
console.log(await r.text());
