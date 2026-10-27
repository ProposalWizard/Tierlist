--!nocheck
--!nolint
-- Generated from lib/star/leagueTransfers.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_realSquad = import("lib/star/realSquad")
	local M_formations = import("lib/star/formations")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_rivalries = import("lib/star/rivalries")
	local M_leagueSquads = import("lib/star/leagueSquads")
	local M_teamsheet = import("lib/star/teamsheet")
	local ROLES, stableKey, fromSquadPlayer, fromLeaguePlayer, toSquadPlayer, toLeaguePlayer, clubStrength, reachDown, REACH_UP, FREE_AGENT_REACH_MULT, SQUAD_TARGET, MIN_SQUAD_SIZE, clampUnit, slotsFor, positionNeed, sellability, loanOrSale, rivalrySellChance, feeFor, reachBonusFor, windowBudget, maxSigningsFor, runTransferWindow, INTERNATIONAL_STAR_THRESHOLD, INTERNATIONAL_WINDOW_CHANCE, internationalDealCount, worldClubsFrom, internationalSellability, listedAcross, INTERNATIONAL_REACH_MULT, INTERNATIONAL_REACH_UP, bestBuyerAmong, runInternationalWindow, returnLoansHome
	stableKey = function(c)
		do return (if c.sofifaId ~= nil then c.sofifaId else c.id) end
	end
	fromSquadPlayer = function(p, club)
		do return Js.O({ id = p.id, name = p.name, shortName = (if Js.T(p.shortName) then p.shortName else M_realSquad.shortNameOf(p.name)), position = p.position, positions = (if Js.T((function() local _v = p.positions; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then p.positions else Js.alit(p.position)), overall = (if p.overall ~= nil then p.overall else 65), club = club, isYou = true, sofifaId = p.sofifaId, imageUrl = p.imageUrl, nationality = p.nationality, age = p.age, seasonGoals = p.seasonGoals, seasonAssists = p.seasonAssists, careerGoals = p.careerGoals, careerAssists = p.careerAssists, leagueGoals = p.leagueGoals, leagueAssists = p.leagueAssists, highPotential = p.highPotential, worldClassPotential = p.worldClassPotential, peak = p.peak, retireAt = p.retireAt }, { "id", "name", "shortName", "position", "positions", "overall", "club", "isYou", "sofifaId", "imageUrl", "nationality", "age", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "leagueGoals", "leagueAssists", "highPotential", "worldClassPotential", "peak", "retireAt" }) end
	end
	fromLeaguePlayer = function(p, club)
		do return Js.O({ id = p.id, name = p.name, shortName = M_realSquad.shortNameOf(p.name), position = p.position, positions = (if Js.T((function() local _v = p.positions; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then p.positions else Js.alit(p.position)), overall = p.overall, club = club, isYou = false, sofifaId = p.id, imageUrl = p.image, nationality = p.nation, age = p.age, seasonGoals = p.goals, seasonAssists = p.assists, careerGoals = 0, careerAssists = 0, highPotential = p.highPotential, worldClassPotential = p.worldClassPotential, peak = p.peak, retireAt = p.retireAt }, { "id", "name", "shortName", "position", "positions", "overall", "club", "isYou", "sofifaId", "imageUrl", "nationality", "age", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "highPotential", "worldClassPotential", "peak", "retireAt" }) end
	end
	toSquadPlayer = function(c)
		do return Js.ospread(Js.O({ id = (if Js.T(c.sofifaId) then ("sf_" .. c.sofifaId) else c.id), name = c.name, shortName = c.shortName, position = c.position, positions = c.positions, seasonGoals = c.seasonGoals, seasonAssists = c.seasonAssists, careerGoals = c.careerGoals, careerAssists = c.careerAssists, sofifaId = c.sofifaId, overall = c.overall, imageUrl = c.imageUrl, nationality = c.nationality, age = c.age }, { "id", "name", "shortName", "position", "positions", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "sofifaId", "overall", "imageUrl", "nationality", "age" }), (if (c.leagueGoals ~= nil) then Js.O({ leagueGoals = c.leagueGoals }, { "leagueGoals" }) else Js.O({}, nil)), (if (c.leagueAssists ~= nil) then Js.O({ leagueAssists = c.leagueAssists }, { "leagueAssists" }) else Js.O({}, nil)), (if c.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if c.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil)), (if (c.peak ~= nil) then Js.O({ peak = c.peak }, { "peak" }) else Js.O({}, nil)), (if (c.retireAt ~= nil) then Js.O({ retireAt = c.retireAt }, { "retireAt" }) else Js.O({}, nil))) end
	end
	toLeaguePlayer = function(c)
		do return Js.ospread(Js.O({ id = (if c.sofifaId ~= nil then c.sofifaId else c.id), name = c.name, position = c.position, positions = c.positions, overall = c.overall, goals = c.seasonGoals, assists = c.seasonAssists }, { "id", "name", "position", "positions", "overall", "goals", "assists" }), (if Js.T(c.imageUrl) then Js.O({ image = c.imageUrl }, { "image" }) else Js.O({}, nil)), (if Js.T(c.nationality) then Js.O({ nation = c.nationality }, { "nation" }) else Js.O({}, nil)), (if Js.T(c.age) then Js.O({ age = c.age }, { "age" }) else Js.O({}, nil)), (if c.highPotential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if c.worldClassPotential then Js.O({ worldClassPotential = true }, { "worldClassPotential" }) else Js.O({}, nil)), (if (c.peak ~= nil) then Js.O({ peak = c.peak }, { "peak" }) else Js.O({}, nil)), (if (c.retireAt ~= nil) then Js.O({ retireAt = c.retireAt }, { "retireAt" }) else Js.O({}, nil))) end
	end
	clubStrength = function(club, pool)
		local xi = A.slice(A.sort(Js.aspread(pool), function(a, b)
			return (b.overall - a.overall)
		end), 0, 11)
		if (not Js.T(Js.alen(xi))) then
			do return 65 end
		end
		do return Math.round((A.reduce(xi, function(s, p)
			return (s + p.overall)
		end, 0) / Js.alen(xi))) end
	end
	reachDown = function(buyerStrength)
		local t = clampUnit(((buyerStrength - 62) / 24))
		do return (6 + (t * 10)) end
	end
	clampUnit = function(x)
		do return Math.max(0, Math.min(1, x)) end
	end
	slotsFor = function(role, formation)
		do return Js.alen(A.filter(formation.slots, function(s)
			return (s.role == role)
		end)) end
	end
	positionNeed = function(role, club, pool, formation, squadSize)
		local slots = slotsFor(role, formation)
		if (slots == 0) then
			do return 0 end
		end
		local at = A.sort(A.filter(A.map(pool, function(p)
			return Js.O({ p = p, fit = M_formations.bestFitness(role, p) }, { "p", "fit" })
		end), function(x)
			return (x.fit >= 82)
		end), function(a, b)
			return (b.p.overall - a.p.overall)
		end)
		local depth = A.map(A.slice(at, 0, slots), function(x)
			return x.p.overall
		end)
		while (Js.alen(depth) < slots) do
			A.push(depth, 0)
		end
		local avgDepth = (A.reduce(depth, function(s, v)
			return (s + v)
		end, 0) / slots)
		local strength = clubStrength(club, pool)
		local gap = clampUnit(((strength - avgDepth) / 12))
		local multiplicity = (0.55 + (Math.min(slots, 3) * 0.22))
		local squadSizeFactor = (if (squadSize < SQUAD_TARGET) then (1 + ((SQUAD_TARGET - squadSize) * 0.15)) else (if (squadSize > 26) then clampUnit(((32 - squadSize) / 6)) else 1))
		local shortfall = Math.max(0, (SQUAD_TARGET - squadSize))
		local bodiesNeeded = ((shortfall * 0.045) * multiplicity)
		do return (((gap * multiplicity) * squadSizeFactor) + bodiesNeeded) end
	end
	sellability = function(c, isStarter, ownStrength, leagueTopStrength, window, rng, squadSize)
		if (squadSize <= MIN_SQUAD_SIZE) then
			do return nil end
		end
		local isEliteClub = (ownStrength >= (leagueTopStrength - 4))
		if ((squadSize <= SQUAD_TARGET) or (isStarter and isEliteClub)) then
			local unhappyOdds = (if (window == "summer") then M_tuningStore.getTuning("transfers.summerUnhappyOdds") else M_tuningStore.getTuning("transfers.januaryUnhappyOdds"))
			do return (if (rng() < unhappyOdds) then Js.O({ candidate = c, unhappy = true }, { "candidate", "unhappy" }) else nil) end
		end
		local baseOdds = (if isStarter then M_tuningStore.getTuning("transfers.starterListingOdds") else M_tuningStore.getTuning("transfers.benchListingOdds"))
		local odds = (if (window == "summer") then baseOdds else (baseOdds * 0.35))
		do return (if (rng() < odds) then Js.O({ candidate = c, unhappy = false }, { "candidate", "unhappy" }) else nil) end
	end
	loanOrSale = function(c, unhappy, rng)
		if unhappy then
			do return false end
		end
		local age = c.age
		local chance = (if (age == nil) then 0.45 else (if (age < 23) then 0.68 else (if (age < 29) then 0.3 else 0.12)))
		do return (rng() < chance) end
	end
	rivalrySellChance = function(sellerClub, buyerClub, unhappy)
		local tier = M_rivalries.strongestTier(sellerClub, buyerClub)
		local derby = M_rivalries.isDerby(sellerClub, buyerClub)
		if ((not Js.T(tier)) and (not derby)) then
			do return 1 end
		end
		local base = (if (tier == "R1") then 0.03 else (if (tier == "R2") then 0.15 else (if (tier == "R3") then 0.4 else 0.5)))
		do return (if unhappy then Math.min(1, (base * 3.2)) else base) end
	end
	exports.rivalrySellChance = rivalrySellChance
	feeFor = function(overall, highPotential, age, worldClassPotential)
		local m = Math.max(0, (overall - 60))
		local base = (M_tuningStore.getTuning("transfers.feeBase") + ((m * m) * M_tuningStore.getTuning("transfers.feeQuadratic")))
		local underFeeAgeCeiling = ((if age ~= nil then age else 0) < M_tuningStore.getTuning("wonderkids.feeAgeCeiling"))
		local premium = (if (not underFeeAgeCeiling) then 1 else (if (highPotential and worldClassPotential) then (M_tuningStore.getTuning("wonderkids.feeMultiplier") * M_tuningStore.getTuning("wonderkids.worldClassMultiplier")) else (if highPotential then M_tuningStore.getTuning("wonderkids.feeMultiplier") else 1)))
		do return (Math.round(((base * premium) * 10)) / 10) end
	end
	exports.feeFor = feeFor
	reachBonusFor = function(highPotential, worldClassPotential)
		if (not highPotential) then
			do return 0 end
		end
		local bonus = M_tuningStore.getTuning("wonderkids.bigClubReachBonus")
		do return (if worldClassPotential then (bonus * M_tuningStore.getTuning("wonderkids.worldClassMultiplier")) else bonus) end
	end
	windowBudget = function(window, clubCount)
		do return Math.round((clubCount * (if (window == "summer") then 1.5 else 0.35))) end
	end
	maxSigningsFor = function(startingSquadSize, window)
		local short = Math.max(0, (SQUAD_TARGET - startingSquadSize))
		if (window == "summer") then
			do return Math.min((3 + math.ceil((short / 2.5))), 6) end
		end
		do return Math.min((1 + math.ceil((short / 4))), 3) end
	end
	runTransferWindow = function(career, window, rng)
		if ((not Js.T(window)) or (not Js.T((function() local _v = career.leagueSquads; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return Js.O({ career = career, moves = Js.alit(), loans = Js.alit() }, { "career", "moves", "loans" }) end
		end
		local you = career.player.club
		local pools = Js.Map.new()
		pools:set(you, A.map(career.squad, function(p)
			return fromSquadPlayer(p, you)
		end))
		do
			local _arr1 = career.leagueSquads
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local sq = _arr1[_i2]
				if (sq.club == you) then
					do continue end
				end
				pools:set(sq.club, A.map(sq.players, function(p)
					return fromLeaguePlayer(p, sq.club)
				end))
			end
		end
		local clubs = Js.Array.from(pools:keys())
		local strengths = Js.Map.new(A.map(clubs, function(c)
			return Js.alit(c, clubStrength(c, pools:get(c)))
		end))
		local topStrength = Math.max(Js.unpack(Js.Array.from(strengths:values())))
		local onLoanElsewhere = Js.Set.new(A.map((if career.activeLoans ~= nil then career.activeLoans else Js.alit()), function(l)
			return l.playerId
		end))
		local freeAgentPool = A.map((if career.freeAgents ~= nil then career.freeAgents else Js.alit()), function(p)
			return fromLeaguePlayer(p, M_leagueSquads.FREE_AGENTS_CLUB)
		end)
		local listed = Js.alit()
		do
			local _arr3 = clubs
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local club = _arr3[_i4]
				local pool = pools:get(club)
				local formation = M_teamsheet.formationForClub(club)
				local xi = Js.Set.new(A.filter(M_formations.autoPick(pool, formation), function(id)
					return (not (not Js.T(id)))
				end))
				do
					local _arr5 = pool
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local c = _arr5[_i6]
						if onLoanElsewhere:has(stableKey(c)) then
							do continue end
						end
						local l = sellability(c, xi:has(c.id), strengths:get(club), topStrength, window, rng, Js.alen(pool))
						if l then
							A.push(listed, Js.ospread(l, Js.O({ loan = loanOrSale(l.candidate, l.unhappy, rng) }, { "loan" })))
						end
					end
				end
			end
		end
		local proposals = Js.alit()
		do
			local _arr7 = listed
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local seller = _e9.candidate
				local unhappy = _e9.unhappy
				local loan = _e9.loan
				local bestClub = nil
				local bestScore = (-math.huge)
				do
					local _arr10 = clubs
					local _i11 = 0
					while _i11 < Js.alen(_arr10) do
						_i11 += 1
						local club = _arr10[_i11]
						if (club == seller.club) then
							do continue end
						end
						if (rng() > rivalrySellChance(seller.club, club, unhappy)) then
							do continue end
						end
						local buyerStrength = strengths:get(club)
						local gap = (buyerStrength - seller.overall)
						local reach = (if loan then (reachDown(buyerStrength) * 1.4) else reachDown(buyerStrength))
						local reachUp = (REACH_UP + reachBonusFor(seller.highPotential, seller.worldClassPotential))
						if ((gap < (-reach)) or (gap > reachUp)) then
							do continue end
						end
						local pool = pools:get(club)
						local formation = M_teamsheet.formationForClub(club)
						local need = Math.max(Js.unpack(A.map(seller.positions, function(r)
							return positionNeed(r, club, pool, formation, Js.alen(pool))
						end)))
						if (need <= 0.12) then
							do continue end
						end
						local score = (((need * 10) - (math.abs(gap) * 0.15)) + (rng() * 0.6))
						if (score > bestScore) then
							bestScore = score
							bestClub = club
						end
					end
				end
				if (not Js.T(bestClub)) then
					do continue end
				end
				if loan then
					A.push(proposals, Js.O({ loan = true, loanMove = Js.O({ player = seller.name, playerId = stableKey(seller), parentClub = seller.club, loanClub = bestClub, overall = seller.overall, returnSeason = career.season, position = seller.positions[1], age = seller.age, imageUrl = seller.imageUrl }, { "player", "playerId", "parentClub", "loanClub", "overall", "returnSeason", "position", "age", "imageUrl" }), score = bestScore, from = seller.club, to = bestClub, playerId = seller.id }, { "loan", "loanMove", "score", "from", "to", "playerId" }))
				else
					A.push(proposals, Js.O({ loan = false, saleMove = Js.O({ player = seller.name, from = seller.club, to = bestClub, overall = seller.overall, fee = feeFor(seller.overall, seller.highPotential, seller.age, seller.worldClassPotential), unhappy = unhappy, position = seller.positions[1], age = seller.age, imageUrl = seller.imageUrl }, { "player", "from", "to", "overall", "fee", "unhappy", "position", "age", "imageUrl" }), score = bestScore, from = seller.club, to = bestClub, playerId = seller.id }, { "loan", "saleMove", "score", "from", "to", "playerId" }))
				end
			end
		end
		do
			local _arr12 = freeAgentPool
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local fa = _arr12[_i13]
				local bestClub = nil
				local bestScore = (-math.huge)
				do
					local _arr14 = clubs
					local _i15 = 0
					while _i15 < Js.alen(_arr14) do
						_i15 += 1
						local club = _arr14[_i15]
						local buyerStrength = strengths:get(club)
						local gap = (buyerStrength - fa.overall)
						local reach = (reachDown(buyerStrength) * FREE_AGENT_REACH_MULT)
						local reachUp = (REACH_UP + reachBonusFor(fa.highPotential, fa.worldClassPotential))
						if ((gap < (-reach)) or (gap > reachUp)) then
							do continue end
						end
						local pool = pools:get(club)
						local formation = M_teamsheet.formationForClub(club)
						local need = Math.max(Js.unpack(A.map(fa.positions, function(r)
							return positionNeed(r, club, pool, formation, Js.alen(pool))
						end)))
						if (need <= 0.12) then
							do continue end
						end
						local score = (((need * 10) - (math.abs(gap) * 0.15)) + (rng() * 0.6))
						if (score > bestScore) then
							bestScore = score
							bestClub = club
						end
					end
				end
				if (not Js.T(bestClub)) then
					do continue end
				end
				A.push(proposals, Js.O({ loan = false, saleMove = Js.O({ player = fa.name, from = M_leagueSquads.FREE_AGENTS_CLUB, to = bestClub, overall = fa.overall, fee = 0, unhappy = false, position = fa.positions[1], age = fa.age, imageUrl = fa.imageUrl }, { "player", "from", "to", "overall", "fee", "unhappy", "position", "age", "imageUrl" }), score = bestScore, from = M_leagueSquads.FREE_AGENTS_CLUB, to = bestClub, playerId = fa.id }, { "loan", "saleMove", "score", "from", "to", "playerId" }))
			end
		end
		A.sort(proposals, function(a, b)
			return (b.score - a.score)
		end)
		local freeAgentBudget = Math.min(Js.alen(freeAgentPool), (if (window == "summer") then 2 else 1))
		local budget = (windowBudget(window, Js.alen(clubs)) + freeAgentBudget)
		local signingCap = Js.Map.new(A.map(clubs, function(c)
			return Js.alit(c, maxSigningsFor(Js.alen(pools:get(c)), window))
		end))
		local signingsSoFar = Js.Map.new()
		local moves = Js.alit()
		local loans = Js.alit()
		local moved = Js.Set.new()
		local freeAgentsSoFar = 0
		do
			local _arr16 = proposals
			local _i17 = 0
			while _i17 < Js.alen(_arr16) do
				_i17 += 1
				local p = _arr16[_i17]
				if ((Js.alen(moves) + Js.alen(loans)) >= budget) then
					do break end
				end
				if moved:has(p.playerId) then
					do continue end
				end
				if ((p.from == M_leagueSquads.FREE_AGENTS_CLUB) and (freeAgentsSoFar >= freeAgentBudget)) then
					do continue end
				end
				local cap = signingCap:get(p.to)
				if ((cap ~= nil) and ((signingsSoFar:get(p.to) or 0) >= cap)) then
					do continue end
				end
				local fromPool = (if (p.from == M_leagueSquads.FREE_AGENTS_CLUB) then freeAgentPool else pools:get(p.from))
				local idx = A.findIndex(fromPool, function(c)
					return (c.id == p.playerId)
				end)
				if (idx < 0) then
					do continue end
				end
				local _d18 = A.splice(fromPool, idx, 1)
				local player = _d18[1]
				player.club = p.to
				A.push(pools:get(p.to), player)
				if (p.from ~= M_leagueSquads.FREE_AGENTS_CLUB) then
					strengths:set(p.from, clubStrength(p.from, fromPool))
				end
				strengths:set(p.to, clubStrength(p.to, pools:get(p.to)))
				moved:add(p.playerId)
				signingsSoFar:set(p.to, ((signingsSoFar:get(p.to) or 0) + 1))
				if (p.from == M_leagueSquads.FREE_AGENTS_CLUB) then
					freeAgentsSoFar += 1
				end
				if p.loan then
					A.push(loans, p.loanMove)
				else
					A.push(moves, p.saleMove)
				end
			end
		end
		if ((not Js.T(Js.alen(moves))) and (not Js.T(Js.alen(loans)))) then
			do return Js.O({ career = career, moves = Js.alit(), loans = Js.alit() }, { "career", "moves", "loans" }) end
		end
		local nextSquad = A.map(pools:get(you), toSquadPlayer)
		local nextLeagueSquads = A.map(career.leagueSquads, function(sq)
			return Js.O({ club = sq.club, players = A.map(pools:get(sq.club), toLeaguePlayer) }, { "club", "players" })
		end)
		local nextLeague = A.map(career.league, function(t)
			local s = strengths:get(t.name)
			do return (if (s == nil) then t else Js.ospread(t, Js.O({ strength = s }, { "strength" }))) end
		end)
		local nextFreeAgents = A.map(freeAgentPool, toLeaguePlayer)
		do return Js.O({ career = Js.ospread(career, Js.O({ squad = nextSquad, leagueSquads = nextLeagueSquads, league = nextLeague, activeLoans = (if Js.T(Js.alen(loans)) then Js.aspread((if career.activeLoans ~= nil then career.activeLoans else Js.alit()), loans) else career.activeLoans), freeAgents = nextFreeAgents }, { "squad", "leagueSquads", "league", "activeLoans", "freeAgents" })), moves = moves, loans = loans }, { "career", "moves", "loans" }) end
	end
	exports.runTransferWindow = runTransferWindow
	internationalDealCount = function(window, rng)
		local r = rng()
		if (window == "summer") then
			do return (if (r < 0.15) then 3 else (if (r < 0.55) then 2 else 1)) end
		end
		do return (if (r < 0.35) then 2 else 1) end
	end
	worldClubsFrom = function(squads)
		do return A.map(squads, function(sq)
			local pool = A.map(sq.players, function(p)
				return fromLeaguePlayer(p, sq.club)
			end)
			do return Js.O({ club = sq.club, pool = pool, strength = clubStrength(sq.club, pool) }, { "club", "pool", "strength" }) end
		end) end
	end
	internationalSellability = function(c, isStarter, window, rng, squadSize)
		if (squadSize <= MIN_SQUAD_SIZE) then
			do return nil end
		end
		local baseOdds = (if isStarter then M_tuningStore.getTuning("transfers.starterListingOdds") else M_tuningStore.getTuning("transfers.benchListingOdds"))
		local odds = (if (window == "summer") then baseOdds else (baseOdds * 0.35))
		do return (if (rng() < odds) then Js.O({ candidate = c, unhappy = false }, { "candidate", "unhappy" }) else nil) end
	end
	listedAcross = function(clubs, window, rng)
		local listed = Js.alit()
		do
			local _arr19 = clubs
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local _e21 = _arr19[_i20]
				local club = _e21.club
				local pool = _e21.pool
				local formation = M_teamsheet.formationForClub(club)
				local xi = Js.Set.new(A.filter(M_formations.autoPick(pool, formation), function(id)
					return (not (not Js.T(id)))
				end))
				do
					local _arr22 = pool
					local _i23 = 0
					while _i23 < Js.alen(_arr22) do
						_i23 += 1
						local c = _arr22[_i23]
						if (c.overall < INTERNATIONAL_STAR_THRESHOLD) then
							do continue end
						end
						local l = internationalSellability(c, xi:has(c.id), window, rng, Js.alen(pool))
						if l then
							A.push(listed, Js.ospread(l, Js.O({ loan = false }, { "loan" })))
						end
					end
				end
			end
		end
		do return listed end
	end
	bestBuyerAmong = function(seller, buyers, rng)
		local bestClub = nil
		local bestScore = (-math.huge)
		do
			local _arr24 = buyers
			local _i25 = 0
			while _i25 < Js.alen(_arr24) do
				_i25 += 1
				local _e26 = _arr24[_i25]
				local club = _e26.club
				local pool = _e26.pool
				local buyerStrength = _e26.strength
				if (club == seller.club) then
					do continue end
				end
				if (rng() > rivalrySellChance(seller.club, club, false)) then
					do continue end
				end
				local gap = (buyerStrength - seller.overall)
				local reachUp = (INTERNATIONAL_REACH_UP + reachBonusFor(seller.highPotential, seller.worldClassPotential))
				if ((gap < ((-(reachDown(buyerStrength))) * INTERNATIONAL_REACH_MULT)) or (gap > reachUp)) then
					do continue end
				end
				local formation = M_teamsheet.formationForClub(club)
				local need = Math.max(Js.unpack(A.map(seller.positions, function(r)
					return positionNeed(r, club, pool, formation, Js.alen(pool))
				end)))
				if (need <= 0.12) then
					do continue end
				end
				local score = (((need * 10) - (math.abs(gap) * 0.15)) + (rng() * 0.6))
				if (score > bestScore) then
					bestScore = score
					bestClub = club
				end
			end
		end
		do return bestClub end
	end
	runInternationalWindow = function(career, window, rng)
		if (((not Js.T(window)) or (not Js.T((function() local _v = career.externalSquads; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) or (not Js.T((function() local _v = career.leagueSquads; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()))) then
			do return Js.O({ career = career, moves = Js.alit() }, { "career", "moves" }) end
		end
		if (rng() >= INTERNATIONAL_WINDOW_CHANCE[window]) then
			do return Js.O({ career = career, moves = Js.alit() }, { "career", "moves" }) end
		end
		local deals = internationalDealCount(window, rng)
		local you = career.player.club
		local domesticPool = A.map(career.squad, function(p)
			return fromSquadPlayer(p, you)
		end)
		local domestic = Js.aspread(Js.alit(Js.O({ club = you, pool = domesticPool, strength = clubStrength(you, domesticPool) }, { "club", "pool", "strength" })), worldClubsFrom(A.filter(career.leagueSquads, function(sq)
			return (sq.club ~= you)
		end)))
		local external = worldClubsFrom(career.externalSquads)
		local moves = Js.alit()
		for i = 0, math.ceil(deals) - 1 do
			local incoming = (rng() < 0.6)
			local sellSide = (if incoming then external else domestic)
			local buySide = (if incoming then domestic else external)
			local candidates = listedAcross(sellSide, window, rng)
			if (not Js.T(Js.alen(candidates))) then
				do continue end
			end
			local chosen = nil
			local chosenScore = (-math.huge)
			do
				local _arr27 = candidates
				local _i28 = 0
				while _i28 < Js.alen(_arr27) do
					_i28 += 1
					local _e29 = _arr27[_i28]
					local seller = _e29.candidate
					local sellerClub = A.find(sellSide, function(c)
						return (c.club == seller.club)
					end)
					local buyerClub = bestBuyerAmong(seller, buySide, rng)
					if (not Js.T(buyerClub)) then
						do continue end
					end
					local buyer = A.find(buySide, function(c)
						return (c.club == buyerClub)
					end)
					local score = ((seller.overall + (buyer.strength * 0.2)) + (rng() * 4))
					if (score > chosenScore) then
						chosenScore = score
						chosen = Js.O({ seller = seller, sellerClub = sellerClub, buyerClub = buyerClub }, { "seller", "sellerClub", "buyerClub" })
					end
				end
			end
			if (not chosen) then
				do continue end
			end
			local _d30 = chosen
			local seller = _d30.seller
			local sellerClub = _d30.sellerClub
			local buyerClub = _d30.buyerClub
			local idx = A.findIndex(sellerClub.pool, function(p)
				return (p.id == seller.id)
			end)
			if (idx < 0) then
				do continue end
			end
			local _d31 = A.splice(sellerClub.pool, idx, 1)
			local player = _d31[1]
			player.club = buyerClub
			local buyer = A.find(buySide, function(c)
				return (c.club == buyerClub)
			end)
			A.push(buyer.pool, player)
			sellerClub.strength = clubStrength(sellerClub.club, sellerClub.pool)
			buyer.strength = clubStrength(buyer.club, buyer.pool)
			A.push(moves, Js.O({ player = player.name, from = sellerClub.club, to = buyerClub, overall = player.overall, fee = feeFor(player.overall, player.highPotential, player.age, player.worldClassPotential), unhappy = false, position = player.positions[1], age = player.age, imageUrl = player.imageUrl }, { "player", "from", "to", "overall", "fee", "unhappy", "position", "age", "imageUrl" }))
		end
		if (not Js.T(Js.alen(moves))) then
			do return Js.O({ career = career, moves = Js.alit() }, { "career", "moves" }) end
		end
		local nextSquad = A.map(A.find(domestic, function(c)
			return (c.club == you)
		end).pool, toSquadPlayer)
		local nextLeagueSquads = A.map(career.leagueSquads, function(sq)
			local c = A.find(domestic, function(d)
				return (d.club == sq.club)
			end)
			do return (if c then Js.O({ club = sq.club, players = A.map(c.pool, toLeaguePlayer) }, { "club", "players" }) else sq) end
		end)
		local domesticStrengthByClub = Js.Map.new(A.map(domestic, function(c)
			return Js.alit(c.club, c.strength)
		end))
		local nextLeague = A.map(career.league, function(t)
			local s = domesticStrengthByClub:get(t.name)
			do return (if (s == nil) then t else Js.ospread(t, Js.O({ strength = s }, { "strength" }))) end
		end)
		local nextExternalSquads = A.map(career.externalSquads, function(sq)
			local c = A.find(external, function(e)
				return (e.club == sq.club)
			end)
			do return (if c then Js.O({ club = sq.club, players = A.map(c.pool, toLeaguePlayer) }, { "club", "players" }) else sq) end
		end)
		do return Js.O({ career = Js.ospread(career, Js.O({ squad = nextSquad, leagueSquads = nextLeagueSquads, league = nextLeague, externalSquads = nextExternalSquads }, { "squad", "leagueSquads", "league", "externalSquads" })), moves = moves }, { "career", "moves" }) end
	end
	exports.runInternationalWindow = runInternationalWindow
	returnLoansHome = function(career)
		local active = (if career.activeLoans ~= nil then career.activeLoans else Js.alit())
		local due = A.filter(active, function(l)
			return (l.returnSeason <= career.season)
		end)
		if (not Js.T(Js.alen(due))) then
			do return career end
		end
		local remaining = A.filter(active, function(l)
			return (l.returnSeason > career.season)
		end)
		local you = career.player.club
		local pools = Js.Map.new()
		pools:set(you, A.map(career.squad, function(p)
			return fromSquadPlayer(p, you)
		end))
		do
			local _arr32 = (if career.leagueSquads ~= nil then career.leagueSquads else Js.alit())
			local _i33 = 0
			while _i33 < Js.alen(_arr32) do
				_i33 += 1
				local sq = _arr32[_i33]
				if (sq.club == you) then
					do continue end
				end
				pools:set(sq.club, A.map(sq.players, function(p)
					return fromLeaguePlayer(p, sq.club)
				end))
			end
		end
		do
			local _arr34 = due
			local _i35 = 0
			while _i35 < Js.alen(_arr34) do
				_i35 += 1
				local loan = _arr34[_i35]
				local fromPool = pools:get(loan.loanClub)
				local toPool = pools:get(loan.parentClub)
				if ((not fromPool) or (not toPool)) then
					do continue end
				end
				local idx = A.findIndex(fromPool, function(c)
					return (stableKey(c) == loan.playerId)
				end)
				if (idx < 0) then
					do continue end
				end
				local _d36 = A.splice(fromPool, idx, 1)
				local player = _d36[1]
				player.club = loan.parentClub
				A.push(toPool, player)
			end
		end
		local nextSquad = ((function() local _r = pools:get(you); if _r == nil then return nil end; return A.map(_r, toSquadPlayer) end)() or career.squad)
		local nextLeagueSquads = A.map((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), function(sq)
			return Js.O({ club = sq.club, players = A.map((pools:get(sq.club) or A.map(sq.players, function(p)
				return fromLeaguePlayer(p, sq.club)
			end)), toLeaguePlayer) }, { "club", "players" })
		end)
		do return Js.ospread(career, Js.O({ squad = nextSquad, leagueSquads = nextLeagueSquads, activeLoans = remaining }, { "squad", "leagueSquads", "activeLoans" })) end
	end
	exports.returnLoansHome = returnLoansHome
	ROLES = Js.alit("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST")
	REACH_UP = M_tuningStore.getTuning("transfers.reachUp")
	FREE_AGENT_REACH_MULT = 2
	SQUAD_TARGET = M_tuningStore.getTuning("transfers.squadTarget")
	MIN_SQUAD_SIZE = M_tuningStore.getTuning("transfers.minSquadSize")
	INTERNATIONAL_STAR_THRESHOLD = 74
	INTERNATIONAL_WINDOW_CHANCE = Js.O({ summer = 0.9, january = 0.55 }, { "summer", "january" })
	INTERNATIONAL_REACH_MULT = 1.8
	INTERNATIONAL_REACH_UP = 9
end
