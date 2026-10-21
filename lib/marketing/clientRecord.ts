/**
 * lib/marketing/clientRecord.ts — the Knowitball client record (Harry, 21 Oct
 * 2026; docs/plans/2026-10-21-marketing-production.md §3).
 *
 * The record is one short file, marketing/clients/knowitball/client.md. Its
 * sections ("## Voice" …) list Brain note codes (tag client-kib) or a plain
 * line. It links, never copies: the words live in the Brain notes. This file
 * turns the record plus its notes into sections for the Client page.
 *
 * parseClientRecord / parseNote are pure (tests/star/adminMarketing.mts);
 * readClientRecord reads the files from disk on the server.
 */
import fs from "node:fs";
import path from "node:path";

export const CLIENT_FILE = "marketing/clients/knowitball/client.md";
const CODE = /^(FACT|RUL|PRO|DEC|REF)-[A-Z0-9]+-\d{3}$/;
const DIR: Record<string, string> = { FACT: "fact", RUL: "ruling", PRO: "process", DEC: "decision", REF: "reference" };

export interface BrainNote { code: string; type: string; status: string; summary: string; body: string; source: string; tags: string[] }
export type ClientItem = { kind: "note"; code: string; note: BrainNote | null } | { kind: "text"; text: string };
export interface ClientSection { title: string; items: ClientItem[] }
export interface ClientRecord { label: string; code: string; status: string; intro: string[]; sections: ClientSection[]; homes: Record<string, string> }

const field = (fm: string, k: string) => fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1].trim() ?? "";

/** One Brain note file → its fields (null if it is not a note). */
export function parseNote(code: string, text: string): BrainNote | null {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const tags = field(fm, "tags").replace(/^\[|\]$/g, "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    code, type: field(fm, "type"), status: field(fm, "status"), summary: field(fm, "summary"),
    source: field(fm, "source").replace(/^"|"$/g, ""), body: m[2].trim(), tags,
  };
}

/** The record file → its sections. `noteFor` looks a code up (null = no such note). */
export function parseClientRecord(text: string, noteFor: (code: string) => BrainNote | null): ClientRecord {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m?.[1] ?? "";
  const body = m ? m[2] : text;
  const homes: Record<string, string> = {};
  const hm = fm.match(/^homes:\n((?:[ \t]+.+\n?)*)/m);
  if (hm) for (const ln of hm[1].split("\n")) { const h = ln.match(/^\s+([\w-]+):\s*(.+)$/); if (h) homes[h[1]] = h[2].trim(); }
  const intro: string[] = [];
  const sections: ClientSection[] = [];
  let cur: ClientSection | null = null;
  for (const raw of body.split("\n")) {
    const ln = raw.trim();
    if (!ln || /^# /.test(ln)) continue;
    const h = ln.match(/^##\s+(.+)$/);
    if (h) { cur = { title: h[1].trim(), items: [] }; sections.push(cur); continue; }
    const b = ln.replace(/^[-*]\s+/, "");
    if (!cur) { intro.push(b); continue; }
    cur.items.push(CODE.test(b) ? { kind: "note", code: b, note: noteFor(b) } : { kind: "text", text: b });
  }
  return { label: field(fm, "label") || "Knowitball", code: field(fm, "code"), status: field(fm, "status"), intro, sections, homes };
}

/** Read the record and its notes from disk (server only). Never throws. */
export function readClientRecord(root = process.cwd()): ClientRecord | null {
  let text: string;
  try { text = fs.readFileSync(path.join(root, CLIENT_FILE), "utf8"); } catch { return null; }
  return parseClientRecord(text, (code) => {
    const dir = DIR[code.split("-")[0]];
    try { return parseNote(code, fs.readFileSync(path.join(root, "brain", dir, `${code}.md`), "utf8")); } catch { return null; }
  });
}
