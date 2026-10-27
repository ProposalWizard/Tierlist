/**
 * SIGNATURE BOOTS (Star Pass reward, piece 4): white boots with a gold
 * stripe, and YOUR name or squad number on the side.
 *
 * The accessory is "boots-signature" in lib/star/store/catalogue.ts. What is
 * written on it comes from here: the surname (what a kit man prints on a
 * boot), upper case, else the squad number, else a placeholder for screens
 * that have no career (the store test area, the admin Star Pass page).
 *
 * Pure. AccessoryFigure draws it; a 3D figure wears the colours.
 */
export const SIGNATURE_BOOTS_ID = "boots-signature";

export interface SignatureWho {
  /** The name to print: usually his surname. */
  name?: string | null;
  number?: number | null;
}

/** Longest name that still fits along a boot's side. */
export const SIGNATURE_MAX_CHARS = 10;

/** A career's player as a signature: surname (or nickname) and squad number. */
export function signatureOf(c: { player?: { lastName?: string; nickname?: string }; squadNumber?: number } | null | undefined): SignatureWho {
  const nick = c?.player?.nickname?.trim();
  return { name: nick || c?.player?.lastName || null, number: c?.squadNumber ?? null };
}

/** What is written on the boot: { name, number } cleaned up; name falls back to the number, then "STAR". */
export function signatureText(who: SignatureWho | null | undefined): { name: string; number: string | null } {
  const n = typeof who?.number === "number" && Number.isFinite(who.number) && who.number > 0 ? String(Math.round(who.number)) : null;
  const raw = (who?.name ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  let name = raw;
  if (name.length > SIGNATURE_MAX_CHARS) {
    // A long name: the last word (his surname), then cut to fit.
    const last = name.split(/[ -]/).pop() ?? name;
    name = last.length <= SIGNATURE_MAX_CHARS ? last : last.slice(0, SIGNATURE_MAX_CHARS);
  }
  if (!name) name = n ?? "STAR";
  return { name, number: n };
}
