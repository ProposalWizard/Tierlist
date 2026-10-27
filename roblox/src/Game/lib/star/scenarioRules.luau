--!nocheck
--!nolint
-- Generated from lib/star/scenarioRules.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local POST_L, POST_R, sampleFromAuthored, offShotLine, inShotCorridor, sortedDist, MEASURES, MIN_SAMPLES_FOR_INVARIANT, INVARIANT_AGREEMENT, isLaw, deriveRuleSet, outliersOf, violations, drift, describeRuleSet
	sampleFromAuthored = function(ms)
		local you = A.find(ms.players, function(p)
			return (p.side == "you")
		end)
		local keeper = A.find(ms.players, function(p)
			return (p.label == "GK")
		end)
		if ((not you) or (not keeper)) then
			do return nil end
		end
		do return Js.O({ ball = Js.O({ x = ms.ball.x, y = ms.ball.y }, { "x", "y" }), you = Js.O({ x = you.x, y = you.y }, { "x", "y" }), keeper = Js.O({ x = keeper.x, y = keeper.y }, { "x", "y" }), defenders = A.map(A.filter(ms.players, function(p)
			return ((p.side == "opponent") and (p.label ~= "GK"))
		end), function(p)
			return Js.O({ x = p.x, y = p.y }, { "x", "y" })
		end), mates = A.map(A.filter(ms.players, function(p)
			return (p.side == "teammate")
		end), function(p)
			return Js.O({ x = p.x, y = p.y }, { "x", "y" })
		end) }, { "ball", "you", "keeper", "defenders", "mates" }) end
	end
	exports.sampleFromAuthored = sampleFromAuthored
	offShotLine = function(p, ball)
		local vx = (M_pitch.CX - ball.x)
		local vy = (0 - ball.y)
		local len = (function() local _l = Math.hypot(vx, vy); if Js.T(_l) then return _l end; return 1 end)()
		do return math.abs(((((p.x - ball.x) * vy) - ((p.y - ball.y) * vx)) / len)) end
	end
	inShotCorridor = function(d, ball)
		if (d.y >= ball.y) then
			do return false end
		end
		local t = (if (ball.y == 0) then 0 else ((ball.y - d.y) / ball.y))
		local lo = (ball.x + ((POST_L - ball.x) * t))
		local hi = (ball.x + ((POST_R - ball.x) * t))
		do return ((d.x >= (Math.min(lo, hi) - 1.2)) and (d.x <= (Math.max(lo, hi) + 1.2))) end
	end
	deriveRuleSet = function(kind, samples, ids)
		if ids == nil then ids = Js.alit() end
		local rules = Js.alit()
		do
			local _arr1 = MEASURES
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				local raw = A.map(samples, function(s)
					return m.of(s)
				end)
				local vs = A.sort(A.filter(raw, function(v)
					return Js.NumberNS.isFinite(v)
				end), function(a, b)
					return (a - b)
				end)
				if (not Js.T(Js.alen(vs))) then
					do continue end
				end
				local of = Js.alen(A.filter(raw, function(v)
					return Js.NumberNS.isFinite(v)
				end))
				local counts = Js.Map.new()
				do
					local _arr3 = raw
					local _i4 = 0
					while _i4 < Js.alen(_arr3) do
						_i4 += 1
						local v = _arr3[_i4]
						if Js.NumberNS.isFinite(v) then
							counts:set(v, ((counts:get(v) or 0) + 1))
						end
					end
				end
				local at = 0
				local obey = 0
				counts:forEach(function(n, v)
					if (n > obey) then
						at = v
						obey = n
					end
				end)
				local invariant = (((of >= MIN_SAMPLES_FOR_INVARIANT) and isLaw(m)) and ((obey / of) >= INVARIANT_AGREEMENT))
				A.push(rules, Js.O({ id = m.id, label = m.label, count = (not (not m.count)), ratio = (not (not m.ratio)), min = vs[1], max = vs[Js.alen(vs)], median = vs[math.floor((Js.alen(vs) / 2)) + 1], invariant = invariant, at = at, agree = (if invariant then obey else of), of = of, outliers = (if invariant then A.filter(A.map(raw, function(v, i)
					return (if ((v ~= at) and Js.NumberNS.isFinite(v)) then (if ids[i + 1] ~= nil then ids[i + 1] else ("#" .. Js.numstr(i))) else nil)
				end), function(x)
					return (x ~= nil)
				end) else Js.alit()) }, { "id", "label", "count", "ratio", "min", "max", "median", "invariant", "at", "agree", "of", "outliers" }))
			end
		end
		do return Js.O({ kind = kind, n = Js.alen(samples), rules = rules }, { "kind", "n", "rules" }) end
	end
	exports.deriveRuleSet = deriveRuleSet
	outliersOf = function(set)
		local out = Js.alit()
		do
			local _arr5 = set.rules
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local r = _arr5[_i6]
				do
					local _arr7 = r.outliers
					local _i8 = 0
					while _i8 < Js.alen(_arr7) do
						_i8 += 1
						local id = _arr7[_i8]
						A.push(out, Js.O({ id = id, breaks = r.label }, { "id", "breaks" }))
					end
				end
			end
		end
		do return out end
	end
	exports.outliersOf = outliersOf
	violations = function(sample, set)
		local out = Js.alit()
		do
			local _arr9 = set.rules
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local r = _arr9[_i10]
				if (not r.invariant) then
					do continue end
				end
				local m = A.find(MEASURES, function(x)
					return (x.id == r.id)
				end)
				if (not m) then
					do continue end
				end
				local v = m.of(sample)
				if (v ~= r.at) then
					A.push(out, (if r.count then (S.toLowerCase(r.label) .. ": " .. Js.numstr(v) .. ", should be " .. Js.numstr(r.at)) else (if r.ratio then (S.toLowerCase(r.label) .. ": " .. N.toFixed(v, 2) .. ", should be " .. N.toFixed(r.at, 2)) else (S.toLowerCase(r.label) .. ": " .. N.toFixed(v, 1) .. "m, should be " .. N.toFixed(r.at, 1) .. "m"))))
				end
			end
		end
		do return out end
	end
	exports.violations = violations
	drift = function(sample, set)
		local out = Js.alit()
		do
			local _arr11 = set.rules
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local r = _arr11[_i12]
				if r.invariant then
					do continue end
				end
				local m = A.find(MEASURES, function(x)
					return (x.id == r.id)
				end)
				if (not m) then
					do continue end
				end
				local v = m.of(sample)
				local by = (if (v < r.min) then (r.min - v) else (if (v > r.max) then (v - r.max) else 0))
				if (by > 0.01) then
					A.push(out, Js.O({ label = r.label, by = by }, { "label", "by" }))
				end
			end
		end
		do return A.sort(out, function(a, b)
			return (b.by - a.by)
		end) end
	end
	exports.drift = drift
	describeRuleSet = function(set)
		local n = function(r, v)
			return (if r.count then Js.numstr(v) else (if r.ratio then N.toFixed(v, 2) else (N.toFixed(v, 1) .. "m")))
		end
		local hard = A.map(A.filter(set.rules, function(r)
			return r.invariant
		end), function(r)
			return (("ALWAYS — " .. r.label .. ": " .. Js.numstr(r.at)) .. (if (r.agree < r.of) then ("  (" .. Js.numstr(r.agree) .. " of " .. Js.numstr(r.of) .. " — see outliers)") else ""))
		end)
		local soft = A.map(A.filter(set.rules, function(r)
			return (not r.invariant)
		end), function(r)
			return (r.label .. ": " .. n(r, r.min) .. " to " .. n(r, r.max) .. " (usually " .. n(r, r.median) .. ")")
		end)
		do return Js.aspread(hard, soft) end
	end
	exports.describeRuleSet = describeRuleSet
	POST_L = (M_pitch.CX - (M_pitch.GOAL_W / 2))
	POST_R = (M_pitch.CX + (M_pitch.GOAL_W / 2))
	sortedDist = function(from, ps)
		return A.sort(A.map(ps, function(p)
			return Math.hypot((p.x - from.x), (p.y - from.y))
		end), function(a, b)
			return (a - b)
		end)
	end
	MEASURES = Js.alit(Js.O({ id = "ballDepth", label = "Ball's distance from the goal line", of = function(s)
		return s.ball.y
	end }, { "id", "label", "of" }), Js.O({ id = "ballLateral", label = "Ball's distance from the middle", of = function(s)
		return math.abs((s.ball.x - M_pitch.CX))
	end }, { "id", "label", "of" }), Js.O({ id = "ballToGoal", label = "Ball to the goal centre", of = function(s)
		return Math.hypot((s.ball.x - M_pitch.CX), s.ball.y)
	end }, { "id", "label", "of" }), Js.O({ id = "youToBall", label = "Your gap to the ball", of = function(s)
		return Math.hypot((s.you.x - s.ball.x), (s.you.y - s.ball.y))
	end }, { "id", "label", "of" }), Js.O({ id = "gkOffLine", label = "Keeper's distance off his line", of = function(s)
		return s.keeper.y
	end }, { "id", "label", "of" }), Js.O({ id = "gkLateral", label = "Keeper's distance from the middle", of = function(s)
		return math.abs((s.keeper.x - M_pitch.CX))
	end }, { "id", "label", "of" }), Js.O({ id = "gkOffShot", label = "Keeper's distance off the shot line", of = function(s)
		return offShotLine(s.keeper, s.ball)
	end }, { "id", "label", "of" }), Js.O({ id = "gkToBall", label = "Keeper to the ball", of = function(s)
		return Math.hypot((s.keeper.x - s.ball.x), (s.keeper.y - s.ball.y))
	end }, { "id", "label", "of" }), Js.O({ id = "gkNearPost", label = "Keeper's near-post cover (share of the ball's width)", ratio = true, of = function(s)
		local bl = (s.ball.x - M_pitch.CX)
		if (math.abs(bl) < 1.5) then
			do return (0/0) end
		end
		do return (((s.keeper.x - M_pitch.CX) * Math.sign(bl)) / math.abs(bl)) end
	end }, { "id", "label", "ratio", "of" }), Js.O({ id = "gkAdvance", label = "How far the keeper comes out (0 = his line, 1 = at the ball)", ratio = true, of = function(s)
		return (if (s.ball.y <= 0.01) then (0/0) else (s.keeper.y / s.ball.y))
	end }, { "id", "label", "ratio", "of" }), Js.O({ id = "defCount", label = "Defenders in the picture", count = true, of = function(s)
		return Js.alen(s.defenders)
	end }, { "id", "label", "count", "of" }), Js.O({ id = "defBetween", label = "Defenders between the ball and the goal", count = true, of = function(s)
		return Js.alen(A.filter(s.defenders, function(d)
			return inShotCorridor(d, s.ball)
		end))
	end }, { "id", "label", "count", "of" }), Js.O({ id = "defGoalSide", label = "Defenders nearer the goal than the ball", count = true, of = function(s)
		return Js.alen(A.filter(s.defenders, function(d)
			return (d.y < s.ball.y)
		end))
	end }, { "id", "label", "count", "of" }), Js.O({ id = "defNearest", label = "Nearest defender to the ball", of = function(s)
		return (sortedDist(s.ball, s.defenders)[1] or 99)
	end }, { "id", "label", "of" }), Js.O({ id = "defSecond", label = "Second-nearest defender to the ball", of = function(s)
		return (sortedDist(s.ball, s.defenders)[2] or 99)
	end }, { "id", "label", "of" }), Js.O({ id = "mateCount", label = "Team-mates in the picture", count = true, of = function(s)
		return Js.alen(s.mates)
	end }, { "id", "label", "count", "of" }), Js.O({ id = "mateNearest", label = "Nearest team-mate to the ball", of = function(s)
		return (sortedDist(s.ball, s.mates)[1] or 99)
	end }, { "id", "label", "of" }), Js.O({ id = "mateInShot", label = "Team-mates standing in your shot", count = true, of = function(s)
		return Js.alen(A.filter(s.mates, function(m)
			return ((m.y < s.ball.y) and (offShotLine(m, s.ball) < 2.2))
		end))
	end }, { "id", "label", "count", "of" }), Js.O({ id = "inBox", label = "Ball is inside the box", count = true, of = function(s)
		return (if (s.ball.y <= M_pitch.BOX_DEPTH) then 1 else 0)
	end }, { "id", "label", "count", "of" }), Js.O({ id = "aperture", label = "How much goal you can see, in degrees", of = function(s)
		return ((math.abs((Math.atan2((POST_R - s.ball.x), s.ball.y) - Math.atan2((POST_L - s.ball.x), s.ball.y))) * 180) / Math.PI)
	end }, { "id", "label", "of" }))
	exports.MEASURES = MEASURES
	MIN_SAMPLES_FOR_INVARIANT = 5
	exports.MIN_SAMPLES_FOR_INVARIANT = MIN_SAMPLES_FOR_INVARIANT
	INVARIANT_AGREEMENT = 0.9
	exports.INVARIANT_AGREEMENT = INVARIANT_AGREEMENT
	isLaw = function(m)
		return (not (not m.count))
	end
end
