--!nocheck
--!nolint
-- Generated from lib/star/leagueSquads.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local M_squadData = import("lib/star/squadData")
	local M_edition = import("lib/star/edition")
	local M_squadSaveCodec = import("lib/star/squadSaveCodec")
	local M_realSquad = import("lib/star/realSquad")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_clubRating = import("lib/star/world/clubRating")
	local POSITION_ORDER, positionsOf, NEIGHBOURS, VALID_ROLES, rolesOf, fit, OUT_OF_POSITION_FIT, buildLeagueSquad, relabelOutOfPosition, moveSquadsWithLadder, withoutPlayersElsewhere, addFullRoster, rowToLeaguePlayer, naturalPosition, avgOverallFor, generatedSquad, shouldUpgradeLeagueSquads, shouldUpgradeExternalSquads, fetchLeagueSquads, SQUAD_SHARE_MS, squadRowCache, FREE_AGENTS_CLUB, fetchFreeAgents, SCORE_WEIGHT, ASSIST_WEIGHT, BENCH_WEIGHT, weightedPick, scorerQuality, creatorQuality, ASSIST_SHARE, nameGoals, pickGoalIds, creditNamedGoals, resetLeagueSquads, destinySeed, growthCeilingFor, TRAINING_TIER_MULTIPLIER, applyEliteDamping, growWonderkids, averageStartingXIRating, syncLeagueStrengthFromSquads, mergeLeagueSquadStats, reconcileExternalSquads, refreshLeagueSquadPhotos, isRealFetch
	positionsOf = function(raw)
		do return A.filter(A.map(S.split((if Js.T(raw) then raw else ""), Js.re("[^A-Za-z]+", "")), function(p)
			return S.toUpperCase(S.trim(p))
		end), Js.Boolean) end
	end
	rolesOf = function(raw)
		local out = Js.alit()
		do
			local _arr1 = positionsOf(raw)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local tok = _arr1[_i2]
				local role = tok
				if (VALID_ROLES:has(role) and (not A.includes(out, role))) then
					A.push(out, role)
				end
			end
		end
		do return out end
	end
	exports.rolesOf = rolesOf
	fit = function(slot, positions)
		local ps = positionsOf(positions)
		if (Js.alen(ps) == 0) then
			do return 0 end
		end
		if (slot == "GK") then
			do return (if (ps[1] == "GK") then 100 else 0) end
		end
		if A.includes(ps, "GK") then
			do return 0 end
		end
		if (ps[1] == slot) then
			do return 100 end
		end
		if A.includes(ps, slot) then
			do return 82 end
		end
		local near = (if NEIGHBOURS[slot] ~= nil then NEIGHBOURS[slot] else Js.alit())
		for i = 0, (Js.alen(near)) - 1 do
			if A.includes(ps, near[i + 1]) then
				do return (64 - (i * 6)) end
			end
		end
		do return OUT_OF_POSITION_FIT end
	end
	buildLeagueSquad = function(club, roster, keepAll)
		if keepAll == nil then keepAll = false end
		if (not Js.T(Js.alen(roster))) then
			local div = M_clubs.divisionOf(club)
			if (((((div == "league_one") or (div == "league_two")) or (div == "national_league")) or (div == "national_league_north")) or (div == "national_league_south")) then
				do return generatedSquad(club, avgOverallFor(club)) end
			end
			do return Js.O({ club = club, players = Js.alit() }, { "club", "players" }) end
		end
		local taken = Js.Set.new()
		local players = Js.alit()
		do
			local _arr3 = POSITION_ORDER
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local slot = _arr3[_i4]
				local best = nil
				local bestScore = -1
				local bestFit = 0
				do
					local _arr5 = roster
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local p = _arr5[_i6]
						if taken:has(p.id) then
							do continue end
						end
						local f = fit(slot, p.positions)
						if (f <= 0) then
							do continue end
						end
						local score = ((f * 100) + p.overall)
						if (score > bestScore) then
							bestScore = score
							best = p
							bestFit = f
						end
					end
				end
				if (not best) then
					do continue end
				end
				taken:add(best.id)
				A.push(players, Js.ospread(Js.O({ id = best.id, name = best.name, position = (if (bestFit > OUT_OF_POSITION_FIT) then slot else naturalPosition(best.positions)), overall = (if Js.T(best.overall) then best.overall else 65), goals = 0, assists = 0 }, { "id", "name", "position", "overall", "goals", "assists" }), (if Js.T(best.image) then Js.O({ image = best.image }, { "image" }) else Js.O({}, nil)), (if Js.T(best.nation) then Js.O({ nation = best.nation }, { "nation" }) else Js.O({}, nil)), (if Js.T(best.age) then Js.O({ age = best.age }, { "age" }) else Js.O({}, nil)), (if best.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if best.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil)), (if Js.T(best.pace) then Js.O({ pace = best.pace }, { "pace" }) else Js.O({}, nil)), (if Js.T(best.shooting) then Js.O({ shooting = best.shooting }, { "shooting" }) else Js.O({}, nil)), (if Js.T(best.passing) then Js.O({ passing = best.passing }, { "passing" }) else Js.O({}, nil)), (if Js.T(best.dribbling) then Js.O({ dribbling = best.dribbling }, { "dribbling" }) else Js.O({}, nil)), (if Js.T(best.defending) then Js.O({ defending = best.defending }, { "defending" }) else Js.O({}, nil)), (if Js.T(best.physical) then Js.O({ physical = best.physical }, { "physical" }) else Js.O({}, nil)), Js.O({ positions = rolesOf(best.positions) }, { "positions" })))
			end
		end
		if keepAll then
			do
				local _arr7 = roster
				local _i8 = 0
				while _i8 < Js.alen(_arr7) do
					_i8 += 1
					local p = _arr7[_i8]
					if taken:has(p.id) then
						do continue end
					end
					taken:add(p.id)
					A.push(players, rowToLeaguePlayer(p))
				end
			end
		end
		do return Js.O({ club = club, players = players }, { "club", "players" }) end
	end
	exports.buildLeagueSquad = buildLeagueSquad
	relabelOutOfPosition = function(squads)
		local changed = false
		local out = A.map(squads, function(s)
			local clubChanged = false
			local players = A.map(s.players, function(p)
				if ((not Js.T((function() local _v = p.positions; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())) or A.includes(p.positions, p.position)) then
					do return p end
				end
				local raw = A.join(p.positions, ",")
				if (fit(p.position, raw) > OUT_OF_POSITION_FIT) then
					do return p end
				end
				clubChanged = true
				do return Js.ospread(p, Js.O({ position = naturalPosition(raw) }, { "position" })) end
			end)
			if (not clubChanged) then
				do return s end
			end
			changed = true
			do return Js.ospread(s, Js.O({ players = players }, { "players" })) end
		end)
		do return (if changed then out else squads) end
	end
	exports.relabelOutOfPosition = relabelOutOfPosition
	moveSquadsWithLadder = function(league, external, clubs)
		local inDivision = Js.Set.new(clubs)
		local staying = A.filter(league, function(s)
			return inDivision:has(s.club)
		end)
		local leaving = A.filter(league, function(s)
			return (not inDivision:has(s.club))
		end)
		local have = Js.Set.new(A.map(staying, function(s)
			return s.club
		end))
		local arriving = A.filter(external, function(s)
			return (inDivision:has(s.club) and (not have:has(s.club)))
		end)
		local leavingClubs = Js.Set.new(A.map(leaving, function(s)
			return s.club
		end))
		do return Js.O({ leagueSquads = Js.aspread(staying, arriving), externalSquads = Js.aspread(A.filter(external, function(s)
			return ((not inDivision:has(s.club)) and (not leavingClubs:has(s.club)))
		end), leaving) }, { "leagueSquads", "externalSquads" }) end
	end
	exports.moveSquadsWithLadder = moveSquadsWithLadder
	withoutPlayersElsewhere = function(fresh, world)
		local placed = Js.Map.new()
		do
			local _arr9 = world
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local s = _arr9[_i10]
				do
					local _arr11 = s.players
					local _i12 = 0
					while _i12 < Js.alen(_arr11) do
						_i12 += 1
						local p = _arr11[_i12]
						placed:set(p.id, s.club)
					end
				end
			end
		end
		do return A.map(fresh, function(s)
			local players = A.filter(s.players, function(p)
				local at = placed:get(p.id)
				do return ((not Js.T(at)) or (at == s.club)) end
			end)
			do return (if (Js.alen(players) == Js.alen(s.players)) then s else Js.ospread(s, Js.O({ players = players }, { "players" }))) end
		end) end
	end
	exports.withoutPlayersElsewhere = withoutPlayersElsewhere
	addFullRoster = function(full, current, world)
		if (not current) then
			do return withoutPlayersElsewhere(Js.alit(full), world)[1] end
		end
		local known = Js.Set.new()
		do
			local _arr13 = world
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local s = _arr13[_i14]
				do
					local _arr15 = s.players
					local _i16 = 0
					while _i16 < Js.alen(_arr15) do
						_i16 += 1
						local p = _arr15[_i16]
						known:add(p.id)
					end
				end
			end
		end
		do
			local _arr17 = current.players
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local p = _arr17[_i18]
				known:add(p.id)
			end
		end
		local extra = A.filter(full.players, function(p)
			return (not known:has(p.id))
		end)
		do return (if Js.T(Js.alen(extra)) then Js.ospread(current, Js.O({ players = Js.aspread(current.players, extra) }, { "players" })) else current) end
	end
	exports.addFullRoster = addFullRoster
	rowToLeaguePlayer = function(p)
		do return Js.ospread(Js.O({ id = p.id, name = p.name, position = naturalPosition(p.positions), overall = (if Js.T(p.overall) then p.overall else 60), goals = 0, assists = 0 }, { "id", "name", "position", "overall", "goals", "assists" }), (if Js.T(p.image) then Js.O({ image = p.image }, { "image" }) else Js.O({}, nil)), (if Js.T(p.nation) then Js.O({ nation = p.nation }, { "nation" }) else Js.O({}, nil)), (if Js.T(p.age) then Js.O({ age = p.age }, { "age" }) else Js.O({}, nil)), (if p.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if p.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil)), (if Js.T(p.pace) then Js.O({ pace = p.pace }, { "pace" }) else Js.O({}, nil)), (if Js.T(p.shooting) then Js.O({ shooting = p.shooting }, { "shooting" }) else Js.O({}, nil)), (if Js.T(p.passing) then Js.O({ passing = p.passing }, { "passing" }) else Js.O({}, nil)), (if Js.T(p.dribbling) then Js.O({ dribbling = p.dribbling }, { "dribbling" }) else Js.O({}, nil)), (if Js.T(p.defending) then Js.O({ defending = p.defending }, { "defending" }) else Js.O({}, nil)), (if Js.T(p.physical) then Js.O({ physical = p.physical }, { "physical" }) else Js.O({}, nil)), Js.O({ positions = rolesOf(p.positions) }, { "positions" })) end
	end
	naturalPosition = function(positions)
		local ps = positionsOf(positions)
		local VALID = Js.alit("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST")
		do
			local _arr19 = ps
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local p = _arr19[_i20]
				if A.includes(VALID, p) then
					do return p end
				end
				if (p == "LM") then
					do return "LW" end
				end
				if (p == "RM") then
					do return "RW" end
				end
				if (p == "LWB") then
					do return "LB" end
				end
				if (p == "RWB") then
					do return "RB" end
				end
				if (p == "CF") then
					do return "ST" end
				end
			end
		end
		do return "CM" end
	end
	exports.naturalPosition = naturalPosition
	avgOverallFor = function(club)
		local div = M_clubs.divisionOf(club)
		if (div == "league_one") then
			do return 63 end
		end
		if (div == "league_two") then
			do return 58 end
		end
		if (div == "national_league") then
			do return 55 end
		end
		local given = (function() local _v = M_clubProfiles.profileOf(club); if _v == nil then return nil end; _v = _v.avgRating; return _v end)()
		if ((given ~= nil) and ((((div == "national_league_north") or (div == "national_league_south")) or (div == "step3_north")) or (div == "step3_south"))) then
			do return given end
		end
		if ((div == "national_league_north") or (div == "national_league_south")) then
			do return 53 end
		end
		if ((div == "step3_north") or (div == "step3_south")) then
			do return 50 end
		end
		do return 73 end
	end
	generatedSquad = function(club, avgOverall)
		if avgOverall == nil then avgOverall = 73 end
		local low = Math.max(30, (Math.round(avgOverall) - 11))
		do return Js.O({ club = club, players = A.map(M_squadData.generateSquad(M_squadData.clubNameSeed(club)), function(p, i)
			return Js.O({ id = ("gen:" .. club .. ":" .. Js.numstr(i)), name = p.name, position = p.position, overall = (low + math.fmod((M_squadData.clubNameSeed(club) + (i * 7)), 22)), goals = 0, assists = 0, image = p.imageUrl }, { "id", "name", "position", "overall", "goals", "assists", "image" })
		end) }, { "club", "players" }) end
	end
	shouldUpgradeLeagueSquads = function(squads)
		if (Js.alen(squads) == 0) then
			do return false end
		end
		local real = A.filter(A.flatMap(squads, function(s)
			return s.players
		end), function(p)
			return (not Js.re("^rg\\d+\\.", ""):test(p.id))
		end)
		if (Js.alen(real) == 0) then
			do return false end
		end
		local withNation = A.filter(real, function(p)
			return p.nation
		end)
		if (Js.alen(withNation) == 0) then
			do return true end
		end
		if (Js.alen(withNation) < 20) then
			do return false end
		end
		local withImage = Js.alen(A.filter(withNation, function(p)
			return p.image
		end))
		do return ((withImage / Js.alen(withNation)) < 0.5) end
	end
	exports.shouldUpgradeLeagueSquads = shouldUpgradeLeagueSquads
	shouldUpgradeExternalSquads = function(squads, expectedClubs)
		if (Js.alen(squads) == 0) then
			do return false end
		end
		local withPlayers = Js.alen(A.filter(squads, function(s)
			return (Js.alen(s.players) > 0)
		end))
		if ((withPlayers / Js.alen(squads)) < 0.5) then
			do return true end
		end
		if A.some(squads, function(s)
			return ((Js.alen(s.players) > 0) and A.every(s.players, function(p)
				return S.startsWith(p.id, "gen:")
			end))
		end) then
			do return true end
		end
		if (not expectedClubs) then
			do return false end
		end
		local have = Js.Set.new(A.map(squads, function(s)
			return s.club
		end))
		do return A.some(expectedClubs, function(c)
			return (not have:has(c))
		end) end
	end
	exports.shouldUpgradeExternalSquads = shouldUpgradeExternalSquads
	fetchLeagueSquads = function(clubs, year, keepAll)
		if year == nil then year = M_edition.STAR_FIFA_YEAR end
		if keepAll == nil then keepAll = false end
		local now = Js.Date.now()
		local missing = A.filter(clubs, function(c)
			local hit = squadRowCache:get((Js.numstr(year) .. "|" .. c))
			do return ((not hit) or ((now - hit.at) > SQUAD_SHARE_MS)) end
		end)
		if Js.T(Js.alen(missing)) then
			local req = Js.fetch(("/api/star/league-squads?clubs=" .. Js.encodeURIComponent(A.join(missing, "|")) .. "&year=" .. Js.numstr(year)), M_edition.SQUAD_FETCH_INIT):andThen(function(res)
				return (if res.ok then (Js.await(res.json()).squads or Js.O({}, nil)) else nil)
			end):catch_(function()
				return nil
			end)
			do
				local _arr21 = missing
				local _i22 = 0
				while _i22 < Js.alen(_arr21) do
					_i22 += 1
					local c = _arr21[_i22]
					local key = (Js.numstr(year) .. "|" .. c)
					local rows = req:andThen(function(squads)
						if (not squads) then
							squadRowCache:delete(key)
							do return nil end
						end
						do return (if squads[c] ~= nil then squads[c] else Js.alit()) end
					end)
					squadRowCache:set(key, Js.O({ at = now, rows = rows }, { "at", "rows" }))
				end
			end
		end
		local rows = Js.await(Js.Promise.all(A.map(clubs, function(c)
			return squadRowCache:get((Js.numstr(year) .. "|" .. c)).rows
		end)))
		local fetched = Js.alit()
		local squads = A.map(clubs, function(c, i)
			local r = rows[i + 1]
			if (not r) then
				do return generatedSquad(c, avgOverallFor(c)) end
			end
			local sq = buildLeagueSquad(c, r, keepAll)
			A.push(fetched, sq)
			do return sq end
		end)
		if ((year == M_edition.STAR_FIFA_YEAR) and Js.T(Js.alen(fetched))) then
			M_squadSaveCodec.rememberFetchedSquads(fetched)
		end
		do return squads end
	end
	exports.fetchLeagueSquads = fetchLeagueSquads
	fetchFreeAgents = function(year)
		if year == nil then year = M_edition.STAR_FIFA_YEAR end
		local _ok23, _err24, _rv25 = pcall(function()
			local res = Js.await(Js.fetch(("/api/star/league-squads?clubs=" .. Js.encodeURIComponent(FREE_AGENTS_CLUB) .. "&year=" .. Js.numstr(year)), M_edition.SQUAD_FETCH_INIT))
			if (not res.ok) then
				do return Js.RET, Js.alit() end
			end
			local data = Js.await(res.json())
			do return Js.RET, A.map(((function() local _v = data.squads; if _v == nil then return nil end; _v = _v[FREE_AGENTS_CLUB]; return _v end)() or Js.alit()), rowToLeaguePlayer) end
		end)
		if not _ok23 then
			do return Js.alit() end
		elseif _err24 == Js.RET then
			return _rv25
		end
	end
	exports.fetchFreeAgents = fetchFreeAgents
	weightedPick = function(players, weights, rng, exclude, quality)
		if quality == nil then quality = scorerQuality end
		local total = 0
		local w = Js.alit()
		for i = 0, (Js.alen(players)) - 1 do
			local p = players[i + 1]
			local q = quality(p)
			local bench = (if (i >= 11) then BENCH_WEIGHT else 1)
			local x = (if (p.id == exclude) then 0 else (((if weights[p.position] ~= nil then weights[p.position] else 1) * q) * bench))
			A.push(w, x)
			total += x
		end
		if (total <= 0) then
			do return nil end
		end
		local r = (rng() * total)
		for i = 0, (Js.alen(players)) - 1 do
			r -= w[i + 1]
			if (r <= 0) then
				do return players[i + 1] end
			end
		end
		do return (players[Js.alen(players)] or nil) end
	end
	scorerQuality = function(p)
		do return (0.55 + (((Math.max(40, Math.min(99, p.overall)) - 40) / 59) * 0.9)) end
	end
	creatorQuality = function(p)
		local r = ((Math.max(40, Math.min(99, p.overall)) - 40) / 59)
		local passing = (if Js.T(p.passing) then Math.pow((Math.max(40, p.passing) / 75), 2) else 1)
		do return ((0.25 + (Math.pow(r, 3) * 2.4)) * passing) end
	end
	nameGoals = function(squad, count, rng)
		if ((not squad) or (count <= 0)) then
			do return Js.alit() end
		end
		local out = Js.alit()
		for i = 0, math.ceil(count) - 1 do
			local scorer = weightedPick(squad.players, SCORE_WEIGHT, rng)
			if (not scorer) then
				do break end
			end
			scorer.goals += 1
			local assister = (if (rng() < ASSIST_SHARE) then weightedPick(squad.players, ASSIST_WEIGHT, rng, scorer.id, creatorQuality) else nil)
			if assister then
				assister.assists += 1
			end
			A.push(out, Js.ospread(Js.O({ m = (2 + math.floor((rng() * 88))), s = M_realSquad.shortNameOf(scorer.name), full = scorer.name, role = scorer.position }, { "m", "s", "full", "role" }), (if assister then Js.O({ a = M_realSquad.shortNameOf(assister.name) }, { "a" }) else Js.O({}, nil))))
		end
		do return A.sort(out, function(a, b)
			return (a.m - b.m)
		end) end
	end
	exports.nameGoals = nameGoals
	pickGoalIds = function(squad, count, rng)
		if ((not squad) or (count <= 0)) then
			do return Js.alit() end
		end
		local out = Js.alit()
		for i = 0, math.ceil(count) - 1 do
			local scorer = weightedPick(squad.players, SCORE_WEIGHT, rng)
			if (not scorer) then
				do break end
			end
			local assister = (if (rng() < ASSIST_SHARE) then weightedPick(squad.players, ASSIST_WEIGHT, rng, scorer.id, creatorQuality) else nil)
			A.push(out, Js.ospread(Js.O({ id = scorer.id, name = scorer.name, m = (2 + math.floor((rng() * 88))) }, { "id", "name", "m" }), (if assister then Js.O({ assistId = assister.id, assist = assister.name }, { "assistId", "assist" }) else Js.O({}, nil))))
		end
		do return A.sort(out, function(a, b)
			return (a.m - b.m)
		end) end
	end
	exports.pickGoalIds = pickGoalIds
	creditNamedGoals = function(squad, goals)
		local byId = Js.Map.new(A.map(((function() local _v = squad; if _v == nil then return nil end; _v = _v.players; return _v end)() or Js.alit()), function(p)
			return Js.alit(p.id, p)
		end))
		do
			local _arr26 = goals
			local _i27 = 0
			while _i27 < Js.alen(_arr26) do
				_i27 += 1
				local g = _arr26[_i27]
				local scorer = byId:get(g.id)
				if scorer then
					scorer.goals += 1
				end
				if Js.T(g.assistId) then
					local assister = byId:get(g.assistId)
					if assister then
						assister.assists += 1
					end
				end
			end
		end
		do return A.sort(A.map(goals, function(g)
			return Js.ospread(Js.O({ m = g.m, s = g.s }, { "m", "s" }), (if Js.T(g.a) then Js.O({ a = g.a }, { "a" }) else Js.O({}, nil)))
		end), function(a, b)
			return (a.m - b.m)
		end) end
	end
	exports.creditNamedGoals = creditNamedGoals
	resetLeagueSquads = function(squads)
		do return A.map(squads, function(s)
			return Js.ospread(s, Js.O({ players = A.map(s.players, function(p)
				return Js.ospread(p, Js.O({ goals = 0, assists = 0 }, { "goals", "assists" }))
			end) }, { "players" }))
		end) end
	end
	exports.resetLeagueSquads = resetLeagueSquads
	destinySeed = function(id)
		local h = 2166136261
		for i = 0, (S.len(id)) - 1 do
			h = Js.bxor(h, S.charCodeAt(id, i))
			h = Math.imul(h, 16777619)
		end
		do return (Js.ushr(h, 0) / 4294967295) end
	end
	growthCeilingFor = function(playerId, worldClassPotential)
		local cap = M_tuningStore.getTuning("wonderkids.growthCap")
		local worldClassCap = M_tuningStore.getTuning("wonderkids.worldClassGrowthCap")
		local seed = destinySeed(playerId)
		if worldClassPotential then
			do return (if (seed < M_tuningStore.getTuning("wonderkids.underachieveChance")) then cap else worldClassCap) end
		end
		do return (if (seed < M_tuningStore.getTuning("wonderkids.breakoutChance")) then worldClassCap else cap) end
	end
	exports.growthCeilingFor = growthCeilingFor
	applyEliteDamping = function(startingOverall, rawGain)
		local start = M_tuningStore.getTuning("wonderkids.eliteDampingStart")
		local rate = M_tuningStore.getTuning("wonderkids.eliteDampingRate")
		local overall = startingOverall
		local remaining = rawGain
		local total = 0
		while (remaining > 0) do
			local step = Math.min(remaining, 1)
			local over = Math.max(0, (overall - start))
			total += (step * Math.pow(rate, over))
			overall += step
			remaining -= step
		end
		do return total end
	end
	growWonderkids = function(squads, rng, trainingTierFor)
		local ageCeiling = M_tuningStore.getTuning("wonderkids.ageCeiling")
		local chance = M_tuningStore.getTuning("wonderkids.growthChance")
		local minGain = M_tuningStore.getTuning("wonderkids.growthMin")
		local maxGain = M_tuningStore.getTuning("wonderkids.growthMax")
		local worldClassMultiplier = M_tuningStore.getTuning("wonderkids.worldClassMultiplier")
		do return A.map(squads, function(s)
			local trainingMultiplier = TRAINING_TIER_MULTIPLIER[Js.key(((function() local _f = trainingTierFor; if _f == nil then return nil end; return _f(s.club) end)() or 2))]
			do return Js.ospread(s, Js.O({ players = A.map(s.players, function(p)
				if ((not p.highPotential) or ((if p.age ~= nil then p.age else 0) >= ageCeiling)) then
					do return p end
				end
				local tierChance = Math.min(1, ((if p.worldClassPotential then (chance * worldClassMultiplier) else chance) * trainingMultiplier))
				if (rng() >= tierChance) then
					do return p end
				end
				local tierMin = ((if p.worldClassPotential then (minGain * worldClassMultiplier) else minGain) * trainingMultiplier)
				local tierMax = ((if p.worldClassPotential then (maxGain * worldClassMultiplier) else maxGain) * trainingMultiplier)
				local rawGain = (tierMin + (rng() * (tierMax - tierMin)))
				local gain = Math.round(applyEliteDamping(p.overall, rawGain))
				local ceiling = growthCeilingFor(p.id, p.worldClassPotential)
				do return Js.ospread(p, Js.O({ overall = Math.min(ceiling, (p.overall + gain)) }, { "overall" })) end
			end) }, { "players" })) end
		end) end
	end
	exports.growWonderkids = growWonderkids
	averageStartingXIRating = function(squad)
		if ((not squad) or (Js.alen(squad.players) == 0)) then
			do return nil end
		end
		local xi = A.slice(squad.players, 0, 11)
		do return Math.round((A.reduce(xi, function(sum, p)
			return (sum + p.overall)
		end, 0) / Js.alen(xi))) end
	end
	exports.averageStartingXIRating = averageStartingXIRating
	syncLeagueStrengthFromSquads = function(league, squads, division)
		local byClub = Js.Map.new(A.map(squads, function(s)
			return Js.alit(s.club, s)
		end))
		local peers = A.map(league, function(t)
			return t.name
		end)
		do return A.map(league, function(t)
			local squad = byClub:get(t.name)
			if (Js.T(division) and squad) then
				local real = (if (M_clubRating.squadRating(squad) ~= nil) then averageStartingXIRating(squad) else nil)
				do return Js.ospread(t, Js.O({ strength = (if real ~= nil then real else Math.round(M_clubRating.dataRating(t.name, division, peers))) }, { "strength" })) end
			end
			local rating = averageStartingXIRating(squad)
			do return (if (rating == nil) then t else Js.ospread(t, Js.O({ strength = rating }, { "strength" }))) end
		end) end
	end
	exports.syncLeagueStrengthFromSquads = syncLeagueStrengthFromSquads
	mergeLeagueSquadStats = function(fresh, previous)
		local before = Js.Map.new(A.map(previous, function(sq)
			return Js.alit(sq.club, Js.Map.new(A.map(sq.players, function(p)
				return Js.alit(p.id, p)
			end)))
		end))
		do return A.map(fresh, function(sq)
			return Js.ospread(sq, Js.O({ players = A.map(sq.players, function(p)
				local was = (function() local _r = before:get(sq.club); if _r == nil then return nil end; return _r:get(p.id) end)()
				do return (if was then Js.ospread(p, Js.O({ goals = was.goals, assists = was.assists }, { "goals", "assists" })) else p) end
			end) }, { "players" }))
		end) end
	end
	exports.mergeLeagueSquadStats = mergeLeagueSquadStats
	reconcileExternalSquads = function(current, fresh, emptiedOnPurpose)
		if emptiedOnPurpose == nil then emptiedOnPurpose = function()
		return false
	end end
		local have = Js.Map.new(A.map(current, function(s)
			return Js.alit(s.club, s)
		end))
		local isGen = function(s)
			return ((Js.alen(s.players) > 0) and A.every(s.players, function(p)
				return S.startsWith(p.id, "gen:")
			end))
		end
		local out = Js.alit()
		local seen = Js.Set.new()
		do
			local _arr28 = fresh
			local _i29 = 0
			while _i29 < Js.alen(_arr28) do
				_i29 += 1
				local f = _arr28[_i29]
				seen:add(f.club)
				local cur = have:get(f.club)
				local freshIsReal = A.some(f.players, function(p)
					return (not S.startsWith(p.id, "gen:"))
				end)
				if ((cur and (Js.alen(cur.players) == 0)) and emptiedOnPurpose(f.club)) then
					A.push(out, cur)
				elseif (((not cur) or (Js.alen(cur.players) == 0)) or (isGen(cur) and freshIsReal)) then
					A.push(out, (if cur then mergeLeagueSquadStats(Js.alit(f), Js.alit(cur))[1] else f))
				else
					A.push(out, cur)
				end
			end
		end
		do
			local _arr30 = current
			local _i31 = 0
			while _i31 < Js.alen(_arr30) do
				_i31 += 1
				local s = _arr30[_i31]
				if (not seen:has(s.club)) then
					A.push(out, s)
				end
			end
		end
		do return out end
	end
	exports.reconcileExternalSquads = reconcileExternalSquads
	refreshLeagueSquadPhotos = function(current, fresh, emptiedOnPurpose)
		if emptiedOnPurpose == nil then emptiedOnPurpose = function()
		return false
	end end
		local photo = Js.Map.new()
		do
			local _arr32 = fresh
			local _i33 = 0
			while _i33 < Js.alen(_arr32) do
				_i33 += 1
				local s = _arr32[_i33]
				do
					local _arr34 = s.players
					local _i35 = 0
					while _i35 < Js.alen(_arr34) do
						_i35 += 1
						local p = _arr34[_i35]
						if Js.T(p.image) then
							photo:set(p.id, p.image)
						end
					end
				end
			end
		end
		local withPhotos = A.map(current, function(s)
			local changed = false
			local players = A.map(s.players, function(p)
				local img = photo:get(p.id)
				if ((not Js.T(img)) or (img == p.image)) then
					do return p end
				end
				changed = true
				do return Js.ospread(p, Js.O({ image = img }, { "image" })) end
			end)
			do return (if changed then Js.ospread(s, Js.O({ players = players }, { "players" })) else s) end
		end)
		do return reconcileExternalSquads(withPhotos, fresh, emptiedOnPurpose) end
	end
	exports.refreshLeagueSquadPhotos = refreshLeagueSquadPhotos
	isRealFetch = function(squads)
		do return A.some(squads, function(s)
			return A.some(s.players, function(p)
				return (not S.startsWith(p.id, "gen:"))
			end)
		end) end
	end
	exports.isRealFetch = isRealFetch
	POSITION_ORDER = Js.alit("GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM", "ST", "GK", "CB", "CDM", "CM", "RW", "LW", "CAM", "ST")
	NEIGHBOURS = Js.O({ GK = Js.alit(), CB = Js.alit("RB", "LB", "CDM"), RB = Js.alit("RM", "RWB", "CB", "RW"), LB = Js.alit("LM", "LWB", "CB", "LW"), CDM = Js.alit("CM", "CB"), CM = Js.alit("CDM", "CAM", "LM", "RM"), CAM = Js.alit("CM", "LW", "RW", "ST", "LM", "RM"), RW = Js.alit("RM", "LW", "ST", "CAM"), LW = Js.alit("LM", "RW", "ST", "CAM"), ST = Js.alit("CF", "LW", "RW", "CAM") }, { "GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST" })
	VALID_ROLES = Js.Set.new(Js.alit("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"))
	OUT_OF_POSITION_FIT = 12
	exports.OUT_OF_POSITION_FIT = OUT_OF_POSITION_FIT
	SQUAD_SHARE_MS = 30000
	squadRowCache = Js.Map.new()
	FREE_AGENTS_CLUB = "Free Agents"
	exports.FREE_AGENTS_CLUB = FREE_AGENTS_CLUB
	SCORE_WEIGHT = Js.O({ ST = 30, CAM = 13, LW = 14, RW = 14, CM = 7, CDM = 2.5, CB = 2.5, LB = 1.2, RB = 1.2, GK = 0 }, { "ST", "CAM", "LW", "RW", "CM", "CDM", "CB", "LB", "RB", "GK" })
	ASSIST_WEIGHT = Js.O({ LW = 18, RW = 18, CAM = 16, CM = 12, ST = 10, LB = 7, RB = 7, CDM = 4, CB = 2, GK = 0.3 }, { "LW", "RW", "CAM", "CM", "ST", "LB", "RB", "CDM", "CB", "GK" })
	BENCH_WEIGHT = 0.22
	ASSIST_SHARE = 0.74
	TRAINING_TIER_MULTIPLIER = Js.O({ ["1"] = 0.7, ["2"] = 1, ["3"] = 1.4 }, { "1", "2", "3" })
	exports.TRAINING_TIER_MULTIPLIER = TRAINING_TIER_MULTIPLIER
end
