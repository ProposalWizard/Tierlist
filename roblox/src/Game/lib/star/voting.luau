--!nocheck
--!nolint
-- Generated from lib/star/voting.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_reputation = import("lib/star/reputation")
	local ABSTENTION_RATE, MAX_SWING, castVote, OVERRULE_OWNERSHIP_THRESHOLD, OVERRULE_REPUTATION_COST, VOTE_HELD_REPUTATION_GAIN, applyVoteHeldReputation, applyOverruleReputationCost
	castVote = function(question, options, electorate, favoredOptionId, biasStrength, rng)
		local counts = Js.O({}, nil)
		do
			local _arr1 = options
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local o = _arr1[_i2]
				counts[o.id] = 0
			end
		end
		local n = Js.alen(options)
		local hasFavorite = ((favoredOptionId ~= nil) and A.some(options, function(o)
			return (o.id == favoredOptionId)
		end))
		local swing = (Math.max(-1, Math.min(1, biasStrength)) * MAX_SWING)
		local favoredShare = (if hasFavorite then ((1 / n) + (swing * (1 - (1 / n)))) else (1 / n))
		local otherShare = (if (hasFavorite and (n > 1)) then ((1 - favoredShare) / (n - 1)) else (1 / n))
		local shareFor = function(id)
			return (if (hasFavorite and (id == favoredOptionId)) then favoredShare else otherShare)
		end
		local abstentions = 0
		for i = 0, math.ceil(electorate) - 1 do
			local roll = rng()
			if (roll < ABSTENTION_RATE) then
				abstentions += 1
				do continue end
			end
			local pick = rng()
			local acc = 0
			local chosen = options[n].id
			do
				local _arr3 = options
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local o = _arr3[_i4]
					acc += shareFor(o.id)
					if (pick < acc) then
						chosen = o.id
						do break end
					end
				end
			end
			counts[chosen] += 1
		end
		local winner = options[1].id
		do
			local _arr5 = options
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local o = _arr5[_i6]
				if (counts[o.id] > counts[winner]) then
					winner = o.id
				end
			end
		end
		do return Js.O({ question = question, options = options, electorate = electorate, counts = counts, abstentions = abstentions, winner = winner }, { "question", "options", "electorate", "counts", "abstentions", "winner" }) end
	end
	exports.castVote = castVote
	applyVoteHeldReputation = function(rep)
		do return M_reputation.clampReputation((rep + VOTE_HELD_REPUTATION_GAIN)) end
	end
	exports.applyVoteHeldReputation = applyVoteHeldReputation
	applyOverruleReputationCost = function(rep)
		do return M_reputation.clampReputation((rep - OVERRULE_REPUTATION_COST)) end
	end
	exports.applyOverruleReputationCost = applyOverruleReputationCost
	ABSTENTION_RATE = 0.003
	exports.ABSTENTION_RATE = ABSTENTION_RATE
	MAX_SWING = 0.3
	OVERRULE_OWNERSHIP_THRESHOLD = 75
	exports.OVERRULE_OWNERSHIP_THRESHOLD = OVERRULE_OWNERSHIP_THRESHOLD
	OVERRULE_REPUTATION_COST = (-M_reputation.REPUTATION_EVENTS.overruledVote)
	exports.OVERRULE_REPUTATION_COST = OVERRULE_REPUTATION_COST
	VOTE_HELD_REPUTATION_GAIN = M_reputation.REPUTATION_EVENTS.voteHeld
	exports.VOTE_HELD_REPUTATION_GAIN = VOTE_HELD_REPUTATION_GAIN
end
