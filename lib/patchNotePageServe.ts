/**
 * lib/patchNotePageServe.ts — the server half of lib/patchNotePages.ts.
 *
 * Reads a kept artifact page (or one of its images) out of the repo's
 * patch-notes/ folder, for the two admin-only routes under
 * app/api/admin/patch-notes/. Server-only: it touches the filesystem.
 *
 * Why the archive loads the page as TEXT into an iframe's `srcdoc` instead of
 * pointing an iframe at a URL: next.config.mjs sends `X-Frame-Options: DENY`
 * on every response, so the site cannot frame its own pages — deliberately,
 * and it stays that way. A srcdoc frame has no response to carry the header,
 * and it is same-origin, so the archive can size it to the page's height.
 */

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { PATCH_NOTE_FILE_BASE } from "@/lib/patchNotePages";

/** The patch-notes/ folder at the repo root. */
export const PATCH_NOTES_DIR = path.join(process.cwd(), "patch-notes");

/** A kept page can mention the security holes still open, so only admins. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden — patch notes need an admin sign-in." }, { status: 403 });
  }
  return null;
}

/** A path inside patch-notes/, or null for anything that would escape it. */
export function resolveInside(rel: string): string | null {
  if (!rel || rel.includes("\0")) return null;
  const abs = path.resolve(PATCH_NOTES_DIR, rel);
  if (abs !== PATCH_NOTES_DIR && !abs.startsWith(PATCH_NOTES_DIR + path.sep)) return null;
  return abs;
}

/** What the file route will serve — pictures, fonts and stylesheets only. */
export const SERVED_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".css": "text/css; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Things a page links to that are not a file next to it. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

/**
 * Point a page's relative links (img/foo.jpg, v0.3/bar.webp) at the file
 * route, from the folder the page itself sits in. Everything else is left
 * byte for byte.
 */
export function rewriteRelative(html: string, pageRel: string): string {
  const dir = path.posix.dirname(pageRel.split(path.sep).join("/"));
  const to = (u: string) => {
    if (ABSOLUTE.test(u)) return u;
    const joined = path.posix.normalize(path.posix.join(dir === "." ? "" : dir, u));
    return PATCH_NOTE_FILE_BASE + joined.split("/").map(encodeURIComponent).join("/");
  };
  return html
    .replace(/\b(src|href|poster)=(["'])([^"']*)\2/gi, (m, attr, q, u) =>
      attr.toLowerCase() === "href" && !/\.(?:css|png|jpe?g|webp|gif|svg|woff2?)(?:[?#]|$)/i.test(u)
        ? m
        : `${attr}=${q}${to(u)}${q}`)
    .replace(/url\((["']?)([^)"']+)\1\)/gi, (_m, q, u) => `url(${q}${to(u)}${q})`);
}

/** The same skeleton the artifact host wraps a page fragment in. */
const SKELETON_HEAD =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  "<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;" +
  "font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fafaf9}" +
  "img{max-width:100%}[hidden]{display:none!important}</style></head><body>";

/**
 * Inside the frame: a link to another site opens a new tab (not inside the
 * frame), and a "#section" link scrolls the ARCHIVE to it — the frame is
 * sized to the whole page, so it has no scroll of its own to move.
 */
const FRAME_SCRIPT = `<script>(function(){
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a[href]'):null; if(!a) return;
  var h=a.getAttribute('href')||'';
  if(h.charAt(0)==='#'){var el=h.length>1?document.getElementById(decodeURIComponent(h.slice(1))):null;
    e.preventDefault(); if(!el) return;
    try{var f=window.frameElement.getBoundingClientRect();parent.scrollBy({top:f.top+el.getBoundingClientRect().top-72,behavior:'smooth'});}catch(_){el.scrollIntoView();}
    return;}
  if(/^https?:/i.test(h)){a.target='_blank';a.rel='noopener noreferrer';}
},true);})();</script>`;

/** A kept page, ready to drop into an iframe's srcdoc. */
export function preparePage(raw: string, pageRel: string): string {
  let html = rewriteRelative(raw, pageRel);
  if (!/^\s*(?:<!doctype|<html)/i.test(html)) html = SKELETON_HEAD + html + "</body></html>";
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, FRAME_SCRIPT + "</body>") : html + FRAME_SCRIPT;
}

export async function readInside(rel: string): Promise<Buffer | null> {
  const abs = resolveInside(rel);
  if (!abs) return null;
  try { return await fs.readFile(abs); } catch { return null; }
}
