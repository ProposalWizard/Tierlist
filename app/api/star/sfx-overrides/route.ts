import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  SFX_NAMES,
  SFX_OVERRIDE_FOLDER,
  SFX_OVERRIDE_MAP_PATH,
  cleanOverrideMap,
  type SfxOverrideMap,
} from "@/lib/star/sfxCatalog";

/**
 * SOUND OVERRIDES — replacement sound files for the New UI's sound effects.
 *
 * The Sound Board admin page (/admin/sound-board) uploads a replacement for
 * any sound; the game (lib/star/sfx.ts) asks this route which sounds have one
 * and plays the replacement instead of the bundled file in public/sfx.
 *
 * Where it lives: the public `tierlist-images` bucket, folder sfx-overrides/.
 * Each upload is its own file (name + timestamp, so a browser never plays a
 * stale copy), and one small map.json lists the current file per sound. No
 * database table, so there is NO migration to run.
 *
 * GET is public — every player's device needs the list. POST and DELETE are
 * admin-only. Anything going wrong on a GET (no bucket, no map yet, no
 * network) answers `{ overrides: {} }`, which means "play the bundled files",
 * so the game can never lose a sound because of this route.
 *
 * Two admins saving at the very same moment could overwrite each other's
 * change to map.json (last write wins). With a team of three, accepted.
 */

export const dynamic = "force-dynamic";

const BUCKET = "tierlist-images";
const MAX_BYTES = 2 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
};
const EXT_OK = new Set(["mp3", "wav", "ogg", "m4a", "aac", "webm"]);

async function readMap(): Promise<SfxOverrideMap> {
  try {
    const service = createServiceClient();
    const { data, error } = await service.storage.from(BUCKET).download(SFX_OVERRIDE_MAP_PATH);
    if (error || !data) return {};
    return cleanOverrideMap(JSON.parse(await data.text()));
  } catch {
    return {};
  }
}

async function writeMap(map: SfxOverrideMap): Promise<string | null> {
  const service = createServiceClient();
  const { error } = await service.storage
    .from(BUCKET)
    .upload(SFX_OVERRIDE_MAP_PATH, new Blob([JSON.stringify(map)], { type: "application/json" }), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    });
  return error ? error.message : null;
}

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const overrides = await readMap();
  return NextResponse.json({ overrides }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } });
}

/** multipart: `name` (a sound name) + `file` (the replacement). */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Could not read the upload." }, { status: 400 }); }
  const name = String(form.get("name") ?? "");
  const file = form.get("file");
  if (!SFX_NAMES.includes(name)) return NextResponse.json({ error: "Unknown sound name." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file sent." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 2 MB. Sounds here are short — trim it first." }, { status: 400 });

  const extFromName = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = EXT_BY_TYPE[file.type] ?? (EXT_OK.has(extFromName) ? extFromName : "");
  if (!ext) return NextResponse.json({ error: "Use an mp3, wav, ogg, m4a or webm sound file." }, { status: 400 });

  const service = createServiceClient();
  const path = `${SFX_OVERRIDE_FOLDER}/${name}-${Date.now()}.${ext}`;
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type || `audio/${ext}`, upsert: false, cacheControl: "31536000" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(path);

  const map = await readMap();
  const previous = map[name]?.url;
  map[name] = { url: publicUrl, updated: new Date().toISOString(), original: file.name.slice(0, 120) };
  const writeErr = await writeMap(map);
  if (writeErr) return NextResponse.json({ error: writeErr }, { status: 500 });
  if (previous) await removeFile(previous);
  return NextResponse.json({ overrides: map });
}

/** ?name=<sound> — put the bundled sound back. */
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!SFX_NAMES.includes(name)) return NextResponse.json({ error: "Unknown sound name." }, { status: 400 });
  const map = await readMap();
  const previous = map[name]?.url;
  delete map[name];
  const writeErr = await writeMap(map);
  if (writeErr) return NextResponse.json({ error: writeErr }, { status: 500 });
  if (previous) await removeFile(previous);
  return NextResponse.json({ overrides: map });
}

/** Best effort: delete the old uploaded file once nothing points at it. */
async function removeFile(url: string): Promise<void> {
  try {
    const marker = `/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return;
    const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
    if (!path.startsWith(`${SFX_OVERRIDE_FOLDER}/`) || path === SFX_OVERRIDE_MAP_PATH) return;
    await createServiceClient().storage.from(BUCKET).remove([path]);
  } catch {
    /* an orphaned small file is harmless */
  }
}
