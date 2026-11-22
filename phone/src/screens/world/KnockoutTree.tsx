/**
 * THE KNOCKOUT TREE (the website's components/star/KnockoutTree.tsx): the last
 * 16 to the final in four equal columns (the domestic cups: the last 8 to the
 * final in three). Each box shows both clubs and their score; tap a box for
 * the full names, both legs and penalties. Ties not drawn yet show "?".
 *
 * Column k+1's tie j is fed by column k's ties 2j and 2j+1.
 * Same sizes as the website: 40 px boxes 8 px apart, 9.5 px names, 2% gaps.
 */
import { useState, type ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { koAggregate, type EuroBracket } from "@/lib/star/euroBracket";
import type { CupState } from "@/lib/star/cups";
import { shortClub } from "@/lib/star/media/grammar";
import { Press } from "../../ui/Press";
import { glassStyle } from "../../ui/look";
import { ClubBadge, youRow, rgba } from "../../world/ui";

export interface TreeTie { a?: string; b?: string; sa?: number; sb?: number; winner?: string; note?: string }
export interface TreeColumn { name: string; ties: TreeTie[] }

const BOX_H = 40;
const ROW_GAP = 8;
const LINE = "rgba(255,255,255,0.28)";
const AMBER = "#fcd34d";

const label = (name: string) =>
  name === "Round of 16" ? "Last 16" : name === "Quarter-Final" ? "Quarters" : name === "Semi-Final" ? "Semis" : name;

function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: AMBER, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{children}</Text>;
}

function Side({ club, score, won }: { club?: string; score?: number; won: boolean }) {
  const name = club ? shortClub(club) : "?";
  const size = name.length > 12 ? 7.8 : name.length > 10 ? 8.6 : 9.5;
  const color = won ? "#fff" : "rgba(255,255,255,0.45)";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 13 }}>
      {club ? <ClubBadge club={club} size={11} /> : <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.15)" }} />}
      <Text numberOfLines={1} ellipsizeMode="clip" style={{ flex: 1, minWidth: 0, color, fontSize: size, lineHeight: 12, fontWeight: won ? "900" : "700", letterSpacing: -0.1, includeFontPadding: false }}>{name}</Text>
      {score !== undefined && <Text style={{ color, fontSize: 9.5, lineHeight: 12, fontWeight: won ? "900" : "700", fontVariant: ["tabular-nums"], includeFontPadding: false }}>{score}</Text>}
    </View>
  );
}

/** One tie as a full-width line: names, score pill, note under. */
export function TieLine({ a, b, score, winner, note, mine, glow, badges, size = 11, noteColor = "rgba(255,255,255,0.7)", detail }: {
  a: string; b: string; score: string; winner?: string; note?: string; mine: boolean; glow: string; badges?: boolean; size?: number; noteColor?: string;
  /** The tree's tie card (KnockoutTree.tsx `picked`): the side that has not won is white 75%, the note 10 px. */
  detail?: boolean;
}) {
  const col = (c: string) => (winner === c ? "#fff" : detail ? "rgba(255,255,255,0.75)" : winner ? "rgba(255,255,255,0.6)" : "#fff");
  const noteSize = detail ? 10 : 9.5;
  const wt = (c: string) => (winner === c ? "900" : "700") as "900" | "700";
  return (
    <View style={[{ borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.04)" }, mine && [youRow(glow), { borderWidth: 0 }]]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, textAlign: "right", color: col(a), fontSize: size, lineHeight: size * 1.5, fontWeight: wt(a) }}>{shortClub(a)}</Text>
          {badges ? <ClubBadge club={a} size={16} /> : null}
        </View>
        <Text style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", fontWeight: "900", fontSize: size, lineHeight: size * 1.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden", fontVariant: ["tabular-nums"] }}>{score}</Text>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
          {badges ? <ClubBadge club={b} size={16} /> : null}
          <Text numberOfLines={1} style={{ flexShrink: 1, color: col(b), fontSize: size, lineHeight: size * 1.5, fontWeight: wt(b) }}>{shortClub(b)}</Text>
        </View>
      </View>
      {/* the website's grid: the note is its own row, 6 px under the names (gap-1.5), on a 1.5 line */}
      {note ? <Text style={{ color: noteColor, fontSize: noteSize, lineHeight: noteSize * 1.5, marginTop: 6, fontWeight: "700", textAlign: "center" }}>{note}</Text> : null}
    </View>
  );
}

// the website's ClubCard is frosted glass with only a faint club tint: plain navy glass here (a club-colour fill read far too strong)
const card = (_glow: string): ViewStyle[] => [glassStyle("glass") as ViewStyle, { borderRadius: 14, overflow: "hidden" }];

