--!nocheck
--!nolint
-- Generated from lib/star/managerPool.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_season = import("lib/star/season")
	local M_squadData = import("lib/star/squadData")
	local M_expectations = import("lib/star/expectations")
	local DREAM_APPOINTMENTS, ELITE_MANAGERS, STRONG_MANAGERS, RECOGNISABLE_MANAGERS, TIER_BY_NAME, DREAM_CLUB_BY_NAME, allPoolManagers, managerTier, dreamClubFor, managerBaseFee, WORLD_GIANT_CLUBS, JOB_PRESTIGE, MANAGER_PRESTIGE, DIVISION_OFFSET, UNTRACKED_DIVISION_OFFSET, ladderDivision, managerCooldownKey, managerInterest, TIER_REPUTATION_RANGE, TIER_ODDS, rollReplacementManager, managerRng, clubAmbition
	allPoolManagers = function()
		do return Js.aspread(A.map(DREAM_APPOINTMENTS, function(d)
			return d.name
		end), ELITE_MANAGERS, STRONG_MANAGERS, RECOGNISABLE_MANAGERS) end
	end
	exports.allPoolManagers = allPoolManagers
	managerTier = function(name)
		do return TIER_BY_NAME:get(name) end
	end
	exports.managerTier = managerTier
	dreamClubFor = function(name)
		do return DREAM_CLUB_BY_NAME:get(name) end
	end
	exports.dreamClubFor = dreamClubFor
	managerBaseFee = function(name)
		local tier = managerTier(name)
		if (tier == "dream") then
			do return 15000000 end
		end
		if (tier == 1) then
			do return 5000000 end
		end
		if (tier == 2) then
			do return 1500000 end
		end
		if (tier == 3) then
			do return 400000 end
		end
		do return 100000 end
	end
	exports.managerBaseFee = managerBaseFee
	ladderDivision = function(club)
		if A.includes(M_clubs.PREMIER_LEAGUE_CLUBS, club) then
			do return "premier" end
		end
		if A.includes(M_clubs.CHAMPIONSHIP_CLUBS, club) then
			do return "championship" end
		end
		if A.includes(M_clubs.PROMOTION_POOL_CLUBS, club) then
			do return "pool" end
		end
		do return nil end
	end
	managerCooldownKey = function(club, managerName)
		do return (club .. "::" .. managerName) end
	end
	exports.managerCooldownKey = managerCooldownKey
	managerInterest = function(career, name, club)
		local tier = managerTier(name)
		local baseFee = managerBaseFee(name)
		local cooldownUntil = (function() local _v = career.managerNegotiationCooldowns; if _v == nil then return nil end; _v = _v[managerCooldownKey(club, name)]; return _v end)()
		if ((cooldownUntil ~= nil) and (career.season < cooldownUntil)) then
			do return Js.O({ willing = false, reason = ("Talks broke down — " .. name .. " isn't interested again until next season."), anchorFee = baseFee }, { "willing", "reason", "anchorFee" }) end
		end
		if (tier == "dream") then
			local willing = ((dreamClubFor(name) == club) or A.includes(WORLD_GIANT_CLUBS, club))
			do return (if willing then Js.O({ willing = true, anchorFee = baseFee }, { "willing", "anchorFee" }) else Js.O({ willing = false, reason = (name .. "'s heart belongs to " .. Js.str(dreamClubFor(name)) .. ". He won't manage anywhere else."), anchorFee = baseFee }, { "willing", "reason", "anchorFee" })) end
		end
		if (tier == nil) then
			do return Js.O({ willing = true, anchorFee = baseFee }, { "willing", "anchorFee" }) end
		end
		local division = (ladderDivision(club) or M_clubs.divisionOf(club))
		local divisionOffset = (if Js.T(division) then DIVISION_OFFSET[division] else UNTRACKED_DIVISION_OFFSET)
		local jobPrestige = (JOB_PRESTIGE[clubAmbition(career, club)] + divisionOffset)
		local gap = (MANAGER_PRESTIGE[Js.key(tier)] - jobPrestige)
		if (gap >= 2) then
			local seed = M_season.mulberry32((M_squadData.clubNameSeed(club) + M_squadData.clubNameSeed(name)))
			if (seed() < (0.25 + Math.min(0.5, ((gap - 2) * 0.15)))) then
				do return Js.O({ willing = false, reason = (name .. " isn't interested in a job well below his level right now."), anchorFee = baseFee }, { "willing", "reason", "anchorFee" }) end
			end
		end
		local anchorFee = Math.max(50000, Math.round((baseFee * Math.pow(1.6, gap))))
		do return Js.O({ willing = true, anchorFee = anchorFee }, { "willing", "anchorFee" }) end
	end
	exports.managerInterest = managerInterest
	rollReplacementManager = function(available, club, ambition, rng)
		local odds = TIER_ODDS[ambition]
		local availableSet = Js.Set.new(available)
		local roll = rng()
		local cursor = 0
		local tryTier = function(tier, pool)
			local candidates = A.filter(pool, function(n)
				return availableSet:has(n)
			end)
			if (Js.alen(candidates) == 0) then
				do return nil end
			end
			do return Js.O({ name = candidates[math.floor((rng() * Js.alen(candidates))) + 1], tier = tier }, { "name", "tier" }) end
		end
		cursor += odds.dream
		if (roll < cursor) then
			local dreamName = (function() local _v = A.find(DREAM_APPOINTMENTS, function(d)
				return (d.club == club)
			end); if _v == nil then return nil end; _v = _v.name; return _v end)()
			local dreamPick = (if Js.T(dreamName) then tryTier("dream", Js.alit(dreamName)) else nil)
			if dreamPick then
				do return dreamPick end
			end
		end
		cursor += odds["1"]
		if (roll < cursor) then
			local pick = tryTier(1, ELITE_MANAGERS)
			if pick then
				do return pick end
			end
		end
		cursor += odds["2"]
		if (roll < cursor) then
			local pick = tryTier(2, STRONG_MANAGERS)
			if pick then
				do return pick end
			end
		end
		cursor += odds["3"]
		if (roll < cursor) then
			local pick = tryTier(3, RECOGNISABLE_MANAGERS)
			if pick then
				do return pick end
			end
		end
		do return nil end
	end
	exports.rollReplacementManager = rollReplacementManager
	managerRng = function(career, club, season)
		do return M_season.mulberry32((((M_squadData.clubNameSeed(club) + (season * 7717)) + Math.round((career.starRating * 7))) + 3)) end
	end
	exports.managerRng = managerRng
	clubAmbition = function(career, club)
		do return M_expectations.clubExpectation(Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ club = club }, { "club" })) }, { "player" }))).ambition end
	end
	exports.clubAmbition = clubAmbition
	DREAM_APPOINTMENTS = Js.alit(Js.O({ name = "Sir Alex Ferguson", club = "Manchester United" }, { "name", "club" }), Js.O({ name = "Arsène Wenger", club = "Arsenal" }, { "name", "club" }), Js.O({ name = "Jürgen Klopp", club = "Liverpool" }, { "name", "club" }))
	exports.DREAM_APPOINTMENTS = DREAM_APPOINTMENTS
	ELITE_MANAGERS = Js.alit("Pep Guardiola", "Antonio Conte", "Arne Slot", "Eddie Howe", "Didier Deschamps", "Julian Nagelsmann", "Gareth Southgate", "Zinedine Zidane", "Xavi Hernández", "Ernesto Valverde", "Joachim Löw", "Maurizio Sarri", "Thomas Tuchel")
	exports.ELITE_MANAGERS = ELITE_MANAGERS
	STRONG_MANAGERS = Js.alit("Sean Dyche", "Igor Tudor", "Marcelino", "Erik Ten Hag", "Rafael Benítez", "Gennaro Gattuso", "Vincenzo Italiano", "Kasper Hjulmand", "Ole Gunnar Solskjær", "Marcelo Bielsa", "Thiago Motta", "Louis van Gaal", "Kieran McKenna", "Ronald Koeman", "Claudio Ranieri", "Liam Rosenior", "Roberto Martínez", "Ralph Rangnick", "Stefano Pioli")
	exports.STRONG_MANAGERS = STRONG_MANAGERS
	RECOGNISABLE_MANAGERS = Js.alit("Mick McCarthy", "Steve Bruce", "Imanol Alguacil", "Sam Allardyce", "Laurent Blanc", "Bruno Lage", "Steven Gerrard", "Patrick Vieira", "Robin van Persie", "Scott Parker", "Adi Hütter", "Ralph Hasenhüttl")
	exports.RECOGNISABLE_MANAGERS = RECOGNISABLE_MANAGERS
	TIER_BY_NAME = Js.Map.new(Js.aspread(A.map(DREAM_APPOINTMENTS, function(d)
		return Js.alit(d.name, "dream")
	end), A.map(ELITE_MANAGERS, function(n)
		return Js.alit(n, 1)
	end), A.map(STRONG_MANAGERS, function(n)
		return Js.alit(n, 2)
	end), A.map(RECOGNISABLE_MANAGERS, function(n)
		return Js.alit(n, 3)
	end)))
	DREAM_CLUB_BY_NAME = Js.Map.new(A.map(DREAM_APPOINTMENTS, function(d)
		return Js.alit(d.name, d.club)
	end))
	WORLD_GIANT_CLUBS = Js.alit("Real Madrid", "FC Barcelona", "Bayern München", "Paris Saint-Germain")
	exports.WORLD_GIANT_CLUBS = WORLD_GIANT_CLUBS
	JOB_PRESTIGE = Js.O({ Title = 3, Europe = 2, ["Mid-table"] = 1, Survival = 0 }, { "Title", "Europe", "Mid-table", "Survival" })
	MANAGER_PRESTIGE = Js.O({ dream = 4, ["1"] = 3, ["2"] = 2, ["3"] = 1 }, { "dream", "1", "2", "3" })
	DIVISION_OFFSET = Js.O({ champions = 2, europa = 1, premier = 0, championship = -2, pool = -3, league_one = -4, league_two = -5, national_league = -6, national_league_north = -7, national_league_south = -7, step3_north = -8, step3_south = -8 }, { "champions", "europa", "premier", "championship", "pool", "league_one", "league_two", "national_league", "national_league_north", "national_league_south", "step3_north", "step3_south" })
	UNTRACKED_DIVISION_OFFSET = 1
	TIER_REPUTATION_RANGE = Js.O({ dream = Js.O({ min = 95, max = 100 }, { "min", "max" }), ["1"] = Js.O({ min = 80, max = 98 }, { "min", "max" }), ["2"] = Js.O({ min = 50, max = 77 }, { "min", "max" }), ["3"] = Js.O({ min = 20, max = 48 }, { "min", "max" }) }, { "dream", "1", "2", "3" })
	exports.TIER_REPUTATION_RANGE = TIER_REPUTATION_RANGE
	TIER_ODDS = Js.O({ Title = Js.O({ dream = 0.015, ["1"] = 0.25, ["2"] = 0.35, ["3"] = 0.2 }, { "dream", "1", "2", "3" }), Europe = Js.O({ dream = 0, ["1"] = 0.08, ["2"] = 0.32, ["3"] = 0.3 }, { "dream", "1", "2", "3" }), ["Mid-table"] = Js.O({ dream = 0, ["1"] = 0.02, ["2"] = 0.16, ["3"] = 0.32 }, { "dream", "1", "2", "3" }), Survival = Js.O({ dream = 0, ["1"] = 0, ["2"] = 0.05, ["3"] = 0.25 }, { "dream", "1", "2", "3" }) }, { "Title", "Europe", "Mid-table", "Survival" })
end
