# Patch notes: the organising plan

Planning only. No code changed, nothing committed. Sources: the repo at `2c2cab0` (same notes data as `main` `5ca671e`), git history, `patch-notes/mikey/versions.json`, the Leo skill's link list, the V1 page, and one claude.ai read (Harry v0.16).
`origin/Leo` (8e02341) and `origin/Mikey` (82ddfde) are behind `main` and hold no extra notes.

Evidence key: **P** = the page's own title, header or pill · **D** = data entry title or summary · **C** = commit · **J** = Mikey's `versions.json` · **S** = Leo skill link list · **V1** = Harry's V1 page · **H** = another kept page's "previous versions" list.

Stills (390×844, throwaway signed-out copy, so full pages show as loading or error):
- `img/current-top.png`
- `img/current-text-only-v0.52.png`
- `img/current-pill-row-end.png`

---

## 1. Summary

| Fact | Number |
|---|---|
| Notes in `lib/patchNotesData.ts` | 58 (Harry 29 · Leo 14 · Mikey 15) |
| Rounds with no entry of their own | 7: Harry v0.14, v0.26, v0.27, v1.1 · Leo v0.3, v0.4 · Mikey v0.1 |
| Notes after the clean-up | 65 (Harry 33 · Leo 16 · Mikey 16) |
| Renumbers and clashes in git | 15 (section 3) |
| Kept page folders and files | 37 `pages/`, 1 `reviews/`, 19 `mikey/` HTML, 19 skill reference copies (section 4) |
| claude.ai links found | 69 (section 5) |
| Notes with no full page today | 10 data notes + 3 new (Harry v0.14, v0.26, v0.27) |
| Can be wired from the repo | Leo v0.15, Leo v0.3, Leo v0.4, Mikey v0.1, Harry v1.1 |
| Can be pulled from claude.ai | 12: Harry v0.14 (check), v0.15, v0.16, v0.17, v0.18, v0.26, v0.27, v0.46, v0.47, v0.48, v0.52, v1.1 (if newer) |
| Probably lost | Harry v0.51 (its link now shows v0.52) |
| Placeholder (midnight) dates | 8 |
| Dates later than the note reached main | 11 |
| Questions | 197 (Q1–Q197) |

Rule proposed: identity = author + author's own version (`harry-v0.56`). The old site number becomes a frozen alias. Each author counts only their own notes. A test inside `npm run build` blocks clashes.

---

## 2. Every note (65)

Columns:
- **Site** = today's shared number, which becomes the alias.
- **Date** = `publishedAt` today.
- **Live** = first `main` first-parent commit carrying the link (`git log origin/main --first-parent -S<id>`).
- **Page** = kept page, under `patch-notes/`.
- **Link** = claude.ai artifact id.
- **Title Q** = the proposed list title, asked as a question. The recommended answer is "yes, as written".

### Harry (33)

| # | Note | Site | Date | Live | Page | Link | Evidence | Action | Title Q (rec: yes) |
|---|---|---|---|---|---|---|---|---|---|
| N1 | Harry v0.1 | 0.1 | 21 Sep ⚠midnight | 21 Sep | pages/0.1 | none | P sub "branch Harry", "Harry picked…"; D | keep; fix date | Q75 "Keeper beaten, cutbacks, camera framing"? |
| N2 | Harry v0.3 | 0.3 | 22 Sep ⚠ | 22 Sep | pages/0.3 | PhoNj7N3AvoR8keYRMAkZN | P, V1 | fix date | Q76 "Scenario saving made clear, auto-tuner added"? |
| N3 | Harry v0.3.5 | 0.3.5 | 22 Sep ⚠ | 22 Sep | pages/0.3.5 | L4zdK7X44YctKBvHsPTZhB | P, V1 | fix date | Q77 "Gallery fixes and decisions from the call"? |
| N4 | Harry v0.4 | 0.4 | 22 Sep | 22 Sep | pages/0.4 | XcQqdgi1WDVUcPBwKf8vbC | P, V1 | keep | Q78 "Play keeps your drawing; Infinite Match"? |
| N5 | Harry v0.7 | 0.7 | 23 Sep ⚠ | 23 Sep | pages/0.7 | U1uHCBfUzgsoozGaFnKxTG | P, V1 | fix date | Q79 "Gallery Play matches the picture"? |
| N6 | Harry v0.8 | 0.8 | 23 Sep ⚠ | 23 Sep | pages/0.8 | DYAaW3Bma3zowkG5DcoQaS | P, V1 | fix date | Q80 "Save from matches, scenario guide, admin help"? |
| N7 | Harry v0.9 | 0.9 | 24 Sep ⚠ | 24 Sep | pages/0.9 | 5njEpoPHxLK1oWvin2NLhZ (shows later) | P, V1 | fix date; flag link | Q81 "Test screens play the real match"? |
| N8 | Harry v0.10 | 0.10 | 24 Sep | 24 Sep | pages/0.10 | 5njEp… (shows later) | P, V1 | flag link | Q82 "The guard; trial and training on the real match"? |
| N9 | Harry v0.14 | none | (26 Sep, V1) | never an entry | none | 5njEp… (probably shows v0.14) | V1 "v0.14 · Harry" | add note | Q83 "Penalties and free kicks to real numbers"? |
| N10 | Harry v0.15 | 0.15 | 27 Sep | 30 Sep | none | null; V1 says 84AyJtkFoKKySzhKNFeKaX | D, V1 | add link; pull page | Q84 "The plan from the 40-minute playtest"? |
| N11 | Harry v0.16 | 0.16 | 27 Sep | 30 Sep | none | A9gwVhtt8dAVBwddYgrh7A | D; claude.ai read `<title>Knowitball v0.16` | pull page | Q85 "The v0.15 plan, built: the drawing is the team"? |
| N12 | Harry v0.17 | 0.17 | 28 Sep | 30 Sep | none | 45LCtddFQZAvSQsc2JWk6S | D, V1, C 225bf56 | pull page | Q86 "Whole game reskinned, 3D players, the Store"? |
| N13 | Harry v0.18 | 0.18 | 28 Sep | 30 Sep | none | HvagWBceebfaR9KmxRKhgh | D, V1, C 225bf56 | pull page | Q87 "The road to the App Store, a smoother match"? |
| N14 | Harry v0.22 | 0.22 | 1 Oct | 3 Oct | pages/0.22 | AHUmDmsxzNfG1UhEkn3N7n | P, V1 | keep | Q88 "UI & Home review"? |
| N15 | Harry v0.23 | 0.23 | 1 Oct | 3 Oct | pages/0.23 | HBE3svQRyVBbVcUMWjMW1g | P, V1 | keep | Q89 "Huge updates review: app look, North and South"? |
| N16 | Harry v0.23.1 | 0.23.1 | 1 Oct | 3 Oct | pages/0.23.1 | 8wzaQV41ZmrhtBXZV46Rav | P, V1 | keep | Q90 "Fixes from v0.23: liquid bars, sounds"? |
| N17 | Harry v0.24 | 0.24 | 2 Oct | 3 Oct | pages/0.24 | CQ5gkXrcPk2gptL1EjX3au | P, V1 | keep | Q91 "Winnable highlights, trial rework, top bars"? |
| N18 | Harry v0.25 | 0.25 | 3 Oct | 3 Oct | pages/0.25 | 7LXrEgwm72sUVZH5Kcmeyz | P, V1 | keep | Q92 "Live 3D scenes"? |
| N19 | Harry v0.26 | none (Mikey held 0.26) | 3 Oct (H) | unknown | none | 997ZvUvR6NiqyfDnjh2jDm | H: pages 0.29/0.30/0.34/0.42 "v0.26 — 3 Oct — a new-looking match that rarely repeats" | add note; pull page | Q93 "A new-looking match that rarely repeats"? |
| N20 | Harry v0.27 | none (Mikey held 0.27) | 3 Oct (H) | unknown | none | 2XikkuNj5Q7hm9xcy9kmYS | H: "v0.27 — 3 Oct — a tipped-back camera, a keeper who behaves" | add note; pull page | Q94 "A tipped-back camera, a keeper who behaves"? |
| N21 | Harry v0.29 (published as v0.28) | 0.29 | 5 Oct | 5 Oct | pages/0.29 | SRj5ZaVsgWFWca9Dy5bNWx | C 1fa4563, 33177ee | keep; show "published as v0.28" | Q95 "Cheat menus locked, a harder Ballon d'Or"? |
| N22 | Harry v0.30 | 0.30 | 5 Oct | 5 Oct | pages/0.30 | AN3EiQVU8kb1cBWCFjn39A | P, C 6711aaf | keep | Q96 "One body, manager's office, garden, tester access"? |
| N23 | Harry v0.34 | 0.34 | 7 Oct | 7 Oct | pages/0.34 | 73PxQFZCHbaKbkDd8MG96R | P, C c777fc4 | keep | Q97 "Save safety: Gems wallet and Save guard"? |
| N24 | Harry v0.42 | 0.42 | 8 Oct | 9 Oct | pages/0.42 | GWaupeUSruCjKW2qYtnHWW | P, C 65d9e37 | keep | Q98 "3D casino and training pitch, rebuilt Settings"? |
| N25 | Harry V1 (roll-up) | 1.0 | 26 Sep (covers to 3 Oct) | 26 Sep | pages/1.0 | YEK3ykwCQjUpH4S6bQbqKR | D, P "Knowitball v1" | mark roll-up | Q99 "V1: every problem and its fix (v0.1–v0.25)"? |
| N26 | Harry v1.1 (roll-up) | 1.1 (2nd use) | 12 Oct | 12 Oct (2910b43) | pages/1.1 (orphaned) | UcP8z2ppzmj82qRb8ncLyQ (git only) | C 2910b43, f6a14c7 | restore as roll-up | Q100 "8–12 Oct round (split into v0.46–v0.48)"? |
| N27 | Harry v0.46 | 0.46 | 12 Oct | 12 Oct | none | Aw7yz4kbFZnEyVpC7sYNgV | C f6a14c7 | pull page | Q101 "Shop update"? |
| N28 | Harry v0.47 | 0.47 | 12 Oct | 12 Oct | none | 4GnQVtDhxndhFJPjYXtMJv | C f6a14c7 | pull page | Q102 "3D match and cameras"? |
| N29 | Harry v0.48 | 0.48 | 12 Oct | 12 Oct | none | Aw5gexz5UkweXFamZB3Tqu | C f6a14c7 | pull page | Q103 "Gameplay and settings: 45 toggles removed"? |
| N30 | Harry v0.51 | 0.51 | 13 Oct | 13 Oct | none | R5FFG4ugSWNiWxQEMoQjng (shows v0.52) | C 635a792 | text only; flag link | Q104 "Camera, 3D look and keeper"? |
| N31 | Harry v0.52 | 0.52 | 14 Oct ⚠after live | 13 Oct | none | R5FFG4ugSWNiWxQEMoQjng | C 88f2487 | pull page; fix date | Q105 "Camera, ball and two test pages"? |
| N32 | Harry v0.54 | 0.54 | 14 Oct | 14 Oct | pages/0.54 | 1dwJjYucacMcjgxypP342X | P, C d63150a | keep | Q106 "New chances, 3D camera, build-ups that play on"? |
| N33 | Harry v0.56 (published as v0.55) | 0.56 | 14 Oct | 14 Oct | pages/0.56 | LBmYB7rQBTS6nd4XBq7UsG | C 5194451, 5ca671e | keep; show "published as v0.55" | Q107 "Arcade pack, real shots, calmer passing"? |

