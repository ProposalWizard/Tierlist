/**
 * scripts/patch-notes-artifact.mts
 *
 * Turn one version out of lib/patchNotesData.ts into a standalone HTML page,
 * ready to publish as a claude.ai artifact.
 *
 *   npx tsx scripts/patch-notes-artifact.mts 0.3 > /tmp/v0.3.html
 *
 * WHY THIS EXISTS. The archive at /admin/patch-notes and the shared artifact
 * are two surfaces for one set of notes. Written by hand they drift — one
 * gets a correction, the other keeps the old number, and nobody can tell
 * which is right. Generating the artifact from the SAME array the archive
 * renders makes that impossible: there is one copy of the words.
 *
 * The visual target is Harry's own v0.1 artifact, kept at
 * .claude/skills/artifact-house-style/references/patch-notes-v0.1.html —
 * the CSS below is lifted from it so a generated page is recognisably the
 * same thing. Figures/screenshots are NOT generated: a page that needs one
 * gets it added by hand afterwards, since there is no image to point at
 * inside the data model.
 */

import { BUILT_IN_PATCH_NOTES } from "../lib/patchNotesData";
import { DEMOS, DEMO_CSS } from "./patchNotesDemos";
import {
  barGroupCeiling,
  barWidths,
  formatBarValue,
  formatPatchDate,
  SECTION_DEFAULT_TITLE,
  type PatchBar,
  type PatchItem,
  type PatchNote,
  type PatchSection,
  type PatchSectionKind,
} from "../lib/patchNotes";

