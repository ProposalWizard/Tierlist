"use client";

/**
 * SHARE A CAREER BY LINK, AND COMPARE WITH A FRIEND (Leo, 6 Oct 2026: "Online:
 * share a career, compare with a friend. Friends first.").
 *
 *   ShareLinkSheet   a retired career's code and link: copy it, send it, or
 *                    stop sharing. Signed in only (the link lives in your account).
 *   CompareCareers   two careers side by side, one bar per number.
 *   CompareFlow      paste a friend's code (or link), pick one of your own
 *                    careers, see them side by side.
 *
 * The codes and the calls: lib/star/legendShare.ts. The public page a link
 * opens: app/legend/[code]/page.tsx.
 */
import { useEffect, useMemo, useState } from "react";
import type { HallEntry } from "@/lib/star/hallOfFame";
import { careerOverview, type CareerOverviewData } from "@/lib/star/careerOverview";
import {
  shareLegend, unshareLegend, fetchLegend, knownLegendCode, legendUrl, spacedCode, parseLegendCode, legendProblem,
  compareRows, compareScore,
} from "@/lib/star/legendShare";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import ClubBadge from "./ClubBadge";
import { ScreenShell, BottomBar, BarButton, RiseIn, clubTheme, rgba } from "./ui";

const GOLD = "#fbbf24";
const SKY = "#38bdf8";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");

// ── Share a link ────────────────────────────────────────────────────────────

