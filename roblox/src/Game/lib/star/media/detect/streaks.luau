--!nocheck
--!nolint
-- Generated from lib/star/media/detect/streaks.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local M_memory = import("lib/star/media/memory")
	local POTM_RACE = function(r)
		local race = r.potmRace
		if (not race) then
			do return nil end
		end
		local facts = Js.ospread(M_kit.base(r), Js.O({ month = race.monthName, goals = race.goals, goalsN = race.goals, assists = race.assists, leader = race.leader, contenders = race.contenders }, { "month", "goals", "goalsN", "assists", "leader", "contenders" }))
		local place = race.place
		local placed = (place ~= nil)
		if race.decidesNextWeek then
			if (race.contenders < 6) then
				do return nil end
			end
			do return M_kit.ev("potm-decides", M_kit.you(r), (if (place == 1) then 74 else (if (placed and (place <= 3)) then 60 else 48)), Js.alit("award", "form", "stat"), (if placed then Js.ospread(facts, Js.O({ place = place }, { "place" })) else facts), "hour") end
		end
		if race.decidesToday then
			do return nil end
		end
		if ((place == nil) or (place > 3)) then
			do return nil end
		end
		if ((race.goals + race.assists) < 2) then
			do return nil end
		end
		do return M_kit.ev("potm-race", M_kit.you(r), (if (place == 1) then 58 else 44), Js.alit("award", "form", "stat"), Js.ospread(facts, Js.O({ place = place }, { "place" })), "evening") end
	end
	local SCORING_RUN = function(r, m)
		if (m.streaks.scoring < 3) then
			do return nil end
		end
		local n = m.streaks.scoring
		local goals = M_memory.goalsInLast(m, n)
		do return M_kit.ev("scoring-run", M_kit.you(r), Math.min(84, (38 + (n * 8))), Js.alit("streak", "goal", "stat"), Js.ospread(M_kit.base(r), Js.O({ matches = n, goals = goals, goalsN = goals }, { "matches", "goals", "goalsN" })), "hour", "form-hot") end
	end
	local HOT_STREAK = function(r, m)
		if (Js.alen(m.recent) < 3) then
			do return nil end
		end
		local three = M_memory.goalsInLast(m, 3)
		local five = M_memory.goalsInLast(m, 5)
		if (three >= 5) then
			do return M_kit.ev("red-hot", M_kit.you(r), Math.min(90, (56 + (three * 5))), Js.alit("streak", "goal", "stat", "form"), Js.ospread(M_kit.base(r), Js.O({ goals = three, matches = 3 }, { "goals", "matches" })), "hour", "form-hot") end
		end
		if ((Js.alen(m.recent) >= 5) and (five >= 7)) then
			do return M_kit.ev("purple-patch", M_kit.you(r), Math.min(84, (50 + (five * 4))), Js.alit("streak", "goal", "stat", "form"), Js.ospread(M_kit.base(r), Js.O({ goals = five, matches = 5 }, { "goals", "matches" })), "evening", "form-hot") end
		end
		do return nil end
	end
	local CREATING_RUN = function(r, m)
		if (Js.alen(m.recent) < 4) then
			do return nil end
		end
		local four = M_memory.assistsInLast(m, 4)
		if (four < 4) then
			do return nil end
		end
		do return M_kit.ev("creating", M_kit.you(r), 56, Js.alit("streak", "assist", "stat"), Js.ospread(M_kit.base(r), Js.O({ assists = four, matches = 4 }, { "assists", "matches" })), "evening", "form-hot") end
	end
	local UNBEATEN = function(r, m)
		if (m.streaks.unbeaten < 5) then
			do return nil end
		end
		do return M_kit.ev("unbeaten-run", M_kit.club(r), Math.min(80, (34 + (m.streaks.unbeaten * 5))), Js.alit("streak", "table", "stat"), Js.ospread(M_kit.base(r), Js.O({ matches = m.streaks.unbeaten }, { "matches" })), "hour", "unbeaten") end
	end
	local WINNING_RUN = function(r, m)
		if (m.streaks.winning < 4) then
			do return nil end
		end
		do return M_kit.ev("winning-run", M_kit.club(r), Math.min(84, (38 + (m.streaks.winning * 6))), Js.alit("streak", "table", "stat"), Js.ospread(M_kit.base(r), Js.O({ matches = m.streaks.winning }, { "matches" })), "hour", "unbeaten") end
	end
	local LOSING_RUN = function(r, m)
		if (m.streaks.losing < 3) then
			do return nil end
		end
		do return M_kit.ev("losing-run", M_kit.club(r), Math.min(82, (36 + (m.streaks.losing * 8))), Js.alit("streak", "shame", "stat"), Js.ospread(M_kit.base(r), Js.O({ matches = m.streaks.losing }, { "matches" })), "hour", "crisis") end
	end
	local CLEAN_SHEET_RUN = function(r, m)
		if (m.streaks.cleanSheets < 3) then
			do return nil end
		end
		do return M_kit.ev("clean-sheet-run", M_kit.club(r), Math.min(72, (32 + (m.streaks.cleanSheets * 8))), Js.alit("streak", "keeper", "stat"), Js.ospread(M_kit.base(r), Js.O({ matches = m.streaks.cleanSheets }, { "matches" })), "hour", "clean-sheets") end
	end
	local RUN_ENDED = function(r, m)
		if (Js.alen(m.recent) < 6) then
			do return nil end
		end
		if (r.result ~= "loss") then
			do return nil end
		end
		local prior = A.slice(m.recent, 1)
		local unbeaten = 0
		do
			local _arr1 = prior
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local d = _arr1[_i2]
				if (d.result == "loss") then
					do break end
				end
				unbeaten += 1
			end
		end
		if (unbeaten < 6) then
			do return nil end
		end
		do return M_kit.ev("run-ended", M_kit.club(r), Math.min(78, (40 + (unbeaten * 4))), Js.alit("streak", "drama"), Js.ospread(M_kit.base(r), Js.O({ matches = unbeaten }, { "matches" })), "hour") end
	end
	local POTM_AWARD = function(r)
		local a = r.potmAward
		if (not a) then
			do return nil end
		end
		do return M_kit.ev((if a.isYou then "potm-won" else "potm-winner"), M_kit.you(r), (if a.isYou then 88 else 56), Js.alit("award", "stat"), Js.ospread(M_kit.base(r), Js.O({ month = a.monthName, winner = a.winner, winnerClub = a.club, goals = a.goals, goalsN = a.goals, assists = a.assists }, { "month", "winner", "winnerClub", "goals", "goalsN", "assists" }), (if (a.yourPlace ~= nil) then Js.O({ place = a.yourPlace }, { "place" }) else Js.O({}, nil))), "hour") end
	end
	local STREAK_DETECTORS = Js.alit(SCORING_RUN, HOT_STREAK, CREATING_RUN, UNBEATEN, WINNING_RUN, LOSING_RUN, CLEAN_SHEET_RUN, RUN_ENDED, POTM_RACE, POTM_AWARD)
	exports.STREAK_DETECTORS = STREAK_DETECTORS
end
