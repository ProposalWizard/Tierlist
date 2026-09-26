"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { DEMOS, DEMO_CSS, DEMO_TOKENS } from "@/lib/patchNotesDemos";
import { PATCH_NOTE_PAGES, patchNotePageUrl } from "@/lib/patchNotePages";
import {
  SECTION_COLOR,
  barGroupCeiling,
  barWidths,
  formatBarValue,
  formatPatchDate,
  type PatchBar,
  type PatchItem,
  type PatchNote,
  type PatchSection,
} from "@/lib/patchNotes";

/**
 * THE ARCHIVE, RENDERED.
 *
 * The visual target is the v0.1 artifact
 * (.claude/skills/artifact-house-style/references/patch-notes-v0.1.html) —
 * its colour tokens, its stat strip, its coloured dot headings, one bold
 * line per item with a thin rule under it, its before/after bars and its
 * toggles, carried over as Tailwind so the page belongs to the site rather
 * than carrying a second stylesheet around with it.
 *
 * Nothing here renders stored markup. Every field comes out of the
 * structured shape in lib/patchNotes.ts and lands in a known element.
 *
 * Phone first: version pills scroll across the top. From lg up they become
 * a rail down the left, because admin tooling is judged on a desktop.
 */

/* The v0.1 artifact's own tokens. Dark only — this page sits inside the
   app's own dark admin chrome, and a light variant would fight it. */
const BG = "bg-[#0b100e]";
const CARD = "bg-[#141d18]";
const CARD2 = "bg-[#192520]";
const LINE = "border-[#24332b]";
const INK = "text-[#f2f7f4]";
const INK2 = "text-[#9fb6aa]";
const INK3 = "text-[#6f8679]";

const BAR_FILL: Record<PatchBar["state"], string> = {
  good: "bg-[#3ddc84]/85",
  warn: "bg-[#f5b942]/85",
  bad: "bg-[#ff6b6b]/85",
};

