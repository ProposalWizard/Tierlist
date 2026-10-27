--!nocheck
--!nolint
-- Generated from lib/star/matchStats.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local M_wages = import("lib/star/wages")
	local M_sponsorDeals = import("lib/star/sponsorDeals")
	local M_relationships = import("lib/star/relationships")
	local liveRating, DRIBBLE_RATING, plural, fairRating, KEEP_GOOD, KEEP_BAD, keepShare, regressForMinutes, finaliseMatch
	liveRating = function(chances, goals, assists, passes, userScore, oppScore)
		local result = (if (userScore > oppScore) then 0.4 else (if (userScore < oppScore) then -0.3 else 0.1))
		local wasted = Math.max(0, (chances - (goals + assists)))
		local wastePenalty = Math.min(M_tuningStore.getTuning("rating.maxWastePenalty"), (wasted * M_tuningStore.getTuning("rating.wastePenaltyPerChance")))
		do return Math.max(1, Math.min(10, (((((6 + (goals * 1.2)) + (assists * 0.8)) + (passes * 0.05)) + result) - wastePenalty))) end
	end
	exports.liveRating = liveRating
	fairRating = function(t, userScore, oppScore)
		local parts = Js.alit()
		local add = function(label, value)
			if (math.abs(value) > 1e-9) then
				A.push(parts, Js.O({ label = label, value = value }, { "label", "value" }))
			end
		end
		local g = M_tuningStore.getTuning
		local gPen = (if t.goalsPen ~= nil then t.goalsPen else 0)
		local gTap = (if t.goalsTap ~= nil then t.goalsTap else 0)
		local gOut = (if t.goalsOut ~= nil then t.goalsOut else 0)
		local gBox = Math.max(0, (((t.goals - gPen) - gTap) - gOut))
		add((plural(gPen, "penalty", "penalties") .. " scored"), (gPen * g("rating.goalPenalty")))
		add(plural(gTap, "tap-in"), (gTap * g("rating.goalTapIn")))
		add((plural(gBox, "goal") .. " in the box"), (gBox * g("rating.goalBox")))
		add((plural(gOut, "goal") .. " from outside the box"), (gOut * g("rating.goalOutside")))
		add(plural(t.assists, "assist"), (t.assists * 0.8))
		local pSafe = (if t.passesSafe ~= nil then t.passesSafe else 0)
		local pAmb = (if t.passesAmb ~= nil then t.passesAmb else 0)
		local pMed = Math.max(0, ((t.passes - pSafe) - pAmb))
		add(plural(pSafe, "safe pass", "safe passes"), (pSafe * g("rating.passSafe")))
		add(plural(pMed, "pass", "passes"), (pMed * g("rating.passMedium")))
		add(plural(pAmb, "ambitious pass", "ambitious passes"), (pAmb * g("rating.passAmbitious")))
		add(plural(t.dribbles, "dribble won", "dribbles won"), (t.dribbles * DRIBBLE_RATING))
		add((if (userScore > oppScore) then "win" else (if (userScore < oppScore) then "defeat" else "draw")), (if (userScore > oppScore) then 0.4 else (if (userScore < oppScore) then -0.3 else 0.1)))
		local mOn = (if t.missesOn ~= nil then t.missesOn else 0)
		local mPen = (if t.missesPen ~= nil then t.missesPen else 0)
		local m1v1 = (if t.misses1v1 ~= nil then t.misses1v1 else 0)
		local mOff = Math.max(0, (((t.misses - mOn) - mPen) - m1v1))
		local costs = Js.alit(Js.alit((plural(m1v1, "one-on-one") .. " missed"), (m1v1 * g("rating.miss1v1"))), Js.alit((plural(mPen, "penalty", "penalties") .. " missed"), (mPen * g("rating.missPenalty"))), Js.alit((plural(mOff, "shot") .. " off target"), (mOff * g("rating.missOffTarget"))), Js.alit((plural(mOn, "shot") .. " saved or blocked"), (mOn * g("rating.missOnTarget"))), Js.alit(plural(t.lost, "ball lost", "balls lost"), (t.lost * g("rating.lostBall"))))
		local room = g("rating.maxWastePenalty")
		do
			local _arr1 = costs
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local label = _e3[1]
				local cost = _e3[2]
				local c = Math.min(room, cost)
				room -= c
				add(label, (-c))
			end
		end
		local rating = Math.max(1, Math.min(10, (6 + A.reduce(parts, function(a, p)
			return (a + p.value)
		end, 0))))
		do return Js.O({ rating = rating, parts = parts }, { "rating", "parts" }) end
	end
	exports.fairRating = fairRating
	keepShare = function(points, minutes)
		local m = Math.max(0, Math.min(90, minutes))
		for i = 1, (Js.alen(points)) - 1 do
			local _d4 = points[i]
			local m0 = _d4[1]
			local k0 = _d4[2]
			local _d5 = points[i + 1]
			local m1 = _d5[1]
			local k1 = _d5[2]
			if ((m <= m1) or (i == (Js.alen(points) - 1))) then
				do return Math.max(0, Math.min(1, (k0 + (((k1 - k0) * (m - m0)) / (m1 - m0))))) end
			end
		end
		do return 1 end
	end
	regressForMinutes = function(rating, minutes)
		local keep = keepShare((if (rating >= 6.5) then KEEP_GOOD else KEEP_BAD), minutes)
		do return Math.max(1, Math.min(10, (6.5 + ((rating - 6.5) * keep)))) end
	end
	exports.regressForMinutes = regressForMinutes
	finaliseMatch = function(chances, goals, assists, passes, minutes, userScore, oppScore, career, goalEvents, hooked, oppGoalEvents, fixture, tally)
		if goalEvents == nil then goalEvents = Js.alit() end
		if hooked == nil then hooked = nil end
		if oppGoalEvents == nil then oppGoalEvents = Js.alit() end
		local fair = (if tally then fairRating(Js.ospread(tally, Js.O({ goals = goals, assists = assists, passes = passes }, { "goals", "assists", "passes" })), userScore, oppScore) else nil)
		local raw = (if fair then fair.rating else liveRating(chances, goals, assists, passes, userScore, oppScore))
		local rating = regressForMinutes(raw, minutes)
		local starMan = ((rating >= 8.5) or (goals >= 2))
		local intl = ((function() local _v = fixture; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "international")
		local wage = (if intl then 0 else (if fixture then (M_wages.wageForFixture(career, fixture) + M_wages.midweekFeeFor(career, fixture)) else career.contract.wage))
		local goalBonus = (if intl then 0 else (goals * career.contract.goalBonus))
		local assistBonusPay = (if intl then 0 else (assists * career.contract.assistBonus))
		local sponsorPay = M_sponsorDeals.sponsorPayFor(career, fixture)
		local totalCash = (((wage + goalBonus) + assistBonusPay) + sponsorPay)
		local boss = 0
		local team = 0
		local fans = 0
		if (rating >= 8) then
			boss += 6
			fans += 8
			team += 3
		elseif (rating >= 7) then
			boss += 3
			fans += 4
			team += 2
		elseif (rating >= 6.7) then
			boss += 1
			fans += 1
			team += 1
		elseif (rating >= 6) then
		elseif (rating >= 5) then
			boss -= 3
			fans -= 4
			team -= 2
		else
			boss -= 6
			fans -= 8
			team -= 3
		end
		if (goals > 0) then
			fans += (goals * 3)
		end
		if (assists > 0) then
			team += (assists * 3)
			fans += assists
		end
		if starMan then
			boss += 4
			fans += 5
			team += 2
		end
		boss = M_relationships.capRel(boss)
		team = M_relationships.capRel(team)
		fans = M_relationships.capRel(fans)
		if intl then
			boss = 0
			team = 0
			fans = 0
		end
		do return Js.O({ chances = chances, goals = goals, assists = assists, passes = passes, minutes = minutes, hooked = hooked, rating = (Math.round((rating * 10)) / 10), rawRating = (Math.round((raw * 10)) / 10), starMan = starMan, bossChange = boss, teamChange = team, fansChange = fans, wage = wage, goalBonus = (goalBonus + assistBonusPay), sponsorPay = sponsorPay, totalCash = totalCash, homeScore = userScore, awayScore = oppScore, goalEvents = goalEvents, oppGoalEvents = oppGoalEvents }, { "chances", "goals", "assists", "passes", "minutes", "hooked", "rating", "rawRating", "starMan", "bossChange", "teamChange", "fansChange", "wage", "goalBonus", "sponsorPay", "totalCash", "homeScore", "awayScore", "goalEvents", "oppGoalEvents" }) end
	end
	exports.finaliseMatch = finaliseMatch
	DRIBBLE_RATING = 0.15
	exports.DRIBBLE_RATING = DRIBBLE_RATING
	plural = function(n, one, many)
		if many == nil then many = (one .. "s") end
		return (Js.numstr(n) .. " " .. (if (n == 1) then one else many))
	end
	KEEP_GOOD = Js.alit(Js.alit(20, (1.1 / 1.5)), Js.alit(45, (1.2 / 1.5)), Js.alit(60, (1.3 / 1.5)), Js.alit(90, 1))
	KEEP_BAD = Js.alit(Js.alit(20, (0.6 / 1.5)), Js.alit(45, (1.1 / 1.5)), Js.alit(60, 1), Js.alit(90, 1))
end
