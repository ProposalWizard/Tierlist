--!nocheck
--!nolint
-- Generated from lib/star/stretchRun.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_hiddenMatch = import("lib/star/hiddenMatch")
	local HANDED_PEN_CONVERT, HANDED_FK_CONVERT, runStretch
	runStretch = function(st, inputs, rng, stretchEnd, mayTake, lead, dropEarlierRuns)
		if lead == nil then lead = Js.alit() end
		if dropEarlierRuns == nil then dropEarlierRuns = false end
		local all = Js.aspread(lead)
		local handedOver = Js.aspread(lead)
		local step = M_hiddenMatch.advanceUntilInvolved(st, inputs, rng, stretchEnd)
		for guard = 0, 19 do
			local kind = (if ((function() local _v = step.request; if _v == nil then return nil end; _v = _v.kinds; _v = Js.len(_v); return _v end)() == 1) then step.request.kinds[1] else nil)
			if (((not Js.T(kind)) or mayTake(kind)) or ((kind ~= "free_kick") and (kind ~= "penalty"))) then
				do break end
			end
			if ((kind == "penalty") and (function() local _v = step.request; if _v == nil then return nil end; _v = _v.penaltyWon; return _v end)()) then
				do break end
			end
			A.push(all, Js.unpack(step.events))
			local label = (if (kind == "penalty") then "penalty" else "free kick")
			local scored = (rng() < (if (kind == "penalty") then HANDED_PEN_CONVERT else HANDED_FK_CONVERT))
			local line = (if scored then Js.O({ minute = st.minute, text = ("⚽ Your side score the " .. label .. "!"), isGoal = true, teammateGoal = true }, { "minute", "text", "isGoal", "teammateGoal" }) else Js.O({ minute = st.minute, text = ("A " .. label .. " — someone else steps up, and it comes to nothing.") }, { "minute", "text" }))
			A.push(all, line)
			A.push(handedOver, line)
			M_hiddenMatch.resolveScenario(st, (if scored then "goal" else "saved"))
			step = M_hiddenMatch.advanceUntilInvolved(st, inputs, rng, stretchEnd)
		end
		A.push(all, Js.unpack(step.events))
		do return Js.ospread(step, Js.O({ events = (if dropEarlierRuns then Js.aspread(handedOver, step.events) else all) }, { "events" })) end
	end
	exports.runStretch = runStretch
	HANDED_PEN_CONVERT = 0.76
	exports.HANDED_PEN_CONVERT = HANDED_PEN_CONVERT
	HANDED_FK_CONVERT = 0.09
	exports.HANDED_FK_CONVERT = HANDED_FK_CONVERT
end
