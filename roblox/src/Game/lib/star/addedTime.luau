--!nocheck
--!nolint
-- Generated from lib/star/addedTime.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local ADDED_TIME_WEIGHTS, rollAddedTime, addedTimeSeed, minuteLabel
	rollAddedTime = function(rng)
		local r = rng()
		for i = 0, (Js.alen(ADDED_TIME_WEIGHTS)) - 1 do
			r -= ADDED_TIME_WEIGHTS[i + 1]
			if (r < 0) then
				do return (i + 1) end
			end
		end
		do return Js.alen(ADDED_TIME_WEIGHTS) end
	end
	exports.rollAddedTime = rollAddedTime
	addedTimeSeed = function(matchSeed)
		do return Js.ushr(Js.bxor(Math.imul(Js.ushr(matchSeed, 0), 2654435761), 6221200), 0) end
	end
	exports.addedTimeSeed = addedTimeSeed
	minuteLabel = function(minute, added, regulation)
		if added == nil then added = 0 end
		if regulation == nil then regulation = 90 end
		if ((minute <= regulation) or (added <= 0)) then
			do return (Js.numstr(minute)) end
		end
		if (minute <= (regulation + added)) then
			do return (Js.numstr(regulation) .. "+" .. Js.numstr((minute - regulation))) end
		end
		do return (Js.numstr((minute - added))) end
	end
	exports.minuteLabel = minuteLabel
	ADDED_TIME_WEIGHTS = Js.alit(0.1, 0.2, 0.3, 0.25, 0.15)
	exports.ADDED_TIME_WEIGHTS = ADDED_TIME_WEIGHTS
end
