"use client";

/**
 * WEATHER AND THE PITCH — TEST PAGE (Leo, 22 Oct 2026, chat 4; plan 4a "test
 * page first"). Wind bends the ball, rain makes it skid, a bad dry pitch kills
 * the bounce and, at worst, stops the ball dead.
 *
 * Nothing here reaches the career: the real match still plays in
 * `conditionsFor` (weather.ts). The lab flies strikes through the engine's own
 * ball step (lib/star/weatherLab.ts); "Play it" is the real match (EnginePlay)
 * in the conditions picked here.
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Note, Label } from "@/components/admin/broadcast/BroadcastPage";
import EnginePlay from "@/components/star/EnginePlay";
import {
  buildConditions, CLEAR_DIALS, dialsPitchLabel, flyBall, measure, STRIKES, windWords,
  type Flight, type WeatherDials,
} from "@/lib/star/weatherLab";
import { clubPitch, pitchWord } from "@/lib/star/pitchQuality";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, STEP3_NORTH_CLUBS, STEP3_SOUTH_CLUBS,
} from "@/lib/star/clubs";
import { oldBallPhysics } from "@/lib/star/gameplayVersion";
import type { Weather } from "@/lib/star/weather";

const WEATHERS: [Weather, string, string][] = [
  ["clear", "☀️", "Clear"], ["wind", "💨", "Windy"], ["rain", "🌧️", "Rain"], ["heavy", "⛈️", "Heavy rain"],
];

const LEAGUES: [string, readonly string[]][] = [
  ["Premier League", PREMIER_LEAGUE_CLUBS], ["Championship", CHAMPIONSHIP_CLUBS], ["League One", LEAGUE_ONE_CLUBS],
  ["League Two", LEAGUE_TWO_CLUBS], ["National League", NATIONAL_LEAGUE_CLUBS],
  ["National League North", NATIONAL_LEAGUE_NORTH_CLUBS], ["National League South", NATIONAL_LEAGUE_SOUTH_CLUBS],
  ["Step 3", [...STEP3_NORTH_CLUBS, ...STEP3_SOUTH_CLUBS]],
];

const windName = (v: number) => v <= 0 ? "Still" : v < 4 ? "Light air" : v < 8 ? "Breeze" : v < 13 ? "Strong wind" : "Gale";
const PITCH_COLOUR: Record<string, string> = { perfect: "#34e08b", good: "#9be15d", fair: "#ffc24a", poor: "#ff8a3d", "very poor": "#ff4d5e" };

/** The wind as an arrow in a circle: points where it blows to (up = towards the goal). */
function WindArrow({ to, speed, size = 64, onPick, x, y }: { to: number; speed: number; size?: number; onPick?: (deg: number) => void; x?: number; y?: number }) {
  const r = size / 2, len = speed > 0 ? r * (0.45 + 0.45 * Math.min(1, speed / 17)) : 0;
  return (
    <svg x={x} y={y} width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} role="img" aria-label={speed > 0 ? `Wind ${speed} m/s, ${windWords(to)}` : "No wind"}>
      <circle r={r - 2} fill="rgba(255,255,255,0.05)" stroke="rgba(150,190,255,0.35)" />
      <text y={-r + 11} textAnchor="middle" fontSize={8} fill="#a9bde2">GOAL</text>
      {onPick && Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180, d = r - 9;
        const on = speed > 0 && Math.round(((to % 360) + 360) % 360 / 45) % 8 === i;
        return <circle key={i} cx={Math.sin(a) * d} cy={-Math.cos(a) * d} r={6} fill={on ? "#ffc24a" : "rgba(255,255,255,0.18)"}
          style={{ cursor: "pointer" }} onClick={() => onPick(i * 45)}><title>{windWords(i * 45)}</title></circle>;
      })}
      {len > 0 && (
        <g transform={`rotate(${to})`}>
          <line x1={0} y1={len * 0.7} x2={0} y2={-len * 0.55} stroke="#ffc24a" strokeWidth={4} strokeLinecap="round" />
          <path d={`M0 ${-len} L${-8} ${-len * 0.45} L8 ${-len * 0.45} Z`} fill="#ffc24a" />
        </g>
      )}
      {speed <= 0 && <text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#a9bde2">still</text>}
    </svg>
  );
}

