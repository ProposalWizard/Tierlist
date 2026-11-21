/**
 * ACHIEVEMENTS AND THE CONTRACT, as the website draws them:
 *   AchievementWall     components/star/AchievementWall.tsx: the gold ring "1/67 · 1% DONE",
 *                       the four tier bars, NEARLY THERE, the filter chips, the medals group by
 *                       group, and a medal's detail sheet.
 *   Medal / AchievementMedal   the gold medal with its tier rim (dark with a padlock until earned).
 *   AchievementToasts   components/star/UnlockChain.tsx: "ACHIEVEMENT 2 OF 3", the medal and its
 *                       tier, the star bar on the first card, a timer line; each makes way for the next.
 *   AchievementToast    the small banner at the top ("ACHIEVEMENT UNLOCKED" / "RECORD BROKEN").
 *   ContractPaper       components/star/ContractPaper.tsx: the cream sheet with both signatures.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Text, View, type ViewStyle } from "react-native";
import { Canvas, Group, Path, Skia, LinearGradient, vec } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, type Achievement, type AchievementTier } from "@/lib/star/achievements";
import { formatMoney } from "@/lib/star/money";
import { achievementXp } from "@/lib/star/xpConfig";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { Press } from "../../ui/Press";
import { LookButton } from "../../ui/look";
import { TopSpace } from "../../ui/safe";
import { ClubCrest } from "./kit";

const TIER: Record<AchievementTier, { label: string; rim: string; ink: string }> = {
  easy: { label: "Bronze", rim: "#cd7f32", ink: "#f2b27a" },
  medium: { label: "Silver", rim: "#d9dee5", ink: "#e5e9ef" },
  hard: { label: "Gold", rim: "#fbbf24", ink: "#fde68a" },
  legendary: { label: "Legend", rim: "#c084fc", ink: "#ddb8ff" },
};
const TIERS: AchievementTier[] = ["easy", "medium", "hard", "legendary"];
type Filter = "all" | "done" | "todo" | "near";
const NEAR = 0.5;

const shortMoney = (v: number) => (v >= 1_000_000 ? `★${+(v / 1_000_000).toFixed(1)}m` : v >= 1_000 ? `★${Math.floor(v / 1_000)}k` : `★${formatMoney(v)}`);
const progressOf = (a: Achievement, c: CareerState): [number, number] | null => {
  if (!a.progress) return null;
  try { return a.progress(c); } catch { return null; }
};
const fmt = (a: Achievement, v: number) => (a.money ? shortMoney(v) : v.toLocaleString("en-GB"));

export function Medal({ a, size, done }: { a: Achievement; size: number; done: boolean }) {
  const t = TIER[a.tier];
  if (!done) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
        backgroundImage: "radial-gradient(circle at 35% 30%, #2a3530 0%, #17201b 70%)", boxShadow: "inset 0px 0px 0px 3px rgba(255,255,255,0.08)" } as ViewStyle}>
        <Text style={{ fontSize: size * 0.42, lineHeight: size * 0.56, opacity: 0.28 }}>{a.icon}</Text>
        <Text style={{ position: "absolute", right: -2, bottom: -2, fontSize: size * 0.26, lineHeight: size * 0.34 }}>🔒</Text>
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
      backgroundImage: "radial-gradient(circle at 35% 28%, #fff8c9 0%, #fde047 22%, #f5b70b 55%, #b45309 100%)",
      boxShadow: `0px 0px 0px 3px ${t.rim}, 0px 0px 18px -2px rgba(251,191,36,0.75), inset 0px -6px 10px rgba(146,64,14,0.55), inset 0px 4px 8px rgba(255,255,255,0.55)` } as ViewStyle}>
      <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.58 }}>{a.icon}</Text>
    </View>
  );
}

/** The gold medal for an achievement found by its label, with its tier under it. Not on the list: null. */
export function AchievementMedal({ label, size = 56 }: { label: string; size?: number }) {
  const a = ACHIEVEMENTS.find((x) => x.label === label);
  if (!a) return null;
  return (
    <View style={{ alignItems: "center" }}>
      <Medal a={a} size={size} done />
      <Text style={{ marginTop: 5, color: TIER[a.tier].ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>{TIER[a.tier].label.toUpperCase()}</Text>
    </View>
  );
}
export const tierOfLabel = (label: string): string | null => {
  const a = ACHIEVEMENTS.find((x) => x.label === label);
  return a ? TIER[a.tier].label : null;
};

function ProgressBar({ have, need, h = 5 }: { have: number; need: number; h?: number }) {
  return (
    <View style={{ alignSelf: "stretch", height: h, borderRadius: h / 2, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.45)" }}>
      <View style={{ height: "100%", borderRadius: h / 2, width: `${Math.min(100, Math.max(3, (100 * have) / Math.max(1, need)))}%`, backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as ViewStyle} />
    </View>
  );
}

/** The gold ring: a track and an arc for how many are done (AchievementWall Ring, 108 px, radius 46, 10 thick). */
function Ring({ got, total }: { got: number; total: number }) {
  const S = 108, r = 46;
  const { track, arc } = useMemo(() => {
    const oval = Skia.XYWHRect(S / 2 - r, S / 2 - r, r * 2, r * 2);
    const t = Skia.PathBuilder.Make(); t.addArc(oval, 0, 359.99);
    const p = Skia.PathBuilder.Make();
    const sweep = Math.min(359.9, (360 * got) / Math.max(1, total));
    if (sweep > 0) p.addArc(oval, -90, sweep);
    return { track: t.build(), arc: p.build() };
  }, [got, total]);
  return (
    <View style={{ width: S, height: S }}>
      <Canvas style={{ width: S, height: S }}>
        <Path path={track} style="stroke" strokeWidth={10} color="rgba(0,0,0,0.45)" />
        <Path path={arc} style="stroke" strokeWidth={10} strokeCap="round">
          <LinearGradient start={vec(0, 0)} end={vec(S, S)} colors={["#fff7c2", "#fde047", "#f59e0b"]} />
        </Path>
      </Canvas>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fde047", fontSize: 26, lineHeight: 28, fontWeight: "900", textShadowColor: "rgba(180,83,9,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>{got}/{total}</Text>
        <Text style={{ color: "#fde68a", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 }}>{Math.round((100 * got) / Math.max(1, total))}% DONE</Text>
      </View>
    </View>
  );
}

export function AchievementWall({ career }: { career: CareerState }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Achievement | null>(null);
  const done = useMemo(() => new Set(career.achievements ?? []), [career.achievements]);
  const got = ACHIEVEMENTS.filter((a) => done.has(a.id)).length;
  const near = useMemo(() => ACHIEVEMENTS
    .filter((a) => !done.has(a.id))
    .map((a) => ({ a, p: progressOf(a, career) }))
    .filter((x): x is { a: Achievement; p: [number, number] } => !!x.p && x.p[0] < x.p[1] && x.p[0] / x.p[1] >= NEAR)
    .sort((x, y) => y.p[0] / y.p[1] - x.p[0] / x.p[1]), [career, done]);
  const nearIds = new Set(near.map((x) => x.a.id));
  const shown = (a: Achievement) => filter === "all" || (filter === "done" ? done.has(a.id) : filter === "todo" ? !done.has(a.id) : nearIds.has(a.id));
  return (
    <View style={{ paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 18, padding: 16,
        backgroundImage: "linear-gradient(135deg, rgba(253,224,71,0.22), rgba(245,158,11,0.08) 60%, rgba(0,0,0,0.2))", boxShadow: "inset 0px 0px 0px 1.5px rgba(253,224,71,0.55)" } as ViewStyle}>
        <Ring got={got} total={ACHIEVEMENTS.length} />
        <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
          {TIERS.map((t) => {
            const all = ACHIEVEMENTS.filter((a) => a.tier === t);
            const g = all.filter((a) => done.has(a.id)).length;
            return (
              <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: TIER[t].rim }} />
                <Text style={{ width: 50, color: "#fff", fontSize: 12, fontWeight: "800" }}>{TIER[t].label}</Text>
                <View style={{ flex: 1, minWidth: 0, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.4)" }}>
                  <View style={{ height: "100%", borderRadius: 3, width: `${(100 * g) / Math.max(1, all.length)}%`, backgroundColor: TIER[t].rim }} />
                </View>
                <Text style={{ width: 38, textAlign: "right", color: "#fde68a", fontSize: 12, fontWeight: "800" }}>{g}/{all.length}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {near.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2.2, marginBottom: 8, paddingHorizontal: 4 }}>NEARLY THERE</Text>
          {near.slice(0, 3).map(({ a, p }) => (
            <Press key={a.id} onPress={() => setOpen(a)} style={{ marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10, backgroundColor: "rgba(255,255,255,0.06)" }}>
              <Medal a={a} size={40} done={false} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 13, fontWeight: "900" }}>{a.label}</Text>
                  <Text style={{ color: "#fde68a", fontSize: 13, fontWeight: "900" }}>{fmt(a, p[0])}/{fmt(a, p[1])}</Text>
                </View>
                <View style={{ marginTop: 6 }}><ProgressBar have={p[0]} need={p[1]} h={6} /></View>
              </View>
            </Press>
          ))}
        </View>
      )}

      <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {([["all", "All"], ["done", "Completed"], ["todo", "Not completed"], ["near", "Nearly there"]] as const).map(([k, l]) => (
          <Press key={k} onPress={() => setFilter(k)} style={[{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
            (filter === k ? { backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } : { backgroundColor: "rgba(255,255,255,0.08)" }) as ViewStyle]}>
            <Text style={{ color: filter === k ? "#2a1700" : "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "900" }}>{l}</Text>
          </Press>
        ))}
      </View>

      {ACHIEVEMENT_GROUPS.map((g) => {
        const all = ACHIEVEMENTS.filter((a) => a.group === g);
        const list = all.filter(shown);
        if (!list.length) return null;
        const n = all.filter((a) => done.has(a.id)).length;
        return (
          <View key={g}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 8, paddingTop: 16 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 2.2 }}>{g.toUpperCase()}</Text>
              <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900" }}>{n} / {all.length}{n === all.length ? "  ✓ COMPLETE" : ""}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 14 }}>
              {list.map((a) => {
                const isDone = done.has(a.id);
                const p = isDone ? null : progressOf(a, career);
                return (
                  <Press key={a.id} onPress={() => setOpen(a)} style={{ width: "33.33%", alignItems: "center", paddingHorizontal: 4 }}>
                    <Medal a={a} size={62} done={isDone} />
                    <Text numberOfLines={2} style={{ marginTop: 7, textAlign: "center", color: isDone ? "#fde68a" : "rgba(255,255,255,0.72)", fontSize: 11, lineHeight: 13.5, fontWeight: "900" }}>{a.label}</Text>
                    {p ? (
                      <>
                        <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: "800" }}>{fmt(a, p[0])}/{fmt(a, p[1])}</Text>
                        <View style={{ marginTop: 4, width: 62 }}><ProgressBar have={p[0]} need={p[1]} /></View>
                      </>
                    ) : <Text style={{ marginTop: 2, color: TIER[a.tier].ink, fontSize: 9.5, fontWeight: "800" }}>{TIER[a.tier].label}</Text>}
                  </Press>
                );
              })}
            </View>
          </View>
        );
      })}
      {open && <Detail a={open} career={career} done={done.has(open.id)} onClose={() => setOpen(null)} />}
    </View>
  );
}

function Detail({ a, career, done, onClose }: { a: Achievement; career: CareerState; done: boolean; onClose: () => void }) {
  const p = done ? null : progressOf(a, career);
  const t = TIER[a.tier];
  const ofTier = ACHIEVEMENTS.filter((x) => x.tier === a.tier).length;
  let xp = 0;
  try { xp = achievementXp(a.id); } catch { xp = 0; }
  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Press onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", alignItems: "center" }}>
        <Press onPress={() => {}} style={{ width: "100%", maxWidth: 448, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20, alignItems: "center",
          backgroundImage: "linear-gradient(180deg, #1b2a21, #0b1510)", boxShadow: "0px -10px 40px rgba(0,0,0,0.6)" } as ViewStyle}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 16 }} />
          <Medal a={a} size={104} done={done} />
          <Text style={{ marginTop: 12, color: t.rim, fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{t.label.toUpperCase()} · {a.group.toUpperCase()}</Text>
          <Text style={{ marginTop: 4, color: done ? "#fde047" : "#fff", fontSize: 26, lineHeight: 30, fontWeight: "900", textAlign: "center" }}>{a.label.toUpperCase()}</Text>
          <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center" }}>{a.description}</Text>
          {done && <Text style={{ marginTop: 12, color: "#fde68a", fontSize: 13, fontWeight: "900" }}>✓ Completed</Text>}
          {p && (
            <View style={{ marginTop: 16, width: "100%", maxWidth: 280 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{fmt(a, p[0])}</Text>
                <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "900" }}>{fmt(a, p[1])}</Text>
              </View>
              <View style={{ marginTop: 6 }}><ProgressBar have={p[0]} need={p[1]} h={10} /></View>
              <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.75)", fontSize: 11.5, textAlign: "center" }}>{fmt(a, p[1] - p[0])} to go</Text>
            </View>
          )}
          <Text style={{ marginTop: 16, color: "#fde68a", fontSize: 13, fontWeight: "900" }}>{done ? "Earned" : "Worth"} +{xp.toLocaleString("en-GB")} XP</Text>
          <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800" }}>One of {ofTier} {t.label} achievements</Text>
          <Press onPress={onClose} style={{ marginTop: 16, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 20, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>Close</Text>
          </Press>
        </Press>
      </Press>
    </Modal>
  );
}

// ── The pop-ups ──────────────────────────────────────────────────────────────

/** Where the star rating stood before and after (UnlockChain.tsx StarStep). */
export type StarStep = { stars: number; toNext: number };

function StarBar({ from, to }: { from: StarStep; to: StarStep }) {
  const up = Math.floor(to.stars) > Math.floor(from.stars);
  const start = Math.round(from.toNext * 100);
  const end = up ? 100 : Math.max(start, Math.round(to.toNext * 100));
  const w = useRef(new Animated.Value(start)).current;
  const [full, setFull] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => Animated.timing(w, { toValue: end, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setFull(end >= 100)), 250);
    return () => clearTimeout(t);
  }, [end, w]);
  return (
    <View style={{ marginTop: 10, alignSelf: "stretch" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>STAR RATING</Text>
        <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 }}>{up && full ? `★ ${Math.floor(to.stars)} REACHED` : `★ ${Math.floor(from.stars)} → ${Math.floor(from.stars) + 1}`}</Text>
      </View>
      <View style={{ height: 12, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(252,211,77,0.4)" }}>
        <Animated.View style={{ height: "100%", width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as never} />
      </View>
    </View>
  );
}

/** One card at a time: slams in, holds, makes way for the next; a tap moves it on sooner. Low on the screen. */
export function AchievementToasts({ items, onDone, hold = 2400, star, bottom = 104 }: {
  items: { label: string; description: string }[]; onDone: () => void; hold?: number; star?: { from: StarStep; to: StarStep }; bottom?: number;
}) {
  const [k, setK] = useState(0);
  const a = items[k];
  const done = useRef(onDone);
  done.current = onDone;
  const slam = useRef(new Animated.Value(0)).current;
  const timer = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!a) { done.current(); return; }
    slam.setValue(0); timer.setValue(1);
    Animated.timing(slam, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }).start();
    Animated.timing(timer, { toValue: 0, duration: hold, easing: Easing.linear, useNativeDriver: true }).start();
    const t = setTimeout(() => setK((n) => n + 1), hold);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  if (!a) return null;
  const tier = tierOfLabel(a.label);
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", paddingHorizontal: 24, zIndex: 95 }}>
      <Animated.View style={{ width: "100%", maxWidth: 320, opacity: slam.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: slam.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] }) }] }}>
        <Press onPress={() => setK((n) => n + 1)} style={{ borderRadius: 16, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 10, alignItems: "center", overflow: "hidden",
          backgroundImage: "linear-gradient(180deg, #3b2a06, #0b1220)", boxShadow: "inset 0px 0px 0px 2px rgba(251,191,36,0.85), 0px 0px 30px rgba(251,191,36,0.35), 0px 18px 40px -10px rgba(0,0,0,0.9)" } as ViewStyle}>
          <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 2.4 }}>ACHIEVEMENT{items.length > 1 ? ` ${k + 1} OF ${items.length}` : ""}{tier ? ` · ${tier.toUpperCase()}` : ""}</Text>
          {tier
            ? <View style={{ marginTop: 8 }}><AchievementMedal label={a.label} size={64} /></View>
            : <Text style={{ marginTop: 4, fontSize: 40, lineHeight: 48, textShadowColor: "rgba(251,191,36,0.8)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } }}>⭐</Text>}
          <Text style={{ marginTop: 4, color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "900", textAlign: "center" }}>{a.label}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{a.description}</Text>
          {star && k === 0 && <StarBar from={star.from} to={star.to} />}
          <View style={{ marginTop: 8, alignSelf: "stretch", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)" }}>
            <Animated.View style={{ height: "100%", width: "100%", backgroundColor: "#fcd34d", transformOrigin: "left", transform: [{ scaleX: timer }] } as never} />
          </View>
        </Press>
      </Animated.View>
    </View>
  );
}

/** The small banner at the top for about three seconds (UnlockChain.tsx AchievementToast). */
export function AchievementToast({ label, unlocked, record, onClose }: { label: string; unlocked: string; record?: boolean; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { const t = setTimeout(() => close.current(), 2800); return () => clearTimeout(t); }, []);
  const a = !record ? ACHIEVEMENTS.find((x) => x.label === label) : undefined;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", paddingHorizontal: 16, zIndex: 95 }}>
      <TopSpace min={64} pad={64} />
      <Press onPress={onClose} style={{ width: "100%", maxWidth: 360, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
        backgroundImage: "linear-gradient(180deg, rgba(31,41,55,0.97), rgba(11,18,32,0.97))", boxShadow: "inset 0px 0px 0px 1px rgba(251,191,36,0.55), 0px 12px 30px -10px rgba(0,0,0,0.9)" } as ViewStyle}>
        {a ? <Medal a={a} size={40} done /> : <Text style={{ fontSize: 28 }}>{record ? "🏆" : "⭐"}</Text>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{record ? "RECORD BROKEN" : "ACHIEVEMENT UNLOCKED"}</Text>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{label}</Text>
          <Text numberOfLines={1} style={{ color: "#a7f3d0", fontSize: 12, fontWeight: "700" }}>{unlocked}</Text>
        </View>
      </Press>
    </View>
  );
}

// ── The contract, on paper ───────────────────────────────────────────────────
const INK = "#1b140a", SOFT = "#6b5630", RULE = "rgba(59,47,28,0.2)";
const CLUB_SIG = "M10 40 C 30 10, 50 50, 70 26 S 110 18, 130 36 S 170 44, 200 22 S 250 30, 290 26";
/** TrialReward.tsx SIGNATURE_D: the hand-written name. */
const SIGNATURE_D = "M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40";

function Signature({ d, color }: { d: string; color: string }) {
  const [w, setW] = useState(0);
  const path = useMemo(() => {
    const p = Skia.Path.MakeFromSVGString(d);
    if (!p || w <= 0) return null;
    // the drawing is 300×60, shown 24 tall and as wide as its box (not stretched: centred)
    const k = Math.min(w / 300, 24 / 60);
    return { p, k, dx: (w - 300 * k) / 2, dy: (24 - 60 * k) / 2 };
  }, [d, w]);
  return (
    <View style={{ height: 24 }} onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}>
      {path && (
        <Canvas style={{ width: w, height: 24 }}>
          <Group transform={[{ translateX: path.dx }, { translateY: path.dy }, { scale: path.k }]}>
            <Path path={path.p} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color={color} />
          </Group>
        </Canvas>
      )}
    </View>
  );
}

export function ContractPaper({ career, onRenew }: { career: CareerState; onRenew: () => void }) {
  const c = career.contract;
  const clauses = clauseSummary(c);
  const playerName = `${career.player.firstName} ${career.player.lastName}`.trim();
  const terms: [string, string][] = [
    ["League", leagueNameFor(divisionOf(career))],
    ["Position", career.player.position],
    ["Shirt", career.squadNumber ? `No. ${career.squadNumber}` : "—"],
    ["Seasons left", String(c.seasonsRemaining)],
    ["Wage", `★${formatMoney(c.wage)} / week`],
    ["Goal bonus", `★${formatMoney(c.goalBonus)}`],
    ["Assist bonus", `★${formatMoney(c.assistBonus)}`],
  ];
  const serif = { fontFamily: "serif" } as const;
  return (
    <View>
      <View style={{ marginTop: 4, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12, borderRadius: 4,
        backgroundImage: "linear-gradient(180deg, #fbf8f0, #efe9da)", boxShadow: "0px 14px 26px -12px rgba(0,0,0,0.8), inset 0px 0px 0px 1px rgba(160,120,40,0.35)" } as ViewStyle}>
        <Text style={[serif, { color: "#8a6a23", fontSize: 9, fontWeight: "700", letterSpacing: 2.7, textAlign: "center" }]}>PROFESSIONAL CONTRACT</Text>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ClubCrest club={c.club} size={30} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[serif, { color: INK, fontSize: 22, lineHeight: 26, fontWeight: "900", flexShrink: 1 }]}>{c.club}</Text>
        </View>
        <Text style={[serif, { marginTop: 4, color: SOFT, fontSize: 11, fontStyle: "italic", textAlign: "center" }]}>between the club and {playerName}</Text>
        <View style={{ marginTop: 12, gap: 4 }}>
          {terms.map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: RULE }}>
              <Text style={[serif, { color: SOFT, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 }]}>{label.toUpperCase()}</Text>
              <Text numberOfLines={1} style={[serif, { color: INK, fontSize: 14, fontWeight: "900", flexShrink: 1 }]}>{value}</Text>
            </View>
          ))}
        </View>
        <Text style={[serif, { marginTop: 12, color: "#8a6a23", fontSize: 9, fontWeight: "700", letterSpacing: 1.8 }]}>CLAUSES</Text>
        {clauses.length > 0 ? clauses.map((cl, i) => (
          <Text key={cl.label} style={[serif, { marginTop: 4, color: INK, fontSize: 12, lineHeight: 16 }]}><Text style={{ fontWeight: "900" }}>{i + 1}. {cl.label}.</Text> {cl.detail}</Text>
        )) : <Text style={[serif, { marginTop: 4, color: SOFT, fontSize: 12, fontStyle: "italic" }]}>No clauses in this one. Ask for some at the next renewal.</Text>}
        <View style={{ marginTop: 16, flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Signature d={CLUB_SIG} color="#1e3a8a" />
            <Text numberOfLines={1} style={[serif, { borderTopWidth: 1, borderTopColor: "rgba(59,47,28,0.7)", paddingTop: 2, color: SOFT, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.3 }]}>FOR {c.club.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Signature d={SIGNATURE_D} color="#0f172a" />
            <Text numberOfLines={1} style={[serif, { borderTopWidth: 1, borderTopColor: "rgba(59,47,28,0.7)", paddingTop: 2, color: SOFT, fontSize: 8.5, fontWeight: "700", letterSpacing: 0.3 }]}>{playerName.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      {/* PressButton variant "primary" on the Stats page is the yellow one in the pitch look. */}
      <LookButton kind="gold" onPress={onRenew} style={{ marginTop: 12, borderRadius: 12 }}>
        <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>PROPOSE RENEWAL</Text>
      </LookButton>
    </View>
  );
}
