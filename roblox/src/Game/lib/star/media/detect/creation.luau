--!nocheck
--!nolint
-- Generated from lib/star/media/detect/creation.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local ASSISTS = function(r)
		local n = r.you.assists
		if (n < 1) then
			do return nil end
		end
		local id = (if (n >= 3) then "assist-hat-trick" else (if (n == 2) then "double-assist" else "assist"))
		local importance = (if (n >= 3) then 80 else (if (n == 2) then 56 else 30))
		do return M_kit.ev(id, M_kit.you(r), importance, Js.alit("assist"), Js.ospread(M_kit.base(r), Js.O({ assists = n }, { "assists" })), "instant", (if (n >= 2) then "form-hot" else nil)) end
	end
	local GOAL_AND_ASSIST = function(r)
		if ((r.you.goals < 1) or (r.you.assists < 1)) then
			do return nil end
		end
		do return M_kit.ev("goal-and-assist", M_kit.you(r), 48, Js.alit("goal", "assist", "stat"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, assists = r.you.assists, involved = (r.you.goals + r.you.assists) }, { "goals", "assists", "involved" })), "hour") end
	end
	local INVOLVED_IN_ALL = function(r)
		local involved = (r.you.goals + r.you.assists)
		if ((r.score.us < 3) or (involved < r.score.us)) then
			do return nil end
		end
		do return M_kit.ev("involved-in-all", M_kit.you(r), 74, Js.alit("stat", "goal", "assist"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, assists = r.you.assists, involved = involved }, { "goals", "assists", "involved" })), "hour") end
	end
	local ASSIST_MILESTONE = function(r)
		if (r.you.assists == 0) then
			do return nil end
		end
		local marks = Js.alit(10, 25, 50, 100, 150)
		local passed = A.find(marks, function(m)
			return ((r.you.careerAssists >= m) and ((r.you.careerAssists - r.you.assists) < m))
		end)
		if (not Js.T(passed)) then
			do return nil end
		end
		do return M_kit.ev("assist-milestone", M_kit.you(r), (if (passed >= 100) then 72 else 50), Js.alit("assist", "milestone", "record"), Js.ospread(M_kit.base(r), Js.O({ milestone = passed, total = r.you.careerAssists }, { "milestone", "total" })), "hour") end
	end
	local TEAMMATE_GOAL = function(r)
		local seen = Js.Set.new()
		local out = Js.alit()
		do
			local _arr1 = r.goals
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				if (g.isUser or seen:has(g.scorer)) then
					do continue end
				end
				seen:add(g.scorer)
				A.push(out, M_kit.ev("teammate-goal", Js.O({ kind = "teammate", name = g.scorer }, { "kind", "name" }), 26, Js.alit("goal"), Js.ospread(M_kit.base(r), Js.O({ scorer = g.scorer }, { "scorer" })), "instant"))
			end
		end
		do return (if Js.T(Js.alen(out)) then out else nil) end
	end
	local TEAMMATE_HAUL = function(r)
		local counts = Js.Map.new()
		do
			local _arr3 = r.goals
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local g = _arr3[_i4]
				if g.isUser then
					do continue end
				end
				counts:set(g.scorer, ((counts:get(g.scorer) or 0) + 1))
			end
		end
		local best = A.sort(Js.Array.from(counts:entries()), function(a, b)
			return (b[2] - a[2])
		end)[1]
		if ((not best) or (best[2] < 2)) then
			do return nil end
		end
		do return M_kit.ev("teammate-haul", Js.O({ kind = "teammate", name = best[1] }, { "kind", "name" }), (if (best[2] >= 3) then 60 else 38), Js.alit("goal"), Js.ospread(M_kit.base(r), Js.O({ scorer = best[1], goals = best[2] }, { "scorer", "goals" })), "hour") end
	end
	local CREATION_DETECTORS = Js.alit(ASSISTS, GOAL_AND_ASSIST, INVOLVED_IN_ALL, ASSIST_MILESTONE, TEAMMATE_GOAL, TEAMMATE_HAUL)
	exports.CREATION_DETECTORS = CREATION_DETECTORS
end
