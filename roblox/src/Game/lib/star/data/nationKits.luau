--!nocheck
--!nolint
-- Generated from lib/star/data/nationKits.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_nationalities = import("lib/nationalities")
	local M_kits = import("lib/star/kits")
	local M_nation_kits_2026_10_json = import("lib/star/data/sources/nation_kits_2026-10_json")
	local RAW, NATION_KIT_PROFILES, BY_KEY, nationKitProfile, nationWornKits
	nationKitProfile = function(nation)
		if (not Js.T(nation)) then
			do return nil end
		end
		do return ((if NATION_KIT_PROFILES[nation] ~= nil then NATION_KIT_PROFILES[nation] else BY_KEY:get((M_nationalities.nationalityKey(nation) or ""))) or nil) end
	end
	exports.nationKitProfile = nationKitProfile
	nationWornKits = function(nation)
		local p = nationKitProfile(nation)
		local h = (function() local _v = p; if _v == nil then return nil end; _v = _v.homeKit; return _v end)()
		local a = (function() local _v = p; if _v == nil then return nil end; _v = _v.awayKit; return _v end)()
		if ((not Js.T((function() local _v = h; if _v == nil then return nil end; _v = _v.shirtHex; return _v end)())) or (not Js.T((function() local _v = a; if _v == nil then return nil end; _v = _v.shirtHex; return _v end)()))) then
			do return nil end
		end
		local contrast = function(shirt)
			return (if M_kits.clashes(shirt, "#F2F4F7") then "#17181A" else "#F2F4F7")
		end
		local kit = function(shirt, trim)
			return Js.O({ shirt = shirt, trim = (if (Js.T(trim) and (not M_kits.clashes(shirt, trim))) then trim else contrast(shirt)) }, { "shirt", "trim" })
		end
		do return Js.O({ home = kit(h.shirtHex, h.trimHex), away = kit(a.shirtHex, a.trimHex) }, { "home", "away" }) end
	end
	exports.nationWornKits = nationWornKits
	RAW = M_nation_kits_2026_10_json.default.nations
	NATION_KIT_PROFILES = Js.Object.fromEntries(A.map(Js.Object.entries(RAW), function(_p1)
		local nation = _p1[1]
		local p = _p1[2]
		return Js.alit(nation, Js.ospread(Js.O({ nation = nation }, { "nation" }), p))
	end))
	exports.NATION_KIT_PROFILES = NATION_KIT_PROFILES
	BY_KEY = Js.Map.new()
	do
		local _arr2 = Js.Object.values(NATION_KIT_PROFILES)
		local _i3 = 0
		while _i3 < Js.alen(_arr2) do
			_i3 += 1
			local p = _arr2[_i3]
			local k = M_nationalities.nationalityKey(p.nation)
			if Js.T(k) then
				BY_KEY:set(k, p)
			end
		end
	end
end
