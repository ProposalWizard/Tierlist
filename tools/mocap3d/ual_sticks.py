"""Stick sheet of a UAL clip on its OWN skeleton (the source), side + front, to set beside make.sheet's solved body.

    python3 tools/mocap3d/ual_sticks.py out.png Walk_Loop Idle_Loop ...
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
import ual

B = [("pelvis", "spine_01"), ("spine_01", "spine_02"), ("spine_02", "spine_03"), ("spine_03", "neck_01"), ("neck_01", "Head"),
     ("spine_03", "clavicle_l"), ("clavicle_l", "upperarm_l"), ("upperarm_l", "lowerarm_l"), ("lowerarm_l", "hand_l"),
     ("spine_03", "clavicle_r"), ("clavicle_r", "upperarm_r"), ("upperarm_r", "lowerarm_r"), ("lowerarm_r", "hand_r"),
     ("pelvis", "thigh_l"), ("thigh_l", "calf_l"), ("calf_l", "foot_l"), ("foot_l", "ball_l"),
     ("pelvis", "thigh_r"), ("thigh_r", "calf_r"), ("calf_r", "foot_r"), ("foot_r", "ball_r")]


def main(out, clips, cols=10):
    d = ual.dump()
    cw, ch = 120, 170
    img = Image.new("RGB", (cols * cw, len(clips) * 2 * ch), "white")
    dr = ImageDraw.Draw(img)
    for r, c in enumerate(clips):
        fr = d["clips"][c]
        n = len(fr)
        for ci in range(cols):
            f = int(round(ci * (n - 1) / (cols - 1)))
            P = {k: np.array(v[0]) for k, v in fr[f].items()}
            for view in (0, 1):
                ox, oy = ci * cw, (r * 2 + view) * ch
                dr.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], outline="#ddd")
                dr.text((ox + 3, oy + 2), f"SRC {c[:12]} {f / 30:.2f}", fill="black")
                pt = (lambda p: (ox + cw / 2 + p[2] * 70, oy + ch - 12 - p[1] * 70)) if view == 0 else \
                     (lambda p: (ox + cw / 2 - p[0] * 70, oy + ch - 12 - p[1] * 70))
                dr.line([ox, oy + ch - 12, ox + cw, oy + ch - 12], fill="#8c8")
                for a, b in B:
                    col = "red" if a.endswith("_r") or b.endswith("_r") else ("blue" if a.endswith("_l") or b.endswith("_l") else "black")
                    dr.line([pt(P[a]), pt(P[b])], fill=col, width=3)
                hx, hy = pt(P["Head"] + np.array([0, 0.08, 0]))
                dr.ellipse([hx - 7, hy - 7, hx + 7, hy + 7], outline="black", width=2)
    img.save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
