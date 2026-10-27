--!nocheck
--!nolint
-- Generated from lib/star/matchLog.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local HALF_TIME_MINUTE, nextId, line, linesFrom, halfTimeSplit, dwellFor
	line = function(text, tone, minute, isOpponent)
		if tone == nil then tone = "play" end
		do return Js.O({ id = (function() local _o = nextId; nextId = _o + 1; return _o end)(), text = text, tone = tone, minute = minute, isOpponent = isOpponent }, { "id", "text", "tone", "minute", "isOpponent" }) end
	end
	exports.line = line
	linesFrom = function(events, startAfterMinute)
		if startAfterMinute == nil then startAfterMinute = -1 end
		local out = Js.alit()
		local last = startAfterMinute
		do
			local _arr1 = events
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local e = _arr1[_i2]
				local tone = (if e.tone ~= nil then e.tone else (if e.isGoal then (if e.isOpponent then "oppGoal" else "goal") else "play"))
				local showMinute = ((e.minute ~= last) and (e.tone ~= "assist"))
				A.push(out, line(e.text, tone, (if showMinute then e.minute else nil), e.isOpponent))
				last = e.minute
			end
		end
		do return out end
	end
	exports.linesFrom = linesFrom
	halfTimeSplit = function(lines, alreadyShown)
		if alreadyShown then
			do return -1 end
		end
		for i = 0, (Js.alen(lines)) - 1 do
			local m = lines[i + 1].minute
			if ((m ~= nil) and (m > HALF_TIME_MINUTE)) then
				do return i end
			end
		end
		do return -1 end
	end
	exports.halfTimeSplit = halfTimeSplit
	dwellFor = function(tone, speed)
		local base = (if ((tone == "goal") or (tone == "oppGoal")) then 1700 else (if (tone == "assist") then 1100 else (if (tone == "period") then 1350 else (if (tone == "chance") then 1000 else 700))))
		do return Math.max(60, Math.round((base / Math.max(1, speed)))) end
	end
	exports.dwellFor = dwellFor
	HALF_TIME_MINUTE = 45
	exports.HALF_TIME_MINUTE = HALF_TIME_MINUTE
	nextId = 1
end