/** The template's own class per section colour. */
const SECTION_CLASS: Record<PatchSectionKind, string> = {
  fixed: "fix",
  added: "add",
  changed: "chg",
  known: "bug",
  next: "nxt",
  history: "nxt",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bar(b: PatchBar, ceiling: number): string {
  const w = barWidths(b, ceiling);
  const tone = b.state === "good" ? "" : ` ${b.state}`;
  return (
    `      <div class="bar"><span class="lb">${esc(b.label)}</span>` +
    `<div class="track">` +
    `<div class="fill was" style="width:${w.was.toFixed(1)}%"></div>` +
    `<div class="fill now${tone}" style="width:${w.now.toFixed(1)}%"></div>` +
    `</div>` +
    `<span class="vv">${esc(formatBarValue(b.now, b.unit))} ` +
    `<s>${esc(formatBarValue(b.was, b.unit))}</s></span></div>`
  );
}

function item(it: PatchItem): string {
  // An alert is the red left-bordered callout, not a list row — same split
  // the archive component makes.
  if (it.alert) {
    return [
      `  <li>`,
      `    <div class="alert">`,
      `      <div class="t">${esc(it.title)}</div>`,
      it.detail ? `      <p>${esc(it.detail)}</p>` : null,
      `    </div>`,
      it.more ? more(it.more) : null,
      `  </li>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const pill = it.pill
    ? ` <span class="pill ${it.pill.tone === "red" ? "p-red" : "p-amb"}">${esc(it.pill.text)}</span>`
    : "";

  const bars = it.bars?.length
    ? [`    <div class="bars">`, ...it.bars.map((b) => bar(b, barGroupCeiling(it.bars!))), `    </div>`].join("\n")
    : null;

  // A named demo that isn't in DEMOS is a typo in the data, and silently
  // dropping it would hide it — so it fails the build instead.
  let demo: string | null = null;
  if (it.demo) {
    if (!DEMOS[it.demo]) throw new Error(`item "${it.title}" names demo "${it.demo}", which does not exist`);
    demo = DEMOS[it.demo];
  }

  return [
    `  <li>`,
    `    <div class="hd">${esc(it.title)}${pill}</div>`,
    it.detail ? `    <div class="dt">${esc(it.detail)}</div>` : null,
    bars,
    demo,
    it.more ? more(it.more) : null,
    `  </li>`,
  ]
    .filter(Boolean)
    .join("\n");
}

function more(m: { summary: string; points: string[] }): string {
  return [
    `    <details><summary>${esc(m.summary)}</summary>`,
    `      <ul>`,
    ...m.points.map((p) => `        <li>${esc(p)}</li>`),
    `      </ul>`,
    `    </details>`,
  ].join("\n");
}

function section(s: PatchSection): string {
  const cls = SECTION_CLASS[s.kind];
  const title = s.title || SECTION_DEFAULT_TITLE[s.kind];
  return [
    ``,
    `<h2 class="${cls}"><i></i>${esc(title)}</h2>`,
    `<ul class="n">`,
    ...s.items.map(item),
    `</ul>`,
  ].join("\n");
}

/**
 * The page body.
 *
 * Emitted WITHOUT doctype/html/head/body on purpose: the Artifact publisher
 * wraps the file in its own skeleton, so a second one would nest. `--full`
 * adds a minimal wrapper for opening the file locally.
 */
function page(note: PatchNote): string {
  const stats = note.stats
    .map((s) => `  <div class="s"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
    .join("\n");

  const usesDemos = note.sections.some((s) => s.items.some((i) => i.demo));

  return `<title>Knowitball v${esc(note.version)}</title>
<style>
${STYLE}${usesDemos ? "\n" + DEMO_CSS : ""}
</style>

<div class="wrap">

<header>
  <span class="ver">v${esc(note.version)}</span>
  <h1>${esc(note.title)}</h1>
  <p class="sub">${note.summary ? esc(note.summary) : ""}</p>
</header>

${note.stats.length ? `<div class="strip">\n${stats}\n</div>` : ""}
${note.sections.map(section).join("\n")}

<footer>${esc(formatPatchDate(note.publishedAt))} · also at <code>/admin/patch-notes</code>, generated from the same file. Anything unverified says so.</footer>

</div>
`;
}

/** Lifted verbatim from the v0.1 artifact so a generated page matches it. */
const STYLE = `  :root{
    --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
    --r:12px;
  }
  @media (prefers-color-scheme: light){
    :root:not([data-theme="dark"]){
      --bg:#f4f7f5;--card:#fff;--card2:#eef3f0;--line:#dae4de;
      --ink:#0e1613;--ink2:#4a6157;--ink3:#6b8176;
      --green:#0f9d58;--amber:#a8730a;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
    }
  }
  :root[data-theme="dark"]{
    --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
  }
  /* The v0.1 artifact's CSS stopped at the two rules above, which leaves one
     real gap: a reader on a DARK system who explicitly picks light stamps
     data-theme="light", and prefers-color-scheme still reports dark — so the
     light block never matches and the page stays dark against their choice.
     This repeats the light palette for that stamp. */
  :root[data-theme="light"]{
    --bg:#f4f7f5;--card:#fff;--card2:#eef3f0;--line:#dae4de;
    --ink:#0e1613;--ink2:#4a6157;--ink3:#6b8176;
    --green:#0f9d58;--amber:#a8730a;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden}
  body{background:var(--bg);color:var(--ink);
    font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:760px;margin:0 auto;padding:0 16px 70px}

  header{padding:38px 0 4px}
  .ver{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;
    background:var(--green);color:#06170e;padding:4px 10px;border-radius:999px}
  h1{font-size:clamp(28px,7.5vw,40px);line-height:1.05;margin:12px 0 8px;letter-spacing:-.025em}
  .sub{color:var(--ink3);font-size:13.5px;margin:0 0 24px}

  .strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:9px;margin:0 0 30px}
  .s{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:13px}
  .s b{display:block;font-size:clamp(19px,4.6vw,25px);font-weight:800;letter-spacing:-.02em;color:var(--green);line-height:1.1}
  .s span{display:block;font-size:11.5px;color:var(--ink3);margin-top:6px;line-height:1.35}

  h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;
    margin:36px 0 12px;display:flex;align-items:center;gap:9px}
  h2 i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;font-style:normal}
  .fix i{background:var(--green)} .fix{color:var(--green)}
  .add i{background:var(--blue)} .add{color:var(--blue)}
  .chg i{background:var(--violet)} .chg{color:var(--violet)}
  .bug i{background:var(--amber)} .bug{color:var(--amber)}
  .nxt i{background:var(--ink3)} .nxt{color:var(--ink3)}

  ul.n{list-style:none;margin:0;padding:0}
  ul.n>li{padding:11px 0;border-bottom:1px solid var(--line)}
  ul.n>li:last-child{border-bottom:0}
  .hd{font-weight:700;color:var(--ink)}
  .dt{color:var(--ink2);font-size:14px;margin-top:3px}
  .dt b{color:var(--ink)}

  .bars{margin:9px 0 2px}
  .bar{display:grid;grid-template-columns:minmax(78px,96px) 1fr auto;gap:9px;align-items:center;
    padding:3px 0;font-size:13px}
  .bar .lb{color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .track{position:relative;height:16px;background:var(--card2);border-radius:4px;overflow:hidden}
  .fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
  .fill.was{background:var(--line)}
  .fill.now{background:var(--green);opacity:.85}
  .fill.now.bad{background:var(--red)}
  .fill.now.warn{background:var(--amber)}
  .vv{font-variant-numeric:tabular-nums;color:var(--ink);font-weight:700;white-space:nowrap;font-size:12.5px}
  .vv s{color:var(--ink3);font-weight:400;text-decoration:none;opacity:.8}

  details{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
    padding:0 14px;margin:10px 0 0}
  details[open]{padding-bottom:12px}
  summary{cursor:pointer;list-style:none;padding:11px 0;font-size:13px;font-weight:700;
    color:var(--ink3);display:flex;align-items:center;gap:7px}
  summary::-webkit-details-marker{display:none}
  summary::before{content:"\\25B8";transition:transform .15s;display:inline-block;color:var(--ink3)}
  details[open] summary::before{transform:rotate(90deg)}
  details p{margin:0 0 9px;color:var(--ink2);font-size:14px}
  details p:last-child{margin-bottom:0}
  details ul{margin:0 0 9px;padding-left:18px;color:var(--ink2);font-size:14px}
  details li{margin-bottom:6px}

  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em;
    background:var(--card2);border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--ink);word-break:break-word}
  .pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    padding:2px 7px;border-radius:999px;margin-left:7px;vertical-align:1px}
  .p-red{background:rgba(255,107,107,.15);color:var(--red)}
  .p-amb{background:rgba(245,185,66,.15);color:var(--amber)}

  .alert{border:1px solid var(--line);border-left:3px solid var(--red);background:var(--card);
    border-radius:var(--r);padding:13px 15px;margin:0 0 12px}
  .alert .t{font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--red);margin-bottom:5px}
  .alert p{margin:0;font-size:14px;color:var(--ink2)}

  footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}`;

const want = process.argv[2];
if (!want) {
  console.error("usage: npx tsx scripts/patch-notes-artifact.mts <version>");
  console.error("versions: " + BUILT_IN_PATCH_NOTES.map((n) => n.version).join(", "));
  process.exit(1);
}
const note = BUILT_IN_PATCH_NOTES.find((n) => n.version === want);
if (!note) {
  console.error(`no version "${want}". have: ` + BUILT_IN_PATCH_NOTES.map((n) => n.version).join(", "));
  process.exit(1);
}
const body = page(note);
process.stdout.write(
  process.argv.includes("--full")
    ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
        `${body}</html>\n`
    : body,
);
