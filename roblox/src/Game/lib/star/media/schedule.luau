--!nocheck
--!nolint
-- Generated from lib/star/media/schedule.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local WINDOWS, clockAt, timeFor, FEED_HORIZON, FIRST_WAVE, visible, relativeTime
	clockAt = function(season, week, minutes)
		if minutes == nil then minutes = 0 end
		do return (((season * 1000000) + (week * 10000)) + Math.min(9999, Math.max(0, Math.round(minutes)))) end
	end
	exports.clockAt = clockAt
	timeFor = function(season, week, window, jitter)
		local _d1 = WINDOWS[window]
		local lo = _d1[1]
		local hi = _d1[2]
		do return clockAt(season, week, (lo + (jitter * (hi - lo)))) end
	end
	exports.timeFor = timeFor
	visible = function(posts, now, since)
		if since == nil then since = (-math.huge) end
		do return A.sort(A.filter(posts, function(p)
			return ((p.at <= now) and (p.at >= since))
		end), function(a, b)
			return (b.at - a.at)
		end) end
	end
	exports.visible = visible
	relativeTime = function(at, now)
		local season = math.floor((at / 1000000))
		local nowSeason = math.floor((now / 1000000))
		local week = math.floor((math.fmod(at, 1000000) / 10000))
		local nowWeek = math.floor((math.fmod(now, 1000000) / 10000))
		if (season ~= nowSeason) then
			do return ("S" .. Js.numstr(season) .. " W" .. Js.numstr(week)) end
		end
		local weeksAgo = (nowWeek - week)
		if (weeksAgo >= 2) then
			do return (Js.numstr(weeksAgo) .. "w") end
		end
		if (weeksAgo == 1) then
			do return "1w" end
		end
		local minutes = math.fmod(at, 10000)
		local nowMinutes = math.fmod(now, 10000)
		local diff = Math.max(0, (nowMinutes - minutes))
		if (diff < 1) then
			do return "now" end
		end
		if (diff < 60) then
			do return (Js.numstr(Math.round(diff)) .. "m") end
		end
		if (diff < 1440) then
			do return (Js.numstr(Math.round((diff / 60))) .. "h") end
		end
		do return (Js.numstr(Math.round((diff / 1440))) .. "d") end
	end
	exports.relativeTime = relativeTime
	WINDOWS = Js.O({ instant = Js.alit(0, 14), hour = Js.alit(15, 90), evening = Js.alit(150, 400), nextDay = Js.alit(1000, 1250), weekly = Js.alit(2600, 3000) }, { "instant", "hour", "evening", "nextDay", "weekly" })
	FEED_HORIZON = (4 * 10000)
	exports.FEED_HORIZON = FEED_HORIZON
	FIRST_WAVE = 90
	exports.FIRST_WAVE = FIRST_WAVE
end
