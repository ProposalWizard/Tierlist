--!nocheck
--!nolint
-- Generated from lib/star/formationShape.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubFormation = import("lib/star/clubFormation")
	local M_playstyle = import("lib/star/playstyle")
	local M_pitch = import("lib/star/pitch")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local clamp, backSpan, BLOCK_SHIFT, APPLY_KINDS, defensiveLineOf, formationShapeInput, onTheBoxEdge, targetBlock, scoutTacticsFor, applyFormationShape, positionKeeper, coverCentre, enforceOnside, enforce
	defensiveLineOf = function(formation)
		local nCB = 0
		local nFB = 0
		do
			local _arr1 = formation.slots
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local s = _arr1[_i2]
				if (s.role == "CB") then
					nCB += 1
				elseif ((s.role == "LB") or (s.role == "RB")) then
					nFB += 1
				end
			end
		end
		local count = (if (nCB == 3) then 5 else (nCB + nFB))
		do return Js.O({ count = (if Js.T(count) then count else 4), isBack5 = (count >= 5) }, { "count", "isBack5" }) end
	end
	exports.defensiveLineOf = defensiveLineOf
	formationShapeInput = function(opponentClub, attackerStrength, defenderStrength)
		do return Js.O({ formation = M_clubFormation.formationForClub(opponentClub), playstyle = M_playstyle.playstyleForClub(opponentClub), attackerStrength = attackerStrength, defenderStrength = defenderStrength }, { "formation", "playstyle", "attackerStrength", "defenderStrength" }) end
	end
	exports.formationShapeInput = formationShapeInput
	onTheBoxEdge = function(lineY, ballDist, floor)
		if (ballDist <= M_pitch.BOX_DEPTH) then
			do return lineY end
		end
		do return clamp(Math.max(lineY, M_pitch.BOX_DEPTH), floor, Math.max(floor, (ballDist - 2.2))) end
	end
	exports.onTheBoxEdge = onTheBoxEdge
	targetBlock = function(input, ballX, ballY)
		local _d3 = input
		local formation = _d3.formation
		local playstyle = _d3.playstyle
		local attackerStrength = _d3.attackerStrength
		local defenderStrength = _d3.defenderStrength
		local line = defensiveLineOf(formation)
		local ballDist = clamp(ballY, 8, 45)
		local ballLat = (ballX - M_pitch.CX)
		local strengthSlide = ((-(clamp((attackerStrength - defenderStrength), -30, 30))) * 0.2)
		local formOffset = (if line.isBack5 then -2 else 0)
		local shift = clamp(((playstyle.lineBias + formOffset) + strengthSlide), -12, 10)
		local lineFloor = Math.max(4.5, (ballDist * 0.57))
		local lineY = clamp(((ballDist * 0.66) + shift), lineFloor, (ballDist - 2.2))
		lineY = onTheBoxEdge(lineY, ballDist, lineFloor)
		local kSweep = ((clamp((lineY - 8), 0, 16) * 0.09) * (0.4 + playstyle.keeperSweep))
		local keeperY = clamp((1.6 + kSweep), 1.2, 6.5)
		lineY = clamp(Math.max(lineY, (keeperY + 3)), (keeperY + 3), Math.max((keeperY + 3), (ballDist - 2.2)))
		local spanBase = backSpan(ballDist)
		local span = (spanBase * (if line.isBack5 then 1.28 else 1))
		local blockShift = clamp((ballLat * BLOCK_SHIFT), -8, 8)
		do return Js.O({ lineY = lineY, keeperY = keeperY, span = span, blockShift = blockShift, isBack5 = line.isBack5 }, { "lineY", "keeperY", "span", "blockShift", "isBack5" }) end
	end
	exports.targetBlock = targetBlock
	scoutTacticsFor = function(opponentClub, attackerStrength, defenderStrength)
		local formation = M_clubFormation.formationForClub(opponentClub)
		local line = defensiveLineOf(formation)
		local playstyle = M_playstyle.playstyleForClub(opponentClub)
		local strengthSlide = ((-(clamp((attackerStrength - defenderStrength), -30, 30))) * 0.2)
		local heightScore = (playstyle.lineBias + strengthSlide)
		local lineHeight = (if (heightScore >= 5) then "very high" else (if (heightScore >= 2) then "high" else (if (heightScore >= -2) then "medium" else (if (heightScore >= -6) then "deep" else "very deep"))))
		local gap = (attackerStrength - defenderStrength)
		local favourite = (if (gap >= 8) then "you" else (if (gap <= -8) then "them" else "even"))
		local backLine = (if line.isBack5 then "back five" else "back four")
		local frame = (if (favourite == "you") then "You're the favourites, so expect them to sit deeper and more compact than usual." else (if (favourite == "them") then "They're the stronger side, so expect them to push their line up and come at you." else "An even contest — expect them to hold their shape and pick their moments."))
		local summary = (((opponentClub .. " line up " .. formation.name .. " (a " .. backLine .. "), " .. S.toLowerCase(playstyle.name) .. ": ") .. (playstyle.blurb .. ". " .. frame)) .. (if playstyle.counters then " Watch the counter — keep men back when you commit forward." else ""))
		do return Js.O({ formationName = formation.name, backLine = backLine, playstyleName = playstyle.name, blurb = playstyle.blurb, lineHeight = lineHeight, favourite = favourite, counters = playstyle.counters, summary = summary }, { "formationName", "backLine", "playstyleName", "blurb", "lineHeight", "favourite", "counters", "summary" }) end
	end
	exports.scoutTacticsFor = scoutTacticsFor
	applyFormationShape = function(sc, input)
		if (not input) then
			do return end
		end
		if (not APPLY_KINDS:has(sc.kind)) then
			do return end
		end
		local n = Js.alen(sc.defenders)
		if (n == 0) then
			positionKeeper(sc, input)
			do return end
		end
		local line = defensiveLineOf(input.formation)
		local t = targetBlock(input, sc.ball.x, sc.ball.y)
		local ballDist = clamp(sc.ball.y, 8, 45)
		local backN = Math.min(n, line.count)
		local half = (t.span / 2)
		for i = 0, n - 1 do
			local d = sc.defenders[i + 1]
			if (i < backN) then
				local frac = (if (backN <= 1) then 0.5 else (i / (backN - 1)))
				local fromCentre = (math.abs((frac - 0.5)) * 2)
				d.x = ((M_pitch.CX + t.blockShift) + ((frac - 0.5) * t.span))
				d.y = ((t.lineY - 1.2) + (fromCentre * 2.4))
			else
				local j = (i - backN)
				local screenN = (n - backN)
				local frac = (if (screenN <= 1) then 0.5 else (j / (screenN - 1)))
				d.x = ((M_pitch.CX + (t.blockShift * 0.6)) + ((frac - 0.5) * (t.span * 0.55)))
				d.y = (t.lineY + Math.min((input.playstyle.compactness * 0.4), 10))
			end
		end
		positionKeeper(sc, input, t)
		enforce(sc, ballDist)
		coverCentre(sc, ballDist)
		enforceOnside(sc)
	end
	exports.applyFormationShape = applyFormationShape
	positionKeeper = function(sc, input, t)
		local target = (if t ~= nil then t else targetBlock(input, sc.ball.x, sc.ball.y))
		local ballLat = (sc.ball.x - M_pitch.CX)
		local kx = clamp((M_pitch.CX + clamp((ballLat * 0.22), -2.6, 2.6)), (M_pitch.POST_L - 1.5), (M_pitch.POST_R + 1.5))
		sc.keeper.x = kx
		sc.keeper.startX = kx
		sc.keeper.y = target.keeperY
	end
	coverCentre = function(sc, ballDist)
		if ((ballDist > 24) or (Js.alen(sc.defenders) == 0)) then
			do return end
		end
		local CENTRE_HALF = 6.5
		if A.some(sc.defenders, function(d)
			return (math.abs((d.x - M_pitch.CX)) <= CENTRE_HALF)
		end) then
			do return end
		end
		local best = sc.defenders[1]
		do
			local _arr4 = sc.defenders
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local d = _arr4[_i5]
				if (math.abs((d.x - M_pitch.CX)) < math.abs((best.x - M_pitch.CX))) then
					best = d
				end
			end
		end
		best.x = (M_pitch.CX + (((if (best.x >= M_pitch.CX) then 1 else -1) * CENTRE_HALF) * 0.55))
	end
	enforceOnside = function(sc)
		if ((not M_canvasEngine.goalInView(sc.kind)) or (sc.kind == "corner")) then
			do return end
		end
		local ys = A.map(sc.defenders, function(d)
			return d.y
		end)
		A.push(ys, sc.keeper.y)
		if (Js.alen(ys) < 2) then
			do return end
		end
		A.sort(ys, function(a, b)
			return (a - b)
		end)
		local line = ys[2]
		local onside = function(p)
			if (p.y < (line + 0.3)) then
				p.y = (line + 0.3)
			end
		end
		if sc.runner then
			onside(sc.runner.pos)
		end
		do
			local _arr6 = sc.secondaryRunners
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local r = _arr6[_i7]
				onside(r.pos)
			end
		end
		onside(sc.follower)
	end
	enforce = function(sc, ballDist)
		local vp = sc.viewport
		local inset = 1.4
		local xLo = (if vp then (vp.x1 + inset) else 8)
		local xHi = (if vp then (vp.x2 - inset) else (M_pitch.PITCH_W - 8))
		local yLo = (sc.keeper.y + 2.2)
		local yHi = Math.max(yLo, (ballDist - 1.3))
		do
			local _arr8 = sc.defenders
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local d = _arr8[_i9]
				d.x = clamp(d.x, xLo, xHi)
				d.y = clamp(d.y, yLo, yHi)
				if (Math.hypot((d.x - sc.ball.x), (d.y - sc.ball.y)) < 2.2) then
					d.y = clamp((d.y - 2.2), yLo, yHi)
				end
				if (Math.hypot((d.x - sc.player.x), (d.y - sc.player.y)) < 4) then
					d.x = clamp((d.x + (if (d.x >= sc.player.x) then 4 else -4)), xLo, xHi)
				end
			end
		end
		for pass = 0, 3 do
			local moved = false
			for a = 0, (Js.alen(sc.defenders)) - 1 do
				for b = (a + 1), (Js.alen(sc.defenders)) - 1 do
					local da = sc.defenders[a + 1]
					local db = sc.defenders[b + 1]
					local dx = (db.x - da.x)
					local dy = (db.y - da.y)
					local dist = Math.hypot(dx, dy)
					if ((dist >= 3) or (dist == 0)) then
						do continue end
					end
					local push = (((3 - dist) / 2) + 0.05)
					local ux = (dx / (if Js.T(dist) then dist else 1))
					local uy = (dy / (if Js.T(dist) then dist else 1))
					da.x = clamp((da.x - (ux * push)), xLo, xHi)
					db.x = clamp((db.x + (ux * push)), xLo, xHi)
					da.y = clamp((da.y - (uy * push)), yLo, yHi)
					db.y = clamp((db.y + (uy * push)), yLo, yHi)
					moved = true
				end
			end
			if (not moved) then
				do break end
			end
		end
	end
	clamp = function(v, lo, hi)
		return (if (v < lo) then lo else (if (v > hi) then hi else v))
	end
	backSpan = function(ballDist)
		return clamp((12.5 + (ballDist * 0.22)), 14, 21)
	end
	exports.backSpan = backSpan
	BLOCK_SHIFT = 0.33
	exports.BLOCK_SHIFT = BLOCK_SHIFT
	APPLY_KINDS = Js.Set.new(Js.alit("long_range", "tight_angle", "one_on_one", "cutback", "volley", "header", "byline_cross", "through_ball"))
end
