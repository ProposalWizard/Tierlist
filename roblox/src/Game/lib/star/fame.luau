--!nocheck
--!nolint
-- Generated from lib/star/fame.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local FAME_MAX, FAME_LEVELS, fameLevel, nextFameLevel, ITEM_LIFE_BY_ID, itemLifeSeasons, isWornOut, OWNED_FAME_MAX, OWNED_FAME_SCALE, ownedStatus, ownedFame, fameGainFromBuying, clampFame, fameOf, FAME_FOR_TROPHY, FAME_FOR_PROMOTION_TO, FAME_EVENTS, DIVISION_FAME_LEVEL, FAME_FADE_SHARE, fadedFame, scandalFame, addFame, wearItems, freshItem
	fameLevel = function(fame)
		local out = FAME_LEVELS[1]
		do
			local _arr1 = FAME_LEVELS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local l = _arr1[_i2]
				if (fame >= l.min) then
					out = l
				end
			end
		end
		do return out end
	end
	exports.fameLevel = fameLevel
	nextFameLevel = function(fame)
		do return (A.find(FAME_LEVELS, function(l)
			return (l.min > fame)
		end) or nil) end
	end
	exports.nextFameLevel = nextFameLevel
	itemLifeSeasons = function(item)
		local id = (if item.baseId ~= nil then item.baseId else item.id)
		if Js.has(ITEM_LIFE_BY_ID, id) then
			do return ITEM_LIFE_BY_ID[id] end
		end
		if (item.category == "property") then
			do return nil end
		end
		if (item.category == "vehicle") then
			do return 5 end
		end
		do return 3 end
	end
	exports.itemLifeSeasons = itemLifeSeasons
	isWornOut = function(item)
		do return (item.seasonsLeft == 0) end
	end
	exports.isWornOut = isWornOut
	ownedStatus = function(items)
		do return A.reduce(A.filter((if items ~= nil then items else Js.alit()), function(i)
			return (not isWornOut(i))
		end), function(s, i)
			return (s + (if Js.T(i.lifestyleValue) then i.lifestyleValue else 0))
		end, 0) end
	end
	exports.ownedStatus = ownedStatus
	ownedFame = function(items)
		local status = ownedStatus(items)
		do return (OWNED_FAME_MAX * (1 - Math.exp(((-status) / OWNED_FAME_SCALE)))) end
	end
	exports.ownedFame = ownedFame
	fameGainFromBuying = function(items, item)
		local before = ownedFame(items)
		local base = (if item.baseId ~= nil then item.baseId else item.id)
		local after = ownedFame(Js.aspread(A.filter((if items ~= nil then items else Js.alit()), function(i)
			return ((if i.baseId ~= nil then i.baseId else i.id) ~= base)
		end), Js.alit(Js.ospread(item, Js.O({ seasonsLeft = nil }, { "seasonsLeft" })))))
		do return Math.max(0, (after - before)) end
	end
	exports.fameGainFromBuying = fameGainFromBuying
	clampFame = function(n)
		do return Math.max(0, Math.min(FAME_MAX, (if Js.NumberNS.isFinite(n) then n else 0))) end
	end
	exports.clampFame = clampFame
	fameOf = function(career)
		do return Math.round(clampFame(((if career.fame ~= nil then career.fame else 0) + ownedFame(career.ownedItems)))) end
	end
	exports.fameOf = fameOf
	fadedFame = function(earned, division)
		local level = (if DIVISION_FAME_LEVEL[division] ~= nil then DIVISION_FAME_LEVEL[division] else 15)
		if (earned <= level) then
			do return earned end
		end
		do return (earned - ((earned - level) * FAME_FADE_SHARE)) end
	end
	exports.fadedFame = fadedFame
	scandalFame = function(roll)
		local r = Math.max(0, Math.min(0.9999, (if Js.NumberNS.isFinite(roll) then roll else 0)))
		do return (FAME_EVENTS.scandalMin + math.floor((r * ((FAME_EVENTS.scandalMax - FAME_EVENTS.scandalMin) + 1)))) end
	end
	exports.scandalFame = scandalFame
	addFame = function(earned, delta)
		do return clampFame((earned + delta)) end
	end
	exports.addFame = addFame
	wearItems = function(items)
		do return A.map((if items ~= nil then items else Js.alit()), function(i)
			return (if ((type(i.seasonsLeft) == "number") and (i.seasonsLeft > 0)) then Js.ospread(i, Js.O({ seasonsLeft = (i.seasonsLeft - 1) }, { "seasonsLeft" })) else i)
		end) end
	end
	exports.wearItems = wearItems
	freshItem = function(item)
		local life = itemLifeSeasons(item)
		local _d3 = item
		local _drop = _d3.seasonsLeft
		local rest = Js.ospread(_d3)
		Js.del(rest, "seasonsLeft")
		do return (if (life == nil) then rest else Js.ospread(rest, Js.O({ seasonsLeft = life }, { "seasonsLeft" }))) end
	end
	exports.freshItem = freshItem
	FAME_MAX = 100
	exports.FAME_MAX = FAME_MAX
	FAME_LEVELS = Js.alit(Js.O({ name = "Unknown", min = 0 }, { "name", "min" }), Js.O({ name = "Local Name", min = 10 }, { "name", "min" }), Js.O({ name = "Rising Star", min = 25 }, { "name", "min" }), Js.O({ name = "National Name", min = 40 }, { "name", "min" }), Js.O({ name = "Global Star", min = 60 }, { "name", "min" }), Js.O({ name = "Icon", min = 80 }, { "name", "min" }))
	exports.FAME_LEVELS = FAME_LEVELS
	ITEM_LIFE_BY_ID = Js.O({ phone = 2, console = 3, headphones = 2, music = 2, tablet = 3, smartwatch = 3, tv = 4, ["gaming-pc"] = 3, suit = 2, silver = nil, art = nil, gold = nil, diamond = nil, rolex = nil, classic = nil }, { "phone", "console", "headphones", "music", "tablet", "smartwatch", "tv", "gaming-pc", "suit", "silver", "art", "gold", "diamond", "rolex", "classic" })
	OWNED_FAME_MAX = 40
	exports.OWNED_FAME_MAX = OWNED_FAME_MAX
	OWNED_FAME_SCALE = 500
	exports.OWNED_FAME_SCALE = OWNED_FAME_SCALE
	FAME_FOR_TROPHY = Js.O({ ["Premier League"] = 12, Championship = 8, ["League One"] = 6, ["League Two"] = 5, ["National League"] = 4, ["Play-Offs"] = 3, ["FA Cup"] = 8, ["League Cup"] = 4, ["Lower League Trophy"] = 2, ["Champions League"] = 15, ["Europa League"] = 8, ["Conference League"] = 5, ["Community Shield"] = 1, ["Super Cup"] = 1, ["World Cup"] = 15, ["European Championship"] = 12 }, { "Premier League", "Championship", "League One", "League Two", "National League", "Play-Offs", "FA Cup", "League Cup", "Lower League Trophy", "Champions League", "Europa League", "Conference League", "Community Shield", "Super Cup", "World Cup", "European Championship" })
	exports.FAME_FOR_TROPHY = FAME_FOR_TROPHY
	FAME_FOR_PROMOTION_TO = Js.O({ league_two = 3, league_one = 4, championship = 6, premier = 10 }, { "league_two", "league_one", "championship", "premier" })
	exports.FAME_FOR_PROMOTION_TO = FAME_FOR_PROMOTION_TO
	FAME_EVENTS = Js.O({ qualifiedForEurope = 5, ballonDorWin = 15, ballonDorTopThree = 5, playerOfSeason = 4, youngPlayerOfSeason = 3, teamOfSeason = 2, goldenBoot = 3, playerOfMonth = 1, relegated = -5, benchedSeason = -4, scandalMin = 1, scandalMax = 4 }, { "qualifiedForEurope", "ballonDorWin", "ballonDorTopThree", "playerOfSeason", "youngPlayerOfSeason", "teamOfSeason", "goldenBoot", "playerOfMonth", "relegated", "benchedSeason", "scandalMin", "scandalMax" })
	exports.FAME_EVENTS = FAME_EVENTS
	DIVISION_FAME_LEVEL = Js.O({ national_league_north = 10, national_league_south = 10, national_league = 15, league_two = 25, league_one = 35, championship = 50, premier = 75 }, { "national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier" })
	exports.DIVISION_FAME_LEVEL = DIVISION_FAME_LEVEL
	FAME_FADE_SHARE = 0.2
	exports.FAME_FADE_SHARE = FAME_FADE_SHARE
end
