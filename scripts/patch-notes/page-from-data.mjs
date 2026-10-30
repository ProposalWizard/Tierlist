#!/usr/bin/env node
/**
 * scripts/patch-notes/page-from-data.mjs — A STANDARD PAGE FOR A NOTE THAT HAS NONE.
 *
 * Some notes in the archive exist only as data in lib/patchNotesData.ts. This
 * writes patch-notes/pages/<version>/index.html for each version given, in the
 * house style (.claude/skills/artifact-house-style): dot headings, one bold
 * line + one thin line per item, before/after bars, closed toggles, the
 * numbers in one closed toggle at the bottom. Then add the version to
 * lib/patchNotePages.ts so the archive opens it.
 *
 *   node scripts/patch-notes/page-from-data.mjs 0.52 0.51
 *
 * The data file is read as plain data: the BUILT_IN_PATCH_NOTES array literal
 * is sliced out and evaluated. Every string is escaped before it goes on the
 * page.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "lib/patchNotesData.ts");
const MADE_ON = "26 Oct 2026";

function loadNotes() {
  const src = fs.readFileSync(DATA, "utf8");
  const start = src.indexOf("[", src.indexOf("BUILT_IN_PATCH_NOTES"));
  const end = src.lastIndexOf("];");
  if (start < 0 || end < start) throw new Error("BUILT_IN_PATCH_NOTES array not found");
  return new Function(`return ${src.slice(start, end + 1)};`)();
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function ukTime(iso, withDate = true) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return withDate ? `${date}, ${time} UK time` : `${time} UK time`;
}

const KIND = {
  fixed: { cls: "fix", label: "Fixed" },
  added: { cls: "add", label: "Added" },
  changed: { cls: "chg", label: "Changed" },
  known: { cls: "bug", label: "Known issues" },
  next: { cls: "nxt", label: "Next" },
  history: { cls: "nxt", label: "Previous versions" },
};

const fmt = (n, unit) => {
  const v = Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
  if (!unit) return v;
  return unit === "%" ? `${v}%` : `${v} ${unit}`;
};

function barHtml(b) {
  const scale = Math.max(Math.abs(b.was), Math.abs(b.now), Math.abs(b.target ?? 0)) || 1;
  const pc = (x) => `${Math.max(0, Math.min(100, (Math.abs(x) / scale) * 100)).toFixed(1)}%`;
  const tone = b.state === "warn" ? " warn" : b.state === "bad" ? " bad" : "";
  return `<div class="bar"><div class="bl">${esc(b.label)}</div><div class="track"><div class="fill was" style="width:${pc(b.was)}"></div><div class="fill now${tone}" style="width:${pc(b.now)}"></div></div><div class="vv"><s>${esc(fmt(b.was, b.unit))}</s> ${esc(fmt(b.now, b.unit))}</div></div>`;
}

function itemHtml(it) {
  const pill = it.pill ? `<span class="pill ${it.pill.tone === "red" ? "p-red" : "p-amb"}">${esc(it.pill.text)}</span>` : "";
  const detail = it.detail ? `<p class="dt">${esc(it.detail)}</p>` : "";
  const bars = it.bars?.length ? `<div class="bars">${it.bars.map(barHtml).join("")}</div>` : "";
  const more = it.more
    ? `<details><summary>${esc(it.more.summary)}</summary><ul>${(it.more.points || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul></details>`
    : "";
  return `<div class="item${it.alert ? " alert" : ""}"><div class="ih"><b>${esc(it.title)}</b>${pill}</div>${detail}${bars}${more}</div>`;
}

const isCheckSection = (s) => /^check these$/i.test((s.title || "").trim());

function sectionHtml(s) {
  const k = KIND[s.kind] || KIND.changed;
  const t = (s.title || "").trim();
  const head = !t || t.toLowerCase() === k.label.toLowerCase() ? k.label : `${k.label} · ${t}`;
  return `<h2 class="${k.cls}"><i></i>${esc(head)}</h2>\n${s.items.map(itemHtml).join("\n")}`;
}

function pageHtml(n) {
  const title = (n.title || "").replace(/^[^:]*patch notes:\s*/i, "") || `Patch notes ${n.version}`;
  const ups = n.updates || [];
  const lastUp = ups.length ? ups[ups.length - 1] : null;
  const upAt = n.updatedAt || lastUp?.at;
  const upNote = n.updateNote || lastUp?.note;
  const updated = upAt && upNote ? `<p class="upd">Updated ${esc(ukTime(upAt))}: ${esc(upNote)}</p>` : "";

  const first = n.sections[0];
  const checks = first?.items?.length
    ? `<h2 class="nxt"><i></i>Check these</h2>\n<ul class="ck">${first.items
        .map(
          (it, i) =>
            `<li><label><input type="checkbox" data-k="c${i}"><span><span class="q">${esc(it.title)}</span>${
              isCheckSection(first) && it.detail ? `<span class="a">${esc(it.detail)}</span>` : ""
            }</span></label></li>`,
        )
        .join("")}</ul>`
    : "";

  const body = n.sections.filter((s, i) => !(i === 0 && isCheckSection(s))).map(sectionHtml).join("\n");

  const stats = n.stats?.length
    ? `<details class="nums"><summary>The numbers</summary><ul>${n.stats
        .map((s) => `<li><b>${esc(s.value)}</b> ${esc(s.label)}</li>`)
        .join("")}</ul></details>`
    : "";

  const v = esc(n.version);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Patch notes v${v}</title>
