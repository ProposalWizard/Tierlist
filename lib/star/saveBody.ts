/**
 * A SAVE SENT SQUEEZED (Mikey, 10 Nov 2026).
 *
 * The career save is 180-550 KB of text and goes to the server about once a
 * minute. Sent as gzip it is about a quarter of that (measured: 332 KB to
 * 88 KB on a real two-match career), which cuts the data
 * Vercel counts between its network and our server (6.6 of the free 10 GB
 * were used, mostly by saves). The browser squeezes it (gzipText); the
 * career route unsqueezes it (lib/star/saveBodyServer.ts). A save sent the
 * old plain way is still read, so an old tab keeps working.
 */

/** The header that says a save's body is gzip. */
export const SAVE_BODY_HEADER = "x-kib-body";

/** Text squeezed with gzip, or null where it cannot be (then it is sent plain). */
export async function gzipText(text: string): Promise<ArrayBuffer | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
  } catch { return null; }
}
