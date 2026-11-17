# Mikey's Brain (17 Nov 2026)

Mikey's private page for his social accounts: https://claude.ai/artifact/H4TN92qzcgodheJNJxs7TJ
(artifact slug 820db292-3551-4516-bc24-059fed67896d). Asked for as "my brain, where everything is organized ...
I could instruct you to post this video across all platforms on the right account". Plain and easy to read, on purpose.

Six parts: the loop (ideas, make, check, you say yes, post, learn), videos waiting for his OK, his 8 accounts
(football + content on Instagram, TikTok, YouTube, Facebook), how the posts are doing, the posting rules, what he must do
to switch everything on.

## How it works
- The content is the `DATA` block at the top of the page's script. Update it (new videos waiting, new numbers from
  Windsor `get_data`, accounts linked) and republish `index.html` + `img/` with publish_files.
- His buttons ("Post it", "Not now", "Change something") are saved in the page's database: `decisions/<video id>` =
  `{status: approved|later|changes, note, at}`. Read them with db_list (collection `decisions`).
- When he says "post my approved videos": read `decisions`, post each approved one with Windsor
  `execute_action` create_video_post on the right account (knowitballjr = 17841450228516885, cutcutthings =
  17841459367040657), check it is live with get_data BEFORE any retry (the action often times out but succeeds),
  then move it from `queue` to the results in DATA, delete its decision, mark the board card posted.
- Posting today: Instagram only. TikTok (BallKnowledgeFC) and one YouTube channel are linked to Windsor for numbers only;
  Facebook not linked. Posting everywhere needs a posting service (Metricool or Upload-Post) connected.
