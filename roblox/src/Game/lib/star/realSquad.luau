--!nocheck
--!nolint
-- Generated from lib/star/realSquad.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_squadData = import("lib/star/squadData")
	local M_edition = import("lib/star/edition")
	local SLOTS, positionsOf, NEIGHBOURS, VALID_ROLES, rolesOf, fit, shortNameOf, buildSquadFromRoster, shouldUpgradeSquad, squadAfterFetch, fetchRealSquad, refreshSquadPhotos, mergeSquadStats
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
	fit = function(slot, player)
		local ps = positionsOf(player.positions)
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
		do return 12 end
	end
	shortNameOf = function(full)
		local parts = S.split(S.trim(full), Js.re("\\s+", ""))
		if (Js.alen(parts) == 1) then
			do return parts[1] end
		end
		if Js.re("^[A-Z]\\.?$", ""):test(parts[1]) then
			do return A.join(A.slice(parts, 1), " ") end
		end
		do return parts[Js.alen(parts)] end
	end
	exports.shortNameOf = shortNameOf
	buildSquadFromRoster = function(roster, club)
		if (not Js.T(Js.alen(roster))) then
			do return M_squadData.generateSquad(M_squadData.clubNameSeed(club)) end
		end
		local pool = A.sort(Js.aspread(roster), function(a, b)
			return ((if Js.T(b.overall) then b.overall else 0) - (if Js.T(a.overall) then a.overall else 0))
		end)
		local taken = Js.Set.new()
		local out = Js.alit()
		do
			local _arr3 = SLOTS
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local slot = _arr3[_i4]
				local best = nil
				local bestScore = -1
				local bestFit = 0
				do
					local _arr5 = pool
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local p = _arr5[_i6]
						if taken:has(p.sofifa_id) then
							do continue end
						end
						local f = fit(slot, p)
						if (f <= 0) then
							do continue end
						end
						local score = ((f * 100) + (if Js.T(p.overall) then p.overall else 0))
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
				taken:add(best.sofifa_id)
				A.push(out, Js.ospread(Js.O({ id = ("sf_" .. best.sofifa_id), name = best.name, shortName = shortNameOf(best.name), position = (if (bestFit > 12) then slot else (rolesOf(best.positions)[1] or slot)), seasonGoals = 0, seasonAssists = 0, careerGoals = 0, careerAssists = 0, sofifaId = best.sofifa_id, overall = (if Js.T(best.overall) then best.overall else nil), imageUrl = (if Js.T(best.image_url) then best.image_url else nil), nationality = (if Js.T(best.nationality) then best.nationality else nil), age = (if Js.T(best.age) then best.age else nil), positions = rolesOf(best.positions) }, { "id", "name", "shortName", "position", "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "sofifaId", "overall", "imageUrl", "nationality", "age", "positions" }), (if best.high_potential then Js.O({ highPotential = true }, { "highPotential" }) else Js.O({}, nil)), (if Js.T(best.pace) then Js.O({ pace = best.pace }, { "pace" }) else Js.O({}, nil)), (if Js.T(best.shooting) then Js.O({ shooting = best.shooting }, { "shooting" }) else Js.O({}, nil)), (if Js.T(best.passing) then Js.O({ passing = best.passing }, { "passing" }) else Js.O({}, nil)), (if Js.T(best.dribbling) then Js.O({ dribbling = best.dribbling }, { "dribbling" }) else Js.O({}, nil)), (if Js.T(best.defending) then Js.O({ defending = best.defending }, { "defending" }) else Js.O({}, nil)), (if Js.T(best.physical) then Js.O({ physical = best.physical }, { "physical" }) else Js.O({}, nil))))
			end
		end
		do return out end
	end
	exports.buildSquadFromRoster = buildSquadFromRoster
	shouldUpgradeSquad = function(squad)
		do return (not A.some(squad, function(p)
			return p.sofifaId
		end)) end
	end
	exports.shouldUpgradeSquad = shouldUpgradeSquad
	squadAfterFetch = function(current, fetched)
		if (not A.some(fetched, function(p)
			return p.sofifaId
		end)) then
			do return nil end
		end
		do return mergeSquadStats(fetched, current) end
	end
	exports.squadAfterFetch = squadAfterFetch
	fetchRealSquad = function(club, year)
		if year == nil then year = M_edition.STAR_FIFA_YEAR end
		local _ok7, _err8, _rv9 = pcall(function()
			local res = Js.await(Js.fetch(("/api/draft/roster?club=" .. Js.encodeURIComponent(club) .. "&year=" .. Js.numstr(year)), M_edition.SQUAD_FETCH_INIT))
			if (not res.ok) then
				do return Js.RET, M_squadData.generateSquad(M_squadData.clubNameSeed(club)) end
			end
			local data = Js.await(res.json())
			do return Js.RET, buildSquadFromRoster((if data.roster ~= nil then data.roster else Js.alit()), club) end
		end)
		if not _ok7 then
			do return M_squadData.generateSquad(M_squadData.clubNameSeed(club)) end
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	exports.fetchRealSquad = fetchRealSquad
	refreshSquadPhotos = function(fresh, current)
		local photo = Js.Map.new()
		do
			local _arr10 = fresh
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local p = _arr10[_i11]
				if Js.T(p.imageUrl) then
					photo:set((if p.sofifaId ~= nil then p.sofifaId else p.id), p.imageUrl)
				end
			end
		end
		if (not Js.T(Js.alen(current))) then
			do return fresh end
		end
		do return A.map(current, function(p)
			local img = photo:get((if p.sofifaId ~= nil then p.sofifaId else p.id))
			do return (if (Js.T(img) and (img ~= p.imageUrl)) then Js.ospread(p, Js.O({ imageUrl = img }, { "imageUrl" })) else p) end
		end) end
	end
	exports.refreshSquadPhotos = refreshSquadPhotos
	mergeSquadStats = function(fresh, previous)
		local before = Js.Map.new(A.map(previous, function(p)
			return Js.alit((if p.sofifaId ~= nil then p.sofifaId else p.id), p)
		end))
		do return A.map(fresh, function(p)
			local was = before:get((if p.sofifaId ~= nil then p.sofifaId else p.id))
			if (not was) then
				do return p end
			end
			do return Js.ospread(p, Js.O({ seasonGoals = was.seasonGoals, seasonAssists = was.seasonAssists, careerGoals = was.careerGoals, careerAssists = was.careerAssists, leagueGoals = was.leagueGoals, leagueAssists = was.leagueAssists }, { "seasonGoals", "seasonAssists", "careerGoals", "careerAssists", "leagueGoals", "leagueAssists" })) end
		end) end
	end
	exports.mergeSquadStats = mergeSquadStats
	SLOTS = Js.alit("GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM", "ST", "GK", "CB", "CDM", "CM", "RW", "LW", "CAM", "ST")
	NEIGHBOURS = Js.O({ GK = Js.alit(), CB = Js.alit("RB", "LB", "CDM"), RB = Js.alit("RM", "RWB", "CB", "RW"), LB = Js.alit("LM", "LWB", "CB", "LW"), CDM = Js.alit("CM", "CB"), CM = Js.alit("CDM", "CAM", "LM", "RM"), CAM = Js.alit("CM", "LW", "RW", "ST", "LM", "RM"), RW = Js.alit("RM", "LW", "ST", "CAM"), LW = Js.alit("LM", "RW", "ST", "CAM"), ST = Js.alit("CF", "LW", "RW", "CAM") }, { "GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST" })
	VALID_ROLES = Js.Set.new(Js.alit("GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"))
end
