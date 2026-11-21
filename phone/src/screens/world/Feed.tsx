/**
 * THE FEED — the phone port of components/star/MediaFeed.tsx, PostCard.tsx and
 * TransfersPanel.tsx. It reads and never writes posts: everything on it was
 * written at full time by lib/star/media (feedFor decides what is visible
 * now). Feed and Transfers tabs, All / England / Club filters, the trending
 * ticker, every post with its replies, likes (toggleLike) and the Goal of the
 * Month poll (voteGoalOfMonth, behind the same switch as the website).
 *
 * Goal videos play from the goal's recording on this phone (screens/MatchGoalVideo.tsx);
 * a post whose recordings are not here shows its still, as on the website.
 */
import { Animated, Easing } from "react-native";
import { Canvas, ImageSVG, Skia } from "@shopify/react-native-skia";
import { SvgIcon } from "../../world/SvgIcon";
import { AVATAR_GLYPH } from "../../world/avatarGlyphs";
import { useEffect as useEffectT, useRef as useRefT, useState as useStateT } from "react";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { StoredPost, GraphicSpec, PostReply, QuotedPost } from "@/lib/star/media/types";
import { feedFor, toggleLike, voteGoalOfMonth } from "@/lib/star/media/feed";
import { formatVolume } from "@/lib/star/media/trending";
import { relativeTime } from "@/lib/star/media/schedule";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import { seasonStartYear } from "@/lib/star/calendar";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { formatMoneyPrecise } from "@/lib/star/money";
import { setCareer, getCareer } from "../../game/store";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { ClubBadge, Empty, Title } from "../../world/ui";
import { GoalVideo } from "../MatchGoalVideo";
import { clipStyleFor, clipVariantFor, type PostAuthor } from "@/lib/star/media/clipStyle";
import type { ClipStyle } from "@/lib/star/goalClip/edit";
import { isColdStyle } from "@/lib/star/goalClip/editCold";

const FILTERS: { id: string; label: string; scope?: "club" | "league" }[] = [
  { id: "all", label: "All" }, { id: "england", label: "England", scope: "league" }, { id: "club", label: "Club", scope: "club" },
];
const LIKED = "#f91880";
const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

