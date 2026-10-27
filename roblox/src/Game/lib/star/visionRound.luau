--!nocheck
--!nolint
-- Generated from lib/star/visionRound.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_visionMoments_json = import("lib/star/data/visionMoments_json")
	local M_visionChecks_json = import("lib/star/data/visionChecks_json")
	local M_authoredScenarios = import("lib/star/authoredScenarios")
	local M_pitch = import("lib/star/pitch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_season = import("lib/star/season")
	local M_scenarioEdit = import("lib/star/scenarioEdit")
	local M_cameraTilt = import("lib/star/cameraTilt")
	local LANE_CUT_M, MARKED_M, VIEW_HALF_W, MIN_PASS_M, MAX_PASS_M, ANSWER_ONSIDE_BY_M, TRAP_OFFSIDE_BY_M, MATE_CLEAR_M, KEEP_NEAR_MAN_M, KEEP_NEAR_LANE_M, KEEP_NEAR_BALL_M, DRAWN_KINDS, momentRows, setVisionMoments, passChecks, setVisionChecks, clearPictureCaches, passReach, visionMomentsReady, loading, loadVisionMoments, isMomentRow, realCache, realBases, drawnCache, drawnBases, distToSegment, laneGap, visionScenario, engineFrameFor, REACH_TRAP, REACH_ANSWER, judgeMen, visionAsk, inView, keptDefenders, judgeCache, judgedOnce, pictureFromBase, askMismatch, candidateCache, visionCandidates, PICK_FROM, LEVEL_SHARES, OWN_SHARE_BONUS, SHOWN_COST, SHOWN_RECENT_COST, SHOWN_RECENT, passOf, visionPictures, levelChain, buildLevels, visionLevelPictures, visionLevelPicturesAsync, nameOf, verdict, judgeTap, judgeKick, aimedMan, camToBox
	local boxToCam, tapPick
	setVisionMoments = function(file)
		local rows = (if (Js.T(file) and (type(file) == "table")) then file.moments else nil)
		momentRows = (if Js.Array.isArray(rows) then A.filter(rows, isMomentRow) else Js.alit())
		realCache = nil
		clearPictureCaches()
	end
	exports.setVisionMoments = setVisionMoments
	setVisionChecks = function(file)
		local f = file
		passChecks = (if ((((f and (type(f.goes) == "number")) and (f.goes > 0)) and Js.T(f.checks)) and (type(f.checks) == "table")) then Js.O({ goes = f.goes, checks = f.checks }, { "goes", "checks" }) else nil)
		clearPictureCaches()
	end
	exports.setVisionChecks = setVisionChecks
	clearPictureCaches = function()
		candidateCache:clear()
		judgeCache:clear()
		A.setlen(levelChain, 0)
	end
	passReach = function(id, i)
		local row = (function() local _v = passChecks; if _v == nil then return nil end; _v = _v.checks; _v = _v[id]; return _v end)()
		local v = (function() local _v = row; if _v == nil then return nil end; _v = _v[i + 1]; return _v end)()
		do return (if ((type(v) == "number") and passChecks) then (v / passChecks.goes) else nil) end
	end
	exports.passReach = passReach
	visionMomentsReady = function()
		do return (momentRows ~= nil) end
	end
	exports.visionMomentsReady = visionMomentsReady
	loadVisionMoments = function()
		if momentRows then
			do return Js.Promise.resolve() end
		end
		if (not loading) then
			local def = function(m)
				return (if m.default ~= nil then m.default else m)
			end
			loading = Js.Promise.all(Js.alit(Js.Promise.resolve(M_visionMoments_json):andThen(function(m)
				return setVisionMoments(def(m))
			end, function()
				return setVisionMoments(nil)
			end), Js.Promise.resolve(M_visionChecks_json):andThen(function(m)
				return setVisionChecks(def(m))
			end, function()
				return setVisionChecks(nil)
			end))):andThen(function()
				return nil
			end)
		end
		do return loading end
	end
	exports.loadVisionMoments = loadVisionMoments
	isMomentRow = function(r)
		local o = r
		do return (((((((((not (not o)) and (type(o.id) == "string")) and Js.Array.isArray(o.ball)) and Js.Array.isArray(o.mates)) and Js.Array.isArray(o.opps)) and Js.Array.isArray(o.keeper)) and Js.NumberNS.isInteger(o.real)) and (o.real >= 0)) and (o.real < Js.alen(o.mates))) end
	end
	realBases = function()
		if realCache then
			do return realCache end
		end
		local rows = (if momentRows ~= nil then momentRows else Js.alit())
		realCache = A.map(rows, function(r)
			return Js.O({ id = r.id, source = "real", kind = "through_ball", ball = Js.O({ x = r.ball[1], y = r.ball[2] }, { "x", "y" }), mates = A.map(r.mates, function(_p1, i)
				local x = _p1[1]
				local y = _p1[2]
				return Js.O({ x = x, y = y, name = (function() local _v = r.names; if _v == nil then return nil end; _v = _v[i + 1]; return _v end)() }, { "x", "y", "name" })
			end), answer = r.real, opps = A.map(r.opps, function(_p2)
				local x = _p2[1]
				local y = _p2[2]
				return Js.O({ x = x, y = y }, { "x", "y" })
			end), keeper = Js.O({ x = r.keeper[1], y = r.keeper[2] }, { "x", "y" }), match = r.match, minute = r.minute, passer = r.passer, src = r.src }, { "id", "source", "kind", "ball", "mates", "answer", "opps", "keeper", "match", "minute", "passer", "src" })
		end)
		do return realCache end
	end
	exports.realBases = realBases
	drawnBases = function()
		if drawnCache then
			do return drawnCache end
		end
		local out = Js.alit()
		do
			local _arr3 = Js.Object.values(M_authoredScenarios.AUTHORED_SCENARIOS)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local s = _arr3[_i4]
				local kind = (function() local _v = s.source; if _v == nil then return nil end; _v = _v.kind; return _v end)()
				if ((not Js.T(kind)) or (not A.includes(DRAWN_KINDS, kind))) then
					do continue end
				end
				if (((function() local _v = s.camera; if _v == nil then return nil end; _v = _v.facing; return _v end)() or "up") ~= "up") then
					do continue end
				end
				local mates = Js.alit()
				local answer = -1
				local opps = Js.alit()
				local keeper = nil
				do
					local _arr5 = s.players
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local p = _arr5[_i6]
						if (p.side == "teammate") then
							if (p.label == "TARGET") then
								answer = Js.alen(mates)
							end
							A.push(mates, Js.O({ x = p.x, y = p.y }, { "x", "y" }))
						elseif (p.side == "opponent") then
							if (p.label == "GK") then
								keeper = Js.O({ x = p.x, y = p.y }, { "x", "y" })
							else
								A.push(opps, Js.O({ x = p.x, y = p.y }, { "x", "y" }))
							end
						end
					end
				end
				if ((answer < 0) or (Js.alen(mates) < 2)) then
					do continue end
				end
				A.push(out, Js.O({ id = s.id, source = "drawn", kind = kind, ball = Js.O({ x = s.ball.x, y = s.ball.y }, { "x", "y" }), mates = mates, answer = answer, opps = opps, keeper = (if keeper ~= nil then keeper else Js.O({ x = M_pitch.CX, y = 1 }, { "x", "y" })) }, { "id", "source", "kind", "ball", "mates", "answer", "opps", "keeper" }))
			end
		end
		A.sort(out, function(a, b)
			return S.localeCompare(a.id, b.id)
		end)
		drawnCache = out
		do return out end
	end
	exports.drawnBases = drawnBases
	distToSegment = function(p, a, b)
		local dx = (b.x - a.x)
		local dy = (b.y - a.y)
		local l2 = ((dx * dx) + (dy * dy))
		local t = (if (l2 > 0) then Math.max(0, Math.min(1, ((((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / l2))) else 0)
		do return Math.hypot((p.x - (a.x + (t * dx))), (p.y - (a.y + (t * dy)))) end
	end
	laneGap = function(ball, to, opps)
		local len = (function() local _l = Math.hypot((to.x - ball.x), (to.y - ball.y)); if Js.T(_l) then return _l end; return 1 end)()
		local ux = ((to.x - ball.x) / len)
		local uy = ((to.y - ball.y) / len)
		local a = Js.O({ x = (ball.x + (ux * 1.5)), y = (ball.y + (uy * 1.5)) }, { "x", "y" })
		local b = Js.O({ x = (to.x - (ux * 1.2)), y = (to.y - (uy * 1.2)) }, { "x", "y" })
		local worst = 99
		do
			local _arr7 = opps
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local d = _arr7[_i8]
				worst = Math.min(worst, distToSegment(d, a, b))
			end
		end
		do return worst end
	end
	visionScenario = function(pic, seed)
		if seed == nil then seed = 1 end
		local sc = M_canvasEngine.buildScenario(pic.kind, M_season.mulberry32(Js.ushr(seed, 0)), 62, 60)
		sc.ball = Js.O({ x = pic.ball.x, y = pic.ball.y }, { "x", "y" })
		sc.player = Js.O({ x = pic.ball.x, y = (pic.ball.y + 0.8) }, { "x", "y" })
		sc.defenders = A.map(pic.defenders, function(d)
			return Js.O({ x = d.x, y = d.y }, { "x", "y" })
		end)
		local k = sc.keeper
		k.targetX = pic.keeper.x
		k.startX = k.targetX
		k.x = k.startX
		k.y = pic.keeper.y
		sc.keeperHoldsStart = true
		sc.runner = nil
		sc.passTarget = nil
		sc.teammates = Js.alit()
		sc.relayTo = nil
		sc.secondaryRunners = A.map(pic.options, function(o)
			return Js.O({ pos = Js.O({ x = o.x, y = o.y }, { "x", "y" }), to = Js.O({ x = o.x, y = o.y }, { "x", "y" }), speed = 7, moving = false, role = "support" }, { "pos", "to", "speed", "moving", "role" })
		end)
		sc.follower.x = M_scenarioEdit.OFF_PITCH.x
		sc.follower.y = M_scenarioEdit.OFF_PITCH.y
		sc.facing = "up"
		sc.viewport = engineFrameFor(pic)
		sc.chainDepth = 0
		do return sc end
	end
	exports.visionScenario = visionScenario
	engineFrameFor = function(pic)
		local pts = Js.aspread(Js.alit(pic.ball), pic.options, pic.defenders)
		local xs = A.map(pts, function(p)
			return p.x
		end)
		local ys = A.map(pts, function(p)
			return p.y
		end)
		local x1 = Math.max(-2, (Math.min(Js.unpack(xs)) - 5))
		local x2 = Math.min((M_pitch.PITCH_W + 2), (Math.max(Js.unpack(xs)) + 5))
		local y1 = (if M_canvasEngine.goalInView(pic.kind) then -2 else (Math.min(Js.unpack(ys)) - 6))
		local y2 = Math.min((M_pitch.HALF_LEN + 30), (Math.max(Js.unpack(ys)) + 8))
		do return Js.O({ x1 = x1, x2 = x2, y1 = y1, y2 = y2 }, { "x1", "x2", "y1", "y2" }) end
	end
	judgeMen = function(kind, ball, men, opps, keeper, reach)
		if reach == nil then reach = Js.alit() end
		local sc = visionScenario(Js.O({ kind = kind, ball = ball, options = men, defenders = opps, keeper = keeper }, { "kind", "ball", "options", "defenders", "keeper" }))
		M_canvasEngine.offsideSnapshot(sc, Js.O({ x = ball.x, y = ball.y }, { "x", "y" }))
		local line = (if M_canvasEngine.goalInView(kind) then A.sort(Js.aspread(A.map(opps, function(d)
			return d.y
		end), Js.alit(keeper.y)), function(a, b)
			return (a - b)
		end)[2] else nil)
		do return A.map(men, function(m, i)
			local onside = (not sc.secondaryRunners[i + 1].offside)
			local space = A.reduce(opps, function(s, d)
				return Math.min(s, Math.hypot((d.x - m.x), (d.y - m.y)))
			end, 99)
			local lane = laneGap(ball, m, opps)
			local score = (if onside then M_canvasEngine.spaceScore(m, sc, sc.player) else 0)
			local r = reach[i + 1]
			local lost = (if (r ~= nil) then (r < REACH_TRAP) else ((lane < LANE_CUT_M) or (space < MARKED_M)))
			local trap = (if (not onside) then "offside" else (if (not lost) then nil else (if ((space < (MARKED_M + 0.4)) and ((r ~= nil) or (lane >= LANE_CUT_M))) then "marked" else "lane")))
			do return Js.ospread(Js.O({ x = m.x, y = m.y, onside = onside, lineGap = (if (line == nil) then math.huge else (m.y - line)), space = space, lane = lane, score = score, trap = trap }, { "x", "y", "onside", "lineGap", "space", "lane", "score", "trap" }), (if (r ~= nil) then Js.O({ reach = r }, { "reach" }) else Js.O({}, nil))) end
		end) end
	end
	exports.judgeMen = judgeMen
	visionAsk = function(row)
		do return Js.O({ options = row.options, traps = row.traps, margin = row.margin, real = row.real, offside = row.offside }, { "options", "traps", "margin", "real", "offside" }) end
	end
	exports.visionAsk = visionAsk
	inView = function(ball, m)
		local d = Math.hypot((m.x - ball.x), (m.y - ball.y))
		do return (((((math.abs((m.x - ball.x)) <= VIEW_HALF_W) and (d >= MIN_PASS_M)) and (d <= MAX_PASS_M)) and (m.y >= 0.5)) and (m.y <= (M_pitch.HALF_LEN + 8))) end
	end
	keptDefenders = function(kind, ball, shown, opps, keeper)
		local keep = Js.Set.new()
		A.forEach(opps, function(d, i)
			if (Math.hypot((d.x - ball.x), (d.y - ball.y)) <= KEEP_NEAR_BALL_M) then
				keep:add(i)
			end
			do
				local _arr11 = shown
				local _i12 = 0
				while _i12 < Js.alen(_arr11) do
					_i12 += 1
					local m = _arr11[_i12]
					if ((Math.hypot((d.x - m.x), (d.y - m.y)) <= KEEP_NEAR_MAN_M) or (laneGap(ball, m, Js.alit(d)) <= KEEP_NEAR_LANE_M)) then
						keep:add(i)
					end
				end
			end
		end)
		if M_canvasEngine.goalInView(kind) then
			local order = A.sort(A.map(opps, function(d, i)
				return Js.O({ i = i, y = d.y }, { "i", "y" })
			end), function(a, b)
				return (a.y - b.y)
			end)
			local deepest = A.sort(Js.aspread(A.map(order, function(o)
				return o.y
			end), Js.alit(keeper.y)), function(a, b)
				return (a - b)
			end)
			do
				local _arr13 = order
				local _i14 = 0
				while _i14 < Js.alen(_arr13) do
					_i14 += 1
					local o = _arr13[_i14]
					if (o.y <= (deepest[2] + 0.000001)) then
						keep:add(o.i)
					end
				end
			end
		end
		do return A.filter(opps, function(_, i)
			return keep:has(i)
		end) end
	end
	judgedOnce = function(key, judge)
		local v = judgeCache:get(key)
		if (not v) then
			v = judge()
			judgeCache:set(key, v)
		end
		do return v end
	end
	pictureFromBase = function(base, ask)
		local reach = A.map(base.mates, function(_, i)
			return passReach(base.id, i)
		end)
		local all = judgedOnce((base.source .. ":" .. base.id), function()
			return judgeMen(base.kind, base.ball, base.mates, base.opps, base.keeper, reach)
		end)
		local A_ = all[base.answer + 1]
		local am = base.mates[base.answer + 1]
		if (((((not A_.onside) or (A_.lineGap < ANSWER_ONSIDE_BY_M)) or Js.T(A_.trap)) or (A_.score < 0.3)) or (not inView(base.ball, am))) then
			do return nil end
		end
		if (if (A_.reach ~= nil) then (A_.reach < REACH_ANSWER) else (A_.lane < (LANE_CUT_M + 0.5))) then
			do return nil end
		end
		local inAnswersPath = function(m)
			local len = (function() local _l = Math.hypot((am.x - base.ball.x), (am.y - base.ball.y)); if Js.T(_l) then return _l end; return 1 end)()
			local t = ((((m.x - base.ball.x) * (am.x - base.ball.x)) + ((m.y - base.ball.y) * (am.y - base.ball.y))) / (len * len))
			do return (((t > 0.05) and (t < 1.1)) and (distToSegment(m, base.ball, am) < MATE_CLEAR_M)) end
		end
		local others = A.filter(A.map(all, function(o, i)
			return Js.O({ o = o, i = i }, { "o", "i" })
		end), function(_p15)
			local i = _p15.i
			return (((i ~= base.answer) and inView(base.ball, base.mates[i + 1])) and (not inAnswersPath(base.mates[i + 1])))
		end)
		local traps = A.filter(others, function(_p16)
			local o = _p16.o
			return (if Js.T(o.trap) then ((o.trap ~= "offside") or (o.lineGap <= (-TRAP_OFFSIDE_BY_M))) else o.trap)
		end)
		local minGap = Math.max(0.015, Math.min(0.1, (ask.margin * 0.5)))
		local lesser = A.filter(others, function(_p17)
			local o = _p17.o
			return ((not Js.T(o.trap)) and (o.score < (A_.score - minGap)))
		end)
		local want = (Math.max(1, Math.round(ask.options)) - 1)
		local wantTraps = Math.max((if ask.offside then 1 else 0), Math.min(want, Math.round(ask.traps)))
		if (ask.offside and (not A.some(traps, function(t)
			return (t.o.trap == "offside")
		end))) then
			do return nil end
		end
		local byKind = Js.O({ offside = Js.alit(), lane = Js.alit(), marked = Js.alit() }, { "offside", "lane", "marked" })
		do
			local _arr18 = traps
			local _i19 = 0
			while _i19 < Js.alen(_arr18) do
				_i19 += 1
				local t = _arr18[_i19]
				A.push(byKind[t.o.trap], t)
			end
		end
		do
			local _arr20 = Js.Object.keys(byKind)
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local k = _arr20[_i21]
				A.sort(byKind[k], function(a, b)
					return (function() local _l = (b.o.score - a.o.score); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
				end)
			end
		end
		local pickedTraps = Js.alit()
		do
			local round = 0
			local _first22 = true
			while true do
				if not _first22 then
					round += 1
				end
				_first22 = false
				if not ((Js.alen(pickedTraps) < wantTraps) and (round < 6)) then break end
				do
					local _arr23 = Js.alit("offside", "lane", "marked")
					local _i24 = 0
					while _i24 < Js.alen(_arr23) do
						_i24 += 1
						local k = _arr23[_i24]
						if (Js.alen(pickedTraps) >= wantTraps) then
							do break end
						end
						local t = byKind[k][round + 1]
						if t then
							A.push(pickedTraps, t)
						end
					end
				end
			end
		end
		local wantLesser = (want - Js.alen(pickedTraps))
		local target = (A_.score - ask.margin)
		local sorted = A.sort(Js.aspread(lesser), function(a, b)
			return (function() local _l = (math.abs((a.o.score - target)) - math.abs((b.o.score - target))); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
		end)
		local pickedLesser = Js.alit()
		if ((wantLesser > 0) and Js.T(Js.alen(sorted))) then
			A.push(pickedLesser, sorted[1])
			local rest = A.sort(A.filter(lesser, function(x)
				return (x ~= sorted[1])
			end), function(a, b)
				return (function() local _l = (b.o.score - a.o.score); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
			end)
			do
				local _arr25 = rest
				local _i26 = 0
				while _i26 < Js.alen(_arr25) do
					_i26 += 1
					local r = _arr25[_i26]
					if (Js.alen(pickedLesser) >= wantLesser) then
						do break end
					end
					A.push(pickedLesser, r)
				end
			end
		end
		local shownIdx = Js.aspread(Js.alit(base.answer), A.map(pickedTraps, function(t)
			return t.i
		end), A.map(pickedLesser, function(l)
			return l.i
		end))
		if (Js.alen(shownIdx) < 2) then
			do return nil end
		end
		A.sort(shownIdx, function(a, b)
			return (function() local _l = (base.mates[a + 1].x - base.mates[b + 1].x); if Js.T(_l) then return _l end; return (a - b) end)()
		end)
		local shownMen = A.map(shownIdx, function(i)
			return base.mates[i + 1]
		end)
		local defenders = keptDefenders(base.kind, base.ball, shownMen, base.opps, base.keeper)
		local judged = judgedOnce((base.source .. ":" .. base.id .. "|" .. A.join(shownIdx, ",")), function()
			return judgeMen(base.kind, base.ball, shownMen, defenders, base.keeper, A.map(shownIdx, function(i)
				return reach[i + 1]
			end))
		end)
		local best = A.indexOf(shownIdx, base.answer)
		local B = judged[best + 1]
		if ((not B.onside) or Js.T(B.trap)) then
			do return nil end
		end
		local rival = 0
		local trapsShown = 0
		A.forEach(judged, function(o, i)
			if (i == best) then
				do return end
			end
			if Js.T(o.trap) then
				trapsShown += 1
			else
				rival = Math.max(rival, o.score)
			end
		end)
		if (rival >= (B.score - 0.01)) then
			do return nil end
		end
		do return Js.O({ id = base.id, source = base.source, kind = base.kind, ball = Js.ospread(base.ball), options = A.map(judged, function(o, i)
			return Js.ospread(o, Js.O({ name = shownMen[i + 1].name }, { "name" }))
		end), best = best, defenders = defenders, keeper = Js.ospread(base.keeper), margin = (if (rival > 0) then (B.score - rival) else 1), traps = trapsShown, match = base.match, minute = base.minute, passer = base.passer, src = base.src }, { "id", "source", "kind", "ball", "options", "best", "defenders", "keeper", "margin", "traps", "match", "minute", "passer", "src" }) end
	end
	exports.pictureFromBase = pictureFromBase
	askMismatch = function(p, ask)
		local m = Math.min(0.45, p.margin)
		local A_ = p.options[p.best + 1]
		local easy = Math.max(0, Math.min(1, ((ask.margin - 0.15) / 0.2)))
		local unclear = (((1 - (if A_.reach ~= nil then A_.reach else 0.9)) * 4) + (Math.max(0, (4 - A_.space)) * 0.4))
		local off = (m - ask.margin)
		do return ((((math.abs((Js.alen(p.options) - ask.options)) * 1.2) + (math.abs((p.traps - ask.traps)) * 0.8)) + (if (off < 0) then ((-off) * 10) else (off * 5))) + (easy * unclear)) end
	end
	exports.askMismatch = askMismatch
	visionCandidates = function(ask)
		local key = Js.JSON.stringify(Js.alit(ask.options, ask.traps, ask.margin, ask.real, (not (not ask.offside)), ((function() local _v = momentRows; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or -1)))
		local hit = candidateCache:get(key)
		if hit then
			do return hit end
		end
		local pool = (if ask.real then realBases() else drawnBases())
		local out = Js.alit()
		do
			local _arr27 = pool
			local _i28 = 0
			while _i28 < Js.alen(_arr27) do
				_i28 += 1
				local b = _arr27[_i28]
				local p = pictureFromBase(b, ask)
				if p then
					A.push(out, p)
				end
			end
		end
		A.sort(out, function(a, b)
			return (function() local _l = (askMismatch(a, ask) - askMismatch(b, ask)); if Js.T(_l) then return _l end; return S.localeCompare(a.id, b.id) end)()
		end)
		candidateCache:set(key, out)
		do return out end
	end
	exports.visionCandidates = visionCandidates
	visionPictures = function(ask, seed, tries, level, shown)
		if tries == nil then tries = 3 end
		local r = M_season.mulberry32(Js.ushr(Js.bxor(seed, 20973), 0))
		local share = function(p)
			local h = 2166136261
			for _ok29, _v30 in Js.iter(passOf(p)) do
				local ch = _v30
				h = Js.ushr(Math.imul(Js.bxor(h, S.charCodeAt(ch, 0)), 16777619), 0)
			end
			do return math.fmod(h, LEVEL_SHARES) end
		end
		local shownCost = function(p)
			local s = (function() local _r = shown; if _r == nil then return nil end; return _r:get(passOf(p)) end)()
			if (not s) then
				do return 0 end
			end
			do return ((SHOWN_COST * s.times) + (if ((level ~= nil) and ((level - s.last) <= SHOWN_RECENT)) then SHOWN_RECENT_COST else 0)) end
		end
		local fit = function(p, a)
			return ((askMismatch(p, a) + shownCost(p)) - (if (((level ~= nil) and (p.source == "real")) and (share(p) == math.fmod(level, LEVEL_SHARES))) then OWN_SHARE_BONUS else 0))
		end
		local shuffled = function(all, a)
			local list = A.sort(Js.aspread(all), function(x, y)
				return (function() local _l = (fit(x, a) - fit(y, a)); if Js.T(_l) then return _l end; return S.localeCompare(x.id, y.id) end)()
			end)
			local bar = (if Js.T(Js.alen(list)) then (fit(list[Math.min(Js.alen(list), tries)], a) + 0.8) else 0)
			do return A.map(A.sort(A.map(A.filter(A.slice(list, 0, Math.max(tries, PICK_FROM)), function(p, i)
				return ((i < tries) or (fit(p, a) <= bar))
			end), function(p, i)
				return Js.O({ p = p, k = r(), i = i }, { "p", "k", "i" })
			end), function(x, y)
				return (function() local _l = (x.k - y.k); if Js.T(_l) then return _l end; return (x.i - y.i) end)()
			end), function(x)
				return x.p
			end) end
		end
		local plain = Js.ospread(ask, Js.O({ offside = false }, { "offside" }))
		local order = shuffled(visionCandidates(plain), plain)
		if ((not Js.T(Js.alen(order))) and (not ask.real)) then
			order = shuffled(visionCandidates(Js.ospread(plain, Js.O({ real = true }, { "real" }))), Js.ospread(plain, Js.O({ real = true }, { "real" })))
		end
		local offAsk = (if Js.T(Js.alen(visionCandidates(ask))) then ask else Js.ospread(ask, Js.O({ real = true }, { "real" })))
		local offCands = (if ask.offside then A.sort(Js.aspread(visionCandidates(offAsk)), function(x, y)
			return (function() local _l = (((askMismatch(x, offAsk) + shownCost(x)) - askMismatch(y, offAsk)) - shownCost(y)); if Js.T(_l) then return _l end; return S.localeCompare(x.id, y.id) end)()
		end) else Js.alit())
		local offsideFirst = (if Js.T(Js.alen(offCands)) then offCands[math.floor((r() * Math.min(3, Js.alen(offCands)))) + 1] else nil)
		if ((not Js.T(Js.alen(order))) and (not offsideFirst)) then
			do return Js.alit() end
		end
		local out = Js.alit()
		local used = Js.Set.new()
		if offsideFirst then
			used:add(passOf(offsideFirst))
		end
		do
			local _arr31 = order
			local _i32 = 0
			while _i32 < Js.alen(_arr31) do
				_i32 += 1
				local p = _arr31[_i32]
				if (Js.alen(out) >= (tries - (if offsideFirst then 1 else 0))) then
					do break end
				end
				if used:has(passOf(p)) then
					do continue end
				end
				used:add(passOf(p))
				A.push(out, p)
			end
		end
		if offsideFirst then
			A.splice(out, math.fmod(math.floor((r() * tries)), (Js.alen(out) + 1)), 0, offsideFirst)
		end
		local fill = (if Js.T(Js.alen(order)) then order else Js.alit(offsideFirst))
		do
			local t = 0
			local _first33 = true
			while true do
				if not _first33 then
					t += 1
				end
				_first33 = false
				if not (Js.alen(out) < tries) then break end
				A.push(out, fill[math.fmod(t, Js.alen(fill)) + 1])
			end
		end
		do return out end
	end
	exports.visionPictures = visionPictures
	buildLevels = function(level, levelOf, tries)
		return Js.gen(function()
			local shown = Js.Map.new()
			for n = 1, math.floor(level) do
				local _d34 = levelOf(n)
				local ask = _d34.ask
				local seed = _d34.seed
				local key = Js.JSON.stringify(Js.alit(ask, seed, tries, ((function() local _v = momentRows; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or -1), (passChecks == nil)))
				if ((function() local _v = levelChain[n]; if _v == nil then return nil end; _v = _v.key; return _v end)() ~= key) then
					local _ = coroutine.yield(nil)
					A.setlen(levelChain, (n - 1))
					A.push(levelChain, Js.O({ key = key, pics = visionPictures(ask, seed, tries, n, shown) }, { "key", "pics" }))
				end
				do
					local _arr35 = levelChain[n].pics
					local _i36 = 0
					while _i36 < Js.alen(_arr35) do
						_i36 += 1
						local p = _arr35[_i36]
						local s = shown:get(passOf(p))
						shown:set(passOf(p), Js.O({ times = (((function() local _v = s; if _v == nil then return nil end; _v = _v.times; return _v end)() or 0) + 1), last = n }, { "times", "last" }))
					end
				end
			end
			do return ((function() local _v = levelChain[level]; if _v == nil then return nil end; _v = _v.pics; return _v end)() or Js.alit()) end
		end)
	end
	visionLevelPictures = function(level, levelOf, tries)
		if tries == nil then tries = 3 end
		local it = buildLevels(level, levelOf, tries)
		do
			local _first37 = true
			while true do
				_first37 = false
				local s = it:next()
				if s.done then
					do return s.value end
				end
			end
		end
	end
	exports.visionLevelPictures = visionLevelPictures
	visionLevelPicturesAsync = function(level, levelOf, tries)
		if tries == nil then tries = 3 end
		local it = buildLevels(level, levelOf, tries)
		do
			local _first38 = true
			while true do
				_first38 = false
				local s = it:next()
				if s.done then
					do return s.value end
				end
				Js.Promise.new(function(res)
					return Js.setTimeout(res, 0)
				end)
			end
		end
	end
	exports.visionLevelPicturesAsync = visionLevelPicturesAsync
	verdict = function(p, result, picked)
		local right = nameOf(p, p.best)
		local him = (if (picked ~= nil) then nameOf(p, picked) else "")
		local rightMan = (if Js.T(right) then (right .. " was the ball") else "The free man was the ball")
		local _sw39 = result
		if _sw39 == "right" then
			do return Js.O({ ok = true, result = result, word = "RIGHT MAN", line = (if Js.T(right) then (right .. ": onside, free and the lane open.") else "Onside, free and the lane open.") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "offside" then
			do return Js.O({ ok = false, result = result, word = "OFFSIDE", line = ((if Js.T(him) then him else "He") .. " was beyond the last man. " .. rightMan .. ".") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "cut" then
			do return Js.O({ ok = false, result = result, word = "CUT OUT", line = ("A defender was in the lane. " .. rightMan .. ".") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "marked" then
			do return Js.O({ ok = false, result = result, word = "MARKED", line = ((if Js.T(him) then him else "He") .. " had a man on his back. " .. rightMan .. ".") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "wrong" then
			do return Js.O({ ok = false, result = result, word = "NOT THE BALL", line = ((if Js.T(him) then (him .. " was on, but ") else "") .. (if Js.T(right) then right else "the highlighted man") .. " was the better ball.") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "missed" then
			do return Js.O({ ok = false, result = result, word = "MISPLACED", line = ("The pass didn't find him. " .. rightMan .. ".") }, { "ok", "result", "word", "line" }) end
		elseif _sw39 == "slow" then
			do return Js.O({ ok = false, result = result, word = "TOO SLOW", line = (rightMan .. ".") }, { "ok", "result", "word", "line" }) end
		end
	end
	judgeTap = function(p, i)
		if (i == nil) then
			do return verdict(p, "slow", nil) end
		end
		if (i == p.best) then
			do return verdict(p, "right", i) end
		end
		local t = (function() local _v = p.options[i + 1]; if _v == nil then return nil end; _v = _v.trap; return _v end)()
		do return verdict(p, (if (t == "offside") then "offside" else (if (t == "lane") then "cut" else (if (t == "marked") then "marked" else "wrong"))), i) end
	end
	exports.judgeTap = judgeTap
	judgeKick = function(p, sc, outcome, aimedAt, offsideAtStrike)
		if aimedAt == nil then aimedAt = nil end
		if (sc.offsideAgainst or (outcome == "offside")) then
			local off = A.findIndex(sc.secondaryRunners, function(r)
				return (r.offside and (r == sc.receivedBy))
			end)
			do return verdict(p, "offside", (if (off >= 0) then off else aimedAt)) end
		end
		local by = (if sc.receivedBy then A.indexOf(sc.secondaryRunners, sc.receivedBy) else -1)
		if (by >= 0) then
			if (by == p.best) then
				do return verdict(p, "right", by) end
			end
			local t = (function() local _v = p.options[by + 1]; if _v == nil then return nil end; _v = _v.trap; return _v end)()
			do return verdict(p, (if (t == "marked") then "marked" else (if (t == "lane") then "cut" else "wrong")), by) end
		end
		if (outcome == nil) then
			do return nil end
		end
		if ((aimedAt ~= nil) and (function() local _l = (function() local _v = offsideAtStrike; if _v == nil then return nil end; _v = _v[aimedAt + 1]; return _v end)(); if _l ~= nil then return _l end; return (function() local _v = sc.secondaryRunners[aimedAt + 1]; if _v == nil then return nil end; _v = _v.offside; return _v end)() end)()) then
			do return verdict(p, "offside", aimedAt) end
		end
		if (((((outcome == "tackled") or (outcome == "blocked")) or (outcome == "caught")) or (outcome == "saved")) or (outcome == "tipped")) then
			do return verdict(p, "cut", aimedAt) end
		end
		do return verdict(p, "missed", aimedAt) end
	end
	exports.judgeKick = judgeKick
	aimedMan = function(p, dir)
		local L = Math.hypot(dir.x, dir.y)
		if (not (L > 0.000001)) then
			do return nil end
		end
		local best = nil
		local bestA = ((25 * Math.PI) / 180)
		A.forEach(p.options, function(o, i)
			local dx = (o.x - p.ball.x)
			local dy = (o.y - p.ball.y)
			local a = Math.acos(Math.max(-1, Math.min(1, (((dx * dir.x) + (dy * dir.y)) / ((function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)() * L)))))
			if (a < bestA) then
				bestA = a
				best = i
			end
		end)
		do return best end
	end
	exports.aimedMan = aimedMan
	camToBox = function(cam, p)
		local v = cam.viewport
		local f = cam.facing
		local fx = ((p.x - v.x1) / (v.x2 - v.x1))
		local fy = ((p.y - v.y1) / (v.y2 - v.y1))
		local sx = (if (f == "right") then (1 - fy) else (if (f == "left") then fy else fx))
		local sy = (if (f == "right") then fx else (if (f == "left") then (1 - fx) else fy))
		local g = M_cameraTilt.canvasToScreen(cam.tilt, sx, sy, cam.W, cam.H)
		do return Js.O({ x = g.X, y = g.Y }, { "x", "y" }) end
	end
	exports.camToBox = camToBox
	boxToCam = function(cam, X, Y)
		local _d40 = M_cameraTilt.screenToCanvas(cam.tilt, X, Y, cam.W, cam.H)
		local sx = _d40.sx
		local sy = _d40.sy
		local f = cam.facing
		local v = cam.viewport
		local fx = (if (f == "right") then sy else (if (f == "left") then (1 - sy) else sx))
		local fy = (if (f == "right") then (1 - sx) else (if (f == "left") then sx else sy))
		do return Js.O({ x = ((fx * (v.x2 - v.x1)) + v.x1), y = ((fy * (v.y2 - v.y1)) + v.y1) }, { "x", "y" }) end
	end
	exports.boxToCam = boxToCam
	tapPick = function(cam, men, X, Y, reachPx)
		if reachPx == nil then reachPx = 26 end
		local pxPerM = (cam.W / Math.max(1, (cam.viewport.x2 - cam.viewport.x1)))
		local bodyPx = Math.max(30, (2.4 * pxPerM))
		local best = -1
		local bd = reachPx
		A.forEach(men, function(m, i)
			local f = camToBox(cam, m)
			local dy = (if (Y > f.y) then (Y - f.y) else (if (Y < (f.y - bodyPx)) then ((f.y - bodyPx) - Y) else 0))
			local d = Math.hypot((X - f.x), dy)
			if (d < bd) then
				bd = d
				best = i
			end
		end)
		do return best end
	end
	exports.tapPick = tapPick
	LANE_CUT_M = 1.5
	exports.LANE_CUT_M = LANE_CUT_M
	MARKED_M = 1.6
	exports.MARKED_M = MARKED_M
	VIEW_HALF_W = 16.5
	exports.VIEW_HALF_W = VIEW_HALF_W
	MIN_PASS_M = 4
	exports.MIN_PASS_M = MIN_PASS_M
	MAX_PASS_M = 34
	exports.MAX_PASS_M = MAX_PASS_M
	ANSWER_ONSIDE_BY_M = 0.6
	TRAP_OFFSIDE_BY_M = 0.4
	MATE_CLEAR_M = 3
	KEEP_NEAR_MAN_M = 7.5
	KEEP_NEAR_LANE_M = 3.6
	KEEP_NEAR_BALL_M = 8
	DRAWN_KINDS = Js.alit("buildup", "midfield_pass", "through_ball")
	exports.DRAWN_KINDS = DRAWN_KINDS
	momentRows = nil
	passChecks = nil
	loading = nil
	realCache = nil
	drawnCache = nil
	REACH_TRAP = 0.4
	exports.REACH_TRAP = REACH_TRAP
	REACH_ANSWER = 0.8
	exports.REACH_ANSWER = REACH_ANSWER
	judgeCache = Js.Map.new()
	candidateCache = Js.Map.new()
	PICK_FROM = 8
	exports.PICK_FROM = PICK_FROM
	LEVEL_SHARES = 5
	exports.LEVEL_SHARES = LEVEL_SHARES
	OWN_SHARE_BONUS = 1.2
	SHOWN_COST = 1
	SHOWN_RECENT_COST = 1
	SHOWN_RECENT = 5
	passOf = function(p)
		return S.replace(p.id, Js.re("b$", ""), "")
	end
	levelChain = Js.alit()
	nameOf = function(p, i)
		local n = ((function() local _r = (function() local _v = p.options[i + 1]; if _v == nil then return nil end; _v = _v.name; return _v end)(); if _r == nil then return nil end; return S.trim(_r) end)() or "")
		do return (if Js.re("^No\\.\\s*\\d+$", ""):test(n) then n else (A.slice(S.split(n, " "), -1)[1] or "")) end
	end
end
