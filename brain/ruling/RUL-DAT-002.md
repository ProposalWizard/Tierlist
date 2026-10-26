---
id: RUL-DAT-002
type: ruling
client: dat
tags: [process, data]
status: live
date: 2026-10-23
source: "docs/handoffs/2026-10-23-supabase-connected.md:11"
summary: Every Supabase request Claude makes starts with a plain-English header in the SQL (READ ONLY or CHANGES THE DATABASE, What, Why) and the same lines in chat before the Allow box; changes wait for a yes.
---
Harry, 23 Oct 2026: "I need to know exactly what it does and why in those allow boxes." The Allow box shows only the raw request, so the SQL itself opens with `-- READ ONLY.` or `-- CHANGES THE DATABASE.`, then `What:` and `Why:` in plain words. Calls with no SQL (advisors, list tables) get the same three lines in chat just before. A change (apply_migration, insert, update, delete) also goes out first as an RUL-DAT-001 page and waits for Harry's yes.