/** The feed app. `mode` "moment" is the post-match reaction (a Continue button); "browse" is the phone's Social app. */
export function MediaFeed({ career, mode = "browse", onContinue }: { career: CareerState; mode?: "moment" | "browse"; onContinue?: () => void }) {
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"feed" | "transfers">("feed");
  const gotmOn = leoUpdateOn("goalOfMonth");
  const { posts, trends, now } = useMemo(() => feedFor(career, mode === "moment" ? "moment" : "settled"), [career, mode]);
  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter);
    const all = gotmOn ? posts : posts.filter(p => p.graphic?.type !== "gotmPoll" && !String(p.eventId ?? "").startsWith("gotm-"));
    return f?.scope ? all.filter(p => p.scope === f.scope) : all;
  }, [posts, filter, gotmOn]);
  const like = (id: string) => { const c = getCareer(); if (c) setCareer(toggleLike(c, id)); };
  const vote = (id: string, i: number) => { const c = getCareer(); if (c) setCareer(voteGoalOfMonth(c, id, i)); };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(160deg, #34d399, #047857)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.45), 0px 4px 8px -3px rgba(0,0,0,0.7)" } as ViewStyle}><Text style={{ fontSize: 14 }}>⚽</Text></View>
        <Text style={{ flex: 1, color: C.text, fontWeight: "900", fontSize: 14 }}>{mode === "moment" ? "Post Match Reactions" : "Matchday"}</Text>
        {mode === "moment" && onContinue && (
          <Press onPress={onContinue} style={{ backgroundImage: "linear-gradient(180deg, #34d399, #10b981)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35)" } as ViewStyle}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>Continue →</Text>
          </Press>
        )}
      </View>
      {tab === "transfers" ? <TransfersPanel career={career} /> : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          initialNumToRender={6}
          windowSize={5}
          ListHeaderComponent={
            <View>
              {trends.length > 0 && (
                <Ticker>
                  {trends.map((t) => (
                    <View key={t.label} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 }}>
                      <Text style={{ color: C.text, fontWeight: "900", fontSize: 11 }}>{t.label}{t.hot ? " 🔥" : ""}</Text>
                      <Text style={{ color: C.dim, fontWeight: "700", fontSize: 10 }}>{formatVolume(t.volume)}</Text>
                    </View>
                  ))}
                </Ticker>
              )}
              {mode === "browse" && (
                <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6 }}>
                  {FILTERS.map(f => (
                    <Press key={f.id} onPress={() => setFilter(f.id)} style={[{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 5 }, filter === f.id
                      ? ({ backgroundImage: "linear-gradient(180deg, #34d399, #059669)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35), 0px 0px 10px rgba(52,211,153,0.45)" } as ViewStyle)
                      : ({ backgroundColor: "rgba(255,255,255,0.08)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12)" } as ViewStyle)]}>
                      <Text style={{ color: filter === f.id ? "#022c22" : "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 10.5, letterSpacing: 0.4 }}>{f.label.toUpperCase()}</Text>
                    </Press>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={<EmptyFeed />}
          ListFooterComponent={shown.length > 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: C.dim, fontWeight: "900" }}>You’re all caught up.</Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontWeight: "700", fontSize: 11 }}>Touch grass.</Text>
            </View>
          ) : undefined}
          renderItem={({ item }) => <PostCard post={item} now={now} onLike={like} onVote={gotmOn ? vote : undefined} />}
        />
      )}
      {mode === "browse" && (
        <View style={{ flexDirection: "row", gap: 6, padding: 6, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
          {(["feed", "transfers"] as const).map((t) => (
            <Press key={t} onPress={() => setTab(t)} style={[{ flex: 1, alignItems: "center", justifyContent: "center", height: 42, borderRadius: 12 }, tab === t && ({ backgroundColor: "rgba(255,255,255,0.08)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12)" } as ViewStyle)]}>
              <Text style={{ fontSize: 15, color: tab === t ? "#fff" : "rgba(255,255,255,0.45)" }}>{t === "feed" ? "⌂" : "⇄"}</Text>
              <Text style={{ color: tab === t ? "#fff" : "rgba(255,255,255,0.45)", fontWeight: "900", fontSize: 9.5, letterSpacing: 0.8 }}>{t === "feed" ? "FEED" : "TRANSFERS"}</Text>
            </Press>
          ))}
        </View>
      )}
    </View>
  );
}

/** Nothing posted yet: the website's empty feed (ghost post rows and a mailbox). */
function EmptyFeed() {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, gap: 18 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: 1 - i * 0.18 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.06)" }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ width: "48%", height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)" }} />
            <View style={{ width: "88%", height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" }} />
          </View>
        </View>
      ))}
      <Text style={{ position: "absolute", alignSelf: "center", top: 70, fontSize: 30 }}>📭</Text>
    </View>
  );
}

/** The trending strip scrolls by itself, round and round (MediaFeed's ticker): the row is drawn twice and slides one row's width. */
function Ticker({ children }: { children: React.ReactNode }) {
  const [w, setW] = useStateT(0);
  const x = useRefT(new Animated.Value(0)).current;
  useEffectT(() => {
    if (w <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: w * 38, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w, x]);
  return (
    <View style={{ overflow: "hidden", paddingVertical: 10 }}>
      <Animated.View style={{ flexDirection: "row", paddingLeft: 10, transform: [{ translateX: x }] }}>
        <View style={{ flexDirection: "row" }} onLayout={(e) => { const v = Math.round(e.nativeEvent.layout.width); if (Math.abs(v - w) > 1) setW(v); }}>{children}</View>
        <View style={{ flexDirection: "row" }}>{children}</View>
      </Animated.View>
    </View>
  );
}

/** An account's picture (media/Avatar.tsx): a drawn glyph on a two-colour disc; a club (or an old save) keeps its letters. */
function Avatar({ initials, tint, tint2, size, glyph }: { initials: string; tint: string; tint2?: string; size: number; glyph?: string }) {
  const body = glyph && glyph !== "crest" && size >= 30 ? AVATAR_GLYPH[glyph] : undefined;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundImage: `linear-gradient(145deg, ${tint}, ${tint2 ?? tint})`, backgroundColor: tint } as ViewStyle}>
      {body ? <SvgIcon body={body} size={Math.round(size * 0.62)} color="#ffffff" />
        : <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * 0.32, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 2 }}>{initials}</Text>}
    </View>
  );
}
const TICK = { blue: "#1d9bf0", gold: "#e2b719", grey: "#829aab" } as const;
function Tick({ tick }: { tick?: keyof typeof TICK }) {
  return <Text style={{ color: TICK[tick ?? "blue"], fontSize: 13 }}>✔︎</Text>;
}

