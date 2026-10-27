--!nocheck
--!nolint
-- Generated from lib/star/hitbox.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local HITBOX_DEFAULTS, HITBOX_RANGES, DIALS_KEY, SHOW_KEY, on, dials, setHitboxes, hitboxesOn, hitboxDials, loadDials, setHitboxDials, resetHitboxDials, applyHitboxDials, showHitboxes, setShowHitboxes, headTop, bodyReach, jumpSpeed, jumpRiseTime, startJump, stepJump, passOver, wantsJump
	setHitboxes = function(v)
		on = (v == "new")
		dials = loadDials()
	end
	exports.setHitboxes = setHitboxes
	hitboxesOn = function()
		do return on end
	end
	exports.hitboxesOn = hitboxesOn
	hitboxDials = function()
		do return dials end
	end
	exports.hitboxDials = hitboxDials
	loadDials = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, Js.ospread(HITBOX_DEFAULTS) end
			end
			local raw = Js.localStorage.getItem(DIALS_KEY)
			if (not Js.T(raw)) then
				do return Js.RET, Js.ospread(HITBOX_DEFAULTS) end
			end
			local p = Js.JSON.parse(raw)
			local out = Js.ospread(HITBOX_DEFAULTS)
			do
				local _arr4 = Js.Object.keys(HITBOX_DEFAULTS)
				local _i5 = 0
				while _i5 < Js.alen(_arr4) do
					_i5 += 1
					local k = _arr4[_i5]
					local v = p[k]
					if ((type(v) == "number") and Js.NumberNS.isFinite(v)) then
						local r = HITBOX_RANGES[k]
						out[k] = Math.max(r.min, Math.min(r.max, v))
					end
				end
			end
			do return Js.RET, out end
		end)
		if not _ok1 then
			do return Js.ospread(HITBOX_DEFAULTS) end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	setHitboxDials = function(d)
		dials = Js.ospread(dials, d)
		local _ok6, _err7, _rv8 = pcall(function()
			Js.localStorage.setItem(DIALS_KEY, Js.JSON.stringify(dials))
		end)
		if not _ok6 then
		elseif _err7 == Js.RET then
			return _rv8
		end
	end
	exports.setHitboxDials = setHitboxDials
	resetHitboxDials = function()
		dials = Js.ospread(HITBOX_DEFAULTS)
		local _ok9, _err10, _rv11 = pcall(function()
			Js.localStorage.removeItem(DIALS_KEY)
		end)
		if not _ok9 then
		elseif _err10 == Js.RET then
			return _rv11
		end
	end
	exports.resetHitboxDials = resetHitboxDials
	applyHitboxDials = function(d)
		dials = Js.ospread(d)
	end
	exports.applyHitboxDials = applyHitboxDials
	showHitboxes = function()
		local _ok12, _err13, _rv14 = pcall(function()
			do return Js.RET, ((Js.localStorage ~= nil) and (Js.localStorage.getItem(SHOW_KEY) == "1")) end
		end)
		if not _ok12 then
			do return false end
		elseif _err13 == Js.RET then
			return _rv14
		end
	end
	exports.showHitboxes = showHitboxes
	setShowHitboxes = function(v)
		local _ok15, _err16, _rv17 = pcall(function()
			if v then
				Js.localStorage.setItem(SHOW_KEY, "1")
			else
				Js.localStorage.removeItem(SHOW_KEY)
			end
		end)
		if not _ok15 then
		elseif _err16 == Js.RET then
			return _rv17
		end
	end
	exports.setShowHitboxes = setShowHitboxes
	headTop = function(foot, d)
		if d == nil then d = dials end
		do return ((foot + d.standHeight) + M_pitch.BALL_R) end
	end
	exports.headTop = headTop
	bodyReach = function(lowR, z, foot, d)
		if d == nil then d = dials end
		local h = (z - foot)
		local top = (d.standHeight + M_pitch.BALL_R)
		if ((h < (-M_pitch.BALL_R)) or (h > top)) then
			do return 0 end
		end
		local low = (lowR * d.reachLow)
		local head = (low * d.reachHead)
		local hip = (d.standHeight * 0.27)
		local chest = (d.standHeight * 0.7)
		local r = nil
		if (h <= hip) then
			r = low
		elseif (h <= chest) then
			r = (low + (((low * 0.65) - low) * ((h - hip) / (chest - hip))))
		elseif (h <= d.standHeight) then
			r = ((low * 0.65) + ((head - (low * 0.65)) * ((h - chest) / (d.standHeight - chest))))
		else
			r = (head * (1 - (0.4 * ((h - d.standHeight) / M_pitch.BALL_R))))
		end
		do return Math.max(0.12, r) end
	end
	exports.bodyReach = bodyReach
	jumpSpeed = function(d)
		if d == nil then d = dials end
		do return Math.sqrt(((2 * 9.8) * Math.max(0, d.jumpHeight))) end
	end
	exports.jumpSpeed = jumpSpeed
	jumpRiseTime = function(d)
		if d == nil then d = dials end
		do return (jumpSpeed(d) / 9.8) end
	end
	exports.jumpRiseTime = jumpRiseTime
	startJump = function(j, d)
		if d == nil then d = dials end
		if (((if j.z ~= nil then j.z else 0) > 0) or ((if j.vz ~= nil then j.vz else 0) > 0)) then
			do return end
		end
		j.vz = jumpSpeed(d)
		j.z = 0
	end
	exports.startJump = startJump
	stepJump = function(j, dt)
		if (((if j.z ~= nil then j.z else 0) <= 0) and ((if j.vz ~= nil then j.vz else 0) <= 0)) then
			do return end
		end
		j.vz = ((if j.vz ~= nil then j.vz else 0) - (9.8 * dt))
		j.z = Math.max(0, ((if j.z ~= nil then j.z else 0) + (j.vz * dt)))
		if (j.z == 0) then
			j.vz = 0
		end
	end
	exports.stepJump = stepJump
	passOver = function(ball, p)
		local v2 = ((ball.vel.x * ball.vel.x) + (ball.vel.y * ball.vel.y))
		if (v2 < 1) then
			do return nil end
		end
		local t = ((((p.x - ball.pos.x) * ball.vel.x) + ((p.y - ball.pos.y) * ball.vel.y)) / v2)
		if (t < 0) then
			do return nil end
		end
		local x = (ball.pos.x + (ball.vel.x * t))
		local y = (ball.pos.y + (ball.vel.y * t))
		do return Js.O({ t = t, miss = Math.hypot((p.x - x), (p.y - y)), z = ((ball.z + (ball.vz * t)) - (((0.5 * 9.8) * t) * t)) }, { "t", "miss", "z" }) end
	end
	exports.passOver = passOver
	wantsJump = function(ball, p, reach, bonus, d)
		if d == nil then d = dials end
		local po = passOver(ball, p)
		if ((not po) or (po.miss > reach)) then
			do return false end
		end
		local stand = (d.standHeight + M_pitch.BALL_R)
		if ((po.z <= (stand - 0.1)) or (po.z > ((stand + d.jumpHeight) + bonus))) then
			do return false end
		end
		do return (po.t <= (jumpRiseTime(d) + 0.05)) end
	end
	exports.wantsJump = wantsJump
	HITBOX_DEFAULTS = Js.O({ standHeight = 1.85, jumpHeight = 0.5, reachLow = 1, reachHead = 0.45, headerBonus = 0.3, blockBonus = 0.2, keeperJump = 0.9 }, { "standHeight", "jumpHeight", "reachLow", "reachHead", "headerBonus", "blockBonus", "keeperJump" })
	exports.HITBOX_DEFAULTS = HITBOX_DEFAULTS
	HITBOX_RANGES = Js.O({ standHeight = Js.O({ min = 1.4, max = 2.2, step = 0.05, label = "Standing height", unit = "m" }, { "min", "max", "step", "label", "unit" }), jumpHeight = Js.O({ min = 0, max = 1, step = 0.05, label = "Jump height", unit = "m" }, { "min", "max", "step", "label", "unit" }), reachLow = Js.O({ min = 0.5, max = 1.5, step = 0.05, label = "Reach at feet", unit = "×" }, { "min", "max", "step", "label", "unit" }), reachHead = Js.O({ min = 0.2, max = 1, step = 0.05, label = "Reach at head", unit = "×" }, { "min", "max", "step", "label", "unit" }), headerBonus = Js.O({ min = 0, max = 0.8, step = 0.05, label = "Header bonus", unit = "m" }, { "min", "max", "step", "label", "unit" }), blockBonus = Js.O({ min = 0, max = 0.6, step = 0.05, label = "Block bonus", unit = "m" }, { "min", "max", "step", "label", "unit" }), keeperJump = Js.O({ min = 0, max = 2, step = 0.1, label = "Keeper: over-head penalty", unit = "×" }, { "min", "max", "step", "label", "unit" }) }, { "standHeight", "jumpHeight", "reachLow", "reachHead", "headerBonus", "blockBonus", "keeperJump" })
	exports.HITBOX_RANGES = HITBOX_RANGES
	DIALS_KEY = "star-hitbox-dials"
	SHOW_KEY = "star-hitbox-show"
	on = (function()
		local _ok18, _err19, _rv20 = pcall(function()
			do return Js.RET, ((Js.process ~= nil) and ((function() local _v = Js.process.env; if _v == nil then return nil end; _v = _v.STAR_HITBOX; return _v end)() == "new")) end
		end)
		if not _ok18 then
			do return false end
		elseif _err19 == Js.RET then
			return _rv20
		end
	end)()
	dials = loadDials()
end
