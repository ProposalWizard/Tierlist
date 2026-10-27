--!nocheck
--!nolint
-- Generated from lib/star/worldAgeing.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_nationNames = import("lib/star/nationNames")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_realSquad = import("lib/star/realSquad")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local M_squadData = import("lib/star/squadData")
	local UNFLAGGED_GROWTH, seeded, startingAgeFor, RETIREMENT_AGE_WEIGHTS, KEEPER_EXTRA_YEARS, OLD_STARTER_AGE, OLD_STARTER_SEASONS, retirementAgeFor, DECLINE_START, DECLINE_SCALE, KEEPER_DECLINE_SCALE, LEO_DECLINE, meanAgeChange, leoMeanAgeChange, AGEING_PROFILES, ageingProfileOf, talentOf, CEILING_ABOVE_LEVEL, TALENT_SPREAD, ratingChange, clamp, shiftedStats, exempt, keyOfLeague, keyOfSquad, FAMOUS, EXTRA_SURNAMES, REGEN_FIRST, REGEN_LAST, regenName, REGEN_FLAG_BANDS, REGEN_LEVEL_RANGE, REGEN_AGE_RANGE, NEAR_POSITIONS, REGEN_SECOND_POSITION, REGEN_THIRD_POSITION, regenPositions, isRegenId, makeRegen, retireAgeOf, ageOne, reorderByPosition, ageLeagueSquads, clubLevelOf, ageOwnSquad, catchUpFetchedSquads, agedSeasons, ageFetchedForCareer, ageOwnFetchedForCareer, squadNation, squadNationality, mostCommon, worldSeedFor, AWAKE_DIVISIONS, hashInt, hash01
	seeded = function(key, worldSeed)
		do return (if Js.T(worldSeed) then (Js.numstr(worldSeed) .. "~" .. key) else key) end
	end
	startingAgeFor = function(key)
		do return (20 + math.floor((hash01((key .. "|age")) * 13))) end
	end
	exports.startingAgeFor = startingAgeFor
	retirementAgeFor = function(key, position)
		local s = hash01((key .. "|retire"))
		local acc = 0
		local age = 41
		do
			local _arr1 = RETIREMENT_AGE_WEIGHTS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local a = _e3[1]
				local w = _e3[2]
				acc += w
				if (s < acc) then
					age = a
					do break end
				end
			end
		end
		do return (if (position == "GK") then (age + KEEPER_EXTRA_YEARS) else age) end
	end
	exports.retirementAgeFor = retirementAgeFor
	meanAgeChange = function(age)
		if (age >= DECLINE_START) then
			do return (LEO_DECLINE[Math.min((Js.alen(LEO_DECLINE) - 1), (age - DECLINE_START)) + 1] * DECLINE_SCALE) end
		end
		if (age > 25) then
			do return 0 end
		end
		do return leoMeanAgeChange(age) end
	end
	exports.meanAgeChange = meanAgeChange
	leoMeanAgeChange = function(age)
		if (age <= 17) then
			do return 4.5 end
		end
		if (age == 18) then
			do return 4 end
		end
		if (age == 19) then
			do return 3.5 end
		end
		if (age == 20) then
			do return 3 end
		end
		if (age == 21) then
			do return 2.5 end
		end
		if (age == 22) then
			do return 2 end
		end
		if (age == 23) then
			do return 1.5 end
		end
		if (age == 24) then
			do return 1 end
		end
		if (age == 25) then
			do return 0.5 end
		end
		if (age <= 28) then
			do return 0 end
		end
		if (age == 29) then
			do return -0.4 end
		end
		if (age == 30) then
			do return -0.9 end
		end
		if (age == 31) then
			do return -1.4 end
		end
		if (age == 32) then
			do return -1.9 end
		end
		if (age == 33) then
			do return -2.6 end
		end
		if (age == 34) then
			do return -3.1 end
		end
		do return -3.6 end
	end
	exports.leoMeanAgeChange = leoMeanAgeChange
	ageingProfileOf = function(key)
		local r = (hash01((key .. "|profile")) * 100)
		do
			local _arr4 = AGEING_PROFILES
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local p = _arr4[_i5]
				if (r < p.share) then
					do return p end
				end
				r -= p.share
			end
		end
		do return AGEING_PROFILES[3] end
	end
	exports.ageingProfileOf = ageingProfileOf
	talentOf = function(key)
		do return (0.5 + hash01((key .. "|talent"))) end
	end
	ratingChange = function(age, overall, rng, talent, trainingMultiplier, clubLevel, canGrow, declineScale)
		if canGrow == nil then canGrow = true end
		if declineScale == nil then declineScale = 1 end
		local mean = meanAgeChange(age)
		if ((mean >= 0) and (not canGrow)) then
			do return 0 end
		end
		if (mean < 0) then
			local noise = (((rng() + rng()) - 1) * 1.5)
			do return Math.min(0, Math.round(((mean * declineScale) + noise))) end
		end
		if (mean > 0) then
			local nearTop = Math.max(0.1, Math.min(1, ((90 - overall) / 14)))
			local ceiling = (if (clubLevel == nil) then 99 else ((clubLevel + CEILING_ABOVE_LEVEL) + (((talent - 1) * 2) * TALENT_SPREAD)))
			local nearCeiling = Math.max(0, Math.min(1, ((ceiling - overall) / 5)))
			mean *= (((talent * trainingMultiplier) * nearTop) * nearCeiling)
		end
		local noise = (((rng() + rng()) - 1) * 1.5)
		do return Math.round((mean + noise)) end
	end
	exports.ratingChange = ratingChange
	shiftedStats = function(p, delta, age)
		local out = Js.O({}, nil)
		local paceExtra = (if (age >= 33) then -2 else (if (age >= 30) then -1 else 0))
		local physExtra = (if (age >= 33) then -1 else 0)
		do
			local _arr6 = Js.alit("pace", "shooting", "passing", "dribbling", "defending", "physical")
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local k = _arr6[_i7]
				local v = p[k]
				if ((type(v) ~= "number") or (not Js.T(v))) then
					do continue end
				end
				local extra = (if (k == "pace") then paceExtra else (if (k == "physical") then physExtra else 0))
				local next_ = clamp(((v + delta) + extra), 20, 99)
				if (next_ ~= v) then
					out[k] = next_
				end
			end
		end
		do return out end
	end
	exempt = function(id)
		do return S.startsWith(id, "son:") end
	end
	keyOfLeague = function(p, club)
		local gen = Js.re("^gen:.+:(\\d+)$", ""):exec(p.id)
		if gen then
			do return (club .. ":sp_" .. gen[2]) end
		end
		do return (if S.startsWith(p.id, "sp_") then (club .. ":" .. p.id) else p.id) end
	end
	keyOfSquad = function(p, club)
		if Js.T(p.sofifaId) then
			do return p.sofifaId end
		end
		if S.startsWith(p.id, "sf_") then
			do return S.slice(p.id, 3) end
		end
		do return (if S.startsWith(p.id, "sp_") then (club .. ":" .. p.id) else p.id) end
	end
	regenName = function(rng)
		do return (REGEN_FIRST[math.floor((rng() * Js.alen(REGEN_FIRST))) + 1] .. " " .. REGEN_LAST[math.floor((rng() * Js.alen(REGEN_LAST))) + 1]) end
	end
	regenPositions = function(position, rng)
		local opts = (if NEAR_POSITIONS[position] ~= nil then NEAR_POSITIONS[position] else Js.O({ near = Js.alit(), wide = Js.alit() }, { "near", "wide" }))
		local r = rng()
		if ((not Js.T(Js.alen(opts.near))) or (r >= REGEN_SECOND_POSITION)) then
			do return Js.alit(position) end
		end
		local second = opts.near[math.floor((rng() * Js.alen(opts.near))) + 1]
		if (r >= REGEN_THIRD_POSITION) then
			do return Js.alit(position, second) end
		end
		local pool = A.filter(Js.aspread(opts.near, opts.wide), function(x)
			return (x ~= second)
		end)
		do return Js.alit(position, second, pool[math.floor((rng() * Js.alen(pool))) + 1]) end
	end
	exports.regenPositions = regenPositions
	isRegenId = function(id)
		do return Js.re("^rg\\d+\\.", ""):test(id) end
	end
	exports.isRegenId = isRegenId
	makeRegen = function(retireeKey, season, clubLevel, nation, retiree)
		if retiree == nil then retiree = Js.O({}, nil) end
		local id = ("rg" .. Js.numstr(season) .. "." .. N.toString(hashInt(retireeKey), 36) .. S.slice(N.toString(hashInt((retireeKey .. "~")), 36), 0, 4))
		local rng = M_season.mulberry32(hashInt(id))
		local _d8 = REGEN_AGE_RANGE
		local a0 = _d8[1]
		local a1 = _d8[2]
		local age = (a0 + math.floor((rng() * ((a1 - a0) + 1))))
		local _d9 = REGEN_LEVEL_RANGE
		local l0 = _d9[1]
		local l1 = _d9[2]
		local overall = clamp(((Math.round(clubLevel) + l0) + math.floor((rng() * ((l1 - l0) + 1)))), 35, 85)
		local name = (if Js.T(nation) then M_nationNames.madeUpName(nation, id) else regenName(rng))
		local peak = (if retiree.peak ~= nil then retiree.peak else 0)
		local band = (A.find(REGEN_FLAG_BANDS, function(b)
			return (peak >= b.minPeak)
		end) or REGEN_FLAG_BANDS[Js.alen(REGEN_FLAG_BANDS)])
		local f = (rng() * 100)
		local wc = (f < band.worldClass)
		local hp = (wc or (f < (band.worldClass + band.high)))
		local positions = regenPositions((if retiree.position ~= nil then retiree.position else "CM"), rng)
		do return Js.ospread(Js.O({ id = id, name = name, age = age, overall = overall, positions = positions }, { "id", "name", "age", "overall", "positions" }), (if Js.T(nation) then Js.O({ nation = nation }, { "nation" }) else Js.O({}, nil)), (if hp then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if wc then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil))) end
	end
	exports.makeRegen = makeRegen
	retireAgeOf = function(p, key, age)
		if (type(p.retireAt) == "number") then
			do return p.retireAt end
		end
		local rolled = retirementAgeFor(key, p.position)
		do return (if (age >= OLD_STARTER_AGE) then Math.max(rolled, (age + OLD_STARTER_SEASONS)) else rolled) end
	end
	ageOne = function(p, key, season, trainingMultiplier, clubLevel)
		local age = (if p.age ~= nil then p.age else startingAgeFor(key))
		local retireAt = retireAgeOf(p, key, age)
		if (age >= retireAt) then
			do return Js.O({ player = nil, retired = true, age = age }, { "player", "retired", "age" }) end
		end
		local marks = (if ((age + 1) >= OLD_STARTER_AGE) then Js.O({ retireAt = retireAt }, { "retireAt" }) else Js.O({}, nil))
		if (type(p.overall) ~= "number") then
			do return Js.O({ player = Js.ospread(p, marks, Js.O({ age = (age + 1) }, { "age" })), retired = false }, { "player", "retired" }) end
		end
		local rng = M_season.mulberry32(hashInt((key .. "|" .. Js.numstr(season))))
		local canGrow = (UNFLAGGED_GROWTH or isRegenId(p.id))
		local declineScale = (ageingProfileOf(key).decline * (if (p.position == "GK") then KEEPER_DECLINE_SCALE else 1))
		local delta = ratingChange(age, p.overall, rng, talentOf(key), trainingMultiplier, clubLevel, canGrow, declineScale)
		local overall = clamp((p.overall + delta), 30, 99)
		local best = Math.max((if p.peak ~= nil then p.peak else p.overall), p.overall)
		if (overall < best) then
			marks.peak = best
		end
		do return Js.O({ player = Js.ospread(p, shiftedStats(p, (overall - p.overall), age), marks, Js.O({ age = (age + 1), overall = overall }, { "age", "overall" })), retired = false }, { "player", "retired" }) end
	end
	reorderByPosition = function(players)
		local slots = Js.Map.new()
		A.forEach(players, function(p, i)
			local s = (slots:get(p.position) or Js.alit())
			A.push(s, i)
			slots:set(p.position, s)
		end)
		local out = A.slice(players)
		slots:forEach(function(idx)
			local group = A.sort(A.map(idx, function(i)
				return players[i + 1]
			end), function(a, b)
				return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0))
			end)
			A.forEach(idx, function(i, k)
				A.set(out, i, group[k + 1])
			end)
		end)
		do return out end
	end
	ageLeagueSquads = function(squads, season, trainingTierFor, clubLevels, worldSeed)
		if clubLevels == nil then clubLevels = Js.O({}, nil) end
		local retired = Js.alit()
		local levels = Js.ospread(clubLevels)
		local out = A.map(squads, function(s)
			if (Js.alen(s.players) == 0) then
				do return s end
			end
			local tierMult = M_leagueSquads.TRAINING_TIER_MULTIPLIER[Js.key(((function() local _f = trainingTierFor; if _f == nil then return nil end; return _f(s.club) end)() or 2))]
			local level = clubLevelOf(levels, s)
			local regens = (s.club ~= M_leagueSquads.FREE_AGENTS_CLUB)
			local players = Js.alit()
			do
				local _arr10 = s.players
				local _i11 = 0
				while _i11 < Js.alen(_arr10) do
					_i11 += 1
					local p = _arr10[_i11]
					if exempt(p.id) then
						A.push(players, p)
						do continue end
					end
					local key = seeded(keyOfLeague(p, s.club), worldSeed)
					local res = ageOne(p, key, season, tierMult, level)
					if (not res.retired) then
						A.push(players, res.player)
						do continue end
					end
					A.push(retired, Js.O({ club = s.club, id = p.id, name = p.name, age = res.age, position = p.position }, { "club", "id", "name", "age", "position" }))
					if (not regens) then
						do continue end
					end
					local r = makeRegen(key, season, level, (if p.nation ~= nil then p.nation else squadNation(s.players)), Js.O({ peak = (if p.peak ~= nil then p.peak else p.overall), position = p.position }, { "peak", "position" }))
					A.push(players, Js.ospread(Js.O({ id = r.id, name = r.name, position = p.position, overall = r.overall, goals = 0, assists = 0, age = r.age }, { "id", "name", "position", "overall", "goals", "assists", "age" }), (if (Js.alen(r.positions) > 1) then Js.O({ positions = r.positions }, { "positions" }) else Js.O({}, nil)), (if Js.T(r.nation) then Js.O({ nation = r.nation }, { "nation" }) else Js.O({}, nil)), (if r.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if r.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil))))
				end
			end
			do return Js.ospread(s, Js.O({ players = reorderByPosition(players) }, { "players" })) end
		end)
		do return Js.O({ squads = out, retired = retired, clubLevels = levels }, { "squads", "retired", "clubLevels" }) end
	end
	exports.ageLeagueSquads = ageLeagueSquads
	clubLevelOf = function(levels, squad)
		local known = levels[squad.club]
		if (type(known) == "number") then
			do return known end
		end
		local level = (M_leagueSquads.averageStartingXIRating(squad) or 65)
		levels[squad.club] = level
		do return level end
	end
	exports.clubLevelOf = clubLevelOf
	ageOwnSquad = function(squad, club, season, clubLevel, trainingTier, worldSeed)
		if trainingTier == nil then trainingTier = 2 end
		local tierMult = M_leagueSquads.TRAINING_TIER_MULTIPLIER[Js.key(trainingTier)]
		local rated = A.some(squad, function(p)
			return (type(p.overall) == "number")
		end)
		local retired = Js.alit()
		local out = Js.alit()
		do
			local _arr12 = squad
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local p = _arr12[_i13]
				if exempt(p.id) then
					A.push(out, p)
					do continue end
				end
				local key = seeded(keyOfSquad(p, club), worldSeed)
				local res = ageOne(p, key, season, tierMult, clubLevel)
				if (not res.retired) then
					A.push(out, res.player)
					do continue end
				end
				A.push(retired, Js.O({ club = club, id = p.id, name = p.name, age = res.age, position = p.position }, { "club", "id", "name", "age", "position" }))
				local r = makeRegen(key, season, clubLevel, (if p.nationality ~= nil then p.nationality else squadNationality(squad)), Js.O({ peak = (if p.peak ~= nil then p.peak else p.overall), position = p.position }, { "peak", "position" }))
				A.push(out, Js.ospread(Js.O({ id = r.id, name = r.name, shortName = M_realSquad.shortNameOf(r.name), position = p.position, seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0, leagueGoals = 0, leagueAssists = 0, age = r.age, positions = r.positions, imageUrl = M_fakeFaces.fakeFaceFor(r.id) }, { "id", "name", "shortName", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "leagueGoals", "leagueAssists", "age", "positions", "imageUrl" }), (if Js.T(r.nation) then Js.O({ nationality = r.nation }, { "nationality" }) else Js.O({}, nil)), (if rated then Js.O({ overall = r.overall }, { "overall" }) else Js.O({}, nil)), (if r.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if r.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil))))
			end
		end
		do return Js.O({ squad = (if rated then reorderByPosition(out) else out), retired = retired }, { "squad", "retired" }) end
	end
	exports.ageOwnSquad = ageOwnSquad
	catchUpFetchedSquads = function(fresh, from, to, trainingTierFor, clubLevels, worldSeed)
		if clubLevels == nil then clubLevels = Js.O({}, nil) end
		local out = fresh
		local levels = clubLevels
		do
			local s = from
			local _first14 = true
			while true do
				if not _first14 then
					s += 1
				end
				_first14 = false
				if not (s <= to) then break end
				local r = ageLeagueSquads(out, s, trainingTierFor, levels, worldSeed)
				out = r.squads
				levels = r.clubLevels
			end
		end
		do return out end
	end
	exports.catchUpFetchedSquads = catchUpFetchedSquads
	agedSeasons = function(c)
		if ((type(c.worldAgedSince) ~= "number") or (c.worldAgedSince >= c.season)) then
			do return nil end
		end
		do return Js.alit(c.worldAgedSince, (c.season - 1)) end
	end
	ageFetchedForCareer = function(c, fresh)
		local span = agedSeasons(c)
		if (not span) then
			do return fresh end
		end
		do return catchUpFetchedSquads(fresh, span[1], span[2], nil, (if c.clubLevels ~= nil then c.clubLevels else Js.O({}, nil)), c.worldSeed) end
	end
	exports.ageFetchedForCareer = ageFetchedForCareer
	ageOwnFetchedForCareer = function(c, club, squad)
		local span = agedSeasons(c)
		if (not span) then
			do return squad end
		end
		local rated = A.slice(A.filter(squad, function(p)
			return (type(p.overall) == "number")
		end), 0, 11)
		local level = ((function() local _v = c.clubLevels; if _v == nil then return nil end; _v = _v[club]; return _v end)() or (if Js.T(Js.alen(rated)) then Math.round((A.reduce(rated, function(n, p)
			return (n + (if p.overall ~= nil then p.overall else 0))
		end, 0) / Js.alen(rated))) else 65))
		local out = squad
		do
			local s = span[1]
			local _first15 = true
			while true do
				if not _first15 then
					s += 1
				end
				_first15 = false
				if not (s <= span[2]) then break end
				out = ageOwnSquad(out, club, s, level, 2, c.worldSeed).squad
			end
		end
		do return out end
	end
	exports.ageOwnFetchedForCareer = ageOwnFetchedForCareer
	squadNation = function(players)
		do return mostCommon(A.map(players, function(p)
			return p.nation
		end)) end
	end
	squadNationality = function(players)
		do return mostCommon(A.map(players, function(p)
			return p.nationality
		end)) end
	end
	mostCommon = function(xs)
		local n = Js.Map.new()
		do
			local _arr16 = xs
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local x = _arr16[_i17]
				if Js.T(x) then
					n:set(x, ((n:get(x) or 0) + 1))
				end
			end
		end
		local best = nil
		local top = 0
		n:forEach(function(c, x)
			if (c > top) then
				top = c
				best = x
			end
		end)
		do return best end
	end
	worldSeedFor = function(player)
		do return (math.fmod(hashInt((player.firstName .. " " .. player.lastName .. "|" .. Js.numstr(player.startYear) .. "|" .. player.nationality .. "|" .. player.position .. "|world")), 2147483646) + 1) end
	end
	exports.worldSeedFor = worldSeedFor
	hashInt = function(s)
		local h = 2166136261
		for i = 0, (S.len(s)) - 1 do
			h = Js.bxor(h, S.charCodeAt(s, i))
			h = Math.imul(h, 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	hash01 = function(s)
		do return (hashInt(s) / 4294967296) end
	end
	UNFLAGGED_GROWTH = false
	exports.UNFLAGGED_GROWTH = UNFLAGGED_GROWTH
	RETIREMENT_AGE_WEIGHTS = Js.alit(Js.alit(35, 0.06), Js.alit(36, 0.12), Js.alit(37, 0.2), Js.alit(38, 0.24), Js.alit(39, 0.2), Js.alit(40, 0.12), Js.alit(41, 0.06))
	exports.RETIREMENT_AGE_WEIGHTS = RETIREMENT_AGE_WEIGHTS
	KEEPER_EXTRA_YEARS = 2
	exports.KEEPER_EXTRA_YEARS = KEEPER_EXTRA_YEARS
	OLD_STARTER_AGE = 40
	exports.OLD_STARTER_AGE = OLD_STARTER_AGE
	OLD_STARTER_SEASONS = 2
	exports.OLD_STARTER_SEASONS = OLD_STARTER_SEASONS
	DECLINE_START = 31
	exports.DECLINE_START = DECLINE_START
	DECLINE_SCALE = 0.6
	exports.DECLINE_SCALE = DECLINE_SCALE
	KEEPER_DECLINE_SCALE = 0.6
	exports.KEEPER_DECLINE_SCALE = KEEPER_DECLINE_SCALE
	LEO_DECLINE = Js.alit(-0.4, -0.9, -1.4, -1.9, -2.6, -3.1, -3.6)
	AGEING_PROFILES = Js.alit(Js.O({ name = "ages very well", share = 10, decline = 0.4 }, { "name", "share", "decline" }), Js.O({ name = "ages well", share = 20, decline = 0.7 }, { "name", "share", "decline" }), Js.O({ name = "normal", share = 40, decline = 1 }, { "name", "share", "decline" }), Js.O({ name = "ages badly", share = 20, decline = 1.4 }, { "name", "share", "decline" }), Js.O({ name = "ages very badly", share = 10, decline = 1.8 }, { "name", "share", "decline" }))
	exports.AGEING_PROFILES = AGEING_PROFILES
	CEILING_ABOVE_LEVEL = 2
	exports.CEILING_ABOVE_LEVEL = CEILING_ABOVE_LEVEL
	TALENT_SPREAD = 8
	exports.TALENT_SPREAD = TALENT_SPREAD
	clamp = function(v, lo, hi)
		return Math.max(lo, Math.min(hi, v))
	end
	FAMOUS = Js.Set.new(Js.alit("Mbappe", "Modric", "Muller", "Salah", "Firmino", "Mane", "Cancelo", "Zaha", "Sterling", "Kovacic", "Perisic", "Werner", "Suarez", "Toney", "Watkins", "Kylian", "Vinicius", "Rodrygo", "Riyad"))
	EXTRA_SURNAMES = Js.alit("Hughes", "Dawson", "Price", "Fletcher", "Holt", "Bennett", "Carver", "Lowe", "Pearce", "Doyle", "Kerr", "Nolan", "Okafor", "Mensah", "Adeyemi", "Owusu", "Bakari", "Sall", "Ndiaye", "Kamara", "Fonseca", "Pires", "Almeida", "Navarro", "Ortega", "Rivas", "Castro", "Vidal", "Romero", "Iglesias", "Petit", "Lambert", "Girard", "Roux", "Brandt", "Vogel", "Keller", "Novak", "Horvat", "Larsen", "Lindqvist", "Jansen", "De Vries", "Bakker", "Rossi", "Bianchi", "Esposito", "Moretti", "Conti", "Ferri")
	REGEN_FIRST = A.filter(M_squadData.FIRST_NAMES, function(n)
		return (not FAMOUS:has(n))
	end)
	REGEN_LAST = Js.aspread(A.filter(M_squadData.LAST_NAMES, function(n)
		return (not FAMOUS:has(n))
	end), EXTRA_SURNAMES)
	REGEN_FLAG_BANDS = Js.alit(Js.O({ minPeak = 87, worldClass = 80, high = 19 }, { "minPeak", "worldClass", "high" }), Js.O({ minPeak = 83, worldClass = 10, high = 60 }, { "minPeak", "worldClass", "high" }), Js.O({ minPeak = 0, worldClass = 1, high = 5 }, { "minPeak", "worldClass", "high" }))
	exports.REGEN_FLAG_BANDS = REGEN_FLAG_BANDS
	REGEN_LEVEL_RANGE = Js.alit(-13, 2)
	exports.REGEN_LEVEL_RANGE = REGEN_LEVEL_RANGE
	REGEN_AGE_RANGE = Js.alit(16, 20)
	exports.REGEN_AGE_RANGE = REGEN_AGE_RANGE
	NEAR_POSITIONS = Js.O({ GK = Js.O({ near = Js.alit(), wide = Js.alit() }, { "near", "wide" }), RB = Js.O({ near = Js.alit("LB", "CB"), wide = Js.alit("RW", "CDM", "CM", "CAM") }, { "near", "wide" }), LB = Js.O({ near = Js.alit("RB", "CB"), wide = Js.alit("LW", "CDM", "CM", "CAM") }, { "near", "wide" }), CB = Js.O({ near = Js.alit("CDM", "LB", "RB"), wide = Js.alit("CM") }, { "near", "wide" }), CDM = Js.O({ near = Js.alit("CM", "CB"), wide = Js.alit("CAM", "LB", "RB") }, { "near", "wide" }), CM = Js.O({ near = Js.alit("CDM", "CAM"), wide = Js.alit("LW", "RW", "CB") }, { "near", "wide" }), CAM = Js.O({ near = Js.alit("CM", "ST"), wide = Js.alit("LW", "RW", "CDM") }, { "near", "wide" }), LW = Js.O({ near = Js.alit("RW", "ST", "CAM"), wide = Js.alit("CM", "LB") }, { "near", "wide" }), RW = Js.O({ near = Js.alit("LW", "ST", "CAM"), wide = Js.alit("CM", "RB") }, { "near", "wide" }), ST = Js.O({ near = Js.alit("LW", "RW", "CAM"), wide = Js.alit("CM") }, { "near", "wide" }) }, { "GK", "RB", "LB", "CB", "CDM", "CM", "CAM", "LW", "RW", "ST" })
	exports.NEAR_POSITIONS = NEAR_POSITIONS
	REGEN_SECOND_POSITION = 0.25
	exports.REGEN_SECOND_POSITION = REGEN_SECOND_POSITION
	REGEN_THIRD_POSITION = 0.05
	exports.REGEN_THIRD_POSITION = REGEN_THIRD_POSITION
	AWAKE_DIVISIONS = Js.alit("premier", "championship")
	exports.AWAKE_DIVISIONS = AWAKE_DIVISIONS
end
