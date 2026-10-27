--!nocheck
--!nolint
-- Generated from lib/star/scoutedPlacement.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_scoutOffers = import("lib/star/scoutOffers")
	local M_season = import("lib/star/season")
	local M_economy = import("lib/star/economy")
	local M_clubs = import("lib/star/clubs")
	local SCOUTED_ODDS, FIRST_CONTRACT_WAGE, CLUBS_OF, scoutedPlacement, finalPenScoredOf, startPointPlacement, SCOUT_SALT, scoutedOfferForTrial
	scoutedPlacement = function(finalPenScored, rng)
		local odds = SCOUTED_ODDS[(if finalPenScored then "scored" else "missed")]
		local order = Js.alit("national_league", "national_league_north", "national_league_south")
		local roll = rng()
		local division = order[Js.alen(order)]
		do
			local _arr1 = order
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local d = _arr1[_i2]
				if (roll < odds[d]) then
					division = d
					do break end
				end
				roll -= odds[d]
			end
		end
		local clubs = Js.aspread(CLUBS_OF[division])
		local club = clubs[Math.min((Js.alen(clubs) - 1), math.floor((rng() * Js.alen(clubs)))) + 1]
		do return Js.O({ club = club, division = division, clubs = clubs }, { "club", "division", "clubs" }) end
	end
	exports.scoutedPlacement = scoutedPlacement
	finalPenScoredOf = function(trial)
		if (not trial) then
			do return false end
		end
		if (type(trial.finalPenScored) == "boolean") then
			do return trial.finalPenScored end
		end
		local shootout = (function() local _v = trial.results; if _v == nil then return nil end; _v = _v.shootout; return _v end)()
		do return ((not (not shootout)) and (shootout.quality >= 0.5)) end
	end
	exports.finalPenScoredOf = finalPenScoredOf
	startPointPlacement = function(division, rng)
		local clubs = M_scoutOffers.clubsForDivision(division)
		local club = clubs[Math.min((Js.alen(clubs) - 1), math.floor((rng() * Js.alen(clubs)))) + 1]
		do return Js.O({ club = club, division = division, clubs = clubs }, { "club", "division", "clubs" }) end
	end
	exports.startPointPlacement = startPointPlacement
	scoutedOfferForTrial = function(trial)
		local rng = M_season.mulberry32(Js.bxor(trial.seed, SCOUT_SALT))
		local placement = (if Js.T(trial.startDivision) then startPointPlacement(trial.startDivision, rng) else scoutedPlacement(finalPenScoredOf(trial), rng))
		local division = placement.division
		local wage = FIRST_CONTRACT_WAGE
		do return Js.O({ club = placement.club, division = division, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = 2, pitch = "A scout has spotted you. We'd like you here.", strength = M_scoutOffers.scoutedClubStrength(placement.club, division) }, { "club", "division", "wage", "goalBonus", "assistBonus", "seasons", "pitch", "strength" }) end
	end
	exports.scoutedOfferForTrial = scoutedOfferForTrial
	SCOUTED_ODDS = Js.O({ scored = Js.O({ national_league = 0, national_league_north = 0.5, national_league_south = 0.5 }, { "national_league", "national_league_north", "national_league_south" }), missed = Js.O({ national_league = 0, national_league_north = 0.5, national_league_south = 0.5 }, { "national_league", "national_league_north", "national_league_south" }) }, { "scored", "missed" })
	exports.SCOUTED_ODDS = SCOUTED_ODDS
	FIRST_CONTRACT_WAGE = 35
	exports.FIRST_CONTRACT_WAGE = FIRST_CONTRACT_WAGE
	CLUBS_OF = Js.O({ national_league = M_clubs.NATIONAL_LEAGUE_CLUBS, national_league_north = M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS, national_league_south = M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS }, { "national_league", "national_league_north", "national_league_south" })
	SCOUT_SALT = 376999
end
