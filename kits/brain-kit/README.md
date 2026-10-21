# Brain kit

A copy-paste kit that turns any repo's knowledge into a Brain Claude can search fast and cheaply.
Built and tested in Zocial-gen-operations (2026-10-20/21): 407 notes, 45 test questions, 0 wrong answers, about 13 times less reading than searching the old docs.

## What's in the kit

| File | What it is |
|---|---|
| `scripts/brain/build_index.py` | Tags every note automatically, checks every source line, builds the index. Run it after any change. |
| `brain/_tags.md` | The fixed tag list (and default tags per note type). Write your own. |
| `brain/<type>/<ID>.md` | The notes. Three examples are included; delete them later. |
| `SEARCH.md` | The search rules for Claude. Paste into your CLAUDE.md. |
| `CONVERT.md` | The step-by-step recipe to convert a repo, the way we did it. |
| `PROMPT-FOR-OTHER-REPO.md` | The one prompt to paste into another repo's Claude chat. |

## The idea in five lines

1. One idea per note; every note has a permanent code that is never reused.
2. Each note has a one-sentence summary. Usually the summary IS the answer.
3. Tags are picked from a fixed list and added by the script, never typed by hand.
4. A script builds one index file: one line per note (code | summary | tags).
5. Every note points to the exact source line it came from, and the script checks that line still says it.

## Three shelves

1. **Notes:** small facts, rules and decisions. One idea each.
2. **Sources:** big documents (reports, transcripts, guides). Big documents and skills stay whole; each gets one reference note that links to the source.
3. **Skills:** Claude's how-to files. They stay as skills. A fact inside a skill moves to a note, and the skill cites the note's code instead of restating it.

## Codes

`RUL-ALL-001` = type (RUL ruling, FACT, CRAFT, DEC decision, PRO process, REF reference) - client or area (ALL, or a short code per client/area) - counter.
The counter only goes up. A changed rule gets a NEW note; the old one becomes `status: superseded` with `superseded_by:`. Never two live truths.

## How Claude searches

Claude searches cheapest first: code, then the index, then 1 to 3 notes, then the source.
1. Know the code? Open that note.
2. Grep the index. Read ALL matching lines, not just the first (the right one is often 4th or later).
3. Open at most 3 notes.
4. Follow `source:` only when the reasoning is needed.
If nothing matches, say "no note yet". Never guess from a nearby note.

## Note format

```
---
id: RUL-ALL-001
type: ruling            # ruling | fact | craft | decision | process | reference
client: all             # all, or your client/area name
tags: []                # leave empty; the script fills it
status: live            # live | superseded | draft
date: 2026-10-21
source: "path/to/file.md:56"   # exact line or range, e.g. :40-46
summary: One plain sentence under 20 words with the searchable noun.
---
0-2 short lines only if needed.
```

## Run it

```
python3 scripts/brain/build_index.py          # tag, check, build index
python3 scripts/brain/build_index.py --check  # no writes; exit 1 if anything drifted
```
Output ends with e.g. `407 notes, split by client, drift=False, errors=0`. Past 150 lines the index splits per client into `_index-<client>.md`.

## One home per fact (the rule that makes it safe)

A note restates a fact, so it is a second copy. Copies drift. So: convert one area at a time, and retire that area's old document in the SAME pass (mark the old lines false or banner the doc). Never leave two live copies.
