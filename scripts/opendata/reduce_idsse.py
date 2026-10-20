"""Reduce the IDSSE dataset (Bassek et al. 2025, DFL tracking + events, CC BY 4.0)
to data/opendata/idsse_tracking.json.

Input (downloaded by hand, never committed): one folder with the figshare files
DFL_02_01_matchinformation_*.xml, DFL_03_02_events_raw_*.xml and
DFL_04_03_positions_raw_observed_*.xml (https://doi.org/10.6084/m9.figshare.28196177).
The position files are ~370 MB each; this streams them one at a time.

Usage: python3 -I scripts/opendata/reduce_idsse.py RAW_DIR [REPO_ROOT] [--delete-positions]
"""
import array, collections, datetime as dt, glob, math, os, sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GRID_DOC, quantiles, write  # noqa: E402
from tracking_common import TrackAcc, to_frame  # noqa: E402

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else os.path.join(os.path.dirname(__file__), "..", "..")
DELETE = "--delete-positions" in sys.argv
OUT = os.path.join(ROOT, "data", "opendata")
HZ = 25
SAMPLE = 5  # every 5th frame = 5 Hz

CREDIT = ("Data: Deutsche Fußball Liga (DFL), released with DFL authorisation in Bassek, M., Rein, R., Weber, H., "
          "Memmert, D. An integrated dataset of spatiotemporal and event data in elite soccer. Sci Data 12, 195 (2025). "
          "https://doi.org/10.1038/s41597-025-04505-y - data: https://doi.org/10.6084/m9.figshare.28196177 - "
          "licensed CC BY 4.0. Reduced to aggregate patterns by Knowitball (changes made).")

ROLE = {"TW": "GK", "IVL": "CB", "IVR": "CB", "IVZ": "CB", "LV": "LB", "RV": "RB",
        "DML": "DM", "DMR": "DM", "DMZ": "DM", "DLM": "DM", "DRM": "DM", "HL": "CM", "HR": "CM",
        "ZO": "AM", "OLM": "LW", "LM": "LW", "LA": "LW", "ORM": "RW", "RM": "RW", "RA": "RW",
        "STZ": "ST", "STL": "ST", "STR": "ST"}

POST = 3.66 / 68 * 100  # half goal width in frame units (y)


def ts(s):
    return dt.datetime.fromisoformat(s).timestamp()


