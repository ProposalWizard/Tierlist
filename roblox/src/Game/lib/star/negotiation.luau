--!nocheck
--!nolint
-- Generated from lib/star/negotiation.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local moodBucket, moodToFace, randBetween, cleanRound, startNegotiation, limitOf, beyondLimit, insulting, meets, makeOffer
	moodBucket = function(score)
		if (score >= 65) then
			do return "happy" end
		end
		if (score >= 35) then
			do return "neutral" end
		end
		do return "angry" end
	end
	moodToFace = function(state)
		do return moodBucket(state.moodScore) end
	end
	exports.moodToFace = moodToFace
	randBetween = function(rng, min, max)
		do return (min + (rng() * (max - min))) end
	end
	cleanRound = function(amount)
		local sign = (if (amount < 0) then -1 else 1)
		local a = math.abs(amount)
		local step = (if (a < 100) then 1 else (if (a < 1000) then 10 else (if (a < 5000) then 100 else (if (a < 50000) then 500 else (if (a < 500000) then 5000 else (if (a < 5000000) then 50000 else (if (a < 50000000) then 500000 else 5000000)))))))
		do return (sign * Math.max(step, (Math.round((a / step)) * step))) end
	end
	startNegotiation = function(marketValue, mode, rng)
		local theirPosition = cleanRound((if (mode == "buying") then (marketValue * (1 + randBetween(rng, M_tuningStore.getTuning("negotiation.sellerAnchorMin"), M_tuningStore.getTuning("negotiation.sellerAnchorMax")))) else (marketValue * (1 - randBetween(rng, M_tuningStore.getTuning("negotiation.buyerAnchorMin"), M_tuningStore.getTuning("negotiation.buyerAnchorMax"))))))
		local yourPosition = cleanRound((if (mode == "buying") then (marketValue * (1 - randBetween(rng, M_tuningStore.getTuning("negotiation.buyerAnchorMin"), M_tuningStore.getTuning("negotiation.buyerAnchorMax")))) else (marketValue * (1 + randBetween(rng, M_tuningStore.getTuning("negotiation.sellerAnchorMin"), M_tuningStore.getTuning("negotiation.sellerAnchorMax"))))))
		do return Js.O({ marketValue = marketValue, mode = mode, round = 0, yourPosition = yourPosition, theirPosition = theirPosition, moodScore = 60, status = "negotiating", log = Js.alit((if (mode == "buying") then ("Their agent opens at ★" .. N.toLocaleString(theirPosition) .. ".") else ("An interested buyer opens at ★" .. N.toLocaleString(theirPosition) .. "."))) }, { "marketValue", "mode", "round", "yourPosition", "theirPosition", "moodScore", "status", "log" }) end
	end
	exports.startNegotiation = startNegotiation
	limitOf = function(state)
		if (state.limit ~= nil) then
			do return state.limit end
		end
		local m = M_tuningStore.getTuning("negotiation.limitMargin")
		do return (if (state.mode == "selling") then (state.marketValue * (1 + m)) else (state.marketValue * (1 - m))) end
	end
	exports.limitOf = limitOf
	beyondLimit = function(mode, position, limit)
		do return (if (mode == "selling") then (position > limit) else (position < limit)) end
	end
	insulting = function(mode, position, limit)
		local k = M_tuningStore.getTuning("negotiation.outrageousMultiple")
		do return (if (mode == "selling") then (position > (limit * k)) else (position < (limit / k))) end
	end
	meets = function(mode, offer, target)
		do return (if (mode == "buying") then (offer >= target) else (offer <= target)) end
	end
	makeOffer = function(state, yourNewPosition, rng)
		if (state.status ~= "negotiating") then
			do return state end
		end
		local _d1 = state
		local mode = _d1.mode
		local log = Js.aspread(state.log)
		if meets(mode, yourNewPosition, state.theirPosition) then
			local finalPrice = yourNewPosition
			A.push(log, (if (mode == "buying") then ("Deal — they accept your ★" .. N.toLocaleString(finalPrice) .. " offer.") else ("Deal — the buyer accepts your ★" .. N.toLocaleString(finalPrice) .. " asking price.")))
			do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, status = "accepted", finalPrice = finalPrice, log = log }, { "yourPosition", "status", "finalPrice", "log" })) end
		end
		if state.finalOffer then
			A.push(log, (if (mode == "buying") then "They told you it was final. The agent walks away." else "They told you it was final. They walk away."))
			do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, moodScore = 0, status = "walked_away", log = log }, { "yourPosition", "moodScore", "status", "log" })) end
		end
		local limit = limitOf(state)
		local opening = (if state.opening ~= nil then state.opening else state.theirPosition)
		local cut = M_tuningStore.getTuning("negotiation.finalOfferCut")
		local worst = cleanRound((if (mode == "buying") then (opening * (1 + cut)) else Math.max(1, (opening * (1 - cut)))))
		local insult = insulting(mode, yourNewPosition, limit)
		local pastLimit = beyondLimit(mode, yourNewPosition, limit)
		local gap = math.abs((state.theirPosition - yourNewPosition))
		local relativeGap = (gap / Math.max(1, state.theirPosition))
		if ((not pastLimit) and (relativeGap <= M_tuningStore.getTuning("negotiation.acceptTolerance"))) then
			local finalPrice = yourNewPosition
			A.push(log, ("Close enough — they accept ★" .. N.toLocaleString(finalPrice) .. "."))
			do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, status = "accepted", finalPrice = finalPrice, log = log }, { "yourPosition", "status", "finalPrice", "log" })) end
		end
		local priorGap = math.abs((state.theirPosition - state.yourPosition))
		local movedToward = (gap < (priorGap - 0.000001))
		local moodScore = (state.moodScore + (if insult then -40 else (if pastLimit then (if movedToward then -4 else -15) else (if movedToward then 6 else -12))))
		moodScore = Math.max(0, Math.min(100, moodScore))
		local round = (state.round + 1)
		local you = ((if (mode == "buying") then "You offer" else "You ask") .. " ★" .. N.toLocaleString(yourNewPosition))
		local baseRisk = (if insult then (1 - M_tuningStore.getTuning("negotiation.insultCounterChance")) else (if pastLimit then M_tuningStore.getTuning("negotiation.cheekyRisk") else M_tuningStore.getTuning("negotiation.fairRisk")))
		local moodFactor = Math.max(0.6, Math.min(2, (1 + ((55 - moodScore) / 55))))
		local risk = Math.min(0.97, (baseRisk * moodFactor))
		if (rng() < risk) then
			local walkShare = (if insult then M_tuningStore.getTuning("negotiation.insultWalkChance") else (if pastLimit then 0.3 else 0.2))
			local worstShare = (if insult then 0.45 else (if pastLimit then 0.35 else 0.3))
			local r = rng()
			if (r < walkShare) then
				A.push(log, (if insult then (you .. " — insulted, " .. (if (mode == "buying") then "the agent walks" else "they walk") .. " away.") else (you .. " — " .. (if (mode == "buying") then "the agent has" else "they've") .. " had enough and " .. (if (mode == "buying") then "walks" else "walk") .. " away.")))
				do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, moodScore = 0, round = round, opening = opening, status = "walked_away", log = log }, { "yourPosition", "moodScore", "round", "opening", "status", "log" })) end
			end
			local dropToWorst = ((r < (walkShare + worstShare)) and (worst ~= state.theirPosition))
			local final = (if dropToWorst then worst else state.theirPosition)
			A.push(log, (if dropToWorst then (you .. " — " .. (if insult then "insulted. " else "annoyed. ") .. (if (mode == "buying") then "Final price" else "Final offer") .. ": ★" .. N.toLocaleString(final) .. ", take it or leave it.") else (you .. " — they won't budge. ★" .. N.toLocaleString(final) .. " is final, take it or leave it.")))
			do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, theirPosition = final, moodScore = Math.min(moodScore, 30), round = round, opening = opening, finalOffer = true, log = log }, { "yourPosition", "theirPosition", "moodScore", "round", "opening", "finalOffer", "log" })) end
		end
		local target = (if pastLimit then limit else yourNewPosition)
		local towardGap = math.abs((state.theirPosition - target))
		local moodMultiplier = Math.max(0.4, Math.min(1.6, (moodScore / 60)))
		local share = Math.min(1, ((M_tuningStore.getTuning("negotiation.concessionRate") * randBetween(rng, 0.4, 2.4)) * moodMultiplier))
		local moved = (if (mode == "buying") then Math.max(limit, (state.theirPosition - (towardGap * share))) else Math.min(limit, (state.theirPosition + (towardGap * share))))
		local rounded = cleanRound(moved)
		local theirPosition = (if (mode == "buying") then Math.max(rounded, Math.min(state.theirPosition, math.ceil(limit))) else Math.min(rounded, Math.max(state.theirPosition, math.floor(limit))))
		local theyActuallyMoved = (theirPosition ~= state.theirPosition)
		if theyActuallyMoved then
			A.push(log, (if (mode == "buying") then ("You offer ★" .. N.toLocaleString(yourNewPosition) .. " — they come down to ★" .. N.toLocaleString(theirPosition) .. ".") else ("You ask ★" .. N.toLocaleString(yourNewPosition) .. " — they raise their offer to ★" .. N.toLocaleString(theirPosition) .. ".")))
		else
			A.push(log, (if (mode == "buying") then ("You offer ★" .. N.toLocaleString(yourNewPosition) .. " — they're standing firm at ★" .. N.toLocaleString(theirPosition) .. ".") else ("You ask ★" .. N.toLocaleString(yourNewPosition) .. " — they're standing firm at ★" .. N.toLocaleString(theirPosition) .. ".")))
		end
		if (round >= M_tuningStore.getTuning("negotiation.maxRounds")) then
			local finalGap = math.abs((theirPosition - yourNewPosition))
			local finalRelativeGap = (finalGap / Math.max(1, theirPosition))
			if ((not pastLimit) and (finalRelativeGap <= M_tuningStore.getTuning("negotiation.acceptTolerance"))) then
				local finalPrice = yourNewPosition
				A.push(log, ("Final round — close enough, they accept ★" .. N.toLocaleString(finalPrice) .. "."))
				do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, theirPosition = theirPosition, moodScore = moodScore, round = round, opening = opening, status = "accepted", finalPrice = finalPrice, log = log }, { "yourPosition", "theirPosition", "moodScore", "round", "opening", "status", "finalPrice", "log" })) end
			end
			A.push(log, "Talks run out of time with no deal.")
			do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, theirPosition = theirPosition, moodScore = moodScore, round = round, opening = opening, status = "rejected", log = log }, { "yourPosition", "theirPosition", "moodScore", "round", "opening", "status", "log" })) end
		end
		do return Js.ospread(state, Js.O({ yourPosition = yourNewPosition, theirPosition = theirPosition, moodScore = moodScore, round = round, opening = opening, status = "negotiating", log = log }, { "yourPosition", "theirPosition", "moodScore", "round", "opening", "status", "log" })) end
	end
	exports.makeOffer = makeOffer
end
