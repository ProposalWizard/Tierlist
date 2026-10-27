--!nocheck
--!nolint
-- Generated from lib/star/formations.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GK, DEF4, DEF, WB, HOLD, MID, ATT, FWD, WB_ADV, gk, back4, back3, back5, f, FORMATIONS, DEFAULT_FORMATION, formationOf, NEIGHBOURS, fitness, bestFitness, autoPick, refit
	formationOf = function(id)
		do return (A.find(FORMATIONS, function(x)
			return (x.id == id)
		end) or A.find(FORMATIONS, function(x)
			return (x.id == DEFAULT_FORMATION)
		end)) end
	end
	exports.formationOf = formationOf
	fitness = function(slot, player)
		if ((slot == "GK") or (player == "GK")) then
			do return (if (slot == player) then 100 else 0) end
		end
		if (slot == player) then
			do return 100 end
		end
		local near = (if NEIGHBOURS[slot] ~= nil then NEIGHBOURS[slot] else Js.alit())
		local i = A.indexOf(near, player)
		do return (if (i >= 0) then (74 - (i * 8)) else 22) end
	end
	exports.fitness = fitness
	bestFitness = function(slot, player)
		local positions = (if Js.T((function() local _v = player.positions; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then player.positions else Js.alit(player.position))
		local best = 0
		do
			local _arr1 = positions
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local p = _arr1[_i2]
				local f = fitness(slot, p)
				if (f > best) then
					best = f
				end
			end
		end
		do return best end
	end
	exports.bestFitness = bestFitness
	autoPick = function(squad, formation)
		local taken = Js.Set.new()
		do return A.map(formation.slots, function(slot)
			local best = nil
			local bestScore = -1
			do
				local _arr3 = squad
				local _i4 = 0
				while _i4 < Js.alen(_arr3) do
					_i4 += 1
					local p = _arr3[_i4]
					if taken:has(p.id) then
						do continue end
					end
					local f2 = bestFitness(slot.role, p)
					if (f2 <= 0) then
						do continue end
					end
					local score = ((f2 * 100) + (if p.overall ~= nil then p.overall else 60))
					if (score > bestScore) then
						bestScore = score
						best = p
					end
				end
			end
			if (not best) then
				do return nil end
			end
			taken:add(best.id)
			do return best.id end
		end) end
	end
	exports.autoPick = autoPick
	refit = function(current, squad, formation)
		local byId = Js.Map.new(A.map(squad, function(p)
			return Js.alit(p.id, p)
		end))
		local chosen = A.filter(current, function(id)
			return ((not (not Js.T(id))) and byId:has(id))
		end)
		local pool = A.map(chosen, function(id)
			return byId:get(id)
		end)
		local out = autoPick(pool, formation)
		local used = Js.Set.new(A.filter(out, function(x)
			return (not (not Js.T(x)))
		end))
		local rest = A.filter(squad, function(p)
			return (not used:has(p.id))
		end)
		do return A.map(out, function(id, i)
			if Js.T(id) then
				do return id end
			end
			local slot = formation.slots[i + 1]
			local best = nil
			local bestScore = -1
			do
				local _arr5 = rest
				local _i6 = 0
				while _i6 < Js.alen(_arr5) do
					_i6 += 1
					local p = _arr5[_i6]
					if used:has(p.id) then
						do continue end
					end
					local f2 = bestFitness(slot.role, p)
					if (f2 <= 0) then
						do continue end
					end
					local score = ((f2 * 100) + (if p.overall ~= nil then p.overall else 60))
					if (score > bestScore) then
						bestScore = score
						best = p
					end
				end
			end
			if (not best) then
				do return nil end
			end
			used:add(best.id)
			do return best.id end
		end) end
	end
	exports.refit = refit
	GK = 0.94
	DEF4 = 0.8
	DEF = 0.75
	WB = 0.73
	HOLD = 0.632
	MID = 0.478
	ATT = 0.324
	FWD = 0.17
	WB_ADV = (WB - 0.035)
	gk = function()
		return Js.O({ role = "GK", x = 0.5, y = GK }, { "role", "x", "y" })
	end
	back4 = function()
		return Js.alit(Js.O({ role = "LB", x = 0.12, y = DEF4 }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.38, y = DEF4 }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.62, y = DEF4 }, { "role", "x", "y" }), Js.O({ role = "RB", x = 0.88, y = DEF4 }, { "role", "x", "y" }))
	end
	back3 = function()
		return Js.alit(Js.O({ role = "CB", x = 0.22, y = DEF }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.5, y = DEF }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.78, y = DEF }, { "role", "x", "y" }))
	end
	back5 = function()
		return Js.alit(Js.O({ role = "LB", x = 0.07, y = WB_ADV, label = "LWB" }, { "role", "x", "y", "label" }), Js.O({ role = "CB", x = 0.3, y = WB }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.5, y = WB }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.7, y = WB }, { "role", "x", "y" }), Js.O({ role = "RB", x = 0.93, y = WB_ADV, label = "RWB" }, { "role", "x", "y", "label" }))
	end
	f = function(id, name, ...)
		local rows = Js.alit(...)
		return Js.O({ id = id, name = name, slots = Js.aspread(Js.alit(gk()), A.flat(rows)) }, { "id", "name", "slots" })
	end
	FORMATIONS = Js.alit(f("3142", "3-1-4-2", Js.alit(Js.O({ role = "CB", x = 0.22, y = DEF }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.38, y = DEF }, { "role", "x", "y" }), Js.O({ role = "CB", x = 0.78, y = DEF }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CDM", x = 0.5, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.12, y = MID, label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = MID }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = MID, label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("3412", "3-4-1-2", back3(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.06), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.06), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("3421", "3-4-2-1", back3(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.06), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.06), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "CAM", x = 0.33, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.67, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("343", "3-4-3", back3(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.04), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.4, y = (MID + 0.04) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.6, y = (MID + 0.04) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.04), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "LW", x = 0.22, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.78, y = FWD }, { "role", "x", "y" }))), f("352", "3-5-2", back3(), Js.alit(Js.O({ role = "LW", x = 0.09, y = (MID + 0.03), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.32, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.47, y = (MID + 0.09) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.68, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.91, y = (MID + 0.03), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("41212", "4-1-2-1-2", back4(), Js.alit(Js.O({ role = "CDM", x = 0.5, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CM", x = 0.28, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.72, y = MID }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("41212(2)", "4-1-2-1-2 (wide)", back4(), Js.alit(Js.O({ role = "CDM", x = 0.5, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.11, y = MID, label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "RW", x = 0.89, y = MID, label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("4132", "4-1-3-2", back4(), Js.alit(Js.O({ role = "CDM", x = 0.54, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CM", x = 0.24, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.4, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.76, y = MID }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("4141", "4-1-4-1", back4(), Js.alit(Js.O({ role = "CDM", x = 0.5, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID - 0.04), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID - 0.04) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID - 0.04) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID - 0.04), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("4213", "4-2-1-3", back4(), Js.alit(Js.O({ role = "CDM", x = 0.3, y = HOLD }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.7, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = (ATT + 0.04) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.2, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.8, y = FWD }, { "role", "x", "y" }))), f("4222", "4-2-2-2", back4(), Js.alit(Js.O({ role = "CDM", x = 0.3, y = HOLD }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.7, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.22, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.78, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("4231", "4-2-3-1", back4(), Js.alit(Js.O({ role = "CDM", x = 0.3, y = HOLD }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.7, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.15, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.5, y = (ATT + 0.02) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.85, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("4231(2)", "4-2-3-1 (narrow)", back4(), Js.alit(Js.O({ role = "CM", x = 0.35, y = (HOLD - 0.02) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.65, y = (HOLD - 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.28, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.58, y = (ATT - 0.015) }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.76, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.46, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("424", "4-2-4", back4(), Js.alit(Js.O({ role = "CM", x = 0.35, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.65, y = MID }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.12, y = (FWD + 0.02) }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.38, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.62, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (FWD + 0.02) }, { "role", "x", "y" }))), f("4312", "4-3-1-2", back4(), Js.alit(Js.O({ role = "CM", x = 0.25, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.75, y = (MID + 0.06) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("4321", "4-3-2-1", back4(), Js.alit(Js.O({ role = "CM", x = 0.25, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.75, y = (MID + 0.06) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.32, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.68, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("433", "4-3-3", back4(), Js.alit(Js.O({ role = "CM", x = 0.25, y = (MID + 0.02) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.02) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.75, y = (MID + 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.18, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.82, y = FWD }, { "role", "x", "y" }))), f("433(2)", "4-3-3 (holding)", back4(), Js.alit(Js.O({ role = "CDM", x = 0.5, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CM", x = 0.3, y = (MID - 0.02) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.7, y = (MID - 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.18, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.82, y = FWD }, { "role", "x", "y" }))), f("433(3)", "4-3-3 (defend)", back4(), Js.alit(Js.O({ role = "CDM", x = 0.27, y = HOLD }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.73, y = HOLD }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CM", x = 0.5, y = (MID - 0.04) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.18, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.82, y = FWD }, { "role", "x", "y" }))), f("433(4)", "4-3-3 (attack)", back4(), Js.alit(Js.O({ role = "CM", x = 0.5, y = (HOLD - 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.3, y = (ATT + 0.02) }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.7, y = (ATT + 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.18, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.82, y = FWD }, { "role", "x", "y" }))), f("433(5)", "4-3-3 (midfield)", back4(), Js.alit(Js.O({ role = "CM", x = 0.3, y = (HOLD - 0.02) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.7, y = (HOLD - 0.02) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = (ATT + 0.035) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.18, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.82, y = FWD }, { "role", "x", "y" }))), f("4411(2)", "4-4-1-1", back4(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.03), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.03), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "CAM", x = 0.58, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("442", "4-4-2", back4(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.01), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.01), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("442(2)", "4-4-2 (holding)", back4(), Js.alit(Js.O({ role = "LW", x = 0.12, y = (MID + 0.05), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CDM", x = 0.38, y = (MID + 0.09) }, { "role", "x", "y" }), Js.O({ role = "CDM", x = 0.62, y = (MID + 0.09) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.88, y = (MID + 0.05), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("451", "4-5-1", back4(), Js.alit(Js.O({ role = "LW", x = 0.09, y = (MID + 0.01), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.31, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.05) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.69, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.91, y = (MID + 0.01), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("451(2)", "4-5-1 (attack)", back4(), Js.alit(Js.O({ role = "LW", x = 0.14, y = (ATT + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.34, y = MID }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.06) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.66, y = MID }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.86, y = (ATT + 0.06) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("5212", "5-2-1-2", back5(), Js.alit(Js.O({ role = "CM", x = 0.35, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.65, y = (MID + 0.03) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.5, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("5221", "5-2-2-1", back5(), Js.alit(Js.O({ role = "CM", x = 0.35, y = (MID + 0.03) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.65, y = (MID + 0.03) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "CAM", x = 0.3, y = ATT }, { "role", "x", "y" }), Js.O({ role = "CAM", x = 0.7, y = ATT }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))), f("523", "5-2-3", back5(), Js.alit(Js.O({ role = "CM", x = 0.35, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.65, y = (MID + 0.01) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "LW", x = 0.2, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.5, y = FWD }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.8, y = FWD }, { "role", "x", "y" }))), f("532", "5-3-2", back5(), Js.alit(Js.O({ role = "CM", x = 0.28, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.5, y = (MID + 0.05) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.72, y = (MID + 0.01) }, { "role", "x", "y" })), Js.alit(Js.O({ role = "ST", x = 0.4, y = FWD }, { "role", "x", "y" }), Js.O({ role = "ST", x = 0.6, y = FWD }, { "role", "x", "y" }))), f("541", "5-4-1", back5(), Js.alit(Js.O({ role = "LW", x = 0.14, y = (MID + 0.01), label = "LM" }, { "role", "x", "y", "label" }), Js.O({ role = "CM", x = 0.38, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "CM", x = 0.62, y = (MID + 0.01) }, { "role", "x", "y" }), Js.O({ role = "RW", x = 0.86, y = (MID + 0.01), label = "RM" }, { "role", "x", "y", "label" })), Js.alit(Js.O({ role = "ST", x = 0.5, y = (FWD - 0.02) }, { "role", "x", "y" }))))
	exports.FORMATIONS = FORMATIONS
	DEFAULT_FORMATION = "433"
	exports.DEFAULT_FORMATION = DEFAULT_FORMATION
	NEIGHBOURS = Js.O({ GK = Js.alit(), CB = Js.alit("RB", "LB", "CDM"), RB = Js.alit("LB", "CB", "RW", "CM"), LB = Js.alit("RB", "CB", "LW", "CM"), CDM = Js.alit("CM", "CB"), CM = Js.alit("CDM", "CAM", "LW", "RW"), CAM = Js.alit("CM", "LW", "RW", "ST"), RW = Js.alit("LW", "CAM", "ST", "RB"), LW = Js.alit("RW", "CAM", "ST", "LB"), ST = Js.alit("CAM", "LW", "RW") }, { "GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST" })
end
