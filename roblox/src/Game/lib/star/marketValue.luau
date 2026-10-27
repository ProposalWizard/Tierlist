--!nocheck
--!nolint
-- Generated from lib/star/marketValue.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuningStore = import("lib/star/tuningStore")
	local M_clubTier = import("lib/star/clubTier")
	local ratingFactor, ageFactor, potentialFactor, clubFactor, playerMarketValue
	ratingFactor = function(overall)
		local m = Math.max(1, (overall - M_tuningStore.getTuning("marketValue.ratingFloor")))
		do return Math.pow(m, M_tuningStore.getTuning("marketValue.ratingExponent")) end
	end
	ageFactor = function(age)
		if (age <= 22) then
			do return (1 + ((22 - age) * M_tuningStore.getTuning("marketValue.youthPremiumPerYear"))) end
		end
		if (age <= 29) then
			do return 1 end
		end
		local declineYears = (age - 29)
		do return Math.max(M_tuningStore.getTuning("marketValue.ageFloor"), (1 - (declineYears * M_tuningStore.getTuning("marketValue.declinePerYear")))) end
	end
	potentialFactor = function(age, highPotential, worldClassPotential)
		if ((not highPotential) and (not worldClassPotential)) then
			do return 1 end
		end
		local peak = (if worldClassPotential then M_tuningStore.getTuning("marketValue.worldClassPeak") else M_tuningStore.getTuning("marketValue.highPotentialPeak"))
		local youthWindow = M_tuningStore.getTuning("marketValue.potentialYouthWindow")
		local taper = (if (age <= 23) then 1 else (if (age >= (23 + youthWindow)) then 0.1 else (1 - (((age - 23) / youthWindow) * 0.9))))
		do return (1 + ((peak - 1) * taper)) end
	end
	clubFactor = function(club, career)
		local mult = M_clubTier.TIER_MULTIPLIER[M_clubTier.tierOf(club, career)]
		do return (0.9 + (((mult - 0.3) / (1.25 - 0.3)) * 0.2)) end
	end
	playerMarketValue = function(player, club, career)
		local age = (if player.age ~= nil then player.age else 24)
		local value = ((((ratingFactor(player.overall) * ageFactor(age)) * potentialFactor(age, player.highPotential, player.worldClassPotential)) * clubFactor(club, career)) * M_tuningStore.getTuning("marketValue.scale"))
		do return Math.max(M_tuningStore.getTuning("marketValue.floor"), Math.round(value)) end
	end
	exports.playerMarketValue = playerMarketValue
end