<style>
:root{
  --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
  --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
  --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
  --gbg:rgba(61,220,132,.14);--abg:rgba(245,185,66,.14);--rbg:rgba(255,107,107,.14);--bbg:rgba(111,184,255,.14);
  --pill:#3ddc84;--pillink:#06170e;--r:12px;
  color-scheme:dark;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --bg:#f4f7f5;--card:#ffffff;--card2:#eef3f0;--line:#dae4de;
    --ink:#0e1613;--ink2:#3f564c;--ink3:#5f766b;
    --green:#0b7a43;--amber:#8f6200;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
    --gbg:rgba(11,122,67,.11);--abg:rgba(143,98,0,.12);--rbg:rgba(198,40,40,.10);--bbg:rgba(21,101,192,.10);
    --pill:#0b7a43;--pillink:#ffffff;
    color-scheme:light;
  }
}
:root[data-theme="light"]{
  --bg:#f4f7f5;--card:#ffffff;--card2:#eef3f0;--line:#dae4de;
  --ink:#0e1613;--ink2:#3f564c;--ink3:#5f766b;
  --green:#0b7a43;--amber:#8f6200;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
  --gbg:rgba(11,122,67,.11);--abg:rgba(143,98,0,.12);--rbg:rgba(198,40,40,.10);--bbg:rgba(21,101,192,.10);
  --pill:#0b7a43;--pillink:#ffffff;
  color-scheme:light;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;overflow-wrap:anywhere}
