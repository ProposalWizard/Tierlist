--!nocheck
--!nolint
-- Generated from lib/star/wages.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local sameFixture, wageShareFor, wageForFixture, MIDWEEK_FEE_SHARE, isMidweekFixture, midweekFeeFor
	sameFixture = function(a, b)
		do return (((a.week == b.week) and ((if a.kind ~= nil then a.kind else "league") == (if b.kind ~= nil then b.kind else "league"))) and (a.opponent == b.opponent)) end
	end
	wageShareFor = function(career, fixture)
		if (fixture.kind == "international") then
			local division = M_calendar.divisionOf(career)
			local tournament = A.includes(Js.alit("World Cup", "European Championship", "Copa América", "Africa Cup of Nations", "Asian Cup", "Gold Cup", "OFC Nations Cup"), (if fixture.competition ~= nil then fixture.competition else ""))
			if ((not M_calendar.stopsForBreaks(division)) or tournament) then
				do return 0 end
			end
			local t = M_calendar.fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, division)
			do return (if (Js.Date.new(t):getUTCDay() == 0) then 1 else 0) end
		end
		local inWeek = A.filter((if career.fixtures ~= nil then career.fixtures else Js.alit()), function(f)
			return (f.week == fixture.week)
		end)
		if (Js.alen(inWeek) <= 1) then
			do return 1 end
		end
		local division = M_calendar.divisionOf(career)
		local isWeekend = function(f)
			return (M_calendar.dayFor(f.kind, f.week, division) == "saturday")
		end
		local weekend = A.filter(inWeek, isWeekend)
		local payers = (if (Js.alen(weekend) > 0) then weekend else inWeek)
		local isPayer = A.some(payers, function(f)
			return sameFixture(f, fixture)
		end)
		if (not isPayer) then
			do return 0 end
		end
		do return (1 / Js.alen(payers)) end
	end
	exports.wageShareFor = wageShareFor
	wageForFixture = function(career, fixture)
		do return Math.round((career.contract.wage * wageShareFor(career, fixture))) end
	end
	exports.wageForFixture = wageForFixture
	isMidweekFixture = function(career, fixture)
		if (fixture.kind == "international") then
			do return false end
		end
		do return (M_calendar.dayFor(fixture.kind, fixture.week, M_calendar.divisionOf(career)) ~= "saturday") end
	end
	exports.isMidweekFixture = isMidweekFixture
	midweekFeeFor = function(career, fixture)
		do return (if isMidweekFixture(career, fixture) then Math.round((career.contract.wage * MIDWEEK_FEE_SHARE)) else 0) end
	end
	exports.midweekFeeFor = midweekFeeFor
	MIDWEEK_FEE_SHARE = 0.25
	exports.MIDWEEK_FEE_SHARE = MIDWEEK_FEE_SHARE
end
