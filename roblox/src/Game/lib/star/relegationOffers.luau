--!nocheck
--!nolint
-- Generated from lib/star/relegationOffers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_promotion = import("lib/star/promotion")
	local M_transfers = import("lib/star/transfers")
	local M_economy = import("lib/star/economy")
	local M_contracts = import("lib/star/contracts")
	local M_season = import("lib/star/season")
	local M_calendar = import("lib/star/calendar")
	local positionOf, buildOffer, MEMBERSHIP_KEY, generateRelegationOffers
	positionOf = function(name, ordered)
		local at = A.indexOf(ordered, name)
		do return (if (at >= 0) then (at + 1) else Js.alen(ordered)) end
	end
	buildOffer = function(career, club, strength, position, rng, tier, sameTier)
		local mine = ((function() local _v = A.find(career.league, function(t)
			return (t.name == career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or M_promotion.estimateClubStrength(career, career.player.club))
		local rep = M_transfers.reputation(career)
		local step = (strength - mine)
		local wage = M_economy.offerWageFor(club, tier, rep, step, career.contract.wage, career)
		local seasons = (2 + math.floor((rng() * 3)))
		do return Js.O({ club = club, strength = strength, position = position, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = seasons, signingFee = Math.max(1, Math.round((M_economy.signingOnFee(club, wage) * (0.7 + (rng() * 0.4))))), clauses = M_contracts.offerClauses(career, wage, rng), division = tier, pitch = (if sameTier then (club .. " want someone who has already proven himself at this level.") else (club .. " think relegation says nothing about what you can actually do.")) }, { "club", "strength", "position", "wage", "goalBonus", "assistBonus", "seasons", "signingFee", "clauses", "division", "pitch" }) end
	end
	generateRelegationOffers = function(career, rng)
		local rep = M_transfers.reputation(career)
		local members = M_promotion.membershipOf(career)
		local table_ = M_season.sortLeague(career.league)
		local names = A.map(table_, function(t)
			return t.name
		end)
		local you = career.player.club
		local fromDivision = M_calendar.divisionOf(career)
		local fromKey = (if MEMBERSHIP_KEY[fromDivision] ~= nil then MEMBERSHIP_KEY[fromDivision] else "nationalLeague")
		local fromClubs = members[fromKey]
		local bottomFour = A.slice(names, (-(Math.min(4, Js.alen(names)))))
		local goingUp = Js.Set.new(A.filter(Js.alit(names[1], (function() local _v = career.playOffState; if _v == nil then return nil end; _v = _v.promoted; return _v end)()), function(c)
			return (not (not Js.T(c)))
		end))
		local survivors = A.filter(fromClubs, function(c)
			return (((not A.includes(bottomFour, c)) and (c ~= you)) and (not goingUp:has(c)))
		end)
		local ranked = A.sort(A.map(survivors, function(name)
			return Js.O({ name = name, strength = M_promotion.estimateClubStrength(career, name) }, { "name", "strength" })
		end), function(a, b)
			return (a.strength - b.strength)
		end)
		local centre = Math.round(((rep / 100) * (Js.alen(ranked) - 1)))
		local sameTierCount = Math.min(Js.alen(ranked), (2 + (if (rng() < 0.4) then 1 else 0)))
		local sameTierPicks = A.map(A.slice(A.sort(A.map(Js.aspread(ranked), function(c, i)
			return Js.O({ c = c, d = (math.abs((i - centre)) + (rng() * 1.5)) }, { "c", "d" })
		end), function(a, b)
			return (a.d - b.d)
		end), 0, Math.max(1, sameTierCount)), function(x)
			return x.c
		end)
		local offers = A.map(sameTierPicks, function(_p1)
			local name = _p1.name
			local strength = _p1.strength
			return buildOffer(career, name, strength, positionOf(name, names), rng, fromDivision, true)
		end)
		local aboveDivision = M_calendar.divisionAbove(fromDivision)
		local aboveKey = (if Js.T(aboveDivision) then MEMBERSHIP_KEY[aboveDivision] else nil)
		if (Js.T(aboveDivision) and Js.T(aboveKey)) then
			local chance = Math.max(0, Math.min(1, ((rep - 60) / 40)))
			local count = (if (rep >= 90) then 2 else 1)
			local aboveClubs = members[aboveKey]
			local aboveRanked = A.sort(A.map(Js.aspread(aboveClubs), function(name)
				return Js.O({ name = name, strength = M_promotion.estimateClubStrength(career, name) }, { "name", "strength" })
			end), function(a, b)
				return (a.strength - b.strength)
			end)
			local reach = Math.round((Math.max(0, ((rep - 70) / 30)) * (Js.alen(aboveRanked) / 2)))
			local taken = Js.Set.new()
			for k = 0, math.ceil(count) - 1 do
				if (rng() >= chance) then
					do continue end
				end
				local i = Math.max(0, Math.min((Js.alen(aboveRanked) - 1), (reach - math.floor((rng() * 4)))))
				local pick = (A.find(A.slice(aboveRanked, i), function(c)
					return (not taken:has(c.name))
				end) or aboveRanked[i + 1])
				if ((not pick) or taken:has(pick.name)) then
					do continue end
				end
				taken:add(pick.name)
				A.unshift(offers, buildOffer(career, pick.name, pick.strength, positionOf(pick.name, Js.aspread(aboveClubs)), rng, aboveDivision, false))
			end
		end
		do return offers end
	end
	exports.generateRelegationOffers = generateRelegationOffers
	MEMBERSHIP_KEY = Js.O({ premier = "premier", championship = "championship", league_one = "leagueOne", league_two = "leagueTwo", national_league = "nationalLeague", national_league_north = "nationalLeagueNorth", national_league_south = "nationalLeagueSouth" }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
end
