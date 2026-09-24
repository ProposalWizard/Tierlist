# The one-engine canary

Every file here hides a copy of the match loop behind a different trick, ON
PURPOSE. `scripts/one-engine-guard.mjs` must flag every one of them; if it
ever stops seeing one, the build fails with "GUARD IS BLIND". Nothing imports
these files, so none of them ever reaches the site.

Two files are the opposite: `harmlessLaunch.ts` and `typeOnly.ts` look like
copies but are not, and the guard must NOT flag them. A false alarm would
block every deploy, so a guard that starts flagging them fails too.

Do not "fix" these files. They are wrong so that the guard can prove it still
sees wrong code.
