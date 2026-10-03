/**
 * "ARE YOU SURE?" WITHOUT THE BROWSER'S OWN BOX.
 *
 * A native confirm() throws the player out of full screen on Android and
 * desktop (v0.25 live test, 2 Oct 2026; Mikey said the same on 28 Sep). This
 * asks the same question on the game's own screen instead.
 *
 *   if (await askConfirm("Delete this career?", "Delete")) …
 *
 * components/star/ConfirmHost.tsx, mounted once in app/star-dev/layout.tsx,
 * draws whatever is being asked. With no host on the page it falls back to
 * confirm(), so a screen outside /star-dev still gets asked.
 */
export interface ConfirmAsk {
  text: string;
  yes: string;
  resolve: (ok: boolean) => void;
}

type Listener = (ask: ConfirmAsk | null) => void;
let listener: Listener | null = null;

export function setConfirmListener(l: Listener | null) { listener = l; }

export function askConfirm(text: string, yes = "Yes"): Promise<boolean> {
  if (!listener) return Promise.resolve(typeof window !== "undefined" && window.confirm(text));
  const l = listener;
  return new Promise<boolean>(resolve => {
    l({ text, yes, resolve: (ok) => { l(null); resolve(ok); } });
  });
}
