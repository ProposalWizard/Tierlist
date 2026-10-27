--!nocheck
--!nolint
-- Generated from lib/star/retirementNews.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_worldAgeing = import("lib/star/worldAgeing")
	local FAMOUS_MIN_OVERALL, DIVISION_LEGEND_MIN, MAX_FAMOUS, MAX_REGENS, notableRetirements, promisingRegens
	notableRetirements = function(retired, before, ownClub)
		local leagueById = Js.Map.new()
		do
			local _arr1 = Js.aspread((if before.externalSquads ~= nil then before.externalSquads else Js.alit()), (if before.leagueSquads ~= nil then before.leagueSquads else Js.alit()))
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local s = _arr1[_i2]
				do
					local _arr3 = s.players
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local p = _arr3[_i4]
						leagueById:set((s.club .. "|" .. p.id), Js.O({ overall = p.overall, goals = p.goals, assists = p.assists }, { "overall", "goals", "assists" }))
					end
				end
			end
		end
		local divisionClubs = Js.Set.new(A.map((if before.leagueSquads ~= nil then before.leagueSquads else Js.alit()), function(s)
			return s.club
		end))
		local squadById = Js.Map.new(A.map((if before.squad ~= nil then before.squad else Js.alit()), function(p)
			return Js.alit(p.id, p)
		end))
		local own = Js.alit()
		local others = Js.alit()
		local seen = Js.Set.new()
		do
			local _arr5 = retired
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local r = _arr5[_i6]
				if ((r.club == ownClub) and squadById:has(r.id)) then
					local p = squadById:get(r.id)
					if seen:has(("own|" .. p.name)) then
						do continue end
					end
					seen:add(("own|" .. p.name))
					A.push(own, Js.ospread(Js.O({ id = r.id, name = r.name, club = r.club, age = r.age, position = r.position, own = true }, { "id", "name", "club", "age", "position", "own" }), (if (type(p.overall) == "number") then Js.O({ overall = p.overall }, { "overall" }) else Js.O({}, nil)), (if (p.careerGoals > 0) then Js.O({ goalsWithUs = p.careerGoals }, { "goalsWithUs" }) else Js.O({}, nil)), (if (p.careerAssists > 0) then Js.O({ assistsWithUs = p.careerAssists }, { "assistsWithUs" }) else Js.O({}, nil))))
					do continue end
				end
				if (r.club == ownClub) then
					do continue end
				end
				if (M_worldAgeing.isRegenId(r.id) or S.startsWith(r.id, "sp_")) then
					do continue end
				end
				local l = leagueById:get((r.club .. "|" .. r.id))
				if (not l) then
					do continue end
				end
				A.push(others, Js.ospread(Js.O({ id = r.id, name = r.name, club = r.club, age = r.age, position = r.position, own = false, overall = l.overall }, { "id", "name", "club", "age", "position", "own", "overall" }), (if (l.goals > 0) then Js.O({ seasonGoals = l.goals }, { "seasonGoals" }) else Js.O({}, nil)), (if (l.assists > 0) then Js.O({ seasonAssists = l.assists }, { "seasonAssists" }) else Js.O({}, nil)), Js.O({ inDivision = divisionClubs:has(r.club) }, { "inDivision" })))
			end
		end
		A.sort(others, function(a, b)
			return (function() local _l = ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0)); if Js.T(_l) then return _l end; return S.localeCompare(a.name, b.name) end)()
		end)
		local famous = A.slice(A.filter(others, function(o)
			return ((if o.overall ~= nil then o.overall else 0) >= FAMOUS_MIN_OVERALL)
		end), 0, MAX_FAMOUS)
		local legend = A.find(others, function(o)
			return (o.inDivision and ((if o.overall ~= nil then o.overall else 0) >= DIVISION_LEGEND_MIN))
		end)
		if (legend and (not A.includes(famous, legend))) then
			if (Js.alen(famous) >= MAX_FAMOUS) then
				A.set(famous, (MAX_FAMOUS - 1), legend)
			else
				A.push(famous, legend)
			end
		end
		do return Js.aspread(own, A.map(famous, function(_p7)
			local _d = _p7.inDivision
			local n = Js.ospread(_p7)
			Js.del(n, "inDivision")
			return n
		end)) end
	end
	exports.notableRetirements = notableRetirements
	promisingRegens = function(after, ownClub, season)
		local prefix = ("rg" .. Js.numstr(season) .. ".")
		local out = Js.alit()
		local seen = Js.Set.new()
		do
			local _arr8 = (if after.squad ~= nil then after.squad else Js.alit())
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local p = _arr8[_i9]
				if (((not S.startsWith(p.id, prefix)) or (not p.highPotential)) or (type(p.age) ~= "number")) then
					do continue end
				end
				seen:add(p.id)
				A.push(out, Js.ospread(Js.O({ id = p.id, name = p.name, club = ownClub, age = p.age, position = p.position }, { "id", "name", "club", "age", "position" }), (if (type(p.overall) == "number") then Js.O({ overall = p.overall }, { "overall" }) else Js.O({}, nil)), Js.O({ worldClass = (not (not p.worldClassPotential)), own = true }, { "worldClass", "own" })))
			end
		end
		do
			local _arr10 = Js.aspread((if after.leagueSquads ~= nil then after.leagueSquads else Js.alit()), (if after.externalSquads ~= nil then after.externalSquads else Js.alit()))
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local s = _arr10[_i11]
				do
					local _arr12 = s.players
					local _i13 = 0
					while _i13 < Js.alen(_arr12) do
						_i13 += 1
						local p = _arr12[_i13]
						if ((((not S.startsWith(p.id, prefix)) or (not p.highPotential)) or (type(p.age) ~= "number")) or seen:has(p.id)) then
							do continue end
						end
						seen:add(p.id)
						A.push(out, Js.O({ id = p.id, name = p.name, club = s.club, age = p.age, position = p.position, overall = p.overall, worldClass = (not (not p.worldClassPotential)), own = (s.club == ownClub) }, { "id", "name", "club", "age", "position", "overall", "worldClass", "own" }))
					end
				end
			end
		end
		A.sort(out, function(a, b)
			return (function() local _l = (function() local _l = (function() local _l = (Js.Number(b.own) - Js.Number(a.own)); if Js.T(_l) then return _l end; return (Js.Number(b.worldClass) - Js.Number(a.worldClass)) end)(); if Js.T(_l) then return _l end; return ((if b.overall ~= nil then b.overall else 0) - (if a.overall ~= nil then a.overall else 0)) end)(); if Js.T(_l) then return _l end; return S.localeCompare(a.name, b.name) end)()
		end)
		do return A.slice(out, 0, MAX_REGENS) end
	end
	exports.promisingRegens = promisingRegens
	FAMOUS_MIN_OVERALL = 76
	exports.FAMOUS_MIN_OVERALL = FAMOUS_MIN_OVERALL
	DIVISION_LEGEND_MIN = 66
	exports.DIVISION_LEGEND_MIN = DIVISION_LEGEND_MIN
	MAX_FAMOUS = 3
	exports.MAX_FAMOUS = MAX_FAMOUS
	MAX_REGENS = 3
	exports.MAX_REGENS = MAX_REGENS
end
