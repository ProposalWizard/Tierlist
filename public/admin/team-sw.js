/*
 * KIB Admin — the Team room's phone notifications (Harry, 20 Oct 2026).
 *
 * Registered by lib/teamRoom/push.ts with scope /admin/ only, so it never
 * touches the game or the public site. It has no fetch handler: it never
 * sees, stores or serves a page. It only shows a buzz the site sends
 * (lib/teamRoom/notify.ts says what) and opens the Team room on a tap.
 *
 * Buzzes with the same tag (one chat thread, or the To-do) replace each
 * other and count up ("+2 more"), so a busy chat is one line, not a pile.
 */
const ICON = "/admin/app-icon-192.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Knowitball team";
  const tag = d.tag || "kib-team";
  e.waitUntil((async () => {
    let count = 1;
    try {
      const old = await self.registration.getNotifications({ tag });
      for (const n of old) count += (n.data && n.data.count) || 1;
    } catch (_) { /* older browsers: no count */ }
    await self.registration.showNotification(count > 1 ? `${title} (+${count - 1} more)` : title, {
      body: d.body || "",
      tag,
      renotify: true,
      icon: d.icon || ICON,
      badge: ICON,
      data: { url: d.url || "/admin/team", count },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin/team", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // An admin page already open: bring it forward on the right tab.
    for (const w of wins) {
      if (!new URL(w.url).pathname.startsWith("/admin")) continue;
      try {
        await w.focus();
        await w.navigate(url);
        return;
      } catch (_) { /* not ours to move: open a new one below */ }
    }
    await self.clients.openWindow(url);
  })());
});
