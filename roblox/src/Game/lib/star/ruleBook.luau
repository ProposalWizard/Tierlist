--!nocheck
--!nolint
-- Generated from lib/star/ruleBook.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_leadership = import("lib/star/leadership")
	local M_reputation = import("lib/star/reputation")
	local M_governingBodies = import("lib/star/governingBodies")
	local M_voting = import("lib/star/voting")
	local CLASSIC_POINTS, DEFAULT_RULE_BOOK, ruleBookFor, resolvePenalties, applyResult, RULE_OVERRULE_INFLUENCE_THRESHOLD, RULE_OVERRULE_WORLD_COST, RULE_VOTE_HELD_WORLD_GAIN, GOVERNING_BODY_ELECTORATE, changeMagnitude, fanCostOf, proposeRuleChangeVote, canOverruleRuleVote, nudgeWorld, resolveRuleChangeVote
	ruleBookFor = function(career, body)
		local saved = (function() local _v = career.ruleBook; if _v == nil then return nil end; _v = _v[body]; return _v end)()
		do return (if saved then Js.ospread(DEFAULT_RULE_BOOK, saved) else DEFAULT_RULE_BOOK) end
	end
	exports.ruleBookFor = ruleBookFor
	resolvePenalties = function(strengthA, strengthB, rng)
		local edge = Math.max(0.3, Math.min(0.7, (0.5 + ((strengthA - strengthB) / 200))))
		do return (if (rng() < edge) then "a" else "b") end
	end
	exports.resolvePenalties = resolvePenalties
	applyResult = function(rules, home, away, homeScore, awayScore, homeStrength, awayStrength, rng)
		local H = Js.ospread(home, Js.O({ played = (home.played + 1) }, { "played" }))
		local A_ = Js.ospread(away, Js.O({ played = (away.played + 1) }, { "played" }))
		if (homeScore ~= awayScore) then
			local homeWon = (homeScore > awayScore)
			if homeWon then
				H.won += 1
				H.points += rules.points.win
				A_.lost += 1
				A_.points += rules.points.loss
			else
				A_.won += 1
				A_.points += rules.points.win
				H.lost += 1
				H.points += rules.points.loss
			end
			do return Js.O({ home = H, away = A_, wentToPenalties = false }, { "home", "away", "wentToPenalties" }) end
		end
		if (not rules.noDraws) then
			H.drawn += 1
			H.points += rules.points.draw
			A_.drawn += 1
			A_.points += rules.points.draw
			do return Js.O({ home = H, away = A_, wentToPenalties = false }, { "home", "away", "wentToPenalties" }) end
		end
		local winner = resolvePenalties(homeStrength, awayStrength, rng)
		if (winner == "a") then
			H.won += 1
			H.points += rules.points.win
			A_.lost += 1
			A_.points += rules.points.loss
		else
			A_.won += 1
			A_.points += rules.points.win
			H.lost += 1
			H.points += rules.points.loss
		end
		do return Js.O({ home = H, away = A_, wentToPenalties = true, penaltyWinner = (if (winner == "a") then "home" else "away") }, { "home", "away", "wentToPenalties", "penaltyWinner" }) end
	end
	exports.applyResult = applyResult
	changeMagnitude = function(current, change)
		local magnitude = 0
		if change.points then
			magnitude += ((math.abs((change.points.win - current.points.win)) + math.abs((change.points.draw - current.points.draw))) + math.abs((change.points.loss - current.points.loss)))
		end
		if ((change.noDraws ~= nil) and (change.noDraws ~= current.noDraws)) then
			magnitude += 8
		end
		if (change.matchLengthMinutes ~= nil) then
			magnitude += (math.abs((change.matchLengthMinutes - current.matchLengthMinutes)) / 10)
		end
		if change.bannedItems then
			local before = Js.Set.new(current.bannedItems)
			local after = Js.Set.new(change.bannedItems)
			do
				local _arr1 = Js.Array.from(after)
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local id = _arr1[_i2]
					if (not before:has(id)) then
						magnitude += 4
					end
				end
			end
			do
				local _arr3 = Js.Array.from(before)
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local id = _arr3[_i4]
					if (not after:has(id)) then
						magnitude += 4
					end
				end
			end
		end
		if ((change.offsideAbolished ~= nil) and (change.offsideAbolished ~= current.offsideAbolished)) then
			magnitude += 12
		end
		if (change.squadSize ~= nil) then
			magnitude += (math.abs((change.squadSize - current.squadSize)) * 1.5)
		end
		if (change.extraChampionsLeagueSlots ~= nil) then
			magnitude += (math.abs((change.extraChampionsLeagueSlots - current.extraChampionsLeagueSlots)) * 2)
		end
		if (change.extraEuropaLeagueSlots ~= nil) then
			magnitude += (math.abs((change.extraEuropaLeagueSlots - current.extraEuropaLeagueSlots)) * 2)
		end
		if ((change.championsLeagueFormat ~= nil) and (change.championsLeagueFormat ~= current.championsLeagueFormat)) then
			magnitude += 10
		end
		if ((change.saudiClubsInEurope ~= nil) and (change.saudiClubsInEurope ~= current.saudiClubsInEurope)) then
			magnitude += 14
		end
		if ((change.customClubEntries ~= nil) and (Js.alen(change.customClubEntries) ~= Js.alen(current.customClubEntries))) then
			magnitude += 14
		end
		do return magnitude end
	end
	exports.changeMagnitude = changeMagnitude
	fanCostOf = function(current, change)
		do return Math.max(1, Math.min(15, Math.round(changeMagnitude(current, change)))) end
	end
	exports.fanCostOf = fanCostOf
	proposeRuleChangeVote = function(career, body, change, rng)
		if M_leadership.isBodyPresident(career, body) then
		elseif (career.reputation < M_reputation.REPUTATION_PROPOSE_RULES_MIN) then
			do return Js.O({ ok = false, reason = ("Needs " .. Js.numstr(M_reputation.REPUTATION_PROPOSE_RULES_MIN) .. "+ reputation to propose a rule change") }, { "ok", "reason" }) end
		elseif (not M_governingBodies.canProposeRuleChange(career, body)) then
			do return Js.O({ ok = false, reason = "Not enough influence in this governing body" }, { "ok", "reason" }) end
		end
		local biasStrength = M_reputation.reputationVoteBias(career.reputation)
		local tally = M_voting.castVote(("Should " .. body .. " adopt this rule change?"), Js.alit(Js.O({ id = "yes", label = "Adopt" }, { "id", "label" }), Js.O({ id = "no", label = "Reject" }, { "id", "label" })), GOVERNING_BODY_ELECTORATE, "yes", biasStrength, rng)
		do return Js.O({ ok = true, proposal = Js.O({ body = body, change = change, tally = tally }, { "body", "change", "tally" }) }, { "ok", "proposal" }) end
	end
	exports.proposeRuleChangeVote = proposeRuleChangeVote
	canOverruleRuleVote = function(career, body)
		do return ((M_governingBodies.influenceIn(career, body) >= RULE_OVERRULE_INFLUENCE_THRESHOLD) or M_leadership.isBodyPresident(career, body)) end
	end
	exports.canOverruleRuleVote = canOverruleRuleVote
	nudgeWorld = function(reputation, delta)
		do return M_reputation.clampReputation((reputation + delta)) end
	end
	resolveRuleChangeVote = function(career, proposal, overrule)
		local next_ = Js.ospread(career, Js.O({ reputation = nudgeWorld(career.reputation, RULE_VOTE_HELD_WORLD_GAIN) }, { "reputation" }))
		local passed = (proposal.tally.winner == "yes")
		if ((not passed) and overrule) then
			if (not canOverruleRuleVote(next_, proposal.body)) then
				do return Js.O({ career = next_, ok = false, reason = "Not enough influence to overrule this vote" }, { "career", "ok", "reason" }) end
			end
			next_ = Js.ospread(next_, Js.O({ reputation = nudgeWorld(next_.reputation, (-RULE_OVERRULE_WORLD_COST)) }, { "reputation" }))
		elseif (not passed) then
			do return Js.O({ career = next_, ok = false, reason = "The vote was rejected" }, { "career", "ok", "reason" }) end
		end
		local current = ruleBookFor(next_, proposal.body)
		local updated = Js.ospread(current, proposal.change)
		local fanCost = fanCostOf(current, proposal.change)
		next_ = Js.ospread(next_, Js.O({ ruleBook = Js.ospread((if next_.ruleBook ~= nil then next_.ruleBook else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(proposal.body)] = updated; return _o end)()), relationships = Js.ospread(next_.relationships, Js.O({ fans = M_reputation.clampReputation((next_.relationships.fans - fanCost)) }, { "fans" })) }, { "ruleBook", "relationships" }))
		do return Js.O({ career = next_, ok = true }, { "career", "ok" }) end
	end
	exports.resolveRuleChangeVote = resolveRuleChangeVote
	CLASSIC_POINTS = Js.O({ win = 3, draw = 1, loss = 0 }, { "win", "draw", "loss" })
	exports.CLASSIC_POINTS = CLASSIC_POINTS
	DEFAULT_RULE_BOOK = Js.O({ points = CLASSIC_POINTS, noDraws = false, matchLengthMinutes = 90, bannedItems = Js.alit(), offsideAbolished = false, squadSize = 11, extraChampionsLeagueSlots = 0, extraEuropaLeagueSlots = 0, championsLeagueFormat = "league", saudiClubsInEurope = false, customClubEntries = Js.alit() }, { "points", "noDraws", "matchLengthMinutes", "bannedItems", "offsideAbolished", "squadSize", "extraChampionsLeagueSlots", "extraEuropaLeagueSlots", "championsLeagueFormat", "saudiClubsInEurope", "customClubEntries" })
	exports.DEFAULT_RULE_BOOK = DEFAULT_RULE_BOOK
	RULE_OVERRULE_INFLUENCE_THRESHOLD = 80
	exports.RULE_OVERRULE_INFLUENCE_THRESHOLD = RULE_OVERRULE_INFLUENCE_THRESHOLD
	RULE_OVERRULE_WORLD_COST = (-M_reputation.REPUTATION_EVENTS.overruledVote)
	RULE_VOTE_HELD_WORLD_GAIN = 2
	GOVERNING_BODY_ELECTORATE = 300
end
