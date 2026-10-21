"use client";
/**
 * lib/teamRoom/patchQuote.ts — talking about particular lines of a patch note
 * (Harry, 21 Oct 2026: "pick specific lines of the patch note to talk about
 * (select or tap lines, so the note quotes them)").
 *
 *   linesOf        the lines you can tap: every item's headline, in page order
 *   selection      the last text you selected on the patch note (the kept page
 *                  in its frame, or the Text view). Kept here because a phone
 *                  clears a selection the moment you tap a button.
 *   notes request  the Inbox asks for a version's notes to open (a mention)
 */
import { useSyncExternalStore } from "react";
import type { PatchNote } from "@/lib/patchNotes";

/** Every item headline of a version, once each, in page order (history left out). */
export function linesOf(note: Pick<PatchNote, "sections">): string[] {
  const out: string[] = [];
  for (const s of note.sections ?? []) {
    if (s.kind === "history") continue;
    for (const it of s.items ?? []) {
      const t = (it.title ?? "").replace(/\s+/g, " ").trim();
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** A selection worth quoting: trimmed, one line, at most 240 letters. Empty → null. */
export function cleanQuote(text: string | null | undefined): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 2) return null;
  return t.length > 240 ? t.slice(0, 239) + "…" : t;
}

let sel: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setPatchSelection(text: string | null) {
  const t = cleanQuote(text);
  if (!t || t === sel) return;
  sel = t; emit();
}
export function clearPatchSelection() { if (sel !== null) { sel = null; emit(); } }
export function usePatchSelection(): string | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => sel, () => null);
}

/** Watch a document (the page frame's, or this page's) for selected text. Returns the stop function. */
export function watchSelection(doc: Document, skip?: (n: Node | null) => boolean): () => void {
  const on = () => {
    const s = doc.getSelection?.();
    if (!s || s.isCollapsed) return;
    if (skip?.(s.anchorNode)) return;
    setPatchSelection(s.toString());
  };
  doc.addEventListener("selectionchange", on);
  return () => doc.removeEventListener("selectionchange", on);
}

let wantNotes: string | null = null;
/** The Inbox opens a version with its notes showing. */
export function requestNotes(version: string) { wantNotes = version; }
/** True once for the version asked for. */
export function takeNotesRequest(version: string): boolean {
  if (wantNotes !== version) return false;
  wantNotes = null;
  return true;
}