/** The action row's line icons (media/PostCard.tsx ICON): replies, reposts, like, views, share. ONE drawing per post. */
const ACT = (d: string, color: string, fill = "none") => `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const ACT_PATH = {
  replies: "M21 11.5a8.4 8.4 0 01-8.9 8.4 9.4 9.4 0 01-4-.9L3 20l1.1-4.2A8 8 0 013 11.5 8.5 8.5 0 0112 3a8.4 8.4 0 019 8.5z",
  reposts: "M17 2l3 3-3 3M20 5H8a3 3 0 00-3 3v3M7 22l-3-3 3-3M4 19h12a3 3 0 003-3v-3",
  like: "M12 20s-7-4.4-8.9-8.6A4.9 4.9 0 0112 6.3a4.9 4.9 0 018.9 5.1C19 15.6 12 20 12 20z",
  views: "M5 20V12M10 20V6M15 20v-9M20 20V9",
  share: "M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5",
};
const actCache = new Map<string, ReturnType<typeof Skia.SVG.MakeFromString>>();
function actSvg(name: keyof typeof ACT_PATH, liked: boolean) {
  const key = `${name}${liked ? "1" : "0"}`;
  let o = actCache.get(key);
  if (o === undefined) {
    const c = name === "like" && liked ? "#f91880" : "#8c8f96";
    try { o = Skia.SVG.MakeFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${ACT(ACT_PATH[name], c, name === "like" && liked ? c : "none")}</svg>`); } catch { o = null; }
    actCache.set(key, o);
  }
  return o;
}
function Actions({ replies, reposts, likes, views, liked, onLike }: { replies: string; reposts: string; likes: string; views: string; liked: boolean; onLike?: () => void }) {
  const [w, setW] = useStateT(0);
  const slot = w > 0 ? (w - 17) / 4 : 0;
  const names = ["replies", "reposts", "like", "views", "share"] as const;
  const txt = { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums" as const] };
  const cell = (i: number, label: string, color?: string, press?: () => void) => {
    const inner = <Text numberOfLines={1} style={[txt, color ? { color } : null]}>{label}</Text>;
    const st = { position: "absolute" as const, left: i * slot + 23, top: 0, height: 17, justifyContent: "center" as const };
    return press ? <Press key={i} onPress={press} hitSlop={8} style={[st, { left: i * slot, paddingLeft: 23 }]}>{inner}</Press> : <View key={i} style={st}>{inner}</View>;
  };
  return (
    <View style={{ marginTop: 8, height: 17, marginRight: 4 }} onLayout={(e) => { const v = e.nativeEvent.layout.width; if (Math.abs(v - w) > 1) setW(v); }}>
      {w > 0 ? (
        <Canvas style={{ position: "absolute", left: 0, top: 0, width: w, height: 17 }}>
          {names.map((n, i) => { const svg = actSvg(n, liked); return svg ? <ImageSVG key={n} svg={svg} x={i * slot} y={0} width={17} height={17} /> : null; })}
        </Canvas>
      ) : null}
      {w > 0 ? <>{cell(0, replies)}{cell(1, reposts)}{cell(2, likes, liked ? "#f91880" : undefined, onLike)}{cell(3, views)}</> : null}
    </View>
  );
}

export function PostCard({ post, now, onLike, onVote }: { post: StoredPost; now: number; onLike?: (id: string) => void; onVote?: (id: string, i: number) => void }) {
  const likes = post.metrics.likes + (post.liked ? 1 : 0);
  const tiktok = post.author.platform === "tiktok" && !!post.sound;
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Avatar initials={post.author.initials} tint={post.author.tint} tint2={post.author.tint2} glyph={post.author.glyph} size={40} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800", flexShrink: 1 }}>{post.author.name}</Text>
          {post.author.verified && <Tick tick={post.author.tick} />}
          <Text numberOfLines={1} style={{ color: C.dim, flexShrink: 1 }}>{post.author.handle} · {relativeTime(post.at, now)}</Text>
          <Text style={{ marginLeft: "auto", paddingLeft: 6, color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 16, fontWeight: "900", letterSpacing: 1 }}>···</Text>
        </View>
        <Text style={{ color: C.text, fontSize: 15, lineHeight: 20, marginTop: 2 }}>{post.text}</Text>
        {post.quote && <Quote q={post.quote} />}
        {post.graphic && !(post.graphic.type === "thumbnail" && !post.graphic.clips?.length && !post.graphic.synth?.length) && <View style={{ marginTop: 8 }}><Graphic spec={post.graphic} author={{ ...post.author, persona: post.persona }} onVote={onVote ? (i) => onVote(post.id, i) : undefined} /></View>}
        {tiktok && post.sound ? <Text style={{ color: C.text, marginTop: 6, fontSize: 13 }}>♫ {post.sound}</Text> : null}
        <Actions replies={count(post.metrics.replies)} reposts={count(post.metrics.reposts)} likes={count(likes)} views={post.metrics.views !== undefined ? count(post.metrics.views) : ""}
          liked={!!post.liked} onLike={onLike ? () => onLike(post.id) : undefined} />
        {!!post.thread?.length && <Replies thread={post.thread} />}
      </View>
    </View>
  );
}

