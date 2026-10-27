--!nocheck
--!nolint
-- Generated from lib/star/shootout.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local hasExtraTime, poisson, ninetyMinuteScore, extraTimeScore, INITIAL_KICKS_PER_SIDE, createShootout, sideKicksTaken, nextShootoutSide, nextTakerIndex, checkInitialPhaseOver, checkSuddenDeathOver, isSuddenDeathRound, takeNextKick, isShootoutOver, penaltyConversionChance, simulateShootout, settleAggregateTie, playKnockoutTie
	hasExtraTime = function(competition, round)
		local _sw1 = competition
		if _sw1 == "League Cup" then
			do return (round == "Final") end
		elseif _sw1 == "FA Cup" then
			do return true end
		elseif _sw1 == "Lower League Trophy" then
			do return (((round == "Quarter-Final") or (round == "Semi-Final")) or (round == "Final")) end
		elseif _sw1 == "Champions League" then
			do return true end
		elseif _sw1 == "Europa League" then
			do return true end
		elseif _sw1 == "Conference League" then
			do return true end
		elseif _sw1 == "Super Cup" then
			do return false end
		elseif _sw1 == "Community Shield" then
			do return false end
		elseif _sw1 == "Charity Shield" then
			do return false end
		else
			do return false end
		end
	end
	exports.hasExtraTime = hasExtraTime
	poisson = function(lambda, rng)
		local L = Math.exp((-lambda))
		local k = 0
		local p = 1
		local _first2 = true
		while _first2 or (p > L) do
			_first2 = false
			k += 1
			p *= rng()
		end
		do return (k - 1) end
	end
	ninetyMinuteScore = function(homeStr, awayStr, rng)
		local h = (homeStr + 3)
		do return Js.O({ hs = poisson(Math.max(0.3, ((h / awayStr) * 1.4)), rng), as = poisson(Math.max(0.2, ((awayStr / h) * 1.1)), rng) }, { "hs", "as" }) end
	end
	exports.ninetyMinuteScore = ninetyMinuteScore
	extraTimeScore = function(homeStr, awayStr, rng)
		local h = (homeStr + 3)
		do return Js.O({ hs = poisson(Math.max(0.1, (((h / awayStr) * 1.4) / 3)), rng), as = poisson(Math.max(0.08, (((awayStr / h) * 1.1) / 3)), rng) }, { "hs", "as" }) end
	end
	exports.extraTimeScore = extraTimeScore
	createShootout = function()
		do return Js.O({ kicks = Js.alit(), homeScore = 0, awayScore = 0, over = false, winner = nil }, { "kicks", "homeScore", "awayScore", "over", "winner" }) end
	end
	exports.createShootout = createShootout
	sideKicksTaken = function(state, side)
		do return Js.alen(A.filter(state.kicks, function(k)
			return (k.side == side)
		end)) end
	end
	exports.sideKicksTaken = sideKicksTaken
	nextShootoutSide = function(state)
		do return (if (math.fmod(Js.alen(state.kicks), 2) == 0) then "home" else "away") end
	end
	exports.nextShootoutSide = nextShootoutSide
	nextTakerIndex = function(state, side, rosterSize)
		if rosterSize == nil then rosterSize = 11 end
		do return math.fmod(sideKicksTaken(state, side), Math.max(1, rosterSize)) end
	end
	exports.nextTakerIndex = nextTakerIndex
	checkInitialPhaseOver = function(state)
		local homeTaken = sideKicksTaken(state, "home")
		local awayTaken = sideKicksTaken(state, "away")
		local homeRemaining = (INITIAL_KICKS_PER_SIDE - homeTaken)
		local awayRemaining = (INITIAL_KICKS_PER_SIDE - awayTaken)
		local homeMax = (state.homeScore + Math.max(0, homeRemaining))
		local awayMax = (state.awayScore + Math.max(0, awayRemaining))
		if (state.homeScore > awayMax) then
			do return Js.ospread(state, Js.O({ over = true, winner = "home" }, { "over", "winner" })) end
		end
		if (state.awayScore > homeMax) then
			do return Js.ospread(state, Js.O({ over = true, winner = "away" }, { "over", "winner" })) end
		end
		if ((homeTaken >= INITIAL_KICKS_PER_SIDE) and (awayTaken >= INITIAL_KICKS_PER_SIDE)) then
			if (state.homeScore ~= state.awayScore) then
				do return Js.ospread(state, Js.O({ over = true, winner = (if (state.homeScore > state.awayScore) then "home" else "away") }, { "over", "winner" })) end
			end
		end
		do return state end
	end
	checkSuddenDeathOver = function(state)
		local last = state.kicks[Js.alen(state.kicks)]
		if (not last) then
			do return state end
		end
		local roundKicks = A.filter(state.kicks, function(k)
			return (k.round == last.round)
		end)
		if (Js.alen(roundKicks) < 2) then
			do return state end
		end
		local home = A.find(roundKicks, function(k)
			return (k.side == "home")
		end)
		local away = A.find(roundKicks, function(k)
			return (k.side == "away")
		end)
		if (home.scored ~= away.scored) then
			do return Js.ospread(state, Js.O({ over = true, winner = (if home.scored then "home" else "away") }, { "over", "winner" })) end
		end
		do return state end
	end
	isSuddenDeathRound = function(round)
		do return (round > INITIAL_KICKS_PER_SIDE) end
	end
	takeNextKick = function(state, scored, rosterSize)
		if rosterSize == nil then rosterSize = 11 end
		if state.over then
			do return state end
		end
		local side = nextShootoutSide(state)
		local takerIndex = nextTakerIndex(state, side, rosterSize)
		local round = (math.floor((Js.alen(state.kicks) / 2)) + 1)
		local kick = Js.O({ side = side, takerIndex = takerIndex, scored = scored, round = round }, { "side", "takerIndex", "scored", "round" })
		local kicks = Js.aspread(state.kicks, Js.alit(kick))
		local homeScore = (state.homeScore + (if ((side == "home") and scored) then 1 else 0))
		local awayScore = (state.awayScore + (if ((side == "away") and scored) then 1 else 0))
		local next_ = Js.O({ kicks = kicks, homeScore = homeScore, awayScore = awayScore, over = false, winner = nil }, { "kicks", "homeScore", "awayScore", "over", "winner" })
		next_ = (if isSuddenDeathRound(round) then checkSuddenDeathOver(next_) else checkInitialPhaseOver(next_))
		do return next_ end
	end
	exports.takeNextKick = takeNextKick
	isShootoutOver = function(state)
		do return state.over end
	end
	exports.isShootoutOver = isShootoutOver
	penaltyConversionChance = function(skill)
		local s = (if skill ~= nil then skill else 65)
		do return Math.max(0.45, Math.min(0.95, (0.55 + ((s - 30) * 0.008)))) end
	end
	exports.penaltyConversionChance = penaltyConversionChance
	simulateShootout = function(homeSkill, awaySkill, rng, rosterSize)
		if rosterSize == nil then rosterSize = 11 end
		local state = createShootout()
		local homeChance = penaltyConversionChance(homeSkill)
		local awayChance = penaltyConversionChance(awaySkill)
		do
			local guard = 0
			local _first3 = true
			while true do
				if not _first3 then
					guard += 1
				end
				_first3 = false
				if not ((guard < 200) and (not state.over)) then break end
				local side = nextShootoutSide(state)
				local chance = (if (side == "home") then homeChance else awayChance)
				state = takeNextKick(state, (rng() < chance), rosterSize)
			end
		end
		do return Js.O({ home = state.homeScore, away = state.awayScore, state = state }, { "home", "away", "state" }) end
	end
	exports.simulateShootout = simulateShootout
	settleAggregateTie = function(firstLegHome, firstLegAway, firstLegScore, secondLegScore90, secondLegHomeStrength, secondLegAwayStrength, competition, rng)
		local homeAgg90 = (firstLegScore.hs + secondLegScore90.as)
		local awayAgg90 = (firstLegScore.as + secondLegScore90.hs)
		if (homeAgg90 ~= awayAgg90) then
			do return Js.O({ firstLegHome = firstLegHome, firstLegAway = firstLegAway, firstLegScore = firstLegScore, secondLegScore = secondLegScore90, wentToPenalties = false, winner = (if (homeAgg90 > awayAgg90) then firstLegHome else firstLegAway) }, { "firstLegHome", "firstLegAway", "firstLegScore", "secondLegScore", "wentToPenalties", "winner" }) end
		end
		if (not hasExtraTime(competition, "knockout")) then
			local pens = simulateShootout(secondLegHomeStrength, secondLegAwayStrength, rng)
			do return Js.O({ firstLegHome = firstLegHome, firstLegAway = firstLegAway, firstLegScore = firstLegScore, secondLegScore = secondLegScore90, wentToPenalties = true, pens = Js.O({ home = pens.home, away = pens.away }, { "home", "away" }), winner = (if (pens.home > pens.away) then firstLegHome else firstLegAway) }, { "firstLegHome", "firstLegAway", "firstLegScore", "secondLegScore", "wentToPenalties", "pens", "winner" }) end
		end
		local et = extraTimeScore(secondLegHomeStrength, secondLegAwayStrength, rng)
		local secondLegFull = Js.O({ hs = (secondLegScore90.hs + et.hs), as = (secondLegScore90.as + et.as) }, { "hs", "as" })
		local homeAgg120 = (firstLegScore.hs + secondLegFull.as)
		local awayAgg120 = (firstLegScore.as + secondLegFull.hs)
		if (homeAgg120 ~= awayAgg120) then
			do return Js.O({ firstLegHome = firstLegHome, firstLegAway = firstLegAway, firstLegScore = firstLegScore, secondLegScore = secondLegFull, extraTime = et, wentToPenalties = false, winner = (if (homeAgg120 > awayAgg120) then firstLegHome else firstLegAway) }, { "firstLegHome", "firstLegAway", "firstLegScore", "secondLegScore", "extraTime", "wentToPenalties", "winner" }) end
		end
		local pens = simulateShootout(secondLegHomeStrength, secondLegAwayStrength, rng)
		do return Js.O({ firstLegHome = firstLegHome, firstLegAway = firstLegAway, firstLegScore = firstLegScore, secondLegScore = secondLegFull, extraTime = et, wentToPenalties = true, pens = Js.O({ home = pens.home, away = pens.away }, { "home", "away" }), winner = (if (pens.home > pens.away) then firstLegHome else firstLegAway) }, { "firstLegHome", "firstLegAway", "firstLegScore", "secondLegScore", "extraTime", "wentToPenalties", "pens", "winner" }) end
	end
	exports.settleAggregateTie = settleAggregateTie
	playKnockoutTie = function(homeStr, awayStr, competition, round, rng)
		local ninety = ninetyMinuteScore(homeStr, awayStr, rng)
		local hs = ninety.hs
		local as = ninety.as
		local wentToExtraTime = false
		if ((hs == as) and hasExtraTime(competition, round)) then
			wentToExtraTime = true
			local et = extraTimeScore(homeStr, awayStr, rng)
			hs += et.hs
			as += et.as
		end
		if (hs == as) then
			local shootout = simulateShootout(homeStr, awayStr, rng)
			do return Js.O({ hs = hs, as = as, wentToExtraTime = wentToExtraTime, pens = Js.O({ home = shootout.home, away = shootout.away }, { "home", "away" }) }, { "hs", "as", "wentToExtraTime", "pens" }) end
		end
		do return Js.O({ hs = hs, as = as, wentToExtraTime = wentToExtraTime }, { "hs", "as", "wentToExtraTime" }) end
	end
	exports.playKnockoutTie = playKnockoutTie
	INITIAL_KICKS_PER_SIDE = 5
	exports.INITIAL_KICKS_PER_SIDE = INITIAL_KICKS_PER_SIDE
end
