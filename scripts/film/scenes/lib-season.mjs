// Shared helpers for the scene drivers in this folder.
// Hides the team-room chat bubble (admin/team only, never seen by players).
export async function hideChrome(page, extra = "") {
  await page.addStyleTag({ content: `.tr-float{display:none!important}${extra}` });
}
