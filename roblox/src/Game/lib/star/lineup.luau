--!nocheck
--!nolint
-- Generated from lib/star/lineup.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local idOf, ROLE_POSITIONS, positionsForSpot, claim, castScenario, DEFENSIVE_POSITIONS, orderDefensively, castDefence, NEVER_ASSISTED, CREATOR_WEIGHT, creatorOf
	positionsForSpot = function(sc, y, wide)
		if (M_canvasEngine.goalInView(sc.kind) and (y < 20)) then
			do return (if wide then Js.alit("LW", "RW", "ST", "CAM") else Js.alit("ST", "CAM", "LW", "RW")) end
		end
		if (y < 34) then
			do return (if wide then Js.alit("LW", "RW", "CAM", "CM") else Js.alit("CAM", "CM", "ST", "LW")) end
		end
		if (y < 46) then
			do return (if wide then Js.alit("LB", "RB", "CM", "LW") else Js.alit("CM", "CDM", "CAM")) end
		end
		do return (if wide then Js.alit("LB", "RB", "CB") else Js.alit("CDM", "CB", "CM")) end
	end
	claim = function(pool, taken, prefer)
		do
			local _arr1 = prefer
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local want = _arr1[_i2]
				local best = nil
				do
					local _arr3 = pool
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local p = _arr3[_i4]
						if (taken:has(p.id) or (p.position ~= want)) then
							do continue end
						end
						if ((not best) or ((if p.overall ~= nil then p.overall else 0) > (if best.overall ~= nil then best.overall else 0))) then
							best = p
						end
					end
				end
				if best then
					taken:add(best.id)
					do return idOf(best) end
				end
			end
		end
		local wantDefensive = ((Js.alen(prefer) > 0) and DEFENSIVE_POSITIONS:has(prefer[1]))
		do
			local _arr5 = Js.alit(true, false)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local stayInCategory = _arr5[_i6]
				local any = nil
				do
					local _arr7 = pool
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local p = _arr7[_i8]
						if (taken:has(p.id) or (p.position == "GK")) then
							do continue end
						end
						if (stayInCategory and (DEFENSIVE_POSITIONS:has(p.position) ~= wantDefensive)) then
							do continue end
						end
						if ((not any) or ((if p.overall ~= nil then p.overall else 0) > (if any.overall ~= nil then any.overall else 0))) then
							any = p
						end
					end
				end
				if any then
					taken:add(any.id)
					do return idOf(any) end
				end
			end
		end
		do return nil end
	end
	castScenario = function(sc, squad)
		local pool = A.filter(squad, function(p)
			return (p.position ~= "GK")
		end)
		if (Js.alen(pool) == 0) then
			do return end
		end
		local taken = Js.Set.new()
		local order = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), A.filter(sc.secondaryRunners, function(r)
			return (r.role == "target")
		end), A.filter(sc.secondaryRunners, function(r)
			return (r.role ~= "target")
		end))
		do
			local _arr9 = order
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local r = _arr9[_i10]
				local wide = (math.abs((r.pos.x - 34)) > 13)
				r.who = claim(pool, taken, positionsForSpot(sc, r.pos.y, wide))
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			sc.follower.who = claim(pool, taken, Js.alit("ST", "CAM", "LW", "RW"))
		end
		if (Js.alen(sc.teammates) > 0) then
			local t0 = sc.teammates[1]
			local wide0 = (math.abs((t0.x - 34)) > 13)
			sc.crosser = claim(pool, taken, (if wide0 then Js.alit("LW", "RW", "LB", "RB") else Js.alit("CAM", "CM", "LW", "RW")))
			t0.who = sc.crosser
			do
				local i = 1
				local _first11 = true
				while true do
					if not _first11 then
						i += 1
					end
					_first11 = false
					if not (i < Js.alen(sc.teammates)) then break end
					local t = sc.teammates[i + 1]
					local wide = (math.abs((t.x - 34)) > 13)
					t.who = claim(pool, taken, positionsForSpot(sc, t.y, wide))
				end
			end
		end
		if (sc.receiver and (not sc.receiver.who)) then
			local prefer = ROLE_POSITIONS[sc.receiver.roleLabel]
			local already = (function() local _v = A.find(order, function(r)
				return r.who
			end); if _v == nil then return nil end; _v = _v.who; return _v end)()
			sc.receiver.who = (if prefer then claim(pool, Js.Set.new(taken), prefer) else already)
		end
	end
	exports.castScenario = castScenario
	orderDefensively = function(outfield)
		local byDepth = function(a, b)
			return (b.y - a.y)
		end
		local real = A.sort(A.filter(outfield, function(p)
			return DEFENSIVE_POSITIONS:has(p.position)
		end), byDepth)
		local rest = A.sort(A.filter(outfield, function(p)
			return (not DEFENSIVE_POSITIONS:has(p.position))
		end), byDepth)
		do return Js.aspread(real, rest) end
	end
	exports.orderDefensively = orderDefensively
	castDefence = function(sc, oppXI)
		if ((not oppXI) or (Js.alen(oppXI) == 0)) then
			do return end
		end
		local toIdentity = function(p)
			return Js.O({ id = p.id, name = p.name, shortName = p.shortName, position = p.position, overall = p.overall, face = p.face, pace = p.pace, shooting = p.shooting, passing = p.passing, dribbling = p.dribbling, defending = p.defending, physical = p.physical }, { "id", "name", "shortName", "position", "overall", "face", "pace", "shooting", "passing", "dribbling", "defending", "physical" })
		end
		local gk = A.find(oppXI, function(p)
			return p.isGK
		end)
		if gk then
			sc.keeper.who = toIdentity(gk)
		end
		if (Js.alen(sc.defenders) == 0) then
			do return end
		end
		local pool = orderDefensively(A.filter(oppXI, function(p)
			return (not p.isGK)
		end))
		if (Js.alen(pool) == 0) then
			do return end
		end
		local defenders = A.sort(Js.aspread(sc.defenders), function(a, b)
			return (a.y - b.y)
		end)
		A.forEach(defenders, function(d, i)
			d.who = toIdentity(pool[math.fmod(i, Js.alen(pool)) + 1])
		end)
	end
	exports.castDefence = castDefence
	creatorOf = function(sc, squad, rng)
		if squad == nil then squad = Js.alit() end
		if A.includes(NEVER_ASSISTED, sc.kind) then
			do return nil end
		end
		if sc.crosser then
			do return sc.crosser end
		end
		local onPitch = A.filter(A.map(Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners), function(r)
			return r.who
		end), function(w)
			return (not (not w))
		end)
		if (Js.alen(onPitch) > 0) then
			local i = (if rng then math.floor((rng() * Js.alen(onPitch))) else 0)
			do return onPitch[Math.min(i, (Js.alen(onPitch) - 1)) + 1] end
		end
		local pool = A.filter(squad, function(p)
			return (p.position ~= "GK")
		end)
		if (Js.alen(pool) == 0) then
			do return nil end
		end
		local total = 0
		local w = A.map(pool, function(p)
			local x = (if CREATOR_WEIGHT[p.position] ~= nil then CREATOR_WEIGHT[p.position] else 5)
			total += x
			do return x end
		end)
		local r = ((if rng then rng() else 0.5) * total)
		do
			local i = 0
			local _first12 = true
			while true do
				if not _first12 then
					i += 1
				end
				_first12 = false
				if not (i < Js.alen(pool)) then break end
				r -= w[i + 1]
				if (r <= 0) then
					do return idOf(pool[i + 1]) end
				end
			end
		end
		local last = pool[Js.alen(pool)]
		do return idOf(last) end
	end
	exports.creatorOf = creatorOf
	idOf = function(p)
		return Js.O({ id = p.id, name = p.name, shortName = p.shortName, position = p.position, overall = p.overall, face = (if p.imageUrl ~= nil then p.imageUrl else M_fakeFaces.fakeFaceFor(p.id)), pace = p.pace, shooting = p.shooting, passing = p.passing, dribbling = p.dribbling, defending = p.defending, physical = p.physical }, { "id", "name", "shortName", "position", "overall", "face", "pace", "shooting", "passing", "dribbling", "defending", "physical" })
	end
	ROLE_POSITIONS = Js.O({ ["the striker"] = Js.alit("ST", "CAM", "LW", "RW"), ["the attacking midfielder"] = Js.alit("CAM", "CM", "LW", "RW", "ST"), ["the winger"] = Js.alit("LW", "RW", "CAM", "ST"), ["the center-back"] = Js.alit("CB", "CDM", "LB", "RB"), ["the far-post runner"] = Js.alit("ST", "LW", "RW", "CB"), ["the midfielder arriving"] = Js.alit("CM", "CAM", "CDM") }, { "the striker", "the attacking midfielder", "the winger", "the center-back", "the far-post runner", "the midfielder arriving" })
	DEFENSIVE_POSITIONS = Js.Set.new(Js.alit("CB", "LB", "RB", "CDM"))
	NEVER_ASSISTED = Js.alit("penalty", "free_kick")
	CREATOR_WEIGHT = Js.O({ LW = 18, RW = 18, CAM = 16, CM = 12, ST = 9, LB = 7, RB = 7, CDM = 4, CB = 2, GK = 0.2 }, { "LW", "RW", "CAM", "CM", "ST", "LB", "RB", "CDM", "CB", "GK" })
end
