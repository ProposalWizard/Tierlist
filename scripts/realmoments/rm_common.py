"""Shared helpers for the real-moment builders (scripts/realmoments/*.py).

Every file they write is in OUR pitch (lib/star/pitch.ts), in metres:
  x  0..68   across, from the attacker's LEFT touchline (0) to his right (68)
  y  0..105  from the goal being attacked (0) back up the pitch
The goal mouth is x 30.34..37.66 at y = 0, the box 16.5 deep, the spot at 11.
"""
import json, math, os, re

PITCH_W = 68.0
HALF_LEN = 52.5
CX = PITCH_W / 2
GOAL_W = 7.32
POST_L, POST_R = CX - GOAL_W / 2, CX + GOAL_W / 2
BOX_DEPTH = 16.5
BOX_HALF = GOAL_W / 2 + 16.5          # 20.16
SIX_HALF = GOAL_W / 2 + 5.5           # 9.16

# The credit lines, as data/opendata/LICENCES.md ("Real moments") gives them.
CREDIT = {
    "wyscout": "Real shots and goals from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.",
    "dfl": "Real player positions from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.",
    "skillcorner": "Real player positions from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).",
    "soccertrack": "Real player positions from SoccerTrack v2 (Scott et al., arXiv 2025), CC BY 4.0. Changes made.",
}


def r1(v):
    return round(v, 1)


def piece(a, edges):
    """Piecewise-linear map: edges = [(from, to), ...] sorted by `from`."""
    for (a0, b0), (a1, b1) in zip(edges, edges[1:]):
        if a <= a1:
            return b0 + (a - a0) * (b1 - b0) / (a1 - a0)
    (a0, b0), (a1, b1) = edges[-2], edges[-1]
    return b0 + (a - a0) * (b1 - b0) / (a1 - a0)


# Wyscout's 0..100 frame has its markings at fixed numbers (box x 84 / y 19..81,
# six-yard box x 94 / y 37..63, goal y 45..55, spot x 90). A plain stretch puts
# the goal 6.8 m wide; this lands every marking on ours.
WY_DEPTH = [(0, 0), (6, 5.5), (10, 11), (16, BOX_DEPTH), (50, HALF_LEN), (100, 2 * HALF_LEN)]
WY_ACROSS = [(0, 0), (5, GOAL_W / 2), (13, SIX_HALF), (31, BOX_HALF), (50, CX)]


def wy_to_pitch(x, y):
    """Wyscout point (x towards the attacked goal, y from the attacker's left) -> our metres."""
    depth = piece(100 - x, WY_DEPTH)
    off = y - 50
    m = piece(abs(off), WY_ACROSS)
    return [r1(CX + math.copysign(m, off)), r1(depth)]


def metres_to_pitch(X, Y, length):
    """Tracking metres (centre origin, the team attacking +X, +Y on its left) -> our metres."""
    return [r1(CX - Y), r1(length / 2 - X)]


_U = re.compile(r"\\u([0-9a-fA-F]{4})")


def unesc(s):
    """Wyscout stores names with literal \\uXXXX escapes."""
    return _U.sub(lambda m: chr(int(m.group(1), 16)), s or "")


def goal_angle(x, y):
    """Angle (radians) the goal mouth fills from our-metres point (x, y)."""
    a = math.atan2(POST_L - x, max(0.01, y)); b = math.atan2(POST_R - x, max(0.01, y))
    return abs(b - a)


def xg_features(x, y, head, fk):
    d = math.hypot(x - CX, y)
    return [1.0, math.log(max(0.5, d)), goal_angle(x, y), 1.0 if head else 0.0, 1.0 if fk else 0.0]


def xg_of(w, f):
    z = sum(a * b for a, b in zip(w, f))
    return 1 / (1 + math.exp(-z))


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {path} {os.path.getsize(path) / 1024:.1f} KB", flush=True)
