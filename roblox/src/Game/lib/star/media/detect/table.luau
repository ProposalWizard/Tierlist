--!nocheck
--!nolint
-- Generated from lib/star/media/detect/table.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local M_updateFlags = import("lib/star/media/updateFlags")
	local M_calendar = import("lib/star/calendar")
	local CLIMB = function(r)
		if (r.kind ~= "league") then
			do return nil end
		end
		local from = r.table.before.position
		local to = r.table.after.position
		if (to == from) then
			do return nil end
		end
		if ((to == 1) and (from ~= 1)) then
			do return M_kit.ev("went-top", M_kit.club(r), (if (r.table.matchesLeft <= 8) then 88 else 66), Js.alit("table", "title"), Js.ospread(M_kit.base(r), Js.O({ from = from, to = to, position = to, left = r.table.matchesLeft, points = r.table.after.points }, { "from", "to", "position", "left", "points" })), "hour", "title-race") end
		end
		if ((from == 1) and (to ~= 1)) then
			do return M_kit.ev("lost-top", M_kit.club(r), (if (r.table.matchesLeft <= 8) then 76 else 52), Js.alit("table", "title", "shame"), Js.ospread(M_kit.base(r), Js.O({ from = from, to = to, position = to, left = r.table.matchesLeft }, { "from", "to", "position", "left" })), "hour", "title-race") end
		end
		local drop = ((r.table.clubs - (if r.table.relegationPlaces ~= nil then r.table.relegationPlaces else 3)) + 1)
		if ((to >= drop) and (from < drop)) then
			do return M_kit.ev("into-the-drop", M_kit.club(r), 74, Js.alit("table", "relegation", "shame"), Js.ospread(M_kit.base(r), Js.O({ to = to, position = to, left = r.table.matchesLeft }, { "to", "position", "left" })), "hour", "relegation-fight") end
		end
		if ((from >= drop) and (to < drop)) then
			do return M_kit.ev("out-of-the-drop", M_kit.club(r), 68, Js.alit("table", "relegation"), Js.ospread(M_kit.base(r), Js.O({ to = to, position = to, left = r.table.matchesLeft }, { "to", "position", "left" })), "hour", "relegation-fight") end
		end
		local europe = ((not M_updateFlags.labelFixesOn()) or (r.competition == M_calendar.leagueNameFor("premier")))
		if ((europe and (to <= 4)) and (from > 4)) then
			do return M_kit.ev("into-europe", M_kit.club(r), 56, Js.alit("table", "europe"), Js.ospread(M_kit.base(r), Js.O({ to = to, position = to, left = r.table.matchesLeft }, { "to", "position", "left" })), "hour") end
		end
		if ((europe and (from <= 4)) and (to > 4)) then
			do return M_kit.ev("out-of-europe", M_kit.club(r), 44, Js.alit("table", "europe"), Js.ospread(M_kit.base(r), Js.O({ to = to, position = to }, { "to", "position" })), "evening") end
		end
		do return nil end
	end
	local TITLE_RACE = function(r)
		if (r.kind ~= "league") then
			do return nil end
		end
		if (r.table.matchesLeft > 10) then
			do return nil end
		end
		local gap = r.table.leaderGap
		if (math.abs(gap) > 6) then
			do return nil end
		end
		do return M_kit.ev("title-race", M_kit.club(r), 70, Js.alit("table", "title"), Js.ospread(M_kit.base(r), Js.O({ gap = math.abs(gap), left = r.table.matchesLeft, leading = (gap <= 0), position = r.table.after.position }, { "gap", "left", "leading", "position" })), "evening", "title-race") end
	end
	local RELEGATION_FIGHT = function(r)
		if (r.kind ~= "league") then
			do return nil end
		end
		if (r.table.matchesLeft > 10) then
			do return nil end
		end
		if ((r.table.relegationGap > 5) or (r.table.after.position < (r.table.clubs - 5))) then
			do return nil end
		end
		do return M_kit.ev("relegation-fight", M_kit.club(r), 68, Js.alit("table", "relegation"), Js.ospread(M_kit.base(r), Js.O({ gap = r.table.relegationGap, left = r.table.matchesLeft, position = r.table.after.position }, { "gap", "left", "position" })), "evening", "relegation-fight") end
	end
	local SIX_POINTER = function(r)
		if ((r.kind ~= "league") or (r.table.matchesLeft > 12)) then
			do return nil end
		end
		local near = (math.abs((r.clubStrength - r.opponentStrength)) <= 6)
		local top = (r.table.after.position <= 5)
		local bottom = (r.table.after.position >= (r.table.clubs - 5))
		if ((not near) or ((not top) and (not bottom))) then
			do return nil end
		end
		do return M_kit.ev("six-pointer", M_kit.club(r), (if top then 62 else 58), Js.alit("table", (if top then "title" else "relegation")), Js.ospread(M_kit.base(r), Js.O({ position = r.table.after.position, left = r.table.matchesLeft }, { "position", "left" })), "instant") end
	end
	local SEASON_OVER = function(r)
		if ((r.kind ~= "league") or (r.table.matchesLeft > 0)) then
			do return nil end
		end
		local pos = r.table.after.position
		local drop = ((r.table.clubs - (if r.table.relegationPlaces ~= nil then r.table.relegationPlaces else 3)) + 1)
		if (pos == 1) then
			do return M_kit.ev("champions", M_kit.club(r), 100, Js.alit("title", "trophy", "table"), Js.ospread(M_kit.base(r), Js.O({ points = r.table.after.points }, { "points" })), "instant", "title-race") end
		end
		if (pos >= drop) then
			do return M_kit.ev("relegated", M_kit.club(r), 94, Js.alit("relegation", "shame", "table"), Js.ospread(M_kit.base(r), Js.O({ position = pos, points = r.table.after.points }, { "position", "points" })), "instant", "relegation-fight") end
		end
		if ((pos <= 4) and ((not M_updateFlags.labelFixesOn()) or (r.competition == M_calendar.leagueNameFor("premier")))) then
			do return M_kit.ev("qualified", M_kit.club(r), 72, Js.alit("europe", "table"), Js.ospread(M_kit.base(r), Js.O({ position = pos, points = r.table.after.points }, { "position", "points" })), "hour") end
		end
		do return M_kit.ev("season-finished", M_kit.club(r), 40, Js.alit("table"), Js.ospread(M_kit.base(r), Js.O({ position = pos, points = r.table.after.points }, { "position", "points" })), "hour") end
	end
	local TABLE_DETECTORS = Js.alit(CLIMB, TITLE_RACE, RELEGATION_FIGHT, SIX_POINTER, SEASON_OVER)
	exports.TABLE_DETECTORS = TABLE_DETECTORS
end