function Quote({ q }: { q: QuotedPost }) {
  return (
    <View style={{ marginTop: 8, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Avatar initials={q.initials} tint={q.tint} tint2={q.tint2} size={18} />
        <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800", flexShrink: 1 }}>{q.name}</Text>
        <Text numberOfLines={1} style={{ color: C.dim, flexShrink: 1 }}>{q.handle}</Text>
      </View>
      <Text numberOfLines={4} style={{ color: C.text, marginTop: 4 }}>{q.text}</Text>
    </View>
  );
}

function Replies({ thread }: { thread: PostReply[] }) {
  return (
    <View style={{ marginTop: 8, borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 10, gap: 8 }}>
      {thread.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, marginLeft: r.to ? 18 : 0 }}>
          <Avatar initials={r.initials} tint={r.tint} tint2={r.tint2} size={r.to ? 18 : 22} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text numberOfLines={1} style={{ color: C.text, fontWeight: "800", fontSize: 13, flexShrink: 1 }}>{r.name}</Text>
              {r.verified && <Tick tick={r.tick} />}
              <Text numberOfLines={1} style={{ color: C.dim, fontSize: 12, flexShrink: 1 }}>{r.handle}</Text>
            </View>
            {r.to ? <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Replying to <Text style={{ color: "#1d9bf0" }}>{r.to}</Text></Text> : null}
            <Text style={{ color: C.text, fontSize: 13 }}>{r.text}</Text>
          </View>
          <Text style={{ color: C.dim, fontSize: 12 }}>♥ {count(r.likes)}</Text>
        </View>
      ))}
    </View>
  );
}

