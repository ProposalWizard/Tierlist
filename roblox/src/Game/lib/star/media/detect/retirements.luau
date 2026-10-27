--!nocheck
--!nolint
-- Generated from lib/star/media/detect/retirements.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local M_kit = import("lib/star/media/detect/kit")
	local POSITION_WORD, positionWord, common, retirementEvent, regenEvent
	positionWord = function(pos)
		do return POSITION_WORD[pos] end
	end
	exports.positionWord = positionWord
	common = function(n, season)
		local role = positionWord(n.position)
		do return Js.ospread(Js.O({ player = n.name, short = M_grammar.surname(n.name), club = n.club, age = n.age, season = season }, { "player", "short", "club", "age", "season" }), (if Js.T(role) then Js.O({ role = role }, { "role" }) else Js.O({}, nil)), (if (type(n.overall) == "number") then Js.O({ overall = n.overall }, { "overall" }) else Js.O({}, nil))) end
	end
	retirementEvent = function(n, season)
		local facts = Js.ospread(common(n, season), (if Js.T(n.goalsWithUs) then Js.O({ goalsWithUs = n.goalsWithUs }, { "goalsWithUs" }) else Js.O({}, nil)), (if Js.T(n.assistsWithUs) then Js.O({ assistsWithUs = n.assistsWithUs }, { "assistsWithUs" }) else Js.O({}, nil)), (if Js.T(n.seasonGoals) then Js.O({ lastGoals = n.seasonGoals }, { "lastGoals" }) else Js.O({}, nil)), (if Js.T(n.seasonAssists) then Js.O({ lastAssists = n.seasonAssists }, { "lastAssists" }) else Js.O({}, nil)))
		if n.own then
			do return M_kit.ev("teammate-retires", Js.O({ kind = "teammate", name = n.name }, { "kind", "name" }), 52, Js.alit("milestone"), facts, "hour") end
		end
		do return M_kit.ev("legend-retires", Js.O({ kind = "club", name = n.club }, { "kind", "name" }), 48, Js.alit("milestone"), facts, "evening") end
	end
	exports.retirementEvent = retirementEvent
	regenEvent = function(n, season)
		do return M_kit.ev("regen-watch", Js.O({ kind = "club", name = n.club }, { "kind", "name" }), 34, Js.alit("rumour", "debut", "milestone"), Js.ospread(common(n, season), Js.O({ tier = (if n.worldClass then "World Class" else "High") }, { "tier" }), (if n.worldClass then Js.O({ worldClass = true }, { "worldClass" }) else Js.O({}, nil))), "nextDay") end
	end
	exports.regenEvent = regenEvent
	POSITION_WORD = Js.O({ GK = "goalkeeper", CB = "centre-back", LB = "left-back", RB = "right-back", CDM = "holding midfielder", CM = "midfielder", CAM = "attacking midfielder", LW = "winger", RW = "winger", ST = "striker" }, { "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST" })
end
