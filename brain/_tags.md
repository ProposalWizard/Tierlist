# Fixed tag list
Format: `tag | meaning | keywords (any match in the summary auto-applies the tag)`.
Add a tag here first. The build script rejects tags not listed. Keep it to 10-20 tags.
Knowitball tags (21 Oct 2026). A keyword matches the start of a word in the note's summary.

engine | the 2D match engine and the one-engine rule | engine, canvasengine, engineplay, known_copies
three-d | 3D models, clips, bodies, Higgsfield | 3d, glb, gltfloader, higgsfield, blender, body part
ui | screens, looks and Settings rows | toggle, old ui, settings, test page, look
career | the Star Career game itself | career, season, transfer, fixture
economy | money, shop, casino, gems | money, shop, casino, gem, wallet
media | media feed, goal videos, commentary | media feed, goal video, commentary
data | database, migrations, real player and club data | migration, .sql, table, sofifa, club data
admin | admin and dev pages | admin, dev page, /star-
team | how Harry, Mikey and Leo work together | mikey, leo, branch, jobs.json, team
process | how a round of work runs | patch note, progress, handoff, chat, playtest, stills, clip, film
rule | a hard rule or limit | never, must, only when
deploy | pushing and merging to live | push, deploy, merge, to main, into main
style | how replies and pages are written | answer, sentence, claim, reply, write
brain | the Brain notes system itself | brain

## Defaults (applied by type:client, on top of keyword tags)
default | ruling:all | rule
default | fact:all | brain
default | reference:all | brain
default | ruling:team | team
default | process:team | process
default | ruling:ui | ui
default | fact:ui | ui
default | fact:dat | data
default | ruling:eng | engine
default | process:eng | engine
default | ruling:3d | three-d
default | fact:3d | three-d
default | ruling:car | career
default | fact:car | career
default | ruling:adm | admin
default | fact:adm | admin
default | ruling:med | media
default | fact:med | media
default | ruling:eco | economy
default | fact:eco | economy
default | process:all | process
default | decision:all | rule
default | process:3d | three-d
default | process:dat | data
default | fact:eng | engine
default | fact:team | team
