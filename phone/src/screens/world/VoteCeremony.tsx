/**
 * THE VOTE — the phone port of components/star/VoteCeremony.tsx. The tally is
 * already decided (lib/star/voting.ts); this shows it: you put the proposal
 * to the room, the room writes it down, the board counts (fast, then slow),
 * then the pass/fail stamp, with "Overrule" offered after a fail when your
 * stake or influence allows it. Done resolves the vote (world/politics.ts
 * resolveVote) and goes back to the boardroom or the Rule Book, as page.tsx.
 *
 * Params: { vote: PendingVote }.
 */
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { OVERRULE_REPUTATION_COST } from "@/lib/star/voting";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Frame, Card, Btn, C } from "../../world/lookKit";
import { canOverrule, resolveVote, voteBack, voteScope, voteSuccessId, type PendingVote } from "../../world/politics";

const BAR: [string, string][] = [["#10b981", "#6ee7b7"], ["#ef4444", "#fca5a5"], ["#3b82f6", "#93c5fd"], ["#f59e0b", "#fde68a"], ["#8b5cf6", "#c4b5fd"]];
const SCOPE_LABEL = { boardroom: "Shareholders' Meeting", fans: "Fan Vote", public: "Public Vote", "governing-body": "Governing Body Vote" } as const;
const SCOPE_ICON = { boardroom: "🏛️", fans: "🧣", public: "🌍", "governing-body": "⚖️" } as const;
type Stage = "podium" | "crowd" | "counting" | "result";
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function VoteCeremonyScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const vote = params?.vote as PendingVote | undefined;
  const tally = vote?.proposal.tally;
  const [stage, setStage] = useState<Stage>("podium");
  const [t, setT] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (stage !== "counting") return;
    const start = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / 1800);
      setT(ease(k));
      if (k >= 1) { clearInterval(id); setStage("result"); }
    }, 33);
    return () => clearInterval(id);
  }, [stage]);
  // Leaving with the phone's back button still settles the vote (the result stands).
  useEffect(() => () => { if (vote && !done.current) { done.current = true; resolveVote(vote, false); } }, [vote]);

  if (!career || !vote || !tally) return null;
  const scope = voteScope(vote);
  const successId = voteSuccessId(vote) ?? tally.options[0].id;
  const passed = tally.winner === successId;
  const overrulable = canOverrule(career, vote);
  const total = Object.values(tally.counts).reduce((a, b) => a + b, 0) + tally.abstentions;
  const finish = (overrule: boolean) => {
    if (done.current) return;
    done.current = true;
    resolveVote(vote, overrule);
    const back = voteBack(vote);
    nav.replace(back.screen, back.params as Record<string, unknown> | undefined);
  };

  return (
    <Frame title={SCOPE_LABEL[scope]} kicker={SCOPE_ICON[scope]}>
      {stage === "podium" && (
        <>
          <Card>
            <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" }}>📸  YOU PUT IT TO THE ROOM  📸</Text>
            <Text style={{ color: C.text, fontSize: 19, fontWeight: "900", textAlign: "center", marginTop: 8 }}>{tally.question}</Text>
            <View style={{ marginTop: 12, height: 22, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: "#78350f", borderTopWidth: 2, borderTopColor: "#b45309" }} />
          </Card>
          <Btn label="Present the Proposal" onPress={() => setStage("crowd")} />
        </>
      )}
      {stage === "crowd" && (
        <>
          <Card>
            <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: "center", marginBottom: 10 }}>THE ROOM TAKES IT IN</Text>
            {[7, 9, 7].map((n, r) => (
              <View key={r} style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                {Array.from({ length: n }).map((_, i) => <View key={i} style={{ width: 16, height: 20, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: "rgba(255,255,255,0.3)" }} />)}
              </View>
            ))}
            <Text style={{ color: C.text, fontSize: 11, fontWeight: "700", textAlign: "center" }}>Everyone's writing it down.</Text>
          </Card>
          <Btn label="Look to the Board — Call the Vote" onPress={() => setStage("counting")} />
        </>
      )}
      {(stage === "counting" || stage === "result") && (
        <>
          <Card><Text style={{ color: C.text, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{tally.question}</Text></Card>
          <Card style={{ padding: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10 }}>
              <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>THE BOARD</Text>
              <Text style={{ color: stage === "counting" ? C.gold : C.text, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{stage === "counting" ? "COUNTING…" : "FINAL COUNT"}</Text>
            </View>
            {tally.options.map((o, i) => {
              const count = Math.round((tally.counts[o.id] ?? 0) * (stage === "result" ? 1 : t));
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const leader = stage === "result" && o.id === tally.winner;
              const [c0, c1] = BAR[i % BAR.length];
              return (
                <View key={o.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.line }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={{ color: C.text, fontWeight: "900" }}>{o.label}{leader ? <Text style={{ color: C.gold, fontSize: 10 }}>  MOST VOTES</Text> : null}</Text>
                    <Text style={{ color: leader ? c1 : C.text, fontWeight: "900", fontSize: 19 }}>{count.toLocaleString("en-GB")}<Text style={{ color: C.dim, fontSize: 11 }}> {pct}%</Text></Text>
                  </View>
                  <View style={{ height: 14, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.55)", overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: "100%", borderRadius: 7, backgroundColor: c0 }} />
                  </View>
                </View>
              );
            })}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>Abstentions</Text>
              <Text style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>{Math.round(tally.abstentions * (stage === "result" ? 1 : t)).toLocaleString("en-GB")}</Text>
            </View>
          </Card>
          {stage === "result" && (
            <>
              <View style={{ borderRadius: 14, padding: 12, alignItems: "center", backgroundColor: passed ? "rgba(6,95,70,0.8)" : "rgba(127,29,29,0.8)", borderWidth: 2, borderColor: passed ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.55)" }}>
                <Text style={{ color: passed ? "#6ee7b7" : "#fca5a5", fontSize: 18, fontWeight: "900", letterSpacing: 2 }}>{passed ? "THE VOTE PASSES" : "THE VOTE FAILS"}</Text>
              </View>
              {passed || !overrulable ? (
                <Btn kind={passed ? "primary" : "plain"} label="Continue" onPress={() => finish(false)} />
              ) : (
                <>
                  <Btn kind="danger" label={`Overrule — costs ${OVERRULE_REPUTATION_COST} shareholder reputation`} onPress={() => finish(true)} />
                  <Btn kind="plain" small label="Accept the result" onPress={() => finish(false)} />
                </>
              )}
            </>
          )}
        </>
      )}
    </Frame>
  );
}
