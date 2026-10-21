# Brain search rules (paste into CLAUDE.md)

**The Brain lives in `brain/`. Search it before reading any long document.**
1. Know the code (e.g. RUL-ALL-014)? Open `brain/*/<code>.md`.
2. Otherwise grep `brain/_index*.md` for the key noun. Read ALL matching lines, then open at most 3 notes.
3. Follow a note's `source:` only when you need the full reasoning.
4. No match = say "no note yet". Never answer from a nearby note.
5. Cite the code in your answer (e.g. "RUL-ALL-014") so Harry, Mikey or Leo can check it.

**When a fact changes:** write a NEW note, set the old one to `status: superseded` + `superseded_by:`, run `python3 scripts/brain/build_index.py`. Never edit a live note's meaning in place.
**New tag?** Add it to `brain/_tags.md` first, with Harry, Mikey or Leo's OK.
