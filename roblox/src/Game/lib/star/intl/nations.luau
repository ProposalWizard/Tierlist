--!nocheck
--!nolint
-- Generated from lib/star/intl/nations.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nationalities = import("lib/nationalities")
	local M_ranking_2026_07_20_json = import("data/fifa/ranking-2026-07-20_json")
	local SUSPENDED, PICKER_BY_KEY, NATIONS, BY_KEY, nationFor, nationName, sameNation, nationsIn, rankingStrength, baseStrength, rankOf
	nationFor = function(nationality)
		local k = M_nationalities.nationalityKey(nationality)
		do return (if Js.T(k) then (BY_KEY:get(k) or nil) else nil) end
	end
	exports.nationFor = nationFor
	nationName = function(nationality)
		do return ((function() local _v = nationFor(nationality); if _v == nil then return nil end; _v = _v.name; return _v end)() or nationality) end
	end
	exports.nationName = nationName
	sameNation = function(a, b)
		local ka = M_nationalities.nationalityKey(a)
		local kb = M_nationalities.nationalityKey(b)
		do return ((not (not Js.T(ka))) and (ka == kb)) end
	end
	exports.sameNation = sameNation
	nationsIn = function(confederation)
		do return A.filter(NATIONS, function(n)
			return ((n.confederation == confederation) and (not n.suspended))
		end) end
	end
	exports.nationsIn = nationsIn
	rankingStrength = function(points)
		do return Math.max(40, Math.min(92, (40 + (((points - 700) / 1300) * 52)))) end
	end
	exports.rankingStrength = rankingStrength
	baseStrength = function(nationality)
		local n = nationFor(nationality)
		do return (if n then rankingStrength(n.points) else 60) end
	end
	exports.baseStrength = baseStrength
	rankOf = function(nationality)
		do return ((function() local _v = nationFor(nationality); if _v == nil then return nil end; _v = _v.rank; return _v end)() or 999) end
	end
	exports.rankOf = rankOf
	SUSPENDED = Js.Set.new(Js.alit("RUS"))
	PICKER_BY_KEY = Js.Map.new()
	do
		local _arr1 = M_nationalities.ALL_NATIONALITIES
		local _i2 = 0
		while _i2 < Js.alen(_arr1) do
			_i2 += 1
			local n = _arr1[_i2]
			local k = M_nationalities.nationalityKey(n)
			if Js.T(k) then
				PICKER_BY_KEY:set(k, n)
			end
		end
	end
	NATIONS = A.map(M_ranking_2026_07_20_json.default.teams, function(t)
		return Js.ospread(Js.O({ name = (PICKER_BY_KEY:get((M_nationalities.nationalityKey(t.name) or "")) or t.name), fifaName = t.name, code = t.code, confederation = t.confederation, rank = t.rank, points = t.points }, { "name", "fifaName", "code", "confederation", "rank", "points" }), (if SUSPENDED:has(t.code) then Js.O({ suspended = true }, { "suspended" }) else Js.O({}, nil)))
	end)
	exports.NATIONS = NATIONS
	BY_KEY = Js.Map.new()
	do
		local _arr3 = NATIONS
		local _i4 = 0
		while _i4 < Js.alen(_arr3) do
			_i4 += 1
			local n = _arr3[_i4]
			local k = M_nationalities.nationalityKey(n.name)
			if Js.T(k) then
				BY_KEY:set(k, n)
			end
		end
	end
end