export function KnockoutTree({ columns, glow, you }: { columns: TreeColumn[]; glow: string; you: string }) {
  const [pick, setPick] = useState<{ c: number; t: number } | null>(null);
  const [w, setW] = useState(0);
  const first = Math.max(1, columns[0]?.ties.length ?? 1);
  const height = first * (BOX_H + ROW_GAP);
  const n = columns.length;
  const gap = w * 0.02;
  const colW = n ? (w - gap * (n - 1)) / n : 0;
  const x = (c: number) => c * (colW + gap);
  const centreY = (c: number, t: number) => {
    const slots = first / Math.max(1, columns[c].ties.length);
    return (t + 0.5) * slots * (BOX_H + ROW_GAP);
  };
  const picked = pick ? columns[pick.c]?.ties[pick.t] : null;
  const lines: ReactNode[] = [];
  if (w > 0) {
    columns.slice(1).forEach((col, ci) => col.ties.forEach((_, t) => {
      const c = ci + 1;
      const x0 = x(c - 1) + colW, x1 = x(c), xm = (x0 + x1) / 2, y = centreY(c, t);
      const ya = centreY(c - 1, 2 * t), yb = centreY(c - 1, 2 * t + 1);
      const k = `${c}-${t}`;
      lines.push(
        <View key={`${k}a`} pointerEvents="none" style={{ position: "absolute", left: x0, top: ya - 0.6, width: xm - x0, height: 1.2, backgroundColor: LINE }} />,
        <View key={`${k}b`} pointerEvents="none" style={{ position: "absolute", left: x0, top: yb - 0.6, width: xm - x0, height: 1.2, backgroundColor: LINE }} />,
        <View key={`${k}v`} pointerEvents="none" style={{ position: "absolute", left: xm - 0.6, top: ya, width: 1.2, height: yb - ya, backgroundColor: LINE }} />,
        <View key={`${k}h`} pointerEvents="none" style={{ position: "absolute", left: xm, top: y - 0.6, width: x1 - xm, height: 1.2, backgroundColor: LINE }} />,
      );
    }));
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={[...card(glow), { paddingHorizontal: 4, paddingVertical: 8 }]}>
        <View onLayout={(e) => { const v = e.nativeEvent.layout.width; if (Math.abs(v - w) > 0.5) setW(v); }}>
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            {columns.map((col, c) => (
              <Text key={col.name} numberOfLines={1} style={{ width: colW || undefined, flex: colW ? undefined : 1, marginLeft: c ? gap : 0, textAlign: "center", color: AMBER, fontSize: 9, lineHeight: 13.5, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>{label(col.name)}</Text>
            ))}
          </View>
          <View style={{ height }}>
            {lines}
            {w > 0 && columns.map((col, c) => col.ties.map((tie, t) => {
              const mine = !!you && (tie.a === you || tie.b === you);
              const on = pick?.c === c && pick.t === t;
              return (
                <Press key={`${c}-${t}`} disabled={!tie.a && !tie.b} onPress={() => setPick(on ? null : { c, t })}
                  style={{
                    position: "absolute", left: x(c), width: colW, top: centreY(c, t) - BOX_H / 2, height: BOX_H,
                    justifyContent: "center", gap: 2, borderRadius: 6, paddingHorizontal: 3,
                    backgroundColor: on ? rgba(glow, 0.45) : "rgba(255,255,255,0.08)",
                    borderWidth: 1, borderColor: mine ? "#fde047" : "rgba(255,255,255,0.16)",
                  }}>
                  <Side club={tie.a} score={tie.sa} won={!tie.winner || tie.winner === tie.a} />
                  <Side club={tie.b} score={tie.sb} won={!tie.winner || tie.winner === tie.b} />
                </Press>
              );
            }))}
          </View>
        </View>
      </View>
      {picked && picked.a && picked.b ? (
        <View style={[...card(glow), { padding: 6 }]}>
          <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}><CardTitle>{columns[pick!.c].name}</CardTitle></View>
          <TieLine a={picked.a} b={picked.b} score={picked.sa !== undefined ? `${picked.sa}-${picked.sb}` : "v"} winner={picked.winner} note={picked.note}
            mine={picked.a === you || picked.b === you} glow={glow} badges size={12} noteColor="#fde68a" detail />
        </View>
      ) : null}
    </View>
  );
}

// ── Europe ──────────────────────────────────────────────────────────────────

type EuroTie = EuroBracket["rounds"][number]["ties"][number];

/** A UEFA tie for the tree: aggregate score, both legs and penalties in the note. */
export function euroTreeTie(t: EuroTie): TreeTie {
  const agg = koAggregate(t);
  const legs = t.legs.length > 1 ? t.legs.map(l => `${l.a}-${l.b}`).join(" · ") : "";
  const pens = t.pens ? `${t.pens.a}-${t.pens.b} on penalties` : "";
  return { a: t.a, b: t.b, sa: agg?.a, sb: agg?.b, winner: t.winner, note: [legs && `Legs ${legs}`, pens].filter(Boolean).join(" · ") || undefined };
}

/** The Champions or Europa League knockout: the Round of 32 as a folding list
 *  (open while it is the round being played), then the tree from the last 16. */
export function EuroKnockout({ bracket, glow, you }: { bracket: EuroBracket; glow: string; you: string }) {
  const r32 = bracket.rounds.find(r => r.name === "Round of 32");
  const tree = ([["Round of 16", 8], ["Quarter-Final", 4], ["Semi-Final", 2], ["Final", 1]] as const).map(([name, size]) => {
    const ties = (bracket.rounds.find(r => r.name === name)?.ties ?? []).map(euroTreeTie);
    while (ties.length < size) ties.push({});
    return { name, ties: ties.slice(0, size) };
  });
  const r32Live = !!r32 && r32.ties.some(t => t.a && t.b && !t.winner);
  const [open, setOpen] = useState(r32Live);
  return (
    <View style={{ gap: 8 }}>
      {r32 && r32.ties.some(t => t.a && t.b) ? (
        <View style={[...card(glow), { padding: 6 }]}>
          <Press onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 4 }}>
            <View style={{ flex: 1 }}>
              <CardTitle>Round of 32 · knockout play-off</CardTitle>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10.5, lineHeight: 15, fontWeight: "700" }}>9th to 24th in the league stage play for the last 16</Text>
            </View>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{open ? "▴" : "▾"}</Text>
          </Press>
          {open ? (
            <View style={{ marginTop: 4, gap: 4 }}>
              {r32.ties.filter(t => t.a && t.b).map((t, i) => {
                const tt = euroTreeTie(t);
                return <TieLine key={i} a={t.a!} b={t.b!} score={tt.sa !== undefined ? `${tt.sa}-${tt.sb}` : "v"} winner={t.winner} note={tt.note} mine={t.a === you || t.b === you} glow={glow} />;
              })}
            </View>
          ) : null}
        </View>
      ) : null}
      <KnockoutTree columns={tree} glow={glow} you={you} />
    </View>
  );
}

