# How to convert a repo (the recipe that worked)

Total for Zocial-gen-operations: about 1M tokens for 400 notes, done in an evening.

## 1. Install (5 minutes)
Copy `scripts/brain/build_index.py`, `brain/_tags.md` and `SEARCH.md` into the repo root. Paste SEARCH.md into CLAUDE.md. Write 10-20 tags that fit this repo.

## 2. Pilot on 10 questions (about 150k tokens)
1. Write 10 real questions the owner actually asks. Confirm each has an answer in the docs.
2. Write only the notes those questions need (25-40).
3. Answer each question twice: old way (grep the docs) and new way (index, then notes). Record right/wrong and characters read.

## 3. Blind test (about 100k tokens)
A SEPARATE agent, that never saw the notes being written, writes 15 new questions from the docs and answers them from the Brain only. Record hit / miss / wrong. Any "wrong" is a stop sign: fix the cause first.
(Our result: 11/15 hit, 4 "no note yet", 0 wrong.)

## 4. Convert in parallel (about 0.1M tokens per helper)
- Split the repo into 6 areas. One helper per area.
- **Give each helper its own number range** (100-199, 200-299, ...) so two helpers can never mint the same code.
- Helpers write new files in `brain/` ONLY: no git, no editing existing files, no running the script. One person runs the script and commits at the end.
- Tell each helper to read `brain/_index*.md` first and skip ideas already there.
(Our run: 6 helpers, 344 notes in about 2 minutes.)

## 5. Fix pass (about 100k tokens)
Run the script. Then fix: every `ERROR` (wrong source line: find the true line, never invent), every "0 tags" warning (add a default in `_tags.md`), and duplicates across helpers (keep one, mark the other superseded; never delete, codes are never reused). Repeat until `errors=0`.

## 6. Retire the old docs, one area at a time
For each converted area: banner the old doc ("Moved to the Brain: see RUL-..., FACT-...") or mark its lines false. Same pass, never later.

## 7. Big docs and skills
Don't chop them up. Give each one REF note (summary + its sections in the body) pointing to the file. Move hard facts out of skills into notes, and make the skill cite the code.

## Gotchas we hit
- Keyword tagging mis-tags (a "£" sign tagged a cost note as "offer"): match on the summary only, use type:client defaults.
- Helpers copy line numbers from memory: the source check catches it.
- A loose index grep returns a plausible WRONG note: read the summary before opening.
- One-idea notes lose some nuance: the `source:` line recovers it in one read.
