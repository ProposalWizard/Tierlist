# Mikey's Brain (17 Nov 2026)

Mikey's private page for his social accounts: https://claude.ai/artifact/H4TN92qzcgodheJNJxs7TJ
(artifact slug 820db292-3551-4516-bc24-059fed67896d). Asked for as "my brain, where everything is organized ...
I could instruct you to post this video across all platforms on the right account". Plain and easy to read, on purpose.

Six parts: the loop (ideas, make, check, you say yes, post, learn), videos waiting for his OK, his 8 accounts
(football + content on Instagram, TikTok, YouTube, Facebook), how the posts are doing, the posting rules, what he must do
to switch everything on.

## How it works (v2, 18 Nov 2026: a step-by-step chain, Mikey: "I check each thing off ... from the beginning to the end")
- Tabs: Post a video (the chain), My 8 accounts, How posts are doing, What to do next, The rules.
- The chain, per video: 1 Watch it, 2 Title (YouTube, Facebook), 3 Caption (per app), 4 Hashtags (per app), 5 Where it
  goes (only accounts that can be posted to are switchable), 6 When, 7 Send to Claude (only after 1-6 are ticked),
  8 Live (green per account, written by Claude).
- Suggested words are in the page's `DATA.videos` (`title`, `cap`, `tags`, keyed ig/fb/yt/tt). Mikey's edits and ticks
  are saved to the page database, `drafts/<video id>`; on Send it stores `final` = the exact title/caption/tags per app,
  `to` = account ids, `when`. Read with db_list collection `drafts`.
- When he says "post my videos": for every draft with `sent` and no live record, post `final` to each account in `to`
  (ig-foot = Windsor instagram 17841450228516885, ig-cont = 17841459367040657; caption + two newlines + tags), check it
  is live with get_data BEFORE any retry, then write `live/<video id>` = {<account id>: {stage: "live", link}} with
  db_write. Facebook and YouTube go through the site's Publish tool (scripts/publish/post.mjs, needs the
  PUBLISH_AGENT_TOKEN network secret for knowitball.co.uk, header x-publish-agent).
- Posting routes today: Instagram both accounts (Windsor, from the chat). Facebook + YouTube: the site's Publish tool
  (Admin -> Marketing -> Publish, built 11 Nov, FACT-KIB-013) once it is set up; YouTube posts stay private until
  Google's API audit. TikTok: no route yet.
