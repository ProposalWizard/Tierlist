--!nocheck
--!nolint
-- Generated from lib/star/aerialMoves.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_aerial = import("lib/star/aerial")
	local M_devMode = import("lib/star/devMode")
	local AERIAL_MOVES, AERIAL_SPECS, CONTACT_SHOW_S, AERIAL_CLIPS, turnAngleDeg, moveRolls, clamp01, BICYCLE_GATE, SCORPION_GATE, DIVING_GATE, bicycleChance, scorpionChance, divingChance, pickAerialMove, aerialFacing, easeOut, smooth, aerialRise, aerialFollow, aerialStrikeTint, liftToMeet, KEY, aerialMovesOn, testPageMove, setTestAerialMove, forcedAerialMove
	turnAngleDeg = function(inDir, toGoal)
		local a = Math.hypot(inDir.x, inDir.y)
		local b = Math.hypot(toGoal.x, toGoal.y)
		if ((not (a > 1e-9)) or (not (b > 1e-9))) then
			do return 90 end
		end
		local c = (((inDir.x * toGoal.x) + (inDir.y * toGoal.y)) / (a * b))
		do return ((Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI) end
	end
	exports.turnAngleDeg = turnAngleDeg
	moveRolls = function(seed)
		local h = Js.ushr(Js.bxor(seed, 49723859), 0)
		h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 16)), 73244475), 0)
		h = Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 16)), 73244475), 0)
		h = Js.ushr(Js.bxor(h, Js.ushr(h, 16)), 0)
		local g = Js.ushr(Math.imul(Js.bxor(h, 2654435769), 2246822507), 0)
		g = Js.ushr(Math.imul(Js.bxor(g, Js.ushr(g, 13)), 3266489909), 0)
		g = Js.ushr(Js.bxor(g, Js.ushr(g, 16)), 0)
		do return Js.alit((h / 4294967296), (g / 4294967296)) end
	end
	exports.moveRolls = moveRolls
	bicycleChance = function(aerial, flair)
		if ((aerial < BICYCLE_GATE.aerial) or (flair < BICYCLE_GATE.flair)) then
			do return 0 end
		end
		local k = Math.min(clamp01(((aerial - BICYCLE_GATE.aerial) / (100 - BICYCLE_GATE.aerial))), clamp01(((flair - BICYCLE_GATE.flair) / (100 - BICYCLE_GATE.flair))))
		do return (0.06 + (0.24 * k)) end
	end
	exports.bicycleChance = bicycleChance
	scorpionChance = function(aerial, flair)
		if ((aerial < SCORPION_GATE.aerial) or (flair < SCORPION_GATE.flair)) then
			do return 0 end
		end
		local k = Math.min(clamp01(((aerial - SCORPION_GATE.aerial) / (100 - SCORPION_GATE.aerial))), clamp01(((flair - SCORPION_GATE.flair) / (100 - SCORPION_GATE.flair))))
		do return (0.03 + (0.09 * k)) end
	end
	exports.scorpionChance = scorpionChance
	divingChance = function(aerial)
		if (aerial < DIVING_GATE.aerial) then
			do return 0 end
		end
		do return (0.12 + (0.33 * clamp01(((aerial - DIVING_GATE.aerial) / (100 - DIVING_GATE.aerial))))) end
	end
	exports.divingChance = divingChance
	pickAerialMove = function(p)
		local turn = turnAngleDeg(p.inDir, p.toGoal)
		local _d1 = moveRolls(p.seed)
		local u = _d1[1]
		local v = _d1[2]
		if (p.kind == "header") then
			if ((((p.ballZ <= DIVING_GATE.maxZ) and (turn >= DIVING_GATE.turn[1])) and (turn <= DIVING_GATE.turn[2])) and (u < divingChance(p.aerial))) then
				do return "divingHeader" end
			end
			do return (if (M_aerial.headerJump(p.ballZ, p.aerial).jumpM >= 0.12) then "jumpHeader" else "standHeader") end
		end
		if ((((turn <= SCORPION_GATE.maxTurn) and (p.ballZ >= SCORPION_GATE.minZ)) and (p.ballZ <= SCORPION_GATE.maxZ)) and (v < scorpionChance(p.aerial, p.flair))) then
			do return "scorpion" end
		end
		if (((turn <= BICYCLE_GATE.maxTurn) and (p.ballZ >= BICYCLE_GATE.minZ)) and (u < bicycleChance(p.aerial, p.flair))) then
			do return "bicycle" end
		end
		if (p.ballZ >= 1.15) then
			do return "chestVolley" end
		end
		if (((turn >= 55) and (turn <= 125)) and (p.ballZ >= 0.55)) then
			do return "sideVolley" end
		end
		do return "frontVolley" end
	end
	exports.pickAerialMove = pickAerialMove
	aerialFacing = function(move, goalAng, fromBallAng, foot)
		local f = AERIAL_SPECS[move].facing
		local blend = function(a, b, k)
			return (a + (Math.atan2(Math.sin((b - a)), Math.cos((b - a))) * k))
		end
		local _sw2 = f
		if _sw2 == "goal" then
			do return (if (move == "divingHeader") then blend(goalAng, fromBallAng, 0.25) else blend(goalAng, fromBallAng, 0.3)) end
		elseif _sw2 == "ball" then
			do return fromBallAng end
		elseif _sw2 == "acrossRight" then
			do return (goalAng + (((if (foot >= 0) then 1 else -1) * (50 * Math.PI)) / 180)) end
		elseif _sw2 == "awayGoal" then
			do return (goalAng + Math.PI) end
		end
	end
	exports.aerialFacing = aerialFacing
	aerialRise = function(move, e)
		local s = AERIAL_SPECS[move]
		local u = clamp01((e / Math.max(0.001, s.riseS)))
		local frame = (if (u >= 1) then s.contactFrame else Math.min((s.contactFrame - 1), math.floor((u * s.contactFrame))))
		local a = s.airborneAt
		local liftK = (if (a >= 1) then (if (u >= 1) then 1 else 0) else smooth(clamp01(((u - a) / (1 - a)))))
		do return Js.O({ frame = frame, moveU = easeOut(u), liftK = liftK }, { "frame", "moveU", "liftK" }) end
	end
	exports.aerialRise = aerialRise
	aerialFollow = function(move, e)
		local s = AERIAL_SPECS[move]
		local u = clamp01((e / Math.max(0.001, s.followS)))
		local after = ((s.frames - 1) - s.contactFrame)
		local frame = (if (after <= 0) then s.contactFrame else Math.min((s.frames - 1), ((s.contactFrame + 1) + math.floor(((u * after) * 0.999)))))
		do return Js.O({ frame = (if (e <= 0) then s.contactFrame else frame), moveU = 1, liftK = (1 - smooth(u)), done = (e >= s.followS) }, { "frame", "moveU", "liftK", "done" }) end
	end
	exports.aerialFollow = aerialFollow
	aerialStrikeTint = function(move, dir, power, seed)
		local s = AERIAL_SPECS[move]
		local _d3 = moveRolls(Js.ushr(Js.bxor(seed, 5369127), 0))
		local u = _d3[1]
		local v = _d3[2]
		local t = ((u + v) - 1)
		local a = (((t * s.spreadDeg) * Math.PI) / 180)
		local c = Math.cos(a)
		local sn = Math.sin(a)
		do return Js.O({ dir = Js.O({ x = ((dir.x * c) - (dir.y * sn)), y = ((dir.x * sn) + (dir.y * c)) }, { "x", "y" }), power = Math.max(0.05, Math.min(1, (power * s.powerK))) }, { "dir", "power" }) end
	end
	exports.aerialStrikeTint = aerialStrikeTint
	liftToMeet = function(move, ballUpPx, contactUpPx, pxPerM)
		local s = AERIAL_SPECS[move]
		local want = (ballUpPx - contactUpPx)
		local liftPx = Math.max((s.minLiftM * pxPerM), Math.min((s.maxLiftM * pxPerM), want))
		do return Js.O({ liftPx = liftPx, ballUpPx = (contactUpPx + liftPx) }, { "liftPx", "ballUpPx" }) end
	end
	exports.liftToMeet = liftToMeet
	aerialMovesOn = function()
		local _ok4, _err5, _rv6 = pcall(function()
			if (Js.window ~= nil) then
				local q = Js.URLSearchParams.new(Js.window.location.search).get("airmoves")
				if (q == "old") then
					do return Js.RET, false end
				end
				if (q == "new") then
					do return Js.RET, true end
				end
			end
			do return Js.RET, ((Js.localStorage == nil) or (Js.localStorage.getItem(KEY) ~= "old")) end
		end)
		if not _ok4 then
			do return true end
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.aerialMovesOn = aerialMovesOn
	setTestAerialMove = function(move)
		testPageMove = move
	end
	exports.setTestAerialMove = setTestAerialMove
	forcedAerialMove = function(kind)
		if (Js.T(testPageMove) and (AERIAL_SPECS[testPageMove].kind == kind)) then
			do return testPageMove end
		end
		local _ok7, _err8, _rv9 = pcall(function()
			if (Js.window == nil) then
				do return Js.RET, nil end
			end
			if (not M_devMode.offlineDevPlayEnabled()) then
				do return Js.RET, nil end
			end
			local q = Js.URLSearchParams.new(Js.window.location.search).get("airmove")
			if ((Js.T(q) and A.includes(AERIAL_MOVES, q)) and (AERIAL_SPECS[q].kind == kind)) then
				do return Js.RET, q end
			end
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
		do return nil end
	end
	exports.forcedAerialMove = forcedAerialMove
	AERIAL_MOVES = Js.alit("standHeader", "jumpHeader", "divingHeader", "chestVolley", "frontVolley", "sideVolley", "bicycle", "scorpion")
	exports.AERIAL_MOVES = AERIAL_MOVES
	AERIAL_SPECS = Js.O({ standHeader = Js.O({ kind = "header", part = "head", point = "head", clip = "airStandHeader", frames = 6, contactFrame = 3, chestFrame = -1, riseS = 0.36, followS = 0.4, minLiftM = 0, maxLiftM = 0.2, airborneAt = 0.5, facing = "goal", banner = "", powerK = 0.97, spreadDeg = 0 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), jumpHeader = Js.O({ kind = "header", part = "head", point = "head", clip = "airJumpHeader", frames = 7, contactFrame = 4, chestFrame = -1, riseS = 0.48, followS = 0.45, minLiftM = 0.12, maxLiftM = 1.45, airborneAt = 0.3, facing = "goal", banner = "", powerK = 1, spreadDeg = 0 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), divingHeader = Js.O({ kind = "header", part = "head", point = "head", clip = "airDivingHeader", frames = 7, contactFrame = 4, chestFrame = -1, riseS = 0.5, followS = 0.55, minLiftM = 0.2, maxLiftM = 1.3, airborneAt = 0.25, facing = "goal", banner = "DIVING HEADER", powerK = 1.05, spreadDeg = 1.5 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), chestVolley = Js.O({ kind = "volley", part = "laces", point = "foot", clip = "airChestVolley", frames = 7, contactFrame = 5, chestFrame = 1, riseS = 0.62, followS = 0.4, minLiftM = 0, maxLiftM = 0.15, airborneAt = 1, facing = "goal", banner = "", powerK = 0.98, spreadDeg = 0.5 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), frontVolley = Js.O({ kind = "volley", part = "laces", point = "foot", clip = "airFrontVolley", frames = 6, contactFrame = 3, chestFrame = -1, riseS = 0.4, followS = 0.4, minLiftM = 0, maxLiftM = 0.3, airborneAt = 0.8, facing = "goal", banner = "", powerK = 1, spreadDeg = 0 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), sideVolley = Js.O({ kind = "volley", part = "instep", point = "foot", clip = "airSideVolley", frames = 6, contactFrame = 3, chestFrame = -1, riseS = 0.42, followS = 0.45, minLiftM = 0, maxLiftM = 0.5, airborneAt = 0.6, facing = "acrossRight", banner = "", powerK = 1.02, spreadDeg = 1 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), bicycle = Js.O({ kind = "volley", part = "overheadFoot", point = "foot", clip = "airBicycle", frames = 7, contactFrame = 4, chestFrame = -1, riseS = 0.55, followS = 0.6, minLiftM = 0.1, maxLiftM = 1.2, airborneAt = 0.2, facing = "awayGoal", banner = "BICYCLE KICK!", powerK = 1.03, spreadDeg = 3.5 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }), scorpion = Js.O({ kind = "volley", part = "heel", point = "foot", clip = "airScorpion", frames = 7, contactFrame = 4, chestFrame = -1, riseS = 0.55, followS = 0.6, minLiftM = 0.05, maxLiftM = 1, airborneAt = 0.2, facing = "awayGoal", banner = "SCORPION KICK!", powerK = 0.95, spreadDeg = 4.5 }, { "kind", "part", "point", "clip", "frames", "contactFrame", "chestFrame", "riseS", "followS", "minLiftM", "maxLiftM", "airborneAt", "facing", "banner", "powerK", "spreadDeg" }) }, { "standHeader", "jumpHeader", "divingHeader", "chestVolley", "frontVolley", "sideVolley", "bicycle", "scorpion" })
	exports.AERIAL_SPECS = AERIAL_SPECS
	CONTACT_SHOW_S = 0.1
	exports.CONTACT_SHOW_S = CONTACT_SHOW_S
	AERIAL_CLIPS = A.map(AERIAL_MOVES, function(m)
		return AERIAL_SPECS[m].clip
	end)
	exports.AERIAL_CLIPS = AERIAL_CLIPS
	clamp01 = function(v)
		return Math.max(0, Math.min(1, v))
	end
	BICYCLE_GATE = Js.O({ aerial = 72, flair = 65, minZ = 0.9, maxTurn = 80 }, { "aerial", "flair", "minZ", "maxTurn" })
	exports.BICYCLE_GATE = BICYCLE_GATE
	SCORPION_GATE = Js.O({ aerial = 78, flair = 80, minZ = 0.6, maxZ = 1.15, maxTurn = 65 }, { "aerial", "flair", "minZ", "maxZ", "maxTurn" })
	exports.SCORPION_GATE = SCORPION_GATE
	DIVING_GATE = Js.O({ aerial = 45, maxZ = 1.8, turn = Js.alit(40, 140) }, { "aerial", "maxZ", "turn" })
	exports.DIVING_GATE = DIVING_GATE
	easeOut = function(u)
		return (1 - ((1 - u) * (1 - u)))
	end
	smooth = function(u)
		return ((u * u) * (3 - (2 * u)))
	end
	KEY = "star-air-moves"
	testPageMove = nil
end
