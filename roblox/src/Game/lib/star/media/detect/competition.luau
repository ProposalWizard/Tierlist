--!nocheck
--!nolint
-- Generated from lib/star/media/detect/competition.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local ROUND = function(r)
		if ((not r.cup) or (r.kind == "league")) then
			do return nil end
		end
		local final = (r.round == "Final")
		if r.cup.trophy then
			do return M_kit.ev("trophy", M_kit.club(r), 100, Js.alit("trophy", "cup", (if (r.kind == "europe") then "europe" else "cup")), Js.ospread(M_kit.base(r), Js.O({ round = (if r.round ~= nil then r.round else "") }, { "round" })), "instant", ("cup-run:" .. r.competition)) end
		end
		if r.cup.advanced then
			local semi = (r.round == "Semi-Final")
			do return M_kit.ev((if semi then "into-the-final" else "through"), M_kit.club(r), (if semi then 84 else 46), Js.alit("cup"), Js.ospread(M_kit.base(r), Js.O({ round = (if r.round ~= nil then r.round else "") }, { "round" })), "instant", ("cup-run:" .. r.competition)) end
		end
		if r.cup.eliminated then
			do return M_kit.ev((if final then "lost-the-final" else "knocked-out"), M_kit.club(r), (if final then 88 else 52), Js.alit("cup", "shame"), Js.ospread(M_kit.base(r), Js.O({ round = (if r.round ~= nil then r.round else "") }, { "round" })), "instant", ("cup-run:" .. r.competition)) end
		end
		do return nil end
	end
	local EUROPEAN_NIGHT = function(r)
		if (r.kind ~= "europe") then
			do return nil end
		end
		if ((r.you.goals == 0) and (r.you.rating < 8)) then
			do return nil end
		end
		do return M_kit.ev("european-night", M_kit.you(r), 62, Js.alit("europe", "goal"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, round = (if r.round ~= nil then r.round else "") }, { "goals", "round" })), "hour") end
	end
	local INTERNATIONAL = function(r)
		if (r.kind ~= "international") then
			do return nil end
		end
		if (r.you.goals > 0) then
			do return M_kit.ev("international-goal", M_kit.you(r), 70, Js.alit("international", "goal"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals }, { "goals" })), "instant") end
		end
		do return M_kit.ev("international-cap", M_kit.you(r), 34, Js.alit("international"), Js.ospread(M_kit.base(r)), "hour") end
	end
	local GOLDEN_BOOT = function(r)
		if ((r.kind ~= "league") or (r.you.goals == 0)) then
			do return nil end
		end
		if (r.you.seasonGoals < 8) then
			do return nil end
		end
		do return M_kit.ev("golden-boot-race", M_kit.you(r), (if (r.table.matchesLeft <= 8) then 66 else 44), Js.alit("stat", "award", "goal"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.seasonGoals, left = r.table.matchesLeft }, { "goals", "left" })), "weekly", "golden-boot") end
	end
	local ASSIST_KING = function(r)
		if ((r.kind ~= "league") or (r.you.assists == 0)) then
			do return nil end
		end
		if (r.you.seasonAssists < 6) then
			do return nil end
		end
		do return M_kit.ev("assist-king-race", M_kit.you(r), (if (r.table.matchesLeft <= 8) then 64 else 42), Js.alit("stat", "award", "assist"), Js.ospread(M_kit.base(r), Js.O({ assists = r.you.seasonAssists, left = r.table.matchesLeft }, { "assists", "left" })), "weekly", "assist-king") end
	end
	local COMPETITION_DETECTORS = Js.alit(ROUND, EUROPEAN_NIGHT, INTERNATIONAL, GOLDEN_BOOT, ASSIST_KING)
	exports.COMPETITION_DETECTORS = COMPETITION_DETECTORS
end
