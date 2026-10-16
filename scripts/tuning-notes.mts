/**
 * scripts/tuning-notes.mts — the team's "Say what feels off" notes, in the
 * terminal.
 *
 *   npx tsx scripts/tuning-notes.mts            # newest 60 from the shared table
 *   npx tsx scripts/tuning-notes.mts 200        # newest 200
 *   npx tsx scripts/tuning-notes.mts notes.json # or a saved export
 *
 * Also printed at the end of scripts/tuner-proposals.mts.
 *
 * The table (supabase/migrations/star_tuning_notes.sql) is admin-read, so this
 * needs SUPABASE_SERVICE_ROLE_KEY in .env.local (or the environment). It never
 * writes anything.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

interface NoteRow {
  id: string; page: string; chips: string[]; text: string;
  kind: string | null; league: string | null; position: string | null;
  seed: number | null; minute: number | null; seen: number | null; note_at: string;
}

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

async function fromTable(limit: number): Promise<NoteRow[]> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (.env.local).");
  if (!key) throw new Error("the notes are admin-read: put SUPABASE_SERVICE_ROLE_KEY in .env.local to read them here.");
  const res = await fetch(`${url}/rest/v1/star_tuning_notes?select=*&order=note_at.desc&limit=${limit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    if (/does not exist|could not find the table/i.test(msg)) {
      throw new Error("the star_tuning_notes table does not exist yet — run supabase/migrations/star_tuning_notes.sql in the Supabase SQL Editor. Until then notes stay in the browser that wrote them.");
    }
    throw new Error(msg);
  }
  return (body as NoteRow[]) ?? [];
}

function fromFile(path: string): NoteRow[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { notes?: unknown[] }).notes ?? []);
  return (list as Record<string, unknown>[]).map((n) => ({
    id: String(n.id), page: String(n.page ?? ""), chips: (n.chips as string[]) ?? [], text: String(n.text ?? ""),
    kind: (n.kind as string) ?? null, league: (n.league as string) ?? null, position: (n.position as string) ?? null,
    seed: (n.seed as number) ?? null, minute: (n.minute as number) ?? null, seen: (n.seen as number) ?? null,
    note_at: typeof n.note_at === "string" ? n.note_at : new Date((n.at as number) ?? 0).toISOString(),
  }));
}

/** Print the notes. Never throws: a problem is one printed line. */
export async function printTuningNotes(arg?: string): Promise<void> {
  let notes: NoteRow[];
  const file = arg && !/^\d+$/.test(arg) ? arg : undefined;
  try {
    notes = file ? fromFile(file) : await fromTable(arg ? Number(arg) : 60);
  } catch (e) {
    console.log(`\nTuning notes: could not read — ${(e as Error).message}`);
    return;
  }
  console.log(`\nTuning notes ("Say what feels off"): ${notes.length}${file ? ` in ${file}` : " newest first"}.`);
  if (!notes.length) return;

  const chipCount = new Map<string, number>();
  for (const n of notes) for (const c of n.chips) chipCount.set(c, (chipCount.get(c) ?? 0) + 1);
  if (chipCount.size) {
    console.log("  Chips:");
    for (const [c, k] of Array.from(chipCount).sort((a, b) => b[1] - a[1])) console.log(`    ${String(k).padStart(3)} × ${c}`);
  }
  console.log("  Notes:");
  for (const n of notes) {
    const where = [n.page.replace(/^\//, ""), n.kind, n.league, n.position, n.seed != null ? `seed ${n.seed}` : null,
      n.minute != null ? `${n.minute}'` : null, n.seen != null ? `${n.seen} seen` : null].filter(Boolean).join(" · ");
    const said = [n.chips.join(", "), n.text].filter(Boolean).join(" — ");
    console.log(`    ${n.note_at.slice(0, 16).replace("T", " ")}  ${said}\n      (${where})`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await printTuningNotes(process.argv[2]);
  console.log("");
}
