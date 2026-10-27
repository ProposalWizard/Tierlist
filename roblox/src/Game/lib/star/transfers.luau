--!nocheck
--!nolint
-- Generated from lib/star/transfers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fame = import("lib/star/fame")
	local M_rivalries = import("lib/star/rivalries")
	local M_season = import("lib/star/season")
	local M_contracts = import("lib/star/contracts")
	local M_economy = import("lib/star/economy")
	local M_calendar = import("lib/star/calendar")
	local M_manager = import("lib/star/manager")
	local M_kits = import("lib/star/kits")
	local M_squadData = import("lib/star/squadData")
	local M_careerRecords = import("lib/star/careerRecords")
	local M_recognition = import("lib/star/recognition")
	local reputation, rivalInterestOdds, interestThreshold, generateOffers, MOVE_RESET, acceptOffer
	reputation = function(career)
		local form = (if Js.T(Js.alen(career.form)) then (A.reduce(career.form, function(s, r)
			return (s + r)
		end, 0) / Js.alen(career.form)) else 6.5)
		do return Math.max(0, Math.min(100, ((((((career.starRating / 5) * 100) * 0.45) + ((Math.min(1, (career.seasonStats.goals / 22)) * 100) * 0.22)) + ((((form - 5) / 4) * 100) * 0.18)) + ((Math.min(1, (M_fame.fameOf(career) / 100)) * 100) * 0.15)))) end
	end
	exports.reputation = reputation
	rivalInterestOdds = function(playerClub, suitorClub)
		local tier = M_rivalries.strongestTier(playerClub, suitorClub)
		local derby = M_rivalries.isDerby(playerClub, suitorClub)
		if ((not Js.T(tier)) and (not derby)) then
			do return 1 end
		end
		do return (if (tier == "R1") then 0.05 else (if (tier == "R2") then 0.2 else (if (tier == "R3") then 0.5 else 0.55))) end
	end
	exports.rivalInterestOdds = rivalInterestOdds
	interestThreshold = function(strength, mine)
		do return Math.max(8, Math.min(96, (34 + ((strength - mine) * 2.2)))) end
	end
	generateOffers = function(career, rng)
		local rep = reputation(career)
		local table_ = M_season.sortLeague(career.league)
		local mine = ((function() local _v = A.find(career.league, function(t)
			return (t.name == career.player.club)
		end); if _v == nil then return nil end; _v = _v.strength; return _v end)() or 65)
		local expiring = (career.contract.seasonsRemaining <= 1)
		local interested = A.slice(A.sort(A.filter(A.filter(A.map(table_, function(t, i)
			return Js.O({ team = t, position = (i + 1) }, { "team", "position" })
		end), function(_p1)
			local team = _p1.team
			return (team.name ~= career.player.club)
		end), function(_p2)
			local team = _p2.team
			local need = (interestThreshold(team.strength, mine) - (if expiring then 12 else 0))
			if M_contracts.canTriggerClause(career.contract, team.strength, career.contract.wage) then
				do return true end
			end
			if (rng() > rivalInterestOdds(career.player.club, team.name)) then
				do return false end
			end
			do return ((rep >= need) and (rng() < (0.55 + ((rep - need) / 240)))) end
		end), function(a, b)
			return (b.team.strength - a.team.strength)
		end), 0, 3)
		do return A.map(interested, function(_p3)
			local team = _p3.team
			local position = _p3.position
			local step = (team.strength - mine)
			local wage = M_economy.offerWageFor(team.name, M_calendar.divisionOf(career), rep, step, career.contract.wage, career)
			local seasons = (2 + math.floor((rng() * 3)))
			do return Js.O({ club = team.name, strength = team.strength, position = position, wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = seasons, signingFee = Math.max(1, Math.round((M_economy.signingOnFee(team.name, wage) * (0.8 + (rng() * 0.4))))), clauses = M_contracts.offerClauses(career, wage, rng), viaClause = M_contracts.canTriggerClause(career.contract, team.strength, career.contract.wage), pitch = (if (step > 6) then (team.name .. " finished " .. Js.numstr(position) .. ". They think you are ready for the step up.") else (if (step < -6) then (team.name .. " want you to be the player they build around.") else (team.name .. " see you as an upgrade on what they have."))) }, { "club", "strength", "position", "wage", "goalBonus", "assistBonus", "seasons", "signingFee", "clauses", "viaClause", "pitch" }) end
		end) end
	end
	exports.generateOffers = generateOffers
	acceptOffer = function(career, offer, agreedWage)
		local wage = (if agreedWage ~= nil then agreedWage else offer.wage)
		local contract = Js.ospread(Js.O({ club = offer.club, wage = wage, goalBonus = offer.goalBonus, assistBonus = offer.assistBonus, seasonsRemaining = offer.seasons }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), M_contracts.rescaleClauses(offer.clauses, offer.wage, wage))
		local record = Js.ospread(Js.O({ season = career.season, from = career.player.club, to = offer.club, fee = offer.signingFee, fromWage = career.contract.wage }, { "season", "from", "to", "fee", "fromWage" }), (if Js.T(offer.transferFee) then Js.O({ transferFee = offer.transferFee }, { "transferFee" }) else Js.O({}, nil)))
		local manager = M_manager.makeManager(career, offer.club, (career.season + 1))
		do return Js.ospread(career, Js.O({ player = Js.ospread(career.player, Js.O({ club = offer.club, clubBadge = nil }, { "club", "clubBadge" })), kitPrimary = M_kits.kitsOf(offer.club, (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[offer.club]; return _v end)()).home.shirt, kitSecondary = M_kits.kitsOf(offer.club, (function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[offer.club]; return _v end)()).home.trim, manager = manager, managerNews = nil, contract = contract, money = (career.money + offer.signingFee), relationships = Js.ospread(career.relationships, Js.O({ team = MOVE_RESET.team, boss = Math.min(MOVE_RESET.boss, M_manager.bossOnArrival(career)), fans = Math.min(career.relationships.fans, MOVE_RESET.fansCap) }, { "team", "boss", "fans" })), matchFitness = Math.max(20, (career.matchFitness + MOVE_RESET.matchFitness)), squad = M_squadData.generateSquad(M_squadData.clubNameSeed(offer.club)), outgoingMates = M_careerRecords.bestMatesOf(career.squad), transfers = Js.aspread((if career.transfers ~= nil then career.transfers else Js.alit()), Js.alit(record)), squadNumber = M_recognition.assignSquadNumber(career, offer.club), captain = false, captainMomentPending = false, lastPick = nil, clubAppearances = 0, contractStarMilestones = Js.alit(), contractFormOfferSeason = -1 }, { "player", "kitPrimary", "kitSecondary", "manager", "managerNews", "contract", "money", "relationships", "matchFitness", "squad", "outgoingMates", "transfers", "squadNumber", "captain", "captainMomentPending", "lastPick", "clubAppearances", "contractStarMilestones", "contractFormOfferSeason" })) end
	end
	exports.acceptOffer = acceptOffer
	MOVE_RESET = Js.O({ team = 52, boss = 62, fansCap = 55, matchFitness = -8 }, { "team", "boss", "fansCap", "matchFitness" })
	exports.MOVE_RESET = MOVE_RESET
end