class Snap:
    """Positions at set pieces and shots, in the attacking team's frame."""
    def __init__(self):
        self.corner_att = [0] * 100; self.corner_def = [0] * 100; self.corners = 0
        self.corner_zone = collections.Counter(); self.corner_gk = []
        self.shots = collections.defaultdict(lambda: collections.defaultdict(list))
        self.fk_wall = []

    @staticmethod
    def cell(x, y):
        if x < 80:
            return None
        return min(9, int((x - 80) / 2)) * 10 + min(9, int(y / 10))

    @staticmethod
    def zone(x, y):
        if x >= 94.3 and 37 <= y <= 63:
            return "six_yard_box"
        if x >= 94.3 and y < 37 or x >= 94.3 and y > 63:
            return "by_the_posts_wide"
        if 89 <= x < 94.3 and 30 <= y <= 70:
            return "penalty_spot_band"
        if 84 <= x < 89 and 19 <= y <= 81:
            return "back_of_box"
        if 75 <= x < 84 and 19 <= y <= 81:
            return "edge_of_box"
        if x >= 84:
            return "box_wide"
        return "outside"

    def corner(self, att, deff, ball):
        mirror = ball[1] > 50
        f = (lambda p: (p[0], 100 - p[1])) if mirror else (lambda p: p)
        taker = min(att, key=lambda p: (p[1] - ball[0]) ** 2 + (p[2] - ball[1]) ** 2)
        self.corners += 1
        for r, x, y in att:
            if (r, x, y) == taker or r == "GK":
                continue
            x, y = f((x, y)); c = self.cell(x, y)
            if c is not None:
                self.corner_att[c] += 1
            self.corner_zone["att_" + self.zone(x, y)] += 1
        for r, x, y in deff:
            x, y = f((x, y))
            if r == "GK":
                self.corner_gk.append((round((100 - x) * 1.05, 1), round((y - 50) * 0.68, 1)))
                continue
            c = self.cell(x, y)
            if c is not None:
                self.corner_def[c] += 1
            self.corner_zone["def_" + self.zone(x, y)] += 1

    def shot(self, shooter, att, deff, goal):
        sx, sy = shooter
        dist = math.hypot((100 - sx) * 1.05, (50 - sy) * 0.68)
        band = "0-6m" if dist < 6 else "6-11m" if dist < 11 else "11-16m" if dist < 16 else "16-25m" if dist < 25 else "25m+"

        def in_tri(px, py):
            # inside the triangle shooter -> both posts
            ax, ay, bx, by, cx, cy = sx, sy, 100, 50 - POST, 100, 50 + POST
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                return False
            l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d
            l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d
            return l1 >= 0 and l2 >= 0 and 1 - l1 - l2 >= 0
        gk = [(x, y) for r, x, y in deff if r == "GK"]
        outf = [(x, y) for r, x, y in deff if r != "GK"]
        rec = self.shots[band]
        rec["blockers_in_cone"].append(sum(1 for x, y in outf if in_tri(x, y)))
        rec["nearest_defender_m"].append(min((math.hypot((x - sx) * 1.05, (y - sy) * 0.68) for x, y in outf), default=40))
        rec["defenders_within_3m"].append(sum(1 for x, y in outf if math.hypot((x - sx) * 1.05, (y - sy) * 0.68) < 3))
        rec["attackers_in_box"].append(sum(1 for r, x, y in att if x >= 84 and 19 <= y <= 81) - (1 if sx >= 84 else 0))
        if gk:
            gx, gy = gk[0]
            rec["keeper_off_line_m"].append((100 - gx) * 1.05)
        rec["goal"].append(1 if goal else 0)

    def dump(self):
        return {
            "corners": {"n": self.corners,
                        "grid": "x 80..100 in 10 bands of 2 (id = ix*10+iy), y 0..100 in 10 bands; corner always taken from the LEFT (y<50) side",
                        "attackers": self.corner_att, "defenders": self.corner_def,
                        "per_corner_by_zone": {k: round(v / max(1, self.corners), 2) for k, v in sorted(self.corner_zone.items())},
                        "keeper_m_off_line_and_lateral": {"off_line": quantiles([g[0] for g in self.corner_gk]),
                                                          "lateral_towards_far_post": quantiles([g[1] for g in self.corner_gk])}},
            "shots_by_distance": {b: {k: quantiles(v, (0.25, 0.5, 0.75)) for k, v in d.items()} for b, d in self.shots.items()}}


def match_info(path):
    r = ET.parse(path).getroot()
    roles = {}; teams = {}
    g = r.find(".//General")
    for t in r.iter("Team"):
        teams[t.get("TeamId")] = t.get("Role")
        for p in t.iter("Player"):
            roles[p.get("PersonId")] = (t.get("TeamId"), ROLE.get(p.get("PlayingPosition", ""), "?"))
    return g.get("MatchId"), g.get("HomeTeamId"), g.get("GuestTeamId"), roles


def read_positions(path):
    """-> sampled {(section, N): {"players": [(team, pid, x, y)], ...}}, ball, speeds per player, T0 per section."""
    sampled = collections.defaultdict(list)
    ball = {}
    speeds = collections.defaultdict(lambda: array.array("f"))
    t0 = {}
    cur = None
    for ev, el in ET.iterparse(path, events=("start", "end")):
        if ev == "start" and el.tag == "FrameSet":
            cur = (el.get("GameSection"), el.get("TeamId"), el.get("PersonId"))
        elif ev == "end" and el.tag == "Frame":
            sec, team, pid = cur
            n = int(el.get("N"))
            if sec not in t0:
                t0[sec] = (n, ts(el.get("T")))
            if team == "BALL":
                if n % SAMPLE == 0:
                    ball[(sec, n)] = (float(el.get("X")), float(el.get("Y")), el.get("BallPossession"), el.get("BallStatus"))
            elif team != "referee":
                speeds[pid].append(float(el.get("S") or 0) / 3.6)  # DFL speed is km/h
                if n % SAMPLE == 0:
                    sampled[(sec, n)].append((team, pid, float(el.get("X")), float(el.get("Y"))))
            el.clear()
        elif ev == "end" and el.tag == "FrameSet":
            el.clear()
    return sampled, ball, speeds, t0


