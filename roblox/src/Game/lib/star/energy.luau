--!nocheck
--!nolint
-- Generated from lib/star/energy.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local ENERGY_MODES, ENERGY_FULL_MATCH_MEDIUM, ENERGY_FULL_MATCH_HIGH, ENERGY_FULL_MATCH_LOW, MODE_INVOLVEMENT, DIVISION_ENERGY_FACTOR, EUROPA_ENERGY_FACTOR, CHAMPIONS_ENERGY_FACTOR, INTERNATIONAL_ENERGY_FACTOR, clubDivision, energyFactorFor, energyPerMinute, REST_DAY_ENERGY, PROPERTY_DAY_ENERGY, TRAINING_GROUND_DAY_ENERGY, DAY_MS, MAX_REST_DAYS, restDaysBetween, dailyRecovery, clampEnergy, FATIGUE_MAX_CUT, FATIGUE_FRESH_ABOVE, fatigueCut, tiredKickSkills
	clubDivision = function(career, club)
		if (function() local _r = career.league; if _r == nil then return nil end; return A.some(_r, function(t)
			return (t.name == club)
		end) end)() then
			do return (if career.division ~= nil then career.division else "premier") end
		end
		local d = career.divisions
		if (not d) then
			do return nil end
		end
		if (function() local _r = d.premier; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "premier" end
		end
		if (function() local _r = d.championship; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "championship" end
		end
		if (function() local _r = d.leagueOne; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "league_one" end
		end
		if (function() local _r = d.leagueTwo; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "league_two" end
		end
		if (function() local _r = d.nationalLeague; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "national_league" end
		end
		if (function() local _r = d.nationalLeagueNorth; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "national_league_north" end
		end
		if (function() local _r = d.nationalLeagueSouth; if _r == nil then return nil end; return A.includes(_r, club) end)() then
			do return "national_league_south" end
		end
		do return nil end
	end
	exports.clubDivision = clubDivision
	energyFactorFor = function(career, fixture)
		local own = (DIVISION_ENERGY_FACTOR[(if career.division ~= nil then career.division else "premier")] or 1)
		if (not fixture) then
			do return own end
		end
		local comp = fixture.competition
		if ((comp == "Champions League") or (comp == "Super Cup")) then
			do return CHAMPIONS_ENERGY_FACTOR end
		end
		if ((comp == "Europa League") or (comp == "Conference League")) then
			do return EUROPA_ENERGY_FACTOR end
		end
		if (fixture.kind == "international") then
			do return INTERNATIONAL_ENERGY_FACTOR end
		end
		if ((((comp == "FA Cup") or (comp == "League Cup")) or (comp == "Lower League Trophy")) or (comp == "Community Shield")) then
			local theirs = clubDivision(career, fixture.opponent)
			do return (if Js.T(theirs) then DIVISION_ENERGY_FACTOR[theirs] else own) end
		end
		do return own end
	end
	exports.energyFactorFor = energyFactorFor
	energyPerMinute = function(mode, factor)
		if factor == nil then factor = 1 end
		local full = (if (mode == "high") then ENERGY_FULL_MATCH_HIGH else (if (mode == "low") then ENERGY_FULL_MATCH_LOW else ENERGY_FULL_MATCH_MEDIUM))
		do return ((full / 90) * factor) end
	end
	exports.energyPerMinute = energyPerMinute
	restDaysBetween = function(fromMs, toMs)
		if (((not Js.NumberNS.isFinite(fromMs)) or (not Js.NumberNS.isFinite(toMs))) or (toMs <= fromMs)) then
			do return 0 end
		end
		local days = (Math.round(((toMs - fromMs) / DAY_MS)) - 1)
		do return Math.max(0, Math.min(MAX_REST_DAYS, days)) end
	end
	exports.restDaysBetween = restDaysBetween
	dailyRecovery = function(ownsWorkingProperty, trainingGroundTier)
		local tier = Math.max(1, Math.min(3, Math.round((if Js.T(trainingGroundTier) then trainingGroundTier else 1))))
		do return ((REST_DAY_ENERGY + (if ownsWorkingProperty then PROPERTY_DAY_ENERGY else 0)) + TRAINING_GROUND_DAY_ENERGY[Js.key(tier)]) end
	end
	exports.dailyRecovery = dailyRecovery
	clampEnergy = function(n)
		do return Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(n) then n else 0))) end
	end
	exports.clampEnergy = clampEnergy
	fatigueCut = function(energy)
		local fresh = Math.max(1, FATIGUE_FRESH_ABOVE)
		local t = Math.max(0, Math.min(1, ((fresh - clampEnergy(energy)) / fresh)))
		do return (((FATIGUE_MAX_CUT * t) * t) * (3 - (2 * t))) end
	end
	exports.fatigueCut = fatigueCut
	tiredKickSkills = function(skills, energy)
		local keep = (1 - fatigueCut(energy))
		do return Js.ospread(skills, Js.O({ power = (skills.power * keep), technique = (skills.technique * keep) }, { "power", "technique" })) end
	end
	exports.tiredKickSkills = tiredKickSkills
	ENERGY_MODES = Js.alit("low", "medium", "high")
	exports.ENERGY_MODES = ENERGY_MODES
	ENERGY_FULL_MATCH_MEDIUM = M_tuningStore.getTuning("energy.fullMatchMedium")
	exports.ENERGY_FULL_MATCH_MEDIUM = ENERGY_FULL_MATCH_MEDIUM
	ENERGY_FULL_MATCH_HIGH = M_tuningStore.getTuning("energy.fullMatchHigh")
	exports.ENERGY_FULL_MATCH_HIGH = ENERGY_FULL_MATCH_HIGH
	ENERGY_FULL_MATCH_LOW = M_tuningStore.getTuning("energy.fullMatchLow")
	exports.ENERGY_FULL_MATCH_LOW = ENERGY_FULL_MATCH_LOW
	MODE_INVOLVEMENT = Js.O({ low = M_tuningStore.getTuning("energy.lowModeChances"), medium = 1, high = M_tuningStore.getTuning("energy.highModeChances") }, { "low", "medium", "high" })
	exports.MODE_INVOLVEMENT = MODE_INVOLVEMENT
	DIVISION_ENERGY_FACTOR = Js.O({ national_league_north = (26 / 36), national_league_south = (26 / 36), national_league = (28 / 36), league_two = (30 / 36), league_one = (32 / 36), championship = (34 / 36), premier = 1 }, { "national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier" })
	exports.DIVISION_ENERGY_FACTOR = DIVISION_ENERGY_FACTOR
	EUROPA_ENERGY_FACTOR = (38 / 36)
	exports.EUROPA_ENERGY_FACTOR = EUROPA_ENERGY_FACTOR
	CHAMPIONS_ENERGY_FACTOR = (40 / 36)
	exports.CHAMPIONS_ENERGY_FACTOR = CHAMPIONS_ENERGY_FACTOR
	INTERNATIONAL_ENERGY_FACTOR = (38 / 36)
	exports.INTERNATIONAL_ENERGY_FACTOR = INTERNATIONAL_ENERGY_FACTOR
	REST_DAY_ENERGY = M_tuningStore.getTuning("energy.restDayEnergy")
	exports.REST_DAY_ENERGY = REST_DAY_ENERGY
	PROPERTY_DAY_ENERGY = M_tuningStore.getTuning("energy.propertyDayEnergy")
	exports.PROPERTY_DAY_ENERGY = PROPERTY_DAY_ENERGY
	TRAINING_GROUND_DAY_ENERGY = Js.O({ ["1"] = 0, ["2"] = M_tuningStore.getTuning("energy.trainingGroundTier2Day"), ["3"] = M_tuningStore.getTuning("energy.trainingGroundTier3Day") }, { "1", "2", "3" })
	exports.TRAINING_GROUND_DAY_ENERGY = TRAINING_GROUND_DAY_ENERGY
	DAY_MS = (((24 * 60) * 60) * 1000)
	MAX_REST_DAYS = 14
	exports.MAX_REST_DAYS = MAX_REST_DAYS
	FATIGUE_MAX_CUT = M_tuningStore.getTuning("energy.tiredSkillCut")
	exports.FATIGUE_MAX_CUT = FATIGUE_MAX_CUT
	FATIGUE_FRESH_ABOVE = M_tuningStore.getTuning("energy.fatigueFreshAbove")
	exports.FATIGUE_FRESH_ABOVE = FATIGUE_FRESH_ABOVE
end
