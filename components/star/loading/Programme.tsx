"use client";

/**
 * The matchday programme (Harry, 27 Nov 2026: "the match day programme").
 * A programme on a desk under a lamp, built from the real fixture
 * (lib/star/loading/programme.ts). The cover alone has to be worth a 1 s
 * wait; on a longer one the pages turn by themselves every 2.4 s: the form
 * guide, you as the player in focus, the home club's ground. No input.
 * Three covers: classic (the home colours), photo, retro.
 */
import type { CSSProperties, ReactNode } from "react";
import ClubBadge from "@/components/star/ClubBadge";
import type { LoadVariant } from "@/lib/star/loading/pick";
import type { ProgrammeData } from "@/lib/star/loading/programme";

/** A darker / lighter shade of a #rrggbb. */
function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const PHOTO = "/home/scene-sunset.webp";

export default function Programme({ variant, data }: { variant: LoadVariant; data?: ProgrammeData }) {
  if (!data) return <Desk><div className="lc-pg-book"><div className="lc-pg-page lc-cv-classic" style={{ "--club": "#b91c1c", "--club-dk": "#7f1d1d", "--ink": "#fff" } as CSSProperties}><div className="lc-cv-title lc-display">Match<br />day<br /><span>programme</span></div></div></div></Desk>;
  const d = data;
  const club = d.home.shirt;
  const vars = {
    "--club": club, "--club-dk": shade(club, -0.45), "--club-lt": shade(club, 0.45), "--ink": d.home.ink,
    "--trim2": d.home.trim.toLowerCase() === club.toLowerCase() ? "#efe6cf" : d.home.trim,
  } as CSSProperties;

  // inside pages: only those with something real to say, the order turned by the cover
  const pages: ReactNode[] = [];
  const form = d.form.length || (d.home.pos && d.away.pos) ? (
    <div className="lc-pg-in" key="form">
      <div className="lc-pg-kicker">Form guide</div>
      <div className="lc-pg-h lc-display">{d.home.short} v {d.away.short}</div>
      <div className="lc-pg-rule" />
      {d.home.pos && d.away.pos ? (
        <div className="lc-pg-vsrow">
          <div><b className="lc-display">{ord(d.home.pos)}</b><span>{d.home.short}</span></div>
          <div style={{ fontWeight: 900, color: "#888" }}>v</div>
          <div><b className="lc-display">{ord(d.away.pos)}</b><span>{d.away.short}</span></div>
        </div>
      ) : null}
      {d.form.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="lc-pg-kicker" style={{ color: "#555" }}>{d.you.club}: last {d.form.length}</div>
          <div className="lc-pg-form">{d.form.map((r, i) => <i key={i} className={r}>{r}</i>)}</div>
        </div>
      )}
      {d.lastMeeting && <div className="lc-pg-body" style={{ marginTop: 16 }}>{d.lastMeeting}.</div>}
      {d.derby && <div className="lc-pg-body" style={{ marginTop: 8, color: "var(--club)" }}>Derby day.</div>}
      <div className="lc-pg-no">2</div>
    </div>
  ) : null;
  const you = (
    <div className="lc-pg-in" key="you">
      <div className="lc-pg-kicker">Player in focus</div>
      <div className="lc-pg-h lc-display">{d.you.name}</div>
      <div className="lc-pg-rule" />
      <div className="lc-pg-stats">{d.you.stats.map((s) => <div className="lc-pg-stat" key={s.l}><b className="lc-display">{s.v}</b><span>{s.l}</span></div>)}</div>
      {d.you.line && <div className="lc-pg-body" style={{ marginTop: 12 }}>{d.you.line}</div>}
      <div className="lc-pg-no">4</div>
    </div>
  );
  const fact = d.fact ? (
    <div className="lc-pg-in" key="fact">
      <div className="lc-pg-kicker">Club fact</div>
      <div className="lc-pg-h lc-display">{d.fact.title}</div>
      <div className="lc-pg-rule" />
      <div className="lc-pg-photo" style={{ backgroundImage: `url(${PHOTO})` }} />
      {d.fact.stats.length > 0 && <div className="lc-pg-stats">{d.fact.stats.map((s) => <div className="lc-pg-stat" key={s.l}><b className="lc-display" style={{ fontSize: 30 }}>{s.v}</b><span>{s.l}</span></div>)}</div>}
      {d.fact.line && <div className="lc-pg-body" style={{ marginTop: 10 }}>{d.fact.line}</div>}
      <div className="lc-pg-no">6</div>
    </div>
  ) : null;
  const order = variant.look === "photo" ? [you, form, fact] : variant.look === "retro" ? [fact, form, you] : [form, you, fact];
  for (const p of order) if (p) pages.push(p);

  const cover = variant.look === "photo" ? <PhotoCover d={d} /> : variant.look === "retro" ? <RetroCover d={d} /> : <ClassicCover d={d} />;
  // the last page sits at the bottom; each one above turns away in order
  const stack = [cover, ...pages];
  return (
    <Desk>
      <div className="lc-pg-book" style={vars}>
        {stack.map((p, i) => {
          const fromTop = i;
          const last = i === stack.length - 1;
          const at = 2.2 + fromTop * 2.4;
          return (
            <div
              key={i}
              className={`lc-pg-page ${i === 0 ? `lc-cv-${variant.look ?? "classic"}` : ""} ${last ? "" : "lc-pg-turn"}`}
              style={{ zIndex: stack.length - i, "--at": `${at}s` } as CSSProperties}
            >
              {p}
              {!last && <div className="lc-pg-gloss" />}
            </div>
          );
        })}
      </div>
    </Desk>
  );
}

