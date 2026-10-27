--!nocheck
--!nolint
-- Generated from lib/star/shopData.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_economy = import("lib/star/economy")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_shopDefaults = import("lib/star/shopDefaults")
	local KIB_CANS, kibCanEffectLabel, BOOTS_CATALOGUE, LIFESTYLE_ITEMS, BOOTS_ALL_LEVELS, LIFESTYLE_ALL_LEVELS, kibCanPrice
	kibCanEffectLabel = function(can)
		local plus = (if (can.restore > 0) then (" + " .. Js.numstr(can.restore) .. " energy") else "")
		if (can.effect == "curve") then
			do return ("Swerve boots' curve for your next match" .. plus) end
		end
		if (can.effect == "extraTouch") then
			do return ("Touch boots' extra touch for your next match" .. plus) end
		end
		do return ("+" .. Js.numstr(can.restore) .. " energy") end
	end
	exports.kibCanEffectLabel = kibCanEffectLabel
	kibCanPrice = function(can, weeklyWage)
		local wage = Math.max(M_economy.WAGE_FLOOR, (if Js.T(weeklyWage) then weeklyWage else 0))
		do return Math.max(1, Math.round((wage * M_economy.KIB_CAN_WAGE_WEEKS[can.id]))) end
	end
	exports.kibCanPrice = kibCanPrice
	KIB_CANS = M_tuningStore.applyPriceOverrides("kibCans", M_shopDefaults.KIB_CANS_DEFAULT)
	exports.KIB_CANS = KIB_CANS
	BOOTS_CATALOGUE = M_tuningStore.applyPriceOverrides("boots", M_shopDefaults.BOOTS_CATALOGUE_DEFAULT)
	exports.BOOTS_CATALOGUE = BOOTS_CATALOGUE
	LIFESTYLE_ITEMS = M_tuningStore.applyPriceOverrides("lifestyle", M_shopDefaults.LIFESTYLE_ITEMS_DEFAULT)
	exports.LIFESTYLE_ITEMS = LIFESTYLE_ITEMS
	BOOTS_ALL_LEVELS = M_tuningStore.applyPriceOverrides("boots", M_shopDefaults.BOOT_LEVELS)
	exports.BOOTS_ALL_LEVELS = BOOTS_ALL_LEVELS
	LIFESTYLE_ALL_LEVELS = M_tuningStore.applyPriceOverrides("lifestyle", M_shopDefaults.LIFESTYLE_LEVELS)
	exports.LIFESTYLE_ALL_LEVELS = LIFESTYLE_ALL_LEVELS
	exports.PRICE_SPECS = PRICE_SPECS
	exports.shopTierOf = shopTierOf
	exports.KIB_CAN_TIERS = KIB_CAN_TIERS
	exports.SHOP_LEVEL_COUNT = SHOP_LEVEL_COUNT
	exports.baseIdOf = baseIdOf
end
