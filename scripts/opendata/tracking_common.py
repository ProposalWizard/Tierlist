"""Shared accumulator for the tracking reducers (IDSSE / DFL and SkillCorner).

Feed it one sampled frame at a time, in pitch METRES with the origin at the
centre spot (x along the length, y across), plus which team has the ball and
which way each team attacks. It turns every frame into the acting team's own
frame (common.py: x 0..100 own goal -> attacked goal, y 0..100 attacker's
left -> right) and keeps only running sums - never a frame.
"""
import collections, math

from common import N_COARSE, coarse, fine, quantiles

ROLES = ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"]
SPEED_BANDS = [0, 2, 4, 5.5, 7, 99]           # m/s: walk, jog, run, high-speed, sprint
SPRINT = 7.0


def to_frame(x, y, flip, length=105.0, width=68.0):
    """Metres (centre origin, +y = left of a team attacking +x) -> 0..100 frame."""
    if flip:
        x, y = -x, -y
    return (x + length / 2) / length * 100.0, (width / 2 - y) / width * 100.0


class TrackAcc:
    def __init__(self):
        D = collections.defaultdict
        self.frames = 0
        self.shape = D(lambda: [0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])  # (phase,bz)->n, back, front, len, width, cx, cy
        self.role = D(lambda: [0, 0.0, 0.0, 0.0, 0.0])              # (phase,bz,role)->n, sx, sy, sxx, syy
        self.press = D(lambda: [0, 0.0, 0, 0, collections.Counter()])  # bz -> n, sum nearest, within5, within10, hist
        self.lines = D(list)                                       # phase -> back-line height (m from own goal), sampled
        self.speed_time = D(lambda: [0] * (len(SPEED_BANDS) - 1))  # role -> frames per band
        self.sprints = D(lambda: [0, 0.0])                          # role -> sprints, minutes
        self.top_speed = D(list)                                    # role -> per player-match max (1 s smoothed)
        self.dist_per_min = D(list)                                 # role -> metres per minute per player-match

    # one frame: players = [(team, role, x, y)], ball=(x,y) or None, poss = team or None
    def frame(self, players, ball, poss, flip_of, in_play=True):
        if not in_play or ball is None or poss is None:
            return
        self.frames += 1
        by = collections.defaultdict(list)
        for t, role, x, y in players:
            by[t].append((role, x, y))
        teams = list(by)
        for t in teams:
            pts = [(r, *to_frame(x, y, flip_of[t])) for r, x, y in by[t]]
            out = [(r, x, y) for r, x, y in pts if r != "GK"]
            if len(out) < 8:
                continue
            bx, by_ = to_frame(ball[0], ball[1], flip_of[t])
            bz = coarse(bx, by_)
            ph = "in" if poss == t else "out"
            xs = sorted(p[1] for p in out); ys = [p[2] for p in out]
            s = self.shape[(ph, bz)]
            s[0] += 1; s[1] += xs[0]; s[2] += xs[-1]; s[3] += (xs[-1] - xs[0]) * 1.05
            s[4] += (max(ys) - min(ys)) * 0.68; s[5] += sum(xs) / len(xs); s[6] += sum(ys) / len(ys)
            if self.frames % 5 == 0:
                self.lines[ph].append(round(xs[0] * 1.05, 1))
            for r, x, y in pts:
                if r in ROLES:
                    q = self.role[(ph, bz, r)]
                    q[0] += 1; q[1] += x; q[2] += y; q[3] += x * x; q[4] += y * y
            if ph == "out":
                d = sorted(math.hypot((x - bx) * 1.05, (y - by_) * 0.68) for _, x, y in out)
                p = self.press[bz]
                p[0] += 1; p[1] += d[0]; p[2] += sum(1 for v in d if v < 5); p[3] += sum(1 for v in d if v < 10)
                p[4][min(30, int(d[0]))] += 1

    def player_speeds(self, role, speeds, hz):
        """speeds: one player's speed per frame (m/s) at hz frames per second, whole match."""
        if role not in ROLES or len(speeds) < hz * 60 * 10:
            return
        st = self.speed_time[role]
        for v in speeds:
            for i in range(len(SPEED_BANDS) - 1):
                if v < SPEED_BANDS[i + 1]:
                    st[i] += 1; break
        run = 0; n = 0
        for v in speeds:
            if v >= SPRINT:
                run += 1
                if run == hz:  # sustained one second
                    n += 1
            else:
                run = 0
        mins = len(speeds) / hz / 60.0
        self.sprints[role][0] += n; self.sprints[role][1] += mins
        w = max(1, hz)
        sm = [sum(speeds[i:i + w]) / w for i in range(0, len(speeds) - w, w)]
        if sm:
            self.top_speed[role].append(max(v for v in sm if v < 12.5) if any(v < 12.5 for v in sm) else 0)
        self.dist_per_min[role].append(sum(speeds) / hz / mins)

    def dump(self):
        shape = {}
        for (ph, bz), s in sorted(self.shape.items()):
            n = s[0]
            shape.setdefault(ph, [None] * N_COARSE)[bz] = {
                "n": n, "back_x": round(s[1] / n, 1), "front_x": round(s[2] / n, 1), "length_m": round(s[3] / n, 1),
                "width_m": round(s[4] / n, 1), "centre_x": round(s[5] / n, 1), "centre_y": round(s[6] / n, 1)}
        roles = {}
        for (ph, bz, r), q in sorted(self.role.items()):
            n = q[0]
            if n < 20:
                continue
            mx, my = q[1] / n, q[2] / n
            roles.setdefault(ph, {}).setdefault(r, [None] * N_COARSE)[bz] = [
                round(mx, 1), round(my, 1),
                round(math.sqrt(max(0, q[3] / n - mx * mx)), 1), round(math.sqrt(max(0, q[4] / n - my * my)), 1), n]
        press = []
        for bz in range(N_COARSE):
            p = self.press.get(bz)
            if not p or not p[0]:
                press.append(None); continue
            press.append({"n": p[0], "nearest_m": round(p[1] / p[0], 2), "within5": round(p[2] / p[0], 2),
                          "within10": round(p[3] / p[0], 2), "nearest_hist_1m": [p[4][i] for i in range(31)]})
        speed = {}
        for r in ROLES:
            if r in self.speed_time:
                tt = self.speed_time[r]; tot = sum(tt) or 1
                speed[r] = {"time_share_by_band": [round(v / tot, 4) for v in tt],
                            "sprints_per_90": round(self.sprints[r][0] / max(1e-9, self.sprints[r][1]) * 90, 1),
                            "top_speed_mps": quantiles(self.top_speed[r], (0.5, 0.9)),
                            "metres_per_min": quantiles(self.dist_per_min[r], (0.25, 0.5, 0.75))}
        return {"frames": self.frames, "shape_by_ball_zone": shape, "role_positions": roles,
                "pressure_on_ball": press,
                "back_line_m_from_own_goal": {ph: quantiles(v) for ph, v in self.lines.items()},
                "speed_by_role": {"bands_mps": SPEED_BANDS[:-1] + [None], **speed}}
