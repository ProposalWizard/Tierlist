/**
 * scripts/patch-notes/rules.mjs — THE RULES EVERY PATCH NOTE KEEPS.
 *
 * Leo, 26 Oct 2026: "they should all say who made it … a date and time …
 * mention updates to themselves and at what times and where … an appropriate
 * version number … a normal title of what its about … all patch notes should
 * be the same". Brain note RUL-TEAM-028.
 *
 * One list of checks, used in two places so it can't drift:
 *   - tests/star/patchNoteRules.mts checks every note in lib/patchNotesData.ts;
 *   - scripts/patch-notes/ship.mjs refuses to put a note on the site that breaks one.
 * Plain JS so ship.mjs (Node) and the test (tsx) can both import it.
 */

export const AUTHORS = ["Harry", "Mikey", "Leo"];

/** Numbers that were given up in the 26 Oct renumbering (lib/patchVersionAliases.ts). Never use them again. */
export const RETIRED_NUMBERS = ["0.60", "0.61", "0.62", "0.63", "0.103", "0.107", "0.108", "0.109", "0.110"];

/** "0.110h" → "0.110": two notes may never share this. */
export const baseNumber = (v) => String(v).replace(/[a-z]+$/i, "");

/** The menu name: the part of the title after "Leo's patch notes: ". */
export const menuName = (title) => /^(?:Harry|Mikey|Leo)['’]s patch notes\s*:\s*(.+)$/.exec(String(title).trim())?.[1] ?? "";

const GENERIC = /^(?:v?[\d.]+|patch notes|updates?|fixes|misc|round \d+)$/i;

/**
 * Problems with one note, as plain sentences ([] = fine).
 * `all` = every note (for the shared-number check).
 */
export function noteProblems(n, all = []) {
  const p = [];
  const v = n.version;
  if (!AUTHORS.includes(n.author)) p.push(`v${v}: "author" must be Harry, Mikey or Leo (who made it).`);
  if (!String(n.title).startsWith(`${n.author}'s patch notes: `)) p.push(`v${v}: the title must start "${n.author}'s patch notes: " then say what it is about.`);
  const name = menuName(n.title);
  if (name.length < 3 || name.length > 70 || GENERIC.test(name)) p.push(`v${v}: the menu name "${name}" must say what the note is about in a few words.`);
  const t = Date.parse(n.publishedAt);
  if (!Number.isFinite(t)) p.push(`v${v}: "publishedAt" must be a real date and time.`);
  else if (/T00:00:00(?:\.000)?Z$/.test(n.publishedAt)) p.push(`v${v}: "publishedAt" is midnight exactly; put the real time it was made.`);
  if (RETIRED_NUMBERS.includes(v)) p.push(`v${v}: that number was retired on 26 Oct; take a new one.`);
  const same = all.filter((o) => o !== n && baseNumber(o.version) === baseNumber(v)).map((o) => o.version);
  if (same.length) p.push(`v${v}: shares its number with ${same.map((s) => "v" + s).join(", ")}; every note needs its own number (search main, Harry, Mikey and Leo first).`);
  for (const [i, u] of (n.updates ?? []).entries()) {
    if (!Number.isFinite(Date.parse(u.at)) || !u.where || !u.note) p.push(`v${v}: update ${i + 1} needs "at" (time), "where" (what part changed) and "note".`);
  }
  if (n.updateNote) {
    if (!n.updatedAt) p.push(`v${v}: an "updateNote" needs its "updatedAt".`);
    else if (!(n.updates ?? []).some((u) => u.note.includes(n.updateNote))) p.push(`v${v}: its latest update ("${n.updateNote.slice(0, 40)}…") must also be in "updates" with its time and where.`);
  }
  return p;
}

/** Stricter, for a note being shipped now: a new update must be the last entry, at updatedAt. */
export function shipProblems(n, all = []) {
  const p = noteProblems(n, all);
  if (n.updateNote) {
    const last = (n.updates ?? []).at(-1);
    if (!last || last.at !== n.updatedAt || last.note !== n.updateNote) p.push(`v${n.version}: add the update to the end of "updates": { "at": "${n.updatedAt}", "where": "Text" | "Page" | …, "note": the same line as "updateNote" }.`);
  }
  return p;
}