/** The picture under a post, drawn plainly (the website's media/Graphics.tsx, in short). */
function Graphic({ spec, author, onVote }: { spec: GraphicSpec; author?: PostAuthor; onVote?: (i: number) => void }) {
  const box = { backgroundColor: "#111a2b", borderRadius: 16, padding: 12, gap: 4 } as const;
  const rowsOf = (rows: { label: string; value: string; highlight?: boolean }[]) => rows.map((r, i) => (
    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: r.highlight ? C.gold : C.text, fontWeight: r.highlight ? "900" : "700" }}>{r.label}</Text>
      <Text style={{ color: r.highlight ? C.gold : C.text, fontWeight: "900" }}>{r.value}</Text>
    </View>
  ));
  switch (spec.type) {
    case "scoreline":
      return (
        <View style={box}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" }}>{spec.competition.toUpperCase()} · FULL TIME</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <View style={{ flex: 1, alignItems: "center", gap: 4 }}><ClubBadge club={spec.home} size={34} /><Text numberOfLines={1} style={{ color: C.text, fontWeight: "800" }}>{spec.home}</Text></View>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 26 }}>{spec.hs} - {spec.as}</Text>
            <View style={{ flex: 1, alignItems: "center", gap: 4 }}><ClubBadge club={spec.away} size={34} /><Text numberOfLines={1} style={{ color: C.text, fontWeight: "800" }}>{spec.away}</Text></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text style={{ flex: 1, color: C.dim, fontSize: 11, textAlign: "center" }}>{(spec.homeScorers ?? []).join("\n")}</Text>
            <Text style={{ flex: 1, color: C.dim, fontSize: 11, textAlign: "center" }}>{(spec.awayScorers ?? spec.scorers ?? []).join("\n")}</Text>
          </View>
        </View>
      );
    case "breaking":
      return <View style={[box, { backgroundColor: "#7f1d1d" }]}><Text style={{ color: "#fecaca", fontWeight: "900", fontSize: 11, letterSpacing: 2 }}>{spec.strapline.toUpperCase()}</Text><Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>{spec.headline}</Text></View>;
    case "playerCard":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900", fontSize: 18 }}>{spec.rating} · {spec.name}</Text><Text style={{ color: C.dim }}>#{spec.number} · {spec.position}{spec.context ? ` · ${spec.context}` : ""}</Text>{rowsOf(spec.rows)}</View>;
    case "statLine":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900" }}>{spec.title}</Text>{rowsOf(spec.rows)}{spec.context ? <Text style={{ color: C.dim, fontSize: 11 }}>{spec.context}</Text> : null}</View>;
    case "topScorers":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900" }}>{spec.title}</Text>{rowsOf(spec.rows.map(r => ({ ...r, highlight: r.highlight || r.label === spec.highlight })))}</View>;
    case "tableSnippet":
      return (
        <View style={box}>
          {spec.rows.map((r) => (
            <View key={r.pos} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ width: 22, color: C.dim, fontWeight: "900" }}>{r.pos}</Text>
              <Text style={{ flex: 1, color: r.name === spec.highlight ? C.gold : C.text, fontWeight: "800" }}>{r.name}</Text>
              <Text style={{ width: 28, color: C.dim, textAlign: "right" }}>{r.played}</Text>
              <Text style={{ width: 34, color: C.dim, textAlign: "right" }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Text>
              <Text style={{ width: 30, color: C.text, fontWeight: "900", textAlign: "right" }}>{r.points}</Text>
            </View>
          ))}
        </View>
      );
    case "teamOfTheWeek":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900" }}>Team of the Week · {spec.formation}</Text>{spec.players.map((p, i) => <Text key={i} style={{ color: p.isYou ? C.gold : C.text, fontWeight: p.isYou ? "900" : "700" }}>{p.position} {p.name} <Text style={{ color: C.dim }}>{p.note}</Text></Text>)}</View>;
    case "hatTrick":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900", fontSize: 18 }}>⚽⚽⚽ {spec.name}</Text><Text style={{ color: C.dim }}>{spec.minutes.map(m => `${m}'`).join(" · ")}</Text></View>;
    case "transfer":
      return (
        <View style={[box, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
          <ClubBadge club={spec.from} size={30} /><Text style={{ color: C.dim, fontSize: 18 }}>→</Text><ClubBadge club={spec.to} size={30} />
          <View style={{ flex: 1 }}><Text style={{ color: C.text, fontWeight: "900" }}>{spec.player}</Text><Text style={{ color: C.gold, fontWeight: "800" }}>{spec.fee ?? "Done deal"}</Text></View>
        </View>
      );
    case "trophy":
      return <View style={[box, { alignItems: "center" }]}><Text style={{ fontSize: 36 }}>🏆</Text><Text style={{ color: C.gold, fontWeight: "900" }}>{spec.competition}</Text><Text style={{ color: C.text, fontWeight: "800" }}>{spec.club} · Season {spec.season}</Text></View>;
    case "poll": {
      const total = Math.max(1, spec.votes.reduce((a, b) => a + b, 0));
      return <View style={box}><Text style={{ color: C.text, fontWeight: "900" }}>{spec.question}</Text>{spec.options.map((o, i) => <Text key={i} style={{ color: C.text }}>{o} — {Math.round((spec.votes[i] / total) * 100)}%</Text>)}</View>;
    }
    case "gotmPoll": {
      const votes = spec.fanVotes.map((v, i) => v + (spec.userVote === i ? spec.userWeight : 0));
      const total = Math.max(1, votes.reduce((a, b) => a + b, 0));
      return (
        <View style={box}>
          <Text style={{ color: C.gold, fontWeight: "900" }}>Goal of the Month · {spec.monthName}</Text>
          {spec.entries.map((e, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: e.isYou ? C.gold : C.text, fontWeight: "900" }}>{e.scorerShort} · {e.club}{spec.winner === i ? " 🏆" : ""}</Text>
                <Text style={{ color: C.dim, fontSize: 11 }}>{e.detail}</Text>
              </View>
              {spec.userVote !== undefined || spec.closed || !onVote
                ? <Text style={{ color: C.text, fontWeight: "900" }}>{Math.round((votes[i] / total) * 100)}%</Text>
                : <Press onPress={() => onVote(i)} style={{ backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: "#05261a", fontWeight: "900" }}>Vote</Text></Press>}
            </View>
          ))}
        </View>
      );
    }
    case "potmNominees":
      return <View style={box}><Text style={{ color: C.gold, fontWeight: "900" }}>Player of the Month · {spec.month}</Text>{spec.nominees.map((n, i) => <Text key={i} style={{ color: n.isYou ? C.gold : C.text, fontWeight: "800" }}>{n.name} ({n.club}) {n.goals}G {n.assists}A{spec.winner === n.name ? " 🏆" : ""}</Text>)}</View>;
    case "potmWinner":
      return <View style={[box, { alignItems: "center" }]}><Text style={{ color: C.gold, fontWeight: "900" }}>PLAYER OF THE MONTH · {spec.month.toUpperCase()}</Text><Text style={{ color: C.text, fontWeight: "900", fontSize: 18 }}>{spec.firstName} {spec.lastName}</Text><Text style={{ color: C.dim }}>{spec.club} · {spec.goals}G {spec.assists}A</Text></View>;
    case "goalVideo":
      // The goal's recording (Graphics.tsx → GoalVideo): drawn from the frames recorded as it was played.
      return (
        <GoalVideo clipIds={spec.clips} synth={spec.synth} standIn={spec.standIn}
          style={spec.style && !isColdStyle(spec.style) ? spec.style as ClipStyle : clipStyleFor(author, false, false)}
          variant={spec.variant ?? clipVariantFor(author)}
          credit={author ? { handle: author.handle, name: author.name, archetype: author.archetype, platform: author.platform } : undefined}
          title={spec.title} badge={(spec.clips.length || spec.synth?.length || 0) > 1 ? "HIGHLIGHTS" : "GOAL"} fallback={null} />
      );
    case "thumbnail": {
      // Graphics.tsx Thumbnail: the recording when this phone has it, else the still card.
      const still = (
        <View style={[box, { height: 96, justifyContent: "flex-end", backgroundColor: "#1f2937" }]}>
          <Text style={{ color: C.text, fontWeight: "900", textTransform: "uppercase" }}>{spec.title}</Text>
          <Text style={{ position: "absolute", right: 8, top: 8, backgroundColor: "#dc2626", color: "#fff", fontSize: 9, fontWeight: "900", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, overflow: "hidden" }}>{spec.badge}</Text>
        </View>
      );
      return (
        <GoalVideo clipIds={spec.clips ?? []} synth={spec.synth} style={clipStyleFor(author, false, false)} variant={clipVariantFor(author)}
          credit={author ? { handle: author.handle, name: author.name, archetype: author.archetype, platform: author.platform } : undefined}
          title={spec.title} badge={spec.badge} fallback={still} />
      );
    }
    default:
      return null;
  }
}