// ── Domestic cups ───────────────────────────────────────────────────────────

export const TREE_ROUNDS = ["Quarter-Final", "Semi-Final", "Final"];
type CupTie = CupState["rounds"][number]["ties"][number];

export const cupWinner = (t: CupTie): string | undefined => {
  if (t.hs === undefined || t.as === undefined) return undefined;
  if (t.hs !== t.as) return t.hs > t.as ? t.home : t.away;
  return t.pens ? (t.pens.home > t.pens.away ? t.home : t.away) : undefined;
};
const cupTreeTie = (t: CupTie): TreeTie => ({
  a: t.home, b: t.away, sa: t.hs, sb: t.as, winner: cupWinner(t),
  note: t.pens ? `${t.pens.home}-${t.pens.away} on penalties` : undefined,
});

/** The last 8 to the final, in tree order: each tie sits under the tie its
 *  winner came from. A cup is drawn from a hat each round, so the order is
 *  traced back from the latest round drawn. Rounds not drawn yet are "?". */
export function cupTreeColumns(cup: Pick<CupState, "rounds">): TreeColumn[] {
  const cols = TREE_ROUNDS.map(n => cup.rounds.find(r => r.name === n)?.ties ?? []);
  const sizes = [4, 2, 1];
  let last = -1;
  cols.forEach((c, i) => { if (c.length) last = i; });
  const ordered: (CupTie | null)[][] = sizes.map(s => Array(s).fill(null));
  if (last >= 0) {
    ordered[last] = [...cols[last]].slice(0, sizes[last]);
    while (ordered[last].length < sizes[last]) ordered[last].push(null);
    for (let k = last - 1; k >= 0; k--) {
      const used = new Set<CupTie>();
      const out: (CupTie | null)[] = [];
      for (const t of ordered[k + 1]) {
        for (const club of t ? [t.home, t.away] : [undefined, undefined]) {
          const from = club ? cols[k].find(x => !used.has(x) && (x.home === club || x.away === club)) : undefined;
          if (from) { used.add(from); out.push(from); } else out.push(null);
        }
      }
      const rest = cols[k].filter(x => !used.has(x));
      ordered[k] = out.map(x => x ?? rest.shift() ?? null);
    }
  }
  return TREE_ROUNDS.map((name, i) => ({ name, ties: ordered[i].map(t => (t ? cupTreeTie(t) : {})) }));
}

/** A cup round before the last 8, as one card (the website's list round). */
export function CupRoundCard({ round, glow, you }: { round: CupState["rounds"][number]; glow: string; you: string }) {
  return (
    <View style={[...card(glow), { padding: 6 }]}>
      <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}><CardTitle>{round.name} · {round.ties.length} ties</CardTitle></View>
      <View style={{ gap: 4 }}>
        {round.ties.map(t => (
          <TieLine key={`${t.home}-${t.away}`} a={t.home} b={t.away} score={t.hs !== undefined ? `${t.hs}-${t.as}` : "v"} winner={cupWinner(t)}
            note={t.pens ? `${t.pens.home}-${t.pens.away} on penalties` : undefined} noteColor={AMBER} mine={t.home === you || t.away === you} glow={glow} />
        ))}
      </View>
      {round.byes && round.byes.length > 0 ? (
        <Text style={{ paddingHorizontal: 4, paddingTop: 6, color: "#fff", fontSize: 10.5, lineHeight: 14.5, fontWeight: "700" }}>
          <Text style={{ color: AMBER }}>Through on a bye ({round.byes.length}): </Text>{round.byes.map(shortClub).join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}
