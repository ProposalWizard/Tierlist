--!nocheck
--!nolint
-- Generated from lib/star/reputation.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local REPUTATION_START, NEW_CAREER_REPUTATION, REPUTATION_RECOMMEND_MIN, REPUTATION_PROPOSE_RULES_MIN, REPUTATION_PRESIDENCY_MIN, REPUTATION_EVENTS, cheekyMissReputation, clampReputation, changeReputation, withReputation, reputationVoteBias, migrateReputation, reputationLabel
	cheekyMissReputation = function(misses)
		local n = Math.max(0, math.floor((if Js.NumberNS.isFinite(misses) then misses else 0)))
		do return Math.max((2 * REPUTATION_EVENTS.cheekyMiss), (n * REPUTATION_EVENTS.cheekyMiss)) end
	end
	exports.cheekyMissReputation = cheekyMissReputation
	clampReputation = function(n)
		do return Math.max(0, Math.min(100, Math.round((if Js.NumberNS.isFinite(n) then n else 0)))) end
	end
	exports.clampReputation = clampReputation
	changeReputation = function(rep, delta)
		do return clampReputation((rep + delta)) end
	end
	exports.changeReputation = changeReputation
	withReputation = function(career, delta)
		do return Js.ospread(career, Js.O({ reputation = changeReputation(career.reputation, delta) }, { "reputation" })) end
	end
	exports.withReputation = withReputation
	reputationVoteBias = function(rep)
		do return ((clampReputation(rep) - 50) / 50) end
	end
	exports.reputationVoteBias = reputationVoteBias
	migrateReputation = function(old)
		if (type(old) == "number") then
			do return clampReputation(old) end
		end
		if (Js.T(old) and (type(old) == "table")) then
			local vals = A.filter(A.map(Js.alit("world", "club", "government", "shareholders"), function(k)
				return old[k]
			end), function(v)
				return ((type(v) == "number") and Js.NumberNS.isFinite(v))
			end)
			if (Js.alen(vals) > 0) then
				do return clampReputation((A.reduce(vals, function(a, b)
					return (a + b)
				end, 0) / Js.alen(vals))) end
			end
		end
		do return REPUTATION_START end
	end
	exports.migrateReputation = migrateReputation
	reputationLabel = function(rep)
		local r = clampReputation(rep)
		if (r >= REPUTATION_PRESIDENCY_MIN) then
			do return "Establishment" end
		end
		if (r >= REPUTATION_PROPOSE_RULES_MIN) then
			do return "Respected" end
		end
		if (r >= REPUTATION_RECOMMEND_MIN) then
			do return "Trusted" end
		end
		if (r >= 15) then
			do return "Unproven" end
		end
		if (r < 1) then
			do return "Unknown" end
		end
		do return "Distrusted" end
	end
	exports.reputationLabel = reputationLabel
	REPUTATION_START = 20
	exports.REPUTATION_START = REPUTATION_START
	NEW_CAREER_REPUTATION = 0
	exports.NEW_CAREER_REPUTATION = NEW_CAREER_REPUTATION
	REPUTATION_RECOMMEND_MIN = 30
	exports.REPUTATION_RECOMMEND_MIN = REPUTATION_RECOMMEND_MIN
	REPUTATION_PROPOSE_RULES_MIN = 60
	exports.REPUTATION_PROPOSE_RULES_MIN = REPUTATION_PROPOSE_RULES_MIN
	REPUTATION_PRESIDENCY_MIN = 90
	exports.REPUTATION_PRESIDENCY_MIN = REPUTATION_PRESIDENCY_MIN
	REPUTATION_EVENTS = Js.O({ voteHeld = 2, overruledVote = -5, recommendationAdopted = 1, ownedClubBeatExpectations = 3, ownedClubTrophyOrPromotion = 5, ownedClubRelegated = -4, personalTrophy = 2, cleanSeason = 1, goodCause = 2, caughtCheating = -15, mergedClubs = -20, transferRequest = -2, cheekyMiss = -1 }, { "voteHeld", "overruledVote", "recommendationAdopted", "ownedClubBeatExpectations", "ownedClubTrophyOrPromotion", "ownedClubRelegated", "personalTrophy", "cleanSeason", "goodCause", "caughtCheating", "mergedClubs", "transferRequest", "cheekyMiss" })
	exports.REPUTATION_EVENTS = REPUTATION_EVENTS
end
