--!nocheck
--!nolint
-- Generated from lib/star/strikePower.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local POWER_POINTS, DEFAULT_POWER_SPEEDS, OLD_POWER_SPEEDS, OVERRIDE_KEY, override, powerCurveOverride, setPowerCurveOverride, powerSpeeds, fullPowerSpeed, POWER_KNEE, POWER_ABOVE_KNEE, strikingPower, oldStrikingPower, topSpeedScale
	powerCurveOverride = function()
		if (override ~= nil) then
			do return override end
		end
		override = nil
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(OVERRIDE_KEY))
			local v = (if Js.T(raw) then Js.JSON.parse(raw) else nil)
			if ((Js.Array.isArray(v) and (Js.alen(v) == Js.alen(POWER_POINTS))) and A.every(v, function(x)
				return (((type(x) == "number") and (x > 5)) and (x < 60))
			end)) then
				override = v
			end
		end)
		if not _ok1 then
			override = nil
		elseif _err2 == Js.RET then
			return _rv3
		end
		do return override end
	end
	exports.powerCurveOverride = powerCurveOverride
	setPowerCurveOverride = function(speeds)
		override = (if (speeds and (Js.alen(speeds) == Js.alen(POWER_POINTS))) then Js.aspread(speeds) else nil)
		local _ok4, _err5, _rv6 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, nil end
			end
			if override then
				Js.localStorage.setItem(OVERRIDE_KEY, Js.JSON.stringify(override))
			else
				Js.localStorage.removeItem(OVERRIDE_KEY)
			end
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.setPowerCurveOverride = setPowerCurveOverride
	powerSpeeds = function()
		do return (powerCurveOverride() or DEFAULT_POWER_SPEEDS) end
	end
	exports.powerSpeeds = powerSpeeds
	fullPowerSpeed = function(power, speeds)
		if speeds == nil then speeds = powerSpeeds() end
		local p = Math.max(0, Math.min(100, power))
		for i = 1, (Js.alen(POWER_POINTS)) - 1 do
			if (p <= POWER_POINTS[i + 1]) then
				local a = POWER_POINTS[i]
				local b = POWER_POINTS[i + 1]
				do return (speeds[i] + (((speeds[i + 1] - speeds[i]) * (p - a)) / (b - a))) end
			end
		end
		do return speeds[Js.alen(speeds)] end
	end
	exports.fullPowerSpeed = fullPowerSpeed
	strikingPower = function(power)
		do return Math.max(-50, ((fullPowerSpeed(power) - 18) / 0.18)) end
	end
	exports.strikingPower = strikingPower
	oldStrikingPower = function(power)
		do return Math.max(-50, ((fullPowerSpeed(power, OLD_POWER_SPEEDS) - 18) / 0.18)) end
	end
	exports.oldStrikingPower = oldStrikingPower
	topSpeedScale = function(power)
		do return ((18 + (0.18 * strikingPower(power))) / (18 + (0.18 * power))) end
	end
	exports.topSpeedScale = topSpeedScale
	POWER_POINTS = Js.alit(0, 20, 40, 60, 80, 100)
	exports.POWER_POINTS = POWER_POINTS
	DEFAULT_POWER_SPEEDS = Js.alit(18, 19.5, 21, 23.4, 30.6, 32.76)
	exports.DEFAULT_POWER_SPEEDS = DEFAULT_POWER_SPEEDS
	OLD_POWER_SPEEDS = Js.alit(18, 21.6, 25.2, 28.8, 32.4, 32.76)
	exports.OLD_POWER_SPEEDS = OLD_POWER_SPEEDS
	OVERRIDE_KEY = "star-power-curve"
	override = nil
	POWER_KNEE = 80
	exports.POWER_KNEE = POWER_KNEE
	POWER_ABOVE_KNEE = 0.1
	exports.POWER_ABOVE_KNEE = POWER_ABOVE_KNEE
end
