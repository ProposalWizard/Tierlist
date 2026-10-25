---
id: RUL-DAT-001
type: ruling
client: dat
tags: [rule, data]
status: live
date: 2026-10-23
source: "scripts/supabase/sql-page.py:3-6"
summary: SQL for a person to run goes out as an artifact page (each file's name, one line on what it does, a Copy all button and the full text), never as links; build it with scripts/supabase/sql-page.py.
---
Every time someone needs to run SQL in Supabase, publish one page with every file to run, in order. Each card: the file name, what it switches on, a Copy all button and the whole file. Make it with `python3 scripts/supabase/sql-page.py OUT.html "Title" <file> "what it does" ...` (a file can be `git:<ref>:<path>`). Never only a GitHub link. Check the live tables afterwards and say which now exist.
