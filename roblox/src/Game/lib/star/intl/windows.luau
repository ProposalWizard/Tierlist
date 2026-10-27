--!nocheck
--!nolint
-- Generated from lib/star/intl/windows.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local DAY, utc, REAL, RULE, mondayOnOrAfter, windowFor, seasonWindows, breakSaturdays
	mondayOnOrAfter = function(d)
		do return Js.Date.new((d:getTime() + (math.fmod(((1 - d:getUTCDay()) + 7), 7) * DAY))) end
	end
	windowFor = function(year, kind)
		if ((year < 2026) or ((year == 2026) and ((kind == "mar") or (kind == "jun")))) then
			do return nil end
		end
		local real = (function() local _v = REAL[Js.key(year)]; if _v == nil then return nil end; _v = _v[kind]; return _v end)()
		local start = (if real then utc(year, real[1], real[2]) else mondayOnOrAfter(utc(year, RULE[kind][1], RULE[kind][2])))
		local len = (if real then real[3] else RULE[kind][3])
		local end_ = Js.Date.new((start:getTime() + ((len - 1) * DAY)))
		local offsets = (if (kind == "sepoct") then Js.alit(3, 6, 10, 13) else Js.alit(3, 6))
		do return Js.O({ kind = kind, year = year, start = start, ["end"] = end_, matchdays = A.map(offsets, function(o)
			return Js.Date.new((start:getTime() + (o * DAY)))
		end) }, { "kind", "year", "start", "end", "matchdays" }) end
	end
	exports.windowFor = windowFor
	seasonWindows = function(seasonStartYear)
		do return A.filter(Js.alit(windowFor(seasonStartYear, "sepoct"), windowFor(seasonStartYear, "nov"), windowFor((seasonStartYear + 1), "mar"), windowFor((seasonStartYear + 1), "jun")), function(w)
			return (not (not w))
		end) end
	end
	exports.seasonWindows = seasonWindows
	breakSaturdays = function(seasonStartYear)
		local out = Js.alit()
		do
			local _arr1 = seasonWindows(seasonStartYear)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local w = _arr1[_i2]
				if (w.kind == "jun") then
					do continue end
				end
				do
					local t = w.start:getTime()
					local _first3 = true
					while true do
						if not _first3 then
							t += DAY
						end
						_first3 = false
						if not (t <= w["end"]:getTime()) then break end
						if (Js.Date.new(t):getUTCDay() == 6) then
							A.push(out, t)
						end
					end
				end
			end
		end
		do return out end
	end
	exports.breakSaturdays = breakSaturdays
	DAY = 86400000
	utc = function(y, m, d)
		return Js.Date.new(Js.Date.UTC(y, (m - 1), d))
	end
	REAL = Js.O({ ["2026"] = Js.O({ sepoct = Js.alit(9, 21, 16), nov = Js.alit(11, 9, 9) }, { "sepoct", "nov" }), ["2027"] = Js.O({ mar = Js.alit(3, 22, 9), jun = Js.alit(6, 7, 9), sepoct = Js.alit(9, 20, 16), nov = Js.alit(11, 8, 9) }, { "mar", "jun", "sepoct", "nov" }), ["2028"] = Js.O({ mar = Js.alit(3, 20, 9), jun = Js.alit(5, 29, 9), sepoct = Js.alit(9, 18, 16), nov = Js.alit(11, 13, 9) }, { "mar", "jun", "sepoct", "nov" }), ["2029"] = Js.O({ mar = Js.alit(3, 19, 9), jun = Js.alit(6, 4, 9), sepoct = Js.alit(9, 24, 16), nov = Js.alit(11, 12, 9) }, { "mar", "jun", "sepoct", "nov" }), ["2030"] = Js.O({ mar = Js.alit(3, 18, 9), jun = Js.alit(6, 3, 9), sepoct = Js.alit(9, 23, 16), nov = Js.alit(11, 11, 9) }, { "mar", "jun", "sepoct", "nov" }) }, { "2026", "2027", "2028", "2029", "2030" })
	RULE = Js.O({ mar = Js.alit(3, 18, 9), jun = Js.alit(6, 1, 9), sepoct = Js.alit(9, 18, 16), nov = Js.alit(11, 8, 9) }, { "mar", "jun", "sepoct", "nov" })
end
