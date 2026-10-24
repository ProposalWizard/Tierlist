"""Build data/realmoments/bangers.json — Real Goals' "Bangers" (Leo, 22 Oct 2026).

Free licensed event data stops at 2018, so these famous goals (2010-2025) are
DRAFTED BY US FROM PUBLIC RECORD: each fact (scorer, minute, score, how it was
struck) checked against a match report, which is named in its `source`. The
shot spot, where it went in and the passes before it are placed by hand from
the reports' descriptions. Names are labels only: no badges, photos or clips.

Input: scripts/realmoments/bangers_drafts/*.json, each an array of goals in the
authoring shape (one object per goal: id, label, player, team, opp, comp, date,
stage, home, away, final, score, minute, period, keeper, body, type, technique,
ball, end, endZ, move, source, checked, note).
Output: the same shapes as the Wyscout files (wyscout_league_*.json), so
lib/star/realGoals joinGoals / scenarioForGoal / realMoveLeadin read it as is:
  { meta, shots: [RealShot], goals: [RgExtra + label/technique/source/...] }
xG: the same model as every Wyscout shot (wyscout_shots.json meta.xg_model).

Run: python3 -I scripts/realmoments/build_bangers.py
The admin fixer on the Real Goals page downloads a corrected bangers.json in
the OUTPUT shape: put it in data/realmoments/ directly (no need to re-run this).
"""
import glob
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CX, POST_L, POST_R = 34.0, 30.34, 37.66
DRAFTED = "drafted from public record"


def goal_angle(x, y):
    a = math.atan2(POST_L - x, max(0.01, y))
    b = math.atan2(POST_R - x, max(0.01, y))
    return abs(b - a)


def xg_of(w, x, y, head, fk):
    f = [1.0, math.log(max(0.5, math.hypot(x - CX, y))), goal_angle(x, y), 1.0 if head else 0.0, 1.0 if fk else 0.0]
    return 1 / (1 + math.exp(-sum(a * b for a, b in zip(w, f))))


def r1(v):
    return round(float(v), 2)


def main():
    meta_src = json.load(open(os.path.join(ROOT, "data/realmoments/wyscout_shots.json"), encoding="utf-8"))["meta"]
    w = meta_src["xg_model"]["weights"]
    drafts = []
    for p in sorted(glob.glob(os.path.join(ROOT, "scripts/realmoments/bangers_drafts/*.json"))):
        drafts.extend(json.load(open(p, encoding="utf-8")))
    shots, goals, seen = [], [], set()
    for d in drafts:
        gid = d["id"]
        assert gid.startswith("bg-"), gid
        assert gid not in seen, f"id twice: {gid}"
        seen.add(gid)
        bx, by = r1(d["ball"][0]), r1(d["ball"][1])
        ex = min(37.4, max(30.6, float(d["end"])))
        ez = min(2.1, max(0.11, float(d["endZ"])))
        head = d["body"] == "Head"
        fk = d["type"] == "Free Kick"
        move = []
        for e in d.get("move", []):
            t, kind, fr, to, who, rec, h = e
            move.append([round(float(t), 2), kind, [r1(fr[0]), r1(fr[1])], [r1(to[0]), r1(to[1])] if to else None, who, rec, int(h)])
        # The last action ends on the shot spot (the build-up hands the ball over there).
        if move and move[-1][3] is not None:
            move[-1][3] = [bx, by]
        passes = [[e[0], e[2], e[3], e[4], e[5]] for e in move if e[1] == "P" and e[3] and e[5]][-3:]
        home, away = d["home"], d["away"]
        shots.append({
            "id": gid, "src": "drafted", "comp": d["comp"],
            "match": f"{home} {d['final'][0]}-{d['final'][1]} {away}",
            "minute": int(d["minute"]), "player": d["player"], "team": d["team"], "opp": d["opp"],
            "outcome": "Goal", "xg": round(xg_of(w, bx, by, head, fk), 3), "body": d["body"], "type": d["type"],
            "ball": [bx, by], "end": [round(ex, 2), 0], "endZ": round(ez, 2),
            "lead": {"passes": passes, "path": []},
        })
        goals.append({
            "id": gid, "comp": d["comp"], "home": home, "away": away, "stage": d.get("stage", ""), "date": d["date"],
            "final": d["final"], "score": d["score"], "keeper": d.get("keeper", ""), "period": d.get("period", ""),
            "move": move,
            "label": d.get("label", ""), "technique": d.get("technique", ""),
            "source": d.get("source", ""), "source2": d.get("source2", ""),
            "checked": d.get("checked", ""), "note": d.get("note", ""), "drafted": DRAFTED,
        })
    out = {
        "meta": {
            "what": "Real Goals' Bangers: famous goals 2010-2025, drafted by Knowitball from public record (match reports named per goal). Names as labels only.",
            "drafted": DRAFTED,
            "frame": meta_src.get("frame", ""),
            "xg_model": meta_src["xg_model"],
            "count": len(goals),
        },
        "shots": shots,
        "goals": goals,
    }
    path = os.path.join(ROOT, "data/realmoments/bangers.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(f"wrote {path}: {len(goals)} bangers")


if __name__ == "__main__":
    main()