### Leo (16)

| # | Note | Site | Date | Live | Page | Link | Evidence | Action | Title Q (rec: yes) |
|---|---|---|---|---|---|---|---|---|---|
| N34 | Leo v0.2 | 0.2 (merged v0.2–v0.4) | 22 Sep ⚠midnight | 22 Sep | pages/0.2 | HD5yGHLCNQxHHwGAnrXS7o | D "rounds 1-4 combined"; ref sub "PRs #550, #554, #555" | split | Q108 "Goalie Mode, rounds 1–2"? |
| N35 | Leo v0.3 | none | 21 Sep 21:14 +01 (C 18442d4) | 22 Sep (inside 0.2) | ref copy only | unknown | ref sub "Goalie Mode round 3 · PR #558" | add; copy page | Q109 "Goalie Mode, round 3: cursor fix, shot variety"? |
| N36 | Leo v0.4 | none | 22 Sep 01:55 (C 85fbe7d) | 22 Sep (inside 0.2) | ref copy only | unknown | ref sub "round 4 · PR #561" | add; copy page | Q110 "Goalie Mode, round 4: grass, extras, penalty, free kick"? |
| N37 | Leo v0.5 | 0.5 | 23 Sep ⚠after live | 22 Sep 03:14 +01 (check) | pages/0.5 | YEuw3iut76VY2dZiQVarZd | P, V1, C e8772d5 | fix date | Q111 "Five-a-side freeze fixed; owner powers"? |
| N38 | Leo v0.6 | 0.28 | 5 Oct | 5 Oct | pages/0.28 | PQCcbHkmPEQ3NrzA88nVZS | P, S | keep | Q112 "Keepers made human, dribble passes"? |
| N39 | Leo v0.7 | 0.31 | 6 Oct | 6 Oct | pages/0.31 | null; S says MmprHgEH6epYpooT4Cze7r | P, S, C 3718b69 | add link | Q113 "Retirement 2: 20 seasons, Hall of Fame"? |
| N40 | Leo v0.8 | 0.32 | 6 Oct | 6 Oct | pages/0.32 | PhH1T34JAzEoWReV6NxWH6 | P, S | keep | Q114 "New animations"? |
| N41 | Leo v0.9 | 0.33 | 6 Oct | 6 Oct | pages/0.33 | 39iLwb8KpLGQmK9R7nbLgr | P, S, C a3a73de | keep | Q115 "Retirement 3: records, farewell match, share"? |
| N42 | Leo v0.10 | 0.35 | 7 Oct | 8 Oct | pages/0.35 | Uq2eXdooybw4HrxqC6999X | P, S | keep | Q116 "Goal videos in the feed"? |
| N43 | Leo v0.11 | 0.36 | 8 Oct | 8 Oct | pages/0.36 | 2Uodrmk5Uj9Fm6ZBpUijAY | P, S | keep | Q117 "Goal videos get sound"? |
| N44 | Leo v0.12 | 0.38 | 8 Oct | 8 Oct | pages/0.38 | EGUKS4qyVUU6KoA1qkJAKn | P, S, C c4e01ef | keep | Q118 "Goal videos, round 3"? |
| N45 | Leo v0.13 | 0.39 | 8 Oct 18:00 ⚠after live | 8 Oct 14:18 +01 | pages/0.39 | M9DmuMCkXzeMW9EJ6mJFtZ | P, S, C a2b32f9 | fix date | Q119 "Smart passing and highlights"? |
| N46 | Leo v0.14 | 0.44 | 11 Oct | 12 Oct | pages/0.44 | 9wg6tn2XxSyT8mUBRhrbgy | P, S, C dc5c7b4 | keep | Q120 "The big evening: camera, careers that move"? |
| N47 | Leo v0.15 | 0.45 | 12 Oct | 12 Oct | pages/0.45 (unwired) | 3x6BjhftYfYtYCYJRkKDbg | P, S, C 3a284d0 | wire page | Q121 "The gameplay round"? |
| N48 | Leo v0.16 | 0.53 | 13 Oct | 14 Oct | pages/0.53 | SqbYRDsV64zyZbAoe43i99 | P, S, C 2b2701e, 45ed0bb | keep | Q122 "The Oct 13 gameplay update"? |
| N49 | Leo v0.17 (page says v0.16) | 0.55 | 14 Oct | 15 Oct | pages/0.55 | As3hzmBBUNwdgdf8DhygZm | P "LEO v0.16 · SITE 0.55", C dc50575 | renumber own | Q123 "Updates tab, Henry finish, hitboxes, sound lab"? |

