--!nocheck
--!nolint
-- Generated from lib/star/media/detect/goals.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local HAUL = function(r)
		local n = r.you.goals
		if (n < 2) then
			do return nil end
		end
		local id = (if (n >= 5) then "five-goals" else (if (n == 4) then "four-goals" else (if (n == 3) then "hat-trick" else "brace")))
		local importance = (if (n >= 5) then 96 else (if (n == 4) then 88 else (if (n == 3) then 76 else 52)))
		do return M_kit.ev(id, M_kit.you(r), importance, Js.alit("goal", (if (n >= 3) then "record" else "goal")), Js.ospread(M_kit.base(r), Js.O({ goals = n, minutes = A.join(A.map(M_kit.userGoals(r), function(g)
			return g.minute
		end), ", ") }, { "goals", "minutes" })), "instant", "form-hot") end
	end
	local ONE_GOAL = function(r)
		if (r.you.goals ~= 1) then
			do return nil end
		end
		local g = M_kit.userGoals(r)[1]
		do return M_kit.ev("scored", M_kit.you(r), 34, Js.alit("goal"), Js.ospread(M_kit.base(r), Js.O({ goals = 1, minute = ((function() local _v = g; if _v == nil then return nil end; _v = _v.minute; return _v end)() or 0), how = ((function() local _v = g; if _v == nil then return nil end; _v = _v.how; return _v end)() or "") }, { "goals", "minute", "how" })), "instant", "form-hot") end
	end
	local OPENER = function(r)
		local g = A.find(M_kit.userGoals(r), function(x)
			return (((function() local _v = x.scoreAfter; if _v == nil then return nil end; _v = _v.us; return _v end)() == 1) and (x.scoreAfter.them == 0))
		end)
		if (not g) then
			do return nil end
		end
		do return M_kit.ev("opener", M_kit.you(r), 30, Js.alit("goal"), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute }, { "minute" })), "instant") end
	end
	local EQUALISER = function(r)
		local g = A.find(M_kit.userGoals(r), M_kit.isEqualiser)
		if (not g) then
			do return nil end
		end
		local late = (g.minute >= 80)
		do return M_kit.ev("equaliser", M_kit.you(r), (if late then 62 else 44), (if late then Js.alit("goal", "drama") else Js.alit("goal")), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute, how = (if g.how ~= nil then g.how else "") }, { "minute", "how" })), "instant") end
	end
	local WINNER = function(r)
		local g = A.find(M_kit.userGoals(r), function(x)
			return M_kit.isWinner(r, x)
		end)
		if (not g) then
			do return nil end
		end
		local late = (g.minute >= 85)
		do return M_kit.ev((if late then "late-winner" else "winner"), M_kit.you(r), (if late then 86 else 58), (if late then Js.alit("goal", "drama") else Js.alit("goal")), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute, how = (if g.how ~= nil then g.how else "") }, { "minute", "how" })), "instant", "form-hot") end
	end
	local SPECTACULAR = function(r)
		local out = Js.alit()
		do
			local _arr1 = M_kit.userGoals(r)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				if (not Js.T(g.how)) then
					do continue end
				end
				local far = ((if g.distance ~= nil then g.distance else 0) >= 22)
				local spectacular = Js.alit("volley", "long_range", "free_kick", "tight_angle", "solo")
				if ((g.how == "long_range") or far) then
					A.push(out, M_kit.ev("screamer", M_kit.you(r), (if (far and ((if g.distance ~= nil then g.distance else 0) >= 28)) then 74 else 60), Js.alit("goal", "drama"), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute, how = g.how, distance = Math.round((if g.distance ~= nil then g.distance else 22)) }, { "minute", "how", "distance" })), "instant", "goal-of-the-season"))
				elseif A.includes(spectacular, g.how) then
					A.push(out, M_kit.ev("special-goal", M_kit.you(r), 56, Js.alit("goal", "drama"), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute, how = g.how }, { "minute", "how" })), "instant", "goal-of-the-season"))
				elseif ((g.how == "header") or (g.how == "penalty")) then
					A.push(out, M_kit.ev((if (g.how == "header") then "headed-goal" else "penalty-scored"), M_kit.you(r), 32, Js.alit("goal"), Js.ospread(M_kit.base(r), Js.O({ minute = g.minute, how = g.how }, { "minute", "how" })), "instant"))
				end
			end
		end
		do return (if Js.T(Js.alen(out)) then out else nil) end
	end
	local FIRST_GOAL = function(r, m)
		if (r.you.goals == 0) then
			do return nil end
		end
		if (r.you.careerGoals ~= r.you.goals) then
			do return nil end
		end
		do return M_kit.ev("first-career-goal", M_kit.you(r), 70, Js.alit("goal", "milestone", "debut"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, apps = r.you.careerAppearances, waited = Math.max(0, (r.you.careerAppearances - 1)) }, { "goals", "apps", "waited" })), "instant") end
	end
	local FIRST_FOR_CLUB = function(r)
		if (r.you.goals == 0) then
			do return nil end
		end
		if (r.you.careerGoals == r.you.goals) then
			do return nil end
		end
		if (r.you.clubAppearances > 12) then
			do return nil end
		end
		if ((r.you.careerAppearances - r.you.clubAppearances) < 5) then
			do return nil end
		end
		do return M_kit.ev("first-for-club", M_kit.you(r), 58, Js.alit("goal", "milestone"), Js.ospread(M_kit.base(r), Js.O({ apps = r.you.clubAppearances }, { "apps" })), "instant") end
	end
	local GOAL_MILESTONE = function(r)
		if (r.you.goals == 0) then
			do return nil end
		end
		local marks = Js.alit(10, 25, 50, 75, 100, 150, 200, 250, 300)
		local passed = A.find(marks, function(m)
			return ((r.you.careerGoals >= m) and ((r.you.careerGoals - r.you.goals) < m))
		end)
		if (not Js.T(passed)) then
			do return nil end
		end
		do return M_kit.ev("goal-milestone", M_kit.you(r), (if (passed >= 100) then 88 else (if (passed >= 50) then 72 else 56)), Js.alit("goal", "milestone", "record"), Js.ospread(M_kit.base(r), Js.O({ milestone = passed, total = r.you.careerGoals, apps = r.you.careerAppearances }, { "milestone", "total", "apps" })), "hour") end
	end
	local ALL_THE_GOALS = function(r)
		if ((r.you.goals < 2) or (r.you.goals ~= r.score.us)) then
			do return nil end
		end
		do return M_kit.ev("scored-them-all", M_kit.you(r), 70, Js.alit("goal", "stat"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals }, { "goals" })), "hour") end
	end
	local BLANK = function(r, m)
		if (r.you.goals > 0) then
			do return nil end
		end
		if (m.streaks.drought < 5) then
			do return nil end
		end
		if (not A.includes(Js.alit("ST", "CAM", "LW", "RW"), r.you.position)) then
			do return nil end
		end
		do return M_kit.ev("drought", M_kit.you(r), Math.min(66, (30 + (m.streaks.drought * 4))), Js.alit("shame", "form", "streak"), Js.ospread(M_kit.base(r), Js.O({ matches = m.streaks.drought }, { "matches" })), "evening", "drought") end
	end
	local GOAL_DETECTORS = Js.alit(HAUL, ONE_GOAL, OPENER, EQUALISER, WINNER, SPECTACULAR, FIRST_GOAL, FIRST_FOR_CLUB, GOAL_MILESTONE, ALL_THE_GOALS, BLANK)
	exports.GOAL_DETECTORS = GOAL_DETECTORS
end
