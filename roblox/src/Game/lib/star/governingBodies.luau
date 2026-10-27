--!nocheck
--!nolint
-- Generated from lib/star/governingBodies.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_economy = import("lib/star/economy")
	local GOVERNING_BODIES, GOVERNING_BODY_COMPETITIONS, influenceIn, clampInfluence, INFLUENCE_WEEKS_PER_POINT, MONEY_PER_INFLUENCE_POINT, FULL_INFLUENCE_COST, investInfluence, RULE_PROPOSAL_INFLUENCE_THRESHOLD, canProposeRuleChange
	influenceIn = function(career, body)
		do return ((function() local _v = career.governingBodyInfluence; if _v == nil then return nil end; _v = _v[body]; return _v end)() or 0) end
	end
	exports.influenceIn = influenceIn
	clampInfluence = function(n)
		do return Math.max(0, Math.min(100, n)) end
	end
	investInfluence = function(career, body, amount)
		if (amount <= 0) then
			do return Js.O({ ok = false, reason = "Invest a positive amount" }, { "ok", "reason" }) end
		end
		if (amount > career.money) then
			do return Js.O({ ok = false, reason = "Not enough money" }, { "ok", "reason" }) end
		end
		local gained = (amount / MONEY_PER_INFLUENCE_POINT)
		local next_ = clampInfluence((influenceIn(career, body) + gained))
		do return Js.ospread(career, Js.O({ money = (career.money - amount), governingBodyInfluence = Js.ospread((if career.governingBodyInfluence ~= nil then career.governingBodyInfluence else Js.O({}, nil)), (function() local _o = Js.O({}, nil); _o[Js.key(body)] = next_; return _o end)()) }, { "money", "governingBodyInfluence" })) end
	end
	exports.investInfluence = investInfluence
	canProposeRuleChange = function(career, body)
		do return (influenceIn(career, body) >= RULE_PROPOSAL_INFLUENCE_THRESHOLD) end
	end
	exports.canProposeRuleChange = canProposeRuleChange
	GOVERNING_BODIES = Js.alit("FA", "UEFA", "FIFA", "CONMEBOL")
	exports.GOVERNING_BODIES = GOVERNING_BODIES
	GOVERNING_BODY_COMPETITIONS = Js.O({ FA = Js.alit("Premier League", "Championship", "FA Cup", "League Cup"), UEFA = Js.alit("Champions League", "Europa League", "Conference League"), FIFA = Js.alit("World Cup"), CONMEBOL = Js.alit("Copa América") }, { "FA", "UEFA", "FIFA", "CONMEBOL" })
	exports.GOVERNING_BODY_COMPETITIONS = GOVERNING_BODY_COMPETITIONS
	INFLUENCE_WEEKS_PER_POINT = 1
	exports.INFLUENCE_WEEKS_PER_POINT = INFLUENCE_WEEKS_PER_POINT
	MONEY_PER_INFLUENCE_POINT = M_economy.tierPrice("world_class", INFLUENCE_WEEKS_PER_POINT)
	exports.MONEY_PER_INFLUENCE_POINT = MONEY_PER_INFLUENCE_POINT
	FULL_INFLUENCE_COST = (MONEY_PER_INFLUENCE_POINT * 100)
	exports.FULL_INFLUENCE_COST = FULL_INFLUENCE_COST
	RULE_PROPOSAL_INFLUENCE_THRESHOLD = 40
	exports.RULE_PROPOSAL_INFLUENCE_THRESHOLD = RULE_PROPOSAL_INFLUENCE_THRESHOLD
end
