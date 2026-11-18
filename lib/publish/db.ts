/**
 * lib/publish/db.ts — SERVER ONLY. The two Publish tables (supabase/migrations/publishing.sql), read and written
 * with the service role. Tokens leave this file only encrypted (in) or opened for one platform call (out).
 */
import { createServiceClient } from "@/lib/supabase/service";
import { PLATFORMS, type AccountView, type Platform, type PublishAccount, type PublishPost } from "./types";

const db = () => createServiceClient();

export const NOT_MIGRATED = "The Publish tables are not in the database yet: run supabase/migrations/publishing.sql in the Supabase SQL Editor.";
const tableMissing = (e: { message?: string; code?: string } | null) => !!e && (e.code === "42P01" || /publish_(posts|accounts)/.test(e.message ?? "") && /does not exist|schema cache/.test(e.message ?? ""));
function check<T>(r: { data: T; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw new Error(tableMissing(r.error) ? NOT_MIGRATED : `Database: ${r.error.message}`);
  return r.data;
}

export async function getAccount(p: Platform): Promise<PublishAccount | null> {
  return check(await db().from("publish_accounts").select("*").eq("platform", p).maybeSingle()) as PublishAccount | null;
}

export async function accountViews(): Promise<AccountView[]> {
  const rows = (check(await db().from("publish_accounts").select("platform,account_id,account_name,expires_at,updated_at")) ?? []) as Pick<PublishAccount, "platform" | "account_id" | "account_name" | "expires_at" | "updated_at">[];
  return PLATFORMS.map((p) => {
    const r = rows.find((x) => x.platform === p);
    return { platform: p, connected: !!r, name: r?.account_name ?? "", id: r?.account_id ?? "", expiresAt: r?.expires_at ?? null, updatedAt: r?.updated_at ?? null };
  });
}

export async function saveAccount(row: Omit<PublishAccount, "updated_at"> & { connected_by?: string | null }): Promise<void> {
  check(await db().from("publish_accounts").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "platform" }));
}

export async function removeAccount(p: Platform): Promise<void> {
  check(await db().from("publish_accounts").delete().eq("platform", p));
}

export async function listPosts(limit = 60): Promise<PublishPost[]> {
  return (check(await db().from("publish_posts").select("*").order("scheduled_at", { ascending: false }).limit(limit)) ?? []) as PublishPost[];
}

export async function getPost(id: string): Promise<PublishPost | null> {
  return check(await db().from("publish_posts").select("*").eq("id", id).maybeSingle()) as PublishPost | null;
}

export async function insertPost(p: Pick<PublishPost, "video_key" | "title" | "captions" | "platforms" | "scheduled_at" | "created_by">): Promise<PublishPost> {
  return check(await db().from("publish_posts").insert({ ...p, status: "scheduled", results: {} }).select("*").single()) as PublishPost;
}

export async function updatePost(id: string, patch: Partial<PublishPost>): Promise<void> {
  check(await db().from("publish_posts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
}

/** Posts that should move now: due and not finished. */
export async function duePosts(now: Date): Promise<PublishPost[]> {
  return (check(await db().from("publish_posts").select("*").in("status", ["scheduled", "posting"]).lte("scheduled_at", now.toISOString()).order("scheduled_at").limit(10)) ?? []) as PublishPost[];
}

/** Posted in the last 30 days: their numbers are worth refreshing. */
export async function recentPosted(now: Date): Promise<PublishPost[]> {
  const since = new Date(now.getTime() - 30 * 864e5).toISOString();
  return (check(await db().from("publish_posts").select("*").in("status", ["done", "partial"]).gte("scheduled_at", since).order("scheduled_at", { ascending: false }).limit(40)) ?? []) as PublishPost[];
}
