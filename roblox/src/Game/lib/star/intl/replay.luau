--!nocheck
--!nolint
-- Generated from lib/star/intl/replay.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_world = import("lib/star/intl/world")
	local M_uefa = import("lib/star/intl/uefa")
	local M_concacaf = import("lib/star/intl/concacaf")
	local M_conmebol = import("lib/star/intl/conmebol")
	local M_ofc = import("lib/star/intl/ofc")
	local M_worldCup = import("lib/star/intl/worldCup")
	local M_caf = import("lib/star/intl/caf")
	local M_afc = import("lib/star/intl/afc")
	local M_friendlies = import("lib/star/intl/friendlies")
	local LAST_YEAR, newWorld, cache, keyOf, worldAt
	newWorld = function(inputs)
		local w = M_world.World.new(inputs)
		do
			local y = 2026
			local _first1 = true
			while true do
				if not _first1 then
					y += 2
				end
				_first1 = false
				if not (y <= LAST_YEAR) then break end
				M_uefa.nationsLeague(w, y)
				M_concacaf.concacafNationsLeague(w, y)
			end
		end
		do
			local y = 2028
			local _first2 = true
			while true do
				if not _first2 then
					y += 4
				end
				_first2 = false
				if not (y <= LAST_YEAR) then break end
				M_uefa.euroCycle(w, y)
				M_conmebol.copaAmerica(w, y)
				M_ofc.ofcNationsCup(w, y)
			end
		end
		do
			local y = 2030
			local _first3 = true
			while true do
				if not _first3 then
					y += 4
				end
				_first3 = false
				if not (y <= (LAST_YEAR + 2)) then break end
				M_worldCup.worldCupCycle(w, y)
			end
		end
		do
			local y = 2027
			local _first4 = true
			while true do
				if not _first4 then
					y += 2
				end
				_first4 = false
				if not (y <= LAST_YEAR) then break end
				M_concacaf.goldCup(w, y)
			end
		end
		do
			local _arr5 = M_caf.afconYears(LAST_YEAR)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local y = _arr5[_i6]
				M_caf.afcon(w, y)
			end
		end
		M_afc.asianCup2027(w)
		M_friendlies.scheduleFriendlies(w, 2026, LAST_YEAR)
		do return w end
	end
	exports.newWorld = newWorld
	keyOf = function(inputs)
		do return Js.JSON.stringify(Js.alit(inputs.firstYear, inputs.xi, inputs.played)) end
	end
	worldAt = function(inputs, until_, hold)
		local key = keyOf(inputs)
		if (((not cache) or (cache.key ~= key)) or (cache.world.now > until_)) then
			cache = Js.O({ key = key, world = newWorld(inputs) }, { "key", "world" })
		end
		cache.world.hold = hold
		cache.world:run(until_)
		do return cache.world end
	end
	exports.worldAt = worldAt
	LAST_YEAR = 2050
	exports.LAST_YEAR = LAST_YEAR
	cache = nil
end
