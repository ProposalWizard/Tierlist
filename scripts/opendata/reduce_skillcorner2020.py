"""Reduce SkillCorner's FIRST open-data release (9 matches of 2019/20, champions
v runners-up in the Premier League, LaLiga, Serie A, Bundesliga and Ligue 1;
MIT licence, Copyright (c) 2020 SkillCorner) to
data/opendata/skillcorner2020_tracking.json.

SkillCorner replaced this release with the A-League matches in October 2025
(reduce_skillcorner.py). The 2020 files are still in the repository's history
under the same MIT licence: commit 1b99d401ddc82e366c5c20d6860878668fd5858f,
data/matches/{id}/structured_data.json + match_data.json.

Broadcast tracking: only the players the TV camera shows are in a frame (about
14 of 22). So a team's SHAPE is measured only in frames where at least 9 of
its 10 outfielders are on camera; pressure on the ball (the nearest defender,
who is nearly always on camera) uses every frame. No running speeds (players
drop in and out of the picture).

Usage: python3 -I scripts/opendata/reduce_skillcorner2020.py DIR [REPO_ROOT]
  DIR: {id}.json (structured_data.json) and {id}_match.json (match_data.json) per match.
"""
import collections, glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GRID_DOC, write  # noqa: E402
from tracking_common import TrackAcc  # noqa: E402

DIR = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")
SAMPLE = 2  # 10 Hz -> 5 Hz
MIN_SEEN = 9

CREDIT = ("Data: SkillCorner Open Data, first release (https://github.com/SkillCorner/opendata, commit 1b99d40), "
          "Copyright (c) 2020 SkillCorner, MIT licence. Broadcast tracking of 9 matches of 2019/20 (Premier League, "
          "LaLiga, Serie A, Bundesliga, Ligue 1). Reduced to aggregate patterns by Knowitball.")

ROLE = {"GK": "GK", "LCB": "CB", "RCB": "CB", "CB": "CB", "LB": "LB", "LWB": "LB", "RB": "RB", "RWB": "RB",
        "DM": "DM", "LDM": "DM", "RDM": "DM", "CM": "CM", "LCM": "CM", "RCM": "CM", "LM": "LW", "RM": "RW",
        "AM": "AM", "CAM": "AM", "LW": "LW", "LF": "LW", "RW": "RW", "RF": "RW", "CF": "ST", "ST": "ST"}


class ShapeOnlyWhenSeen(TrackAcc):
    """TrackAcc, but a team's shape (and back line and role spots) counts only when MIN_SEEN outfielders are on camera."""
    def frame(self, players, ball, poss, flip_of, in_play=True):
        seen = collections.Counter(t for t, r, _, _ in players if r != "GK")
        keep = [p for p in players if seen[p[0]] >= MIN_SEEN]
        super().frame(keep, ball, poss, flip_of, in_play)


def match(mid, acc, press):
    m = json.load(open(os.path.join(DIR, f"{mid}_match.json"), encoding="utf-8"))
    home, away = m["home_team"]["id"], m["away_team"]["id"]
    ball_id = (m.get("ball") or {}).get("trackable_object", 55)
    team_of, role_of = {}, {}
    for p in m["players"]:
        team_of[p["trackable_object"]] = p["team_id"]
        role_of[p["trackable_object"]] = ROLE.get((p.get("player_role") or {}).get("acronym"), "?")
    frames = json.load(open(os.path.join(DIR, f"{mid}.json"), encoding="utf-8"))
    # Which way each team attacks, per period: its keeper's average x.
    gx = collections.defaultdict(list)
    for fr in frames[::50]:
        per = fr.get("period")
        for o in fr.get("data") or []:
            to = o.get("trackable_object")
            if to in role_of and role_of[to] == "GK":
                gx[(per, team_of[to])].append(o["x"])
            elif o.get("group_name") in ("home goalkeeper", "away goalkeeper"):
                gx[(per, home if o["group_name"].startswith("home") else away)].append(o["x"])
    n = 0
    for fr in frames[::SAMPLE]:
        per = fr.get("period")
        if per not in (1, 2) or not fr.get("data"):
            continue
        flip = {}
        for t in (home, away):
            v = gx.get((per, t))
            if v:
                flip[t] = sum(v) / len(v) > 0
        if len(flip) < 2:
            # one keeper never seen this half: the other team attacks the other way
            if len(flip) == 1:
                (t, f), = flip.items()
                flip[away if t == home else home] = not f
            else:
                continue
        ball, players = None, []
        for o in fr["data"]:
            to, g = o.get("trackable_object"), o.get("group_name")
            if to == ball_id or g == "ball":
                ball = (o["x"], o["y"])
                continue
            if g == "referee":
                continue
            if to in team_of:
                players.append((team_of[to], role_of.get(to, "?"), o["x"], o["y"]))
            elif g in ("home team", "away team", "home goalkeeper", "away goalkeeper"):
                players.append((home if g.startswith("home") else away, "GK" if "goalkeeper" in g else "?", o["x"], o["y"]))
        g = (fr.get("possession") or {}).get("group")
        poss = home if g == "home team" else away if g == "away team" else None
        if ball is None or poss is None:
            continue
        acc.frame(players, ball, poss, flip)
        press.frame(players, ball, poss, flip)
        n += 1
    return n, f"{m['home_team']['short_name']} {m['home_team_score']}-{m['away_team_score']} {m['away_team']['short_name']}"


def main():
    ids = sorted(int(os.path.basename(p).split("_")[0]) for p in glob.glob(os.path.join(DIR, "*_match.json")))
    acc = ShapeOnlyWhenSeen()
    press = TrackAcc()  # every frame, for the pressure on the ball only
    names, frames = [], 0
    for mid in ids:
        n, name = match(mid, acc, press)
        frames += n; names.append(name)
        print(mid, name, n, "frames", flush=True)
    out = acc.dump()
    out.pop("speed_by_role", None)
    out["pressure_on_ball"] = press.dump()["pressure_on_ball"]
    out.update({
        "meta": {"source": "SkillCorner Open Data, first release: 9 matches of 2019/20, champions v runners-up in five leagues",
                 "credit": CREDIT, "licence": "MIT", "matches": len(ids), "sampled_hz": 10 / SAMPLE,
                 "grid": GRID_DOC},
        "what": "Same layout as idsse_tracking.json (see there), from broadcast tracking where only the players on camera "
                f"are in a frame. Shapes, back-line height and role spots: frames with {MIN_SEEN}+ of a team's outfielders "
                "on camera. Those frames favour a compact team: lengths come out about 6 m shorter than whole-pitch "
                "tracking (idsse_tracking.json); widths match. pressure_on_ball: every frame. No running speeds.",
    })
    write(os.path.join(OUT, "skillcorner2020_tracking.json"), out)
    print(frames, "frames")


if __name__ == "__main__":
    main()