export default function PatchNotesArchive() {
  // The notes that ship WITH the build. The page works from these alone —
  // see lib/patchNotesData.ts for why they are a file rather than a table.
  // ── WHERE THE NOTES COME FROM ──
  //
  // A file, and only a file (lib/patchNotesData.ts). There was a Supabase
  // table, and a fetch, and a red MIGRATION NOT RUN banner when nobody had
  // run it. Asked directly: "why is this needed". It was not — nothing
  // authors a patch note through the web, they are written alongside the
  // work they describe, so the content was already in the repo and the table
  // was a second copy somebody had to hand-feed.
  //
  // So there is no request here, no loading state and nothing to fail. The
  // page renders the moment it opens, offline included.
  const notes = BUILT_IN_PATCH_NOTES;
  const [selected, setSelected] = useState<string | null>(notes[0]?.version ?? null);

  const note = notes.find((n) => n.version === selected) ?? null;

  return (
    <main className={`min-h-screen ${BG} ${INK}`}>
      <div className="mx-auto max-w-[1180px] px-4 pb-20 pt-8 lg:px-8">

        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">Patch notes</h1>
            <span className="rounded-full bg-[#3ddc84] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#06170e]">
              Archive
            </span>
          </div>
          <p className={`mt-1 text-[13px] ${INK3}`}>
            Every shipped version, kept in the code instead of a link that drifts.
          </p>
        </header>




        {notes.length > 0 && (
          <div className="lg:flex lg:gap-8">
            <VersionRail notes={notes} selected={selected} onSelect={setSelected} />
            <div className="min-w-0 flex-1">
              {note && <VersionView key={note.version} note={note} />}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
function VersionRail({
  notes, selected, onSelect,
}: { notes: PatchNote[]; selected: string | null; onSelect: (v: string) => void }) {
  return (
    <>
      {/* Phone: a scrolling row of pills. */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {notes.map((n) => {
          const on = n.version === selected;
          return (
            <button
              key={n.version}
              onClick={() => onSelect(n.version)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold transition ${
                on
                  ? "border-[#3ddc84] bg-[#3ddc84]/15 text-[#3ddc84]"
                  : `${LINE} ${CARD} ${INK2}`
              }`}
            >
              v{n.version}
            </button>
          );
        })}
      </div>

      {/* Desktop: a rail. */}
      <nav className="hidden w-56 shrink-0 lg:block">
        <p className={`mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] ${INK3}`}>
          Versions
        </p>
        <div className="flex flex-col gap-1">
          {notes.map((n) => {
            const on = n.version === selected;
            return (
              <button
                key={n.version}
                onClick={() => onSelect(n.version)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  on ? `border-[#3ddc84]/50 ${CARD2}` : "border-transparent hover:bg-[#141d18]"
                }`}
              >
                <span className={`block text-sm font-extrabold ${on ? "text-[#3ddc84]" : INK}`}>
                  v{n.version}
                </span>
                <span className={`block text-[11px] ${INK3}`}>{formatPatchDate(n.publishedAt)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* ── One version ─────────────────────────────────────────────────────── */

/**
 * PAGE or TEXT. Asked for directly: the archive should look EXACTLY like the
 * artifact — "rn I think it loses images and stuff". The data below never
 * had the pictures, so a version whose real page is kept in the repo
 * (lib/patchNotePages.ts) opens on that page, untouched; Text is the old
 * data view, still there for every version.
 */
function VersionView({ note }: { note: PatchNote }) {
  const hasPage = !!PATCH_NOTE_PAGES[note.version];
  const [view, setView] = useState<"page" | "text">(hasPage ? "page" : "text");
  const tab = (v: "page" | "text", label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold ${
        view === v ? "bg-[#3ddc84] text-[#06170e]" : `border ${LINE} ${INK2}`
      }`}
    >
      {label}
    </button>
  );
  return (
    <>
      {hasPage && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {tab("page", "Page")}
          {tab("text", "Text")}
          <span className={`text-[12px] ${INK3}`}>
            {view === "page" ? "The artifact exactly as it was published, pictures and all." : "The same notes as plain data."}
          </span>
        </div>
      )}
      {view === "page" && hasPage ? <PageFrame note={note} /> : <NoteBody note={note} />}
    </>
  );
}

/**
 * The kept page, in a frame sized to its full height so the archive scrolls
 * it like any other content. Loaded as text into `srcdoc`: the site sends
 * X-Frame-Options: DENY on every response, so a frame pointed at a URL would
 * be blank (lib/patchNotePageServe.ts).
 */
function PageFrame({ note }: { note: PatchNote }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(900);

  useEffect(() => {
    let live = true;
    fetch(patchNotePageUrl(note.version), { cache: "no-store" })
      .then(async (r) => {
        const body = await r.text();
        if (!live) return;
        if (!r.ok) {
          let msg = `Couldn't load the page (${r.status}).`;
          try { msg = (JSON.parse(body) as { error?: string }).error ?? msg; } catch { /* not JSON */ }
          setError(msg);
        } else setHtml(body);
      })
      .catch(() => { if (live) setError("Couldn't reach the server."); });
    return () => { live = false; };
  }, [note.version]);

  // Follow the page's own height — its toggles open and close.
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const measure = () => setHeight(Math.max(200, doc.documentElement.scrollHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(doc.documentElement);
    if (doc.body) ro.observe(doc.body);
    ref.current?.contentWindow?.addEventListener("unload", () => ro.disconnect());
  };

  if (error) {
    return (
      <div className={`rounded-xl border ${LINE} ${CARD} p-4 text-[13px] ${INK2}`}>
        {error} The Text tab still has this version.
      </div>
    );
  }
  if (html === null) return <div className={`p-6 text-[13px] ${INK3}`}>Loading v{note.version}…</div>;
  return (
    <div>
      <iframe
        ref={ref}
        title={`Patch notes v${note.version}`}
        srcDoc={html}
        onLoad={onLoad}
        style={{ height }}
        className="block w-full rounded-xl border-0 bg-white"
      />
      {note.artifactUrl && (
        <p className={`mt-3 text-[12.5px] ${INK3}`}>
          <a href={note.artifactUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#6fb8ff] underline underline-offset-2">
            Open the original artifact ↗
          </a>
        </p>
      )}
    </div>
  );
}

function NoteBody({ note }: { note: PatchNote }) {
  return (
    /* Capped at the reference page's own 760px. Wider than that and a
       before/after bar stretches until the difference stops being visible,
       which is the one thing the bar exists to show. */
    <article className="max-w-[760px]">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-[#3ddc84] px-2.5 py-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#06170e]">
          v{note.version}
        </span>
        <span className={`text-[13px] ${INK3}`}>{formatPatchDate(note.publishedAt)}</span>
      </div>

      <h2 className="mt-2 text-[clamp(24px,6vw,34px)] font-extrabold leading-[1.08] tracking-[-0.025em]">
        {note.title}
      </h2>

      {note.summary && <p className={`mb-6 mt-2 text-[13.5px] ${INK3}`}>{note.summary}</p>}

      {note.stats.length > 0 && (
        <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {note.stats.map((s, i) => (
            <div key={i} className={`rounded-xl border ${LINE} ${CARD} p-3.5`}>
              <b className="block text-[clamp(19px,4.6vw,25px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#3ddc84]">
                {s.value}
              </b>
              <span className={`mt-1.5 block text-[11.5px] leading-[1.35] ${INK3}`}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {note.sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}

      <footer className={`mt-12 border-t ${LINE} pt-4 text-[12.5px] ${INK3}`}>
        {note.artifactUrl ? (
          <a
            href={note.artifactUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#6fb8ff] underline underline-offset-2"
          >
            Open the original artifact ↗
          </a>
        ) : (
          <span>No artifact link for this version.</span>
        )}
      </footer>
    </article>
  );
}

function Section({ section }: { section: PatchSection }) {
  const c = SECTION_COLOR[section.kind];
  const alerts = section.items.filter((i) => i.alert);
  const rows = section.items.filter((i) => !i.alert);

  return (
    <section>
      <h3 className={`mb-3 mt-9 flex items-center gap-2.5 text-[13px] font-extrabold uppercase tracking-[0.14em] ${c.text}`}>
        <i className={`block h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
        {section.title}
      </h3>

      {alerts.map((item, i) => (
        <div key={`a${i}`} className={`mb-3 rounded-xl border ${LINE} border-l-[3px] border-l-[#ff6b6b] ${CARD} px-4 py-3.5`}>
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-[#ff6b6b]">
            {item.title}
          </div>
          {item.detail && <p className={`text-[14px] ${INK2}`}>{item.detail}</p>}
          {item.more && <Toggle more={item.more} />}
        </div>
      ))}

      {rows.length > 0 && (
        <ul className="m-0 list-none p-0">
          {rows.map((item, i) => (
            <li key={i} className={`border-b ${LINE} py-3 last:border-b-0`}>
              <Item item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Item({ item }: { item: PatchItem }) {
  return (
    <>
      <div className={`font-bold ${INK}`}>
        {item.title}
        {item.pill && (
          <span
            className={`ml-2 inline-block rounded-full px-2 py-0.5 align-[1px] text-[10.5px] font-extrabold uppercase tracking-wider ${
              item.pill.tone === "red"
                ? "bg-[#ff6b6b]/15 text-[#ff6b6b]"
                : "bg-[#f5b942]/15 text-[#f5b942]"
            }`}
          >
            {item.pill.text}
          </span>
        )}
      </div>

      {item.detail && <div className={`mt-1 text-[14px] ${INK2}`}>{item.detail}</div>}

      {item.bars && <BarGroup bars={item.bars} />}

      {item.demo && <Demo name={item.demo} />}

      {item.more && <Toggle more={item.more} />}
    </>
  );
}

/**
 * One of the pressable explainers from lib/patchNotesDemos.ts.
 *
 * IN A FRAME, ON PURPOSE. A demo is markup plus its own <script>, and React
 * will not run a script that arrives as a string — dangerouslySetInnerHTML
 * puts the tag in the DOM and the browser ignores it, so the thing renders
 * and does nothing. A frame runs it exactly as the artifact does, off the
 * same string, so the two can never drift; it also keeps the demos' plain
 * ids and class names (#d1, .btn, .row) away from the rest of the app.
 *
 * Height comes back from inside, because the content is a different height
 * per demo and grows when a proposal appears. Failing that it just stays at
 * the starting height, which still shows the demo.
 */
function Demo({ name }: { name: string }) {
  const html = DEMOS[name];
  // Each frame stamps its own id on the messages it sends. Comparing
  // event.source against contentWindow looks like the obvious check and does
  // not work here: the frame is sandboxed without allow-same-origin, so it
  // has an opaque origin and the two never compare equal — measured, the
  // messages arrive and every one of them gets dropped.
  const id = useId();
  const [height, setHeight] = useState(420);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { kind?: string; id?: string; height?: number };
      if (d?.kind !== "patch-demo-height" || d.id !== id) return;
      if (typeof d.height !== "number" || !Number.isFinite(d.height)) return;
      setHeight(Math.min(1400, Math.max(160, Math.ceil(d.height))));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  if (!html) return null;

  const srcDoc = `<!doctype html><meta charset="utf-8">
<style>${DEMO_TOKENS}${DEMO_CSS}</style>
${html}
<script>
(function(){
  var ID = ${JSON.stringify(id)}, last = 0;
  function send(force){
    var h = document.documentElement.scrollHeight;
    if (!h) return;
    if (!force && Math.abs(h - last) <= 2) return;
    last = h;
    parent.postMessage({kind:"patch-demo-height",id:ID,height:h}, "*");
  }
  // The page is server-rendered, so this frame loads and reports its height
  // BEFORE React has hydrated and attached its listener — measured: every
  // first message was sent into a page with nobody listening, and the frame
  // sat at its fallback height forever. So say it again a few times over the
  // first few seconds, whether or not anything changed.
  [0, 120, 350, 800, 1600, 3000].forEach(function(t){ setTimeout(function(){ send(true); }, t); });
  window.addEventListener("load", function(){ send(true); });
  // After that, only when it genuinely changes — a proposal appears, a note
  // wraps onto a second line.
  if (window.ResizeObserver) new ResizeObserver(function(){ send(false); }).observe(document.body);
})();
<\/script>`;

  return (
    <iframe
      title="Example"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      scrolling="no"
      className="mt-3 w-full border-0"
      style={{ height, colorScheme: "dark" }}
    />
  );
}

function BarGroup({ bars }: { bars: PatchBar[] }) {
  const ceiling = barGroupCeiling(bars);
  return (
    <div className="mb-0.5 mt-2.5">
      {bars.map((bar, i) => <Bar key={i} bar={bar} ceiling={ceiling} />)}
    </div>
  );
}

function Bar({ bar, ceiling }: { bar: PatchBar; ceiling: number }) {
  const w = barWidths(bar, ceiling);
  return (
    <div className="grid grid-cols-[minmax(70px,92px)_1fr_auto] items-center gap-2.5 py-1 text-[13px]">
      <span className={`truncate whitespace-nowrap ${INK2}`}>{bar.label}</span>
      <div className={`relative h-4 overflow-hidden rounded ${CARD2}`}>
        <div className="absolute inset-y-0 left-0 rounded bg-[#24332b]" style={{ width: `${w.was}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded ${BAR_FILL[bar.state]}`} style={{ width: `${w.now}%` }} />
      </div>
      <span className={`whitespace-nowrap text-[12.5px] font-bold tabular-nums ${INK}`}>
        {formatBarValue(bar.now, bar.unit)}{" "}
        {/* The "before" number carries its unit too. Without it a pair reads
            "3 of 3   1", and the reader has to work out what the 1 is. */}
        <s className={`font-normal no-underline opacity-80 ${INK3}`}>{formatBarValue(bar.was, bar.unit)}</s>
      </span>
    </div>
  );
}

function Toggle({ more }: { more: { summary: string; points: string[] } }) {
  return (
    <details className={`group mt-2.5 rounded-xl border ${LINE} ${CARD} px-3.5 open:pb-3`}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 py-2.5 text-[13px] font-bold ${INK3} [&::-webkit-details-marker]:hidden`}
      >
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        {more.summary}
      </summary>
      <ul className={`m-0 list-disc pl-[18px] text-[14px] ${INK2}`}>
        {more.points.map((p, i) => (
          <li key={i} className="mb-1.5 last:mb-0">{p}</li>
        ))}
      </ul>
    </details>
  );
}
