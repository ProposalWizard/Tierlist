// Send one command to the live bench (live.mjs).
//   node phone/tools/playtest/pt.mjs <cmd> '{"name":"p", ...}'
//   PT_PORT=7788 by default.
const [cmd, json] = process.argv.slice(2);
const body = JSON.stringify({ cmd, ...(json ? JSON.parse(json) : {}) });
const r = await fetch(`http://127.0.0.1:${process.env.PT_PORT || 7788}/cmd`, { method: "POST", body });
const out = await r.json();
if (out.text) { console.log(out.text.replace(/\n{2,}/g, "\n").slice(0, Number(process.env.PT_MAX || 1500))); delete out.text; }
if (Object.keys(out).length) console.log(JSON.stringify(out));
