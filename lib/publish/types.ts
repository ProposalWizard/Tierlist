/**
 * lib/publish/types.ts — Admin → Marketing → Publish (Mikey, 11 Nov 2026): our own tool that posts a video to
 * Instagram, Facebook and YouTube at a set time and reads the numbers back. Tables: supabase/migrations/publishing.sql.
 */
export const PLATFORMS = ["instagram", "facebook", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const isPlatform = (p: unknown): p is Platform => typeof p === "string" && (PLATFORMS as readonly string[]).includes(p);

/**
 * A space = one set of accounts with its own page (Mikey, 24 Nov 2026): football = Mikey's football accounts (Mikey's
 * Brain), content = Mikey's other content accounts (Mikey's Brain: Content), kib = the Knowitball team (later).
 * football and content are Mikey's alone (PUBLISH_OWNER_EMAIL); kib is open to every admin.
 */
export const SPACES = ["football", "content", "kib"] as const;
export type Space = (typeof SPACES)[number];
export const isSpace = (s: unknown): s is Space => typeof s === "string" && (SPACES as readonly string[]).includes(s);
export const spaceOf = (s: unknown): Space => (isSpace(s) ? s : "football");
export const SPACE_NAMES: Record<Space, string> = { football: "Football", content: "Content", kib: "Knowitball" };

/** One platform's progress for one post. */
export interface PlatformResult {
  stage: "pending" | "processing" | "done" | "failed";
  /** What the platform last said about it (Facebook Reel phases), for the page and for checking. */
  note?: string;
  /** Instagram: the media container while Instagram processes the video. */
  container?: string;
  /** The post's id on the platform once it exists. */
  id?: string;
  link?: string;
  error?: string;
  startedAt?: string;
  doneAt?: string;
  stats?: Record<string, number>;
  statsAt?: string;
  statsError?: string;
}

export type PostStatus = "scheduled" | "posting" | "done" | "partial" | "failed" | "cancelled";

export interface PublishPost {
  id: string;
  space?: Space;
  video_key: string;
  title: string;
  captions: Partial<Record<Platform, string>>;
  platforms: Platform[];
  scheduled_at: string;
  status: PostStatus;
  results: Partial<Record<Platform, PlatformResult>>;
  attempts: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PublishAccount {
  space?: Space;
  platform: Platform;
  account_id: string;
  account_name: string;
  token_enc: string;
  refresh_enc: string | null;
  expires_at: string | null;
  extra: Record<string, unknown>;
  updated_at: string;
}

/** What the page and the chat see about an account (never a token). */
export interface AccountView { platform: Platform; connected: boolean; name: string; id: string; expiresAt: string | null; updatedAt: string | null }

/** The status a post should have, from its platforms' results. */
export function overallStatus(post: Pick<PublishPost, "platforms" | "results" | "status">): PostStatus {
  if (post.status === "cancelled") return "cancelled";
  const stages = post.platforms.map((p) => post.results[p]?.stage ?? "pending");
  if (stages.every((s) => s === "done")) return "done";
  if (stages.some((s) => s === "pending" || s === "processing")) return stages.every((s) => s === "pending") && post.status === "scheduled" ? "scheduled" : "posting";
  return stages.some((s) => s === "done") ? "partial" : "failed";
}
