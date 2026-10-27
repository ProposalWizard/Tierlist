--!nocheck
--!nolint
-- Generated from lib/star/scenarioEdit.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local M_penalty = import("lib/star/kindRules/penalty")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_index = import("lib/star/kindRules/index")
	local M_scenarioFrame = import("lib/star/scenarioFrame")
	local hasEdits, cloneOverride, mergeOverrides, mirrorOverride, nextAddedId, lookFor, applyOverride, OFF_PITCH, applyOverrideToScenario, freeSpotFor, addFigureTo, removeFigureFrom, NO_FAULTS, analyseEdited, momentKindFor, round2, roundVec, frameToMatchScenario, savedIdMap, overrideFromMatchScenario, loadEditStore, saveEditStore
	hasEdits = function(ov)
		do return ((not (not ov)) and ((((((Js.alen(Js.Object.keys(ov.items)) > 0) or (not (not ov.ball))) or (not (not Js.T((function() local _v = ov.removed; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())))) or (not (not Js.T((function() local _v = ov.added; if _v == nil then return nil end; _v = Js.len(_v); return _v end)())))) or (not (not ov.camera))) or (not (not Js.T(ov.facing))))) end
	end
	exports.hasEdits = hasEdits
	cloneOverride = function(ov)
		local items = Js.O({}, nil)
		if ov then
			do
				local _arr1 = Js.Object.keys(ov.items)
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local k = _arr1[_i2]
					items[k] = Js.ospread(ov.items[k])
				end
			end
		end
		do return Js.O({ items = items, ball = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.ball; return _v end)() then Js.ospread(ov.ball) else nil), removed = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.removed; return _v end)() then Js.aspread(ov.removed) else nil), added = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.added; return _v end)() then A.map(ov.added, function(a)
			return Js.ospread(a)
		end) else nil), camera = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.camera; return _v end)() then Js.ospread(ov.camera) else nil), facing = (function() local _v = ov; if _v == nil then return nil end; _v = _v.facing; return _v end)() }, { "items", "ball", "removed", "added", "camera", "facing" }) end
	end
	exports.cloneOverride = cloneOverride
	mergeOverrides = function(ovs)
		local real = A.filter(ovs, function(o)
			return hasEdits(o)
		end)
		if (Js.alen(real) == 0) then
			do return nil end
		end
		if (Js.alen(real) == 1) then
			do return real[1] end
		end
		local items = Js.O({}, nil)
		local removed = Js.Set.new()
		local added = Js.alit()
		local ball = nil
		local camera = nil
		local facing = nil
		do
			local _arr3 = real
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local ov = _arr3[_i4]
				if ov.camera then
					camera = Js.ospread(ov.camera)
				end
				if Js.T(ov.facing) then
					facing = ov.facing
				end
				do
					local _arr5 = Js.Object.keys(ov.items)
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local k = _arr5[_i6]
						items[k] = Js.ospread(ov.items[k])
					end
				end
				do
					local _arr7 = (if ov.removed ~= nil then ov.removed else Js.alit())
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local r = _arr7[_i8]
						removed:add(r)
					end
				end
				do
					local _arr9 = (if ov.added ~= nil then ov.added else Js.alit())
					local _i10 = 0
					while _i10 < Js.alen(_arr9) do
						_i10 += 1
						local a = _arr9[_i10]
						if (not A.some(added, function(x)
							return (x.id == a.id)
						end)) then
							A.push(added, Js.ospread(a))
						end
					end
				end
				if ov.ball then
					ball = Js.ospread(ov.ball)
				end
			end
		end
		do return Js.O({ items = items, ball = ball, removed = (if Js.T(removed.size) then Js.Array.from(removed) else nil), added = (if Js.T(Js.alen(added)) then added else nil), camera = camera, facing = facing }, { "items", "ball", "removed", "added", "camera", "facing" }) end
	end
	exports.mergeOverrides = mergeOverrides
	mirrorOverride = function(frame, ov)
		local cur = applyOverride(frame, ov)
		local m = function(v)
			return Js.O({ x = (M_pitch.PITCH_W - v.x), y = v.y }, { "x", "y" })
		end
		local items = Js.O({}, nil)
		do
			local _arr11 = cur.items
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local it = _arr11[_i12]
				items[it.id] = m(it.at)
			end
		end
		local c = cur.camera
		local facing = (if (cur.facing == "left") then "right" else (if (cur.facing == "right") then "left" else nil))
		do return Js.O({ items = items, ball = m(cur.ball), removed = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.removed; return _v end)() then Js.aspread(ov.removed) else nil), added = (if (function() local _v = ov; if _v == nil then return nil end; _v = _v.added; return _v end)() then A.map(ov.added, function(a)
			return Js.ospread(a)
		end) else nil), camera = Js.O({ x1 = (M_pitch.PITCH_W - c.x2), x2 = (M_pitch.PITCH_W - c.x1), y1 = c.y1, y2 = c.y2 }, { "x1", "x2", "y1", "y2" }), facing = facing }, { "items", "ball", "removed", "added", "camera", "facing" }) end
	end
	exports.mirrorOverride = mirrorOverride
	nextAddedId = function(ovs)
		local max = 0
		do
			local _arr13 = ovs
			local _i14 = 0
			while _i14 < Js.alen(_arr13) do
				_i14 += 1
				local ov = _arr13[_i14]
				do
					local _arr15 = ((function() local _v = ov; if _v == nil then return nil end; _v = _v.added; return _v end)() or Js.alit())
					local _i16 = 0
					while _i16 < Js.alen(_arr15) do
						_i16 += 1
						local a = _arr15[_i16]
						local n = Js.Number(S.replace(a.id, Js.re("^add", ""), ""))
						if (Js.NumberNS.isFinite(n) and (n > max)) then
							max = n
						end
					end
				end
			end
		end
		do return ("add" .. Js.numstr((max + 1))) end
	end
	exports.nextAddedId = nextAddedId
	applyOverride = function(frame, ov)
		if (not hasEdits(ov)) then
			do return frame end
		end
		local gone = Js.Set.new((if ov.removed ~= nil then ov.removed else Js.alit()))
		local items = Js.alit()
		do
			local _arr17 = frame.items
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local it = _arr17[_i18]
				if gone:has(it.id) then
					do continue end
				end
				A.push(items, (if ov.items[it.id] then Js.ospread(it, Js.O({ at = Js.ospread(ov.items[it.id]) }, { "at" })) else it))
			end
		end
		local present = Js.Set.new(A.map(items, function(it)
			return it.id
		end))
		do
			local _arr19 = (if ov.added ~= nil then ov.added else Js.alit())
			local _i20 = 0
			while _i20 < Js.alen(_arr19) do
				_i20 += 1
				local a = _arr19[_i20]
				if (gone:has(a.id) or present:has(a.id)) then
					do continue end
				end
				local at = ov.items[a.id]
				if (not at) then
					do continue end
				end
				A.push(items, Js.O({ id = a.id, at = Js.ospread(at), look = Js.ospread(lookFor(a.side), Js.O({ label = (if (a.side == "opponent") then "OPP" else "MATE") }, { "label" })), side = a.side, removable = true }, { "id", "at", "look", "side", "removable" }))
			end
		end
		local ball = (if ov.ball then Js.ospread(ov.ball) else frame.ball)
		local out = (if ov.camera then Js.ospread(frame, Js.O({ items = items, ball = ball, camera = Js.ospread(ov.camera) }, { "items", "ball", "camera" })) else Js.ospread(frame, Js.O({ items = items, ball = ball }, { "items", "ball" })))
		do return M_penalty.penaltyFrame((if Js.T(ov.facing) then Js.ospread(out, Js.O({ facing = ov.facing }, { "facing" })) else out)) end
	end
	exports.applyOverride = applyOverride
	applyOverrideToScenario = function(sc, ov)
		if (not hasEdits(ov)) then
			do return end
		end
		if ov.camera then
			sc.viewport = Js.ospread(ov.camera)
		end
		if Js.T(ov.facing) then
			sc.facing = ov.facing
		end
		local at = function(i)
			return ov.items[Js.numstr(i)]
		end
		local gone = Js.Set.new((if ov.removed ~= nil then ov.removed else Js.alit()))
		local isGone = function(i)
			return gone:has(Js.numstr(i))
		end
		local defIdx = Js.alit()
		local secIdx = Js.alit()
		local mateIdx = Js.alit()
		local runnerIdx = -1
		local followerIdx = -1
		local i = 0
		do
			local _arr21 = sc.defenders
			local _i22 = 0
			while _i22 < Js.alen(_arr21) do
				_i22 += 1
				local d = _arr21[_i22]
				A.push(defIdx, i)
				local p = at((function() local _o = i; i = _o + 1; return _o end)())
				if p then
					d.x = p.x
					d.y = p.y
				end
			end
		end
		do
			local p = at((function() local _o = i; i = _o + 1; return _o end)())
			if p then
				sc.keeper.x = p.x
				sc.keeper.y = p.y
			end
		end
		if sc.runner then
			runnerIdx = i
			local p = at((function() local _o = i; i = _o + 1; return _o end)())
			if p then
				sc.runner.pos.x = p.x
				sc.runner.pos.y = p.y
			end
		end
		do
			local _arr23 = sc.secondaryRunners
			local _i24 = 0
			while _i24 < Js.alen(_arr23) do
				_i24 += 1
				local r = _arr23[_i24]
				A.push(secIdx, i)
				local p = at((function() local _o = i; i = _o + 1; return _o end)())
				if p then
					r.pos.x = p.x
					r.pos.y = p.y
				end
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			followerIdx = i
			local p = at((function() local _o = i; i = _o + 1; return _o end)())
			if p then
				sc.follower.x = p.x
				sc.follower.y = p.y
			end
		end
		do
			local _arr25 = sc.teammates
			local _i26 = 0
			while _i26 < Js.alen(_arr25) do
				_i26 += 1
				local t = _arr25[_i26]
				A.push(mateIdx, i)
				local p = at((function() local _o = i; i = _o + 1; return _o end)())
				if p then
					t.x = p.x
					t.y = p.y
				end
			end
		end
		do
			local p = at((function() local _o = i; i = _o + 1; return _o end)())
			if p then
				sc.player.x = p.x
				sc.player.y = p.y
			end
		end
		if ov.ball then
			sc.ball.x = ov.ball.x
			sc.ball.y = ov.ball.y
		end
		if ((followerIdx >= 0) and isGone(followerIdx)) then
			sc.follower.x = OFF_PITCH.x
			sc.follower.y = OFF_PITCH.y
		end
		for k = (Js.alen(mateIdx) - 1), 0, -1 do
			if isGone(mateIdx[k + 1]) then
				A.splice(sc.teammates, k, 1)
			end
		end
		for k = (Js.alen(secIdx) - 1), 0, -1 do
			if isGone(secIdx[k + 1]) then
				A.splice(sc.secondaryRunners, k, 1)
			end
		end
		if ((runnerIdx >= 0) and isGone(runnerIdx)) then
			sc.runner = nil
			sc.passTarget = nil
		end
		for k = (Js.alen(defIdx) - 1), 0, -1 do
			if isGone(defIdx[k + 1]) then
				A.splice(sc.defenders, k, 1)
			end
		end
		do
			local _arr27 = (if ov.added ~= nil then ov.added else Js.alit())
			local _i28 = 0
			while _i28 < Js.alen(_arr27) do
				_i28 += 1
				local a = _arr27[_i28]
				local p = ov.items[a.id]
				if ((not p) or gone:has(a.id)) then
					do continue end
				end
				if (a.side == "opponent") then
					A.push(sc.defenders, Js.O({ x = p.x, y = p.y, role = "hold", baseRole = "hold" }, { "x", "y", "role", "baseRole" }))
				elseif (a.side == "teammate") then
					A.push(sc.secondaryRunners, Js.O({ pos = Js.O({ x = p.x, y = p.y }, { "x", "y" }), to = Js.O({ x = p.x, y = p.y }, { "x", "y" }), speed = (7 * 0.95), moving = false, role = "support", sprint = false }, { "pos", "to", "speed", "moving", "role", "sprint" }))
				end
			end
		end
		M_index.enforceHardRules(sc)
	end
	exports.applyOverrideToScenario = applyOverrideToScenario
	freeSpotFor = function(frame, side)
		local vp = frame.camera
		local inset = 3.2
		local x1 = (vp.x1 + inset)
		local x2 = (vp.x2 - inset)
		local y1 = (vp.y1 + inset)
		local y2 = (vp.y2 - inset)
		local goalY = (if frame.goalAtY ~= nil then frame.goalAtY else y1)
		local wantY = (if (side == "opponent") then ((frame.ball.y + goalY) / 2) else (frame.ball.y - ((frame.ball.y - goalY) * 0.25)))
		local best = Js.O({ x = ((x1 + x2) / 2), y = wantY }, { "x", "y" })
		local bestScore = (-math.huge)
		local COLS = 7
		local ROWS = 9
		for c = 0, COLS - 1 do
			for r = 0, ROWS - 1 do
				local at = Js.O({ x = (x1 + (((x2 - x1) * (c + 0.5)) / COLS)), y = (y1 + (((y2 - y1) * (r + 0.5)) / ROWS)) }, { "x", "y" })
				local near = Math.hypot((at.x - frame.ball.x), (at.y - frame.ball.y))
				do
					local _arr29 = frame.items
					local _i30 = 0
					while _i30 < Js.alen(_arr29) do
						_i30 += 1
						local it = _arr29[_i30]
						near = Math.min(near, Math.hypot((at.x - it.at.x), (at.y - it.at.y)))
					end
				end
				local score = ((Math.min(near, 6) * 2) - (math.abs((at.y - wantY)) * 0.35))
				if (score > bestScore) then
					bestScore = score
					best = at
				end
			end
		end
		do return best end
	end
	exports.freeSpotFor = freeSpotFor
	addFigureTo = function(frame, side, override, alsoInPlay)
		if alsoInPlay == nil then alsoInPlay = Js.alit() end
		local id = nextAddedId(Js.aspread(alsoInPlay, Js.alit(override)))
		local ov = cloneOverride(override)
		ov.items[id] = freeSpotFor(frame, side)
		ov.added = Js.aspread((if ov.added ~= nil then ov.added else Js.alit()), Js.alit(Js.O({ id = id, side = side }, { "id", "side" })))
		do return Js.O({ override = ov, id = id }, { "override", "id" }) end
	end
	exports.addFigureTo = addFigureTo
	removeFigureFrom = function(id, override)
		local ov = cloneOverride(override)
		if A.some((if ov.added ~= nil then ov.added else Js.alit()), function(a)
			return (a.id == id)
		end) then
			ov.added = A.filter((if ov.added ~= nil then ov.added else Js.alit()), function(a)
				return (a.id ~= id)
			end)
			Js.del(ov.items, id)
		else
			ov.removed = Js.aspread((if ov.removed ~= nil then ov.removed else Js.alit()), Js.alit(id))
		end
		do return ov end
	end
	exports.removeFigureFrom = removeFigureFrom
	analyseEdited = function(kind, build, faultsOf, overrides)
		local sc = build()
		applyOverrideToScenario(sc, mergeOverrides(overrides))
		local split = M_scenarioFrame.splitFaults(kind, faultsOf(sc))
		do return Js.O({ faults = split.faults, intended = split.intended, marks = Js.aspread(M_scenarioFrame.marksForFaults(sc, split.faults, "red"), M_scenarioFrame.marksForFaults(sc, split.intended, "amber")) }, { "faults", "intended", "marks" }) end
	end
	exports.analyseEdited = analyseEdited
	momentKindFor = function(chanceKind)
		if (chanceKind == "corner") then
			do return "corner" end
		end
		if ((chanceKind == "free_kick") or (chanceKind == "penalty")) then
			do return "free_kick" end
		end
		do return "open_play" end
	end
	exports.momentKindFor = momentKindFor
	frameToMatchScenario = function(target, frame)
		local vp = frame.camera
		do return Js.O({ id = target.id, name = target.name, kind = momentKindFor(target.kind), camera = Js.O({ centerX = round2(((vp.x1 + vp.x2) / 2)), centerY = round2(((vp.y1 + vp.y2) / 2)), viewHeight = round2((vp.y2 - vp.y1)), facing = "up" }, { "centerX", "centerY", "viewHeight", "facing" }), ball = roundVec(frame.ball), players = A.map(frame.items, function(it)
			return Js.O({ id = ("i" .. it.id), side = it.side, x = round2(it.at.x), y = round2(it.at.y), label = it.look.label }, { "id", "side", "x", "y", "label" })
		end), updatedAt = Js.Date.now(), source = Js.O({ tool = target.tool, kind = target.kind, seed = target.seed, planId = target.planId }, { "tool", "kind", "seed", "planId" }) }, { "id", "name", "kind", "camera", "ball", "players", "updatedAt", "source" }) end
	end
	exports.frameToMatchScenario = frameToMatchScenario
	savedIdMap = function(ms, base)
		local map = Js.Map.new()
		local num = function(p, i)
			local id = (if S.startsWith(p.id, "i") then S.slice(p.id, 1) else Js.numstr(i))
			do return (if Js.re("^\\d+$", ""):test(id) then id else nil) end
		end
		local savedKeeper = -1
		A.forEach(ms.players, function(p, i)
			if ((p.side == "opponent") and (num(p, i) ~= nil)) then
				savedKeeper = i
			end
		end)
		local baseKeeper = A.findIndex(base, function(it)
			return it.keeper
		end)
		local lined = A.every(ms.players, function(p, i)
			local id = num(p, i)
			if (id == nil) then
				do return true end
			end
			local it = base[Js.Number(id) + 1]
			if ((not it) or (it.side ~= p.side)) then
				do return false end
			end
			do return ((i == savedKeeper) == (Js.Number(id) == baseKeeper)) end
		end)
		if lined then
			A.forEach(ms.players, function(p, i)
				local id = num(p, i)
				if (id ~= nil) then
					map:set(i, id)
				end
			end)
			do return map end
		end
		local used = Js.Set.new()
		local take = function(j, i)
			used:add(j)
			map:set(i, Js.numstr(j))
		end
		A.forEach(ms.players, function(p, i)
			if (num(p, i) == nil) then
				do return end
			end
			if ((i == savedKeeper) and (baseKeeper >= 0)) then
				take(baseKeeper, i)
			elseif (p.side == "you") then
				local j = A.findIndex(base, function(it)
					return (it.side == "you")
				end)
				if (j >= 0) then
					take(j, i)
				end
			end
		end)
		A.forEach(ms.players, function(p, i)
			if ((map:has(i) or (num(p, i) == nil)) or (p.side ~= "teammate")) then
				do return end
			end
			local j = A.findIndex(base, function(it, k)
				return (((not used:has(k)) and (it.side == "teammate")) and (it.look.label == p.label))
			end)
			if (j >= 0) then
				take(j, i)
			end
		end)
		A.forEach(ms.players, function(p, i)
			if (map:has(i) or (num(p, i) == nil)) then
				do return end
			end
			local j = A.findIndex(base, function(it, k)
				return (((not used:has(k)) and (not it.keeper)) and (it.side == p.side))
			end)
			if (j >= 0) then
				take(j, i)
			end
		end)
		do return map end
	end
	overrideFromMatchScenario = function(ms, baseItems, baseCamera, baseFacing)
		local baseCount = (if (type(baseItems) == "number") then baseItems else Js.alen(baseItems))
		local idMap = (if (type(baseItems) == "number") then nil else savedIdMap(ms, baseItems))
		local items = Js.O({}, nil)
		local added = Js.alit()
		local seenBase = Js.Set.new()
		local extra = 0
		A.forEach(ms.players, function(p, i)
			local id = (if S.startsWith(p.id, "i") then S.slice(p.id, 1) else Js.numstr(i))
			if (idMap and Js.re("^\\d+$", ""):test(id)) then
				local mapped = idMap:get(i)
				id = (if mapped ~= nil then mapped else ("addsaved" .. Js.numstr((function() local _n = extra + 1; extra = _n; return _n end)())))
			end
			items[id] = Js.O({ x = p.x, y = p.y }, { "x", "y" })
			if Js.re("^\\d+$", ""):test(id) then
				seenBase:add(id)
			else
				A.push(added, Js.O({ id = id, side = p.side }, { "id", "side" }))
			end
		end)
		local removed = Js.alit()
		for i = 0, math.ceil(baseCount) - 1 do
			if (not seenBase:has(Js.numstr(i))) then
				A.push(removed, Js.numstr(i))
			end
		end
		local camera = nil
		if baseCamera then
			local bw = (baseCamera.x2 - baseCamera.x1)
			local bh = (baseCamera.y2 - baseCamera.y1)
			local cx = ((baseCamera.x1 + baseCamera.x2) / 2)
			local cy = ((baseCamera.y1 + baseCamera.y2) / 2)
			local c = ms.camera
			local turned = ((baseFacing == "left") or (baseFacing == "right"))
			if turned then
				if ((math.abs((c.centerX - cx)) > 0.05) or (math.abs((c.centerY - cy)) > 0.05)) then
					camera = Js.O({ x1 = (c.centerX - (bw / 2)), x2 = (c.centerX + (bw / 2)), y1 = (c.centerY - (bh / 2)), y2 = (c.centerY + (bh / 2)) }, { "x1", "x2", "y1", "y2" })
				end
			elseif (((math.abs((c.centerX - cx)) > 0.05) or (math.abs((c.centerY - cy)) > 0.05)) or (math.abs((c.viewHeight - bh)) > 0.05)) then
				local w = (c.viewHeight * (bw / bh))
				camera = Js.O({ x1 = (c.centerX - (w / 2)), x2 = (c.centerX + (w / 2)), y1 = (c.centerY - (c.viewHeight / 2)), y2 = (c.centerY + (c.viewHeight / 2)) }, { "x1", "x2", "y1", "y2" })
			end
		end
		local facing = nil
		if ((baseFacing == "left") or (baseFacing == "right")) then
			local side = (if (ms.ball.x >= M_pitch.CX) then "right" else "left")
			if (side ~= baseFacing) then
				facing = side
			end
		end
		do return Js.O({ items = items, ball = Js.O({ x = ms.ball.x, y = ms.ball.y }, { "x", "y" }), removed = (if Js.T(Js.alen(removed)) then removed else nil), added = (if Js.T(Js.alen(added)) then added else nil), camera = camera, facing = facing }, { "items", "ball", "removed", "added", "camera", "facing" }) end
	end
	exports.overrideFromMatchScenario = overrideFromMatchScenario
	loadEditStore = function(storageKey)
		if (Js.window == nil) then
			do return Js.O({}, nil) end
		end
		local _ok31, _err32, _rv33 = pcall(function()
			local raw = Js.window.localStorage.getItem(storageKey)
			if (not Js.T(raw)) then
				do return Js.RET, Js.O({}, nil) end
			end
			local parsed = Js.JSON.parse(raw)
			do return Js.RET, (if (Js.T(parsed) and (type(parsed) == "table")) then parsed else Js.O({}, nil)) end
		end)
		if not _ok31 then
			do return Js.O({}, nil) end
		elseif _err32 == Js.RET then
			return _rv33
		end
	end
	exports.loadEditStore = loadEditStore
	saveEditStore = function(storageKey, store)
		if (Js.window == nil) then
			do return end
		end
		local _ok34, _err35, _rv36 = pcall(function()
			Js.window.localStorage.setItem(storageKey, Js.JSON.stringify(store))
		end)
		if not _ok34 then
		elseif _err35 == Js.RET then
			return _rv36
		end
	end
	exports.saveEditStore = saveEditStore
	lookFor = function(side)
		return (if (side == "opponent") then M_scenarioFrame.OPP else (if (side == "you") then M_scenarioFrame.YOU else M_scenarioFrame.MATE))
	end
	exports.lookFor = lookFor
	OFF_PITCH = Js.O({ x = -400, y = 400 }, { "x", "y" })
	exports.OFF_PITCH = OFF_PITCH
	NO_FAULTS = Js.O({ faults = Js.alit(), intended = Js.alit(), marks = Js.alit() }, { "faults", "intended", "marks" })
	exports.NO_FAULTS = NO_FAULTS
	round2 = function(v)
		return ((Math.round((v * 100)) / 100) + 0)
	end
	exports.round2 = round2
	roundVec = function(v)
		return Js.O({ x = round2(v.x), y = round2(v.y) }, { "x", "y" })
	end
	exports.roundVec = roundVec
end