def main():
    acc = TrackAcc(); snap = Snap(); nm = 0; frames_total = 0
    ph_minutes = collections.Counter()
    for info in sorted(glob.glob(os.path.join(RAW, "DFL_02_01_matchinformation_*.xml"))):
        mid, home, guest, roles = match_info(info)
        pos_files = glob.glob(os.path.join(RAW, f"DFL_04_03_positions_raw_observed_*_{mid}.xml"))
        ev_files = glob.glob(os.path.join(RAW, f"DFL_03_02_events_raw_*_{mid}.xml"))
        if not pos_files:
            print("no positions for", mid); continue
        sampled, ball, speeds, t0 = read_positions(pos_files[0])
        # direction per section: the side the goalkeeper stands on
        flip = {}
        for sec in ("firstHalf", "secondHalf"):
            gx = collections.defaultdict(list)
            for (s, n), pl in sampled.items():
                if s != sec:
                    continue
                for team, pid, x, y in pl:
                    if roles.get(pid, (None, None))[1] == "GK":
                        gx[team].append(x)
            for team, v in gx.items():
                flip[(sec, team)] = sum(v) / len(v) > 0  # keeper on the right -> team attacks -x -> flip
        team_of_poss = {"1": home, "2": guest}
        for (sec, n), pl in sampled.items():
            b = ball.get((sec, n))
            if not b or (sec, home) not in flip or (sec, guest) not in flip:
                continue
            players = [(team, roles.get(pid, (team, "?"))[1], x, y) for team, pid, x, y in pl]
            acc.frame(players, (b[0], b[1]), team_of_poss.get(b[2]), {home: flip[(sec, home)], guest: flip[(sec, guest)]},
                      in_play=b[3] == "1")
        frames_total += len(sampled)
        for pid, sp in speeds.items():
            acc.player_speeds(roles.get(pid, (None, "?"))[1], sp, HZ)
        # set pieces and shots from the event file
        if ev_files:
            r = ET.parse(ev_files[0]).getroot()
            for e in r.iter("Event"):
                kind = None
                for ch in e.iter():
                    if ch.tag in ("CornerKick", "ShotAtGoal"):
                        kind = ch; break
                if kind is None:
                    continue
                t = ts(e.get("EventTime"))
                sec = "secondHalf" if "secondHalf" in t0 and t >= t0["secondHalf"][1] - 1 else "firstHalf"
                if sec not in t0:
                    continue
                n = t0[sec][0] + round((t - t0[sec][1]) * HZ)
                n -= n % SAMPLE
                pl = sampled.get((sec, n)); b = ball.get((sec, n))
                team = kind.get("Team")
                if not pl or not b or team not in (home, guest):
                    continue
                other = guest if team == home else home
                if (sec, team) not in flip:
                    continue
                fl = flip[(sec, team)]
                att = [(roles.get(p, (0, "?"))[1], *to_frame(x, y, fl)) for tm, p, x, y in pl if tm == team]
                deff = [(roles.get(p, (0, "?"))[1], *to_frame(x, y, fl)) for tm, p, x, y in pl if tm == other]
                bxy = to_frame(b[0], b[1], fl)
                if kind.tag == "CornerKick":
                    if bxy[0] > 90:
                        snap.corner(att, deff, bxy)
                else:
                    shooter_id = kind.get("Player")
                    sp = [to_frame(x, y, fl) for tm, p, x, y in pl if p == shooter_id]
                    if sp:
                        goal = any(c.tag == "SuccessfulShot" for c in kind.iter())
                        snap.shot(sp[0], att, deff, goal)
        nm += 1
        print(mid, "frames", len(sampled), flush=True)
        del sampled, ball, speeds
        if DELETE:
            os.remove(pos_files[0])
    out = acc.dump()
    out.update({"meta": {"source": "IDSSE / DFL Bundesliga + 2. Bundesliga 2022/23 (Bassek et al. 2025)", "credit": CREDIT,
                         "licence": "CC BY 4.0", "matches": nm, "sampled_hz": HZ / SAMPLE, "grid": GRID_DOC},
                "what": "Team shape by phase (in/out of possession) and ball COARSE zone (ball in that team's own frame): "
                        "back_x / front_x = deepest / highest outfielder, length and width in metres, centre. role_positions: "
                        "per phase -> role -> 30 ball zones -> [mean x, mean y, sd x, sd y, frames]. pressure_on_ball: "
                        "for the defending team, by ball zone in the DEFENDING team's frame: nearest defender to the ball (m), "
                        "defenders within 5 m / 10 m. speed_by_role from 25 Hz speeds (sprint = 7+ m/s for 1 s). "
                        "set_pieces: everyone's spot at the corner kick and at each shot",
                "set_pieces_and_shots": snap.dump()})
    write(os.path.join(OUT, "idsse_tracking.json"), out)


if __name__ == "__main__":
    main()
