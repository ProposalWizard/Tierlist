--!nocheck
--!nolint
-- Generated from lib/star/pressure.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local pressureForDivision, PRESSURE_DIALS, pressureFromDial, PRESS_SPEED, PRESS_REACT_S, PRESS_WIN_R, FOUL_SHARE, PRESS_BODY_R, FOUL_SHARE_BEHIND, pressFromBehind, foulShareFor, pressStep, pressSpeedFor, timeToPress
	pressureForDivision = function(division)
		if (division == "premier") then
			do return 1 end
		end
		if (division == "championship") then
			do return 0.5 end
		end
		do return 0 end
	end
	exports.pressureForDivision = pressureForDivision
	pressureFromDial = function(dial, division)
		if (dial == "off") then
			do return 0 end
		end
		if (dial == "light") then
			do return 0.5 end
		end
		if (dial == "full") then
			do return 1 end
		end
		do return pressureForDivision(division) end
	end
	exports.pressureFromDial = pressureFromDial
	pressFromBehind = function(presser, ball, you)
		local ax = (presser.x - ball.x)
		local ay = (presser.y - ball.y)
		local bx = (you.x - ball.x)
		local by = (you.y - ball.y)
		local la = Math.hypot(ax, ay)
		local lb = Math.hypot(bx, by)
		if ((la < 0.000001) or (lb < 0.000001)) then
			do return false end
		end
		do return ((((ax * bx) + (ay * by)) / (la * lb)) > 0.5) end
	end
	exports.pressFromBehind = pressFromBehind
	foulShareFor = function(fromBehind)
		do return (if fromBehind then FOUL_SHARE_BEHIND else FOUL_SHARE) end
	end
	exports.foulShareFor = foulShareFor
	pressStep = function(p, ball, you, maxStep)
		local dx = (ball.x - p.x)
		local dy = (ball.y - p.y)
		local dist = Math.hypot(dx, dy)
		if ((dist < 0.000001) or (maxStep <= 0)) then
			do return end
		end
		local step = Math.min(maxStep, (dist - (PRESS_WIN_R * 0.5)))
		if (step <= 0) then
			do return end
		end
		local keep = Math.min(PRESS_BODY_R, Math.hypot((p.x - you.x), (p.y - you.y)))
		local nx = (p.x + ((dx / dist) * step))
		local ny = (p.y + ((dy / dist) * step))
		if (Math.hypot((nx - you.x), (ny - you.y)) >= keep) then
			p.x = nx
			p.y = ny
			do return end
		end
		local r = Math.max(Math.min(PRESS_BODY_R, (keep + (step * 0.6))), 0.001)
		local a = Math.atan2((p.y - you.y), (p.x - you.x))
		local ab = Math.atan2((ball.y - you.y), (ball.x - you.x))
		local da = (ab - a)
		while (da > Math.PI) do
			da -= (2 * Math.PI)
		end
		while (da <= (-Math.PI)) do
			da += (2 * Math.PI)
		end
		if (math.abs(da) < 1e-9) then
			do return end
		end
		local turn = (Math.sign(da) * Math.min(math.abs(da), (step / r)))
		p.x = (you.x + (Math.cos((a + turn)) * r))
		p.y = (you.y + (Math.sin((a + turn)) * r))
	end
	exports.pressStep = pressStep
	pressSpeedFor = function(pressure)
		do return (PRESS_SPEED * Math.max(0, Math.min(1, pressure))) end
	end
	exports.pressSpeedFor = pressSpeedFor
	timeToPress = function(dist, pressure)
		local v = pressSpeedFor(pressure)
		if (v <= 0) then
			do return math.huge end
		end
		do return (PRESS_REACT_S + (Math.max(0, (dist - PRESS_WIN_R)) / v)) end
	end
	exports.timeToPress = timeToPress
	PRESSURE_DIALS = Js.alit(Js.O({ id = "real", label = "Real (by division)" }, { "id", "label" }), Js.O({ id = "off", label = "Off" }, { "id", "label" }), Js.O({ id = "light", label = "Light" }, { "id", "label" }), Js.O({ id = "full", label = "Premier League" }, { "id", "label" }))
	exports.PRESSURE_DIALS = PRESSURE_DIALS
	PRESS_SPEED = 1.83
	exports.PRESS_SPEED = PRESS_SPEED
	PRESS_REACT_S = 0.3
	exports.PRESS_REACT_S = PRESS_REACT_S
	PRESS_WIN_R = 0.9
	exports.PRESS_WIN_R = PRESS_WIN_R
	FOUL_SHARE = (1 / 3)
	exports.FOUL_SHARE = FOUL_SHARE
	PRESS_BODY_R = 1.3
	exports.PRESS_BODY_R = PRESS_BODY_R
	FOUL_SHARE_BEHIND = (2 / 3)
	exports.FOUL_SHARE_BEHIND = FOUL_SHARE_BEHIND
end
