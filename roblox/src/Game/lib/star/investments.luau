--!nocheck
--!nolint
-- Generated from lib/star/investments.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_euro = import("lib/star/euro")
	local M_footballClubDatabase = import("lib/star/data/footballClubDatabase")
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local M_marketValue = import("lib/star/marketValue")
	local M_clubTier = import("lib/star/clubTier")
	local M_calendar = import("lib/star/calendar")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_voting = import("lib/star/voting")
	local M_reputation = import("lib/star/reputation")
	local M_money = import("lib/star/money")
	local M_managerPool = import("lib/star/managerPool")
	local M_lineupStore = import("lib/star/lineupStore")
	local M_manager = import("lib/star/manager")
	local allInvestableClubs, strengthOf, VALUATION_SCALE, PRESTIGE_FLOOR, PRESTIGE_CEILING, realPrestigeFactor, squadMarketValueSum, clubValuation, MAJORITY_THRESHOLD, stakeIn, isTransferWindowOpen, isMajorityOwner, canInvestIn, buyStake, sellStake, ownedClubState, CLUB_TRANSFER_HISTORY_LIMIT, recordClubTransfer, topUpClubBudget, clubStrengthFromPlayers, transferFee, findSquadEntry, setSquad, signPlayerForOwnedClub, sellPlayerFromOwnedClub, SHAREHOLDER_ELECTORATE, canOverruleClubVote, proposeSellPlayerVote, resolveSellPlayerVote, managerCurrentClub, recordFailedManagerNegotiation, replaceManagerForOwnedClub
	allInvestableClubs = function()
		do return A.sort(Js.Array.from(Js.Set.new(Js.aspread(M_clubs.PREMIER_LEAGUE_CLUBS, M_clubs.CHAMPIONSHIP_CLUBS, M_clubs.PROMOTION_POOL_CLUBS, M_clubs.OTHER_CLUBS, M_clubs.CHAMPIONS_LEAGUE_CLUBS, M_clubs.EUROPA_LEAGUE_CLUBS))), function(a, b)
			return S.localeCompare(a, b)
		end) end
	end
	exports.allInvestableClubs = allInvestableClubs
	strengthOf = function(club, career)
		local inLeague = A.find(career.league, function(t)
			return (t.name == club)
		end)
		if inLeague then
			do return inLeague.strength end
		end
		do
			local _arr1 = Js.alit("Champions League", "Europa League", "Conference League")
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local comp = _arr1[_i2]
				local found = A.find(M_euro.poolFor(comp, career), function(c)
					return (c.name == club)
				end)
				if found then
					do return found.strength end
				end
			end
		end
		do return 68 end
	end
	realPrestigeFactor = function(club)
		local rating = ((function() local _v = M_footballClubDatabase.CLUB_DATABASE[club]; if _v == nil then return nil end; _v = _v.currentReputation; return _v end)() or (function() local _v = M_clubProfiles.profileOf(club); if _v == nil then return nil end; _v = _v.currentRep; return _v end)())
		if (rating == nil) then
			do return 1 end
		end
		do return (PRESTIGE_FLOOR + (((rating - 1) / 9) * (PRESTIGE_CEILING - PRESTIGE_FLOOR))) end
	end
	exports.realPrestigeFactor = realPrestigeFactor
	squadMarketValueSum = function(club, career)
		if (club == career.player.club) then
			do return A.reduce((if career.squad ~= nil then career.squad else Js.alit()), function(sum, p)
				return (sum + M_marketValue.playerMarketValue(Js.ospread(p, Js.O({ overall = (if p.overall ~= nil then p.overall else 65) }, { "overall" })), club, career))
			end, 0) end
		end
		local entry = findSquadEntry(career, club)
		if (not entry) then
			do return 0 end
		end
		do return A.reduce(entry.squad.players, function(sum, p)
			return (sum + M_marketValue.playerMarketValue(p, club, career))
		end, 0) end
	end
	clubValuation = function(club, career)
		local strength = strengthOf(club, career)
		local tier = M_clubTier.tierOf(club, career)
		local intangible = ((Math.pow(Math.max(1, (strength - 40)), 1.9) * M_clubTier.TIER_MULTIPLIER[tier]) * VALUATION_SCALE)
		local momentum = 1
		local w = career.lastSeasonWinners
		if ((function() local _v = w; if _v == nil then return nil end; _v = _v.championsLeague; return _v end)() == club) then
			momentum *= 1.3
		elseif ((function() local _v = w; if _v == nil then return nil end; _v = _v.europaLeague; return _v end)() == club) then
			momentum *= 1.18
		end
		if ((function() local _v = w; if _v == nil then return nil end; _v = _v.league; return _v end)() == club) then
			momentum *= 1.15
		end
		if (((function() local _v = w; if _v == nil then return nil end; _v = _v.faCup; return _v end)() == club) or ((function() local _v = w; if _v == nil then return nil end; _v = _v.leagueCup; return _v end)() == club)) then
			momentum *= 1.05
		end
		local squadValue = squadMarketValueSum(club, career)
		local budget = ownedClubState(career, club).budget
		local prestige = realPrestigeFactor(club)
		do return Math.max(5000000, Math.round(((((intangible * momentum) + squadValue) + budget) * prestige))) end
	end
	exports.clubValuation = clubValuation
	stakeIn = function(career, club)
		do return A.find((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return (i.club == club)
		end) end
	end
	exports.stakeIn = stakeIn
	isTransferWindowOpen = function(career)
		do return M_calendar.transferWindowOpen(career.player.startYear, career.season, career.week, M_calendar.divisionOf(career)) end
	end
	isMajorityOwner = function(career, club)
		do return (((function() local _v = stakeIn(career, club); if _v == nil then return nil end; _v = _v.percent; return _v end)() or 0) >= MAJORITY_THRESHOLD) end
	end
	exports.isMajorityOwner = isMajorityOwner
	canInvestIn = function(_career, _club)
		do return true end
	end
	exports.canInvestIn = canInvestIn
	buyStake = function(career, club, percent)
		if ((percent <= 0) or (not canInvestIn(career, club))) then
			do return career end
		end
		local existing = stakeIn(career, club)
		local room = Math.max(0, (100 - ((function() local _v = existing; if _v == nil then return nil end; _v = _v.percent; return _v end)() or 0)))
		percent = Math.min(percent, room)
		if (percent <= 0) then
			do return career end
		end
		local valuation = clubValuation(club, career)
		local cost = Math.round((valuation * (percent / 100)))
		if ((cost <= 0) or (cost > career.money)) then
			do return career end
		end
		local merged = (if existing then Js.O({ club = club, percent = (existing.percent + percent), avgBuyValuation = (((existing.avgBuyValuation * existing.percent) + (valuation * percent)) / (existing.percent + percent)) }, { "club", "percent", "avgBuyValuation" }) else Js.O({ club = club, percent = percent, avgBuyValuation = valuation }, { "club", "percent", "avgBuyValuation" }))
		local investments = (if existing then A.map((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return (if (i.club == club) then merged else i)
		end) else Js.aspread((if career.investments ~= nil then career.investments else Js.alit()), Js.alit(merged)))
		do return Js.ospread(career, Js.O({ money = (career.money - cost), investments = investments }, { "money", "investments" })) end
	end
	exports.buyStake = buyStake
	sellStake = function(career, club, percent)
		local existing = stakeIn(career, club)
		if (((not existing) or (percent <= 0)) or (percent > (existing.percent + 1e-9))) then
			do return career end
		end
		local valuation = clubValuation(club, career)
		local proceeds = Math.round((valuation * (percent / 100)))
		local remaining = (existing.percent - percent)
		local investments = (if (remaining > 0.000001) then A.map((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return (if (i.club == club) then Js.ospread(i, Js.O({ percent = remaining }, { "percent" })) else i)
		end) else A.filter((if career.investments ~= nil then career.investments else Js.alit()), function(i)
			return (i.club ~= club)
		end))
		do return Js.ospread(career, Js.O({ money = (career.money + proceeds), investments = investments }, { "money", "investments" })) end
	end
	exports.sellStake = sellStake
	ownedClubState = function(career, club)
		do return ((function() local _v = career.ownedClubs; if _v == nil then return nil end; _v = _v[club]; return _v end)() or Js.O({ budget = 0 }, { "budget" })) end
	end
	exports.ownedClubState = ownedClubState
	recordClubTransfer = function(career, club, record)
		local existing = ((function() local _v = career.clubTransferHistory; if _v == nil then return nil end; _v = _v[club]; return _v end)() or Js.alit())
		do return Js.ospread(career, Js.O({ clubTransferHistory = Js.ospread((if career.clubTransferHistory ~= nil then career.clubTransferHistory else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = A.slice(Js.aspread(Js.alit(record), existing), 0, CLUB_TRANSFER_HISTORY_LIMIT); return _o end)()) }, { "clubTransferHistory" })) end
	end
	topUpClubBudget = function(career, club, amount)
		if (((not isMajorityOwner(career, club)) or (amount <= 0)) or (amount > career.money)) then
			do return career end
		end
		local current = ownedClubState(career, club)
		do return Js.ospread(career, Js.O({ money = (career.money - amount), ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ budget = (current.budget + amount) }, { "budget" })); return _o end)()) }, { "money", "ownedClubs" })) end
	end
	exports.topUpClubBudget = topUpClubBudget
	clubStrengthFromPlayers = function(players)
		local xi = A.slice(A.sort(Js.aspread(players), function(a, b)
			return (b.overall - a.overall)
		end), 0, 11)
		if (not Js.T(Js.alen(xi))) then
			do return 65 end
		end
		do return Math.round((A.reduce(xi, function(s, p)
			return (s + p.overall)
		end, 0) / Js.alen(xi))) end
	end
	exports.clubStrengthFromPlayers = clubStrengthFromPlayers
	transferFee = function(overall)
		local m = Math.max(0, (overall - 60))
		do return (Math.round(((M_tuningStore.getTuning("transfers.feeBase") + ((m * m) * M_tuningStore.getTuning("transfers.feeQuadratic"))) * 10)) / 10) end
	end
	exports.transferFee = transferFee
	findSquadEntry = function(career, club)
		local inLeague = A.find((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == club)
		end)
		if inLeague then
			do return Js.O({ squad = inLeague, where = "league" }, { "squad", "where" }) end
		end
		local inExternal = A.find((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
			return (s.club == club)
		end)
		if inExternal then
			do return Js.O({ squad = inExternal, where = "external" }, { "squad", "where" }) end
		end
		do return nil end
	end
	exports.findSquadEntry = findSquadEntry
	setSquad = function(career, club, players)
		local existing = findSquadEntry(career, club)
		local where = ((function() local _v = existing; if _v == nil then return nil end; _v = _v.where; return _v end)() or (if A.some(career.league, function(t)
			return (t.name == club)
		end) then "league" else "external"))
		if (where == "external") then
			local exists = A.some((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
				return (s.club == club)
			end)
			local externalSquads = (if exists then A.map((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), function(s)
				return (if (s.club == club) then Js.ospread(s, Js.O({ players = players }, { "players" })) else s)
			end) else Js.aspread((if career.externalSquads ~= nil then career.externalSquads else Js.alit()), Js.alit(Js.O({ club = club, players = players }, { "club", "players" }))))
			do return Js.ospread(career, Js.O({ externalSquads = externalSquads }, { "externalSquads" })) end
		end
		local exists = A.some((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (s.club == club)
		end)
		local leagueSquads = (if exists then A.map((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(s)
			return (if (s.club == club) then Js.ospread(s, Js.O({ players = players }, { "players" })) else s)
		end) else Js.aspread((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), Js.alit(Js.O({ club = club, players = players }, { "club", "players" }))))
		local league = A.map(career.league, function(t)
			return (if (t.name == club) then Js.ospread(t, Js.O({ strength = clubStrengthFromPlayers(players) }, { "strength" })) else t)
		end)
		do return Js.ospread(career, Js.O({ leagueSquads = leagueSquads, league = league }, { "leagueSquads", "league" })) end
	end
	exports.setSquad = setSquad
	signPlayerForOwnedClub = function(career, club, playerId, fromClub, agreedFee)
		if (not isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		if (not isTransferWindowOpen(career)) then
			do return Js.O({ career = career, ok = false, reason = "Transfers only happen during a transfer window" }, { "career", "ok", "reason" }) end
		end
		local budget = ownedClubState(career, club).budget
		local player = nil
		local fee = 0
		local next_ = career
		if (fromClub == M_leagueSquads.FREE_AGENTS_CLUB) then
			local idx = A.findIndex((if career.freeAgents ~= nil then career.freeAgents else Js.alit()), function(p)
				return (p.id == playerId)
			end)
			if (idx < 0) then
				do return Js.O({ career = career, ok = false, reason = "That player isn't available" }, { "career", "ok", "reason" }) end
			end
			player = career.freeAgents[idx + 1]
			next_ = Js.ospread(career, Js.O({ freeAgents = A.filter(career.freeAgents, function(_, i)
				return (i ~= idx)
			end) }, { "freeAgents" }))
		else
			local sellerEntry = findSquadEntry(career, fromClub)
			local idx = ((function() local _r = (function() local _v = sellerEntry; if _v == nil then return nil end; _v = _v.squad; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.findIndex(_r, function(p)
				return (p.id == playerId)
			end) end)() or -1)
			if ((not sellerEntry) or (idx < 0)) then
				do return Js.O({ career = career, ok = false, reason = "That player isn't available" }, { "career", "ok", "reason" }) end
			end
			player = sellerEntry.squad.players[idx + 1]
			fee = (if agreedFee ~= nil then agreedFee else transferFee(player.overall))
			if (fee > budget) then
				do return Js.O({ career = career, ok = false, reason = "Not enough in the transfer budget" }, { "career", "ok", "reason" }) end
			end
			next_ = setSquad(next_, fromClub, A.filter(sellerEntry.squad.players, function(_, i)
				return (i ~= idx)
			end))
		end
		if (not player) then
			do return Js.O({ career = career, ok = false, reason = "That player isn't available" }, { "career", "ok", "reason" }) end
		end
		local buyerPlayers = Js.aspread(((function() local _v = findSquadEntry(next_, club); if _v == nil then return nil end; _v = _v.squad; _v = _v.players; return _v end)() or Js.alit()), Js.alit(player))
		next_ = setSquad(next_, club, buyerPlayers)
		next_ = Js.ospread(next_, Js.O({ ownedClubs = Js.ospread((if next_.ownedClubs ~= nil then next_.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(ownedClubState(next_, club), Js.O({ budget = (budget - fee) }, { "budget" })); return _o end)()) }, { "ownedClubs" }))
		next_ = recordClubTransfer(next_, club, Js.O({ season = next_.season, direction = "in", playerName = player.name, otherClub = (if (fromClub == M_leagueSquads.FREE_AGENTS_CLUB) then "Free Agent" else fromClub), fee = fee }, { "season", "direction", "playerName", "otherClub", "fee" }))
		do return Js.O({ career = next_, ok = true }, { "career", "ok" }) end
	end
	exports.signPlayerForOwnedClub = signPlayerForOwnedClub
	sellPlayerFromOwnedClub = function(career, club, playerId, agreedFee, buyerClub)
		if (not isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		if (not isTransferWindowOpen(career)) then
			do return Js.O({ career = career, ok = false, reason = "Transfers only happen during a transfer window" }, { "career", "ok", "reason" }) end
		end
		local entry = findSquadEntry(career, club)
		local squad = (function() local _v = entry; if _v == nil then return nil end; _v = _v.squad; return _v end)()
		local idx = ((function() local _r = (function() local _v = squad; if _v == nil then return nil end; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.findIndex(_r, function(p)
			return (p.id == playerId)
		end) end)() or -1)
		if ((not squad) or (idx < 0)) then
			do return Js.O({ career = career, ok = false, reason = "That player isn't in the squad" }, { "career", "ok", "reason" }) end
		end
		if (Js.alen(squad.players) <= M_tuningStore.getTuning("transfers.minSquadSize")) then
			do return Js.O({ career = career, ok = false, reason = "The squad is already too thin to sell from" }, { "career", "ok", "reason" }) end
		end
		local player = squad.players[idx + 1]
		local fee = (if agreedFee ~= nil then agreedFee else transferFee(player.overall))
		local next_ = setSquad(career, club, A.filter(squad.players, function(_, i)
			return (i ~= idx)
		end))
		if Js.T(buyerClub) then
			local buyerPlayers = Js.aspread(((function() local _v = findSquadEntry(next_, buyerClub); if _v == nil then return nil end; _v = _v.squad; _v = _v.players; return _v end)() or Js.alit()), Js.alit(player))
			next_ = setSquad(next_, buyerClub, buyerPlayers)
		end
		local current = ownedClubState(next_, club)
		next_ = Js.ospread(next_, Js.O({ ownedClubs = Js.ospread((if next_.ownedClubs ~= nil then next_.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ budget = (current.budget + fee) }, { "budget" })); return _o end)()) }, { "ownedClubs" }))
		next_ = recordClubTransfer(next_, club, Js.O({ season = next_.season, direction = "out", playerName = player.name, otherClub = (if buyerClub ~= nil then buyerClub else "Unknown"), fee = fee }, { "season", "direction", "playerName", "otherClub", "fee" }))
		do return Js.O({ career = next_, ok = true }, { "career", "ok" }) end
	end
	exports.sellPlayerFromOwnedClub = sellPlayerFromOwnedClub
	canOverruleClubVote = function(career, club)
		do return (((function() local _v = stakeIn(career, club); if _v == nil then return nil end; _v = _v.percent; return _v end)() or 0) >= M_voting.OVERRULE_OWNERSHIP_THRESHOLD) end
	end
	exports.canOverruleClubVote = canOverruleClubVote
	proposeSellPlayerVote = function(career, club, playerId, rng, agreedFee, buyerClub)
		if (not isMajorityOwner(career, club)) then
			do return Js.O({ ok = false, reason = "Not the majority shareholder" }, { "ok", "reason" }) end
		end
		if (not isTransferWindowOpen(career)) then
			do return Js.O({ ok = false, reason = "Transfers only happen during a transfer window" }, { "ok", "reason" }) end
		end
		local entry = findSquadEntry(career, club)
		local squad = (function() local _v = entry; if _v == nil then return nil end; _v = _v.squad; return _v end)()
		local idx = ((function() local _r = (function() local _v = squad; if _v == nil then return nil end; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.findIndex(_r, function(p)
			return (p.id == playerId)
		end) end)() or -1)
		if ((not squad) or (idx < 0)) then
			do return Js.O({ ok = false, reason = "That player isn't in the squad" }, { "ok", "reason" }) end
		end
		if (Js.alen(squad.players) <= M_tuningStore.getTuning("transfers.minSquadSize")) then
			do return Js.O({ ok = false, reason = "The squad is already too thin to sell from" }, { "ok", "reason" }) end
		end
		local player = squad.players[idx + 1]
		local fee = (if agreedFee ~= nil then agreedFee else transferFee(player.overall))
		local biasStrength = M_reputation.reputationVoteBias(career.reputation)
		local tally = M_voting.castVote(("Sell " .. player.name .. " for £" .. M_money.formatMoney(fee) .. "?"), Js.alit(Js.O({ id = "yes", label = "Sell" }, { "id", "label" }), Js.O({ id = "no", label = "Keep" }, { "id", "label" })), SHAREHOLDER_ELECTORATE, "yes", biasStrength, rng)
		do return Js.O({ ok = true, proposal = Js.O({ club = club, playerId = playerId, playerName = player.name, fee = fee, tally = tally, buyerClub = buyerClub }, { "club", "playerId", "playerName", "fee", "tally", "buyerClub" }) }, { "ok", "proposal" }) end
	end
	exports.proposeSellPlayerVote = proposeSellPlayerVote
	resolveSellPlayerVote = function(career, proposal, overrule)
		local next_ = Js.ospread(career, Js.O({ reputation = M_voting.applyVoteHeldReputation(career.reputation) }, { "reputation" }))
		local passed = (proposal.tally.winner == "yes")
		if ((not passed) and overrule) then
			if (not canOverruleClubVote(next_, proposal.club)) then
				do return Js.O({ career = next_, ok = false, reason = "Not enough ownership to overrule this vote" }, { "career", "ok", "reason" }) end
			end
			next_ = Js.ospread(next_, Js.O({ reputation = M_voting.applyOverruleReputationCost(next_.reputation) }, { "reputation" }))
		elseif (not passed) then
			do return Js.O({ career = next_, ok = false, reason = "The shareholders voted to keep him" }, { "career", "ok", "reason" }) end
		end
		local sale = sellPlayerFromOwnedClub(next_, proposal.club, proposal.playerId, proposal.fee, proposal.buyerClub)
		do return (if sale.ok then sale else Js.O({ career = next_, ok = false, reason = sale.reason }, { "career", "ok", "reason" })) end
	end
	exports.resolveSellPlayerVote = resolveSellPlayerVote
	managerCurrentClub = function(career, name)
		if ((function() local _v = career.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() == name) then
			do return career.player.club end
		end
		do
			local _arr3 = Js.Object.entries((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)))
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local _e5 = _arr3[_i4]
				local c = _e5[1]
				local state = _e5[2]
				if (state.managerName == name) then
					do return c end
				end
			end
		end
		do return nil end
	end
	exports.managerCurrentClub = managerCurrentClub
	recordFailedManagerNegotiation = function(career, club, managerName)
		do return Js.ospread(career, Js.O({ managerNegotiationCooldowns = Js.ospread((if career.managerNegotiationCooldowns ~= nil then career.managerNegotiationCooldowns else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(M_managerPool.managerCooldownKey(club, managerName))] = (career.season + 1); return _o end)()) }, { "managerNegotiationCooldowns" })) end
	end
	exports.recordFailedManagerNegotiation = recordFailedManagerNegotiation
	replaceManagerForOwnedClub = function(career, club, managerName, agreedFee)
		if (not isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		local takenAt = managerCurrentClub(career, managerName)
		if (Js.T(takenAt) and (takenAt ~= club)) then
			do return Js.O({ career = career, ok = false, reason = (managerName .. " already manages " .. takenAt) }, { "career", "ok", "reason" }) end
		end
		local current = ownedClubState(career, club)
		local fee = (if agreedFee ~= nil then agreedFee else M_managerPool.managerBaseFee(managerName))
		if (fee > current.budget) then
			do return Js.O({ career = career, ok = false, reason = "Not enough in the budget for that appointment" }, { "career", "ok", "reason" }) end
		end
		local isOwnClub = (club == career.player.club)
		local outgoingName = (if isOwnClub then (function() local _v = career.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() else (if current.managerName ~= nil then current.managerName else (function() local _l = (function() local _v = M_lineupStore.loadLineup(club); if _v == nil then return nil end; _v = _v.manager; return _v end)(); if Js.T(_l) then return _l end; return nil end)()))
		local availableManagers = (if career.availableManagers ~= nil then career.availableManagers else M_managerPool.allPoolManagers())
		availableManagers = A.filter(availableManagers, function(n)
			return (n ~= managerName)
		end)
		if (((Js.T(outgoingName) and (outgoingName ~= managerName)) and (M_managerPool.managerTier(outgoingName) ~= nil)) and (not A.includes(availableManagers, outgoingName))) then
			availableManagers = Js.aspread(availableManagers, Js.alit(outgoingName))
		end
		if isOwnClub then
			local tier = M_managerPool.managerTier(managerName)
			local rng = M_managerPool.managerRng(career, club, career.season)
			local styleRoll = rng()
			local style = (if (styleRoll < 0.38) then "trusting" else (if (styleRoll < 0.72) then "demanding" else "rotational"))
			local range = (if (tier ~= nil) then M_managerPool.TIER_REPUTATION_RANGE[Js.key(tier)] else Js.O({ min = 20, max = 60 }, { "min", "max" }))
			local reputation = Math.round((range.min + (rng() * (range.max - range.min))))
			local manager = Js.O({ name = managerName, style = style, since = career.season, arrival = M_manager.styleBlurb(style), reputation = reputation, poolTier = tier }, { "name", "style", "since", "arrival", "reputation", "poolTier" })
			local next_ = Js.ospread(career, Js.O({ manager = manager, availableManagers = availableManagers, relationships = Js.ospread(career.relationships, Js.O({ boss = M_manager.bossOnArrival(career) }, { "boss" })), ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ budget = (current.budget - fee) }, { "budget" })); return _o end)()) }, { "manager", "availableManagers", "relationships", "ownedClubs" }))
			do return Js.O({ career = next_, ok = true }, { "career", "ok" }) end
		end
		do return Js.O({ career = Js.ospread(career, Js.O({ availableManagers = availableManagers, ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ budget = (current.budget - fee), managerName = managerName, managerSince = career.season }, { "budget", "managerName", "managerSince" })); return _o end)()) }, { "availableManagers", "ownedClubs" })), ok = true }, { "career", "ok" }) end
	end
	exports.replaceManagerForOwnedClub = replaceManagerForOwnedClub
	Js.reexport(exports, M_clubTier, { ["tierOf"] = "tierOf", ["TIER_MULTIPLIER"] = "TIER_MULTIPLIER" })
	VALUATION_SCALE = 140000
	PRESTIGE_FLOOR = 0.6
	PRESTIGE_CEILING = 3
	MAJORITY_THRESHOLD = 50.1
	exports.MAJORITY_THRESHOLD = MAJORITY_THRESHOLD
	CLUB_TRANSFER_HISTORY_LIMIT = 200
	SHAREHOLDER_ELECTORATE = 640
end
