/**
 * A STAR PASS REWARD YOU CAN SPIN, ON THE PHONE (the website's components/star/Podium3D.tsx, run by ./podiumScene.ts on
 * the phone's GL view through ../three/Walk3D.tsx).
 *
 * The reward and its podium as live 3D on a see-through picture, `cfg.w` x `cfg.h` points: drag sideways to turn it, a
 * flick keeps it turning, a tap zooms in on the sunglasses (the cards that have a zoom). It opens when the preview opens
 * and is let go when it closes (one GL view at a time). If the 3D cannot start (the crash guard has it off, the GL is
 * refused, it takes over 20 s) it says `onFail`, shows nothing, and the screen keeps the still picture it had before.
 */
import { View } from "react-native";
import type { Live3D } from "@/lib/star/starPassRewards";
import { Walk3D } from "../three/Walk3D";
import { loadPodiumStart, type PodiumCallbacks, type PodiumController, type PodiumData } from "./podiumScene";

const NOTHING = () => ({} as PodiumCallbacks);
const NO_BACK = () => { /* the screen's own button closes */ };
const LOAD_LIMIT_MS = 20000;

export function Podium3D({ cfg, onFail, onReady, onController, showSpeed = false, dim = false }: {
  cfg: Live3D;
  onFail?: () => void;
  onReady?: () => void;
  onController?: (c: PodiumController | null) => void;
  showSpeed?: boolean;
  dim?: boolean;
}) {
  return (
    <View style={{ width: cfg.w, height: cfg.h, opacity: dim ? 0.85 : 1 }}>
      <Walk3D<PodiumData, PodiumCallbacks, PodiumController>
        name="The reward" cover="transparent" hideStick load={loadPodiumStart} data={cfg} callbacks={NOTHING}
        onBack={NO_BACK} onFail={() => onFail?.()} loadLimitMs={LOAD_LIMIT_MS} showSpeed={showSpeed}
        onController={onController} onReady={onReady} />
    </View>
  );
}
