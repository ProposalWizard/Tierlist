--!nocheck
--!nolint
-- Generated from lib/star/scenarioFrame.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_baseScenario = import("lib/star/baseScenario")
	local M_rules = import("lib/star/fiveASide/rules")
	local M_render = import("lib/star/fiveASide/render")
	local M_matchGoal = import("lib/star/matchGoal")
	local M_pitch = import("lib/star/pitch")
	local M_faceStyle = import("lib/star/faceStyle")
	local M_fakeFaceStyle = import("lib/star/fakeFaceStyle")
	local YOU, OPP, KEEP, MATE, FACE, FAKE, idLabel, frameFromScenario, computeOffside, frameCssSize, frameFacing, frameScreen, pointProjection, lookInKit, paint, drawOffsideLine, PICTURE_SCALE, PICTURE_KEEPER_SCALE, HIT_FIGURE_R, HIT_BODY_UP, MARK_INK, paintMarked, attackersOf, marksForFaults, splitFaults
	frameFromScenario = function(sc)
		local items = Js.alit()
		A.forEach(sc.defenders, function(d, i)
			A.push(items, Js.O({ at = Js.O({ x = d.x, y = d.y }, { "x", "y" }), look = Js.ospread(OPP, Js.O({ label = idLabel(d.who, ("D" .. Js.numstr((i + 1)))) }, { "label" })), side = "opponent", removable = true }, { "at", "look", "side", "removable" }))
		end)
		A.push(items, Js.O({ at = Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), look = Js.ospread(KEEP, Js.O({ label = idLabel(sc.keeper.who, "GK") }, { "label" })), keeper = true, side = "opponent" }, { "at", "look", "keeper", "side" }))
		if sc.runner then
			A.push(items, Js.O({ at = Js.ospread(sc.runner.pos), look = Js.ospread(MATE, Js.O({ label = idLabel(sc.runner.who, "TARGET") }, { "label" })), side = "teammate", removable = true }, { "at", "look", "side", "removable" }))
		end
		A.forEach(sc.secondaryRunners, function(r, i)
			A.push(items, Js.O({ at = Js.ospread(r.pos), look = Js.ospread(MATE, Js.O({ label = idLabel(r.who, (if (r.role == "support") then "SUP" else ("R" .. Js.numstr((i + 1))))) }, { "label" })), side = "teammate", removable = true }, { "at", "look", "side", "removable" }))
		end)
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(items, Js.O({ at = Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" }), look = Js.ospread(MATE, Js.O({ label = idLabel(sc.follower.who, "POACH") }, { "label" })), side = "teammate", removable = true }, { "at", "look", "side", "removable" }))
		end
		A.forEach(sc.teammates, function(t, i)
			A.push(items, Js.O({ at = Js.O({ x = t.x, y = t.y }, { "x", "y" }), look = Js.ospread(MATE, Js.O({ label = idLabel(t.who, ("T" .. Js.numstr((i + 1)))) }, { "label" })), side = "teammate", removable = true }, { "at", "look", "side", "removable" }))
		end)
		A.push(items, Js.O({ at = Js.ospread(sc.player), look = Js.ospread(YOU, Js.O({ label = "YOU", star = true }, { "label", "star" })), side = "you" }, { "at", "look", "side" }))
		local withIds = A.map(items, function(it, i)
			return Js.ospread(it, Js.O({ id = Js.numstr(i) }, { "id" }))
		end)
		local nDef = Js.alen(sc.defenders)
		local offside = M_baseScenario.offsideLineOf(sc)
		do return Js.O({ rules = M_rules.ELEVEN_A_SIDE_ATTACK, camera = sc.viewport, goalAtY = (if M_canvasEngine.goalInView(sc.kind) then 0 else nil), offsideY = offside, offsideFrom = (if (offside ~= nil) then Js.O({ defenderIdx = A.map(sc.defenders, function(_, i)
			return i
		end), keeperIdx = nDef }, { "defenderIdx", "keeperIdx" }) else nil), items = withIds, ball = Js.ospread(sc.ball), facing = sc.facing, kind = sc.kind }, { "rules", "camera", "goalAtY", "offsideY", "offsideFrom", "items", "ball", "facing", "kind" }) end
	end
	exports.frameFromScenario = frameFromScenario
	computeOffside = function(frame)
		if (not frame.offsideFrom) then
			do return nil end
		end
		local ys = A.map(A.filter(frame.items, function(it)
			return (it.side == "opponent")
		end), function(it)
			return it.at.y
		end)
		if (Js.alen(ys) < 2) then
			do return nil end
		end
		A.sort(ys, function(a, b)
			return (a - b)
		end)
		do return ys[2] end
	end
	exports.computeOffside = computeOffside
	frameCssSize = function(frame, size)
		if size == nil then size = Js.O({}, nil) end
		local _d1 = size
		local baseW = _d1.baseW
		if baseW == nil then baseW = 340 end
		local maxW = _d1.maxW
		if maxW == nil then maxW = 460 end
		local maxH = _d1.maxH
		if maxH == nil then maxH = 560 end
		if (Js.T(size.h) and (size.h > 0)) then
			do return Js.O({ cssW = baseW, cssH = size.h }, { "cssW", "cssH" }) end
		end
		local turned = (frameFacing(frame) ~= "up")
		local spanX = (frame.camera.x2 - frame.camera.x1)
		local spanY = (frame.camera.y2 - frame.camera.y1)
		local vpW = (if turned then spanY else spanX)
		local vpH = (if turned then spanX else spanY)
		local cssW = baseW
		local cssH = Math.round(((baseW * vpH) / vpW))
		if (cssH > maxH) then
			cssH = maxH
			cssW = Math.round(((maxH * vpW) / vpH))
		end
		if (cssW > maxW) then
			cssW = maxW
			cssH = Math.round(((maxW * vpH) / vpW))
		end
		do return Js.O({ cssW = cssW, cssH = cssH }, { "cssW", "cssH" }) end
	end
	exports.frameCssSize = frameCssSize
	frameFacing = function(frame)
		local f = frame.facing
		if ((f ~= "left") and (f ~= "right")) then
			do return "up" end
		end
		local c = frame.camera
		do return (if ((c.x2 - c.x1) > (c.y2 - c.y1)) then f else "up") end
	end
	exports.frameFacing = frameFacing
	frameScreen = function(frame, cssW, cssH)
		local vp = frame.camera
		local spanX = (vp.x2 - vp.x1)
		local spanY = (vp.y2 - vp.y1)
		local facing = frameFacing(frame)
		if (facing == "up") then
			local p = M_render.projectionFor(frame.rules, cssW, cssH, vp)
			do return Js.O({ facing = facing, cssW = cssW, cssH = cssH, unit = p.unit, toScreen = function(v)
				return Js.O({ x = p.px(v.x), y = p.py(v.y) }, { "x", "y" })
			end, toWorld = function(sx, sy)
				return Js.O({ x = (((sx / cssW) * spanX) + vp.x1), y = (((sy / cssH) * spanY) + vp.y1) }, { "x", "y" })
			end }, { "facing", "cssW", "cssH", "unit", "toScreen", "toWorld" }) end
		end
		local right = (facing == "right")
		do return Js.O({ facing = facing, cssW = cssW, cssH = cssH, unit = Math.min((cssH / spanX), (cssW / spanY)), toScreen = function(v)
			local fx = ((v.x - vp.x1) / spanX)
			local fy = ((v.y - vp.y1) / spanY)
			do return (if right then Js.O({ x = ((1 - fy) * cssW), y = (fx * cssH) }, { "x", "y" }) else Js.O({ x = (fy * cssW), y = ((1 - fx) * cssH) }, { "x", "y" })) end
		end, toWorld = function(sx, sy)
			local u = (sx / cssW)
			local w = (sy / cssH)
			local fx = (if right then w else (1 - w))
			local fy = (if right then (1 - u) else u)
			do return Js.O({ x = ((fx * spanX) + vp.x1), y = ((fy * spanY) + vp.y1) }, { "x", "y" }) end
		end }, { "facing", "cssW", "cssH", "unit", "toScreen", "toWorld" }) end
	end
	exports.frameScreen = frameScreen
	pointProjection = function(at, unit, W, H)
		do return Js.O({ px = function()
			return at.x
		end, py = function()
			return at.y
		end, unit = unit, W = W, H = H }, { "px", "py", "unit", "W", "H" }) end
	end
	lookInKit = function(it, kits)
		if (not kits) then
			do return it.look end
		end
		local kit = (if it.keeper then kits.keeper else (if (it.side == "opponent") then kits.theirs else kits.ours))
		do return Js.ospread(it.look, Js.O({ shirt = kit.shirt, shorts = kit.trim, trim = kit.trim }, { "shirt", "shorts", "trim" })) end
	end
	exports.lookInKit = lookInKit
	paint = function(canvas, frame, size, kits)
		if size == nil then size = Js.O({}, nil) end
		local _d2 = frameCssSize(frame, size)
		local cssW = _d2.cssW
		local cssH = _d2.cssH
		local dpr = (if (Js.window ~= nil) then Math.min(2, (if Js.T(Js.window.devicePixelRatio) then Js.window.devicePixelRatio else 1)) else 1)
		canvas.width = Math.round((cssW * dpr))
		canvas.height = Math.round((cssH * dpr))
		canvas.style.width = (Js.numstr(cssW) .. "px")
		canvas.style.height = (Js.numstr(cssH) .. "px")
		local ctx = canvas.getContext("2d")
		if (not ctx) then
			do return end
		end
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		local scr = frameScreen(frame, cssW, cssH)
		local offY = computeOffside(frame)
		local matchGoal = ((frame.goalAtY == 0) and (frame.rules == M_rules.ELEVEN_A_SIDE_ATTACK))
		local drawTheMatchGoal = function()
			local spanX = (frame.camera.x2 - frame.camera.x1)
			local spanY = (frame.camera.y2 - frame.camera.y1)
			local turned = (scr.facing ~= "up")
			local unit = (if turned then (cssH / spanX) else (cssW / spanX))
			local heightScale = (if turned then (cssW / spanY) else (cssH / spanY))
			M_matchGoal.drawMatchGoal(ctx, function(x, y)
				local s = scr.toScreen(Js.O({ x = x, y = y }, { "x", "y" }))
				do return Js.O({ px = s.x, py = s.y }, { "px", "py" }) end
			end, unit, heightScale)
		end
		if (scr.facing == "up") then
			local p = M_render.projectionFor(frame.rules, cssW, cssH, frame.camera)
			M_render.drawPitch(ctx, frame.rules, p)
			if matchGoal then
				drawTheMatchGoal()
			elseif (frame.goalAtY ~= nil) then
				M_render.drawGoal(ctx, frame.rules, p, frame.goalAtY)
			end
			if (offY ~= nil) then
				drawOffsideLine(ctx, p, cssW, offY)
			end
		else
			local turn = function()
				if (scr.facing == "right") then
					ctx.transform(0, 1, -1, 0, cssW, 0)
				else
					ctx.transform(0, -1, 1, 0, 0, cssH)
				end
			end
			local plan = M_render.projectionFor(frame.rules, cssH, cssW, frame.camera)
			ctx.save()
			turn()
			M_render.drawPitch(ctx, frame.rules, plan)
			if ((not matchGoal) and (frame.goalAtY ~= nil)) then
				M_render.drawGoal(ctx, frame.rules, plan, frame.goalAtY)
			end
			ctx.restore()
			if matchGoal then
				drawTheMatchGoal()
			end
			if (offY ~= nil) then
				ctx.save()
				turn()
				drawOffsideLine(ctx, plan, cssH, offY)
				ctx.restore()
			end
		end
		local at = function(v)
			return pointProjection(scr.toScreen(v), scr.unit, cssW, cssH)
		end
		local layers = A.map(frame.items, function(it)
			return Js.O({ y = scr.toScreen(it.at).y, draw = function()
				local look = lookInKit(it, kits)
				if it.keeper then
					M_render.drawKeeper(ctx, at(it.at), it.at, look, Js.O({ dive = 0, lunge = 0 }, { "dive", "lunge" }), FACE, FAKE, Js.O({ scale = (PICTURE_KEEPER_SCALE * ((function() local _v = frame.sizes; if _v == nil then return nil end; _v = _v.keeper; return _v end)() or 1)) }, { "scale" }))
				else
					M_render.drawFigure(ctx, at(it.at), it.at, look, FACE, FAKE, Js.O({ scale = (PICTURE_SCALE * ((function() local _v = frame.sizes; if _v == nil then return nil end; _v = _v.figure; return _v end)() or 1)) }, { "scale" }))
				end
			end }, { "y", "draw" })
		end)
		A.push(layers, Js.O({ y = scr.toScreen(frame.ball).y, draw = function()
			return M_render.drawBall(ctx, at(frame.ball), frame.ball, 0, (PICTURE_SCALE * ((function() local _v = frame.sizes; if _v == nil then return nil end; _v = _v.ball; return _v end)() or 1)))
		end }, { "y", "draw" }))
		A.forEach(A.sort(A.map(layers, function(l, i)
			return Js.O({ l = l, i = i }, { "l", "i" })
		end), function(a, b)
			return (function() local _l = (a.l.y - b.l.y); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
		end), function(_p3)
			local l = _p3.l
			return l.draw()
		end)
	end
	exports.paint = paint
	drawOffsideLine = function(ctx, p, w, y)
		local yy = p.py(y)
		ctx.save()
		ctx.strokeStyle = "rgba(250, 204, 21, 0.9)"
		ctx.lineWidth = 1.5
		ctx.setLineDash(Js.alit(6, 5))
		ctx.beginPath()
		ctx.moveTo(0, yy)
		ctx.lineTo(w, yy)
		ctx.stroke()
		ctx.setLineDash(Js.alit())
		ctx.restore()
	end
	exports.drawOffsideLine = drawOffsideLine
	paintMarked = function(canvas, frame, marks, size, kits)
		if size == nil then size = Js.O({}, nil) end
		paint(canvas, frame, size, kits)
		if (not Js.T(Js.alen(marks))) then
			do return end
		end
		local ctx = canvas.getContext("2d")
		if (not ctx) then
			do return end
		end
		local _d4 = frameCssSize(frame, size)
		local cssW = _d4.cssW
		local cssH = _d4.cssH
		local scr = frameScreen(frame, cssW, cssH)
		local r = Math.max(7, (scr.unit * HIT_FIGURE_R))
		ctx.save()
		do
			local _arr5 = marks
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local m = _arr5[_i6]
				local s = scr.toScreen(m.at)
				local x = s.x
				local y = (if m.ball then s.y else (s.y - (r * HIT_BODY_UP)))
				local rad = (if m.ball then Math.max(11, (r * 0.75)) else (r * 1.35))
				ctx.beginPath()
				ctx.arc(x, y, rad, 0, (Math.PI * 2))
				ctx.lineWidth = 3
				ctx.strokeStyle = MARK_INK[m.tone]
				ctx.stroke()
				ctx.beginPath()
				ctx.arc(x, y, (rad + 2.5), 0, (Math.PI * 2))
				ctx.lineWidth = 1
				ctx.strokeStyle = "rgba(0,0,0,0.55)"
				ctx.stroke()
			end
		end
		ctx.restore()
	end
	exports.paintMarked = paintMarked
	attackersOf = function(sc)
		local out = Js.alit()
		if sc.runner then
			A.push(out, sc.runner.pos)
		end
		do
			local _arr7 = sc.secondaryRunners
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local r = _arr7[_i8]
				A.push(out, r.pos)
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(out, Js.O({ x = sc.follower.x, y = sc.follower.y }, { "x", "y" }))
		end
		do return out end
	end
	exports.attackersOf = attackersOf
	marksForFaults = function(sc, faults, tone)
		local out = Js.alit()
		local ballMark = function()
			return Js.O({ at = Js.ospread(sc.ball), ball = true, tone = tone }, { "at", "ball", "tone" })
		end
		do
			local _arr9 = faults
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local f = _arr9[_i10]
				if (f == "attacker offside") then
					local line = M_baseScenario.offsideLineOf(sc)
					if (line ~= nil) then
						do
							local _arr11 = attackersOf(sc)
							local _i12 = 0
							while _i12 < Js.alen(_arr11) do
								_i12 += 1
								local a = _arr11[_i12]
								if (a.y < (line - 0.01)) then
									A.push(out, Js.O({ at = Js.O({ x = a.x, y = a.y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
								end
							end
						end
					end
					do continue end
				end
				if (f == "defender behind his own keeper") then
					do
						local _arr13 = sc.defenders
						local _i14 = 0
						while _i14 < Js.alen(_arr13) do
							_i14 += 1
							local d = _arr13[_i14]
							if (d.y < sc.keeper.y) then
								A.push(out, Js.O({ at = Js.O({ x = d.x, y = d.y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							end
						end
					end
					do continue end
				end
				if (f == "11m+ hole in the line") then
					local deepest = Math.min(Js.unpack(A.map(sc.defenders, function(d)
						return d.y
					end)))
					local line = A.sort(A.filter(sc.defenders, function(d)
						return ((d.y - deepest) <= 4)
					end), function(a, b)
						return (a.x - b.x)
					end)
					for i = 1, (Js.alen(line)) - 1 do
						if ((line[i + 1].x - line[i].x) > 11) then
							A.push(out, Js.O({ at = Js.O({ x = line[i].x, y = line[i].y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							A.push(out, Js.O({ at = Js.O({ x = line[i + 1].x, y = line[i + 1].y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							do break end
						end
					end
					do continue end
				end
				if S.startsWith(f, "not a one-on-one") then
					do
						local _arr15 = sc.defenders
						local _i16 = 0
						while _i16 < Js.alen(_arr15) do
							_i16 += 1
							local d = _arr15[_i16]
							if ((d.y < (sc.ball.y - 0.5)) and (math.abs((d.x - M_pitch.CX)) <= 14)) then
								A.push(out, Js.O({ at = Js.O({ x = d.x, y = d.y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							end
						end
					end
					do continue end
				end
				if (f == "defender piled on the ball") then
					do
						local _arr17 = sc.defenders
						local _i18 = 0
						while _i18 < Js.alen(_arr17) do
							_i18 += 1
							local d = _arr17[_i18]
							if (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < 1.4) then
								A.push(out, Js.O({ at = Js.O({ x = d.x, y = d.y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							end
						end
					end
					do continue end
				end
				if (f == "defender standing on you") then
					do
						local _arr19 = sc.defenders
						local _i20 = 0
						while _i20 < Js.alen(_arr19) do
							_i20 += 1
							local d = _arr19[_i20]
							if (Math.hypot((d.x - sc.player.x), (d.y - sc.player.y)) < 1.2) then
								A.push(out, Js.O({ at = Js.O({ x = d.x, y = d.y }, { "x", "y" }), tone = tone }, { "at", "tone" }))
							end
						end
					end
					do continue end
				end
				if (f == "you are off screen") then
					A.push(out, Js.O({ at = Js.ospread(sc.player), tone = tone }, { "at", "tone" }))
					do continue end
				end
				if ((f == "the pass target is off screen") and sc.runner) then
					A.push(out, Js.O({ at = Js.ospread(sc.runner.pos), tone = tone }, { "at", "tone" }))
					do continue end
				end
				A.push(out, ballMark())
			end
		end
		do return out end
	end
	exports.marksForFaults = marksForFaults
	splitFaults = function(kind, faults)
		local out = Js.alit()
		local intended = Js.alit()
		do
			local _arr21 = faults
			local _i22 = 0
			while _i22 < Js.alen(_arr21) do
				_i22 += 1
				local f = _arr21[_i22]
				if ((kind == "through_ball") and (f == "attacker offside")) then
					A.push(intended, f)
				else
					A.push(out, f)
				end
			end
		end
		do return Js.O({ faults = out, intended = intended }, { "faults", "intended" }) end
	end
	exports.splitFaults = splitFaults
	YOU = Js.O({ shirt = "#1d4ed8", shorts = "#1e3a8a", trim = "#ffffff" }, { "shirt", "shorts", "trim" })
	exports.YOU = YOU
	OPP = Js.O({ shirt = "#dc2626", shorts = "#7f1d1d", trim = "#ffffff" }, { "shirt", "shorts", "trim" })
	exports.OPP = OPP
	KEEP = Js.O({ shirt = "#16a34a", shorts = "#14532d", trim = "#ffffff" }, { "shirt", "shorts", "trim" })
	exports.KEEP = KEEP
	MATE = Js.O({ shirt = "#3b82f6", shorts = "#1e3a8a", trim = "#ffffff" }, { "shirt", "shorts", "trim" })
	exports.MATE = MATE
	FACE = M_faceStyle.DEFAULT_FACE_STYLE
	exports.FACE = FACE
	FAKE = M_fakeFaceStyle.DEFAULT_FAKE_FACE_STYLE
	exports.FAKE = FAKE
	idLabel = function(who, fallback)
		return (((function() local _v = who; if _v == nil then return nil end; _v = _v.shortName; return _v end)() or (function() local _v = who; if _v == nil then return nil end; _v = _v.name; return _v end)()) or fallback)
	end
	exports.idLabel = idLabel
	PICTURE_SCALE = M_render.MATCH_SCALE
	exports.PICTURE_SCALE = PICTURE_SCALE
	PICTURE_KEEPER_SCALE = M_render.MATCH_KEEPER_SCALE
	exports.PICTURE_KEEPER_SCALE = PICTURE_KEEPER_SCALE
	HIT_FIGURE_R = (1.05 * PICTURE_SCALE)
	exports.HIT_FIGURE_R = HIT_FIGURE_R
	HIT_BODY_UP = 0.67
	exports.HIT_BODY_UP = HIT_BODY_UP
	MARK_INK = Js.O({ red = "rgba(239,68,68,0.95)", amber = "rgba(245,158,11,0.95)", select = "rgba(56,189,248,0.98)" }, { "red", "amber", "select" })
	exports.MARK_INK = MARK_INK
end