function Desk({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="lc-pg-desk" />
      <div className="lc-pg-lamp" />
      <div className="lc-pg-cap"><div className="lc-caps">Matchday programme</div></div>
      {children}
    </>
  );
}

const Crest = ({ club, size }: { club: string; size: number }) => <ClubBadge club={club} size={size} />;

function ClassicCover({ d }: { d: ProgrammeData }) {
  return (
    <>
      <div className="lc-cv-band"><span>Issue {d.issue}</span><span>Season {d.season}</span></div>
      <div className="lc-cv-title lc-display">Match<br />day<br /><span>programme</span></div>
      <div className="lc-cv-vs">
        <div className="lc-cv-crest"><Crest club={d.home.name} size={62} /></div>
        <div className="v lc-display">V</div>
        <div className="lc-cv-crest"><Crest club={d.away.name} size={62} /></div>
      </div>
      <div className="lc-cv-names lc-display">{d.home.short} <span style={{ color: "#facc15" }}>v</span> {d.away.short}</div>
      <div className="lc-cv-date">{[d.date, d.venue].filter(Boolean).join(" · ")}</div>
      <div className="lc-cv-price lc-display">£3.50</div>
    </>
  );
}

function PhotoCover({ d }: { d: ProgrammeData }) {
  return (
    <>
      <div className="pic" style={{ backgroundImage: `url(${PHOTO})` }} />
      <div className="ribbon">{d.comp}</div>
      <div className="crests">
        <div><Crest club={d.home.name} size={42} /></div>
        <div><Crest club={d.away.name} size={42} /></div>
      </div>
      <div className="stack lc-display">{d.home.short}<span className="vv">versus</span>{d.away.short}</div>
      <div className="foot"><span>{d.date}</span><span>No. {d.issue}</span></div>
    </>
  );
}

function RetroCover({ d }: { d: ProgrammeData }) {
  return (
    <>
      <div className="stripes" />
      <div className="frame" />
      <div className="crests">
        <div><Crest club={d.home.name} size={52} /></div>
        <div><Crest club={d.away.name} size={52} /></div>
      </div>
      <div className="off">Official programme</div>
      <div className="big lc-display">{d.home.short}<br /><span style={{ fontSize: ".55em" }}>v</span><br />{d.away.short}</div>
      <div className="bottom"><span>{d.comp}<br />{d.date}</span><b>50p</b></div>
    </>
  );
}
