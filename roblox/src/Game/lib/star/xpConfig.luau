--!nocheck
--!nolint
-- Generated from lib/star/xpConfig.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_achievements = import("lib/star/achievements")
	local DIVS_ALL, byDiv, DEFAULT_XP, current, xp, isNum, mergeNums, mergeXpConfig, setXpConfig, achievementXp, ALL_DIVISIONS
	xp = function()
		do return current end
	end
	exports.xp = xp
	mergeNums = function(base, over)
		if ((not Js.T(over)) or (type(over) ~= "table")) then
			do return base end
		end
		local out = Js.ospread(base)
		do
			local _arr1 = Js.Object.entries(over)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local k = _e3[1]
				local v = _e3[2]
				if isNum(v) then
					out[k] = v
				elseif (((((Js.T(v) and (type(v) == "table")) and (not Js.Array.isArray(v))) and Js.T(base[k])) and (type(base[k]) == "table")) and (not Js.Array.isArray(base[k]))) then
					out[k] = mergeNums(base[k], v)
				end
			end
		end
		do return out end
	end
	mergeXpConfig = function(saved)
		if ((not Js.T(saved)) or (type(saved) ~= "table")) then
			do return DEFAULT_XP end
		end
		local s = saved
		local tiers = Js.Set.new(Js.alit("easy", "medium", "hard", "legendary"))
		local tierMap = Js.ospread(DEFAULT_XP.achievementTier)
		do
			local _arr4 = Js.Object.entries((if s.achievementTier ~= nil then s.achievementTier else Js.O({}, nil)))
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local _e6 = _arr4[_i5]
				local k = _e6[1]
				local v = _e6[2]
				if tiers:has(v) then
					tierMap[k] = v
				end
			end
		end
		local fame = (if (Js.Array.isArray(s.fame) and A.every(s.fame, function(p)
			return ((Js.Array.isArray(p) and isNum(p[1])) and isNum(p[2]))
		end)) then A.sort(A.slice(s.fame), function(a, b)
			return (a[1] - b[1])
		end) else DEFAULT_XP.fame)
		local awards = Js.O({}, nil)
		do
			local _arr7 = Js.Object.entries(Js.ospread(DEFAULT_XP.awards, (if s.awards ~= nil then s.awards else Js.O({}, nil))))
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local k = _e9[1]
				local row = _e9[2]
				awards[k] = mergeNums((if DEFAULT_XP.awards[k] ~= nil then DEFAULT_XP.awards[k] else Js.O({}, nil)), row)
			end
		end
		do return Js.O({ match = mergeNums(DEFAULT_XP.match, s.match), mult = mergeNums(DEFAULT_XP.mult, s.mult), trophies = mergeNums(DEFAULT_XP.trophies, s.trophies), otherTrophy = (if isNum(s.otherTrophy) then s.otherTrophy else DEFAULT_XP.otherTrophy), promotionShare = (if isNum(s.promotionShare) then Math.min(1, s.promotionShare) else DEFAULT_XP.promotionShare), awards = awards, ballon = mergeNums(DEFAULT_XP.ballon, s.ballon), milestones = mergeNums(DEFAULT_XP.milestones, s.milestones), achievementTiers = mergeNums(DEFAULT_XP.achievementTiers, s.achievementTiers), achievementTier = tierMap, achievementXp = mergeNums(DEFAULT_XP.achievementXp, s.achievementXp), records = mergeNums(DEFAULT_XP.records, s.records), fame = fame, trainingStar = (if isNum(s.trainingStar) then s.trainingStar else DEFAULT_XP.trainingStar), clubOwner = (if isNum(s.clubOwner) then s.clubOwner else DEFAULT_XP.clubOwner), topItem = (if isNum(s.topItem) then s.topItem else DEFAULT_XP.topItem), island = (if isNum(s.island) then s.island else DEFAULT_XP.island), president = (if isNum(s.president) then s.president else DEFAULT_XP.president), notes = (if (s.notes and (type(s.notes) == "table")) then s.notes else Js.O({}, nil)), ideas = (if Js.Array.isArray(s.ideas) then A.filter(s.ideas, function(i)
			return ((i and (type(i.id) == "string")) and (type(i.name) == "string"))
		end) else Js.alit()) }, { "match", "mult", "trophies", "otherTrophy", "promotionShare", "awards", "ballon", "milestones", "achievementTiers", "achievementTier", "achievementXp", "records", "fame", "trainingStar", "clubOwner", "topItem", "island", "president", "notes", "ideas" }) end
	end
	exports.mergeXpConfig = mergeXpConfig
	setXpConfig = function(saved)
		current = (if Js.T(saved) then mergeXpConfig(saved) else DEFAULT_XP)
	end
	exports.setXpConfig = setXpConfig
	achievementXp = function(id, cfg)
		if cfg == nil then cfg = current end
		if Js.has(cfg.achievementXp, id) then
			do return cfg.achievementXp[id] end
		end
		do return cfg.achievementTiers[(if cfg.achievementTier[id] ~= nil then cfg.achievementTier[id] else "medium")] end
	end
	exports.achievementXp = achievementXp
	DIVS_ALL = Js.alit("national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier")
	byDiv = function(north, nl, l2, l1, ch, pl)
		return Js.O({ national_league_north = north, national_league_south = north, national_league = nl, league_two = l2, league_one = l1, championship = ch, premier = pl }, { "national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier" })
	end
	DEFAULT_XP = Js.O({ match = Js.O({ perMinute = 10, win = 360, draw = 120, goal = 1200, assist = 840, ratingPerPoint = 400 }, { "perMinute", "win", "draw", "goal", "assist", "ratingPerPoint" }), mult = Js.O({ national_league_north = 1, national_league_south = 1, national_league = 1.25, league_two = 1.5, league_one = 2, championship = 3, premier = 4, champions_league = 5, europa_league = 4, conference_league = 3, intl = 4 }, { "national_league_north", "national_league_south", "national_league", "league_two", "league_one", "championship", "premier", "champions_league", "europa_league", "conference_league", "intl" }), trophies = Js.O({ ["National League North"] = 21600, ["National League South"] = 21600, ["National League"] = 30000, ["League Two"] = 42000, ["League One"] = 60000, Championship = 96000, ["Premier League"] = 240000, ["Community Shield"] = 18000, ["Super Cup"] = 65000, ["League Cup"] = 108000, ["Conference League"] = 108000, ["Lower League Trophy"] = 30000, ["FA Cup"] = 144000, ["Europa League"] = 156000, ["Champions League"] = 360000, ["World Cup"] = 400000, ["European Championship"] = 300000, ["Play-Offs"] = 0 }, { "National League North", "National League South", "National League", "League Two", "League One", "Championship", "Premier League", "Community Shield", "Super Cup", "League Cup", "Conference League", "Lower League Trophy", "FA Cup", "Europa League", "Champions League", "World Cup", "European Championship", "Play-Offs" }), otherTrophy = 12000, promotionShare = 0.8, awards = Js.O({ ["Player of the Month"] = byDiv(4800, 6000, 12000, 18000, 24000, 30000), ["Golden Boot"] = byDiv(19200, 24000, 60000, 96000, 132000, 180000), ["Player of the Season"] = byDiv(28800, 36000, 84000, 132000, 180000, 240000) }, { "Player of the Month", "Golden Boot", "Player of the Season" }), ballon = Js.O({ win = 720000, top3 = 300000, top10 = 120000 }, { "win", "top3", "top10" }), milestones = Js.O({ firstCap = 48000, premierDebut = 6000 }, { "firstCap", "premierDebut" }), achievementTiers = Js.O({ easy = 600, medium = 2400, hard = 12000, legendary = 30000 }, { "easy", "medium", "hard", "legendary" }), achievementTier = Js.ospread(Js.O({ ["first-two-sessions"] = "easy", ["first-game"] = "easy", ["boss-meeting"] = "easy", ["buy-phone"] = "easy" }, { "first-two-sessions", "first-game", "boss-meeting", "buy-phone" }), Js.Object.fromEntries(A.map(M_achievements.ACHIEVEMENTS, function(a)
		return Js.alit(a.id, a.tier)
	end))), achievementXp = Js.O({ ["first-contract"] = 0 }, { "first-contract" }), records = Js.O({ ["pl-assists-season"] = 300000, ["pl-goals-season"] = 300000, ["pl-goals-match"] = 300000, ["pl-goals-career"] = 300000, ["pl-appearances-career"] = 300000, ["pl-assists-career"] = 300000, ["pl-scoring-run"] = 300000, ["pl-hat-tricks-career"] = 300000, ["pl-biggest-win"] = 120000, ["england-caps"] = 300000 }, { "pl-assists-season", "pl-goals-season", "pl-goals-match", "pl-goals-career", "pl-appearances-career", "pl-assists-career", "pl-scoring-run", "pl-hat-tricks-career", "pl-biggest-win", "england-caps" }), fame = Js.alit(Js.alit(25, 9000), Js.alit(40, 24000), Js.alit(60, 120000), Js.alit(80, 300000)), trainingStar = 360, clubOwner = 180000, topItem = 36000, island = 120000, president = 360000, notes = Js.O({}, nil), ideas = Js.alit() }, { "match", "mult", "trophies", "otherTrophy", "promotionShare", "awards", "ballon", "milestones", "achievementTiers", "achievementTier", "achievementXp", "records", "fame", "trainingStar", "clubOwner", "topItem", "island", "president", "notes", "ideas" })
	exports.DEFAULT_XP = DEFAULT_XP
	current = DEFAULT_XP
	isNum = function(v)
		return (((type(v) == "number") and Js.NumberNS.isFinite(v)) and (v >= 0))
	end
	ALL_DIVISIONS = DIVS_ALL
	exports.ALL_DIVISIONS = ALL_DIVISIONS
end
