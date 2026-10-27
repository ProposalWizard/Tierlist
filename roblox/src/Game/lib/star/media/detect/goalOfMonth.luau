--!nocheck
--!nolint
-- Generated from lib/star/media/detect/goalOfMonth.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local KIND_BASE, goalQuality, KIND_WORD, describeGoal, synthKindFor, bestOf, pickRivalGoals, fanTotal, fanVotes, userWeightFor, tally, winnerOf, synthOf, GOTM_FANS_BOOST
	goalQuality = function(g)
		local base = (KIND_BASE[(if g.how ~= nil then g.how else "")] or 40)
		local d = (if ((type(g.distance) == "number") and Js.isFinite(g.distance)) then g.distance else nil)
		local far = (if (d == nil) then 0 else Math.max(-10, Math.min(25, ((d - 12) * 1.5))))
		local shape = (if (g.finish == "chip") then 10 else (if (g.finish == "curl") then 8 else 0))
		do return Math.round(Math.max(0, Math.min(100, ((base + far) + shape)))) end
	end
	exports.goalQuality = goalQuality
	describeGoal = function(g, opponent)
		local d = (if ((type(g.distance) == "number") and (g.distance >= 16)) then (Js.numstr(Math.round(g.distance)) .. "-yard ") else "")
		local what = (if (g.finish == "chip") then "chip" else (if (g.finish == "curl") then "curler" else (if Js.T(d) then S.toLowerCase((KIND_WORD[(if g.how ~= nil then g.how else "")] or "strike")) else (KIND_WORD[(if g.how ~= nil then g.how else "")] or "Finish"))))
		local text = (d .. what)
		do return (S.toUpperCase(S.charAt(text, 0)) .. S.slice(text, 1) .. " v " .. opponent) end
	end
	exports.describeGoal = describeGoal
	synthKindFor = function(how)
		if (how == "penalty") then
			do return "penalty" end
		end
		if (how == "header") then
			do return "header" end
		end
		if (((how == "long_range") or (how == "free_kick")) or (how == "volley")) then
			do return "long_range" end
		end
		if (((how == "solo") or (how == "one_on_one")) or (how == "through_ball")) then
			do return "run_in" end
		end
		do return "tap_in" end
	end
	exports.synthKindFor = synthKindFor
	bestOf = function(goals, n)
		if n == nil then n = 3 end
		do return A.map(A.slice(A.sort(A.map(goals, function(g, i)
			return Js.O({ g = g, i = i }, { "g", "i" })
		end), function(a, b)
			return (function() local _l = (b.g.quality - a.g.quality); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
		end), 0, n), function(x)
			return x.g
		end) end
	end
	exports.bestOf = bestOf
	pickRivalGoals = function(results, yourClub, inMonth, seed, competition, season, n, shortName)
		if n == nil then n = 2 end
		if shortName == nil then shortName = function(c)
		return c
	end end
		local rng = M_grammar.rngFor("gotm-rivals", seed)
		local cands = Js.alit()
		do
			local _arr1 = results
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				if (((not inMonth(r.week)) or (r.home == yourClub)) or (r.away == yourClub)) then
					do continue end
				end
				do
					local _arr3 = Js.alit(Js.alit(r.hg, true), Js.alit(r.ag, false))
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local _e5 = _arr3[_i4]
						local list = _e5[1]
						local home = _e5[2]
						do
							local _arr6 = (if list ~= nil then list else Js.alit())
							local _i7 = 0
							while _i7 < Js.alen(_arr6) do
								_i7 += 1
								local g = _arr6[_i7]
								A.push(cands, Js.O({ r = r, g = g, home = home, roll = (rng() + (if Js.T(g.full) then 1 else 0)) }, { "r", "g", "home", "roll" }))
							end
						end
					end
				end
			end
		end
		A.sort(cands, function(a, b)
			return (b.roll - a.roll)
		end)
		local out = Js.alit()
		local usedMatch = Js.Set.new()
		do
			local _arr8 = cands
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local c = _arr8[_i9]
				if (Js.alen(out) >= n) then
					do break end
				end
				local key = (Js.numstr(c.r.week) .. "-" .. c.r.home .. "-" .. c.r.away)
				if usedMatch:has(key) then
					do continue end
				end
				usedMatch:add(key)
				local long = (rng() < 0.5)
				local kind = (if long then "long_range" else "run_in")
				local quality = Math.round((if long then (70 + (rng() * 20)) else (58 + (rng() * 22))))
				local club = (if c.home then c.r.home else c.r.away)
				local opp = (if c.home then c.r.away else c.r.home)
				local all = A.sort(Js.aspread(A.map((if c.r.hg ~= nil then c.r.hg else Js.alit()), function(g)
					return Js.O({ g = g, h = true }, { "g", "h" })
				end), A.map((if c.r.ag ~= nil then c.r.ag else Js.alit()), function(g)
					return Js.O({ g = g, h = false }, { "g", "h" })
				end)), function(a, b)
					return (a.g.m - b.g.m)
				end)
				local hs = 0
				local as = 0
				do
					local _arr10 = all
					local _i11 = 0
					while _i11 < Js.alen(_arr10) do
						_i11 += 1
						local x = _arr10[_i11]
						if x.h then
							hs += 1
						else
							as += 1
						end
						if (x.g == c.g) then
							do break end
						end
					end
				end
				local yards = (if long then (22 + Math.round((rng() * 10))) else 0)
				local synth = Js.O({ home = c.r.home, away = c.r.away, scorerHome = c.home, minute = c.g.m, scoreAfter = Js.alit(hs, as), competition = competition, seed = ("g" .. Js.numstr(season) .. "." .. Js.numstr(c.r.week) .. "." .. Js.numstr(c.g.m) .. c.g.s), kind = kind }, { "home", "away", "scorerHome", "minute", "scoreAfter", "competition", "seed", "kind" })
				A.push(out, Js.O({ scorer = (if c.g.full ~= nil then c.g.full else c.g.s), scorerShort = c.g.s, club = club, isYou = false, detail = (if long then (Js.numstr(yards) .. "-yard strike v " .. shortName(opp)) else ("Solo run v " .. shortName(opp))), quality = quality, synth = synth }, { "scorer", "scorerShort", "club", "isYou", "detail", "quality", "synth" }))
			end
		end
		do return out end
	end
	exports.pickRivalGoals = pickRivalGoals
	fanTotal = function(fame, seed)
		local rng = M_grammar.rngFor("gotm-total", seed)
		local f = Math.max(0, Math.min(100, fame))
		do return Math.round(((2000 + (f * 300)) * (0.9 + (rng() * 0.2)))) end
	end
	exports.fanTotal = fanTotal
	fanVotes = function(entries, fame, seed)
		if (not Js.T(Js.alen(entries))) then
			do return Js.alit() end
		end
		local rng = M_grammar.rngFor("gotm-votes", seed)
		local f = (Math.max(0, Math.min(100, fame)) / 100)
		local w = A.map(entries, function(e)
			local q = (0.35 + (Math.max(0, Math.min(100, e.quality)) / 100))
			local wobble = (0.75 + (rng() * 0.5))
			do return (((q * q) * wobble) * (if e.isYou then (1 + (0.8 * f)) else 1)) end
		end)
		local sum = (function() local _l = A.reduce(w, function(a, b)
			return (a + b)
		end, 0); if Js.T(_l) then return _l end; return 1 end)()
		local total = fanTotal(fame, seed)
		do return A.map(w, function(x)
			return Math.round(((total * x) / sum))
		end) end
	end
	exports.fanVotes = fanVotes
	userWeightFor = function(fanVotesList)
		do return Math.max(1, Math.round((A.reduce(fanVotesList, function(a, b)
			return (a + b)
		end, 0) * 0.06))) end
	end
	exports.userWeightFor = userWeightFor
	tally = function(poll)
		do return A.map(poll.fanVotes, function(v, i)
			return (v + (if (poll.userVote == i) then poll.userWeight else 0))
		end) end
	end
	exports.tally = tally
	winnerOf = function(poll)
		local t = tally(poll)
		local best = 0
		for i = 1, (Js.alen(t)) - 1 do
			if (t[i + 1] > t[best + 1]) then
				best = i
			end
		end
		do return best end
	end
	exports.winnerOf = winnerOf
	synthOf = function(e)
		do return (if e.synth then Js.ospread(e.synth, Js.O({ scorer = e.scorer, scorerShort = e.scorerShort }, { "scorer", "scorerShort" })) else nil) end
	end
	exports.synthOf = synthOf
	KIND_BASE = Js.O({ penalty = 10, rebound = 25, corner = 35, cutback = 35, byline_cross = 35, through_ball = 40, midfield_pass = 40, buildup = 40, header = 45, one_on_one = 45, tight_angle = 60, volley = 65, solo = 70, long_range = 70, free_kick = 75 }, { "penalty", "rebound", "corner", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "header", "one_on_one", "tight_angle", "volley", "solo", "long_range", "free_kick" })
	KIND_WORD = Js.O({ penalty = "Penalty", rebound = "Rebound", corner = "From a corner", cutback = "Cut-back finish", byline_cross = "Finish from a cross", through_ball = "Through on goal", midfield_pass = "Finish", buildup = "Team move", header = "Header", one_on_one = "One-on-one", tight_angle = "Tight angle", volley = "Volley", solo = "Solo run", long_range = "Long shot", free_kick = "Free kick" }, { "penalty", "rebound", "corner", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "header", "one_on_one", "tight_angle", "volley", "solo", "long_range", "free_kick" })
	GOTM_FANS_BOOST = 3
	exports.GOTM_FANS_BOOST = GOTM_FANS_BOOST
end
