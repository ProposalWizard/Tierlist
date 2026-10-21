/**
 * lib/research.ts — THE LIST OF RESEARCH WRITE-UPS (Harry, 20 Oct 2026: "a
 * research area"). The Research page (/admin/research) shows one card per
 * line, newest first. New research = one line here.
 *
 * `topic` groups the cards and picks their colour; `date` is when it was made.
 */

export type ResearchTopic = "Highlights" | "Design" | "3D" | "Game feel" | "Other";

export interface Research {
  title: string;
  /** One short line: what it found or what it is for. */
  line: string;
  url: string;
  topic: ResearchTopic;
  /** YYYY-MM-DD */
  date: string;
  by: "Harry" | "Mikey" | "Leo" | "Claude";
}

export const RESEARCH: Research[] = [
  { title: "Learning from FM: top 10", line: "Ten things Football Manager does that our game does thinly or not at all, each with our own idea.", url: "https://claude.ai/artifact/Ry521jLp2vKoSLnkJfZrgS", topic: "Design", date: "2026-10-19", by: "Claude" },
  { title: "Highlights: learning from FM", line: "How FM shows a match as a few moments, what we do today, and five changes worth making.", url: "https://claude.ai/artifact/QwdSLTFeLTHdE6V7LHXKEM", topic: "Highlights", date: "2026-10-19", by: "Claude" },
  { title: "Full highlights rebuild plan", line: "A plan, not built: a real 22-man match behind your chances, in eight phases.", url: "https://claude.ai/artifact/MUyMrYBtjerjP4dXkJaMGZ", topic: "Highlights", date: "2026-10-19", by: "Claude" },
  { title: "3D audit and plan", line: "52 phone stills of every 3D place: the top 10 problems, then ten small steps.", url: "https://claude.ai/artifact/Gx6YJ9jdDbs7j9cfEfjS5S", topic: "3D", date: "2026-10-19", by: "Claude" },
];

/** Newest first; same day keeps the list's order. */
export const researchNewestFirst = (list: Research[] = RESEARCH) =>
  list.map((r, i) => ({ r, i })).sort((a, b) => b.r.date.localeCompare(a.r.date) || a.i - b.i).map((x) => x.r);
