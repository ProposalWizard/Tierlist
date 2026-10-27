--!nocheck
--!nolint
-- Generated from roblox/game/flow.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_career = import("lib/star/intl/career")
	local M_careerFlow = import("lib/star/careerFlow")
	local M_realSquad = import("lib/star/realSquad")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_clubs = import("lib/star/clubs")
	local M_calendar = import("lib/star/calendar")
	local M_worldAgeing = import("lib/star/worldAgeing")
	local M_competitions = import("lib/star/competitions")
	local M_selection = import("lib/star/selection")
	local M_week = import("lib/star/week")
	local M_simMatch = import("lib/star/simMatch")
	local M_setPieces = import("lib/star/setPieces")
	local M_unlocks = import("lib/star/unlocks")
	local M_feed = import("lib/star/media/feed")
	local M_international = import("lib/star/international")
	local M_leoUpdate = import("lib/star/leoUpdate")
	local M_youth = import("lib/star/youth")
	local M_season = import("lib/star/season")
	local M_knockoutView = import("lib/star/knockoutView")
	local M_cups = import("lib/star/cups")
	local M_euro = import("lib/star/euro")
	local M_economy = import("lib/star/economy")
	local M_contracts = import("lib/star/contracts")
	local M_seasonAwards = import("lib/star/seasonAwards")
	local M_ballonDor = import("lib/star/ballonDor")
	local M_retirement = import("lib/star/retirement")
	local M_transferInterest = import("lib/star/transferInterest")
	local M_relegationOffers = import("lib/star/relegationOffers")
	local M_transferRequest = import("lib/star/transferRequest")
	local M_signingTalk = import("lib/star/signingTalk")
	local M_transfers = import("lib/star/transfers")
	local at, settle, newGame, loadRealSquads, loadNewClubSquad, matchday, simMatch, matchComplete, watchFromStands, youthWeek, youthPromotion, postMatchContinue, continueAfterMatch, drawContinue, knockoutContinue, playoffContinue, deadlineDayContinue, backToDashboard, callUp, callUpContinue, renewalOffer, contractComplete, endSeason, ballonDor, ballonDorContinue, playOn, transferInterest, openTransferWindowOrRoll, transferNegotiate, transferTalkDone, chooseTransfer, signingDone, stayPut, rollOverSeason, continueAfterRollover, seasonAwardsContinue, ladderContinue, retireNow, leagueTable
	settle = function(g)
		if ((g.phase == "dashboard") and ((function() local _v = g.career.placement; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "youth")) then
			do return Js.ospread(g, Js.O({ phase = "youth" }, { "phase" })) end
		end
		if ((g.phase == "dashboard") and (M_career.periodDue(g.career) ~= nil)) then
			do return Js.ospread(g, Js.O({ phase = "intl-callup" }, { "phase" })) end
		end
		if ((g.phase == "intl-callup") and (M_career.periodDue(g.career) == nil)) then
			do return Js.ospread(g, Js.O({ phase = "dashboard" }, { "phase" })) end
		end
		do return g end
	end
	newGame = function(player, clubs, division)
		local career = M_careerFlow.makeInitialCareer(player, clubs, division)
		if ((Js.T((function() local _v = career.player; if _v == nil then return nil end; _v = _v.club; return _v end)()) and Js.T((function() local _v = career.fixtures; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) and (not (function() local _v = career.intl; if _v == nil then return nil end; _v = _v.xi; if _v == nil then return nil end; _v = _v[Js.key(career.season)]; return _v end)())) then
			career = M_career.syncIntl(career)
		end
		do return settle(Js.O({ career = career, phase = "dashboard", koShown = Js.alit() }, { "career", "phase", "koShown" })) end
	end
	exports.newGame = newGame
	loadRealSquads = function(g)
		local c = g.career
		local club = c.player.club
		local clubs = A.map(c.league, function(t)
			return t.name
		end)
		local squad = Js.await(M_realSquad.fetchRealSquad(club))
		local leagueSquads = Js.await(M_leagueSquads.fetchLeagueSquads(clubs))
		local freeAgents = Js.await(M_leagueSquads.fetchFreeAgents())
		local externalSquads = Js.await(M_leagueSquads.fetchLeagueSquads(M_clubs.externalClubsFor(clubs)))
		local next_ = Js.ospread(c, Js.O({ squad = (if Js.T(Js.alen(squad)) then squad else c.squad), leagueSquads = leagueSquads, league = M_leagueSquads.syncLeagueStrengthFromSquads(c.league, leagueSquads, M_calendar.divisionOf(c)), freeAgents = freeAgents, externalSquads = externalSquads }, { "squad", "leagueSquads", "league", "freeAgents", "externalSquads" }))
		do return Js.ospread(g, Js.O({ career = next_ }, { "career" })) end
	end
	exports.loadRealSquads = loadRealSquads
	loadNewClubSquad = function(g)
		local club = g.career.player.club
		local squad = Js.await(M_realSquad.fetchRealSquad(club))
		if (not Js.T(Js.alen(squad))) then
			do return g end
		end
		do return Js.ospread(g, Js.O({ career = Js.ospread(g.career, Js.O({ squad = M_worldAgeing.ageOwnFetchedForCareer(g.career, club, squad) }, { "squad" })) }, { "career" })) end
	end
	exports.loadNewClubSquad = loadNewClubSquad
	matchday = function(g)
		local c = g.career
		local fixture = M_competitions.nextFixtureFor(c)
		local sel = M_selection.selectionFor(Js.ospread(c, Js.O({ energy = M_week.projectedEnergy(c) }, { "energy" })))
		local watching = ((sel.status == "Squad") or (sel.status == "Injured"))
		do return Js.O({ fixture = fixture, canPlay = (((not (not fixture)) and (not watching)) and (not fixture.watch)), status = (if sel.status ~= nil then sel.status else nil), reason = (if sel.reason ~= nil then sel.reason else nil), seasonOver = ((Js.alen(c.fixtures) > 0) and (not fixture)) }, { "fixture", "canPlay", "status", "reason", "seasonOver" }) end
	end
	exports.matchday = matchday
	simMatch = function(g)
		local career = g.career
		local nextFixture = M_competitions.nextFixtureFor(career)
		if (not nextFixture) then
			do return g end
		end
		local readied = Js.ospread(career, Js.O({ weekActions = 0, energy = M_week.projectedEnergy(career) }, { "weekActions", "energy" }))
		local sel = M_selection.selectionFor(readied)
		local bootOn = (readied.currentBoot.matches > 0)
		local stats = M_simMatch.simulateOwnMatch(readied, nextFixture, Js.O({ selection = sel, duties = M_setPieces.setPieceDuties(readied, sel.status), skills = Js.O({ power = Math.min(100, (readied.skills.power + (if bootOn then readied.currentBoot.power else 0))), technique = Math.min(100, (readied.skills.technique + (if bootOn then readied.currentBoot.technique else 0))) }, { "power", "technique" }) }, { "selection", "duties", "skills" }))
		do return matchComplete(g, stats, readied, nextFixture) end
	end
	exports.simMatch = simMatch
	matchComplete = function(g, stats, readied, nextFixture)
		local career = readied
		local credited = M_careerFlow.creditMatchResult(career, nextFixture, stats)
		local _d1 = credited
		local potmAwarded = _d1.potmAwarded
		local next_ = M_unlocks.recordFirstMatch(credited.career)
		next_.media = (if (nextFixture.kind == "international") then M_feed.generateForInternational(career, next_, nextFixture, stats, M_competitions.nationOf(career), M_international.nationKits(M_competitions.nationOf(career)).home, M_international.nationStrength(M_competitions.nationOf(career))) else M_feed.generateForMatch(career, next_, nextFixture, stats))
		if M_leoUpdate.leoUpdateOn("goalOfMonth") then
			local b = M_feed.applyGoalOfMonthBoost(next_)
			next_.relationships = b.relationships
			next_.media = b.media
		end
		local restOfWeek = A.filter((if next_.results ~= nil then next_.results else Js.alit()), function(r)
			return (((r.week == nextFixture.week) and (r.home ~= career.player.club)) and (r.away ~= career.player.club))
		end)
		if Js.T(Js.alen(restOfWeek)) then
			next_.media = M_feed.generateForLeagueWeek(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })), restOfWeek)
		end
		if potmAwarded then
			local place = (if potmAwarded.isYou then "won it" else (if Js.T(potmAwarded.yourPlace) then (Js.numstr(potmAwarded.yourPlace) .. (Js.alit("st", "nd", "rd")[potmAwarded.yourPlace] or "th") .. " on the shortlist") else "not shortlisted"))
			next_.media = M_feed.generateForCareer(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })), Js.O({ kind = "award", won = potmAwarded.isYou, award = (potmAwarded.monthName .. " Player of the Month"), detail = (if potmAwarded.isYou then (Js.numstr(potmAwarded.goals) .. " goals and " .. Js.numstr(potmAwarded.assists) .. " assists in " .. potmAwarded.monthName .. ".") else (potmAwarded.winner .. " of " .. potmAwarded.club .. " takes it — " .. Js.numstr(potmAwarded.goals) .. " goals. You were " .. place .. ".")) }, { "kind", "won", "award", "detail" }), ("potm-" .. Js.numstr(potmAwarded.season) .. "-" .. Js.numstr(potmAwarded.month)))
		end
		local collapsed = (if M_youth.formHasCollapsed(next_) then M_youth.dropToYouth(next_) else next_)
		do return at(g, "post-match", Js.O({ career = collapsed, lastMatchStats = stats, playedFixture = nextFixture }, { "career", "lastMatchStats", "playedFixture" })) end
	end
	exports.matchComplete = matchComplete
	watchFromStands = function(g)
		local nextFixture = M_competitions.nextFixtureFor(g.career)
		if (not nextFixture) then
			do return g end
		end
		local _d2 = M_careerFlow.simulateMissedFixture(g.career, nextFixture)
		local next_ = _d2.career
		if nextFixture.watch then
			local watched = (A.find(next_.fixtures, function(f)
				return ((f.intlId == nextFixture.intlId) and f.played)
			end) or nil)
			do return at(g, "intl-watched", Js.O({ career = next_, watchedFixture = watched }, { "career", "watchedFixture" })) end
		end
		do return settle(at(g, "dashboard", Js.O({ career = next_ }, { "career" }))) end
	end
	exports.watchFromStands = watchFromStands
	youthWeek = function(g)
		local career = g.career
		if ((function() local _v = career.placement; if _v == nil then return nil end; _v = _v.kind; return _v end)() ~= "youth") then
			do return g end
		end
		local nextFixture = M_competitions.nextFixtureFor(career)
		if ((not nextFixture) and (Js.alen(career.fixtures) > 0)) then
			do return at(g, "dashboard") end
		end
		local base = career
		if nextFixture then
			base = M_careerFlow.simulateMissedFixture(career, nextFixture).career
		else
			base = Js.ospread(career, Js.O({ week = (career.week + 1) }, { "week" }), M_week.startNewWeek())
		end
		local match = M_youth.playYouthMatch(base, M_season.mulberry32((((base.season * 10007) + (base.week * 131)) + 4409)))
		do return settle(at(g, "youth", Js.O({ career = M_youth.applyYouthWeek(base, match) }, { "career" }))) end
	end
	exports.youthWeek = youthWeek
	youthPromotion = function(g)
		if (not M_youth.readyForPromotion(g.career)) then
			do return g end
		end
		do return settle(at(g, "dashboard", Js.O({ career = M_youth.promoteFromYouth(g.career) }, { "career" }))) end
	end
	exports.youthPromotion = youthPromotion
	postMatchContinue = function(g)
		do return continueAfterMatch(g, g.career, false) end
	end
	exports.postMatchContinue = postMatchContinue
	continueAfterMatch = function(g, from, skipDraw)
		local playedFixture = (if g.playedFixture ~= nil then g.playedFixture else nil)
		if (Js.T(from.lastTransferWindowKey) and (from.lastTransferWindowKey ~= from.deadlineDayShownFor)) then
			do return at(g, "deadline-day", Js.O({ career = from }, { "career" })) end
		end
		local ko = (if playedFixture then M_knockoutView.knockoutRoundupFor(from, playedFixture) else nil)
		if (ko and (not A.includes(g.koShown, ko.key))) then
			do return at(g, "knockout-roundup", Js.O({ career = from, pendingKo = ko, koShown = Js.aspread(g.koShown, Js.alit(ko.key)) }, { "career", "pendingKo", "koShown" })) end
		end
		if (((((function() local _v = playedFixture; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "international") and Js.T(playedFixture.round)) and ((function() local _v = from.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == from.season)) and (playedFixture.competition == from.tournament.competition)) then
			local key = ("tourn:" .. Js.numstr(from.season) .. ":" .. Js.numstr(playedFixture.week))
			if (not A.includes(g.koShown, key)) then
				do return at(g, "intl-tournament-table", Js.O({ career = from, koShown = Js.aspread(g.koShown, Js.alit(key)) }, { "career", "koShown" })) end
			end
		end
		if ((not skipDraw) and playedFixture) then
			local cupCompetition = (if (((playedFixture.competition == "FA Cup") or (playedFixture.competition == "League Cup")) or (playedFixture.competition == "Lower League Trophy")) then playedFixture.competition else nil)
			if Js.T(cupCompetition) then
				local state = (function() local _r = from.cupState; if _r == nil then return nil end; return A.find(_r, function(s)
					return (s.competition == cupCompetition)
				end) end)()
				local round = (if state then M_cups.currentRound(state) else nil)
				local freshlyDrawn = ((round and (Js.alen(round.ties) >= 2)) and A.every(round.ties, function(t)
					return ((t.hs == nil) and (not Js.T((function() local _v = t.legs; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())))
				end))
				local youreIn = ((not (not round)) and A.some(round.ties, function(t)
					return ((t.home == from.player.club) or (t.away == from.player.club))
				end))
				local r16 = (if state then M_cups.lastSixteenIndex(state) else -1)
				local shownInBracket = ((not (not state)) and ((Js.alen(state.rounds) - 1) > r16))
				if (((freshlyDrawn and round) and youreIn) and (not shownInBracket)) then
					do return at(g, "draw", Js.O({ career = from, pendingDraw = Js.O({ competition = cupCompetition, round = round }, { "competition", "round" }) }, { "career", "pendingDraw" })) end
				end
			end
			local isEuroKnockout = ((playedFixture.kind == "europe") and ((playedFixture.competition == "Champions League") or (playedFixture.competition == "Europa League")))
			if ((isEuroKnockout and from.euroState) and (not from.euroState.bracket)) then
				local tie = M_euro.currentTie(from.euroState)
				local freshlyDrawn = (tie and A.every(tie.legs, function(l)
					return (l.us == nil)
				end))
				if (freshlyDrawn and tie) then
					do return at(g, "draw", Js.O({ career = from, pendingDraw = Js.O({ competition = from.euroState.competition, round = Js.O({ name = tie.round, ties = Js.alit(Js.O({ home = from.player.club, away = tie.opponent }, { "home", "away" })) }, { "name", "ties" }) }, { "competition", "round" }) }, { "career", "pendingDraw" })) end
				end
			end
		end
		if from.playOffState then
			local upcoming = M_competitions.nextFixtureFor(from)
			local runOver = ((not (not from.playOffState.yourRunOver)) and ((function() local _v = playedFixture; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "playoff"))
			local key = (if ((function() local _v = upcoming; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "playoff") then (Js.numstr(from.season) .. ":" .. Js.str(upcoming.round) .. ":" .. Js.numstr(upcoming.week)) else (if runOver then (Js.numstr(from.season) .. ":end") else nil))
			if (Js.T(key) and (g.roundupShown ~= key)) then
				do return at(g, "playoff-roundup", Js.O({ career = from, roundupShown = key }, { "career", "roundupShown" })) end
			end
		end
		local remaining = Js.alen(A.filter(from.fixtures, function(f)
			return (not f.played)
		end))
		if (remaining == 0) then
			do return settle(at(g, "dashboard", Js.O({ career = from }, { "career" }))) end
		end
		if (M_career.periodDue(from) ~= nil) then
			do return at(g, "intl-callup", Js.O({ career = from }, { "career" })) end
		end
		local earlyOffer = M_careerFlow.checkForContractOffer(from)
		if Js.T(earlyOffer) then
			do return at(g, "contract-renewal", Js.O({ career = M_careerFlow.markContractOfferUsed(from, earlyOffer), contractOfferReason = earlyOffer }, { "career", "contractOfferReason" })) end
		end
		do return settle(at(g, "dashboard", Js.O({ career = from }, { "career" }))) end
	end
	exports.continueAfterMatch = continueAfterMatch
	drawContinue = function(g)
		do return continueAfterMatch(Js.ospread(g, Js.O({ pendingDraw = nil }, { "pendingDraw" })), g.career, true) end
	end
	exports.drawContinue = drawContinue
	knockoutContinue = function(g)
		do return continueAfterMatch(Js.ospread(g, Js.O({ pendingKo = nil }, { "pendingKo" })), g.career, false) end
	end
	exports.knockoutContinue = knockoutContinue
	playoffContinue = function(g)
		do return continueAfterMatch(g, g.career, true) end
	end
	exports.playoffContinue = playoffContinue
	deadlineDayContinue = function(g)
		local next_ = Js.ospread(g.career, Js.O({ deadlineDayShownFor = g.career.lastTransferWindowKey }, { "deadlineDayShownFor" }))
		do return continueAfterMatch(Js.ospread(g, Js.O({ career = next_ }, { "career" })), next_, true) end
	end
	exports.deadlineDayContinue = deadlineDayContinue
	backToDashboard = function(g)
		do return settle(at(g, "dashboard", Js.O({ watchedFixture = nil }, { "watchedFixture" }))) end
	end
	exports.backToDashboard = backToDashboard
	callUp = function(g)
		local due = M_career.periodDue(g.career)
		do return (if (due == nil) then nil else M_career.decide(g.career, due)) end
	end
	exports.callUp = callUp
	callUpContinue = function(g)
		local due = M_career.periodDue(g.career)
		if (due == nil) then
			do return settle(at(g, "dashboard")) end
		end
		local decision = M_career.decide(g.career, due)
		local next_ = M_career.applyDecision(g.career, decision)
		local rec = (if next_.international ~= nil then next_.international else Js.O({ decided = Js.alit(), callUps = 0, snubs = 0, matches = Js.alit() }, { "decided", "callUps", "snubs", "matches" }))
		next_ = Js.ospread(next_, Js.O({ international = Js.ospread(rec, Js.O({ callUps = (rec.callUps + (if decision.called then 1 else 0)), snubs = (rec.snubs + (if decision.called then 0 else 1)) }, { "callUps", "snubs" })) }, { "international" }))
		if decision.called then
			next_ = Js.ospread(next_, Js.O({ media = M_feed.generateForCallUp(next_, decision.nation, ((function() local _v = next_.international; if _v == nil then return nil end; _v = _v.callUps; return _v end)() or 1), decision.period.label, ("callup-" .. decision.period.key)) }, { "media" }))
		end
		do return settle(at(g, "dashboard", Js.O({ career = next_ }, { "career" }))) end
	end
	exports.callUpContinue = callUpContinue
	renewalOffer = function(g, wins, locked, rounds)
		local career = g.career
		local offeredWage = M_economy.renewalWage(career.contract.wage, wins, locked)
		local factor = (if (career.contract.wage > 0) then (offeredWage / career.contract.wage) else M_economy.renewalMultiplier(wins, locked))
		local currentOffer = function(base)
			return Math.round((base * factor))
		end
		do return Js.ospread(Js.O({ club = career.contract.club, wage = offeredWage, goalBonus = currentOffer(career.contract.goalBonus), assistBonus = currentOffer(career.contract.assistBonus), seasonsRemaining = 3 }, { "club", "wage", "goalBonus", "assistBonus", "seasonsRemaining" }), M_contracts.offerClauses(career, offeredWage, M_season.mulberry32((((career.season * 71) + (wins * 13)) + rounds)))) end
	end
	exports.renewalOffer = renewalOffer
	contractComplete = function(g, newContract)
		local career = g.career
		if newContract then
			career = Js.ospread(career, Js.O({ contract = newContract }, { "contract" }))
			career.media = M_feed.generateForCareer(career, Js.O({ kind = "contract", club = newContract.club, wage = newContract.wage, seasonsRemaining = newContract.seasonsRemaining }, { "kind", "club", "wage", "seasonsRemaining" }), ("contract-s" .. Js.numstr(g.career.season)))
		end
		do return settle(at(g, "dashboard", Js.O({ career = career, contractOfferReason = nil }, { "career", "contractOfferReason" }))) end
	end
	exports.contractComplete = contractComplete
	endSeason = function(g)
		local _d3 = M_careerFlow.awardLeagueTrophyIfWon(g.career)
		local awarded = _d3.career
		local next_ = Js.ospread(awarded, Js.O({ lastSeasonAwardStats = M_seasonAwards.computeSeasonAwardStats(awarded) }, { "lastSeasonAwardStats" }))
		do return at(g, "ballon-dor", Js.O({ career = next_ }, { "career" })) end
	end
	exports.endSeason = endSeason
	ballonDor = function(g)
		do return M_ballonDor.computeBallonDorShortlist(g.career) end
	end
	exports.ballonDor = ballonDor
	ballonDorContinue = function(g)
		local userWon = (M_ballonDor.computeBallonDorShortlist(g.career).playerRank == 1)
		local h = Js.ospread(g, Js.O({ wonBallonDor = userWon }, { "wonBallonDor" }))
		local check = M_retirement.retirementCheck(g.career)
		if check.mustRetire then
			do return at(h, "retirement") end
		end
		if check.finalSeasonNext then
			do return at(h, "final-season") end
		end
		do return openTransferWindowOrRoll(h, g.career, userWon) end
	end
	exports.ballonDorContinue = ballonDorContinue
	playOn = function(g)
		do return openTransferWindowOrRoll(g, g.career, (not (not g.wonBallonDor))) end
	end
	exports.playOn = playOn
	transferInterest = function(g)
		do return M_transferInterest.withRecall(M_transferInterest.windowInterest(g.career, "summer", Js.O({ step3Promoted = M_leoUpdate.leoUpdateOn("bugFixes") }, { "step3Promoted" })), M_youth.loanRecallOffer(g.career), g.career) end
	end
	exports.transferInterest = transferInterest
	openTransferWindowOrRoll = function(g, from, userWon)
		if (M_calendar.isRegionalDivision(M_calendar.divisionOf(from)) and A.some(A.slice(M_season.sortLeague(from.league), -4), function(t)
			return (t.name == from.player.club)
		end)) then
			local forced = M_relegationOffers.generateRelegationOffers(from, M_season.mulberry32(((from.season * 8831) + from.fame)))
			if (Js.alen(forced) > 0) then
				local agreed = M_transferRequest.requestOf(from).agreed
				do return at(g, "relegation-move", Js.O({ transferOffers = (if agreed then Js.aspread(Js.alit(agreed), A.filter(forced, function(o)
					return (o.club ~= agreed.club)
				end)) else forced) }, { "transferOffers" })) end
			end
		end
		local interest = M_transferInterest.withRecall(M_transferInterest.windowInterest(from, "summer", Js.O({ step3Promoted = M_leoUpdate.leoUpdateOn("bugFixes") }, { "step3Promoted" })), M_youth.loanRecallOffer(from), from)
		if (Js.alen(interest.leagues) > 0) then
			do return at(g, "season-transfer") end
		end
		do return rollOverSeason(g, from, userWon) end
	end
	exports.openTransferWindowOrRoll = openTransferWindowOrRoll
	transferNegotiate = function(g, offer)
		do return at(g, "transfer-request-talk", Js.O({ talkOffer = offer }, { "talkOffer" })) end
	end
	exports.transferNegotiate = transferNegotiate
	transferTalkDone = function(g, finalWeekly)
		local talkOffer = g.talkOffer
		if (not talkOffer) then
			do return g end
		end
		local talkDivision = (if talkOffer.division ~= nil then talkOffer.division else M_calendar.divisionOf(g.career))
		local weekly = (if (finalWeekly == nil) then nil else Math.max(M_signingTalk.wageFloorFor(talkOffer.club, talkDivision), Math.round(finalWeekly)))
		if (weekly == nil) then
			do return at(g, "season-transfer", Js.O({ talkOffer = nil, career = M_transferInterest.markWalkedAway(g.career, "summer", talkOffer.club) }, { "talkOffer", "career" })) end
		end
		do return at(g, "transfer-signing", Js.O({ talkOffer = nil, pendingSignOffer = Js.O({ offer = M_transferInterest.withAgreedWage(talkOffer, weekly), wasRelegationMove = false }, { "offer", "wasRelegationMove" }) }, { "talkOffer", "pendingSignOffer" })) end
	end
	exports.transferTalkDone = transferTalkDone
	chooseTransfer = function(g, offer)
		do return at(g, "transfer-signing", Js.O({ pendingSignOffer = Js.O({ offer = offer, wasRelegationMove = (g.phase == "relegation-move") }, { "offer", "wasRelegationMove" }) }, { "pendingSignOffer" })) end
	end
	exports.chooseTransfer = chooseTransfer
	signingDone = function(g)
		local career = g.career
		if (not g.pendingSignOffer) then
			do return g end
		end
		local _d4 = g.pendingSignOffer
		local offer = _d4.offer
		local wasRelegationMove = _d4.wasRelegationMove
		local moved = M_transferRequest.clearAfterWindow(M_transfers.acceptOffer(career, offer))
		local crossDivision = ((not (not Js.T(offer.division))) and (offer.division ~= M_calendar.divisionOf(career)))
		moved.media = M_feed.generateForCareer(moved, Js.O({ kind = "transfer", from = career.player.club, to = offer.club, fee = (if offer.transferFee ~= nil then offer.transferFee else offer.signingFee) }, { "kind", "from", "to", "fee" }), "transfer")
		do return rollOverSeason(Js.ospread(g, Js.O({ transferOffers = Js.alit(), pendingSignOffer = nil }, { "transferOffers", "pendingSignOffer" })), moved, (not (not g.wonBallonDor)), (wasRelegationMove or crossDivision), true) end
	end
	exports.signingDone = signingDone
	stayPut = function(g)
		do return rollOverSeason(Js.ospread(g, Js.O({ transferOffers = Js.alit() }, { "transferOffers" })), M_transferRequest.clearAfterWindow(g.career), (not (not g.wonBallonDor))) end
	end
	exports.stayPut = stayPut
	rollOverSeason = function(g, from, userWon, forcedRelegationMove, justTransferred)
		if forcedRelegationMove == nil then forcedRelegationMove = false end
		if justTransferred == nil then justTransferred = false end
		local _d5 = M_careerFlow.advanceSeason(from, userWon, justTransferred, Js.O({ noSackAfterPromotion = M_leoUpdate.leoUpdateOn("bugFixes") }, { "noSackAfterPromotion" }))
		local rolled = _d5.career
		local next_ = M_youth.endLoan(rolled)
		next_.lastSeasonRecords = (if from.seasonRecords ~= nil then from.seasonRecords else Js.alit())
		next_.seasonRecords = Js.alit()
		if (forcedRelegationMove and next_.ladderNews) then
			next_.ladderNews = Js.ospread(next_.ladderNews, Js.O({ yourMove = nil }, { "yourMove" }))
		end
		if userWon then
			next_.media = M_feed.generateForCareer(next_, Js.O({ kind = "ballon-dor", won = true, total = next_.ballonDorWins }, { "kind", "won", "total" }), "bdor")
		end
		local honours = A.filter((if next_.awards ~= nil then next_.awards else Js.alit()), function(a)
			return (a.season == from.season)
		end)
		do
			local _arr6 = honours
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local a = _arr6[_i7]
				next_.media = M_feed.generateForCareer(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })), Js.O({ kind = "award", won = true, award = a.kind, detail = a.detail }, { "kind", "won", "award", "detail" }), ("award-" .. a.kind))
			end
		end
		if (Js.T(next_.managerNews) and next_.manager) then
			next_.media = M_feed.generateForCareer(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })), Js.O({ kind = "manager-out", name = ((function() local _v = from.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager"), incoming = next_.manager.name, reason = next_.managerNews }, { "kind", "name", "incoming", "reason" }), "gaffer")
		end
		if next_.lastSeasonJudgement then
			next_.media = M_feed.generateForCareer(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })), Js.O({ kind = "season-end", position = M_competitions.leaguePosition(from), headline = next_.lastSeasonJudgement.headline, detail = next_.lastSeasonJudgement.detail }, { "kind", "position", "headline", "detail" }), "review")
		end
		next_.media = M_feed.generateForRollover(Js.ospread(next_, Js.O({ media = next_.media }, { "media" })))
		if next_.lastSeasonAwardStats then
			do return at(g, "season-awards", Js.O({ career = next_ }, { "career" })) end
		end
		do return continueAfterRollover(Js.ospread(g, Js.O({ career = next_ }, { "career" })), next_) end
	end
	exports.rollOverSeason = rollOverSeason
	continueAfterRollover = function(g, next_)
		if (next_.ladderNews and (next_.contract.seasonsRemaining > 0)) then
			do return at(g, "ladder", Js.O({ career = next_ }, { "career" })) end
		end
		if (next_.contract.seasonsRemaining <= 0) then
			do return at(g, "contract-renewal", Js.O({ career = next_ }, { "career" })) end
		end
		do return settle(at(g, "dashboard", Js.O({ career = next_ }, { "career" }))) end
	end
	exports.continueAfterRollover = continueAfterRollover
	seasonAwardsContinue = function(g)
		do return continueAfterRollover(g, g.career) end
	end
	exports.seasonAwardsContinue = seasonAwardsContinue
	ladderContinue = function(g)
		do return settle(at(g, "dashboard")) end
	end
	exports.ladderContinue = ladderContinue
	retireNow = function(g)
		local done = M_retirement.retire(g.career, (not (not g.wonBallonDor)))
		done.media = M_feed.generateForCareer(done, Js.O({ kind = "retirement", goals = done.careerStats.goals, apps = done.careerStats.appearances, trophies = Js.alen(done.trophies) }, { "kind", "goals", "apps", "trophies" }), "retire")
		do return at(g, "legacy", Js.O({ career = done }, { "career" })) end
	end
	exports.retireNow = retireNow
	leagueTable = function(g)
		do return M_season.sortLeague(g.career.league) end
	end
	exports.leagueTable = leagueTable
	at = function(g, phase, extra)
		if extra == nil then extra = Js.O({}, nil) end
		return Js.ospread(g, extra, Js.O({ phase = phase }, { "phase" }))
	end
end
