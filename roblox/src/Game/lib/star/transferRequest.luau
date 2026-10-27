--!nocheck
--!nolint
-- Generated from lib/star/transferRequest.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_promotion = import("lib/star/promotion")
	local M_season = import("lib/star/season")
	local M_rating = import("lib/star/rating")
	local M_fame = import("lib/star/fame")
	local M_transfers = import("lib/star/transfers")
	local M_economy = import("lib/star/economy")
	local M_contracts = import("lib/star/contracts")
	local YES_LINE, ADJUST_CAP, CROWDED_PENALTY, NEED_BONUS, CROWDED_AT, ASK_LEAGUE_BOSS_COST, ASK_CLUB_BOSS_COST, REFUSAL_COOLDOWN_WEEKS, NOT_LOOKING_CHANCE, AFFORD_SHARE, emptyRequest, requestOf, weekOrdinal, MEMBERSHIP_KEY, ASKABLE_LEAGUES, clubsIn, positionIn, positionGroup, GROUP_WORD, NUMBER_WORD, squadNeed, playerOverall, personalAdjustment, roleFor, ROLE_PITCH, judgeClub, canAsk, weeksUntilAskable, askSeed, askForMove, agreeMove, talksFailed, callOffMove, clearAfterWindow, bonusOfferCount, bonusSummerOffers, summerWindowOffers
	emptyRequest = function()
		do return Js.O({ replies = Js.alit(), refused = Js.O({}, nil), asks = 0 }, { "replies", "refused", "asks" }) end
	end
	exports.emptyRequest = emptyRequest
	requestOf = function(career)
		do return (if career.transferRequest ~= nil then career.transferRequest else emptyRequest()) end
	end
	exports.requestOf = requestOf
	weekOrdinal = function(season, week)
		do return ((season * 100) + week) end
	end
	exports.weekOrdinal = weekOrdinal
	clubsIn = function(career, division)
		local names = (if (division == M_calendar.divisionOf(career)) then A.map(career.league, function(t)
			return t.name
		end) else M_promotion.membershipOf(career)[MEMBERSHIP_KEY[division]])
		do return A.sort(A.map(A.filter(names, function(n)
			return (n ~= career.player.club)
		end), function(club)
			return Js.O({ club = club, strength = M_promotion.estimateClubStrength(career, club) }, { "club", "strength" })
		end), function(a, b)
			return (b.strength - a.strength)
		end) end
	end
	exports.clubsIn = clubsIn
	positionIn = function(career, division, club)
		if (division == M_calendar.divisionOf(career)) then
			local at = A.findIndex(M_season.sortLeague(career.league), function(t)
				return (t.name == club)
			end)
			if (at >= 0) then
				do return (at + 1) end
			end
		end
		local ordered = A.sort(A.filter(A.filter(Js.aspread(clubsIn(career, division), Js.alit(Js.O({ club = career.player.club, strength = M_promotion.estimateClubStrength(career, career.player.club) }, { "club", "strength" }))), function(c, i, a)
			return (A.findIndex(a, function(x)
				return (x.club == c.club)
			end) == i)
		end), function(c)
			return ((division ~= M_calendar.divisionOf(career)) or (c.club ~= career.player.club))
		end), function(a, b)
			return (b.strength - a.strength)
		end)
		local at = A.findIndex(ordered, function(c)
			return (c.club == club)
		end)
		do return (if (at >= 0) then (at + 1) else Js.alen(ordered)) end
	end
	positionGroup = function(position)
		local _sw1 = position
		if _sw1 == "GK" then
			do return "GK" end
		elseif _sw1 == "CB" or _sw1 == "LB" or _sw1 == "RB" or _sw1 == "LWB" or _sw1 == "RWB" then
			do return "DEF" end
		elseif _sw1 == "CDM" or _sw1 == "CM" or _sw1 == "CAM" then
			do return "MID" end
		elseif _sw1 == "LW" or _sw1 == "RW" or _sw1 == "LM" or _sw1 == "RM" then
			do return "WIDE" end
		else
			do return "ATT" end
		end
	end
	exports.positionGroup = positionGroup
	squadNeed = function(career, club, overall)
		local group = positionGroup(career.player.position)
		local squad = A.find(Js.aspread((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), (if career.externalSquads ~= nil then career.externalSquads else Js.alit())), function(s)
			return (s.club == club)
		end)
		if ((not squad) or (Js.alen(squad.players) == 0)) then
			do return Js.O({ known = false, better = 0, group = group }, { "known", "better", "group" }) end
		end
		local better = Js.alen(A.filter(squad.players, function(p)
			return ((positionGroup(p.position) == group) and (p.overall >= overall))
		end))
		do return Js.O({ known = true, better = better, group = group }, { "known", "better", "group" }) end
	end
	exports.squadNeed = squadNeed
	playerOverall = function(career)
		do return M_rating.displayOverall(career.starRating) end
	end
	exports.playerOverall = playerOverall
	personalAdjustment = function(career)
		local form = (if Js.T(Js.alen(career.form)) then (A.reduce(career.form, function(s, r)
			return (s + r)
		end, 0) / Js.alen(career.form)) else 6.5)
		local formAdj = Math.max(-5, Math.min(5, ((form - 6.8) * 4)))
		local fameAdj = (Math.min(1, Math.max(0, (M_fame.fameOf(career) / 100))) * 4)
		local age = career.player.age
		local ageAdj = (if (age <= 20) then 4 else (if (age <= 23) then 2 else (if (age <= 29) then 0 else (if (age <= 31) then -2 else ((-(age - 31)) * 3)))))
		do return Math.max((-ADJUST_CAP), Math.min(ADJUST_CAP, ((formAdj + fameAdj) + ageAdj))) end
	end
	exports.personalAdjustment = personalAdjustment
	roleFor = function(score)
		do return (if (score >= 10) then "Star man" else (if (score >= 4) then "First team" else (if (score >= (YES_LINE + 3)) then "Rotation" else "Squad player"))) end
	end
	judgeClub = function(career, club, division, rng)
		local rRival = rng()
		local rNoise = rng()
		local rLooking = rng()
		local rDeal = rng()
		local overall = playerOverall(career)
		local strength = M_promotion.estimateClubStrength(career, club)
		local need = squadNeed(career, club, overall)
		local crowded = (need.known and (need.better >= CROWDED_AT))
		local wanted = (need.known and (need.better == 0))
		local score = ((((overall - strength) + personalAdjustment(career)) - (if crowded then CROWDED_PENALTY else 0)) + (if wanted then NEED_BONUS else 0))
		local wobbled = (score + ((rNoise - 0.5) * 4))
		local base = Js.O({ club = club, division = division, strength = strength }, { "club", "division", "strength" })
		if (rRival > M_transfers.rivalInterestOdds(career.player.club, club)) then
			do return Js.ospread(base, Js.O({ yes = false, reason = "rival", message = ("Not from " .. career.player.club .. ". Not ever.") }, { "yes", "reason", "message" })) end
		end
		if (wobbled < YES_LINE) then
			if (crowded and ((overall - strength) >= YES_LINE)) then
				local n = (if NUMBER_WORD[need.better + 1] ~= nil then NUMBER_WORD[need.better + 1] else Js.numstr(need.better))
				do return Js.ospread(base, Js.O({ yes = false, reason = "crowded", message = ("We have " .. n .. " " .. GROUP_WORD[need.group] .. " better than you.") }, { "yes", "reason", "message" })) end
			end
			if ((career.player.age >= 32) and ((overall - strength) >= YES_LINE)) then
				do return Js.ospread(base, Js.O({ yes = false, reason = "age", message = "We're building a younger side." }, { "yes", "reason", "message" })) end
			end
			do return Js.ospread(base, Js.O({ yes = false, reason = "level", message = (if (wobbled < (YES_LINE - 8)) then "You're not good enough for us yet." else "Close. Have a big season and ask again.") }, { "yes", "reason", "message" })) end
		end
		local rep = M_transfers.reputation(career)
		local step = (strength - M_promotion.estimateClubStrength(career, career.player.club))
		local theirPay = M_economy.weeklyWageFor(club, division, M_economy.offerStanding(rep, step), career)
		if ((career.contract.wage > 0) and (theirPay < (career.contract.wage * AFFORD_SHARE))) then
			do return Js.ospread(base, Js.O({ yes = false, reason = "money", message = "We can't pay what you're on." }, { "yes", "reason", "message" })) end
		end
		if (rLooking < NOT_LOOKING_CHANCE) then
			local g = GROUP_WORD[need.group]
			do return Js.ospread(base, Js.O({ yes = false, reason = "not-looking", message = ("We're not looking for " .. g .. " right now.") }, { "yes", "reason", "message" })) end
		end
		local role = roleFor(score)
		local wage = (if (theirPay < career.contract.wage) then Math.max(1, Math.round(theirPay)) else M_economy.offerWageFor(club, division, rep, step, career.contract.wage, career))
		local s = (function() local _l = math.floor((rDeal * (2 ^ 31))); if Js.T(_l) then return _l end; return 1 end)()
		local dealRng = function()
			s = math.fmod((s * 16807), 2147483647)
			do return ((s - 1) / 2147483646) end
		end
		local seasons = (2 + math.floor((dealRng() * 3)))
		local offer = Js.O({ club = club, strength = strength, position = positionIn(career, division, club), wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), seasons = seasons, signingFee = Math.max(1, Math.round((M_economy.signingOnFee(club, wage) * (0.8 + (dealRng() * 0.4))))), clauses = M_contracts.offerClauses(career, wage, dealRng), division = division, pitch = (ROLE_PITCH[role] .. " The move you asked for.") }, { "club", "strength", "position", "wage", "goalBonus", "assistBonus", "seasons", "signingFee", "clauses", "division", "pitch" })
		do return Js.ospread(base, Js.O({ yes = true, role = role, message = ROLE_PITCH[role], offer = offer }, { "yes", "role", "message", "offer" })) end
	end
	exports.judgeClub = judgeClub
	canAsk = function(career)
		if ((not Js.T(career.player.club)) or (Js.alen(career.league) == 0)) then
			do return Js.O({ ok = false, why = "no-club" }, { "ok", "why" }) end
		end
		local req = requestOf(career)
		if req.agreed then
			do return Js.O({ ok = false, why = "agreed" }, { "ok", "why" }) end
		end
		if ((req.lastAsk and (req.lastAsk.season == career.season)) and (req.lastAsk.week == career.week)) then
			do return Js.O({ ok = false, why = "asked-this-week" }, { "ok", "why" }) end
		end
		do return Js.O({ ok = true }, { "ok" }) end
	end
	exports.canAsk = canAsk
	weeksUntilAskable = function(career, club)
		local until_ = (requestOf(career).refused)[club]
		if (until_ == nil) then
			do return 0 end
		end
		local now = weekOrdinal(career.season, career.week)
		if (math.floor((until_ / 100)) < career.season) then
			do return 0 end
		end
		do return Math.max(0, (until_ - now)) end
	end
	exports.weeksUntilAskable = weeksUntilAskable
	askSeed = function(career)
		do return (((career.season * 104729) + (career.week * 7919)) + Math.round(career.fame)) end
	end
	exports.askSeed = askSeed
	askForMove = function(career, division, club, rng)
		if (not canAsk(career).ok) then
			do return career end
		end
		local req = requestOf(career)
		local now = weekOrdinal(career.season, career.week)
		local targets = A.filter(A.filter(clubsIn(career, division), function(c)
			return ((not Js.T(club)) or (c.club == club))
		end), function(c)
			return (weeksUntilAskable(career, c.club) == 0)
		end)
		if (Js.alen(targets) == 0) then
			do return career end
		end
		local replies = A.map(targets, function(t)
			return judgeClub(career, t.club, division, rng)
		end)
		local refused = Js.ospread(req.refused)
		do
			local _arr2 = replies
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local r = _arr2[_i3]
				if r.yes then
					Js.del(refused, r.club)
				else
					refused[r.club] = (now + REFUSAL_COOLDOWN_WEEKS)
				end
			end
		end
		local cost = (if Js.T(club) then ASK_CLUB_BOSS_COST else ASK_LEAGUE_BOSS_COST)
		do return Js.ospread(career, Js.O({ relationships = Js.ospread(career.relationships, Js.O({ boss = Math.max(0, (career.relationships.boss - cost)) }, { "boss" })), transferRequest = Js.ospread(req, Js.O({ lastAsk = Js.O({ season = career.season, week = career.week }, { "season", "week" }), league = division, replies = A.sort(Js.aspread(replies), function(a, b)
			return (function() local _l = (Js.Number(b.yes) - Js.Number(a.yes)); if Js.T(_l) then return _l end; return (b.strength - a.strength) end)()
		end), refused = refused, asks = (req.asks + 1) }, { "lastAsk", "league", "replies", "refused", "asks" })) }, { "relationships", "transferRequest" })) end
	end
	exports.askForMove = askForMove
	agreeMove = function(career, offer, agreedWage)
		local req = requestOf(career)
		local wage = (if agreedWage ~= nil then agreedWage else offer.wage)
		local agreed = (if (wage == offer.wage) then offer else Js.ospread(offer, Js.O({ wage = wage, goalBonus = M_economy.goalBonusFor(wage), assistBonus = M_economy.assistBonusFor(wage), clauses = M_contracts.rescaleClauses(offer.clauses, offer.wage, wage) }, { "wage", "goalBonus", "assistBonus", "clauses" })))
		do return Js.ospread(career, Js.O({ transferRequest = Js.ospread(req, Js.O({ agreed = agreed }, { "agreed" })) }, { "transferRequest" })) end
	end
	exports.agreeMove = agreeMove
	talksFailed = function(career, club)
		local req = requestOf(career)
		local now = weekOrdinal(career.season, career.week)
		do return Js.ospread(career, Js.O({ transferRequest = Js.ospread(req, Js.O({ replies = A.map(req.replies, function(r)
			return (if (r.club == club) then Js.ospread(r, Js.O({ yes = false, reason = "talks", message = "Talks broke down. We've moved on.", offer = nil, role = nil }, { "yes", "reason", "message", "offer", "role" })) else r)
		end), refused = Js.ospread(req.refused, (function() local _o = Js.O({}, nil); _o[Js.key(club)] = (now + REFUSAL_COOLDOWN_WEEKS); return _o end)()) }, { "replies", "refused" })) }, { "transferRequest" })) end
	end
	exports.talksFailed = talksFailed
	callOffMove = function(career)
		local req = requestOf(career)
		if (not req.agreed) then
			do return career end
		end
		do return Js.ospread(career, Js.O({ transferRequest = Js.ospread(req, Js.O({ agreed = nil }, { "agreed" })) }, { "transferRequest" })) end
	end
	exports.callOffMove = callOffMove
	clearAfterWindow = function(career)
		if (not career.transferRequest) then
			do return career end
		end
		do return Js.ospread(career, Js.O({ transferRequest = Js.ospread(career.transferRequest, Js.O({ agreed = nil, replies = Js.alit() }, { "agreed", "replies" })) }, { "transferRequest" })) end
	end
	exports.clearAfterWindow = clearAfterWindow
	bonusOfferCount = function(career)
		local rep = M_transfers.reputation(career)
		do return (if (rep >= 75) then 2 else (if (rep >= 55) then 1 else 0)) end
	end
	exports.bonusOfferCount = bonusOfferCount
	bonusSummerOffers = function(career, rng, taken)
		if taken == nil then taken = Js.alit() end
		local n = bonusOfferCount(career)
		if (n == 0) then
			do return Js.alit() end
		end
		local own = M_calendar.divisionOf(career)
		local above = M_calendar.divisionAbove(own)
		local pool = A.filter(Js.aspread((if Js.T(above) then A.map(clubsIn(career, above), function(c)
			return Js.O({ club = c.club, division = above }, { "club", "division" })
		end) else Js.alit()), A.map(clubsIn(career, own), function(c)
			return Js.O({ club = c.club, division = own }, { "club", "division" })
		end)), function(c)
			return (not A.includes(taken, c.club))
		end)
		local yes = A.slice(A.sort(A.filter(A.map(pool, function(c)
			return judgeClub(career, c.club, c.division, rng)
		end), function(r)
			return (r.yes and r.offer)
		end), function(a, b)
			return (function() local _l = (Js.Number((b.division ~= own)) - Js.Number((a.division ~= own))); if Js.T(_l) then return _l end; return (b.strength - a.strength) end)()
		end), 0, n)
		do return A.map(yes, function(r)
			return Js.ospread(r.offer, Js.O({ division = (if (r.division == own) then nil else r.division), pitch = (r.club .. " have watched your season. " .. r.message) }, { "division", "pitch" }))
		end) end
	end
	exports.bonusSummerOffers = bonusSummerOffers
	summerWindowOffers = function(career, ordinary, rng)
		local agreed = requestOf(career).agreed
		local first = (if (agreed and (agreed.club ~= career.player.club)) then Js.alit(Js.ospread(agreed, Js.O({ pitch = "The move you asked for. Terms agreed." }, { "pitch" }))) else Js.alit())
		local base = Js.aspread(first, ordinary)
		local seen = Js.Set.new()
		local unique = A.filter(base, function(o)
			return (if seen:has(o.club) then false else (function() local _ = seen:add(o.club); return true end)())
		end)
		local extra = bonusSummerOffers(career, rng, Js.aspread(Js.Array.from(seen), Js.alit(career.player.club)))
		do return Js.aspread(unique, extra) end
	end
	exports.summerWindowOffers = summerWindowOffers
	YES_LINE = -4
	exports.YES_LINE = YES_LINE
	ADJUST_CAP = 8
	exports.ADJUST_CAP = ADJUST_CAP
	CROWDED_PENALTY = 6
	exports.CROWDED_PENALTY = CROWDED_PENALTY
	NEED_BONUS = 3
	exports.NEED_BONUS = NEED_BONUS
	CROWDED_AT = 3
	exports.CROWDED_AT = CROWDED_AT
	ASK_LEAGUE_BOSS_COST = 8
	exports.ASK_LEAGUE_BOSS_COST = ASK_LEAGUE_BOSS_COST
	ASK_CLUB_BOSS_COST = 4
	exports.ASK_CLUB_BOSS_COST = ASK_CLUB_BOSS_COST
	REFUSAL_COOLDOWN_WEEKS = 6
	exports.REFUSAL_COOLDOWN_WEEKS = REFUSAL_COOLDOWN_WEEKS
	NOT_LOOKING_CHANCE = 0.25
	exports.NOT_LOOKING_CHANCE = NOT_LOOKING_CHANCE
	AFFORD_SHARE = 0.35
	exports.AFFORD_SHARE = AFFORD_SHARE
	MEMBERSHIP_KEY = Js.O({ premier = "premier", championship = "championship", league_one = "leagueOne", league_two = "leagueTwo", national_league = "nationalLeague", national_league_north = "nationalLeagueNorth", national_league_south = "nationalLeagueSouth" }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
	ASKABLE_LEAGUES = M_calendar.ALL_DIVISIONS
	exports.ASKABLE_LEAGUES = ASKABLE_LEAGUES
	GROUP_WORD = Js.O({ GK = "keepers", DEF = "defenders", MID = "midfielders", WIDE = "wingers", ATT = "strikers" }, { "GK", "DEF", "MID", "WIDE", "ATT" })
	NUMBER_WORD = Js.alit("no", "one", "two", "three", "four", "five", "six", "seven", "eight")
	ROLE_PITCH = Js.O({ ["Star man"] = "You'd be the player we build around.", ["First team"] = "You'd start most weeks.", Rotation = "You'd be in the rotation and play your way in.", ["Squad player"] = "You'd have to fight for a place." }, { "Star man", "First team", "Rotation", "Squad player" })
end
