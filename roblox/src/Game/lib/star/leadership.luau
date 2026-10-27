--!nocheck
--!nolint
-- Generated from lib/star/leadership.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_governingBodies = import("lib/star/governingBodies")
	local M_voting = import("lib/star/voting")
	local M_reputation = import("lib/star/reputation")
	local PRESIDENCY_REPUTATION_THRESHOLD, PRESIDENCY_INFLUENCE_THRESHOLD, PRESIDENCY_ELECTORATE, isBodyPresident, canStandForBodyPresidency, proposeBodyPresidencyVote, PRESIDENCY_OVERRULE_REPUTATION, PRESIDENCY_OVERRULE_INFLUENCE, PRESIDENCY_VOTE_HELD_GAIN, PRESIDENCY_OVERRULE_COST, canOverrulePresidencyVote, nudgeWorld, resolveBodyPresidencyVote
	isBodyPresident = function(career, body)
		do return A.includes((if career.governingBodyPresidencies ~= nil then career.governingBodyPresidencies else Js.alit()), body) end
	end
	exports.isBodyPresident = isBodyPresident
	canStandForBodyPresidency = function(career, body)
		do return (((not isBodyPresident(career, body)) and (career.reputation >= PRESIDENCY_REPUTATION_THRESHOLD)) and (M_governingBodies.influenceIn(career, body) >= PRESIDENCY_INFLUENCE_THRESHOLD)) end
	end
	exports.canStandForBodyPresidency = canStandForBodyPresidency
	proposeBodyPresidencyVote = function(career, body, rng)
		if (not canStandForBodyPresidency(career, body)) then
			do return Js.O({ ok = false, reason = (if isBodyPresident(career, body) then "Already president of this body" else ("Needs " .. Js.numstr(PRESIDENCY_REPUTATION_THRESHOLD) .. "+ reputation and " .. Js.numstr(PRESIDENCY_INFLUENCE_THRESHOLD) .. "+ influence in this body")) }, { "ok", "reason" }) end
		end
		local biasStrength = ((career.reputation - 50) / 50)
		local tally = M_voting.castVote(("Elect you president of " .. body .. "?"), Js.alit(Js.O({ id = "yes", label = "Elect" }, { "id", "label" }), Js.O({ id = "no", label = "Reject" }, { "id", "label" })), PRESIDENCY_ELECTORATE, "yes", biasStrength, rng)
		do return Js.O({ ok = true, proposal = Js.O({ body = body, tally = tally }, { "body", "tally" }) }, { "ok", "proposal" }) end
	end
	exports.proposeBodyPresidencyVote = proposeBodyPresidencyVote
	canOverrulePresidencyVote = function(career, body)
		do return ((career.reputation >= PRESIDENCY_OVERRULE_REPUTATION) and (M_governingBodies.influenceIn(career, body) >= PRESIDENCY_OVERRULE_INFLUENCE)) end
	end
	exports.canOverrulePresidencyVote = canOverrulePresidencyVote
	nudgeWorld = function(reputation, delta)
		do return M_reputation.clampReputation((reputation + delta)) end
	end
	resolveBodyPresidencyVote = function(career, proposal, overrule)
		local next_ = Js.ospread(career, Js.O({ reputation = nudgeWorld(career.reputation, PRESIDENCY_VOTE_HELD_GAIN) }, { "reputation" }))
		local passed = (proposal.tally.winner == "yes")
		if ((not passed) and overrule) then
			if (not canOverrulePresidencyVote(next_, proposal.body)) then
				do return Js.O({ career = next_, ok = false, reason = "Not enough standing to overrule this vote" }, { "career", "ok", "reason" }) end
			end
			next_ = Js.ospread(next_, Js.O({ reputation = nudgeWorld(next_.reputation, (-PRESIDENCY_OVERRULE_COST)) }, { "reputation" }))
		elseif (not passed) then
			do return Js.O({ career = next_, ok = false, reason = "The vote was rejected" }, { "career", "ok", "reason" }) end
		end
		do return Js.O({ career = Js.ospread(next_, Js.O({ governingBodyPresidencies = Js.aspread((if next_.governingBodyPresidencies ~= nil then next_.governingBodyPresidencies else Js.alit()), Js.alit(proposal.body)) }, { "governingBodyPresidencies" })), ok = true }, { "career", "ok" }) end
	end
	exports.resolveBodyPresidencyVote = resolveBodyPresidencyVote
	PRESIDENCY_REPUTATION_THRESHOLD = 90
	PRESIDENCY_INFLUENCE_THRESHOLD = 90
	PRESIDENCY_ELECTORATE = 500
	PRESIDENCY_OVERRULE_REPUTATION = 95
	PRESIDENCY_OVERRULE_INFLUENCE = 95
	PRESIDENCY_VOTE_HELD_GAIN = 3
	PRESIDENCY_OVERRULE_COST = 20
end
