---
id: FACT-UI-017
type: fact
client: ui
tags: [team, ui]
status: live
date: 2026-10-27
source: "lib/star/mikeyPopups.ts:1-12"
summary: Mikey's Broadcast pop-ups (scoreboard for a goal, TV caption for the rest) are the only match pop-ups; no setting, the Classic and Arcade words are gone.
---
Mikey, 27 Oct 2026: "There is no toggle, there's no setting for it … that is the new base version of the pop-ups." The Settings row "Pop-up pack: Classic | Broadcast" (lib/star/popupPack.ts, components/star/PopupPackRow.tsx) was removed; an old phone's stored value is ignored. The old code is in git before this change (3ad8fad6). Test: tests/star/gameVersions.mts.
