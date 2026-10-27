--!nocheck
--!nolint
-- Generated from lib/star/bylineShort.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local SHORT_MIN_M, SHORT_MAX_M, CLEAR_M, BEHIND_M, dist, hasShortOption, shortOptionSpot, addShortOption
	hasShortOption = function(sc)
		local mates = Js.aspread((if sc.runner then Js.alit(sc.runner) else Js.alit()), (if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit()))
		do return A.some(mates, function(r)
			local d = dist(r.pos, sc.ball)
			do return (((d >= (SHORT_MIN_M - 0.5)) and (d <= (SHORT_MAX_M + 0.5))) and (r.pos.y >= ((sc.ball.y + BEHIND_M) - 0.01))) end
		end) end
	end
	exports.hasShortOption = hasShortOption
	shortOptionSpot = function(sc)
		local b = sc.ball
		local others = A.filter(Js.aspread(Js.alit(sc.player, sc.keeper), sc.defenders, sc.teammates, (if sc.runner then Js.alit(sc.runner.pos, sc.runner.to) else Js.alit()), A.flatMap((if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit()), function(r)
			return Js.alit(r.pos, r.to)
		end)), function(p)
			return (((((p and Js.NumberNS.isFinite(p.x)) and Js.NumberNS.isFinite(p.y)) and (p.x > -50)) and (p.x < (M_pitch.PITCH_W + 50))) and (p.y < 150))
		end)
		local aim = Math.atan2((11 - b.y), (M_pitch.CX - b.x))
		local best = nil
		do
			local a = -70
			local _first1 = true
			while true do
				if not _first1 then
					a += 5
				end
				_first1 = false
				if not (a <= 70) then break end
				local ang = (aim + ((a * Math.PI) / 180))
				do
					local d = SHORT_MIN_M
					local _first2 = true
					while true do
						if not _first2 then
							d += 0.5
						end
						_first2 = false
						if not (d <= (SHORT_MAX_M + 1e-9)) then break end
						local p = Js.O({ x = (b.x + (Math.cos(ang) * d)), y = (b.y + (Math.sin(ang) * d)) }, { "x", "y" })
						if (p.y < (b.y + BEHIND_M)) then
							do continue end
						end
						if (((p.x < 1) or (p.x > (M_pitch.PITCH_W - 1))) or (p.y < 0.5)) then
							do continue end
						end
						local clear = (if Js.T(Js.alen(others)) then Math.min(Js.unpack(A.map(others, function(o)
							return dist(o, p)
						end))) else 99)
						local score = ((Math.min(clear, 6) - (math.abs((d - 8)) * 0.15)) - (math.abs(a) * 0.004))
						if ((not best) or (score > best.clear)) then
							best = Js.O({ p = p, clear = score }, { "p", "clear" })
						end
					end
				end
			end
		end
		if (not best) then
			do return nil end
		end
		local p = best.p
		local clear = (if Js.T(Js.alen(others)) then Math.min(Js.unpack(A.map(others, function(o)
			return dist(o, p)
		end))) else 99)
		do return (if (clear >= CLEAR_M) then p else nil) end
	end
	exports.shortOptionSpot = shortOptionSpot
	addShortOption = function(sc)
		if ((sc.kind ~= "byline_cross") or hasShortOption(sc)) then
			do return false end
		end
		local p = shortOptionSpot(sc)
		if (not p) then
			do return false end
		end
		local r = Js.O({ pos = Js.ospread(p), to = Js.ospread(p), speed = 6, moving = false, role = "support", sprint = false, shortOption = true }, { "pos", "to", "speed", "moving", "role", "sprint", "shortOption" })
		sc.secondaryRunners = Js.aspread((if sc.secondaryRunners ~= nil then sc.secondaryRunners else Js.alit()), Js.alit(r))
		do return true end
	end
	exports.addShortOption = addShortOption
	SHORT_MIN_M = 6
	exports.SHORT_MIN_M = SHORT_MIN_M
	SHORT_MAX_M = 10
	exports.SHORT_MAX_M = SHORT_MAX_M
	CLEAR_M = 2.5
	exports.CLEAR_M = CLEAR_M
	BEHIND_M = 1.5
	dist = function(a, b)
		return Math.hypot((a.x - b.x), (a.y - b.y))
	end
end
