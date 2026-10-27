--!nocheck
--!nolint
-- Generated from lib/star/matchInputs.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_cornerReach = import("lib/star/cornerReach")
	local M_matchday = import("lib/star/matchday")
	local M_gameplayVersion = import("lib/star/gameplayVersion")
	local matchFlowOn, opponentMatchStrength, matchInputsFor, careerMatchSpec, simpleMatchSpec
	opponentMatchStrength = function(base, home)
		do return Math.max(20, Math.min(99, (base + (if home then -3 else 4)))) end
	end
	exports.opponentMatchStrength = opponentMatchStrength
	matchInputsFor = function(s)
		local kick = (if s.kick ~= nil then s.kick else Js.O({ power = s.skills.power, technique = s.skills.technique }, { "power", "technique" }))
		do return Js.ospread(Js.O({ teamStrength = s.teamStrength, oppStrength = s.oppStrength, playerSkill = (((s.skills.power + s.skills.technique) + s.skills.vision) / 3), home = s.home, pace = s.skills.pace, freeKick = s.skills.freeKick, canTakeCorners = M_cornerReach.canTakeCorners(kick), position = s.position, energy = s.energy, energyMode = s.energyMode }, { "teamStrength", "oppStrength", "playerSkill", "home", "pace", "freeKick", "canTakeCorners", "position", "energy", "energyMode" }), (if s.energyModeChanges then Js.O({ energyModeChanges = s.energyModeChanges }, { "energyModeChanges" }) else Js.O({}, nil)), Js.O({ impactSub = (not (not s.impactSub)), talisman = (not (not s.talisman)), matchFlow = (if s.matchFlow ~= nil then s.matchFlow else matchFlowOn()) }, { "impactSub", "talisman", "matchFlow" }), (if s.farewell then Js.O({ farewell = true }, { "farewell" }) else Js.O({}, nil)), Js.O({ context = (if s.context ~= nil then s.context else Js.O({ playstyle = "balanced" }, { "playstyle" })), livePenalties = true, lateSub = s.lateSub }, { "context", "livePenalties", "lateSub" }), (if (Js.T(s.addedTime) and (s.addedTime > 0)) then Js.O({ fergie = Js.O({ from = (if s.fullTime ~= nil then s.fullTime else 90), to = ((if s.fullTime ~= nil then s.fullTime else 90) + s.addedTime) }, { "from", "to" }) }, { "fergie" }) else Js.O({}, nil))) end
	end
	exports.matchInputsFor = matchInputsFor
	careerMatchSpec = function(career, fixture, o)
		local sk = career.skills
		local _d1 = o
		local oppStrength = _d1.oppStrength
		local teamFallback = _d1.teamFallback
		local position = _d1.position
		local kick = _d1.kick
		local playstyle = _d1.playstyle
		local rest = Js.ospread(_d1)
		Js.del(rest, "oppStrength")
		Js.del(rest, "teamFallback")
		Js.del(rest, "position")
		Js.del(rest, "kick")
		Js.del(rest, "playstyle")
		do return Js.ospread(rest, Js.O({ teamStrength = M_matchday.matchTeamStrength(career, teamFallback, fixture), oppStrength = oppStrength, home = (function() local _v = fixture; if _v == nil then return nil end; _v = _v.home; return _v end)(), skills = Js.O({ power = sk.power, technique = sk.technique, vision = sk.vision, pace = sk.pace, freeKick = sk.freeKick }, { "power", "technique", "vision", "pace", "freeKick" }), kick = kick, position = position, talisman = (not (not (function() local _v = career.ownedClubs; if _v == nil then return nil end; _v = _v[career.player.club]; if _v == nil then return nil end; _v = _v.talisman; return _v end)())), context = Js.O({ playstyle = ((if playstyle ~= nil then playstyle else career.playstyle) or "balanced"), teamRelationship = career.relationships.team, fanRelationship = career.relationships.fans, skills = Js.O({ pace = sk.pace, power = sk.power, technique = sk.technique, vision = sk.vision }, { "pace", "power", "technique", "vision" }) }, { "playstyle", "teamRelationship", "fanRelationship", "skills" }) }, { "teamStrength", "oppStrength", "home", "skills", "kick", "position", "talisman", "context" })) end
	end
	exports.careerMatchSpec = careerMatchSpec
	simpleMatchSpec = function(o)
		local k = o.skill
		do return Js.O({ teamStrength = o.teamStrength, oppStrength = o.oppStrength, home = o.home, position = o.position, skills = Js.O({ power = k, technique = k, vision = k, pace = k, freeKick = k }, { "power", "technique", "vision", "pace", "freeKick" }), energyMode = "medium", matchFlow = o.matchFlow }, { "teamStrength", "oppStrength", "home", "position", "skills", "energyMode", "matchFlow" }) end
	end
	exports.simpleMatchSpec = simpleMatchSpec
	matchFlowOn = function()
		return (not M_gameplayVersion.oldMatchFlow())
	end
	exports.matchFlowOn = matchFlowOn
end
