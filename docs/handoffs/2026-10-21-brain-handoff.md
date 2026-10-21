# The Brain: CLAUDE.md shrunk, new facts go in notes (21 Oct 2026)

For Mikey and Leo. Harry approved it: "quick win and then install the full brain and then convert one area at a time".

## What changed

- **CLAUDE.md went from 441 KB to about 43 KB.** It loads into every message, so every chat is cheaper and faster.
- Session history and superseded rules moved word for word to `SESSION_LOG.md` (checked: 0 lines lost).
- **The Brain** is in `brain/`: 90 small notes, one idea each, each with a code (e.g. `RUL-TEAM-001`) and an exact source line.
  `brain/_index.md` lists them all, one line each. Search it before reading any long document.
- The first area moved into the Brain: the working rules (how to talk to the team, deploy and push, the decided-no-toggle
  list, migration status, the 3D rules, the one-engine rules). Those sections in CLAUDE.md are now short lists of codes.
  The old text is frozen in `docs/brain-sources/working-rules-2026-10-21.md` (the notes cite it; never edit it).
- Rules: `kits/brain-kit/SEARCH.md`. How the kit works: `kits/brain-kit/README.md`.

## The prompt

```
The Brain arrived (Harry, 21 Oct 2026). Do this once, in this chat:
1. Merge main into my branch.
2. If CLAUDE.md clashes: take the NEW short version from main. If my branch added history or notes to CLAUDE.md since 20 Oct, move those lines into SESSION_LOG.md (newest first, word for word). If my branch added a standing rule, make it a Brain note instead (step 4).
3. Read kits/brain-kit/SEARCH.md and kits/brain-kit/README.md. From now on, search brain/_index.md before reading long documents, and cite the note code (e.g. RUL-TEAM-001) when you answer.
4. New facts and rules go in brain/ notes, never in CLAUDE.md. A note is brain/<type>/<CODE>.md:
   ---
   id: RUL-ENG-009            (type RUL/FACT/PRO/DEC/REF - area ALL/ENG/3D/UI/CAR/ECO/MED/DAT/ADM/TEAM - next free number)
   type: ruling               (ruling | fact | process | decision | reference)
   client: eng                (all, eng, 3d, ui, car, eco, med, dat, adm or team)
   tags: []                   (leave empty; the script fills it)
   status: live
   date: 2026-10-21
   source: "path/to/file.md:56"   (the exact line or range that says it)
   summary: One plain sentence under 20 words with the word people will search for.
   ---
   A changed rule gets a NEW note; set the old one to status: superseded and superseded_by: NEW-CODE. Never reuse a code.
5. After any note change run: python3 scripts/brain/build_index.py   It must end with errors=0. An ERROR about a source line means the line moved or no longer says it: fix the line number (scripts/brain/make_notes.py with a spec in scripts/brain/specs/ finds lines by their text).
6. Commit and push my own branch. Tell me in plain English what you merged and moved.
```

## Numbers

- CLAUDE.md: 440,866 bytes (about 110,000 tokens) before, about 43,000 bytes (about 11,000 tokens) after.
- Pilot: 10 real questions, all 10 answered right from the Brain, about 89 times less reading.
- Full results: `kits/brain-kit/results/knowitball-2026-10-21.md`.
