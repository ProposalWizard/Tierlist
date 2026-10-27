--!nocheck
--!nolint
-- Generated from lib/star/matchView.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local M_pitch = import("lib/star/pitch")
	local M_cameraTilt = import("lib/star/cameraTilt")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_chanceFraming = import("lib/star/chanceFraming")
	local M_wideChances = import("lib/star/wideChances")
	local M_render = import("lib/star/fiveASide/render")
	local MATCH_VIEW_DEFAULT, MATCH_VIEW_KEY, override, stored, listeners, readStored, matchView, storedMatchView, setMatchView, setMatchViewOverride, subscribe, useStoredMatchView, NEW_VIEW_WIDTH_M, NEW_VIEW_MAX_HW, NEW_VIEW_MIN_HW, NEW_FIGURE_SCALE, NEW_OUTFIELD_SHRINK, NEW_KEEPER_GROW, NEW_BALL_SCALE, FIGURES_AT_FULL_VIEW, figureShrinkFor, figureGrowOverride, setFigureGrowOverride, figureGrow, FIXED_FIGURES, REFERENCE_CAMERA_M, MAN_M_UNZOOMED, FIXED_MAN_M, figureDivFor, BEHIND_GOAL_M, BOTTOM_ROOM_M, EDGE_M, TURNED_FAR_M, TURNED_NEAR_M, TURNED_BALL_DOWN, NEW_VIEW_KIND_WIDTH_M, NEW_VIEW_CROSS_CUT_WIDTH_M, PASSERS_MIN_M, PASSERS_SIDE_M, PASSERS_END_M, PASSERS_LANE_M, acrossFor, distToSegment, passersOf, passersCamera, PASSERS_FIT_SIDE_M, PASSERS_FIT_END_M, PASSERS_FIT_MIN_M, PASSERS_FIT_OUT_M, PASSERS_FIT_MAX_M, halfCut, passersFit, passersCameraFor, newViewCamera, actionFitOverride, setActionFit, actionFitOn, engineFrameOf, frameForNewView, AIR_MIN_ACROSS_M
	local playZoomOverride, playZoom, setPlayZoomOverride, probe, playZoomProbe, playZoomOf, ZOOM_ROOM_M, ZOOM_SIDE_M, ZOOM_TOP_M, ZOOM_MAX, ZOOM_MIN_PULL_M, onThePitch, bodiesOf, CROWD_NEAR_M, CROWD_MIN, CROWD_FRAME_M, CROWD_KINDS, isCrowdedChance, framedBodiesOf, framedKeyPointsOf, zoomToPlay, zoomView, fitToPlay, ACTION_BALL_M, ACTION_MATE_M, ACTION_MARK_M, ACTION_LANE_M, actionOf, framingPromise, WHOLLY_ON_EDGE, CLEARLY_OFF_EDGE, DRAG_ROOM_SHARE, dragRoomCamera, framingFaults, ACTION_ROOM_M, fitAction, WIDE_TURN_KINDS, SIDE_BEHIND_M, SIDE_DEPTH_ROOM_M, SIDE_EDGE_ROOM_M, SIDE_PULL_SHARE, SIDE_MIN_ACROSS_M, turnsSideOn, turnWideChance, sideOnFacing, sideOnCamera, cameraFor, playAreaFor, crossCutCamera, newViewCanvasHeight, keyPointsOf, TILT_FIT_MAX, TILT_FIT_MARGIN, fracOf, fitCameraToTilt, FRAMING_V2_KEY, framingV2Override, framingV2Listeners, setFramingV2Override, framingV2On
	local setFramingV2, useFramingV2, V2_BEHIND_MIN_M, V2_BEHIND_MAX_SHARE, V2_MIN_ACROSS_M, V2_BALL_ROOM, V2_ROOM_M, V2_DEFENDER_NEAR_M, V2_WIDE_M, V2_SIDE_MAX_Y, framingV2Points, framingV2Camera, v2OnGlass, framingV2TurnsSideOn, hasRunupFree
	readStored = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, nil end
			end
			local v = Js.localStorage.getItem(MATCH_VIEW_KEY)
			do return Js.RET, (if ((v == "new") or (v == "classic")) then v else nil) end
		end)
		if not _ok1 then
			do return nil end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	matchView = function()
		do return (if override ~= nil then override else MATCH_VIEW_DEFAULT) end
	end
	exports.matchView = matchView
	storedMatchView = function()
		do return "new" end
	end
	exports.storedMatchView = storedMatchView
	setMatchView = function(v)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(MATCH_VIEW_KEY, v)
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
		stored = v
		listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setMatchView = setMatchView
	setMatchViewOverride = function(v)
		local before = override
		override = v
		listeners:forEach(function(f)
			return f()
		end)
		do return function()
			override = before
			listeners:forEach(function(f)
				return f()
			end)
		end end
	end
	exports.setMatchViewOverride = setMatchViewOverride
	subscribe = function(f)
		listeners:add(f)
		do return function()
			listeners:delete(f)
		end end
	end
	useStoredMatchView = function()
		do return M_react.useSyncExternalStore(subscribe, storedMatchView, function()
			return MATCH_VIEW_DEFAULT
		end) end
	end
	exports.useStoredMatchView = useStoredMatchView
	figureShrinkFor = function(kind, across)
		if ((not A.includes(FIGURES_AT_FULL_VIEW, kind)) or (not (across > 0))) then
			do return 1 end
		end
		do return Math.min(1, (across / NEW_VIEW_WIDTH_M)) end
	end
	exports.figureShrinkFor = figureShrinkFor
	setFigureGrowOverride = function(g)
		figureGrowOverride = (if (Js.T(g) and (g > 0)) then g else 1)
	end
	exports.setFigureGrowOverride = setFigureGrowOverride
	figureGrow = function()
		do return figureGrowOverride end
	end
	exports.figureGrow = figureGrow
	figureDivFor = function(zoom, shrink)
		if FIXED_FIGURES then
			do return (MAN_M_UNZOOMED / FIXED_MAN_M) end
		end
		do return ((if ((playZoom() == "z2") or (playZoom() == "z2max")) then zoom else 1) / shrink) end
	end
	exports.figureDivFor = figureDivFor
	acrossFor = function(kind, engine, facing)
		local want = (if NEW_VIEW_KIND_WIDTH_M[kind] ~= nil then NEW_VIEW_KIND_WIDTH_M[kind] else NEW_VIEW_WIDTH_M)
		if (want == "passers") then
			do return want end
		end
		local engineAcross = (if (facing == "up") then (engine.x2 - engine.x1) else (engine.y2 - engine.y1))
		do return Math.min(NEW_VIEW_WIDTH_M, Math.max(want, (engineAcross + 0.5))) end
	end
	distToSegment = function(p, a, b)
		local dx = (b.x - a.x)
		local dy = (b.y - a.y)
		local l2 = ((dx * dx) + (dy * dy))
		local t = (if (l2 > 0) then Math.max(0, Math.min(1, ((((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / l2))) else 0)
		do return Math.hypot((p.x - (a.x + (t * dx))), (p.y - (a.y + (t * dy)))) end
	end
	passersOf = function(sc)
		local pts = Js.alit(sc.ball, sc.player)
		local runners = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit()))
		do
			local _arr7 = runners
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local r = _arr7[_i8]
				A.push(pts, r.pos, r.to)
			end
		end
		local lanes = A.flatMap(runners, function(r)
			return Js.alit(Js.alit(sc.ball, r.pos), Js.alit(sc.ball, r.to))
		end)
		do
			local _arr9 = sc.defenders
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local d = _arr9[_i10]
				if ((Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) <= PASSERS_LANE_M) or A.some(lanes, function(_p11)
					local a = _p11[1]
					local b = _p11[2]
					return (distToSegment(d, a, b) <= PASSERS_LANE_M)
				end)) then
					A.push(pts, d)
				end
			end
		end
		do return pts end
	end
	exports.passersOf = passersOf
	passersCamera = function(pts, facing, hw)
		local xs = A.map(pts, function(p)
			return p.x
		end)
		local ys = A.map(pts, function(p)
			return p.y
		end)
		local x1 = Math.min(Js.unpack(xs))
		local x2 = Math.max(Js.unpack(xs))
		local y1 = Math.min(Js.unpack(ys))
		local y2 = Math.max(Js.unpack(ys))
		local h = Math.max(NEW_VIEW_MIN_HW, hw)
		local cx = ((x1 + x2) / 2)
		local cy = ((y1 + y2) / 2)
		if (facing == "up") then
			local across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M, ((x2 - x1) + (2 * PASSERS_SIDE_M)), (((y2 - y1) + (2 * PASSERS_END_M)) / h)))
			local down = (across * h)
			local vx1 = (cx - (across / 2))
			vx1 = Math.max((-EDGE_M), Math.min(((M_pitch.PITCH_W + EDGE_M) - across), vx1))
			do return Js.O({ x1 = vx1, x2 = (vx1 + across), y1 = (cy - (down / 2)), y2 = (cy + (down / 2)) }, { "x1", "x2", "y1", "y2" }) end
		end
		local across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M, ((y2 - y1) + (2 * PASSERS_SIDE_M)), (((x2 - x1) + (2 * PASSERS_END_M)) / h)))
		local down = (across * h)
		do return Js.O({ x1 = (cx - (down / 2)), x2 = (cx + (down / 2)), y1 = (cy - (across / 2)), y2 = (cy + (across / 2)) }, { "x1", "x2", "y1", "y2" }) end
	end
	halfCut = function(sc, v, H, tiltDeg)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, H)
		do return A.some(bodiesOf(sc), function(p)
			local c = fracOf(v, "up", p)
			local g = M_cameraTilt.canvasToScreen(t, c.sx, c.sy, 1, H)
			local inside = Math.min(g.X, (1 - g.X), g.Y, (H - g.Y))
			do return ((inside < WHOLLY_ON_EDGE) and (inside > (-CLEARLY_OFF_EDGE))) end
		end) end
	end
	passersFit = function(sc, engine, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local pts = A.filter(passersOf(sc), onThePitch)
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, H)
		local xs = A.map(pts, function(p)
			return p.x
		end)
		local ys = A.map(pts, function(p)
			return p.y
		end)
		local x1 = Math.min(Js.unpack(xs))
		local x2 = Math.max(Js.unpack(xs))
		local y1 = Math.min(Js.unpack(ys))
		local y2 = Math.max(Js.unpack(ys))
		local cx = ((x1 + x2) / 2)
		local ex1 = Math.max(engine.x1, -2)
		local ex2 = Math.min(engine.x2, (M_pitch.PITCH_W + 2))
		local across = Math.max(PASSERS_FIT_MIN_M, ((x2 - x1) + (2 * PASSERS_FIT_SIDE_M)), (((y2 - y1) + (2 * PASSERS_FIT_END_M)) / H), ((ex2 - ex1) - (2 * PASSERS_FIT_OUT_M)))
		do
			local _first12 = true
			while true do
				if not _first12 then
					across += 0.25
				end
				_first12 = false
				local down = (across * H)
				local vx1 = (cx - (across / 2))
				vx1 = Math.max(Math.min((x1 - PASSERS_FIT_SIDE_M), (-EDGE_M)), Math.min((Math.max((x2 + PASSERS_FIT_SIDE_M), (M_pitch.PITCH_W + EDGE_M)) - across), vx1))
				vx1 = Math.max(((ex2 - PASSERS_FIT_OUT_M) - across), Math.min((ex1 + PASSERS_FIT_OUT_M), vx1))
				if (((engine.y1 + down) < (y2 + PASSERS_FIT_END_M)) and (across < PASSERS_FIT_MAX_M)) then
					do continue end
				end
				local top = engine.y1
				local v = Js.O({ x1 = vx1, x2 = (vx1 + across), y1 = top, y2 = (top + down) }, { "x1", "x2", "y1", "y2" })
				local fits = (A.every(pts, function(p)
					local c = fracOf(v, "up", p)
					local g = M_cameraTilt.canvasToScreen(t, c.sx, c.sy, 1, H)
					do return (Math.min(g.X, (1 - g.X), g.Y, (H - g.Y)) >= WHOLLY_ON_EDGE) end
				end) and (not halfCut(sc, v, H, tiltDeg)))
				if (fits or (across >= PASSERS_FIT_MAX_M)) then
					do return v end
				end
			end
		end
	end
	exports.passersFit = passersFit
	passersCameraFor = function(sc, engine, facing, hw)
		if (facing ~= "up") then
			do return passersCamera(passersOf(sc), facing, hw) end
		end
		local h = Math.max(NEW_VIEW_MIN_HW, hw)
		local across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M, ((engine.x2 - engine.x1) + 0.5)))
		local cx = ((engine.x1 + engine.x2) / 2)
		local x1 = (cx - (across / 2))
		x1 = Math.max(Math.min(engine.x1, (-EDGE_M)), Math.min((Math.max(engine.x2, (M_pitch.PITCH_W + EDGE_M)) - across), x1))
		do return Js.O({ x1 = x1, x2 = (x1 + across), y1 = engine.y1, y2 = (engine.y1 + (across * h)) }, { "x1", "x2", "y1", "y2" }) end
	end
	newViewCamera = function(engine, facing, hw, ball, acrossM)
		if acrossM == nil then acrossM = NEW_VIEW_WIDTH_M end
		local across = acrossM
		local down = (across * Math.max(NEW_VIEW_MIN_HW, hw))
		if (facing == "up") then
			local cx = ((engine.x1 + engine.x2) / 2)
			local x1 = (cx - (across / 2))
			x1 = Math.max((-EDGE_M), Math.min(((M_pitch.PITCH_W + EDGE_M) - across), x1))
			local want = Math.max((-BEHIND_GOAL_M), ((engine.y2 + BOTTOM_ROOM_M) - down))
			local y1 = Math.min(engine.y1, want)
			do return Js.O({ x1 = x1, x2 = (x1 + across), y1 = y1, y2 = (y1 + down) }, { "x1", "x2", "y1", "y2" }) end
		end
		local y1 = engine.y1
		local mirror = (facing == "left")
		local bx = (if mirror then (M_pitch.PITCH_W - ball.x) else ball.x)
		local hi = (M_pitch.PITCH_W + TURNED_NEAR_M)
		local lo = (down - TURNED_FAR_M)
		local x2 = (bx + ((1 - TURNED_BALL_DOWN) * down))
		x2 = Math.min(hi, Math.max(lo, x2))
		if (lo > hi) then
			x2 = hi
		end
		local x1 = (x2 - down)
		local xs = (if mirror then Js.O({ x1 = (M_pitch.PITCH_W - x2), x2 = (M_pitch.PITCH_W - x1) }, { "x1", "x2" }) else Js.O({ x1 = x1, x2 = x2 }, { "x1", "x2" }))
		do return Js.ospread(xs, Js.O({ y1 = y1, y2 = (y1 + across) }, { "y1", "y2" })) end
	end
	exports.newViewCamera = newViewCamera
	setActionFit = function(v)
		actionFitOverride = v
	end
	exports.setActionFit = setActionFit
	actionFitOn = function()
		do return (if actionFitOverride ~= nil then actionFitOverride else false) end
	end
	exports.actionFitOn = actionFitOn
	engineFrameOf = function(sc)
		do return (if sc.engineFrame ~= nil then sc.engineFrame else sc.viewport) end
	end
	exports.engineFrameOf = engineFrameOf
	frameForNewView = function(sc, hw, keepPlayArea, tiltDeg)
		if keepPlayArea == nil then keepPlayArea = false end
		if tiltDeg == nil then tiltDeg = 0 end
		local f = sc
		if (not f.engineFrame) then
			f.engineFrame = Js.ospread(sc.viewport)
		end
		if (framingV2On() and (not keepPlayArea)) then
			local v2 = framingV2Camera(sc, hw, tiltDeg)
			if v2 then
				f.playZoom = 1
				sc.viewport = playAreaFor(sc, v2, f.engineFrame)
				do return v2 end
			end
			if ((((if sc.facing ~= nil then sc.facing else "up") == "up") and M_canvasEngine.goalInView(sc.kind)) and framingV2TurnsSideOn(sc)) then
				sc.facing = sideOnFacing(sc)
				if hasRunupFree(sc.kind) then
					M_canvasEngine.standOff(sc)
				end
				local side = sideOnCamera(sc, hw)
				f.playZoom = 1
				sc.viewport = playAreaFor(sc, side, f.engineFrame)
				do return side end
			end
		end
		local facing = (if sc.facing ~= nil then sc.facing else "up")
		local base = cameraFor(sc, f.engineFrame, hw)
		local today = fitCameraToTilt(base, facing, hw, tiltDeg, keyPointsOf(sc))
		local cam = today
		f.playZoom = 1
		if ((facing ~= "up") and A.includes(WIDE_TURN_KINDS, sc.kind)) then
			local upright = acrossFor(sc.kind, f.engineFrame, "up")
			local across = (cam.y2 - cam.y1)
			if ((type(upright) == "number") and (across > 0)) then
				f.playZoom = (upright / across)
			end
		end
		if (((playZoom() ~= "off") and (facing == "up")) and M_canvasEngine.goalInView(sc.kind)) then
			local z = zoomToPlay(base, sc, hw)
			local pull = Js.O({ x = sc.ball.x, y = (sc.ball.y + ZOOM_MIN_PULL_M) }, { "x", "y" })
			local zc = (if (playZoom() == "z2max") then z else fitCameraToTilt(z, facing, hw, tiltDeg, Js.aspread(framedKeyPointsOf(sc), Js.alit(pull))))
			if ((playZoom() == "z2") and actionFitOn()) then
				local cands = Js.alit(today)
				if (z ~= base) then
					A.push(cands, zc)
				end
				local fit = fitToPlay(base, sc, hw, tiltDeg)
				if fit then
					A.push(cands, fit)
				end
				local act = fitAction(base, sc, hw, tiltDeg)
				if act then
					A.push(cands, act)
				end
				local bestK = 0
				do
					local _arr13 = cands
					local _i14 = 0
					while _i14 < Js.alen(_arr13) do
						_i14 += 1
						local c = _arr13[_i14]
						local k = ((today.x2 - today.x1) / (c.x2 - c.x1))
						if (k <= (bestK + 1e-9)) then
							do continue end
						end
						if Js.T(Js.alen(framingFaults(sc, c, hw, tiltDeg))) then
							do continue end
						end
						cam = c
						bestK = k
					end
				end
				f.playZoom = (if (bestK > 0) then bestK else 1)
				if (bestK == 0) then
					cam = today
				end
			else
				local k = ((today.x2 - today.x1) / (zc.x2 - zc.x1))
				if ((z ~= base) and (k > 1.001)) then
					cam = zc
					f.playZoom = k
				end
				if (playZoom() == "z2") then
					local fit = fitToPlay(base, sc, hw, tiltDeg)
					local kf = (if fit then ((today.x2 - today.x1) / (fit.x2 - fit.x1)) else 1)
					if (fit and (kf > Math.max(1.001, (if f.playZoom ~= nil then f.playZoom else 1)))) then
						cam = fit
						f.playZoom = kf
					end
				end
			end
		end
		if ((((playZoom() ~= "off") and actionFitOn()) and (facing == "up")) and (acrossFor(sc.kind, f.engineFrame, "up") == "passers")) then
			local pf = passersFit(sc, f.engineFrame, hw, tiltDeg)
			local k = ((today.x2 - today.x1) / (pf.x2 - pf.x1))
			local pfOk = (not Js.T(Js.alen(framingFaults(sc, pf, hw, tiltDeg))))
			if (pfOk and ((k > 1.001) or (Js.T(Js.alen(framingFaults(sc, today, hw, tiltDeg))) and (k >= ((1 / TILT_FIT_MAX) - 1e-9))))) then
				cam = pf
				f.playZoom = (if (playZoom() == "z1") then 1 else k)
			end
		end
		if ((facing == "up") and (sc.kind == "header")) then
			local w = (cam.x2 - cam.x1)
			local h = (cam.y2 - cam.y1)
			if ((w > 0) and (w < AIR_MIN_ACROSS_M)) then
				local mid = ((cam.x1 + cam.x2) / 2)
				local at = function(W, pan)
					return Js.O({ x1 = ((mid + pan) - (W / 2)), x2 = ((mid + pan) + (W / 2)), y1 = cam.y1, y2 = (cam.y1 + ((h * W) / w)) }, { "x1", "x2", "y1", "y2" })
				end
				local best = at(AIR_MIN_ACROSS_M, 0)
				if (actionFitOn() and Js.T(Js.alen(framingFaults(sc, best, hw, tiltDeg)))) then
					local _brk_search, _cont_search = false, false
					do
						local W = AIR_MIN_ACROSS_M
						local _first15 = true
						while true do
							if not _first15 then
								W += 0.5
							end
							_first15 = false
							if not (W <= (AIR_MIN_ACROSS_M + 8)) then break end
							do
								local _arr16 = Js.alit(0, -1, 1, -2, 2, -3, 3, -4, 4)
								local _i17 = 0
								while _i17 < Js.alen(_arr16) do
									_i17 += 1
									local pan = _arr16[_i17]
									local c = at(W, pan)
									if (not Js.T(Js.alen(framingFaults(sc, c, hw, tiltDeg)))) then
										best = c
										_brk_search = true
										do break end
									end
								end
							end
							if _brk_search then break end
							if _cont_search then _cont_search = false; continue end
						end
					end
				end
				f.playZoom = ((if f.playZoom ~= nil then f.playZoom else 1) * (w / (best.x2 - best.x1)))
				cam = best
			end
		end
		if ((facing == "up") and (not keepPlayArea)) then
			local roomy = dragRoomCamera(cam, sc, hw, tiltDeg)
			if (roomy ~= cam) then
				f.playZoom = ((if f.playZoom ~= nil then f.playZoom else 1) * ((cam.x2 - cam.x1) / (roomy.x2 - roomy.x1)))
				cam = roomy
			end
		end
		if (not keepPlayArea) then
			sc.viewport = playAreaFor(sc, cam, f.engineFrame)
		end
		do return cam end
	end
	exports.frameForNewView = frameForNewView
	playZoom = function()
		if Js.T(playZoomOverride) then
			do return playZoomOverride end
		end
		do return (if (M_chanceFraming.chanceFraming() == "zoom") then "z2" else "off") end
	end
	exports.playZoom = playZoom
	setPlayZoomOverride = function(v)
		playZoomOverride = v
		probe = (v ~= nil)
	end
	exports.setPlayZoomOverride = setPlayZoomOverride
	playZoomProbe = function()
		do return probe end
	end
	exports.playZoomProbe = playZoomProbe
	playZoomOf = function(sc)
		do return (if sc.playZoom ~= nil then sc.playZoom else 1) end
	end
	exports.playZoomOf = playZoomOf
	onThePitch = function(p)
		do return (not ((((p.x < -50) or (p.x > (M_pitch.PITCH_W + 50))) or (p.y > 150)) or (p.y < -50))) end
	end
	exports.onThePitch = onThePitch
	bodiesOf = function(sc)
		local decorative = ((sc.kind == "volley") or (sc.kind == "header"))
		local pts = Js.aspread(Js.alit(sc.ball, sc.player), sc.defenders, (if decorative then Js.alit() else sc.teammates))
		if sc.runner then
			A.push(pts, sc.runner.pos)
		end
		do
			local _arr18 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local r = _arr18[_i19]
				A.push(pts, r.pos)
			end
		end
		if (sc.follower and M_canvasEngine.goalInView(sc.kind)) then
			A.push(pts, sc.follower)
		end
		do return A.filter(pts, onThePitch) end
	end
	exports.bodiesOf = bodiesOf
	isCrowdedChance = function(sc)
		if (not A.includes(CROWD_KINDS, sc.kind)) then
			do return false end
		end
		local b = sc.ball
		do return (Js.alen(A.filter(bodiesOf(sc), function(p)
			return (Math.hypot((p.x - b.x), (p.y - b.y)) <= CROWD_NEAR_M)
		end)) >= CROWD_MIN) end
	end
	exports.isCrowdedChance = isCrowdedChance
	framedBodiesOf = function(sc)
		local all = bodiesOf(sc)
		if (not isCrowdedChance(sc)) then
			do return all end
		end
		local b = sc.ball
		do return A.filter(all, function(p)
			return (((p == sc.ball) or (p == sc.player)) or (Math.hypot((p.x - b.x), (p.y - b.y)) <= CROWD_FRAME_M))
		end) end
	end
	exports.framedBodiesOf = framedBodiesOf
	framedKeyPointsOf = function(sc)
		if (not isCrowdedChance(sc)) then
			do return keyPointsOf(sc) end
		end
		local near = Js.Set.new(framedBodiesOf(sc))
		local bodies = Js.Set.new(bodiesOf(sc))
		do return A.filter(keyPointsOf(sc), function(p)
			return ((not bodies:has(p)) or near:has(p))
		end) end
	end
	exports.framedKeyPointsOf = framedKeyPointsOf
	zoomToPlay = function(cam, sc, hw)
		local facing = (if sc.facing ~= nil then sc.facing else "up")
		local spanX = (cam.x2 - cam.x1)
		local spanY = (cam.y2 - cam.y1)
		local across = (if (facing == "up") then spanX else spanY)
		local down = (if (facing == "up") then spanY else spanX)
		local _ = hw
		local bodies = A.map(framedBodiesOf(sc), function(p)
			return fracOf(cam, facing, p)
		end)
		local key = (if M_canvasEngine.goalInView(sc.kind) then A.map(A.filter(Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })), onThePitch), function(p)
			return fracOf(cam, facing, p)
		end) else Js.alit())
		local ballF = fracOf(cam, facing, sc.ball)
		local low = Math.max(Js.unpack(A.map(bodies, function(b)
			return b.sy
		end)))
		do
			local k = Math.min(ZOOM_MAX, (1 / (low + (ZOOM_ROOM_M / down))))
			local _first20 = true
			while true do
				if not _first20 then
					k -= 0.02
				end
				_first20 = false
				if not (k > 1) then break end
				if (((1 - (ballF.sy * k)) * (down / k)) < ZOOM_MIN_PULL_M) then
					do continue end
				end
				local mx = ((ZOOM_SIDE_M * k) / across)
				local my = ((ZOOM_TOP_M * k) / down)
				if (A.some(bodies, function(b)
					return ((b.sy * k) < my)
				end) and (playZoom() ~= "z2max")) then
					do continue end
				end
				local pLo = (-math.huge)
				local pHi = math.huge
				local need = function(sx, m)
					local a = (0.5 + ((sx - 0.5) * k))
					pLo = Math.max(pLo, (m - a))
					pHi = Math.min(pHi, ((1 - m) - a))
				end
				A.forEach(bodies, function(b)
					return need(b.sx, mx)
				end)
				A.forEach(key, function(b)
					return need(b.sx, 0)
				end)
				if ((pLo > pHi) and (playZoom() == "z2max")) then
					do return zoomView(cam, facing, k, ((pLo + pHi) / 2)) end
				end
				if (pLo > pHi) then
					do continue end
				end
				local p = Math.max(pLo, Math.min(pHi, 0))
				if (facing == "up") then
					local w = (spanX / k)
					local x1At = function(q)
						return (cam.x1 + ((0.5 + ((-0.5 - q) / k)) * spanX))
					end
					local want = Math.max((-EDGE_M), Math.min(((M_pitch.PITCH_W + EDGE_M) - w), x1At(p)))
					p = Math.max(pLo, Math.min(pHi, (p - (((want - x1At(p)) / spanX) * k))))
				end
				do return zoomView(cam, facing, k, p) end
			end
		end
		do return cam end
	end
	exports.zoomToPlay = zoomToPlay
	zoomView = function(cam, facing, k, p)
		local spanX = (cam.x2 - cam.x1)
		local spanY = (cam.y2 - cam.y1)
		local s0 = (0.5 + ((-0.5 - p) / k))
		local s1 = (0.5 + ((0.5 - p) / k))
		local t1 = (1 / k)
		if (facing == "up") then
			do return Js.O({ x1 = (cam.x1 + (s0 * spanX)), x2 = (cam.x1 + (s1 * spanX)), y1 = cam.y1, y2 = (cam.y1 + (t1 * spanY)) }, { "x1", "x2", "y1", "y2" }) end
		end
		if (facing == "right") then
			do return Js.O({ x1 = cam.x1, x2 = (cam.x1 + (t1 * spanX)), y1 = (cam.y1 + ((1 - s1) * spanY)), y2 = (cam.y1 + ((1 - s0) * spanY)) }, { "x1", "x2", "y1", "y2" }) end
		end
		do return Js.O({ x1 = (cam.x2 - (t1 * spanX)), x2 = cam.x2, y1 = (cam.y1 + (s0 * spanY)), y2 = (cam.y1 + (s1 * spanY)) }, { "x1", "x2", "y1", "y2" }) end
	end
	fitToPlay = function(base, sc, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local spanX = (base.x2 - base.x1)
		local spanY = (base.y2 - base.y1)
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, H)
		local onGlass = function(sx, sy, m)
			return ((not t) or M_cameraTilt.visibleOnScreen(t, sx, sy, m))
		end
		local men = A.map(bodiesOf(sc), function(p)
			return fracOf(base, "up", p)
		end)
		local goal = A.map(A.filter(Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })), onThePitch), function(p)
			return fracOf(base, "up", p)
		end)
		local ball = fracOf(base, "up", sc.ball)
		local low = A.reduce(men, function(a, b)
			return (if (b.sy > a.sy) then b else a)
		end, men[1])
		local roomF = (ZOOM_ROOM_M / spanY)
		local pullF = (ZOOM_MIN_PULL_M / spanY)
		local gm = TILT_FIT_MARGIN
		local kHi = ZOOM_MAX
		local kLo = (1 / TILT_FIT_MAX)
		do
			local k = kHi
			local _first21 = true
			while true do
				if not _first21 then
					k -= 0.01
				end
				_first21 = false
				if not (k >= (kLo - 1e-9)) then break end
				local across = (spanX / k)
				local down = (spanY / k)
				if (((low.sy * k) + (roomF * k)) > (1 + 1e-9)) then
					do continue end
				end
				if (((ball.sy * k) + (pullF * k)) > (1 + 1e-9)) then
					do continue end
				end
				local mx = (ZOOM_SIDE_M / across)
				local my = (ZOOM_TOP_M / down)
				if A.some(men, function(b)
					return ((b.sy * k) < my)
				end) then
					do continue end
				end
				local pLo = (-math.huge)
				local pHi = math.huge
				local need = function(sx, m)
					local a = (0.5 + ((sx - 0.5) * k))
					pLo = Math.max(pLo, (m - a))
					pHi = Math.min(pHi, ((1 - m) - a))
				end
				A.forEach(men, function(b)
					return need(b.sx, mx)
				end)
				A.forEach(goal, function(b)
					return need(b.sx, 0)
				end)
				if (pLo > (pHi + 1e-12)) then
					do continue end
				end
				local pans = Js.alit()
				local p0 = Math.max(pLo, Math.min(pHi, 0))
				A.push(pans, p0)
				local steps = 24
				for i = 1, steps do
					local d = (((pHi - pLo) * i) / steps)
					if ((p0 + d) <= (pHi + 1e-12)) then
						A.push(pans, (p0 + d))
					end
					if ((p0 - d) >= (pLo - 1e-12)) then
						A.push(pans, (p0 - d))
					end
				end
				local sxAt = function(sx, p)
					return ((0.5 + ((sx - 0.5) * k)) + p)
				end
				do
					local _arr22 = pans
					local _i23 = 0
					while _i23 < Js.alen(_arr22) do
						_i23 += 1
						local p = _arr22[_i23]
						if t then
							if (not A.every(men, function(b)
								return onGlass(sxAt(b.sx, p), (b.sy * k), gm)
							end)) then
								do continue end
							end
							if (not A.every(goal, function(b)
								return onGlass(sxAt(b.sx, p), (b.sy * k), gm)
							end)) then
								do continue end
							end
							if (not onGlass(sxAt(low.sx, p), ((low.sy * k) + (roomF * k)), 0)) then
								do continue end
							end
							if (not onGlass(sxAt(ball.sx, p), ((ball.sy * k) + (pullF * k)), 0)) then
								do continue end
							end
						end
						local q = p
						local w = (spanX / k)
						local x1At = function(pp)
							return (base.x1 + ((0.5 + ((-0.5 - pp) / k)) * spanX))
						end
						local want = Math.max((-EDGE_M), Math.min(((M_pitch.PITCH_W + EDGE_M) - w), x1At(q)))
						local q2 = Math.max(pLo, Math.min(pHi, (q - (((want - x1At(q)) / spanX) * k))))
						if ((q2 ~= q) and ((not t) or (((A.every(men, function(b)
							return onGlass(sxAt(b.sx, q2), (b.sy * k), gm)
						end) and A.every(goal, function(b)
							return onGlass(sxAt(b.sx, q2), (b.sy * k), gm)
						end)) and onGlass(sxAt(low.sx, q2), ((low.sy * k) + (roomF * k)), 0)) and onGlass(sxAt(ball.sx, q2), ((ball.sy * k) + (pullF * k)), 0)))) then
							q = q2
						end
						do return zoomView(base, "up", k, q) end
					end
				end
			end
		end
		do return nil end
	end
	exports.fitToPlay = fitToPlay
	actionOf = function(sc)
		local ball = sc.ball
		local near = function(p, r)
			return (Math.hypot((p.x - ball.x), (p.y - ball.y)) <= r)
		end
		local must = Js.alit(ball, sc.player)
		local extra = Js.alit()
		if (sc.kind == "penalty") then
			do
				local _arr24 = bodiesOf(sc)
				local _i25 = 0
				while _i25 < Js.alen(_arr24) do
					_i25 += 1
					local p = _arr24[_i25]
					if ((p ~= ball) and (p ~= sc.player)) then
						A.push(extra, p)
					end
				end
			end
			do return Js.O({ must = A.filter(must, onThePitch), extra = extra }, { "must", "extra" }) end
		end
		local mates = Js.alit()
		if sc.runner then
			A.push(mates, sc.runner.pos)
		end
		do
			local _arr26 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i27 = 0
			while _i27 < Js.alen(_arr26) do
				_i27 += 1
				local r = _arr26[_i27]
				A.push(mates, r.pos)
			end
		end
		if (sc.follower and M_canvasEngine.goalInView(sc.kind)) then
			A.push(mates, sc.follower)
		end
		local decorative = ((sc.kind == "volley") or (sc.kind == "header"))
		if (not decorative) then
			A.push(mates, Js.unpack(sc.teammates))
		end
		local keptMates = Js.alit()
		do
			local _arr28 = A.filter(mates, onThePitch)
			local _i29 = 0
			while _i29 < Js.alen(_arr28) do
				_i29 += 1
				local m = _arr28[_i29]
				if ((sc.runner and (m == sc.runner.pos)) or near(m, ACTION_MATE_M)) then
					A.push(must, m)
					A.push(keptMates, m)
				else
					A.push(extra, m)
				end
			end
		end
		local loX = (Math.min(ball.x, M_pitch.POST_L) - ACTION_LANE_M)
		local hiX = (Math.max(ball.x, M_pitch.POST_R) + ACTION_LANE_M)
		do
			local _arr30 = A.filter(sc.defenders, onThePitch)
			local _i31 = 0
			while _i31 < Js.alen(_arr30) do
				_i31 += 1
				local d = _arr30[_i31]
				local inLane = (((d.y <= (ball.y + 1.5)) and (d.x >= loX)) and (d.x <= hiX))
				local marking = A.some(keptMates, function(m)
					return (Math.hypot((d.x - m.x), (d.y - m.y)) <= ACTION_MARK_M)
				end)
				if ((near(d, ACTION_BALL_M) or inLane) or marking) then
					A.push(must, d)
				else
					A.push(extra, d)
				end
			end
		end
		do return Js.O({ must = A.filter(must, onThePitch), extra = extra }, { "must", "extra" }) end
	end
	exports.actionOf = actionOf
	framingPromise = function(sc)
		if (((actionFitOn() and (playZoom() == "z2")) and ((if sc.facing ~= nil then sc.facing else "up") == "up")) and M_canvasEngine.goalInView(sc.kind)) then
			local _d32 = actionOf(sc)
			local must = _d32.must
			local extra = _d32.extra
			local goal = A.filter(Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })), onThePitch)
			do return Js.O({ must = Js.aspread(must, goal), extra = extra }, { "must", "extra" }) end
		end
		if (((actionFitOn() and (playZoom() ~= "off")) and ((if sc.facing ~= nil then sc.facing else "up") == "up")) and (NEW_VIEW_KIND_WIDTH_M[sc.kind] == "passers")) then
			local must = A.filter(passersOf(sc), onThePitch)
			do return Js.O({ must = must, extra = A.filter(bodiesOf(sc), function(p)
				return (not A.includes(must, p))
			end) }, { "must", "extra" }) end
		end
		do return Js.O({ must = framedKeyPointsOf(sc), extra = Js.alit() }, { "must", "extra" }) end
	end
	exports.framingPromise = framingPromise
	dragRoomCamera = function(cam, sc, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local fits = function(v)
			local m = (DRAG_ROOM_SHARE * (v.x2 - v.x1))
			do return ((sc.ball.x >= ((v.x1 + m) - 0.000001)) and (sc.ball.x <= ((v.x2 - m) + 0.000001))) end
		end
		if fits(cam) then
			do return cam end
		end
		local held = A.filter(framedBodiesOf(sc), function(p)
			return ((p.x >= cam.x1) and (p.x <= cam.x2))
		end)
		local before = Js.alen(framingFaults(sc, cam, hw, tiltDeg))
		local ok = function(v)
			return ((((not M_canvasEngine.goalInView(sc.kind)) or ((v.x1 <= M_pitch.POST_L) and (v.x2 >= M_pitch.POST_R))) and A.every(held, function(p)
				return ((p.x >= (v.x1 + ZOOM_SIDE_M)) and (p.x <= (v.x2 - ZOOM_SIDE_M)))
			end)) and (Js.alen(framingFaults(sc, v, hw, tiltDeg)) <= before))
		end
		local slide = function(v)
			local w = (v.x2 - v.x1)
			local m = (DRAG_ROOM_SHARE * w)
			local dx = (if (sc.ball.x < (v.x1 + m)) then (sc.ball.x - (v.x1 + m)) else (if (sc.ball.x > (v.x2 - m)) then (sc.ball.x - (v.x2 - m)) else 0))
			do return Js.ospread(v, Js.O({ x1 = (v.x1 + dx), x2 = (v.x2 + dx) }, { "x1", "x2" })) end
		end
		local s0 = slide(cam)
		if ok(s0) then
			do return s0 end
		end
		local w0 = (cam.x2 - cam.x1)
		local h0 = (cam.y2 - cam.y1)
		local cx = ((cam.x1 + cam.x2) / 2)
		do
			local w = (w0 + 0.5)
			local _first33 = true
			while true do
				if not _first33 then
					w += 0.5
				end
				_first33 = false
				if not (w <= (NEW_VIEW_WIDTH_M * 1.25)) then break end
				local v = slide(Js.O({ x1 = (cx - (w / 2)), x2 = (cx + (w / 2)), y1 = cam.y1, y2 = (cam.y1 + (h0 * (w / w0))) }, { "x1", "x2", "y1", "y2" }))
				if (fits(v) and ok(v)) then
					do return v end
				end
			end
		end
		do return cam end
	end
	exports.dragRoomCamera = dragRoomCamera
	framingFaults = function(sc, cam, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, H)
		local facing = (if sc.facing ~= nil then sc.facing else "up")
		local out = Js.alit()
		local _d34 = framingPromise(sc)
		local must = _d34.must
		local extra = _d34.extra
		local at = function(p)
			local c = fracOf(cam, facing, p)
			do return M_cameraTilt.canvasToScreen(t, c.sx, c.sy, 1, H) end
		end
		local goalPts = Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }))
		do
			local _arr35 = must
			local _i36 = 0
			while _i36 < Js.alen(_arr35) do
				_i36 += 1
				local p = _arr35[_i36]
				local c = fracOf(cam, facing, p)
				if (not M_cameraTilt.visibleOnScreen(t, c.sx, c.sy)) then
					A.push(out, ("(" .. N.toFixed(p.x, 1) .. ", " .. N.toFixed(p.y, 1) .. ") in the action is off the screen"))
					do continue end
				end
				if ((actionFitOn() and (facing == "up")) and (not A.some(goalPts, function(g)
					return ((g.x == p.x) and (g.y == p.y))
				end))) then
					local g = at(p)
					if (Math.min(g.X, (1 - g.X), g.Y, (H - g.Y)) < WHOLLY_ON_EDGE) then
						A.push(out, ("(" .. N.toFixed(p.x, 1) .. ", " .. N.toFixed(p.y, 1) .. ") in the action is cut by an edge"))
					end
				end
			end
		end
		do
			local _arr37 = extra
			local _i38 = 0
			while _i38 < Js.alen(_arr37) do
				_i38 += 1
				local p = _arr37[_i38]
				local g = at(p)
				local inside = Math.min(g.X, (1 - g.X), g.Y, (H - g.Y))
				if ((inside < WHOLLY_ON_EDGE) and (inside > (-CLEARLY_OFF_EDGE))) then
					A.push(out, ("(" .. N.toFixed(p.x, 1) .. ", " .. N.toFixed(p.y, 1) .. ") is cut in half by an edge"))
				end
			end
		end
		do return out end
	end
	exports.framingFaults = framingFaults
	fitAction = function(base, sc, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local spanX = (base.x2 - base.x1)
		local spanY = (base.y2 - base.y1)
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, H)
		local _d39 = actionOf(sc)
		local must = _d39.must
		local extra = _d39.extra
		local men = A.map(must, function(p)
			return fracOf(base, "up", p)
		end)
		local others = A.map(extra, function(p)
			return fracOf(base, "up", p)
		end)
		local goal = A.map(A.filter(Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })), onThePitch), function(p)
			return fracOf(base, "up", p)
		end)
		local ball = fracOf(base, "up", sc.ball)
		local low = A.reduce(men, function(a, b)
			return (if (b.sy > a.sy) then b else a)
		end, men[1])
		local roomF = (ACTION_ROOM_M / spanY)
		local pullF = (ZOOM_MIN_PULL_M / spanY)
		local gm = TILT_FIT_MARGIN
		local glass = function(sx, sy)
			return (if t then M_cameraTilt.canvasToScreen(t, sx, sy, 1, H) else Js.O({ X = sx, Y = (sy * H) }, { "X", "Y" }))
		end
		local onGlass = function(sx, sy, m)
			return (if t then M_cameraTilt.visibleOnScreen(t, sx, sy, m) else ((((sx >= 0) and (sx <= 1)) and (sy >= 0)) and (sy <= 1)))
		end
		local allMen = Js.aspread(men, others)
		local midX = ((Math.min(Js.unpack(Js.aspread(A.map(men, function(b)
			return b.sx
		end), A.map(goal, function(b)
			return b.sx
		end)))) + Math.max(Js.unpack(Js.aspread(A.map(men, function(b)
			return b.sx
		end), A.map(goal, function(b)
			return b.sx
		end))))) / 2)
		do
			local k = ZOOM_MAX
			local _first40 = true
			while true do
				if not _first40 then
					k -= 0.01
				end
				_first40 = false
				if not (k >= ((1 / TILT_FIT_MAX) - 1e-9)) then break end
				local across = (spanX / k)
				local down = (spanY / k)
				if (((low.sy * k) + (roomF * k)) > (1 + 1e-9)) then
					do continue end
				end
				if (((ball.sy * k) + (pullF * k)) > (1 + 1e-9)) then
					do continue end
				end
				local mx = (ZOOM_SIDE_M / across)
				local my = (ZOOM_TOP_M / down)
				if A.some(men, function(b)
					return ((b.sy * k) < my)
				end) then
					do continue end
				end
				local pLo = (-math.huge)
				local pHi = math.huge
				local need = function(sx, m)
					local a = (0.5 + ((sx - 0.5) * k))
					pLo = Math.max(pLo, (m - a))
					pHi = Math.min(pHi, ((1 - m) - a))
				end
				A.forEach(men, function(b)
					return need(b.sx, mx)
				end)
				A.forEach(goal, function(b)
					return need(b.sx, 0)
				end)
				if (pLo > (pHi + 1e-12)) then
					do continue end
				end
				local sxAt = function(sx, p)
					return ((0.5 + ((sx - 0.5) * k)) + p)
				end
				local x1At = function(p)
					return (base.x1 + ((0.5 + ((-0.5 - p) / k)) * spanX))
				end
				local pMid = Math.max(pLo, Math.min(pHi, (0.5 - (0.5 + ((midX - 0.5) * k)))))
				local best = nil
				local steps = 40
				for i = 0, steps do
					local p = (if (pHi > pLo) then (pLo + (((pHi - pLo) * i) / steps)) else pLo)
					local whole = function(b)
						local g = glass(sxAt(b.sx, p), (b.sy * k))
						do return (Math.min(g.X, (1 - g.X), g.Y, (H - g.Y)) >= WHOLLY_ON_EDGE) end
					end
					if (not A.every(men, whole)) then
						do continue end
					end
					if (not A.every(goal, function(b)
						return onGlass(sxAt(b.sx, p), (b.sy * k), gm)
					end)) then
						do continue end
					end
					if (not onGlass(sxAt(low.sx, p), ((low.sy * k) + (roomF * k)), 0)) then
						do continue end
					end
					if (not onGlass(sxAt(ball.sx, p), ((ball.sy * k) + (pullF * k)), 0)) then
						do continue end
					end
					local shown = 0
					local half = false
					do
						local _arr41 = allMen
						local _i42 = 0
						while _i42 < Js.alen(_arr41) do
							_i42 += 1
							local b = _arr41[_i42]
							local g = glass(sxAt(b.sx, p), (b.sy * k))
							local inside = Math.min(g.X, (1 - g.X), g.Y, (H - g.Y))
							if (inside >= WHOLLY_ON_EDGE) then
								shown += 1
								do continue end
							end
							if (inside > (-CLEARLY_OFF_EDGE)) then
								half = true
								do break end
							end
						end
					end
					if half then
						do continue end
					end
					local x1 = x1At(p)
					local edge = ((x1 >= ((-EDGE_M) - 0.000001)) and ((x1 + (spanX / k)) <= ((M_pitch.PITCH_W + EDGE_M) + 0.000001)))
					local c = Js.O({ p = p, shown = shown, off = math.abs((p - pMid)), edge = edge }, { "p", "shown", "off", "edge" })
					if (((not best) or (c.edge and (not best.edge))) or ((c.edge == best.edge) and ((c.shown > best.shown) or ((c.shown == best.shown) and (c.off < best.off))))) then
						best = c
					end
				end
				if best then
					do return zoomView(base, "up", k, best.p) end
				end
			end
		end
		do return nil end
	end
	exports.fitAction = fitAction
	turnsSideOn = function(sc)
		do return (A.includes(WIDE_TURN_KINDS, sc.kind) and ((if sc.facing ~= nil then sc.facing else "up") == "up")) end
	end
	exports.turnsSideOn = turnsSideOn
	turnWideChance = function(sc, restand, hw)
		if restand == nil then restand = true end
		if hw == nil then hw = NEW_VIEW_MAX_HW end
		local f = sc
		local always = (sc.kind == "cutback")
		if ((((M_wideChances.wideChances() ~= "new") and (not always)) or (not turnsSideOn(sc))) or f.wideChecked) then
			do return false end
		end
		f.wideChecked = true
		local upright = acrossFor(sc.kind, engineFrameOf(sc), "up")
		local was = sc.facing
		sc.facing = sideOnFacing(sc)
		local cam = sideOnCamera(sc, hw)
		if (((not always) and (type(upright) == "number")) and ((cam.y2 - cam.y1) > (upright + 0.000001))) then
			sc.facing = was
			do return false end
		end
		if restand then
			M_canvasEngine.standOff(sc)
		end
		do return true end
	end
	exports.turnWideChance = turnWideChance
	sideOnFacing = function(sc)
		do return (if (sc.ball.x >= (M_pitch.PITCH_W / 2)) then "right" else "left") end
	end
	exports.sideOnFacing = sideOnFacing
	sideOnCamera = function(sc, hw)
		local facing = (if (sc.facing == "left") then "left" else "right")
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local goal = A.filter(Js.alit(Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" })), onThePitch)
		local pts = Js.aspread(bodiesOf(sc), goal)
		local y1 = (-SIDE_BEHIND_M)
		local maxY = Math.max(Js.unpack(A.map(pts, function(p)
			return p.y
		end)))
		local xLo = (Math.min(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) - SIDE_EDGE_ROOM_M)
		local xHi = (Math.max(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) + SIDE_EDGE_ROOM_M)
		local target = (if ((sc.kind == "cutback") and sc.runner) then sc.runner.pos else Js.O({ x = (M_pitch.PITCH_W / 2), y = 0 }, { "x", "y" }))
		local dx = (target.x - sc.ball.x)
		local dy = (target.y - sc.ball.y)
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		local lo = Math.max(SIDE_MIN_ACROSS_M, ((maxY + SIDE_DEPTH_ROOM_M) - y1), ((xHi - xLo) / H))
		do
			local across = lo
			local _first43 = true
			while true do
				if not _first43 then
					across += 0.25
				end
				_first43 = false
				local down = (across * H)
				local y2 = (y1 + across)
				local pull = (SIDE_PULL_SHARE * across)
				local px = (sc.ball.x - ((dx / L) * pull))
				local py = (sc.ball.y - ((dy / L) * pull))
				if ((py > y2) and (across < NEW_VIEW_WIDTH_M)) then
					do continue end
				end
				local need = Js.alit(xLo, xHi, (px - 0.5), (px + 0.5))
				local nLo = Math.min(Js.unpack(need))
				local nHi = Math.max(Js.unpack(need))
				if (((nHi - nLo) > down) and (across < NEW_VIEW_WIDTH_M)) then
					do continue end
				end
				local x1 = (((xLo + xHi) / 2) - (down / 2))
				x1 = Math.min(nLo, Math.max((nHi - down), x1))
				do return Js.O({ x1 = x1, x2 = (x1 + down), y1 = y1, y2 = y2 }, { "x1", "x2", "y1", "y2" }) end
			end
		end
	end
	exports.sideOnCamera = sideOnCamera
	cameraFor = function(sc, engineFrame, hw)
		local facing = (if sc.facing ~= nil then sc.facing else "up")
		if ((facing ~= "up") and A.includes(WIDE_TURN_KINDS, sc.kind)) then
			do return sideOnCamera(sc, hw) end
		end
		local across = acrossFor(sc.kind, engineFrame, facing)
		if (across == "passers") then
			do return passersCameraFor(sc, engineFrame, facing, hw) end
		end
		do return newViewCamera(engineFrame, facing, hw, sc.ball, across) end
	end
	exports.cameraFor = cameraFor
	playAreaFor = function(sc, cam, engineFrame)
		local area = Js.O({ x1 = Math.min(cam.x1, engineFrame.x1), x2 = Math.max(cam.x2, engineFrame.x2), y1 = Math.min(cam.y1, engineFrame.y1), y2 = Math.max(cam.y2, engineFrame.y2) }, { "x1", "x2", "y1", "y2" })
		if M_canvasEngine.goalInView(sc.kind) then
			do return area end
		end
		local f = (if sc.facing ~= nil then sc.facing else "up")
		if (f == "up") then
			do return Js.ospread(area, Js.O({ y1 = engineFrame.y1 }, { "y1" })) end
		end
		if (f == "right") then
			do return Js.ospread(area, Js.O({ x1 = engineFrame.x1 }, { "x1" })) end
		end
		do return Js.ospread(area, Js.O({ x2 = engineFrame.x2 }, { "x2" })) end
	end
	exports.playAreaFor = playAreaFor
	crossCutCamera = function(engineView, hw, ball, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		local across = Math.min(NEW_VIEW_WIDTH_M, Math.max(NEW_VIEW_CROSS_CUT_WIDTH_M, ((engineView.x2 - engineView.x1) + 0.5)))
		local cam = newViewCamera(engineView, "up", hw, ball, across)
		do return fitCameraToTilt(cam, "up", hw, tiltDeg, Js.alit(ball, Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }))) end
	end
	exports.crossCutCamera = crossCutCamera
	newViewCanvasHeight = function(widthPx, roomPx)
		local lo = (widthPx * NEW_VIEW_MIN_HW)
		local hi = (widthPx * NEW_VIEW_MAX_HW)
		if (not (roomPx > 0)) then
			do return Math.round(hi) end
		end
		do return Math.round(Math.max(lo, Math.min(hi, roomPx))) end
	end
	exports.newViewCanvasHeight = newViewCanvasHeight
	keyPointsOf = function(sc)
		local decorative = ((sc.kind == "volley") or (sc.kind == "header"))
		local pts = Js.aspread(Js.alit(sc.ball, sc.player), sc.defenders, (if decorative then Js.alit() else sc.teammates))
		if sc.runner then
			A.push(pts, sc.runner.pos)
		end
		do
			local _arr44 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i45 = 0
			while _i45 < Js.alen(_arr44) do
				_i45 += 1
				local r = _arr44[_i45]
				A.push(pts, r.pos)
			end
		end
		if M_canvasEngine.goalInView(sc.kind) then
			A.push(pts, Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }))
		end
		do return A.filter(pts, onThePitch) end
	end
	exports.keyPointsOf = keyPointsOf
	fracOf = function(v, facing, p)
		local fx = ((p.x - v.x1) / (v.x2 - v.x1))
		local fy = ((p.y - v.y1) / (v.y2 - v.y1))
		if (facing == "right") then
			do return Js.O({ sx = (1 - fy), sy = fx }, { "sx", "sy" }) end
		end
		if (facing == "left") then
			do return Js.O({ sx = fy, sy = (1 - fx) }, { "sx", "sy" }) end
		end
		do return Js.O({ sx = fx, sy = fy }, { "sx", "sy" }) end
	end
	fitCameraToTilt = function(cam, facing, hw, tiltDeg, pts)
		local t = M_cameraTilt.tiltFor(tiltDeg, 1, Math.max(NEW_VIEW_MIN_HW, hw))
		local inView = function(sx, sy)
			return (if t then M_cameraTilt.visibleOnScreen(t, sx, sy, TILT_FIT_MARGIN) else ((((sx >= TILT_FIT_MARGIN) and (sx <= (1 - TILT_FIT_MARGIN))) and (sy >= TILT_FIT_MARGIN)) and (sy <= (1 - TILT_FIT_MARGIN))))
		end
		local ax = (if (facing == "right") then cam.x1 else (if (facing == "left") then cam.x2 else ((cam.x1 + cam.x2) / 2)))
		local ay = (if (facing == "up") then cam.y1 else ((cam.y1 + cam.y2) / 2))
		local grow = function(k)
			return Js.O({ x1 = (ax + ((cam.x1 - ax) * k)), x2 = (ax + ((cam.x2 - ax) * k)), y1 = (ay + ((cam.y1 - ay) * k)), y2 = (ay + ((cam.y2 - ay) * k)) }, { "x1", "x2", "y1", "y2" })
		end
		do
			local k = 1
			local _first46 = true
			while true do
				if not _first46 then
					k += 0.025
				end
				_first46 = false
				if not (k <= (TILT_FIT_MAX + 1e-9)) then break end
				local v = grow(k)
				if A.every(pts, function(p)
					local c = fracOf(v, facing, p)
					do return inView(c.sx, c.sy) end
				end) then
					do return v end
				end
			end
		end
		do return grow(TILT_FIT_MAX) end
	end
	exports.fitCameraToTilt = fitCameraToTilt
	setFramingV2Override = function(v)
		framingV2Override = v
		framingV2Listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setFramingV2Override = setFramingV2Override
	framingV2On = function()
		if (framingV2Override ~= nil) then
			do return framingV2Override end
		end
		local _ok47, _err48, _rv49 = pcall(function()
			do return Js.RET, ((Js.localStorage ~= nil) and (Js.localStorage.getItem(FRAMING_V2_KEY) == "1")) end
		end)
		if not _ok47 then
			do return false end
		elseif _err48 == Js.RET then
			return _rv49
		end
	end
	exports.framingV2On = framingV2On
	setFramingV2 = function(v)
		local _ok50, _err51, _rv52 = pcall(function()
			Js.localStorage.setItem(FRAMING_V2_KEY, (if v then "1" else "0"))
		end)
		if not _ok50 then
		elseif _err51 == Js.RET then
			return _rv52
		end
		framingV2Listeners:forEach(function(f)
			return f()
		end)
	end
	exports.setFramingV2 = setFramingV2
	useFramingV2 = function()
		do return M_react.useSyncExternalStore(function(f)
			framingV2Listeners:add(f)
			do return function()
				framingV2Listeners:delete(f)
			end end
		end, framingV2On, function()
			return false
		end) end
	end
	exports.useFramingV2 = useFramingV2
	framingV2Points = function(sc)
		local goalC = Js.O({ x = ((M_pitch.POST_L + M_pitch.POST_R) / 2), y = 0 }, { "x", "y" })
		local near = function(d)
			return ((Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) <= V2_DEFENDER_NEAR_M) or (distToSegment(d, sc.ball, goalC) <= (V2_DEFENDER_NEAR_M / 2)))
		end
		local pts = Js.aspread(Js.alit(sc.ball, sc.player, Js.O({ x = sc.keeper.x, y = sc.keeper.y }, { "x", "y" })), A.filter(sc.defenders, near))
		if sc.runner then
			A.push(pts, sc.runner.pos)
		end
		do
			local _arr53 = (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit())
			local _i54 = 0
			while _i54 < Js.alen(_arr53) do
				_i54 += 1
				local r = _arr53[_i54]
				A.push(pts, r.pos)
			end
		end
		do return Js.aspread(A.filter(pts, onThePitch), Js.alit(Js.O({ x = M_pitch.POST_L, y = (-M_pitch.NET_DEPTH) }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = (-M_pitch.NET_DEPTH) }, { "x", "y" }), Js.O({ x = M_pitch.POST_L, y = 0 }, { "x", "y" }), Js.O({ x = M_pitch.POST_R, y = 0 }, { "x", "y" }))) end
	end
	exports.framingV2Points = framingV2Points
	framingV2Camera = function(sc, hw, tiltDeg)
		if tiltDeg == nil then tiltDeg = 0 end
		if (((if sc.facing ~= nil then sc.facing else "up") ~= "up") or (not M_canvasEngine.goalInView(sc.kind))) then
			do return nil end
		end
		local H = Math.max(NEW_VIEW_MIN_HW, hw)
		local pts = framingV2Points(sc)
		local minX = (Math.min(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) - V2_ROOM_M)
		local maxX = (Math.max(Js.unpack(A.map(pts, function(p)
			return p.x
		end))) + V2_ROOM_M)
		local maxY = (Math.max(Js.unpack(A.map(pts, function(p)
			return p.y
		end))) + V2_ROOM_M)
		local ball = sc.ball
		local r = V2_BALL_ROOM
		do
			local across = V2_MIN_ACROSS_M
			local _first55 = true
			while true do
				if not _first55 then
					across += 0.5
				end
				_first55 = false
				if not (across <= (NEW_VIEW_WIDTH_M + 1e-9)) then break end
				local down = (across * H)
				local lo = Math.max((maxX - across), (ball.x - ((1 - r) * across)), (-EDGE_M))
				local hi = Math.min(minX, (ball.x - (r * across)), ((M_pitch.PITCH_W + EDGE_M) - across))
				if (lo > (hi + 1e-9)) then
					do continue end
				end
				local want = (((((M_pitch.POST_L + M_pitch.POST_R) / 2) + ball.x) / 2) - (across / 2))
				local x1 = Math.max(lo, Math.min(hi, want))
				do
					local room = r
					local _first56 = true
					while true do
						if not _first56 then
							room += 0.05
						end
						_first56 = false
						if not (room <= (0.5 + 1e-9)) then break end
						local y2 = Math.max(maxY, (ball.y + (room * down)))
						local y1 = Math.min((-V2_BEHIND_MIN_M), (y2 - down))
						y1 = Math.max(y1, (-(Math.max(V2_BEHIND_MIN_M, (V2_BEHIND_MAX_SHARE * down)))))
						if ((y1 + down) < maxY) then
							do continue end
						end
						local cam = fitCameraToTilt(Js.O({ x1 = x1, x2 = (x1 + across), y1 = y1, y2 = (y1 + down) }, { "x1", "x2", "y1", "y2" }), "up", hw, tiltDeg, pts)
						if v2OnGlass(cam, hw, tiltDeg, ball, pts) then
							do return cam end
						end
					end
				end
			end
		end
		do return nil end
	end
	exports.framingV2Camera = framingV2Camera
	v2OnGlass = function(cam, hw, tiltDeg, ball, pts)
		local t = M_cameraTilt.tiltFor(tiltDeg, 100, (100 * Math.max(NEW_VIEW_MIN_HW, hw)))
		local glass = function(p)
			local f = fracOf(cam, "up", p)
			if (not t) then
				do return Js.O({ gx = f.sx, gy = f.sy }, { "gx", "gy" }) end
			end
			local g = M_cameraTilt.canvasToScreen(t, f.sx, f.sy, t.W, t.H)
			do return Js.O({ gx = (g.X / t.W), gy = (g.Y / t.H) }, { "gx", "gy" }) end
		end
		local b = glass(ball)
		if (((b.gx < V2_BALL_ROOM) or (b.gx > (1 - V2_BALL_ROOM))) or (b.gy > (1 - V2_BALL_ROOM))) then
			do return false end
		end
		do return A.every(pts, function(p)
			local g = glass(p)
			do return ((((g.gx >= 0.02) and (g.gx <= 0.98)) and (g.gy >= 0.01)) and (g.gy <= 0.97)) end
		end) end
	end
	framingV2TurnsSideOn = function(sc)
		do return ((math.abs((sc.ball.x - ((M_pitch.POST_L + M_pitch.POST_R) / 2))) >= V2_WIDE_M) and (sc.ball.y <= V2_SIDE_MAX_Y)) end
	end
	exports.framingV2TurnsSideOn = framingV2TurnsSideOn
	hasRunupFree = function(kind)
		do return ((kind ~= "penalty") and (kind ~= "free_kick")) end
	end
	Js.reexport(exports, M_wideChances, { ["setWideChancesOverride"] = "setWideChancesOverride" })
	MATCH_VIEW_DEFAULT = "new"
	exports.MATCH_VIEW_DEFAULT = MATCH_VIEW_DEFAULT
	MATCH_VIEW_KEY = "star-match-view"
	exports.MATCH_VIEW_KEY = MATCH_VIEW_KEY
	override = nil
	stored = nil
	listeners = Js.Set.new()
	if (Js.window ~= nil) then
		Js.window.addEventListener("storage", function(e)
			if (e.key == MATCH_VIEW_KEY) then
				stored = nil
				listeners:forEach(function(f)
					return f()
				end)
			end
		end)
	end
	NEW_VIEW_WIDTH_M = 38
	exports.NEW_VIEW_WIDTH_M = NEW_VIEW_WIDTH_M
	NEW_VIEW_MAX_HW = (83 / 38)
	exports.NEW_VIEW_MAX_HW = NEW_VIEW_MAX_HW
	NEW_VIEW_MIN_HW = (8 / 5)
	exports.NEW_VIEW_MIN_HW = NEW_VIEW_MIN_HW
	NEW_FIGURE_SCALE = 0.8
	exports.NEW_FIGURE_SCALE = NEW_FIGURE_SCALE
	NEW_OUTFIELD_SHRINK = 1
	exports.NEW_OUTFIELD_SHRINK = NEW_OUTFIELD_SHRINK
	NEW_KEEPER_GROW = 1.25
	exports.NEW_KEEPER_GROW = NEW_KEEPER_GROW
	NEW_BALL_SCALE = 0.56
	exports.NEW_BALL_SCALE = NEW_BALL_SCALE
	FIGURES_AT_FULL_VIEW = M_canvasEngine.SCENARIO_KINDS
	exports.FIGURES_AT_FULL_VIEW = FIGURES_AT_FULL_VIEW
	figureGrowOverride = 1
	FIXED_FIGURES = true
	exports.FIXED_FIGURES = FIXED_FIGURES
	REFERENCE_CAMERA_M = 26.8
	exports.REFERENCE_CAMERA_M = REFERENCE_CAMERA_M
	MAN_M_UNZOOMED = ((M_render.MATCH_FIGURE_R_MULT * M_render.MATCH_FIGURE_HEIGHT_R) * NEW_FIGURE_SCALE)
	FIXED_MAN_M = ((MAN_M_UNZOOMED * REFERENCE_CAMERA_M) / NEW_VIEW_WIDTH_M)
	exports.FIXED_MAN_M = FIXED_MAN_M
	BEHIND_GOAL_M = (M_pitch.NET_DEPTH + 2.6)
	BOTTOM_ROOM_M = 6
	EDGE_M = 4
	TURNED_FAR_M = 7.5
	TURNED_NEAR_M = 8
	TURNED_BALL_DOWN = 0.8
	NEW_VIEW_KIND_WIDTH_M = Js.O({ long_range = NEW_VIEW_WIDTH_M, free_kick = 34, through_ball = 32, one_on_one = 30, corner = 32, byline_cross = 30, cutback = 28, tight_angle = 28, volley = 27, header = 27, penalty = 27, buildup = "passers", midfield_pass = "passers" }, { "long_range", "free_kick", "through_ball", "one_on_one", "corner", "byline_cross", "cutback", "tight_angle", "volley", "header", "penalty", "buildup", "midfield_pass" })
	exports.NEW_VIEW_KIND_WIDTH_M = NEW_VIEW_KIND_WIDTH_M
	NEW_VIEW_CROSS_CUT_WIDTH_M = 28
	exports.NEW_VIEW_CROSS_CUT_WIDTH_M = NEW_VIEW_CROSS_CUT_WIDTH_M
	PASSERS_MIN_M = 22
	PASSERS_SIDE_M = 5
	PASSERS_END_M = 6
	PASSERS_LANE_M = 6
	PASSERS_FIT_SIDE_M = 2.5
	PASSERS_FIT_END_M = 4
	PASSERS_FIT_MIN_M = 16
	PASSERS_FIT_OUT_M = 4
	PASSERS_FIT_MAX_M = (NEW_VIEW_WIDTH_M * 1.2)
	actionFitOverride = nil
	AIR_MIN_ACROSS_M = 25
	exports.AIR_MIN_ACROSS_M = AIR_MIN_ACROSS_M
	playZoomOverride = nil
	probe = false
	ZOOM_ROOM_M = 6
	exports.ZOOM_ROOM_M = ZOOM_ROOM_M
	ZOOM_SIDE_M = 0.9
	ZOOM_TOP_M = 1
	ZOOM_MAX = 2.5
	exports.ZOOM_MAX = ZOOM_MAX
	ZOOM_MIN_PULL_M = 5
	exports.ZOOM_MIN_PULL_M = ZOOM_MIN_PULL_M
	CROWD_NEAR_M = 10
	CROWD_MIN = 5
	CROWD_FRAME_M = 10
	CROWD_KINDS = Js.alit("header", "volley", "one_on_one", "tight_angle", "long_range")
	ACTION_BALL_M = 9
	exports.ACTION_BALL_M = ACTION_BALL_M
	ACTION_MATE_M = 15
	exports.ACTION_MATE_M = ACTION_MATE_M
	ACTION_MARK_M = 3.5
	ACTION_LANE_M = 4
	WHOLLY_ON_EDGE = 0.035
	exports.WHOLLY_ON_EDGE = WHOLLY_ON_EDGE
	CLEARLY_OFF_EDGE = 0.04
	exports.CLEARLY_OFF_EDGE = CLEARLY_OFF_EDGE
	DRAG_ROOM_SHARE = (M_canvasEngine.dragForFullPower(0) * 1.6)
	exports.DRAG_ROOM_SHARE = DRAG_ROOM_SHARE
	ACTION_ROOM_M = 3.5
	exports.ACTION_ROOM_M = ACTION_ROOM_M
	WIDE_TURN_KINDS = Js.alit("tight_angle", "cutback", "penalty")
	exports.WIDE_TURN_KINDS = WIDE_TURN_KINDS
	SIDE_BEHIND_M = (M_pitch.NET_DEPTH + 1.8)
	SIDE_DEPTH_ROOM_M = 2
	SIDE_EDGE_ROOM_M = 2
	SIDE_PULL_SHARE = 0.24
	SIDE_MIN_ACROSS_M = 16
	TILT_FIT_MAX = 1.45
	TILT_FIT_MARGIN = 0.03
	FRAMING_V2_KEY = "star-framing-v2"
	framingV2Override = nil
	framingV2Listeners = Js.Set.new()
	V2_BEHIND_MIN_M = (M_pitch.NET_DEPTH + 3)
	exports.V2_BEHIND_MIN_M = V2_BEHIND_MIN_M
	V2_BEHIND_MAX_SHARE = 0.25
	exports.V2_BEHIND_MAX_SHARE = V2_BEHIND_MAX_SHARE
	V2_MIN_ACROSS_M = 22
	exports.V2_MIN_ACROSS_M = V2_MIN_ACROSS_M
	V2_BALL_ROOM = 0.25
	exports.V2_BALL_ROOM = V2_BALL_ROOM
	V2_ROOM_M = 2
	V2_DEFENDER_NEAR_M = 14
	V2_WIDE_M = 11
	V2_SIDE_MAX_Y = 30
end