/** One strike from above: the ball goes up the picture. 1 m across = 1 m along. */
function TopView({ flight, ghost, title, wind, fit }: { flight: Flight; ghost?: Flight; title: string; wind?: { to: number; speed: number }; fit: Flight[] }) {
  const W = 168, H = 330, pad = 10;
  // 1 m across = 1 m along, sized so the whole path (and the clear one) fits.
  // Both pictures share one scale (`fit`), so they compare side by side.
  const all = fit.flatMap((f) => f.path);
  const L = Math.max(110, ...all.map((p) => p.y + 4));
  const side = Math.max(4, ...all.map((p) => Math.abs(p.x) + 2));
  const s = Math.min((H - pad * 2) / L, (W / 2 - 4) / side);
  const X = (x: number) => W / 2 + x * s, Y = (y: number) => H - pad - y * s;
  const pts = (f: Flight) => f.path.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const air = (f: Flight) => f.path.filter((p) => p.z > 0.15);
  const land = (f: Flight) => ({ x: X(f.drift), y: Y(f.carry) });
  const end = flight.path[flight.path.length - 1];
  const arrowLeft = !!wind && wind.speed > 0 && Math.sin((wind.to * Math.PI) / 180) > 0.1;
  return (
    <div style={{ textAlign: "center" }}>
      <div className="bc-label" style={{ marginBottom: 4 }}>{title}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ background: "linear-gradient(#1f6b3a, #1a5e33)", borderRadius: 4, maxWidth: "100%" }}>
        {Array.from({ length: Math.floor(L / 10) + 1 }, (_, i) => <line key={i} x1={0} x2={W} y1={Y(i * 10)} y2={Y(i * 10)} stroke="rgba(255,255,255,0.12)" />)}
        {Array.from({ length: Math.floor(L / 20) }, (_, i) => (i + 1) * 20).map((m) => <text key={m} x={arrowLeft ? W - 4 : 4} textAnchor={arrowLeft ? "end" : "start"} y={Y(m) - 2} fontSize={8} fill="rgba(255,255,255,0.55)">{m} m</text>)}
        {ghost && <polyline points={pts(ghost)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeDasharray="3 3" />}
        <polyline points={pts(flight)} fill="none" stroke="#fde68a" strokeWidth={1.4} />
        <polyline points={air(flight).map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ")} fill="none" stroke="#ffffff" strokeWidth={2.6} />
        <circle cx={land(flight).x} cy={land(flight).y} r={3.5} fill="#ff4d5e" />
        <circle cx={X(end.x)} cy={Y(end.y)} r={4} fill="#fff" stroke="#111" />
        {/* The arrow sits on the side the ball is NOT blown to, so it never covers the path. */}
        {wind && wind.speed > 0 && <WindArrow x={arrowLeft ? 4 : W - 48} y={4} to={wind.to} speed={wind.speed} size={44} />}
      </svg>
    </div>
  );
}