// ── Transfers (TransfersPanel.tsx) ──────────────────────────────────────────

function TransfersPanel({ career }: { career: CareerState }) {
  const yours = (club: string) => club === career.player.club;
  const ret = (s: number) => { const y = seasonStartYear(career.player.startYear, s + 1); return `${y}/${String((y + 1) % 100).padStart(2, "0")}`; };
  const sales = career.leagueTransferNews ?? [];
  const loans = career.leagueLoanNews ?? [];
  const rows = [
    ...[...sales].sort((a, b) => Number(yours(b.from) || yours(b.to)) - Number(yours(a.from) || yours(a.to)))
      .map((m, i) => ({ key: `s${i}-${m.player}`, player: m.player, position: m.position, age: m.age, from: m.from, to: m.to, mine: yours(m.from) || yours(m.to), right: m.fee > 0 ? `£${formatMoneyPrecise(m.fee)}` : "Free" })),
    ...[...loans].sort((a, b) => Number(yours(b.parentClub) || yours(b.loanClub)) - Number(yours(a.parentClub) || yours(a.loanClub)))
      .map((l, i) => ({ key: `l${i}-${l.playerId}`, player: l.player, position: l.position, age: l.age, from: l.parentClub, to: l.loanClub, mine: yours(l.parentClub) || yours(l.loanClub), right: `Loan · back ${ret(l.returnSeason)}` })),
  ];
  const spent = sales.reduce((s, m) => s + m.fee, 0);
  const dot = (club: string) => club === FREE_AGENTS_CLUB
    ? <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.dim, fontSize: 8, fontWeight: "900" }}>FA</Text></View>
    : <ClubBadge club={club} size={24} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      contentContainerStyle={{ padding: 10, gap: 6, paddingBottom: 30 }}
      ListHeaderComponent={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 16, fontStyle: "italic" }}>This Window</Text>
          {spent > 0 ? <Text style={{ backgroundColor: C.green, color: "#05261a", fontWeight: "900", fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" }}>£{formatMoneyPrecise(spent)} SPENT</Text> : null}
        </View>
      }
      ListEmptyComponent={<Empty text="No business yet. The rest of the division deals in the summer and again in January — check back once a window has opened and closed." />}
      renderItem={({ item: r }) => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: r.mine ? "rgba(52,211,153,0.6)" : C.line, backgroundColor: r.mine ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "900" }}>{r.player} <Text style={{ color: C.dim, fontSize: 11 }}>{r.position}{r.age ? ` · ${r.age}` : ""}</Text></Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>{dot(r.from)}<Text style={{ color: C.dim }}>→</Text>{dot(r.to)}</View>
          </View>
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 12 }}>{r.right}</Text>
        </View>
      )}
      ListFooterComponent={(career.activeLoans ?? []).length > 0 ? (
        <View style={{ marginTop: 10, gap: 4 }}>
          <Title color="#7dd3fc">Currently on loan</Title>
          {(career.activeLoans ?? []).map((l) => (
            <Text key={l.playerId} style={{ color: C.text, fontSize: 11, fontWeight: "700" }}>{l.player} — {l.parentClub}’s player, out at {l.loanClub} · back for {ret(l.returnSeason)}</Text>
          ))}
        </View>
      ) : undefined}
    />
  );
}
