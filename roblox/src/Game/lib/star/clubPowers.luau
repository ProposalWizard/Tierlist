--!nocheck
--!nolint
-- Generated from lib/star/clubPowers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_investments = import("lib/star/investments")
	local M_reputation = import("lib/star/reputation")
	local M_formations = import("lib/star/formations")
	local M_voting = import("lib/star/voting")
	local M_economy = import("lib/star/economy")
	local M_careerFlow = import("lib/star/careerFlow")
	local M_tuningStore = import("lib/star/tuningStore")
	local RECOMMENDATION_HISTORY_CAP, submitRecommendation, considerRecommendations, setClubFormation, setOwnedLineup, pickedXIFitness, clubStrengthWithFormation, FAN_ELECTORATE, KIT_VOTE_FAN_GAIN, clubKitFor, setClubKit, proposeKitVote, resolveKitVote, PRESIDENT_ELECTORATE, proposePresidentVote, resolvePresidentVote, setPresidentWage, payPresidentWages, SON_COST_UNIT_WEEKS, HAVE_A_SON_COST, SON_START_AGE, SON_START_OVERALL, SON_MIN_PROMOTION_AGE, SON_OVERALL_CAP, haveASon, ageUpSonWithPotion, promoteSonToFirstTeam, transferSon, appointSelfCaptain, setTalisman, transferSelfTo, canMergeClubs, MERGER_FAN_COST, mergeClubs
	submitRecommendation = function(career, club, kind, detail)
		if (not M_investments.stakeIn(career, club)) then
			do return Js.O({ ok = false, reason = "You don't hold a stake in this club" }, { "ok", "reason" }) end
		end
		if M_investments.isMajorityOwner(career, club) then
			do return Js.O({ ok = false, reason = "A majority owner acts directly, not by recommendation" }, { "ok", "reason" }) end
		end
		local rec = Js.O({ id = (club .. ":" .. kind .. ":" .. Js.numstr(career.season) .. ":" .. Js.numstr(Js.alen((if career.recommendations ~= nil then career.recommendations else Js.alit())))), club = club, kind = kind, detail = detail, season = career.season, status = "pending" }, { "id", "club", "kind", "detail", "season", "status" })
		local kept = A.slice(Js.aspread((if career.recommendations ~= nil then career.recommendations else Js.alit()), Js.alit(rec)), (-RECOMMENDATION_HISTORY_CAP))
		do return Js.ospread(career, Js.O({ recommendations = kept }, { "recommendations" })) end
	end
	exports.submitRecommendation = submitRecommendation
	considerRecommendations = function(career, rng)
		local pending = A.filter((if career.recommendations ~= nil then career.recommendations else Js.alit()), function(r)
			return (r.status == "pending")
		end)
		if (Js.alen(pending) == 0) then
			do return career end
		end
		local swing = ((career.reputation - 50) / 100)
		local base = (if (career.reputation >= M_reputation.REPUTATION_RECOMMEND_MIN) then 0.35 else 0.08)
		local chance = Math.max(0.05, Math.min(0.8, (base + (swing * 0.6))))
		local reputation = career.reputation
		local byId = Js.Map.new(A.map(pending, function(r)
			return Js.alit(r.id, r)
		end))
		do
			local _arr1 = pending
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				local adopted = (rng() < chance)
				byId:set(r.id, Js.ospread(r, Js.O({ status = (if adopted then "adopted" else "dismissed") }, { "status" })))
				if adopted then
					reputation = M_reputation.clampReputation((reputation + M_reputation.REPUTATION_EVENTS.recommendationAdopted))
				end
			end
		end
		local recommendations = A.map((if career.recommendations ~= nil then career.recommendations else Js.alit()), function(r)
			return (byId:get(r.id) or r)
		end)
		do return Js.ospread(career, Js.O({ recommendations = recommendations, reputation = reputation }, { "recommendations", "reputation" })) end
	end
	exports.considerRecommendations = considerRecommendations
	setClubFormation = function(career, club, formationId)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		if (not A.some(M_formations.FORMATIONS, function(f)
			return (f.id == formationId)
		end)) then
			do return Js.O({ career = career, ok = false, reason = "Not a real formation" }, { "career", "ok", "reason" }) end
		end
		local current = M_investments.ownedClubState(career, club)
		do return Js.O({ career = Js.ospread(career, Js.O({ ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ formation = formationId }, { "formation" })); return _o end)()) }, { "ownedClubs" })), ok = true }, { "career", "ok" }) end
	end
	exports.setClubFormation = setClubFormation
	setOwnedLineup = function(career, club, lineup)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		if (not A.some(M_formations.FORMATIONS, function(f)
			return (f.id == lineup.formation)
		end)) then
			do return Js.O({ career = career, ok = false, reason = "Not a real formation" }, { "career", "ok", "reason" }) end
		end
		local known = Js.Set.new(A.map(((function() local _v = M_investments.findSquadEntry(career, club); if _v == nil then return nil end; _v = _v.squad; _v = _v.players; return _v end)() or Js.alit()), function(p)
			return p.id
		end))
		local xi = A.map(lineup.xi, function(id)
			return (if (Js.T(id) and known:has(id)) then id else nil)
		end)
		local bench = A.filter((if lineup.bench ~= nil then lineup.bench else Js.alit()), function(id)
			return known:has(id)
		end)
		do return Js.O({ career = Js.ospread(career, Js.O({ ownedLineups = Js.ospread((if career.ownedLineups ~= nil then career.ownedLineups else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.O({ formation = lineup.formation, xi = xi, bench = bench, manager = lineup.manager }, { "formation", "xi", "bench", "manager" }); return _o end)()) }, { "ownedLineups" })), ok = true }, { "career", "ok" }) end
	end
	exports.setOwnedLineup = setOwnedLineup
	pickedXIFitness = function(players, formationId)
		local formation = M_formations.formationOf(formationId)
		local picks = M_formations.autoPick(players, formation)
		local byId = Js.Map.new(A.map(players, function(p)
			return Js.alit(p.id, p)
		end))
		local fits = Js.alit()
		A.forEach(formation.slots, function(slot, i)
			local id = picks[i + 1]
			local p = (if Js.T(id) then byId:get(id) else nil)
			if p then
				A.push(fits, M_formations.bestFitness(slot.role, p))
			end
		end)
		do return (if Js.T(Js.alen(fits)) then (A.reduce(fits, function(a, b)
			return (a + b)
		end, 0) / Js.alen(fits)) else 74) end
	end
	clubStrengthWithFormation = function(career, club)
		local entry = M_investments.findSquadEntry(career, club)
		if (not entry) then
			do return M_investments.clubStrengthFromPlayers(Js.alit()) end
		end
		local base = M_investments.clubStrengthFromPlayers(entry.squad.players)
		local formationId = (M_investments.ownedClubState(career, club).formation or M_formations.DEFAULT_FORMATION)
		local fit = pickedXIFitness(entry.squad.players, formationId)
		local bonus = Math.max(-3, Math.min(3, Math.round(((fit - 74) / 6))))
		do return (base + bonus) end
	end
	exports.clubStrengthWithFormation = clubStrengthWithFormation
	clubKitFor = function(career, club)
		do return ((function() local _v = career.clubKits; if _v == nil then return nil end; _v = _v[club]; return _v end)() or nil) end
	end
	exports.clubKitFor = clubKitFor
	setClubKit = function(career, club, kit)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = Js.ospread(career, Js.O({ clubKits = Js.ospread((if career.clubKits ~= nil then career.clubKits else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = kit; return _o end)()) }, { "clubKits" })), ok = true }, { "career", "ok" }) end
	end
	exports.setClubKit = setClubKit
	proposeKitVote = function(career, club, optionA, optionB, favor, rng)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ ok = false, reason = "Not the majority shareholder" }, { "ok", "reason" }) end
		end
		local biasStrength = (if Js.T(favor) then ((career.relationships.fans - 50) / 50) else 0)
		local favoredId = (if (favor == "a") then "a" else (if (favor == "b") then "b" else nil))
		local tally = M_voting.castVote("Which kit should we wear next season?", Js.alit(Js.O({ id = "a", label = "Design A" }, { "id", "label" }), Js.O({ id = "b", label = "Design B" }, { "id", "label" })), FAN_ELECTORATE, favoredId, biasStrength, rng)
		do return Js.O({ ok = true, proposal = Js.O({ club = club, optionA = optionA, optionB = optionB, tally = tally, favor = favor }, { "club", "optionA", "optionB", "tally", "favor" }) }, { "ok", "proposal" }) end
	end
	exports.proposeKitVote = proposeKitVote
	resolveKitVote = function(career, proposal)
		local kit = (if (proposal.tally.winner == "a") then proposal.optionA else proposal.optionB)
		do return Js.ospread(career, Js.O({ clubKits = Js.ospread((if career.clubKits ~= nil then career.clubKits else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(proposal.club)] = kit; return _o end)()), relationships = Js.ospread(career.relationships, Js.O({ fans = M_reputation.clampReputation((career.relationships.fans + KIT_VOTE_FAN_GAIN)) }, { "fans" })) }, { "clubKits", "relationships" })) end
	end
	exports.resolveKitVote = resolveKitVote
	proposePresidentVote = function(career, club, rng)
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ ok = false, reason = "Not the majority shareholder" }, { "ok", "reason" }) end
		end
		if M_investments.ownedClubState(career, club).isPresident then
			do return Js.O({ ok = false, reason = "Already president" }, { "ok", "reason" }) end
		end
		local biasStrength = M_reputation.reputationVoteBias(career.reputation)
		local tally = M_voting.castVote("Elect you as club president?", Js.alit(Js.O({ id = "yes", label = "Elect" }, { "id", "label" }), Js.O({ id = "no", label = "Reject" }, { "id", "label" })), PRESIDENT_ELECTORATE, "yes", biasStrength, rng)
		do return Js.O({ ok = true, proposal = Js.O({ club = club, tally = tally }, { "club", "tally" }) }, { "ok", "proposal" }) end
	end
	exports.proposePresidentVote = proposePresidentVote
	resolvePresidentVote = function(career, proposal, overrule)
		local next_ = Js.ospread(career, Js.O({ reputation = M_voting.applyVoteHeldReputation(career.reputation) }, { "reputation" }))
		local passed = (proposal.tally.winner == "yes")
		if ((not passed) and overrule) then
			if (not M_investments.canOverruleClubVote(next_, proposal.club)) then
				do return Js.O({ career = next_, ok = false, reason = "Not enough ownership to overrule this vote" }, { "career", "ok", "reason" }) end
			end
			next_ = Js.ospread(next_, Js.O({ reputation = M_voting.applyOverruleReputationCost(next_.reputation) }, { "reputation" }))
		elseif (not passed) then
			do return Js.O({ career = next_, ok = false, reason = "The shareholders voted against you" }, { "career", "ok", "reason" }) end
		end
		local current = M_investments.ownedClubState(next_, proposal.club)
		do return Js.O({ career = Js.ospread(next_, Js.O({ ownedClubs = Js.ospread((if next_.ownedClubs ~= nil then next_.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(proposal.club)] = Js.ospread(current, Js.O({ isPresident = true }, { "isPresident" })); return _o end)()) }, { "ownedClubs" })), ok = true }, { "career", "ok" }) end
	end
	exports.resolvePresidentVote = resolvePresidentVote
	setPresidentWage = function(career, club, wage)
		local current = M_investments.ownedClubState(career, club)
		if (not current.isPresident) then
			do return Js.O({ career = career, ok = false, reason = "Not the club president" }, { "career", "ok", "reason" }) end
		end
		if (wage < 0) then
			do return Js.O({ career = career, ok = false, reason = "A wage can't be negative" }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = Js.ospread(career, Js.O({ ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ presidentWage = wage }, { "presidentWage" })); return _o end)()) }, { "ownedClubs" })), ok = true }, { "career", "ok" }) end
	end
	exports.setPresidentWage = setPresidentWage
	payPresidentWages = function(career)
		local owned = (if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil))
		local money = career.money
		local changed = false
		local nextOwned = Js.ospread(owned)
		do
			local _arr3 = Js.Object.entries(owned)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local _e5 = _arr3[_i4]
				local club = _e5[1]
				local state = _e5[2]
				if ((not state.isPresident) or (not Js.T(state.presidentWage))) then
					do continue end
				end
				local paid = Math.min(state.presidentWage, state.budget)
				if (paid <= 0) then
					do continue end
				end
				nextOwned[club] = Js.ospread(state, Js.O({ budget = (state.budget - paid) }, { "budget" }))
				money += paid
				changed = true
			end
		end
		do return (if changed then Js.ospread(career, Js.O({ money = money, ownedClubs = nextOwned }, { "money", "ownedClubs" })) else career) end
	end
	exports.payPresidentWages = payPresidentWages
	haveASon = function(career)
		if career.son then
			do return Js.O({ ok = false, reason = "You already have a son" }, { "ok", "reason" }) end
		end
		if (career.money < HAVE_A_SON_COST) then
			do return Js.O({ ok = false, reason = "Not enough money" }, { "ok", "reason" }) end
		end
		do return Js.ospread(career, Js.O({ money = (career.money - HAVE_A_SON_COST), son = Js.O({ name = (career.player.lastName .. " Junior"), age = SON_START_AGE, overall = SON_START_OVERALL, club = nil, playerId = nil }, { "name", "age", "overall", "club", "playerId" }) }, { "money", "son" })) end
	end
	exports.haveASon = haveASon
	ageUpSonWithPotion = function(career, rng)
		if (not career.son) then
			do return Js.O({ ok = false, reason = "You don't have a son yet" }, { "ok", "reason" }) end
		end
		local cost = M_economy.tierPrice("world_class", ((200 + (career.son.age * 40)) * SON_COST_UNIT_WEEKS))
		if (career.money < cost) then
			do return Js.O({ ok = false, reason = "Not enough money for the potion" }, { "ok", "reason" }) end
		end
		local ageGain = (3 + math.floor((rng() * 6)))
		local overallGain = (2 + math.floor((rng() * 7)))
		local son = Js.ospread(career.son, Js.O({ age = (career.son.age + ageGain), overall = Math.min(SON_OVERALL_CAP, (career.son.overall + overallGain)) }, { "age", "overall" }))
		local next_ = Js.ospread(career, Js.O({ money = (career.money - cost), son = son }, { "money", "son" }))
		if (Js.T(son.club) and Js.T(son.playerId)) then
			local entry = M_investments.findSquadEntry(next_, son.club)
			if entry then
				local players = A.map(entry.squad.players, function(p)
					return (if (p.id == son.playerId) then Js.ospread(p, Js.O({ overall = son.overall }, { "overall" })) else p)
				end)
				next_ = M_investments.setSquad(next_, son.club, players)
			end
		end
		do return next_ end
	end
	exports.ageUpSonWithPotion = ageUpSonWithPotion
	promoteSonToFirstTeam = function(career, club)
		if (not career.son) then
			do return Js.O({ career = career, ok = false, reason = "You don't have a son" }, { "career", "ok", "reason" }) end
		end
		if Js.T(career.son.club) then
			do return Js.O({ career = career, ok = false, reason = "He's already on a team" }, { "career", "ok", "reason" }) end
		end
		if (career.son.age < SON_MIN_PROMOTION_AGE) then
			do return Js.O({ career = career, ok = false, reason = "He's not old enough yet — use the potion first" }, { "career", "ok", "reason" }) end
		end
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		local entry = M_investments.findSquadEntry(career, club)
		if (not entry) then
			do return Js.O({ career = career, ok = false, reason = "No squad data on file for this club" }, { "career", "ok", "reason" }) end
		end
		local playerId = ("son:" .. career.son.name .. ":" .. club)
		local player = Js.O({ id = playerId, name = career.son.name, position = "ST", overall = career.son.overall, goals = 0, assists = 0 }, { "id", "name", "position", "overall", "goals", "assists" })
		local next_ = M_investments.setSquad(career, club, Js.aspread(entry.squad.players, Js.alit(player)))
		do return Js.O({ career = Js.ospread(next_, Js.O({ son = Js.ospread(career.son, Js.O({ club = club, playerId = playerId }, { "club", "playerId" })) }, { "son" })), ok = true }, { "career", "ok" }) end
	end
	exports.promoteSonToFirstTeam = promoteSonToFirstTeam
	transferSon = function(career, toClub)
		if ((not Js.T((function() local _v = career.son; if _v == nil then return nil end; _v = _v.club; return _v end)())) or (not Js.T(career.son.playerId))) then
			do return Js.O({ career = career, ok = false, reason = "He isn't on a team yet" }, { "career", "ok", "reason" }) end
		end
		if (toClub == career.son.club) then
			do return Js.O({ career = career, ok = false, reason = "He's already there" }, { "career", "ok", "reason" }) end
		end
		local fromEntry = M_investments.findSquadEntry(career, career.son.club)
		local toEntry = M_investments.findSquadEntry(career, toClub)
		if (not toEntry) then
			do return Js.O({ career = career, ok = false, reason = "No squad data on file for that club" }, { "career", "ok", "reason" }) end
		end
		local playerId = career.son.playerId
		local moving = (function() local _r = (function() local _v = fromEntry; if _v == nil then return nil end; _v = _v.squad; _v = _v.players; return _v end)(); if _r == nil then return nil end; return A.find(_r, function(p)
			return (p.id == playerId)
		end) end)()
		if (not moving) then
			do return Js.O({ career = career, ok = false, reason = "He isn't in his old squad anymore" }, { "career", "ok", "reason" }) end
		end
		local next_ = career
		if fromEntry then
			next_ = M_investments.setSquad(next_, career.son.club, A.filter(fromEntry.squad.players, function(p)
				return (p.id ~= playerId)
			end))
		end
		next_ = M_investments.setSquad(next_, toClub, Js.aspread(toEntry.squad.players, Js.alit(moving)))
		do return Js.O({ career = Js.ospread(next_, Js.O({ son = Js.ospread(career.son, Js.O({ club = toClub }, { "club" })) }, { "son" })), ok = true }, { "career", "ok" }) end
	end
	exports.transferSon = transferSon
	appointSelfCaptain = function(career, club)
		if (career.player.club ~= club) then
			do return Js.O({ career = career, ok = false, reason = "You don't play for this club" }, { "career", "ok", "reason" }) end
		end
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		if career.captain then
			do return Js.O({ career = career, ok = false, reason = "Already captain" }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = Js.ospread(career, Js.O({ captain = true }, { "captain" })), ok = true }, { "career", "ok" }) end
	end
	exports.appointSelfCaptain = appointSelfCaptain
	setTalisman = function(career, club, on)
		if (career.player.club ~= club) then
			do return Js.O({ career = career, ok = false, reason = "You don't play for this club" }, { "career", "ok", "reason" }) end
		end
		if (not M_investments.isMajorityOwner(career, club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder" }, { "career", "ok", "reason" }) end
		end
		local current = M_investments.ownedClubState(career, club)
		do return Js.O({ career = Js.ospread(career, Js.O({ ownedClubs = Js.ospread((if career.ownedClubs ~= nil then career.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(club)] = Js.ospread(current, Js.O({ talisman = on }, { "talisman" })); return _o end)()) }, { "ownedClubs" })), ok = true }, { "career", "ok" }) end
	end
	exports.setTalisman = setTalisman
	transferSelfTo = function(career, toClub)
		if (not M_investments.isMajorityOwner(career, career.player.club)) then
			do return Js.O({ career = career, ok = false, reason = "Not the majority shareholder of your own club" }, { "career", "ok", "reason" }) end
		end
		if (toClub == career.player.club) then
			do return Js.O({ career = career, ok = false, reason = "You're already there" }, { "career", "ok", "reason" }) end
		end
		local clubs = A.map(career.league, function(t)
			return t.name
		end)
		if (not A.includes(clubs, toClub)) then
			do return Js.O({ career = career, ok = false, reason = "Not a club in your current division" }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = M_careerFlow.attachClub(career, toClub, clubs, (if career.division ~= nil then career.division else "premier")), ok = true }, { "career", "ok" }) end
	end
	exports.transferSelfTo = transferSelfTo
	canMergeClubs = function(career, primaryClub, absorbedClub)
		if (primaryClub == absorbedClub) then
			do return false end
		end
		if (((function() local _v = M_investments.stakeIn(career, primaryClub); if _v == nil then return nil end; _v = _v.percent; return _v end)() or 0) < 100) then
			do return false end
		end
		if (((function() local _v = M_investments.stakeIn(career, absorbedClub); if _v == nil then return nil end; _v = _v.percent; return _v end)() or 0) < 100) then
			do return false end
		end
		if Js.T(M_investments.ownedClubState(career, absorbedClub).dissolvedInto) then
			do return false end
		end
		do return true end
	end
	exports.canMergeClubs = canMergeClubs
	mergeClubs = function(career, primaryClub, absorbedClub)
		if (not canMergeClubs(career, primaryClub, absorbedClub)) then
			do return Js.O({ career = career, ok = false, reason = "Both clubs must be fully (100%) owned to merge them" }, { "career", "ok", "reason" }) end
		end
		local primaryEntry = M_investments.findSquadEntry(career, primaryClub)
		local absorbedEntry = M_investments.findSquadEntry(career, absorbedClub)
		if ((not primaryEntry) or (not absorbedEntry)) then
			do return Js.O({ career = career, ok = false, reason = "No squad data on file for one of these clubs" }, { "career", "ok", "reason" }) end
		end
		local target = M_tuningStore.getTuning("transfers.squadTarget")
		local combined = A.slice(A.sort(Js.aspread(primaryEntry.squad.players, absorbedEntry.squad.players), function(a, b)
			return (b.overall - a.overall)
		end), 0, target)
		local next_ = M_investments.setSquad(career, primaryClub, combined)
		next_ = M_investments.setSquad(next_, absorbedClub, Js.alit())
		local primaryBudget = M_investments.ownedClubState(next_, primaryClub).budget
		local absorbedBudget = M_investments.ownedClubState(next_, absorbedClub).budget
		next_ = Js.ospread(next_, Js.O({ ownedClubs = Js.ospread((if next_.ownedClubs ~= nil then next_.ownedClubs else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(primaryClub)] = Js.ospread(M_investments.ownedClubState(next_, primaryClub), Js.O({ budget = (primaryBudget + absorbedBudget) }, { "budget" })); _o[Js.key(absorbedClub)] = Js.ospread(M_investments.ownedClubState(next_, absorbedClub), Js.O({ budget = 0, dissolvedInto = primaryClub }, { "budget", "dissolvedInto" })); return _o end)()), relationships = Js.ospread(next_.relationships, Js.O({ fans = M_reputation.clampReputation((next_.relationships.fans - MERGER_FAN_COST)) }, { "fans" })), reputation = M_reputation.clampReputation((next_.reputation + M_reputation.REPUTATION_EVENTS.mergedClubs)) }, { "ownedClubs", "relationships", "reputation" }))
		do return Js.O({ career = next_, ok = true }, { "career", "ok" }) end
	end
	exports.mergeClubs = mergeClubs
	RECOMMENDATION_HISTORY_CAP = 30
	FAN_ELECTORATE = 8000
	KIT_VOTE_FAN_GAIN = 2
	PRESIDENT_ELECTORATE = 640
	SON_COST_UNIT_WEEKS = (60 / 500)
	HAVE_A_SON_COST = M_economy.tierPrice("world_class", (500 * SON_COST_UNIT_WEEKS))
	SON_START_AGE = 0
	SON_START_OVERALL = 35
	SON_MIN_PROMOTION_AGE = 16
	SON_OVERALL_CAP = 92
	MERGER_FAN_COST = 15
end