### Mikey (16)

| # | Note | Site | Date | Live | Page | Link | Evidence | Action | Title Q (rec: yes) |
|---|---|---|---|---|---|---|---|---|---|
| N50 | Mikey v0.1 | none (folded into 0.6) | 21 Sep (J) | 23 Sep (inside 0.6) | mikey/v0.1.html (unwired) | C4jvnN4Xc3qZG58T2cRHE6 | J; D 0.6 summary covers it | split; wire | Q124 "Economy, fame and reputation rebuild"? |
| N51 | Mikey v0.2 | 0.6 | 22 Sep ⚠midnight | 23 Sep | mikey/v0.2.html | 4fuKfUh73WvRmxLdiU9tPu | J | split; fix date | Q125 "Energy master plan"? |
| N52 | Mikey v0.3 | 0.11 | 25 Sep | 25 Sep | mikey/v0.3.html | SoBMWDhZGj58LXwP4CFARm | J, V1 | keep | Q126 "The pitch matches where people stand"? |
| N53 | Mikey v0.4 | 0.12 | 25 Sep | 25 Sep | mikey/v0.4.html | FYpjCv5GQ4NPTN9qv4BhwQ | J, V1 | keep | Q127 "Training rebuilt the New Star Soccer way"? |
| N54 | Mikey v0.5 | 0.13 | 26 Sep 12:00 ⚠after live | 26 Sep 03:28 +01 | mikey/v0.5.html | Q681hvwMs83X9895Aevav7 | J, V1 | fix date | Q128 "How you get picked: win your shirt"? |
| N55 | Mikey v0.6 | 0.19 | 27 Sep | 27 Sep | mikey/v0.6.html | XCqpEXqtnZ7Dp4yf4vyTue | J, V1 "first published as 1.1" | keep | Q129 "Five levels of every shop item"? |
| N56 | Mikey v0.7 | 0.20 | 30 Sep | 30 Sep | mikey/v0.7.html | YYDBCrSHUiCb8kKSe9vVfo | J, V1 "Mikey's own v0.7" | keep | Q130 "A 1–10★ star rating"? |
| N57 | Mikey v0.8 | 0.21 | 30 Sep | 30 Sep | mikey/v0.8.html | 6degCbK833CTu3YAZtoyCz | J, V1 | keep | Q131 "Sponsors revamp"? |
| N58 | Mikey v0.9 | 0.26 | 3 Oct | 4 Oct | mikey/v0.9.html | UTFsvaBcLbYJjWmnYtXLHg | J, C 41d20ef | keep | Q132 "XP rebuilt and the XP Book"? |
| N59 | Mikey v0.10 | 0.27 | 4 Oct | 4 Oct | mikey/v0.10.html | 26Lh4jWsraDKYSaZZpqWWk | J | keep | Q133 "Relationships"? |
| N60 | Mikey v0.11 | 0.37 | 8 Oct 12:00 ⚠after live | 8 Oct 05:37 +01 | mikey/v0.11.html | 23eP6tYuyTjuvAbBisnkCj | J, C 5304e53 | fix date | Q134 "The standing ovation"? |
| N61 | Mikey v0.12 | 0.40 | 8 Oct | 8 Oct | mikey/v0.12.html | 6tgaVydhSjEeQea6tkA3oX | J, C d0cff36 | keep | Q135 "Ovation greetings made in Blender"? |
| N62 | Mikey v0.13 | 0.41 | 8 Oct 22:00 ⚠after live | 8 Oct 18:01 | mikey/v0.13.html | D2mVBLe6QDF2jqzHnrjiWt | J, C c8bcec2 | fix date | Q136 "Brackets, the real UEFA knockout, relegation"? |
| N63 | Mikey v0.14 | 0.43 | 9 Oct 15:00 ⚠after live | 9 Oct 14:43 | mikey/v0.14.html | 843j4zo8tXx2CKCzYceAFh | J, C f1729e1 | fix date | Q137 "Real moments from StatsBomb"? |
| N64 | Mikey v0.15 | 0.49 | 13 Oct 09:00 ⚠after live | 13 Oct 02:24 | mikey/v0.15.html | 1VrPsvpikmWNaxcTFzpgGt | J, C 27ae578 | fix date | Q138 "International football"? |
| N65 | Mikey v0.16 | 0.50 | 13 Oct 17:00 ⚠after live | 13 Oct 16:50 | mikey/v0.16.html | S5EvHkuf7wJTaGPeXd3WeM | J, C 82ddfde | fix date | Q139 "Gameplay review fixes"? |

Also dated after reaching main, by under a minute: v0.46, v0.47 and v0.48 (18:00 vs 17:59). They are covered by Q149.

---

## 3. Every clash and renumber (15)

