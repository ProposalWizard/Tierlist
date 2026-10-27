--!nocheck
--!nolint
-- Generated from lib/star/goalFrame.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_pitch = import("lib/star/pitch")
	local M_render = import("lib/star/fiveASide/render")
	local GOAL_TOP_Y, FRAME_TOP_FOR_GOAL, POST_MARGIN, THUMB_FRAC_W, ZOOM_MAX_H, INSET, BALL_SIDE_NEED, clamp, onPitchBody, ROOM_FOR_POWER, pullLenM, roomShare, inside, mustHold, pullInside, NONE, naturalTargets, pullBox, placeSideways, placeForPull, frameOf, finishServedFrame, FIGURE_DRAWN_H, TOP_AIR, FEET_AIR, inPenaltyArea, turnedMustShow, finishTurnedFrame
	pullLenM = function(frameH)
		do return (M_canvasEngine.dragForFullPower(ROOM_FOR_POWER) * frameH) end
	end
	exports.pullLenM = pullLenM
	roomShare = function()
		do return (M_canvasEngine.dragForFullPower(ROOM_FOR_POWER) + (THUMB_FRAC_W * M_canvasEngine.VIEW_ASPECT)) end
	end
	exports.roomShare = roomShare
	mustHold = function(sc)
		local out = Js.alit(sc.player)
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(out, sc.keeper, sc.follower)
		end
		do
			local _arr1 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local r = _arr1[_i2]
				A.push(out, r.pos, r.to)
				if r.commandedTo then
					A.push(out, r.commandedTo)
				end
			end
		end
		do return A.filter(out, onPitchBody) end
	end
	pullInside = function(sc, before, after)
		local moved = 0
		local fx = function(x)
			return clamp(x, (after.x1 + INSET), (after.x2 - INSET))
		end
		local fy = function(y)
			return clamp(y, Math.max((after.y1 + INSET), 0.3), (after.y2 - INSET))
		end
		do
			local _arr3 = mustHold(sc)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				if (inside(p, before) and (not inside(p, after))) then
					p.x = fx(p.x)
					p.y = fy(p.y)
					moved += 1
				end
			end
		end
		if (Js.T(moved) and sc.runner) then
			sc.passTarget = Js.O({ x = sc.runner.to.x, y = sc.runner.to.y }, { "x", "y" })
		end
		do return moved end
	end
	naturalTargets = function(sc)
		local shoot = (((((((sc.kind == "one_on_one") or (sc.kind == "tight_angle")) or (sc.kind == "long_range")) or (sc.kind == "volley")) or (sc.kind == "header")) or (sc.kind == "free_kick")) or (sc.kind == "penalty"))
		local posts = Js.alit(Js.O({ x = (M_pitch.POST_L + 0.4), y = 0 }, { "x", "y" }), Js.O({ x = ((M_pitch.POST_L + M_pitch.POST_R) / 2), y = 0 }, { "x", "y" }), Js.O({ x = (M_pitch.POST_R - 0.4), y = 0 }, { "x", "y" }))
		if shoot then
			do return posts end
		end
		if sc.passTarget then
			do return Js.alit(sc.passTarget) end
		end
		if sc.runner then
			do return Js.alit(sc.runner.to) end
		end
		do return Js.alit(Js.O({ x = ((M_pitch.POST_L + M_pitch.POST_R) / 2), y = 0 }, { "x", "y" })) end
	end
	exports.naturalTargets = naturalTargets
	pullBox = function(sc, w, h)
		local L = pullLenM(h)
		local thumb = (THUMB_FRAC_W * w)
		local lo = math.huge
		local hi = (-math.huge)
		local top = math.huge
		local bot = (-math.huge)
		do
			local _arr5 = naturalTargets(sc)
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local t = _arr5[_i6]
				local dx = (sc.ball.x - t.x)
				local dy = (sc.ball.y - t.y)
				local d = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
				local ex = (sc.ball.x + ((dx / d) * L))
				local ey = (sc.ball.y + ((dy / d) * L))
				lo = Math.min(lo, (ex - thumb))
				hi = Math.max(hi, (ex + thumb))
				top = Math.min(top, (ey - thumb))
				bot = Math.max(bot, (ey + thumb))
			end
		end
		do return Js.O({ lo = lo, hi = hi, top = top, bot = bot }, { "lo", "hi", "top", "bot" }) end
	end
	placeSideways = function(sc, x1, w)
		x1 = Math.min(x1, (M_pitch.POST_L - POST_MARGIN))
		x1 = Math.max(x1, ((M_pitch.POST_R + POST_MARGIN) - w))
		do return clamp(x1, ((sc.ball.x + BALL_SIDE_NEED) - w), (sc.ball.x - BALL_SIDE_NEED)) end
	end
	placeForPull = function(sc, v)
		local w = (v.x2 - v.x1)
		local h = (v.y2 - v.y1)
		local pb = pullBox(sc, w, h)
		local x1 = v.x1
		local y1 = v.y1
		if (pb.hi > (x1 + w)) then
			x1 = (pb.hi - w)
		end
		if (pb.lo < x1) then
			x1 = pb.lo
		end
		x1 = placeSideways(sc, x1, w)
		if (pb.top < y1) then
			y1 = Math.max(pb.top, (Math.min(pb.bot, (y1 + h)) - h), ((sc.player.y + INSET) - h))
		end
		y1 = Math.min(y1, FRAME_TOP_FOR_GOAL)
		local nv = Js.O({ x1 = x1, x2 = (x1 + w), y1 = y1, y2 = (y1 + h) }, { "x1", "x2", "y1", "y2" })
		local fits = (((pb.lo >= (nv.x1 - 0.000001)) and (pb.hi <= (nv.x2 + 0.000001))) and (pb.top >= (nv.y1 - 0.000001)))
		do return Js.O({ v = nv, fits = fits }, { "v", "fits" }) end
	end
	frameOf = function(sc, cx, y1, H)
		local W = (H * M_canvasEngine.VIEW_ASPECT)
		local x1 = placeSideways(sc, (cx - (W / 2)), W)
		do return Js.O({ x1 = x1, x2 = (x1 + W), y1 = y1, y2 = (y1 + H) }, { "x1", "x2", "y1", "y2" }) end
	end
	finishServedFrame = function(sc)
		local vp0 = sc.viewport
		if (not vp0) then
			do return NONE(0) end
		end
		local h0 = (vp0.y2 - vp0.y1)
		local rep = NONE(h0)
		local turned = ((if sc.facing ~= nil then sc.facing else "up") ~= "up")
		if turned then
			finishTurnedFrame(sc, rep)
			do return rep end
		end
		if (not M_canvasEngine.goalInView(sc.kind)) then
			do return rep end
		end
		local before = Js.ospread(vp0)
		local v = Js.ospread(vp0)
		local k = roomShare()
		local lowNeed = function(H)
			return Math.max((sc.ball.y + (k * H)), (sc.player.y + INSET))
		end
		do
			local h = (v.y2 - v.y1)
			local cx = ((v.x1 + v.x2) / 2)
			local y1 = Math.min(v.y1, FRAME_TOP_FOR_GOAL)
			if ((y1 + h) < lowNeed(h)) then
				y1 = Math.min(FRAME_TOP_FOR_GOAL, (lowNeed(h) - h))
			end
			rep.slidUp = (v.y1 - y1)
			local H = h
			if ((y1 + H) < (lowNeed(H) - 0.000001)) then
				local needBall = ((sc.ball.y - y1) / (1 - k))
				local needYou = ((sc.player.y + INSET) - y1)
				H = Math.max(H, needBall, needYou)
			end
			if (H > (h + 0.000001)) then
				v = frameOf(sc, cx, y1, H)
			else
				local w = (v.x2 - v.x1)
				local x1 = placeSideways(sc, v.x1, w)
				v = Js.O({ x1 = x1, x2 = (x1 + w), y1 = y1, y2 = (y1 + h) }, { "x1", "x2", "y1", "y2" })
			end
			rep.goalZoomH = (v.y2 - v.y1)
		end
		do
			local x0 = v.x1
			local placed = placeForPull(sc, v)
			if (not placed.fits) then
				local h = (v.y2 - v.y1)
				local cx = ((v.x1 + v.x2) / 2)
				local cap = Math.max(ZOOM_MAX_H, h)
				do
					local H = (h + 0.5)
					local _first7 = true
					while true do
						if not _first7 then
							H += 0.5
						end
						_first7 = false
						if not (H <= (cap + 0.000001)) then break end
						local trial = placeForPull(sc, frameOf(sc, cx, v.y1, H))
						placed = trial
						if trial.fits then
							do break end
						end
					end
				end
			end
			rep.slidSide = (placed.v.x1 - x0)
			rep.pullShort = (not placed.fits)
			v = placed.v
		end
		rep.zoomH = (v.y2 - v.y1)
		sc.viewport = v
		rep.movedIn = pullInside(sc, before, v)
		do return rep end
	end
	exports.finishServedFrame = finishServedFrame
	turnedMustShow = function(sc)
		local all = Js.aspread(Js.alit(sc.player, sc.keeper, sc.follower), sc.teammates, sc.defenders)
		do
			local _arr8 = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), sc.secondaryRunners)
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local r = _arr8[_i9]
				A.push(all, r.pos, r.to)
			end
		end
		local box = A.filter(all, function(p)
			return (onPitchBody(p) and inPenaltyArea(p))
		end)
		do return A.filter(Js.aspread(box, mustHold(sc)), onPitchBody) end
	end
	finishTurnedFrame = function(sc, rep)
		local v = sc.viewport
		local right = (sc.facing == "right")
		local s = function(x)
			return (if right then x else (-x))
		end
		local H0 = (v.x2 - v.x1)
		local T = (if right then v.x1 else (-v.x2))
		local H = H0
		local k = roomShare()
		local show = turnedMustShow(sc)
		local topPost = (if right then M_pitch.POST_L else M_pitch.POST_R)
		local top = ((s(topPost) - M_pitch.GOAL_H) - TOP_AIR)
		do
			local _arr10 = show
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local p = _arr10[_i11]
				top = Math.min(top, ((s(p.x) - FIGURE_DRAWN_H) - TOP_AIR))
			end
		end
		local feet = (s(sc.ball.x) + 0.3)
		do
			local _arr12 = show
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local p = _arr12[_i13]
				feet = Math.max(feet, (s(p.x) + FEET_AIR))
			end
		end
		local bottom = function(h)
			return Math.max((s(sc.ball.x) + (k * h)), feet)
		end
		local across = (sc.ball.y + BALL_SIDE_NEED)
		do
			local _arr14 = show
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local p = _arr14[_i15]
				across = Math.max(across, (p.y + FEET_AIR))
			end
		end
		H = Math.max(H, ((across - v.y1) / M_canvasEngine.VIEW_ASPECT))
		if ((top + H) < (bottom(H) - 1e-9)) then
			H = Math.max(H, ((s(sc.ball.x) - top) / (1 - k)), (feet - top))
		end
		local lo = (bottom(H) - H)
		local hi = top
		T = clamp(T, Math.min(lo, hi), hi)
		local x1 = (if right then T else (-(T + H)))
		local nv = Js.O({ x1 = x1, x2 = (x1 + H), y1 = v.y1, y2 = (v.y1 + (H * M_canvasEngine.VIEW_ASPECT)) }, { "x1", "x2", "y1", "y2" })
		rep.slidUp = (if right then (v.x1 - nv.x1) else (nv.x2 - v.x2))
		rep.zoomH = H
		rep.goalZoomH = rep.zoomH
		sc.viewport = nv
	end
	GOAL_TOP_Y = (-(M_pitch.NET_DEPTH + M_pitch.GOAL_H))
	exports.GOAL_TOP_Y = GOAL_TOP_Y
	FRAME_TOP_FOR_GOAL = -3.7
	exports.FRAME_TOP_FOR_GOAL = FRAME_TOP_FOR_GOAL
	POST_MARGIN = 0.5
	exports.POST_MARGIN = POST_MARGIN
	THUMB_FRAC_W = (16 / 366)
	exports.THUMB_FRAC_W = THUMB_FRAC_W
	ZOOM_MAX_H = 48
	exports.ZOOM_MAX_H = ZOOM_MAX_H
	INSET = 1.4
	BALL_SIDE_NEED = 2.2
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	onPitchBody = function(p)
		return ((((p.x > -100) and (p.x < (M_pitch.PITCH_W + 100))) and (p.y > -100)) and (p.y < 200))
	end
	ROOM_FOR_POWER = 55
	exports.ROOM_FOR_POWER = ROOM_FOR_POWER
	inside = function(p, v)
		return ((((p.x >= v.x1) and (p.x <= v.x2)) and (p.y >= v.y1)) and (p.y <= v.y2))
	end
	NONE = function(h)
		return Js.O({ slidUp = 0, goalZoomH = h, slidSide = 0, zoomH = h, movedIn = 0, pullShort = false }, { "slidUp", "goalZoomH", "slidSide", "zoomH", "movedIn", "pullShort" })
	end
	FIGURE_DRAWN_H = (M_render.MATCH_FIGURE_R_MULT * M_render.MATCH_FIGURE_HEIGHT_R)
	exports.FIGURE_DRAWN_H = FIGURE_DRAWN_H
	TOP_AIR = 0.4
	FEET_AIR = 0.8
	inPenaltyArea = function(p)
		return ((((p.x >= (M_pitch.BOX_L - 1)) and (p.x <= (M_pitch.BOX_R + 1))) and (p.y >= -1)) and (p.y <= (M_pitch.BOX_DEPTH + 1)))
	end
end
