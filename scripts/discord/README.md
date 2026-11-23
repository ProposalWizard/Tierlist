# Building the Knowitball Discord

The whole server (roles, channels, who can write where, welcome posts, the
"pick your games" questions) is `blueprint.json`. `setup-server.mjs` makes it.
Plan and growth playbook: `docs/DISCORD.md`.

## Once, by Leo (5 minutes)
1. Discord → **+** → Create My Own → "Knowitball". (Bots can't make servers.)
2. https://discord.com/developers/applications → New Application "Knowitball"
   → Bot → Reset Token (copy it; never paste it into a chat).
3. OAuth2 → URL Generator → scopes `bot`, permission `Administrator` → open
   the link → add it to the server.
4. Discord Settings → Advanced → Developer Mode on → right-click the server
   → Copy Server ID.

## Then (a chat does this)
```
node scripts/discord/setup-server.mjs --guild <id>                                  # look only
node scripts/discord/setup-server.mjs --guild <id> --apply --community --onboarding # build it
```
The token: `DISCORD_BOT_TOKEN=...` in the shell, or in a cloud chat the
network secret for `discord.com` (header Authorization, prefix `Bot`).
Running it again only adds what is missing.

It prints the **#updates webhook** once: put it in Vercel as
`DISCORD_UPDATES_WEBHOOK`. From then on, every patch note with a `discord`
line posts itself to #updates (lib/discord.ts, via the Patch bot).

Last: make a permanent invite (#welcome → Invite → Never expire, no limit) and
set it as `NEXT_PUBLIC_DISCORD_INVITE` in Vercel (or `DEFAULT_INVITE` in
lib/discord.ts). The "Join our Discord" buttons appear on the next deploy.

Tested against a fake Discord only (scripts call order, permissions, one
webhook, five welcome posts). Not yet run against the real API.
