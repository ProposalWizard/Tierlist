---
id: RUL-KIB-008
type: ruling
client: kib
tags: [rule, client-kib]
status: live
date: 2026-11-09
source: "tools/video-render/twin/make_episode.py:246"
summary: Stat Twins comparison cards keep the "player v his twin" framing and show the MOST IMPORTANT stats for the twin pick; never swap them for a generic "what matters for a striker" card.
---
In Stat Twins videos, a comparison card (why / this season) stays a direct "Kane v Mbappé: this is why he is
his twin" comparison. Mikey's change was only which stats it shows: the most important ones behind the pick
(e.g. goals, xG, shots), not just the two closest. Do not reframe or replace the card with a generic
position line ("on what matters most for a striker"). Mikey accepted v06 as it is; fix this in the next
episode (make_episode.py, the 'nowcmp' and 'why' lines).
