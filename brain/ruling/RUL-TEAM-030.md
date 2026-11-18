---
id: RUL-TEAM-030
type: ruling
client: team
tags: [team, process, rule]
status: live
date: 2026-11-13
source: "lib/teamRoom/atBotsServer.ts:14-18"
summary: A Team room bot never changes anything. A person's bot turns a bigger ask into a card only its owner can Accept; Accept adds one job to the owner's own to-do for their own Claude chat.
---
Harry, 13 Nov 2026: "if needed it can use my actual Claude. But it should maybe propose it rather than just do it. Obviously bots ask for permission before they change anything." A bigger ask = anything that needs a change to the game, files or database (a plain word rule, wantsChange in lib/teamRoom/claudeBot.ts), or the AI answering HANDOFF. The bot posts "This needs <Owner>'s Claude. Send it?" in the thread. Only the owner can press Accept or Decline (the site checks who is signed in). Accept: exactly one row in the owner's to-do ("🤖 For my Claude: …", made in the owner's name by the owner's own press) and the text for their Claude chat kept on the card (who asked what, the thread, its link, "wait for my yes before changing anything"). A website cannot reach into anyone's Claude account: the job waits until the owner's own chat takes it, by Copy for my Claude, or by the chat hook scripts/hooks/bot-jobs-hook.mjs (the pipe recordings already use; written, not switched on until a person adds it to .claude/settings.json). The chat's reply comes back once through scripts/team-room/bot-job-done.mjs and shows in the thread as "<Owner>'s Claude". A person's bot is labelled "<Name> bot", never speaks as the person, and never accepts a task or approves anything for them. Its settings (on/off, How I should answer, channels, hand on: ask or never) are its owner's alone. Build-your-own bots: not built.