/** Both strikes from the side: height against distance. */
function SideView({ a, b }: { a: Flight; b: Flight }) {
  const W = 340, H = 120, L = 110, pad = 8;
  const top = Math.max(1.5, ...a.path.map((p) => p.z), ...b.path.map((p) => p.z)) * 1.15;
  const X = (y: number) => pad + (y / L) * (W - pad * 2), Z = (z: number) => H - pad - (z / top) * (H - pad * 2);
  const line = (f: Flight) => f.path.map((p) => `${X(Math.hypot(p.x, p.y)).toFixed(1)},${Z(p.z).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
      <line x1={pad} x2={W - pad} y1={Z(0)} y2={Z(0)} stroke="#34e08b" strokeWidth={2} />
      {[20, 40, 60, 80, 100].map((m) => <text key={m} x={X(m)} y={H - 1} fontSize={8} textAnchor="middle" fill="#6f86b3">{m}</text>)}
      <text x={pad + 2} y={pad + 8} fontSize={8} fill="#6f86b3">{top.toFixed(0)} m high</text>
      <polyline points={line(a)} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} strokeDasharray="3 3" />
      <polyline points={line(b)} fill="none" stroke="#ffc24a" strokeWidth={2} />
    </svg>
  );
}

const m1 = (n: number) => `${n.toFixed(1)} m`;
const d1 = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;

export default function WeatherDevPage() {
  const [dials, setDials] = useState<WeatherDials>({ ...CLEAR_DIALS, weather: "wind", windSpeed: 10, windTo: 90 });
  const [club, setClub] = useState<string>("");
  const [strike, setStrike] = useState(STRIKES[3].id);
  const [ball, setBall] = useState<"old" | "new">("old");
  const [table, setTable] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setBall(oldBallPhysics() ? "old" : "new"); }, []);

  const set = (p: Partial<WeatherDials>) => { setDials((d) => ({ ...d, ...p })); setPlaying(false); };
  const cond = useMemo(() => buildConditions(dials), [dials]);
  const clear = useMemo(() => buildConditions(CLEAR_DIALS), []);
  const st = STRIKES.find((s) => s.id === strike)!;
  const fClear = useMemo(() => flyBall(st.speed, st.angle, clear, ball), [st, clear, ball]);
  const fNow = useMemo(() => flyBall(st.speed, st.angle, cond, ball), [st, cond, ball]);
  const rows = useMemo(() => table ? STRIKES.map((s) => ({ s, a: measure(s, clear, ball), b: measure(s, cond, ball) })) : null, [table, clear, cond, ball]);
  const wet = dials.weather === "rain" || dials.weather === "heavy";
  const pitchLine = dialsPitchLabel(dials);
  const word = pitchWord(dials.pitch);

  const pickClub = (c: string) => {
    setClub(c);
    if (c) set({ pitch: clubPitch(c).quality });
  };

  return (
    <BroadcastPage title="Weather and pitch" sub="Wind, rain and the pitch change the ball. Test page only: the real game is unchanged.">
      <PageGuide page="/star-weather-dev" />
      <PanelGrid min={300}>
        <Panel title="The day">
          <Label>Weather</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 12px" }}>
            {WEATHERS.map(([w, icon, name]) => (
              <Pill key={w} on={dials.weather === w} onClick={() => set({ weather: w, ...(w === "wind" && dials.windSpeed === 0 ? { windSpeed: 10 } : w === "clear" ? { windSpeed: 0 } : {}) })}>{icon} {name}</Pill>
            ))}
          </div>
          <Label>Wind</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 12px" }}>
            <WindArrow to={dials.windTo} speed={dials.windSpeed} size={96} onPick={(deg) => set({ windTo: deg, windSpeed: dials.windSpeed || 10 })} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{windName(dials.windSpeed)}{dials.windSpeed > 0 ? ` · ${dials.windSpeed} m/s` : ""}</div>
              <div className="bc-note">{dials.windSpeed > 0 ? `Blowing ${windWords(dials.windTo)}` : "Tap a dot to set where it blows"}</div>
              <input type="range" min={0} max={20} step={1} value={dials.windSpeed} aria-label="Wind speed"
                onChange={(e) => set({ windSpeed: +e.target.value })} style={{ width: "100%", marginTop: 6 }} />
            </div>
          </div>
          <Label>Pitch</Label>
          <select value={club} onChange={(e) => pickClub(e.target.value)} aria-label="A club's pitch"
            style={{ width: "100%", margin: "6px 0", padding: 8, background: "#0b1d44", color: "#eef4ff", border: "1px solid rgba(90,150,255,0.3)" }}>
            <option value="">A club&apos;s home pitch…</option>
            {LEAGUES.map(([name, clubs]) => (
              <optgroup key={name} label={name}>
                {[...clubs].sort().map((c) => <option key={c} value={c}>{c} ({pitchWord(clubPitch(c).quality)})</option>)}
              </optgroup>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="range" min={0.25} max={1} step={0.01} value={dials.pitch} aria-label="Pitch quality"
              onChange={(e) => { setClub(""); set({ pitch: +e.target.value }); }} style={{ flex: 1 }} />
            <b style={{ color: PITCH_COLOUR[word], minWidth: 70, textAlign: "right" }}>{word}</b>
          </div>
          <div style={{ display: "flex", gap: 6, margin: "8px 0 12px" }}>
            <Pill on={!wet && dials.ground !== "dry"} onClick={() => set({ ground: "normal" })}>Normal</Pill>
            <Pill on={!wet && dials.ground === "dry"} onClick={() => set({ ground: "dry", ...(wet ? { weather: "clear" } : {}) })}>☀️ Dry spell</Pill>
          </div>
          <Label>A bad pitch is</Label>
          <div style={{ display: "flex", gap: 6, margin: "6px 0 12px", flexWrap: "wrap" }}>
            <Pill on={dials.worst !== "harsh"} onClick={() => set({ worst: "tame" })} title="Runs almost as normal, then grabs and stops at a crawl">Tame (recommended)</Pill>
            <Pill on={dials.worst === "harsh"} onClick={() => set({ worst: "harsh" })} title="The first build: most normal passes die short on the worst dry pitch">Harsh (first build)</Pill>
          </div>
          <Label>Pre-match line (test page only)</Label>
          <div data-prematch style={{ marginTop: 6, padding: "8px 12px", background: "var(--bc-panel)", border: "1px solid var(--bc-line)", borderLeft: `4px solid ${PITCH_COLOUR[word]}`, fontWeight: 800 }}>
            {WEATHERS.find((w) => w[0] === dials.weather)![1]} {cond.label}{dials.windSpeed > 0 ? ` · wind ${windWords(dials.windTo)}` : ""} · {pitchLine}
          </div>
        </Panel>

        <Panel title="Shot and pass lab" note={`Ball: ${ball === "old" ? "Old (the game's default)" : "New"}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {STRIKES.map((s) => <Pill key={s.id} on={strike === s.id} onClick={() => setStrike(s.id)}>{s.name}</Pill>)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }} data-lab>
            <TopView flight={fClear} title="Clear" fit={[fClear, fNow]} />
            <TopView flight={fNow} ghost={fClear} title="These conditions" wind={{ to: dials.windTo, speed: dials.windSpeed }} fit={[fClear, fNow]} />
          </div>
          <div className="bc-note" style={{ textAlign: "center", margin: "4px 0 8px" }}>
            White = in the air · yellow = on the grass · red dot = first bounce · dashed = clear day
          </div>
          <SideView a={fClear} b={fNow} />
          <table style={{ width: "100%", fontSize: 12.5, marginTop: 8, borderCollapse: "collapse" }} data-numbers>
            <thead><tr style={{ color: "#a9bde2", textAlign: "right" }}><th style={{ textAlign: "left" }}>{st.name}</th><th>Clear</th><th>Now</th><th>Change</th></tr></thead>
            <tbody>
              {([["Carry", "carry"], ["Sideways", "drift"], ["Bounce", "bounce"], ["Roll after", "roll"], ["Total", "total"]] as const).map(([n, k]) => (
                <tr key={k} style={{ textAlign: "right", borderTop: "1px solid rgba(90,150,255,0.15)" }}>
                  <td style={{ textAlign: "left" }}>{n}</td><td>{m1(fClear[k])}</td><td>{m1(fNow[k])}</td>
                  <td style={{ fontWeight: 800, color: Math.abs(fNow[k] - fClear[k]) < 0.05 ? "#6f86b3" : "#ffc24a" }}>{d1(fNow[k] - fClear[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Btn onClick={() => setTable((t) => !t)}>{table ? "Hide" : "Measure 200 of each"}</Btn>
            <Btn onClick={() => setBall((b) => (b === "old" ? "new" : "old"))}>Ball: {ball === "old" ? "Old" : "New"}</Btn>
          </div>
          {rows && (
            <table style={{ width: "100%", fontSize: 12, marginTop: 10, borderCollapse: "collapse" }} data-measured>
              <thead><tr style={{ color: "#a9bde2", textAlign: "right" }}><th style={{ textAlign: "left" }}>200 each</th><th>Carry</th><th>Side</th><th>Bounce</th><th>Roll</th></tr></thead>
              <tbody>
                {rows.map(({ s, a, b }) => (
                  <tr key={s.id} style={{ textAlign: "right", borderTop: "1px solid rgba(90,150,255,0.15)" }}>
                    <td style={{ textAlign: "left" }}>{s.name}</td>
                    <td>{d1(b.carry - a.carry)}</td><td>{d1(b.drift - a.drift)}</td><td>{d1(b.bounce - a.bounce)}</td><td>{d1(b.roll - a.roll)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </PanelGrid>

      <Panel title="Play it" note="The real match, in these conditions">
        {!playing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Btn main onClick={() => setPlaying(true)}>▶ Play it</Btn>
            <Note>Chances from the real match, played in the weather and pitch above. Change a dial and press Play again.</Note>
          </div>
        ) : (
          <div data-playing>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <WindArrow to={dials.windTo} speed={dials.windSpeed} size={40} />
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{cond.label} · {pitchLine}</div>
              </div>
              <Btn onClick={() => setPlaying(false)}>■ Stop</Btn>
            </div>
            <EnginePlay key={JSON.stringify(dials)} seed={11} conditions={cond} />
          </div>
        )}
      </Panel>
    </BroadcastPage>
  );
}
