--!nocheck
--!nolint
-- Generated from lib/star/scoutOffers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_economy = import("lib/star/economy")
	local M_clubReputation = import("lib/star/clubReputation")
	local M_calendar = import("lib/star/calendar")
	local M_clubs = import("lib/star/clubs")
	local LADDER, REGIONAL_RUNGS, scoutedClubStrength, NO_INTEREST_BELOW, RETRIAL_NO_INTEREST_BELOW, FULLY_KEEN_AT, RETRIAL_FULLY_KEEN_AT, GUARANTEED_INTEREST_ABOVE, RETRIAL_GUARANTEED_INTEREST_ABOVE, offerWage, STRENGTH_SPREAD, clubStrength, PEAK, SPREAD, RETRIAL_PEAK, clamp01, appetite, pick, PITCHES, BIG_PITCHES, generateScoutOffers, SECOND_CLUB_CHANCE, trialOffers, SOURED_OFFER_SHARE, SOURED_PITCH, offerLeagueName, clubsForDivision
	scoutedClubStrength = function(club, division)
		local rung = A.find(Js.aspread(LADDER, REGIONAL_RUNGS), function(r)
			return (r.division == division)
		end)
		do return clubStrength(club, division, ((function() local _v = rung; if _v == nil then return nil end; _v = _v.strength; return _v end)() or 36)) end
	end
	exports.scoutedClubStrength = scoutedClubStrength
	offerWage = function(club, division, score)
		do return M_economy.weeklyWageFor(club, division, Math.max(0, Math.min(1, (score / 100)))) end
	end
	clubStrength = function(club, division, divisionStrength)
		local standing = M_clubReputation.clubStanding(club, division)
		do return Math.round((divisionStrength + (((standing - 0.5) * 2) * STRENGTH_SPREAD))) end
	end
	appetite = function(division, score, ctx)
		if ctx == nil then ctx = Js.O({}, nil) end
		local peak = (if ctx.retrial then RETRIAL_PEAK else PEAK)[division]
		local d = ((score - peak) / SPREAD)
		local shape = Math.exp(((-d) * d))
		local bar = (if ctx.retrial then RETRIAL_NO_INTEREST_BELOW else NO_INTEREST_BELOW)
		local keenAt = (if ctx.retrial then RETRIAL_FULLY_KEEN_AT else FULLY_KEEN_AT)
		local keenness = clamp01(((score - bar) / Math.max(1, (keenAt - bar))))
		do return (shape * keenness) end
	end
	pick = function(arr, rng)
		do return arr[math.floor((rng() * Js.alen(arr))) + 1] end
	end
	generateScoutOffers = function(trialScore, rng, ctx)
		if ctx == nil then ctx = Js.O({}, nil) end
		local score = Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(trialScore) then trialScore else 0)))
		local bar = (if ctx.retrial then RETRIAL_NO_INTEREST_BELOW else NO_INTEREST_BELOW)
		if (score < bar) then
			do return Js.alit() end
		end
		local offers = Js.alit()
		local takenClubs = Js.Set.new()
		do
			local _arr1 = LADDER
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local rung = _arr1[_i2]
				local want = appetite(rung.division, score, ctx)
				if (rng() > want) then
					do continue end
				end
				local club = pick(rung.clubs, rng)
				do
					local tries = 0
					local _first3 = true
					while true do
						if not _first3 then
							tries += 1
						end
						_first3 = false
						if not ((tries < 6) and takenClubs:has(club)) then break end
						club = pick(rung.clubs, rng)
					end
				end
				if takenClubs:has(club) then
					do continue end
				end
				takenClubs:add(club)
				local wage = offerWage(club, rung.division, score)
				A.push(offers, Js.O({ club = club, division = rung.division, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = (if ((rung.division == "premier") or (rung.division == "championship")) then 3 else 2), pitch = (if ((rung.division == "premier") and (score > 85)) then pick(BIG_PITCHES, rng) else pick(PITCHES, rng)), strength = clubStrength(club, rung.division, rung.strength) }, { "club", "division", "wage", "goalBonus", "assistBonus", "seasons", "pitch", "strength" }))
			end
		end
		local guaranteedAbove = (if ctx.retrial then RETRIAL_GUARANTEED_INTEREST_ABOVE else GUARANTEED_INTEREST_ABOVE)
		if ((not Js.T(Js.alen(offers))) and (score >= guaranteedAbove)) then
			local rung = A.reduce(LADDER, function(best, r)
				return (if (appetite(r.division, score, ctx) > appetite(best.division, score, ctx)) then r else best)
			end, LADDER[1])
			local club = pick(rung.clubs, rng)
			local wage = offerWage(club, rung.division, score)
			A.push(offers, Js.O({ club = club, division = rung.division, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = 2, pitch = pick(PITCHES, rng), strength = clubStrength(club, rung.division, rung.strength) }, { "club", "division", "wage", "goalBonus", "assistBonus", "seasons", "pitch", "strength" }))
		end
		do return A.sort(offers, function(a, b)
			return (b.strength - a.strength)
		end) end
	end
	exports.generateScoutOffers = generateScoutOffers
	trialOffers = function(trialScore, rng, ctx)
		if ctx == nil then ctx = Js.O({}, nil) end
		local offers = generateScoutOffers(trialScore, rng, ctx)
		local score = Math.max(0, Math.min(100, (if Js.NumberNS.isFinite(trialScore) then trialScore else 0)))
		local want = (if (Js.alen(offers) == 0) then (if (rng() < SECOND_CLUB_CHANCE) then 2 else 1) else (if ((Js.alen(offers) == 1) and (rng() < SECOND_CLUB_CHANCE)) then 2 else Js.alen(offers)))
		local taken = Js.Set.new(A.map(offers, function(o)
			return o.club
		end))
		local peaks = (if ctx.retrial then RETRIAL_PEAK else PEAK)
		local rungs = A.sort(Js.aspread(LADDER), function(a, b)
			return (math.abs((score - peaks[a.division])) - math.abs((score - peaks[b.division])))
		end)
		do
			local i = 0
			local _first4 = true
			while true do
				if not _first4 then
					i += 1
				end
				_first4 = false
				if not ((Js.alen(offers) < want) and (i < (Js.alen(rungs) * 3))) then break end
				local rung = rungs[math.fmod(i, Js.alen(rungs)) + 1]
				local club = pick(rung.clubs, rng)
				if taken:has(club) then
					do continue end
				end
				taken:add(club)
				local wage = offerWage(club, rung.division, score)
				A.push(offers, Js.O({ club = club, division = rung.division, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = (if ((rung.division == "premier") or (rung.division == "championship")) then 3 else 2), pitch = pick(PITCHES, rng), strength = clubStrength(club, rung.division, rung.strength) }, { "club", "division", "wage", "goalBonus", "assistBonus", "seasons", "pitch", "strength" }))
			end
		end
		do return A.sort(offers, function(a, b)
			return (b.strength - a.strength)
		end) end
	end
	exports.trialOffers = trialOffers
	offerLeagueName = function(offer)
		do return M_calendar.leagueNameFor(offer.division) end
	end
	exports.offerLeagueName = offerLeagueName
	clubsForDivision = function(division)
		do return Js.aspread(((function() local _v = A.find(Js.aspread(LADDER, REGIONAL_RUNGS), function(r)
			return (r.division == division)
		end); if _v == nil then return nil end; _v = _v.clubs; return _v end)() or M_clubs.PREMIER_LEAGUE_CLUBS)) end
	end
	exports.clubsForDivision = clubsForDivision
	LADDER = Js.alit(Js.O({ division = "premier", clubs = M_clubs.PREMIER_LEAGUE_CLUBS, strength = 80 }, { "division", "clubs", "strength" }), Js.O({ division = "championship", clubs = M_clubs.CHAMPIONSHIP_CLUBS, strength = 68 }, { "division", "clubs", "strength" }), Js.O({ division = "league_one", clubs = M_clubs.LEAGUE_ONE_CLUBS, strength = 58 }, { "division", "clubs", "strength" }), Js.O({ division = "league_two", clubs = M_clubs.LEAGUE_TWO_CLUBS, strength = 50 }, { "division", "clubs", "strength" }), Js.O({ division = "national_league", clubs = M_clubs.NATIONAL_LEAGUE_CLUBS, strength = 42 }, { "division", "clubs", "strength" }))
	REGIONAL_RUNGS = Js.alit(Js.O({ division = "national_league_north", clubs = M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS, strength = 36 }, { "division", "clubs", "strength" }), Js.O({ division = "national_league_south", clubs = M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS, strength = 36 }, { "division", "clubs", "strength" }))
	NO_INTEREST_BELOW = 30
	exports.NO_INTEREST_BELOW = NO_INTEREST_BELOW
	RETRIAL_NO_INTEREST_BELOW = 18
	exports.RETRIAL_NO_INTEREST_BELOW = RETRIAL_NO_INTEREST_BELOW
	FULLY_KEEN_AT = 95
	RETRIAL_FULLY_KEEN_AT = 36
	GUARANTEED_INTEREST_ABOVE = 70
	exports.GUARANTEED_INTEREST_ABOVE = GUARANTEED_INTEREST_ABOVE
	RETRIAL_GUARANTEED_INTEREST_ABOVE = 60
	exports.RETRIAL_GUARANTEED_INTEREST_ABOVE = RETRIAL_GUARANTEED_INTEREST_ABOVE
	STRENGTH_SPREAD = 4
	PEAK = Js.O({ premier = 96, championship = 80, league_one = 64, league_two = 48, national_league = 32, national_league_north = 16, national_league_south = 16 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	SPREAD = 22
	RETRIAL_PEAK = Js.O({ premier = 110, championship = 94, league_one = 76, league_two = 56, national_league = 26, national_league_north = 10, national_league_south = 10 }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	clamp01 = function(v)
		return (if Js.NumberNS.isFinite(v) then Math.max(0, Math.min(1, v)) else 0)
	end
	PITCHES = Js.alit("We watched you all afternoon. We'd like you here.", "You're rough, but there's something there. Come and work.", "We've had our eye out for someone like you.", "You'll have to earn it, but the door's open.", "Sign, and we'll get you playing.")
	BIG_PITCHES = Js.alit("We don't do this often. We're doing it for you.", "You were the best thing on that pitch today.", "You'll start in the youth side. You won't stay there.")
	SECOND_CLUB_CHANCE = 0.85
	exports.SECOND_CLUB_CHANCE = SECOND_CLUB_CHANCE
	SOURED_OFFER_SHARE = 0.8
	exports.SOURED_OFFER_SHARE = SOURED_OFFER_SHARE
	SOURED_PITCH = "You pushed us too far. This is our final offer — take it or leave it."
	exports.SOURED_PITCH = SOURED_PITCH
end
