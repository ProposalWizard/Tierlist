/**
 * lib/publish/libdb.ts — SERVER ONLY. The Library and Lessons tables (supabase/migrations/marketing_library.sql),
 * read and written with the service role. Words only: the video files live in Cloudflare.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { cleanDetails, type VideoDetails } from "./library";
import type { Space } from "./types";

const db = () => createServiceClient();

export const LIB_NOT_MIGRATED = "The Library tables are not in the database yet: run supabase/migrations/marketing_library.sql in the Supabase SQL Editor.";
const tableMissing = (e: { message?: string; code?: string } | null) => !!e && (e.code === "42P01" || (/marketing_(videos|lessons)/.test(e.message ?? "") && /does not exist|schema cache/.test(e.message ?? "")));
function check<T>(r: { data: T; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw new Error(tableMissing(r.error) ? LIB_NOT_MIGRATED : `Database: ${r.error.message}`);
  return r.data;
}

export interface VideoRow extends VideoDetails { space: Space; video_key: string; created_by: string; created_at: string; updated_at: string }
export interface Lesson { id: string; space: Space; body: string; created_by: string; created_at: string }

/** Every video in this space that has words saved, keyed by the storage key. */
export async function detailsMap(space: Space): Promise<Record<string, VideoRow>> {
  const rows = (check(await db().from("marketing_videos").select("*").eq("space", space).limit(2000)) ?? []) as VideoRow[];
  const out: Record<string, VideoRow> = {};
  for (const r of rows) out[r.video_key] = { ...r, ...cleanDetails(r), space: r.space, video_key: r.video_key, created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at };
  return out;
}

export async function saveDetails(space: Space, key: string, details: VideoDetails, by: string): Promise<void> {
  check(await db().from("marketing_videos").upsert({ space, video_key: key, ...details, created_by: by, updated_at: new Date().toISOString() }, { onConflict: "space,video_key" }));
}

export async function removeDetails(space: Space, key: string): Promise<void> {
  check(await db().from("marketing_videos").delete().eq("space", space).eq("video_key", key));
}

export async function listLessons(space: Space): Promise<Lesson[]> {
  return (check(await db().from("marketing_lessons").select("*").eq("space", space).order("created_at", { ascending: false }).limit(200)) ?? []) as Lesson[];
}

export async function addLesson(space: Space, body: string, by: string): Promise<Lesson> {
  return check(await db().from("marketing_lessons").insert({ space, body, created_by: by }).select("*").single()) as Lesson;
}

export async function removeLesson(space: Space, id: string): Promise<void> {
  check(await db().from("marketing_lessons").delete().eq("space", space).eq("id", id));
}
