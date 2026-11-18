/**
 * YOUR LOOK FOR EVERY 3D PERSON (app/star-dev/page.tsx's setToonYou effect):
 * the Home and title player, your headshot and you in the farewell are all
 * built from lib/star/style3d/toon/bodies.ts toonYou(), which follows the
 * career: head and build (Settings → Your look), skin tone, hair colour and
 * the name on your shirt. Mounted once at the top of the app.
 */
import { useEffect } from "react";
import { setToonYou, yourToonBody, yourToonHead } from "@/lib/star/style3d/toon/bodies";
import { skinToneHex, hairColourHex } from "@/lib/star/playerIdentity";
import { useCareer } from "../game/store";

export function ToonYouSync() {
  const career = useCareer();
  const head = career ? yourToonHead(career.player) : undefined, body = career ? yourToonBody(career.player) : undefined;
  const skin = career?.player.skinTone, hair = career?.player.hairColour;
  const name = career?.player.nickname ?? career?.player.lastName;
  useEffect(() => {
    setToonYou({ body, head, skin: skinToneHex(skin), hair: hairColourHex(hair), name });
  }, [body, head, skin, hair, name]);
  return null;
}
