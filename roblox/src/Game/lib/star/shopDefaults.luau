--!nocheck
--!nolint
-- Generated from lib/star/shopDefaults.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_economy = import("lib/star/economy")
	local KIB_CAN_TIERS, canPrice, KIB_CANS_DEFAULT, BOOT_SPECS, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_SPECS, LIFESTYLE_ITEMS_DEFAULT, SHOP_LEVEL_COUNT, BOOT_STAT_STEP, LIFESTYLE_VALUE_STEP, levelOfTier, tierOfLevel, levelItemId, BOOT_LEVELS, ISLAND_L5_TARGET, ISLAND_L5_BAND, LIFESTYLE_LEVEL_PRICE_MULT, PHONE_PRICE, SINGLE_LEVEL, LIFESTYLE_LEVELS, baseIdOf, PRICE_SPECS, shopTierOf
	levelOfTier = function(tier)
		do return (A.indexOf(M_economy.SHOP_TIER_ORDER, tier) + 1) end
	end
	exports.levelOfTier = levelOfTier
	tierOfLevel = function(level)
		do return M_economy.SHOP_TIER_ORDER[Math.max(0, Math.min((SHOP_LEVEL_COUNT - 1), (level - 1))) + 1] end
	end
	levelItemId = function(baseId, level, ownLevel)
		do return (if (level == ownLevel) then baseId else (baseId .. "-l" .. Js.numstr(level))) end
	end
	exports.levelItemId = levelItemId
	baseIdOf = function(x)
		do return (if x.baseId ~= nil then x.baseId else x.id) end
	end
	exports.baseIdOf = baseIdOf
	shopTierOf = function(catalogue, id)
		do return ((function() local _v = PRICE_SPECS[catalogue]; if _v == nil then return nil end; _v = _v[id]; if _v == nil then return nil end; _v = _v.tier; return _v end)() or "starter") end
	end
	exports.shopTierOf = shopTierOf
	KIB_CAN_TIERS = M_economy.RATING_CONVERTER_TIERS.energy
	exports.KIB_CAN_TIERS = KIB_CAN_TIERS
	canPrice = function(which, i)
		return M_economy.tierPrice(M_economy.RATING_CONVERTER_TIERS[which][i + 1], M_economy.RATING_CONVERTER_WEEKS[which][i + 1])
	end
	KIB_CANS_DEFAULT = Js.alit(Js.O({ id = "basic", name = "Basic KIB Can", price = canPrice("energy", 0), restore = 65, color = "bg-orange-400", image = "/star/kib-basic.webp" }, { "id", "name", "price", "restore", "color", "image" }), Js.O({ id = "premium", name = "Premium KIB Can", price = canPrice("energy", 1), restore = 30, effect = "curve", color = "bg-blue-400", image = "/star/kib-premium.webp" }, { "id", "name", "price", "restore", "effect", "color", "image" }), Js.O({ id = "elite", name = "Elite KIB Can", price = canPrice("energy", 2), restore = 40, effect = "extraTouch", color = "bg-purple-400", image = "/star/kib-elite.webp" }, { "id", "name", "price", "restore", "effect", "color", "image" }))
	exports.KIB_CANS_DEFAULT = KIB_CANS_DEFAULT
	BOOT_SPECS = Js.alit(Js.O({ id = "starter", name = "NS-Pure", pace = 5, power = 5, technique = 5, tier = "starter", at = 0.15, priceFactor = 0.5, matches = 35 }, { "id", "name", "pace", "power", "technique", "tier", "at", "priceFactor", "matches" }), Js.O({ id = "speed", name = "NS-Flash", pace = 11, power = 3, technique = 5, tier = "semi_pro", at = 0.45, matches = 25 }, { "id", "name", "pace", "power", "technique", "tier", "at", "matches" }), Js.O({ id = "power", name = "NS-Thunder", pace = 3, power = 11, technique = 5, tier = "semi_pro", at = 0.55, matches = 25 }, { "id", "name", "pace", "power", "technique", "tier", "at", "matches" }), Js.O({ id = "control", name = "NS-Control", pace = 3, power = 5, technique = 11, tier = "pro", at = 0.2, matches = 25 }, { "id", "name", "pace", "power", "technique", "tier", "at", "matches" }), Js.O({ id = "elite", name = "NS-Elite", pace = 8, power = 8, technique = 8, tier = "elite", at = 0.4, matches = 14 }, { "id", "name", "pace", "power", "technique", "tier", "at", "matches" }), Js.O({ id = "curl", name = "NS-Swerve", pace = 5, power = 5, technique = 10, tier = "world_class", at = 1, curve = true, matches = 15 }, { "id", "name", "pace", "power", "technique", "tier", "at", "curve", "matches" }), Js.O({ id = "maestro", name = "NS-Maestro", pace = 20, power = 20, technique = 30, tier = "world_class", at = 1, extraTouch = true }, { "id", "name", "pace", "power", "technique", "tier", "at", "extraTouch" }))
	BOOTS_CATALOGUE_DEFAULT = A.map(BOOT_SPECS, function(spec)
		local band = M_economy.bandPrice(spec.tier, "upgrade", spec.at)
		local price = (if Js.T(spec.priceFactor) then (Math.round(((band * spec.priceFactor) / 5)) * 5) else band)
		do return Js.ospread(Js.O({ id = spec.id, name = spec.name, pace = spec.pace, power = spec.power, technique = spec.technique, matches = (if spec.matches ~= nil then spec.matches else M_economy.bootMatchesFor(price, spec.tier)), price = price }, { "id", "name", "pace", "power", "technique", "matches", "price" }), (if spec.curve then Js.O({ curve = true }, { "curve" }) else Js.O({}, nil)), (if spec.extraTouch then Js.O({ extraTouch = true }, { "extraTouch" }) else Js.O({}, nil))) end
	end)
	exports.BOOTS_CATALOGUE_DEFAULT = BOOTS_CATALOGUE_DEFAULT
	LIFESTYLE_SPECS = Js.alit(Js.O({ id = "phone", name = "Phone", category = "item", lifestyleValue = 3, tier = "starter", band = "consumable", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "console", name = "Games Console", category = "item", lifestyleValue = 5, tier = "pro", band = "consumable", at = 0.3 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "headphones", name = "Headphones", category = "item", lifestyleValue = 5, tier = "pro", band = "consumable", at = 0.3 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "music", name = "Music Player", category = "item", lifestyleValue = 6, tier = "elite", band = "consumable", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "tablet", name = "Tablet", category = "item", lifestyleValue = 8, tier = "elite", band = "consumable", at = 1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "smartwatch", name = "Smartwatch", category = "item", lifestyleValue = 9, tier = "starter", band = "upgrade", at = 0 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "tv", name = "TV", category = "item", lifestyleValue = 10, tier = "starter", band = "upgrade", at = 0.3 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "gaming-pc", name = "Gaming PC", category = "item", lifestyleValue = 11, tier = "starter", band = "upgrade", at = 0.6 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "suit", name = "Designer Suit", category = "item", lifestyleValue = 12, tier = "starter", band = "upgrade", at = 0.95 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "silver", name = "Silver Chain", category = "item", lifestyleValue = 14, tier = "semi_pro", band = "upgrade", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "art", name = "Art Piece", category = "item", lifestyleValue = 18, tier = "pro", band = "upgrade", at = 0.35 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "gold", name = "Gold Watch", category = "item", lifestyleValue = 20, tier = "pro", band = "upgrade", at = 0.9 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "diamond", name = "Diamond Necklace", category = "item", lifestyleValue = 40, tier = "semi_pro", band = "aspirational", at = 0 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "rolex", name = "Diamond Rolex", category = "item", lifestyleValue = 62, tier = "pro", band = "aspirational", at = 0.1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "bike", name = "Motorbike", category = "vehicle", lifestyleValue = 4, tier = "starter", band = "upgrade", at = 0.15 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "car-1", name = "Family Car", category = "vehicle", lifestyleValue = 5, tier = "semi_pro", band = "upgrade", at = 0.15 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "car-2", name = "Hatchback", category = "vehicle", lifestyleValue = 12, tier = "pro", band = "upgrade", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "suv", name = "Luxury SUV", category = "vehicle", lifestyleValue = 22, tier = "elite", band = "aspirational", at = 0 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "car-3", name = "Sports Car", category = "vehicle", lifestyleValue = 30, tier = "world_class", band = "aspirational", at = 0.2 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "classic", name = "Classic Car", category = "vehicle", lifestyleValue = 42, tier = "pro", band = "endgame", at = 1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "car-4", name = "Supercar", category = "vehicle", lifestyleValue = 60, tier = "elite", band = "endgame", at = 0.1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "jet", name = "Private Jet", category = "vehicle", lifestyleValue = 120, tier = "world_class", band = "endgame", at = 0.6 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "flat-1", name = "Studio Flat", category = "property", lifestyleValue = 10, tier = "pro", band = "upgrade", at = 1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "flat-2", name = "City Apartment", category = "property", lifestyleValue = 25, tier = "semi_pro", band = "aspirational", at = 0.1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "penthouse", name = "Penthouse", category = "property", lifestyleValue = 40, tier = "pro", band = "aspirational", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "stable", name = "Horse Stable", category = "property", lifestyleValue = 45, tier = "elite", band = "aspirational", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "house-1", name = "Suburban House", category = "property", lifestyleValue = 55, tier = "world_class", band = "aspirational", at = 0.6 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "villa", name = "Beach Villa", category = "property", lifestyleValue = 75, tier = "world_class", band = "aspirational", at = 1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "house-2", name = "Mansion", category = "property", lifestyleValue = 100, tier = "elite", band = "endgame", at = 0 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "estate", name = "Country Estate", category = "property", lifestyleValue = 140, tier = "elite", band = "endgame", at = 0.5 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }), Js.O({ id = "island", name = "Private Island", category = "property", lifestyleValue = 250, tier = "world_class", band = "endgame", at = 1 }, { "id", "name", "category", "lifestyleValue", "tier", "band", "at" }))
	LIFESTYLE_ITEMS_DEFAULT = A.map(LIFESTYLE_SPECS, function(spec)
		do return Js.O({ id = spec.id, name = spec.name, category = spec.category, price = M_economy.bandPrice(spec.tier, spec.band, spec.at), lifestyleValue = spec.lifestyleValue }, { "id", "name", "category", "price", "lifestyleValue" }) end
	end)
	exports.LIFESTYLE_ITEMS_DEFAULT = LIFESTYLE_ITEMS_DEFAULT
	SHOP_LEVEL_COUNT = 5
	exports.SHOP_LEVEL_COUNT = SHOP_LEVEL_COUNT
	BOOT_STAT_STEP = 1.25
	LIFESTYLE_VALUE_STEP = 1.4
	BOOT_LEVELS = A.flatMap(BOOT_SPECS, function(spec)
		local own = levelOfTier(spec.tier)
		local base = A.find(BOOTS_CATALOGUE_DEFAULT, function(b)
			return (b.id == spec.id)
		end)
		do return Js.Array.from(Js.O({ length = SHOP_LEVEL_COUNT }, { "length" }), function(_, i)
			local level = (i + 1)
			if (level == own) then
				do return Js.ospread(base, Js.O({ level = level, baseId = spec.id }, { "level", "baseId" })) end
			end
			local tier = tierOfLevel(level)
			local band = M_economy.bandPrice(tier, "upgrade", spec.at)
			local price = (if Js.T(spec.priceFactor) then (Math.round(((band * spec.priceFactor) / 5)) * 5) else band)
			local k = Math.pow(BOOT_STAT_STEP, (level - own))
			local stat = function(v)
				return Math.max(1, Math.round((v * k)))
			end
			do return Js.ospread(Js.O({ id = levelItemId(spec.id, level, own), name = spec.name, level = level, baseId = spec.id, pace = stat(spec.pace), power = stat(spec.power), technique = stat(spec.technique), matches = base.matches, price = price }, { "id", "name", "level", "baseId", "pace", "power", "technique", "matches", "price" }), (if spec.curve then Js.O({ curve = true }, { "curve" }) else Js.O({}, nil)), (if spec.extraTouch then Js.O({ extraTouch = true }, { "extraTouch" }) else Js.O({}, nil))) end
		end) end
	end)
	exports.BOOT_LEVELS = BOOT_LEVELS
	ISLAND_L5_TARGET = 10000000
	ISLAND_L5_BAND = M_economy.bandPrice("world_class", "endgame", 1)
	LIFESTYLE_LEVEL_PRICE_MULT = Js.O({ ["3"] = 4, ["4"] = 12, ["5"] = (ISLAND_L5_TARGET / ISLAND_L5_BAND) }, { "3", "4", "5" })
	exports.LIFESTYLE_LEVEL_PRICE_MULT = LIFESTYLE_LEVEL_PRICE_MULT
	PHONE_PRICE = 150
	exports.PHONE_PRICE = PHONE_PRICE
	SINGLE_LEVEL = Js.Set.new(Js.alit("phone"))
	LIFESTYLE_LEVELS = (function()
		local out = A.flatMap(LIFESTYLE_SPECS, function(spec)
			local own = levelOfTier(spec.tier)
			do return Js.Array.from(Js.O({ length = (if SINGLE_LEVEL:has(spec.id) then 1 else SHOP_LEVEL_COUNT) }, { "length" }), function(_, i)
				local level = (i + 1)
				do return Js.O({ id = levelItemId(spec.id, level, own), name = spec.name, category = spec.category, level = level, baseId = spec.id, price = (Math.round(((M_economy.bandPrice(tierOfLevel(level), spec.band, spec.at) * (if LIFESTYLE_LEVEL_PRICE_MULT[Js.key(level)] ~= nil then LIFESTYLE_LEVEL_PRICE_MULT[Js.key(level)] else 1)) / 5)) * 5), lifestyleValue = Math.max(1, Math.round((spec.lifestyleValue * Math.pow(LIFESTYLE_VALUE_STEP, (level - own))))) }, { "id", "name", "category", "level", "baseId", "price", "lifestyleValue" }) end
			end) end
		end)
		do
			local _arr1 = Js.alit("item", "vehicle", "property")
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local cat = _arr1[_i2]
				for level = 1, SHOP_LEVEL_COUNT do
					local row = A.sort(A.filter(out, function(o)
						return ((o.category == cat) and (o.level == level))
					end), function(a, b)
						return (function() local _l = (a.lifestyleValue - b.lifestyleValue); if Js.T(_l) then return _l end; return (a.price - b.price) end)()
					end)
					for j = 1, (Js.alen(row)) - 1 do
						local prev = row[j]
						local cur = row[j + 1]
						if ((cur.lifestyleValue > prev.lifestyleValue) and (cur.price <= prev.price)) then
							cur.price = (math.ceil(((prev.price * 1.05) / 5)) * 5)
						end
						if ((cur.lifestyleValue == prev.lifestyleValue) and (cur.price < prev.price)) then
							cur.price = prev.price
						end
					end
				end
			end
		end
		do
			local _arr3 = out
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local o = _arr3[_i4]
				if (o.baseId == "phone") then
					o.price = PHONE_PRICE
				end
			end
		end
		do return out end
	end)()
	exports.LIFESTYLE_LEVELS = LIFESTYLE_LEVELS
	PRICE_SPECS = Js.O({ boots = Js.Object.fromEntries(A.map(BOOT_SPECS, function(s)
		return Js.alit(s.id, Js.O({ tier = s.tier, band = "upgrade", at = s.at }, { "tier", "band", "at" }))
	end)), lifestyle = Js.Object.fromEntries(A.map(LIFESTYLE_SPECS, function(s)
		return Js.alit(s.id, Js.O({ tier = s.tier, band = s.band, at = s.at }, { "tier", "band", "at" }))
	end)), bootLevels = Js.Object.fromEntries(A.flatMap(BOOT_SPECS, function(s)
		local own = levelOfTier(s.tier)
		do return A.map(A.filter(Js.alit(1, 2, 3, 4, 5), function(l)
			return (l ~= own)
		end), function(l)
			return Js.alit(levelItemId(s.id, l, own), Js.O({ tier = tierOfLevel(l), band = "upgrade", at = s.at }, { "tier", "band", "at" }))
		end) end
	end)), lifestyleLevels = Js.Object.fromEntries(A.flatMap(LIFESTYLE_SPECS, function(s)
		local own = levelOfTier(s.tier)
		do return A.map(A.filter(Js.alit(1, 2, 3, 4, 5), function(l)
			return (l ~= own)
		end), function(l)
			return Js.alit(levelItemId(s.id, l, own), Js.O({ tier = tierOfLevel(l), band = s.band, at = s.at }, { "tier", "band", "at" }))
		end) end
	end)) }, { "boots", "lifestyle", "bootLevels", "lifestyleLevels" })
	exports.PRICE_SPECS = PRICE_SPECS
end
