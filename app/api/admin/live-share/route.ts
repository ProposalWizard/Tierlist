/**
 * /api/admin/live-share — the Videos page's "Live share (test)" sends its
 * pictures and lines here (lib/liveShare.ts explains the whole idea).
 *
 *   POST (form): code, state (JSON), frame (a JPEG, when the screen changed),
 *                lines (JSON, when someone spoke). Writes live/<code>/…
 *                and deletes the picture that fell out of the last 200.
 *   DELETE ?code=K7Q2XM — deletes every file of that share.
 *
 * Admins only (a local dev copy with offline play lets anyone, like the rest
 * of the admin). Writes with the service key into public storage; no table.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { LIVE_CODE, LIVE_FOLDER, cleanLines, cleanState, frameName, framesToPrune, livePath } from "@/lib/liveShare";
import { liveStore } from "@/lib/liveShareStore";

export const dynamic = "force-dynamic";

const MAX_FRAME_BYTES = 1_500_000;

async function denied(): Promise<NextResponse | null> {
  if (offlineDevPlayEnabled()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (await isAdmin(user.id))) return null;
  } catch { /* fall through */ }
  return NextResponse.json({ error: "Admins only." }, { status: 403 });
}

const noStore = () => NextResponse.json({ error: "Live share can't save here: the site has no storage key." }, { status: 503 });

export async function POST(req: NextRequest) {
  const no = await denied();
  if (no) return no;
  const store = liveStore();
  if (!store) return noStore();

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Couldn't read what was sent." }, { status: 400 }); }
  const code = String(form.get("code") ?? "");
  if (!LIVE_CODE.test(code)) return NextResponse.json({ error: "Bad code." }, { status: 400 });

  let raw: unknown = {};
  try { raw = JSON.parse(String(form.get("state") ?? "{}")); } catch { raw = {}; }
  const state = cleanState(raw, code, Date.now());

  // The picture first, so state.json never points at a picture that isn't there.
  const frame = form.get("frame");
  const hasFrame = frame instanceof Blob && frame.size > 0;
  if (hasFrame) {
    if (frame.size > MAX_FRAME_BYTES) return NextResponse.json({ error: "Picture too big." }, { status: 400 });
    if (state.lastFrame < 1) return NextResponse.json({ error: "No picture number." }, { status: 400 });
    const err = await store.put(livePath(code, frameName(state.lastFrame)), await frame.arrayBuffer(), "image/jpeg", false);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  }

  const linesRaw = form.get("lines");
  if (typeof linesRaw === "string") {
    let parsed: unknown = [];
    try { parsed = JSON.parse(linesRaw); } catch { parsed = []; }
    const err = await store.put(livePath(code, "transcript.json"), JSON.stringify(cleanLines(parsed)), "application/json", true);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
  }

  const err = await store.put(livePath(code, "state.json"), JSON.stringify(state), "application/json", true);
  if (err) return NextResponse.json({ error: err }, { status: 500 });

  if (hasFrame) {
    const old = framesToPrune(state.lastFrame).map((f) => livePath(code, f));
    if (old.length) await store.remove(old).catch(() => {});
  }
  return NextResponse.json({ ok: true, base: store.readBase(req.nextUrl.origin) });
}

export async function DELETE(req: NextRequest) {
  const no = await denied();
  if (no) return no;
  const store = liveStore();
  if (!store) return noStore();
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!LIVE_CODE.test(code)) return NextResponse.json({ error: "Bad code." }, { status: 400 });
  // Up to 1,000 files a pass; a share keeps at most ~200 pictures, so one pass
  // normally does it. Three passes catch any that leaked from failed sends.
  let removed = 0;
  for (let pass = 0; pass < 3; pass++) {
    const files = await store.list(`${LIVE_FOLDER}/${code}`);
    if (!files.length) break;
    await store.remove(files);
    removed += files.length;
  }
  return NextResponse.json({ ok: true, removed });
}
