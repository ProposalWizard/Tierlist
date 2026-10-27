--!nocheck
--!nolint
-- Generated from lib/star/contracts.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local offerClauses, rescaleClauses, clauseSummary, canTriggerClause, appearanceMoney, loyaltyMoney, RELEGATION_PAY_CUT, PROMOTION_PAY_RISE, contractForClubMove
	offerClauses = function(career, wage, rng)
		local star = career.starRating
		local out = Js.O({}, nil)
		if ((star < 3.4) or (rng() < M_tuningStore.getTuning("contracts.appearanceFeeChance"))) then
			out.appearanceFee = Math.max(1, Math.round((wage * M_tuningStore.getTuning("contracts.appearanceFeePct"))))
		end
		if ((star >= 3) and (rng() < M_tuningStore.getTuning("contracts.loyaltyBonusChance"))) then
			out.loyaltyBonus = Math.max(2, Math.round((wage * M_tuningStore.getTuning("contracts.loyaltyBonusPct"))))
		end
		if (rng() < M_tuningStore.getTuning("contracts.releaseClauseChance")) then
			local multiple = ((M_tuningStore.getTuning("contracts.releaseClauseBase") + (star * M_tuningStore.getTuning("contracts.releaseClauseStarMult"))) + (rng() * 10))
			out.releaseClause = Math.max(10, Math.round((wage * multiple)))
		end
		do return out end
	end
	exports.offerClauses = offerClauses
	rescaleClauses = function(clauses, fromWage, toWage)
		if (((not (fromWage > 0)) or (not (toWage > 0))) or (fromWage == toWage)) then
			do return Js.ospread(clauses) end
		end
		local factor = (toWage / fromWage)
		local out = Js.ospread(clauses)
		if (clauses.appearanceFee ~= nil) then
			out.appearanceFee = Math.max(1, Math.round((clauses.appearanceFee * factor)))
		end
		if (clauses.loyaltyBonus ~= nil) then
			out.loyaltyBonus = Math.max(2, Math.round((clauses.loyaltyBonus * factor)))
		end
		if (clauses.releaseClause ~= nil) then
			out.releaseClause = Math.max(10, Math.round((clauses.releaseClause * factor)))
		end
		do return out end
	end
	exports.rescaleClauses = rescaleClauses
	clauseSummary = function(contract)
		local out = Js.alit()
		if Js.T(contract.appearanceFee) then
			A.push(out, Js.O({ label = "Appearance fee", detail = ("★" .. Js.numstr(contract.appearanceFee) .. " every match you play") }, { "label", "detail" }))
		end
		if Js.T(contract.loyaltyBonus) then
			A.push(out, Js.O({ label = "Loyalty bonus", detail = ("★" .. Js.numstr(contract.loyaltyBonus) .. " at the end of every season you stay") }, { "label", "detail" }))
		end
		if Js.T(contract.releaseClause) then
			A.push(out, Js.O({ label = "Release clause", detail = ("★" .. Js.numstr(contract.releaseClause) .. " — at that price the club cannot refuse") }, { "label", "detail" }))
		end
		do return out end
	end
	exports.clauseSummary = clauseSummary
	canTriggerClause = function(contract, buyerStrength, wage)
		if (not Js.T(contract.releaseClause)) then
			do return false end
		end
		local means = Math.round((wage * (M_tuningStore.getTuning("contracts.buyerMeansBase") + ((buyerStrength / 100) * M_tuningStore.getTuning("contracts.buyerMeansStrengthMult")))))
		do return (means >= contract.releaseClause) end
	end
	exports.canTriggerClause = canTriggerClause
	appearanceMoney = function(contract)
		do return (if contract.appearanceFee ~= nil then contract.appearanceFee else 0) end
	end
	exports.appearanceMoney = appearanceMoney
	loyaltyMoney = function(contract, stayed)
		do return (if stayed then (if contract.loyaltyBonus ~= nil then contract.loyaltyBonus else 0) else 0) end
	end
	exports.loyaltyMoney = loyaltyMoney
	contractForClubMove = function(c, move)
		if (move == "relegated") then
			local k = (1 - RELEGATION_PAY_CUT)
			local wage = Math.max(1, Math.round((c.wage * k)))
			do return Js.ospread(c, rescaleClauses(c, c.wage, wage), Js.O({ wage = wage, goalBonus = Math.round((c.goalBonus * k)), assistBonus = Math.round((c.assistBonus * k)) }, { "wage", "goalBonus", "assistBonus" })) end
		end
		if (move == "promoted") then
			local wage = Math.max(1, Math.round((c.wage * (1 + PROMOTION_PAY_RISE))))
			local out = Js.ospread(c, Js.O({ wage = wage }, { "wage" }))
			if (c.releaseClause ~= nil) then
				out.releaseClause = rescaleClauses(Js.O({ releaseClause = c.releaseClause }, { "releaseClause" }), c.wage, wage).releaseClause
			end
			do return out end
		end
		do return c end
	end
	exports.contractForClubMove = contractForClubMove
	RELEGATION_PAY_CUT = 0.25
	exports.RELEGATION_PAY_CUT = RELEGATION_PAY_CUT
	PROMOTION_PAY_RISE = 0.25
	exports.PROMOTION_PAY_RISE = PROMOTION_PAY_RISE
end