/** A retired career's link: made (or found) when the sheet opens. */
export function ShareLinkSheet({ entry, onClose }: { entry: HallEntry; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(() => knownLegendCode(entry.id));
  const [busy, setBusy] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    let alive = true;
    void shareLegend(entry).then(r => {
      if (!alive) return;
      setBusy(false);
      if (r.ok) { setCode(r.code); setProblem(null); }
      else { setProblem(r.message); if (r.why !== "offline") setCode(null); }
    });
    return () => { alive = false; };
    // once per career shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  const url = code ? legendUrl(code) : null;
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setNote("Link copied."); }
    catch { setNote(url); }
  };
  const send = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: `${entry.card.name} — a Knowitball legend`, text: `${entry.card.name}: ${entry.card.title}. Compare your career with mine.`, url });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") void copy();
    }
  };
  const stop = async () => {
    if (!code) return;
    const ok = await unshareLegend(code, entry.id);
    if (ok) { setStopped(true); setCode(null); setNote("Stopped. The link no longer works."); }
    else setNote("Couldn't stop sharing. Try again.");
  };
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 px-4 py-6" data-share-link-sheet role="dialog" aria-label="Share a link to this career">
      <div className="w-full max-w-[380px] p-4 text-center" style={{ background: "#0b1220", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.35)", borderRadius: 4 }}>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-200">Share a link</div>
        <div className="mt-1 truncate text-[20px] uppercase leading-tight text-white sk-display">{entry.card.name}</div>
        {code ? (
          <>
            <div className="mt-3 text-[11px] font-black uppercase tracking-wider text-white/70">Your code</div>
            <div className="sk-num mt-0.5 text-[40px] leading-none tracking-[0.12em] text-amber-300" data-legend-code={code}>{spacedCode(code)}</div>
            <div className="mt-2 truncate px-1 text-[12px] font-bold text-white/80">{url?.replace(/^https?:\/\//, "")}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={copy} className="kib-press py-3 text-[13px] font-black uppercase tracking-wide text-white" style={{ background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.15)", borderRadius: 2 }} data-copy-link>Copy link</button>
              <button onClick={canShare ? send : copy} className="kib-press py-3 text-[13px] font-black uppercase tracking-wide text-gray-950" style={{ background: GOLD, borderRadius: 2 }} data-send-link>Send it</button>
            </div>
            <div className="mt-2 text-[11.5px] font-bold text-white/70">A friend opens it, no sign-in, and can put their career next to yours.</div>
          </>
        ) : busy ? (
          <div className="mt-6 mb-4 text-[12px] font-black uppercase tracking-wider text-white/70">Making the link…</div>
        ) : (
          <div className="mt-4 mb-2 text-[13px] font-bold text-amber-200" data-share-problem>{stopped ? "Not shared." : problem ?? "Couldn't make the link."}</div>
        )}
        {note && <div className="mt-2 break-all text-[11.5px] font-bold text-amber-200">{note}</div>}
        <div className="mt-3 flex items-center justify-between">
          {code ? <button onClick={stop} className="py-2 text-[11.5px] font-black uppercase tracking-wider text-white/60" data-stop-sharing>Stop sharing</button> : <span />}
          <button onClick={onClose} className="kib-press px-4 py-2 text-[12.5px] font-black uppercase tracking-wide text-white" style={{ background: "rgba(255,255,255,.08)", borderRadius: 2 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Compare two careers ─────────────────────────────────────────────────────

function Side({ o, colour, tag }: { o: CareerOverviewData; colour: string; tag: string }) {
  const th = clubTheme(o.finalClub);
  return (
    <div className="min-w-0 px-2 py-2 text-center" style={{ background: `linear-gradient(180deg, ${rgba(th.glow, 0.35)}, rgba(5,8,15,.9))`, boxShadow: `inset 0 3px 0 ${colour}` }}>
      <div className="text-[9.5px] font-black uppercase tracking-[0.2em]" style={{ color: colour }}>{tag}</div>
      <div className="mt-1 flex justify-center"><ClubBadge club={o.finalClub} kit={kitsOf(o.finalClub).home} size={30} /></div>
      <div className="mt-1 truncate text-[15px] uppercase leading-tight text-white sk-display">{o.name}</div>
      <div className="truncate text-[10.5px] font-black uppercase tracking-wide text-amber-200">{o.verdict.title}</div>
      <div className="truncate text-[10.5px] font-bold text-white/70">{short(o.finalClub)} · {o.years}</div>
    </div>
  );
}

/** Two careers, side by side: one bar per number, the bigger one lit. */
export function CompareCareers({ a, b, aTag = "You", bTag = "Friend", onBack, backLabel = "Back" }: {
  a: HallEntry; b: HallEntry; aTag?: string; bTag?: string; onBack: () => void; backLabel?: string;
}) {
  const oa = useMemo(() => careerOverview(a.career), [a]);
  const ob = useMemo(() => careerOverview(b.career), [b]);
  const rows = useMemo(() => compareRows(oa, ob), [oa, ob]);
  const score = compareScore(rows);
  return (
    <ScreenShell
      glow={GOLD}
      title=""
      bare
      tone="calm"
      bottomBar={<BottomBar><BarButton icon="‹" label={backLabel} onClick={onBack} /></BottomBar>}
    >
      <div className="pb-4 pt-3" data-compare>
        <RiseIn>
          <div className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">Head to head</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Side o={oa} colour={GOLD} tag={aTag} />
            <Side o={ob} colour={SKY} tag={bTag} />
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[13px] font-black uppercase tracking-wide" data-compare-score>
            <span style={{ color: GOLD }}>{score.a}</span>
            <span className="text-white/60">numbers won</span>
            <span style={{ color: SKY }}>{score.b}</span>
          </div>
        </RiseIn>
        <div className="mt-3 space-y-2">
          {rows.map((r, k) => {
            const max = Math.max(r.a, r.b, 1e-9);
            const show = r.show ?? ((n: number) => String(n));
            const aWins = r.label !== "Clubs" && r.a > r.b, bWins = r.label !== "Clubs" && r.b > r.a;
            return (
              <RiseIn key={r.label} index={k + 1}>
                <div data-compare-row={r.label}>
                  <div className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/75">{r.label}</div>
                  <div className="mt-0.5 grid grid-cols-[3.2rem_1fr_1fr_3.2rem] items-center gap-1">
                    <div className={`sk-num text-right text-[17px] leading-none tabular-nums ${aWins ? "text-amber-300" : "text-white/80"}`}>{show(r.a)}</div>
                    <div className="flex h-[14px] justify-end" style={{ background: "rgba(255,255,255,.05)" }}>
                      <div style={{ width: `${(r.a / max) * 100}%`, background: aWins ? GOLD : rgba(GOLD, 0.45) }} />
                    </div>
                    <div className="flex h-[14px] justify-start" style={{ background: "rgba(255,255,255,.05)" }}>
                      <div style={{ width: `${(r.b / max) * 100}%`, background: bWins ? SKY : rgba(SKY, 0.45) }} />
                    </div>
                    <div className={`sk-num text-left text-[17px] leading-none tabular-nums ${bWins ? "text-sky-300" : "text-white/80"}`}>{show(r.b)}</div>
                  </div>
                </div>
              </RiseIn>
            );
          })}
        </div>
      </div>
    </ScreenShell>
  );
}

// ── Paste a friend's code ───────────────────────────────────────────────────

/**
 * Compare with a friend: their code (or link), then which of your careers.
 * `mine` is your Hall; `start` opens on one of them already chosen.
 */
export function CompareFlow({ mine, start, onClose, initialCode, preset, theirTag = "Friend" }: {
  mine: HallEntry[]; start?: string; onClose: () => void; initialCode?: string;
  /** Their career, already known (the public page of a shared career). */
  preset?: HallEntry;
  theirTag?: string;
}) {
  const [text, setText] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [theirs, setTheirs] = useState<HallEntry | null>(preset ?? null);
  const [pick, setPick] = useState<string | null>(start ?? (mine.length === 1 ? mine[0].id : null));

  const look = async (raw: string) => {
    const code = parseLegendCode(raw);
    if (!code) { setProblem(legendProblem("bad-code")); return; }
    setBusy(true); setProblem(null);
    const r = await fetchLegend(code);
    setBusy(false);
    if (r.ok) setTheirs(r.entry); else setProblem(legendProblem(r.why));
  };
  useEffect(() => { if (initialCode) void look(initialCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const yours = pick ? mine.find(e => e.id === pick) : undefined;
  if (theirs && yours) {
    return <CompareCareers a={yours} b={theirs} bTag={theirTag} onBack={() => (preset ? setPick(null) : setTheirs(null))} backLabel={preset ? "Back" : "Another code"} />;
  }
  return (
    <ScreenShell
      glow={SKY}
      title=""
      bare
      tone="calm"
      bottomBar={<BottomBar><BarButton icon="‹" label="Back" onClick={onClose} /></BottomBar>}
    >
      <div className="pt-4" data-compare-flow>
        <div className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">Compare with a friend</div>
        <h1 className="mt-1 text-center text-[32px] uppercase leading-none text-white">Head to head</h1>

        {!theirs && (
          <div className="mt-4 p-3" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(56,189,248,.35)" }}>
            <label className="block text-[11px] font-black uppercase tracking-wider text-white/80" htmlFor="friend-code">Their code or link</label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="friend-code"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void look(text); }}
                placeholder="K7Q2XM"
                autoCapitalize="characters"
                autoComplete="off"
                className="min-w-0 flex-1 bg-black/50 px-3 py-2.5 text-[18px] font-black uppercase tracking-[0.14em] text-white outline-none"
                style={{ borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}
                data-friend-code
              />
              <button onClick={() => void look(text)} disabled={busy} className="kib-press shrink-0 px-4 text-[13px] font-black uppercase tracking-wide text-gray-950 disabled:opacity-50" style={{ background: SKY, borderRadius: 2 }} data-look-up>
                {busy ? "…" : "Find"}
              </button>
            </div>
            {problem && <div className="mt-2 text-[12px] font-bold text-amber-200" data-compare-problem>{problem}</div>}
          </div>
        )}

        {theirs && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2" style={{ background: "rgba(56,189,248,.12)", boxShadow: "inset 0 0 0 1px rgba(56,189,248,.45)" }} data-found>
            <ClubBadge club={theirs.card.mainClub} kit={kitsOf(theirs.card.mainClub).home} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] uppercase leading-tight text-white sk-display">{theirs.card.name}</div>
              <div className="truncate text-[10.5px] font-black uppercase tracking-wide text-sky-300">{theirs.card.title}</div>
            </div>
            <button onClick={() => setTheirs(null)} className="shrink-0 text-[11px] font-black uppercase tracking-wider text-white/60">Change</button>
          </div>
        )}

        <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-amber-200">Your career</div>
        {mine.length === 0 ? (
          <div className="mt-1.5 flex h-[70px] items-center justify-center text-[12px] font-black uppercase tracking-wider text-white/50" style={{ background: "rgba(0,0,0,.55)" }}>
            Retire a career to compare it
          </div>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            {mine.map(e => {
              const on = pick === e.id;
              return (
                <button key={e.id} onClick={() => setPick(e.id)} className="kib-press flex w-full items-center gap-2 px-3 py-2 text-left" style={{ background: on ? rgba(GOLD, 0.2) : "rgba(255,255,255,.05)", boxShadow: on ? `inset 0 0 0 2px ${GOLD}` : "inset 0 0 0 1px rgba(255,255,255,.1)" }} data-pick-mine={e.id}>
                  <ClubBadge club={e.card.mainClub} kit={kitsOf(e.card.mainClub).home} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] uppercase leading-tight text-white sk-display">{e.card.name}</div>
                    <div className="truncate text-[10.5px] font-bold text-white/70">{e.card.goals} goals · {e.card.trophies} {e.card.trophies === 1 ? "trophy" : "trophies"}</div>
                  </div>
                  {on && <span className="text-[16px]" aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
        )}
        {theirs && !yours && mine.length > 0 && <div className="mt-2 text-center text-[12px] font-bold text-white/70">Pick one of yours.</div>}
      </div>
    </ScreenShell>
  );
}
