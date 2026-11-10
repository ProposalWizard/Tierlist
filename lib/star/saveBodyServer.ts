import { gunzipSync } from "node:zlib";
import { SAVE_BODY_HEADER } from "./saveBody";

/** A real save is under 1 MB; anything that unsqueezes past this is refused. */
export const SAVE_BODY_MAX = 8 * 1024 * 1024;

/**
 * The save a request carries: squeezed (lib/star/saveBody.ts) or plain.
 * Throws on anything that is not JSON, or that unsqueezes past SAVE_BODY_MAX.
 */
export async function readSaveBody(req: Request): Promise<unknown> {
  if (req.headers.get(SAVE_BODY_HEADER) !== "gzip") return req.json();
  const raw = Buffer.from(await req.arrayBuffer());
  return JSON.parse(gunzipSync(raw, { maxOutputLength: SAVE_BODY_MAX }).toString("utf8"));
}
