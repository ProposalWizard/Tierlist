--!nocheck
--!nolint
-- Generated from lib/star/weatherLab.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitchQuality = import("lib/star/pitchQuality")
	local M_ballPhysics = import("lib/star/ballPhysics")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_weather = import("lib/star/weather")
	local CLEAR_DIALS, windWords, windVector, SKID_DRY, buildConditions, round3, dialsPitchLabel, STRIKES, flyBall, measure, plannedDials
	windWords = function(to)
		local a = math.fmod((math.fmod(to, 360) + 360), 360)
		local names = Js.alit("behind you", "behind you, left to right", "left to right", "into you, left to right", "in your face", "into you, right to left", "right to left", "behind you, right to left")
		do return names[math.fmod(Math.round((a / 45)), 8) + 1] end
	end
	exports.windWords = windWords
	windVector = function(speed, to)
		local a = ((to * Math.PI) / 180)
		do return Js.O({ x = (speed * Math.sin(a)), y = ((-speed) * Math.cos(a)) }, { "x", "y" }) end
	end
	exports.windVector = windVector
	buildConditions = function(d)
		local b = (1 - Math.max(0.25, Math.min(1, d.pitch)))
		local drag = 1
		local friction = 1
		local bounce = 1
		local skid = 0
		local label = "Clear"
		local note = "Perfect conditions."
		if (d.weather == "wind") then
			label = "Windy"
			note = "The ball will not hold its line."
		end
		if (d.weather == "rain") then
			friction = 0.62
			bounce = 0.9
			skid = 0.3
			label = "Rain"
			note = "Greasy on top. It skids on and runs away from you."
		end
		if (d.weather == "heavy") then
			drag = 1.25
			friction = 1.9
			bounce = 0.55
			skid = 0.1
			label = "Heavy rain"
			note = "A slow, wet pitch. Nothing runs."
		end
		local wet = ((d.weather == "rain") or (d.weather == "heavy"))
		local ground = (if wet then "wet" else (if (d.ground == "wet") then "normal" else d.ground))
		local harsh = (d.worst == "harsh")
		friction *= (1 + ((if harsh then 0.5 else 0.05) * b))
		bounce *= (1 - (0.15 * b))
		skid *= (1 - (0.4 * b))
		local deadBelow = nil
		if ((ground == "dry") and (b > 0.04)) then
			friction *= (1 + ((if harsh then 0.9 else 0.08) * b))
			bounce *= (1 - (0.4 * b))
			deadBelow = (Math.round((((if harsh then 3.2 else 2.5) * Math.pow(b, 1.3)) * 100)) / 100)
			if (not harsh) then
				skid = ((-SKID_DRY) * b)
			end
		end
		local windV = (if (d.windSpeed > 0) then windVector(d.windSpeed, d.windTo) else nil)
		local pl = M_pitchQuality.pitchLabel((1 - b), ground)
		do return Js.ospread(Js.O({ weather = d.weather, pitch = (if (d.weather == "heavy") then 0.85 else (if wet then 0.45 else b)), label = label, note = (note .. " " .. pl .. "." .. (if windV then (" Wind " .. Js.numstr(Math.round(d.windSpeed)) .. " m/s, " .. windWords(d.windTo) .. ".") else "")), drag = drag, friction = round3(friction), bounce = round3(bounce), wind = 0 }, { "weather", "pitch", "label", "note", "drag", "friction", "bounce", "wind" }), (if windV then Js.O({ windV = windV }, { "windV" }) else Js.O({}, nil)), (if (skid ~= 0) then Js.O({ skid = round3(skid) }, { "skid" }) else Js.O({}, nil)), (if Js.T(deadBelow) then Js.O({ deadBelow = deadBelow }, { "deadBelow" }) else Js.O({}, nil))) end
	end
	exports.buildConditions = buildConditions
	dialsPitchLabel = function(d)
		local wet = ((d.weather == "rain") or (d.weather == "heavy"))
		do return M_pitchQuality.pitchLabel(d.pitch, (if wet then "wet" else (if (d.ground == "wet") then "normal" else d.ground))) end
	end
	exports.dialsPitchLabel = dialsPitchLabel
	flyBall = function(speed, angleDeg, cond, mode, aimDeg)
		if aimDeg == nil then aimDeg = 0 end
		local a = ((angleDeg * Math.PI) / 180)
		local h = ((aimDeg * Math.PI) / 180)
		local vh = (speed * Math.cos(a))
		local ball = Js.O({ pos = Js.O({ x = 0, y = 0 }, { "x", "y" }), vel = Js.O({ x = (vh * Math.sin(h)), y = ((-vh) * Math.cos(h)) }, { "x", "y" }), z = 0.11, vz = (speed * Math.sin(a)), spin = 0, topspin = 0, resting = false, loose = false, contactCd = 0, receiverControlT = 0, event = nil, inNet = false }, { "pos", "vel", "z", "vz", "spin", "topspin", "resting", "loose", "contactCd", "receiverControlT", "event", "inNet" })
		local dt = (1 / 180)
		local path = Js.alit(Js.O({ x = 0, y = 0, z = 0.11 }, { "x", "y", "z" }))
		local apex = 0.11
		local landed = false
		local carry = 0
		local drift = 0
		local bounce = 0
		local t = 0
		local lx = 0
		local ly = 0
		do
			local _first1 = true
			while true do
				if not _first1 then
					t += dt
				end
				_first1 = false
				if not ((t < 12) and (not ball.resting)) then break end
				if (mode == "new") then
					M_ballPhysics.integrateBallReal(ball, cond, dt)
				else
					M_canvasEngine.integrateBallOld(ball, cond, dt)
				end
				if (not landed) then
					apex = Math.max(apex, ball.z)
					if ((ball.z <= 0) and (t > 0.02)) then
						landed = true
						carry = (-ball.pos.y)
						drift = ball.pos.x
						lx = ball.pos.x
						ly = ball.pos.y
					end
				else
					bounce = Math.max(bounce, ball.z)
				end
				if (math.fmod(Math.round((t / dt)), 3) == 0) then
					A.push(path, Js.O({ x = ball.pos.x, y = (-ball.pos.y), z = ball.z }, { "x", "y", "z" }))
				end
			end
		end
		A.push(path, Js.O({ x = ball.pos.x, y = (-ball.pos.y), z = ball.z }, { "x", "y", "z" }))
		if (not landed) then
			carry = (-ball.pos.y)
			drift = ball.pos.x
			lx = ball.pos.x
			ly = ball.pos.y
		end
		do return Js.O({ path = path, carry = carry, drift = drift, driftEnd = ball.pos.x, apex = apex, bounce = bounce, roll = Math.hypot((ball.pos.x - lx), (ball.pos.y - ly)), total = Math.hypot(ball.pos.x, ball.pos.y), tStop = t }, { "path", "carry", "drift", "driftEnd", "apex", "bounce", "roll", "total", "tStop" }) end
	end
	exports.flyBall = flyBall
	measure = function(strike, cond, mode, n)
		if n == nil then n = 200 end
		local s = 12345
		local rnd = function()
			s = Js.ushr((Math.imul(s, 1664525) + 1013904223), 0)
			do return (s / 4294967296) end
		end
		local sum = Js.O({ carry = 0, drift = 0, driftEnd = 0, apex = 0, bounce = 0, roll = 0, total = 0, tStop = 0 }, { "carry", "drift", "driftEnd", "apex", "bounce", "roll", "total", "tStop" })
		for i = 0, math.ceil(n) - 1 do
			local f = flyBall((strike.speed * (0.88 + (rnd() * 0.24))), (strike.angle * (0.8 + (rnd() * 0.4))), cond, mode, ((rnd() - 0.5) * 12))
			do
				local _arr2 = Js.Object.keys(sum)
				local _i3 = 0
				while _i3 < Js.alen(_arr2) do
					_i3 += 1
					local k = _arr2[_i3]
					sum[k] += f[k]
				end
			end
		end
		do
			local _arr4 = Js.Object.keys(sum)
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local k = _arr4[_i5]
				sum[k] /= n
			end
		end
		do return sum end
	end
	exports.measure = measure
	plannedDials = function(season, week, homeClub, homeCity)
		if homeCity == nil then homeCity = "" end
		local today = M_weather.conditionsFor(season, week, homeCity)
		local strength = (math.abs(today.wind) / 2.6)
		local h = (((season * 9176) + (week * 313)) + 7)
		for i = 0, (S.len(homeClub)) - 1 do
			h = Math.imul(Js.bxor(h, S.charCodeAt(homeClub, i)), 16777619)
		end
		h = Js.ushr(Math.imul(h, 2654435761), 0)
		h = Js.ushr(Js.bxor(h, Js.ushr(h, 13)), 0)
		do return Js.O({ weather = today.weather, windSpeed = (if (today.weather == "wind") then Math.round((4 + (strength * 9))) else 0), windTo = (math.fmod(h, 8) * 45), pitch = M_pitchQuality.clubPitch(homeClub).quality, ground = M_pitchQuality.groundFor(season, week, ((today.weather == "rain") or (today.weather == "heavy"))), worst = "tame" }, { "weather", "windSpeed", "windTo", "pitch", "ground", "worst" }) end
	end
	exports.plannedDials = plannedDials
	CLEAR_DIALS = Js.O({ weather = "clear", windSpeed = 0, windTo = 90, pitch = 1, ground = "normal" }, { "weather", "windSpeed", "windTo", "pitch", "ground" })
	exports.CLEAR_DIALS = CLEAR_DIALS
	SKID_DRY = 0.4
	exports.SKID_DRY = SKID_DRY
	round3 = function(n)
		return (Math.round((n * 1000)) / 1000)
	end
	STRIKES = Js.alit(Js.O({ id = "ground", name = "Ground pass", speed = 14, angle = 1.5 }, { "id", "name", "speed", "angle" }), Js.O({ id = "driven", name = "Driven shot", speed = 27, angle = 8 }, { "id", "name", "speed", "angle" }), Js.O({ id = "chip", name = "Lofted pass", speed = 17, angle = 35 }, { "id", "name", "speed", "angle" }), Js.O({ id = "long", name = "Long ball", speed = 25, angle = 30 }, { "id", "name", "speed", "angle" }))
	exports.STRIKES = STRIKES
	exports.pitchWord = pitchWord
end
