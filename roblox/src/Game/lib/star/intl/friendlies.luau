--!nocheck
--!nolint
-- Generated from lib/star/intl/friendlies.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_engine = import("lib/star/intl/engine")
	local M_nations = import("lib/star/intl/nations")
	local M_windows = import("lib/star/intl/windows")
	local M_world = import("lib/star/intl/world")
	local PLAY_SHARE, LOOK, friendliesFor, scheduleFriendlies
	friendliesFor = function(w, date)
		w:at((date - 3600000), function()
			local busy = w:busyOn(date)
			local rng = M_engine.rngFor(("fr|" .. Js.numstr(date)))
			local free = A.sort(A.filter(A.map(M_nations.NATIONS, function(n)
				return n.name
			end), function(n)
				return ((not busy:has(n)) and (rng() < PLAY_SHARE))
			end), function(a, b)
				return ((w.points:get(b) or 0) - (w.points:get(a) or 0))
			end)
			local left = Js.Set.new(free)
			do
				local _arr1 = free
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local a = _arr1[_i2]
					if (not left:has(a)) then
						do continue end
					end
					left:delete(a)
					local cands = A.slice(A.filter(free, function(x)
						return left:has(x)
					end), 0, LOOK)
					if (not Js.T(Js.alen(cands))) then
						do break end
					end
					local conf = (function() local _v = M_nations.nationFor(a); if _v == nil then return nil end; _v = _v.confederation; return _v end)()
					local weights = A.map(cands, function(c)
						return (if ((function() local _v = M_nations.nationFor(c); if _v == nil then return nil end; _v = _v.confederation; return _v end)() == conf) then 3 else 1)
					end)
					local r = (rng() * A.reduce(weights, function(s, x)
						return (s + x)
					end, 0))
					local b = cands[1]
					for i = 0, (Js.alen(cands)) - 1 do
						r -= weights[i + 1]
						if (r <= 0) then
							b = cands[i + 1]
							do break end
						end
					end
					left:delete(b)
					local _d3 = (if (rng() < 0.5) then Js.alit(a, b) else Js.alit(b, a))
					local home = _d3[1]
					local away = _d3[2]
					w:add(Js.O({ id = ("FR|" .. Js.numstr(date) .. "|" .. home .. "-" .. away), home = home, away = away, date = date, comp = "International Friendly", edition = ("FR-" .. Js.numstr(Js.Date.new(date):getUTCFullYear())), stage = "Friendly", importance = 10 }, { "id", "home", "away", "date", "comp", "edition", "stage", "importance" }))
				end
			end
			local _ = M_engine.shuffled
		end)
	end
	exports.friendliesFor = friendliesFor
	scheduleFriendlies = function(w, firstSeasonYear, lastSeasonYear)
		do
			local y = firstSeasonYear
			local _first4 = true
			while true do
				if not _first4 then
					y += 1
				end
				_first4 = false
				if not (y <= lastSeasonYear) then break end
				do
					local _arr5 = M_windows.seasonWindows(y)
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local win = _arr5[_i6]
						do
							local _arr7 = win.matchdays
							local _i8 = 0
							while _i8 < Js.alen(_arr7) do
								_i8 += 1
								local d = _arr7[_i8]
								friendliesFor(w, M_world.noon(d))
							end
						end
					end
				end
			end
		end
	end
	exports.scheduleFriendlies = scheduleFriendlies
	PLAY_SHARE = 0.9
	LOOK = 8
end