.wrap{max-width:760px;margin:0 auto;padding-block:0 64px;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header{padding:30px 0 4px}
.ver{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;background:var(--pill);color:var(--pillink);padding:4px 10px;border-radius:999px}
h1{font-size:clamp(24px,6.6vw,34px);line-height:1.12;margin:12px 0 10px;letter-spacing:-.02em;text-wrap:balance}
.by{color:var(--ink3);font-size:13px;margin:0 0 4px}
.upd{color:var(--green);font-size:13px;margin:0 0 4px}
.lead{color:var(--ink2);font-size:15px;margin:14px 0 0}
h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;margin:34px 0 12px;display:flex;align-items:center;gap:9px}
h2 i{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
h2.fix{color:var(--green)} h2.fix i{background:var(--green)}
h2.add{color:var(--blue)} h2.add i{background:var(--blue)}
h2.chg{color:var(--violet)} h2.chg i{background:var(--violet)}
h2.bug{color:var(--amber)} h2.bug i{background:var(--amber)}
h2.nxt{color:var(--ink3)} h2.nxt i{background:var(--ink3)}
.ck{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r)}
.ck li{padding:11px 14px;border-bottom:1px solid var(--line)}
.ck li:last-child{border-bottom:0}
.ck label{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;cursor:pointer}
.ck input{width:18px;height:18px;margin:3px 0 0;accent-color:var(--green)}
.ck .q{font-weight:700;display:block}
.ck .a{display:block;color:var(--ink3);font-size:13.5px;margin-top:2px}
.item{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:0 0 12px;min-width:0}
.item.alert{border-left:4px solid var(--red)}
.ih{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.ih b{font-size:16px;line-height:1.3;min-width:0}
.dt{margin:6px 0 0;color:var(--ink2);font-size:14.5px}
.pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;white-space:nowrap}
.p-red{background:var(--rbg);color:var(--red)} .p-amb{background:var(--abg);color:var(--amber)}
.bars{margin:8px 0 2px}
.bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center;padding:5px 0;font-size:13px}
.bar .bl{grid-column:1/-1;color:var(--ink2)}
.track{position:relative;height:19px;background:var(--card2);border-radius:4px;overflow:hidden;min-width:0}
.fill{position:absolute;left:0;height:8px;border-radius:3px}
.fill.was{top:1px;background:var(--ink3);opacity:.55}
.fill.now{bottom:1px;background:var(--green);opacity:.9}
.fill.now.warn{background:var(--amber)}
.fill.now.bad{background:var(--red)}
.vv{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap;font-size:12.5px}
.vv s{color:var(--ink3);font-weight:400;opacity:.9}
details{background:var(--card2);border:1px solid var(--line);border-radius:var(--r);padding:0 14px;margin:10px 0 0}
details.nums{background:var(--card);margin-top:34px}
details[open]{padding-bottom:12px}
summary{cursor:pointer;list-style:none;padding:11px 0;font-size:13px;font-weight:700;color:var(--ink3);display:flex;align-items:center;gap:7px}
summary::-webkit-details-marker{display:none}
summary::before{content:"\\25B8";display:inline-block;color:var(--ink3);transition:transform .15s}
details[open]>summary::before{transform:rotate(90deg)}
details ul{margin:0;padding-left:18px;color:var(--ink2);font-size:14px}
details li{margin-bottom:6px}
details li b{color:var(--ink)}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}
</style>
</head>
<body>
<div class="wrap">
<header>
  <span class="ver">v${v}</span>
  <h1>${esc(title)}</h1>
  <p class="by">Made by ${esc(n.author || "the team")} &middot; ${esc(ukTime(n.publishedAt))}</p>
  ${updated}
  ${n.summary ? `<p class="lead">${esc(n.summary)}</p>` : ""}
</header>
${checks}
${body}
${stats}
<footer>${process.env.PN_FOOTER ?? `Made from the archive data on ${MADE_ON} (this note had no page)`}</footer>
</div>
<script>
(function(){
  var K="kib-pn-${v}-checks", s={};
  try{ s=JSON.parse(localStorage.getItem(K)||"{}")||{}; }catch(e){ s={}; }
  var boxes=document.querySelectorAll(".ck input");
  for(var i=0;i<boxes.length;i++){(function(b){
    var id=b.getAttribute("data-k"); if(s[id]) b.checked=true;
    b.addEventListener("change",function(){ s[id]=b.checked; try{ localStorage.setItem(K,JSON.stringify(s)); }catch(e){} });
  })(boxes[i]);}
})();
</script>
</body>
</html>
`;
}

const versions = process.argv.slice(2);
if (!versions.length) {
  console.error("Usage: node scripts/patch-notes/page-from-data.mjs <version> [version...]");
  process.exit(1);
}
const notes = loadNotes();
let bad = 0;
for (const ver of versions) {
  const n = notes.find((x) => x.version === ver);
  if (!n) {
    console.error(`No note ${ver} in lib/patchNotesData.ts`);
    bad++;
    continue;
  }
  const out = path.join(ROOT, "patch-notes/pages", ver, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pageHtml(n));
  console.log(`wrote ${path.relative(ROOT, out)}`);
}
process.exit(bad ? 1 : 0);
