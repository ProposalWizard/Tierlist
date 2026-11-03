---
id: FACT-DAT-007
type: fact
client: data
tags: []
status: live
date: 2026-10-27
source: "lib/cookieConsent.ts:1-12"
summary: Analytics (Google Analytics and PostHog) load only after Accept in the cookie box; No thanks loads neither, and /legal#cookies lets a player choose again.
---
Mikey, 27 Oct 2026, before the Road to Ballon d'Or release (UK PECR). Until then GA loaded on every page for everyone, and PostHog never ran: NEXT_PUBLIC_POSTHOG_KEY was not set on Vercel (0 events in 30 days). Set the key on Vercel only once the cookie box is on main, or the next deploy tracks without consent. Checked in a phone-size browser: 0 tracking requests before a choice or after No thanks; Google and PostHog load after Accept.