| # | Date | What happened | Commits | Proposed owner of the old number |
|---|---|---|---|---|
| C1 | 22 Sep | Leo's 0.2/0.3/0.4 merged into one "0.2" so Harry could use 0.3/0.4 | baad702, ff4d95d, 78e306b | alias 0.2 → Leo v0.2 (Q12) |
| C2 | 22 Sep | Mikey's first entry "0.4" → "0.6" (Harry had 0.4) | 7566a88 → d1f6434 | 0.4 → Harry v0.4; 0.6 → Mikey v0.2 (Q13) |
| C3 | 22 Sep | Mikey v0.1 folded into the same entry | 7566a88 | v0.1 gets no alias (Q14) |
| C4 | 27 Sep | Mikey v0.6 entered as "0.14"; Harry's v0.14 also existed | 0fc6e27 | 0.14 → Harry v0.14 (Q15) |
| C5 | 30 Sep | Mikey v0.6 "1.1" → "0.19" | 6891581 | 0.19 → Mikey v0.6; 1.1 history-only (Q16) |
| C6 | 30 Sep | Mikey v0.7 "1.2" → "0.20" | 8f28a11 → bffca8f | 1.2 → Mikey v0.7 (Q17) |
| C7 | 4 Oct | Mikey v0.9 "0.22" → "0.26" (Harry's 0.22–0.25 first) | 1cf1d84 → 41d20ef | 0.22 → Harry v0.22; 0.26 → Mikey v0.9 (Q18) |
| C8 | 3–4 Oct | Harry's v0.26 and v0.27 never got entries (Mikey held 0.26/0.27) | pages 0.29–0.42 list them | add as Harry notes, no alias (Q19) |
| C9 | 5 Oct | Harry's v0.28 renamed v0.29 (Leo v0.6 held 0.28); page title edited | 1fa4563, 33177ee | 0.28 → Leo v0.6; Harry stays v0.29 (Q20) |
| C10 | 12 Oct | Harry's "1.1" (2nd use of 1.1) split into 0.46/0.47/0.48; page orphaned | 2910b43 → f6a14c7 | 1.1 → Harry v1.1 (Q21) |
| C11 | 13–14 Oct | Leo "0.50" → "0.53" (Mikey v0.16 held 0.50) | 2b2701e, 82ddfde → 45ed0bb | 0.50 → Mikey v0.16 (Q22) |
| C12 | 14 Oct | Harry's round drafted "v053" → published v0.54 | d63150a; scratchpad `v053/` | 0.53 → Leo v0.16 (Q23) |
| C13 | 15 Oct | Harry "0.55" → "0.56"; page title edited | 5194451 → 5ca671e | 0.55 → Leo v0.17 (Q24) |
| C14 | 14 Oct | Leo and Harry both created `pages/0.55/` in parallel | dc50575, 5194451 | new pages go in `patch-notes/<author>/` (Q25) |
| C15 | 13–14 Oct | Leo's own number v0.16 used twice | 2b2701e, dc50575 | 14 Oct round → Leo v0.17 (Q26) |

---

## 4. Every kept page and copy

| # | Path | What | Note | Action |
|---|---|---|---|---|
| K1 | pages/0.1 | Harry v0.1 | N1 | keep |
| K2 | pages/0.2 | Leo v0.2 (12,970 B ref vs 19,334 B kept) | N34 | keep |
| K3 | pages/0.3 | Harry v0.3 | N2 | keep |
| K4 | pages/0.3.5 | Harry v0.3.5 | N3 | keep |
| K5 | pages/0.4 | Harry v0.4 (ref copy differs: 22,313 vs 22,683 B) | N4 | keep kept copy (Q60) |
| K6 | pages/0.5 | Leo v0.5 (= ref v0.5) | N37 | keep |
| K7 | pages/0.7 | Harry v0.7 | N5 | keep |
| K8 | pages/0.8 | Harry v0.8 | N6 | keep |
| K9 | pages/0.9 | Harry v0.9 | N7 | keep |
| K10 | pages/0.10 | Harry v0.10 | N8 | keep |
| K11 | pages/0.22 | Harry v0.22 | N14 | keep |
| K12 | pages/0.23 | Harry v0.23 | N15 | keep |
| K13 | pages/0.23.1 | Harry v0.23.1 | N16 | keep |
| K14 | pages/0.24 | Harry v0.24 | N17 | keep |
| K15 | pages/0.25 | Harry v0.25 | N18 | keep |
| K16 | pages/0.28 | Leo v0.6 (= ref) | N38 | keep |
| K17 | pages/0.29 | Harry v0.29 (title edited from v0.28) | N21 | keep (Q61) |
| K18 | pages/0.30 | Harry v0.30 | N22 | keep |
| K19 | pages/0.31 | Leo v0.7 (= ref) | N39 | keep |
| K20 | pages/0.32 | Leo v0.8 (= ref) | N40 | keep |
| K21 | pages/0.33 | Leo v0.9 (ref differs by 98 B) | N41 | keep kept copy (Q62) |
| K22 | pages/0.34 | Harry v0.34 | N23 | keep |
| K23 | pages/0.35 | Leo v0.10 (= ref) | N42 | keep |
| K24 | pages/0.36 | Leo v0.11 (ref differs by 73 B) | N43 | keep kept copy (Q63) |
| K25 | pages/0.38 | Leo v0.12 (ref differs by 337 B) | N44 | keep kept copy (Q64) |
| K26 | pages/0.39 | Leo v0.13 (ref same size, bytes differ) | N45 | keep kept copy (Q65) |
| K27 | pages/0.42 | Harry v0.42 | N24 | keep |
| K28 | pages/0.44 | Leo v0.14 (= ref) | N46 | keep |
| K29 | pages/0.45 | Leo v0.15 (= ref), **not wired** | N47 | wire (Q31) |
| K30 | pages/0.53 | Leo v0.16 (ref differs by 133 B) | N48 | keep kept copy (Q66) |
| K31 | pages/0.54 | Harry v0.54 | N32 | keep |
| K32 | pages/0.55 | Leo v0.17 (page says v0.16) | N49 | keep (Q67) |
| K33 | pages/0.56 | Harry v0.56 (title edited from v0.55) | N33 | keep (Q61) |
| K34 | pages/1.0 | Harry V1 | N25 | keep |
| K35 | pages/1.1 | Harry v1.1, **orphaned** (key in `PATCH_NOTE_PAGES`, no note) | N26 | wire (Q32) |
| K36 | pages/app-plan | App Plan (not a note) | — | keep on /admin/app-plan (Q68) |
| K37 | reviews/0.20 | Harry's review of Mikey v0.7 | N56 tab | key by id `mikey-v0.7` (Q69) |
| K38–K53 | mikey/v0.1.html … v0.16.html (16 files) | Mikey v0.1–v0.16 | N50–N65 | keep; wire v0.1 (Q33) |
| K54 | mikey/casino-scandals.html | Mikey plan page (not a note) | — | Q70 |
| K55 | mikey/international-plan.html | Mikey plan page (not a note) | — | Q71 |
| K56 | mikey/plans/relationships.html | Mikey plan page (not a note) | — | Q72 |
| K57 | skills ref `patch-notes-v0.1.html` (Leo) = pages/0.1 | Harry v0.1 copy used as Leo's seed | N1 | relabel in skill (Q73) |
| K58 | skills ref `patch-notes-v0.3.html` (Leo) | Leo v0.3, only copy | N35 | copy to patch-notes/leo/v0.3/ (Q34) |
| K59 | skills ref `patch-notes-v0.4.html` (Leo) | Leo v0.4, only copy | N36 | copy to patch-notes/leo/v0.4/ (Q35) |
| K60 | skills ref `patch-notes-harry-v0.4.html` | Harry v0.4 copy in Leo's skill | N4 | Q74 |
| K61 | skills ref v0.2, v0.5–v0.16 (13 files) | Leo copies of kept pages | N34–N48 | keep as skill history |
| K62 | `artifact-house-style/references/patch-notes-v0.1.html` | Harry v0.1, design seed | N1 | keep |

Size: `patch-notes/` is 125 MB today.

---

## 5. Every claude.ai link (69)

| # | Id | What | Where it appears | Action |
|---|---|---|---|---|
| L1 | C4jvnN4Xc3qZG58T2cRHE6 | Mikey v0.1 | J, 15 Mikey pages | link on N50 |
| L2 | 4fuKfUh73WvRmxLdiU9tPu | Mikey v0.2 | data 0.6, J, V1 | N51 |
| L3 | SoBMWDhZGj58LXwP4CFARm | Mikey v0.3 | data 0.11, J, V1 | N52 |
| L4 | FYpjCv5GQ4NPTN9qv4BhwQ | Mikey v0.4 | data 0.12, J, V1 | N53 |
| L5 | Q681hvwMs83X9895Aevav7 | Mikey v0.5 | data 0.13, J, V1 | N54 |
| L6 | XCqpEXqtnZ7Dp4yf4vyTue | Mikey v0.6 | data 0.19, J, V1 | N55 |
| L7 | YYDBCrSHUiCb8kKSe9vVfo | Mikey v0.7 | data 0.20, J, V1 | N56 |
| L8 | 6degCbK833CTu3YAZtoyCz | Mikey v0.8 | data 0.21, J, V1 | N57 |
| L9 | UTFsvaBcLbYJjWmnYtXLHg | Mikey v0.9 | data 0.26, J | N58 |
| L10 | 26Lh4jWsraDKYSaZZpqWWk | Mikey v0.10 | data 0.27, J | N59 |
| L11 | 23eP6tYuyTjuvAbBisnkCj | Mikey v0.11 | data 0.37, J | N60 |
| L12 | 6tgaVydhSjEeQea6tkA3oX | Mikey v0.12 | data 0.40, J | N61 |
| L13 | D2mVBLe6QDF2jqzHnrjiWt | Mikey v0.13 | data 0.41, J | N62 |
| L14 | 843j4zo8tXx2CKCzYceAFh | Mikey v0.14 | data 0.43, J | N63 |
| L15 | 1VrPsvpikmWNaxcTFzpgGt | Mikey v0.15 | data 0.49, J | N64 |
| L16 | S5EvHkuf7wJTaGPeXd3WeM | Mikey v0.16 | data 0.50, J | N65 |
| L17 | HD5yGHLCNQxHHwGAnrXS7o | Leo v0.2 | data 0.2, V1 | N34 |
| L18 | YEuw3iut76VY2dZiQVarZd | Leo v0.5 | data 0.5, V1, pages/0.2 | N37 |
| L19 | PQCcbHkmPEQ3NrzA88nVZS | Leo v0.6 | data 0.28, S | N38 |
| L20 | MmprHgEH6epYpooT4Cze7r | Leo v0.7 | S, CLAUDE.md, data text | add as N39 link (Q42) |
| L21 | PhH1T34JAzEoWReV6NxWH6 | Leo v0.8 | data 0.32, S, 15 Leo pages | N40 |
| L22 | 39iLwb8KpLGQmK9R7nbLgr | Leo v0.9 | data 0.33, S | N41 |
| L23 | Uq2eXdooybw4HrxqC6999X | Leo v0.10 | data 0.35, S | N42 |
| L24 | 2Uodrmk5Uj9Fm6ZBpUijAY | Leo v0.11 | data 0.36, S | N43 |
| L25 | EGUKS4qyVUU6KoA1qkJAKn | Leo v0.12 | data 0.38, S | N44 |
| L26 | M9DmuMCkXzeMW9EJ6mJFtZ | Leo v0.13 | data 0.39, S | N45 |
| L27 | 9wg6tn2XxSyT8mUBRhrbgy | Leo v0.14 | data 0.44, S | N46 |
| L28 | 3x6BjhftYfYtYCYJRkKDbg | Leo v0.15 | data 0.45, S | N47 |
| L29 | SqbYRDsV64zyZbAoe43i99 | Leo v0.16 | data 0.53, S | N48 |
| L30 | As3hzmBBUNwdgdf8DhygZm | Leo v0.17 | data 0.55 | N49 |
| L31 | DPNpkyaPoyHWj6xuLpGvGG | Leo's after-retirement plans (not a note) | pages/0.31, CLAUDE.md | Q48 |
| L32 | 7po13VAQhL18KyDHphFf35 | Leo's retirement proposal (not a note) | CLAUDE.md | Q49 |
| L33 | PhoNj7N3AvoR8keYRMAkZN | Harry v0.3 | data, V1 | N2 |
| L34 | L4zdK7X44YctKBvHsPTZhB | Harry v0.3.5 | data, V1 | N3 |
| L35 | XcQqdgi1WDVUcPBwKf8vbC | Harry v0.4 | data, V1 | N4 |
| L36 | U1uHCBfUzgsoozGaFnKxTG | Harry v0.7 | data, V1 | N5 |
| L37 | DYAaW3Bma3zowkG5DcoQaS | Harry v0.8 | data, V1, pages 0.9/0.10 | N6 |
| L38 | 5njEpoPHxLK1oWvin2NLhZ | Harry v0.9 → v0.10 → v0.14 (republished) | data 0.9 + 0.10, V1 | Q36–Q38 |
| L39 | 84AyJtkFoKKySzhKNFeKaX | Harry v0.15 plan | V1 only | N10 (Q41) |
| L40 | A9gwVhtt8dAVBwddYgrh7A | Harry v0.16 | data, V1 | N11 |
| L41 | 45LCtddFQZAvSQsc2JWk6S | Harry v0.17 | data, V1 | N12 |
| L42 | HvagWBceebfaR9KmxRKhgh | Harry v0.18 | data, V1 | N13 |
| L43 | 77m3YmMb1EWATw7U67CPkr | Harry's review of Mikey v0.7 | V1 | N56 "Harry's notes" tab link (Q50) |
| L44 | LqApGpLiKy1ikSMo5u8Yia | Playtest recording behind v0.15 | V1 | Q51 |
| L45 | AHUmDmsxzNfG1UhEkn3N7n | Harry v0.22 | data, V1 | N14 |
| L46 | 1nqUW1kkiuUsPmFXERm678 | Harry v0.22 files-less duplicate | Leo skill | Q43 |
| L47 | HBE3svQRyVBbVcUMWjMW1g | Harry v0.23 | data, V1 | N15 |
| L48 | 8wzaQV41ZmrhtBXZV46Rav | Harry v0.23.1 | data, V1 | N16 |
| L49 | CQ5gkXrcPk2gptL1EjX3au | Harry v0.24 | data, V1 | N17 |
| L50 | 7LXrEgwm72sUVZH5Kcmeyz | Harry v0.25 | data, V1 | N18 |
| L51 | 997ZvUvR6NiqyfDnjh2jDm | Harry v0.26 | pages 0.29/0.30/0.34/0.42, V1 generator | N19 |
| L52 | 2XikkuNj5Q7hm9xcy9kmYS | Harry v0.27 | same | N20 |
| L53 | SRj5ZaVsgWFWca9Dy5bNWx | Harry v0.29 | data, pages 0.30/0.34/0.42 | N21 |
| L54 | AN3EiQVU8kb1cBWCFjn39A | Harry v0.30 | data, pages 0.34/0.42 | N22 |
| L55 | 73PxQFZCHbaKbkDd8MG96R | Harry v0.34 | data | N23 |
| L56 | 4hthbjbsdTx88UJfzCmV35 | Harry's look-and-style plan (not a note) | data 0.34 text, pages/0.34 | Q52 |
| L57 | GWaupeUSruCjKW2qYtnHWW | Harry v0.42 | data | N24 |
| L58 | YEK3ykwCQjUpH4S6bQbqKR | Harry V1 | data, house-style skill | N25 |
| L59 | UcP8z2ppzmj82qRb8ncLyQ | Harry v1.1 | git only (2910b43) | N26 (Q32) |
| L60 | Aw7yz4kbFZnEyVpC7sYNgV | Harry v0.46 | data | N27 |
| L61 | 4GnQVtDhxndhFJPjYXtMJv | Harry v0.47 | data | N28 |
| L62 | Aw5gexz5UkweXFamZB3Tqu | Harry v0.48 | data | N29 |
| L63 | R5FFG4ugSWNiWxQEMoQjng | Harry v0.51 → v0.52 (republished) | data 0.51 + 0.52 | Q39–Q40 |
| L64 | 1dwJjYucacMcjgxypP342X | Harry v0.54 | data | N32 |
| L65 | LBmYB7rQBTS6nd4XBq7UsG | Harry v0.56 | data | N33 |
| L66 | EnVPRppWvmaPcPfaWVo64j | Sound page linked from v0.23/v0.23.1 (not a note) | pages 0.23, 0.23.1 | Q53 |
| L67 | HCv8d9pkR3N773eKFux9ye | "See all 186" shop levels page (not a note) | pages/0.23 | Q54 |
| L68 | AFCRmaujwsoe83dLKDPszZ | Mikey's international football page (not a note) | mikey/v0.15.html | Q55 |
| L69 | 11KW1FQ1dKfbg68xSpjcmC | Mikey's Ballon d'Or winners data page (not a note) | mikey/v0.11.html, CLAUDE.md | Q56 |

Not checked:
- Which of L1–L69 still open. Only L40 was read.
- Whether any claude.ai page exists that no file mentions. Only the person's own artifact list can show that (Q57).

---

## 6. The rule (unchanged from the first pass)

| Part | Proposal |
|---|---|
| Identity | `author` + `version` (author's own) → id `harry-v0.56` |
| Authors | `harry`, `leo`, `mikey` |
| Next number | your own highest + 0.1, from your own file only |
| Old site number | `siteAlias`, frozen, today's meaning; earlier meanings in `formerly` |
| Data files | `lib/patchNotes/harry.ts`, `leo.ts`, `mikey.ts`; `lib/patchNotesData.ts` merges and sorts |
| New page folders | `patch-notes/<author>/v<version>/index.html` (+ `img/`) |
| Old page folders | stay; note's `page` field points at them |
| New fields | `author`, `line`, `liveSince`, `page`, `siteAlias`, `formerly`, `covers`, `kind`, `linkShowsLater` |
| Guard | `tests/star/patchNotes.mts`, also run in `npm run build` |
| Guard fails on | duplicate (author, version) · missing/unknown author · missing page file · duplicate alias · alias on a new note · bad version shape · `versions.json` mismatch · unpointed kept page (allow list for plans) |
| Skills | rule once in `artifact-house-style`; 5-line summary in `creating-patch-notes`, `creating-patch-notes-mikey`, new `creating-patch-notes-harry` |

---

## 7. Archive design (unchanged sketch; choices are Q158–Q183)

```
┌──────────────────────────────────────┐
│ Patch notes                  ARCHIVE │
│ 65 notes · Harry 33 · Leo 16 · Mikey 16
│ [🔍 Search notes, "v0.16", "0.53"  ] │
│ [ All 65 ][●Harry 33][●Leo 16][●Mikey 16]
│ TUE 14 OCT                           │
│ (H) Harry v0.56   ● Live 14 Oct      │
│ Arcade pack, real shots, calmer…     │
│ Arcade banners and sounds; a TV…  › │
│ (L) Leo v0.17     ● Live 15 Oct      │
│ Updates tab, Henry finish…  page says v0.16
└──────────────────────────────────────┘
```

---

## 8. Migration steps

| Step | What | Harry sees first? |
|---|---|---|
| 0 | Merge `main`; tell Leo's and Mikey's sessions | Q184 |
| 1 | Add fields; `author` required | Q185 |
| 2 | Split data into 3 files (pure move, object-for-object diff) | Q186 |
| 3 | Fill identity from section 2 | Q187 |
| 4 | Split merged entries; add v0.14, v0.26, v0.27, v1.1 | Q188 |
| 5 | Move pages into notes' `page`; wire 0.45, 1.1, mikey/v0.1; copy Leo v0.3/v0.4 | Q189 |
| 6 | Routes take `id=` and old `v=` | Q190 |
| 7 | Fix dates; backfill `liveSince`; add stamp script | Q191 |
| 8 | Write `line` for 65 notes | Q192 |
| 9 | Test + build hook | Q193 |
| 10 | Archive UI + PageGuide text; stills | Q194 |
| 11 | Skills, incl. new Harry skill | Q195 |
| 12 | claude.ai pulls, one note per commit | Q196 |

---

## 9. Main questions (Q1–Q11)

| # | Question | Recommended answer | Evidence |
|---|---|---|---|
| Q1 | Keep your numbers as on your pages, gaps included? | Yes; next is v0.57 | Pages, links and messages already say them |
| Q2 | Keep v0.29 and v0.56 (published as v0.28 / v0.55)? | Yes; show "first published as" | C 33177ee, 5ca671e |
| Q3 | Leo's second v0.16 → Leo v0.17? | Yes; needs Leo's nod | C15 |
| Q4 | Split merged entries (Leo v0.2–v0.4; Mikey v0.1–v0.2)? | Yes | pages exist for all 5 |
| Q5 | V1 and v1.1 as Harry roll-ups; restore v1.1? | Yes | K35 orphaned |
| Q6 | "Live since <date>" instead of the deploy-date rule? | Yes | archive is main itself |
| Q7 | Clash check blocks deploy? | Yes | 15 clashes |
| Q8 | One notes file per person? | Yes | every clash began at the top of one list |
| Q9 | Pull the missing pages from claude.ai, stills only? | Yes | L40 read: page + 79 files |
| Q10 | Add a Harry patch-notes skill? | Yes | Leo and Mikey have one |
| Q11 | Colours: Harry green, Leo blue, Mikey violet, plus letter? | Yes | letter means colour is never the only signal |

---

## 9b. Item-by-item questions (Q12–Q197)

### Clashes: which note keeps the number

| # | Question | Rec | Evidence |
|---|---|---|---|
| Q12 | C1: alias 0.2 → Leo v0.2? | Yes | data 0.2 link = HD5y (Leo v0.2) |
| Q13 | C2: alias 0.4 → Harry v0.4, 0.6 → Mikey v0.2? | Yes | today's meaning |
| Q14 | C3: Mikey v0.1 gets no alias? | Yes | it never had its own number |
| Q15 | C4: alias 0.14 → Harry v0.14 (Mikey v0.6 only briefly used it)? | Yes | V1 lists "v0.14 Harry" |
| Q16 | C5: 0.19 → Mikey v0.6; 1.1 not his alias? | Yes | 1.1 now means Harry v1.1 |
| Q17 | C6: alias 1.2 → Mikey v0.7? | Yes | unused since 30 Sep |
| Q18 | C7: 0.22 → Harry v0.22, 0.26 → Mikey v0.9? | Yes | today's meaning |
| Q19 | C8: add Harry v0.26 and v0.27 as notes, no alias? | Yes | links L51, L52 exist |
| Q20 | C9: alias 0.28 → Leo v0.6? | Yes | today's meaning |
| Q21 | C10: alias 1.1 → Harry v1.1? | Yes | `?v=1.1` opens pages/1.1 today |
| Q22 | C11: alias 0.50 → Mikey v0.16? | Yes | today's meaning |
| Q23 | C12: alias 0.53 → Leo v0.16; no "v0.53" for Harry? | Yes | Harry published as v0.54 |
| Q24 | C13: alias 0.55 → Leo v0.17? | Yes | today's meaning |
| Q25 | C14: all new pages under `patch-notes/<author>/`? | Yes | the same folder can't be made twice |
| Q26 | C15: 14 Oct Leo round = v0.17; 13 Oct keeps v0.16? | Yes | ref v0.16 = 13 Oct page |
| Q27 | Show old site numbers on rows at all? | Only in search and on the open note | rows stay short |
| Q28 | Show `formerly` history ("was 1.1, then 0.19") on the note? | Yes, one line | explains old links |
| Q29 | Leo has no v0.1: leave the gap? | Yes | his v0.1 was Harry's page |
| Q30 | Harry's skipped numbers (v0.2, v0.5, v0.6, v0.11–0.13, v0.19–0.21, v0.28, v0.31–0.33, v0.35–0.41, v0.43–0.45, v0.49, v0.50, v0.53, v0.55): leave as gaps? | Yes | nothing was published under them |

### Missing or wrong pages: pull, rebuild, or lost

| # | Question | Rec | Evidence |
|---|---|---|---|
| Q31 | Leo v0.15: wire `pages/0.45`? | Yes | page = ref v0.15 |
| Q32 | Harry v1.1: wire `pages/1.1`; pull L59 only if newer? | Wire now; read L59 to compare | page added 12 Oct with the entry |
| Q33 | Mikey v0.1: wire `mikey/v0.1.html`? | Yes | J |
| Q34 | Leo v0.3: copy ref into `patch-notes/leo/v0.3/`? | Yes | self-contained, no images |
| Q35 | Leo v0.4: copy ref into `patch-notes/leo/v0.4/`? | Yes | same |
| Q36 | Harry v0.14: pull L38 if its `<h1>` says v0.14? | Yes | republished in place for v0.10 → v0.14 (reasoned) |
| Q37 | If L38 shows v0.10, mark v0.14 lost? | Yes; text from V1's v0.14 section | V1 has its items |
| Q38 | Harry v0.14 text: copy V1's v0.14 items into the note's Text? | Yes | no other text exists |
| Q39 | Harry v0.51: mark lost, text only? | Yes, unless claude.ai history has it | read returns current only |
| Q40 | Will you look in claude.ai's version history for v0.51? | Optional | can't be done from a session |
| Q41 | Harry v0.15: pull L39? | Yes | V1 "the plan" link |
| Q42 | Leo v0.7: set data link to L20? | Yes | S |
| Q43 | Harry v0.22: ignore duplicate L46? | Yes | Leo skill: "use the first link" |
| Q44 | Pull Harry v0.16, v0.17, v0.18, v0.26, v0.27, v0.46, v0.47, v0.48, v0.52? | Yes, one commit each | L40 read worked |
| Q45 | Swap every pulled video for its poster still plus a "watch on the artifact" link? | Yes | rule: never commit .mp4 |
| Q46 | Cap per pulled page (e.g. 5 MB) given 125 MB already? | Yes, 5 MB; recompress over that | v0.16 has 79 files |
| Q47 | Text-only notes: show "Full page not kept" plus the link? | Yes | honest, one tap to the original |

### Other links, links that show later content, page copies

| # | Question | Rec | Evidence |
|---|---|---|---|
| Q48 | L31 Leo's plans page: list it under Leo as "plan", or leave it only in the note text? | Leave in text | not a note |
| Q49 | L32 Leo's retirement proposal: same? | Leave in text | not a note |
| Q50 | L43 Harry's review: put the link on the "Harry's notes" tab? | Yes | the tab is that review |
| Q51 | L44 playtest recording page: link from Harry v0.15? | Yes | V1: "behind v0.15's decisions" |
| Q52 | L56 look-and-style plan: leave in v0.34 text? | Yes | not a note |
| Q53 | L66 sound page: leave in v0.23 pages? | Yes | not a note |
| Q54 | L67 shop levels page: leave in v0.23 page? | Yes | not a note |
| Q55 | L68 international page: leave in Mikey v0.15 page? | Yes | not a note |
| Q56 | L69 Ballon d'Or page: leave? | Yes | not a note |
| Q57 | Will you check your claude.ai artifact list for notes no file mentions? | Yes, once | I can only see links written in the repo |
| Q58 | v0.9 row: hide "Open the original artifact" and say "link now shows a later version"? | Yes | L38 republished |
| Q59 | v0.10 row: same? | Yes | L38 |
| Q60 | Harry v0.4: archive copy wins over Leo-skill copy (370 B apart)? | Yes | archive copy is what's shown today; diff not inspected |
| Q61 | Kept pages for v0.29 and v0.56 had their titles edited after publishing: leave as is? | Yes | reverting = another renumber |
| Q62 | Leo v0.9: kept copy wins over ref (98 B apart)? | Yes | diff not inspected |
| Q63 | Leo v0.11: kept copy wins (73 B)? | Yes | same |
| Q64 | Leo v0.12: kept copy wins (337 B)? | Yes | same |
| Q65 | Leo v0.13: kept copy wins (same size, bytes differ)? | Yes | same |
| Q66 | Leo v0.16: kept copy wins (133 B)? | Yes | same |
| Q67 | Leo v0.17 page says "v0.16": leave the page, note header says "page says v0.16"? | Yes | pages stay as published |
| Q68 | App Plan: keep on /admin/app-plan, out of the list? | Yes | not a note |
| Q69 | Harry's review of Mikey v0.7: key by `mikey-v0.7`? | Yes | site key "0.20" goes |
| Q70 | Mikey's casino-scandals page: add an "Other pages" list at the bottom of the archive? | Yes, one list for all plan pages | otherwise unreachable from the archive |
| Q71 | Mikey's international-plan page: in that list? | Yes | same |
| Q72 | Mikey's relationships plan: in that list? | Yes | same |
| Q73 | Leo skill's v0.1 ref: relabel as "Harry v0.1, seed copy"? | Yes | K57 |
| Q74 | Leo skill's `patch-notes-harry-v0.4.html`: delete or keep? | Keep, note it is Harry's | harmless history |

Q48–Q57 cover non-note links. Q58–Q59 cover v0.9 and v0.10. v0.51's link is Q39–Q40.

### Note titles (Q75–Q139)

One per note: the "Title Q" column in section 2. Recommended answer for each: yes, as written.

### Placeholder dates (8): proposed real date and source

| # | Note | Today | Proposed | Source | Rec |
|---|---|---|---|---|---|
| Q140 | Harry v0.1 | 21 Sep 00:00 | 21 Sep 16:39 UTC | C b360013 (entry added) | Yes |
| Q141 | Leo v0.2 | 22 Sep 00:00 | 21 Sep 17:50 UTC (v0.2 round) | C 473b444 (ref v0.2 saved) | Yes, after the split |
| Q142 | Harry v0.3 | 22 Sep 00:00 | 22 Sep 11:09 UTC | C 78e306b | Yes |
| Q143 | Harry v0.3.5 | 22 Sep 00:00 | 22 Sep 14:15 UTC | C 86d18fe | Yes |
| Q144 | Mikey v0.2 | 22 Sep 00:00 | 22 Sep 13:50 UTC | C 7566a88 | Yes |
| Q145 | Harry v0.7 | 23 Sep 00:00 | 23 Sep 14:54 UTC | C 06f172b | Yes |
| Q146 | Harry v0.8 | 23 Sep 00:00 | 23 Sep 16:07 UTC | C daf30d8 | Yes |
| Q147 | Harry v0.9 | 24 Sep 00:00 | 24 Sep 10:17 UTC | C 3f91940 | Yes |
| Q148 | New notes' dates: Leo v0.3 21 Sep 20:14 UTC (C 18442d4); Leo v0.4 22 Sep 01:55 UTC (C 85fbe7d); Mikey v0.1 21 Sep 21:45 UTC (C a406c46); Harry v0.14 26 Sep (V1, no time); Harry v0.26/v0.27 3 Oct (H, no time); Harry v1.1 12 Oct 18:00 (old entry)? | Yes | listed |
| Q149 | Dates later than the note reached main (Leo v0.5, v0.13; Mikey v0.5, v0.11, v0.13, v0.14, v0.15, v0.16; Harry v0.46–v0.48, v0.52): set the date to the first commit time? | Yes | a note can't publish after it went live |
| Q150 | Leo v0.5 shows on main 22 Sep 03:14 +01 but was "shipped" 23 Sep (C e8772d5): check by hand? | Yes | -S may have matched early text |
| Q151 | Harry v0.26/v0.27 live dates unknown: show date only? | Yes | never had an entry to trace |

### Splits: titles of the resulting notes

| # | Question | Rec |
|---|---|---|
| Q152 | Leo v0.2 → "Goalie Mode, rounds 1–2"? | Yes (same as Q108) |
| Q153 | Leo v0.3 → "Goalie Mode, round 3"? | Yes |
| Q154 | Leo v0.4 → "Goalie Mode, round 4"? | Yes |
| Q155 | Leo v0.2's combined text stays on v0.2; v0.3/v0.4 get a line and their page? | Yes |
| Q156 | Mikey v0.1 → "Economy, fame and reputation rebuild"? | Yes |
| Q157 | Mikey v0.2 → "Energy master plan"; combined text stays on v0.2? | Yes |

### Archive design choices

| # | Question | Rec | Evidence |
|---|---|---|---|
| Q158 | Default filter on open: All? | All | one view of everything |
| Q159 | Remember your last filter on this device? | Yes | per-viewer convenience |
| Q160 | Group rows by day ("Tue 14 Oct")? | Yes | 4 notes on 14 Oct |
| Q161 | Within a day, newest first by time? | Yes | |
| Q162 | Row shows: letter badge, "Harry v0.56", date, live chip, title, one line, "Full page" or "Text only"? | Yes | sketch |
| Q163 | Row title: the new short title (Q75–Q139), not "Harry's patch notes"? | Yes | 25 titles are just a name today |
| Q164 | One-line summary: hand-written `line` (≤ 90 chars) rather than the first sentence of the summary? | Hand-written | summaries run 300+ chars |
| Q165 | Date format on rows: "14 Oct"? Year only when not 2026? | Yes | |
| Q166 | Live chip text: "Live 14 Oct"? | Yes | V1 already says "now live (since 3 Oct)" |
| Q167 | On a preview build: amber "Not on main yet"? | Yes | |
| Q168 | Search covers: title, line, summary, item headlines, version, old site number? | Yes | |
| Q169 | Search: type-as-you-go, every word must match, any order, case and accents ignored? | Yes | |
| Q170 | "16", "v0.16", "leo 16" all find Leo v0.16? | Yes | |
| Q171 | Search respects the person filter? | Yes, with "Search all people" when empty | |
| Q172 | Empty search state: "No notes match 'x'" + Clear button? | Yes | |
| Q173 | Empty person filter (can't happen today): "No notes yet from Leo"? | Yes | |
| Q174 | Missing page: Text tab opens by default, grey "Full page not kept" chip, link to original if it works? | Yes | |
| Q175 | Roll-ups (V1, v1.1): grey "Roll-up" tag and listed under Harry? | Yes | |
| Q176 | Open note: Back keeps list scroll and filter? | Yes | |
| Q177 | Prev/next arrows move within the filter? | Yes | |
| Q178 | Note URL `?note=harry-v0.56`; old `?v=0.56` redirects? | Yes | |
| Q179 | Desktop: list left, note right? | Yes | today's rail |
| Q180 | Header counts ("65 notes · Harry 33 …") shown? | Yes | |
| Q181 | Keep Page / Text / "Harry's notes" tabs as today? | Yes | |
| Q182 | "Other pages" list (plans, App Plan) at the bottom? | Yes (Q70) | |
| Q183 | Show a sticky search + filter bar while scrolling? | Yes | 65 rows |

### Migration steps: what you see or approve first

| # | Question | Rec |
|---|---|---|
| Q184 | Step 0: OK to tell Leo's and Mikey's sessions before the cut-over? | Yes |
| Q185 | Step 1: no approval needed (type change)? | Yes |
| Q186 | Step 2: see the object-for-object diff result (58 = 58) before going on? | Yes, one line |
| Q187 | Step 3: approve the full author/version table (section 2) first? | Yes, this plan |
| Q188 | Step 4: approve split titles (Q152–Q157) first? | Yes |
| Q189 | Step 5: no approval needed? | Yes |
| Q190 | Step 6: test old links (`?v=0.53`, `?v=1.1`) and send the result? | Yes |
| Q191 | Step 7: approve date fixes (Q140–Q151) first? | Yes |
| Q192 | Step 8: see all 65 `line`s as one list before they go in? | Yes |
| Q193 | Step 9: no approval needed? | Yes |
| Q194 | Step 10: design stills first (list, filter, search, empty, missing page, note open) at 390 px? | Yes |
| Q195 | Step 11: see the new skill text before it lands? | Yes |
| Q196 | Step 12: a still of each pulled page as it lands? | Yes |
| Q197 | Leo and Mikey: who asks them to agree to Q3 and the rule? | Harry, one message each |

---

## 10. Not checked

- Whether each claude.ai link still opens. Only L40 was read.
- The content of the small reference-vs-kept page differences (K5, K21, K24–K26, K30). Only the sizes were compared.
- Live dates are the first `main` commit that carries the link. They were not checked by hand.
- Harry v0.26/v0.27: when the work went live.
- Whether L38 now shows v0.14 (reasoned, not read).
- Any note published on claude.ai but never written into the repo.
