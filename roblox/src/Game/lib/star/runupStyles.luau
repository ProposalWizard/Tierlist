--!nocheck
--!nolint
-- Generated from lib/star/runupStyles.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_penaltyRunup = import("lib/star/penaltyRunup")
	local PENALTY_RUNUPS, FREE_KICK_RUNUPS, REWARD_RUNUPS, LEAF_RUNUP, GOLDEN_RUNUP, TAKER_PENALTY_POOL, TAKER_FREE_KICK_POOL, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP, RUNUP_STYLES, DEFAULT_RUNUP_STYLE, PEN_IDS, FK_IDS, isPenaltyRunupId, isFreeKickRunupId, isRunupStyleId, penaltyRunupOf, freeKickRunupOf, runupStyleOf, careerPenaltyRunup, careerFreeKickRunup, runupName, ownsRunup, ownsRunupStyle, ownedPenaltyRunups, ownedFreeKickRunups, hashKey, takerPenaltyRunup, takerFreeKickRunup, takerRunupStyle, takerRunupFor, yourRunupFor, STANDARD_MOTION, RUNUP_MOTION, runupDurationS, standBackFor, planRunup, clamp01, smooth, span, lerp, jog, runupProgress, runupPositionAt, runupPoseAt
	isPenaltyRunupId = function(v)
		do return ((type(v) == "string") and PEN_IDS:has(v)) end
	end
	exports.isPenaltyRunupId = isPenaltyRunupId
	isFreeKickRunupId = function(v)
		do return ((type(v) == "string") and FK_IDS:has(v)) end
	end
	exports.isFreeKickRunupId = isFreeKickRunupId
	penaltyRunupOf = function(v)
		do return (if isPenaltyRunupId(v) then v else DEFAULT_PENALTY_RUNUP) end
	end
	exports.penaltyRunupOf = penaltyRunupOf
	freeKickRunupOf = function(v)
		do return (if isFreeKickRunupId(v) then v else DEFAULT_FREE_KICK_RUNUP) end
	end
	exports.freeKickRunupOf = freeKickRunupOf
	careerPenaltyRunup = function(c)
		do return penaltyRunupOf((function() local _l = (function() local _v = c; if _v == nil then return nil end; _v = _v.penaltyRunup; return _v end)(); if _l ~= nil then return _l end; return (function() local _v = c; if _v == nil then return nil end; _v = _v.runupStyle; return _v end)() end)()) end
	end
	exports.careerPenaltyRunup = careerPenaltyRunup
	careerFreeKickRunup = function(c)
		do return freeKickRunupOf((function() local _v = c; if _v == nil then return nil end; _v = _v.freeKickRunup; return _v end)()) end
	end
	exports.careerFreeKickRunup = careerFreeKickRunup
	runupName = function(id)
		do return ((function() local _v = A.find(Js.aspread(PENALTY_RUNUPS, FREE_KICK_RUNUPS), function(s)
			return (s.id == id)
		end); if _v == nil then return nil end; _v = _v.name; return _v end)() or "Standard") end
	end
	exports.runupName = runupName
	ownsRunup = function(owned, id)
		do return (((id == DEFAULT_PENALTY_RUNUP) or (id == DEFAULT_FREE_KICK_RUNUP)) or (not (not (function() local _r = owned; if _r == nil then return nil end; return A.includes(_r, id) end)()))) end
	end
	exports.ownsRunup = ownsRunup
	ownedPenaltyRunups = function(owned)
		do return A.filter(PENALTY_RUNUPS, function(s)
			return ownsRunup(owned, s.id)
		end) end
	end
	exports.ownedPenaltyRunups = ownedPenaltyRunups
	ownedFreeKickRunups = function(owned)
		do return A.filter(FREE_KICK_RUNUPS, function(s)
			return ownsRunup(owned, s.id)
		end) end
	end
	exports.ownedFreeKickRunups = ownedFreeKickRunups
	hashKey = function(k)
		local h = 5381
		for i = 0, (S.len(k)) - 1 do
			h = Js.ushr(Js.bxor((h * 33), S.charCodeAt(k, i)), 0)
		end
		do return Js.ushr(Math.imul(Js.bxor(h, Js.ushr(h, 16)), 73244475), 0) end
	end
	takerPenaltyRunup = function(key)
		local k = S.trim((if key ~= nil then key else ""))
		if (not Js.T(k)) then
			do return DEFAULT_PENALTY_RUNUP end
		end
		do return TAKER_PENALTY_POOL[math.fmod(hashKey(k), Js.alen(TAKER_PENALTY_POOL)) + 1].id end
	end
	exports.takerPenaltyRunup = takerPenaltyRunup
	takerFreeKickRunup = function(key)
		local k = S.trim((if key ~= nil then key else ""))
		if (not Js.T(k)) then
			do return DEFAULT_FREE_KICK_RUNUP end
		end
		do return TAKER_FREE_KICK_POOL[math.fmod(hashKey(("fk:" .. k)), Js.alen(TAKER_FREE_KICK_POOL)) + 1].id end
	end
	exports.takerFreeKickRunup = takerFreeKickRunup
	takerRunupFor = function(kind, key)
		do return (if (kind == "free_kick") then takerFreeKickRunup(key) else takerPenaltyRunup(key)) end
	end
	exports.takerRunupFor = takerRunupFor
	yourRunupFor = function(kind, penalty, freeKick)
		do return (if (kind == "free_kick") then freeKick else penalty) end
	end
	exports.yourRunupFor = yourRunupFor
	runupDurationS = function(id)
		do return RUNUP_MOTION[id].runS end
	end
	exports.runupDurationS = runupDurationS
	standBackFor = function(id, ball, player, view)
		local m = RUNUP_MOTION[id]
		local back = m.startBack
		if view then
			local margin = 1.6
			local inside = function(p)
				return ((((p.x >= (view.x1 + margin)) and (p.x <= (view.x2 - margin))) and (p.y >= (view.y1 + margin))) and (p.y <= (view.y2 - margin)))
			end
			do
				local i = 0
				local _first1 = true
				while true do
					if not _first1 then
						i += 1
					end
					_first1 = false
					if not ((i < 40) and (back > 1.2)) then break end
					if inside(M_penaltyRunup.standBackAt(ball, player, back, m.startAngleDeg)) then
						do break end
					end
					back -= 0.2
				end
			end
		end
		do return M_penaltyRunup.standBackAt(ball, player, back, m.startAngleDeg) end
	end
	exports.standBackFor = standBackFor
	planRunup = function(id, ball, from)
		local to = M_penaltyRunup.plantBeside(ball, from)
		local side = M_penaltyRunup.sideOf(ball, from)
		local m = RUNUP_MOTION[id]
		if (m.curve <= 0) then
			do return Js.O({ id = id, from = Js.ospread(from), to = to, side = side }, { "id", "from", "to", "side" }) end
		end
		local b = M_penaltyRunup.backDir(ball)
		local back = (Math.hypot((from.x - ball.x), (from.y - ball.y)) * m.curve)
		local ctrl = Js.O({ x = ((ball.x + ((b.x * back) * 0.95)) + ((from.x - ball.x) * 0.25)), y = ((ball.y + ((b.y * back) * 0.95)) + ((from.y - ball.y) * 0.25)) }, { "x", "y" })
		do return Js.O({ id = id, from = Js.ospread(from), to = to, ctrl = ctrl, side = side }, { "id", "from", "to", "ctrl", "side" }) end
	end
	exports.planRunup = planRunup
	runupProgress = function(id, t)
		local T = RUNUP_MOTION[id].runS
		local u = clamp01((t / T))
		local _sw2 = id
		local _ci3 = (if _sw2 == "standard" then 1 elseif _sw2 == "fk_standard" then 2 elseif _sw2 == "arc" then 3 elseif _sw2 == "fk_calm_curl" then 4 elseif _sw2 == "fk_angled_whip" then 5 elseif _sw2 == "stroll" then 6 elseif _sw2 == "sprint" then 7 elseif _sw2 == "skip" then 8 elseif _sw2 == "stutter" then 9 elseif _sw2 == "two_step" then 10 elseif _sw2 == "fk_power_stance" then 11 elseif _sw2 == "fk_stance_sprint" then 12 elseif _sw2 == "fk_stutter_curl" then 13 elseif _sw2 == "fk_long_diagonal" then 14 elseif _sw2 == "golden" then 15 elseif _sw2 == "fk_leaf" then 16 else 0)
		local _cont4 = false
		repeat
			if _ci3 ~= 0 and _ci3 <= 5 then
				do return jog(u) end
			end
			if _ci3 ~= 0 and _ci3 <= 6 then
				do return ((0.85 * u) + (0.15 * smooth(u))) end
			end
			if _ci3 ~= 0 and _ci3 <= 7 then
				do return ((0.2 * u) + (0.8 * Math.pow(u, 1.7))) end
			end
			if _ci3 ~= 0 and _ci3 <= 8 then
				if (t < 1.45) then
					do return lerp(0, 0.6, span(t, 0, 1.45)) end
				end
				if (t < 1.65) then
					do return lerp(0.6, 0.66, span(t, 1.45, 1.65)) end
				end
				if (t < 2.2) then
					do return lerp(0.66, 0.93, span(t, 1.65, 2.2)) end
				end
				do return lerp(0.93, 1, smooth(span(t, 2.2, T))) end
			end
			if _ci3 ~= 0 and _ci3 <= 9 then
				if (t < 1.15) then
					do return lerp(0, 0.6, span(t, 0, 1.15)) end
				end
				if (t < 2.15) then
					do return lerp(0.6, 0.63, span(t, 1.15, 2.15)) end
				end
				do return lerp(0.63, 1, span(t, 2.15, T)) end
			end
			if _ci3 ~= 0 and _ci3 <= 10 then
				if (t < 0.7) then
					do return 0 end
				end
				do return smooth(span(t, 0.7, T)) end
			end
			if _ci3 ~= 0 and _ci3 <= 11 then
				do return (if (t < 1.3) then 0 else jog(span(t, 1.3, T))) end
			end
			if _ci3 ~= 0 and _ci3 <= 12 then
				if (t < 0.8) then
					do return 0 end
				end
				do
					local v = span(t, 0.8, T)
					do return ((0.2 * v) + (0.8 * Math.pow(v, 1.6))) end
				end
			end
			if _ci3 ~= 0 and _ci3 <= 13 then
				if (t < 0.9) then
					do return lerp(0, 0.5, span(t, 0, 0.9)) end
				end
				if (t < 1.5) then
					do return lerp(0.5, 0.56, span(t, 0.9, 1.5)) end
				end
				do return lerp(0.56, 1, jog(span(t, 1.5, T))) end
			end
			if _ci3 ~= 0 and _ci3 <= 14 then
				do return ((0.2 * u) + (0.8 * smooth(u))) end
			end
			if _ci3 ~= 0 and _ci3 <= 15 then
				do return ((0.12 * u) + (0.88 * smooth(u))) end
			end
			if _ci3 ~= 0 and _ci3 <= 16 then
				do return (if (t < 0.5) then 0 else jog(span(t, 0.5, T))) end
			end
		until true
	end
	exports.runupProgress = runupProgress
	runupPositionAt = function(r, t)
		if ((r.id == "standard") or (r.id == "fk_standard")) then
			do return M_penaltyRunup.playerAt(Js.O({ from = r.from, to = r.to }, { "from", "to" }), (t / STANDARD_MOTION.runS)) end
		end
		local e = runupProgress(r.id, t)
		if (not r.ctrl) then
			do return Js.O({ x = lerp(r.from.x, r.to.x, e), y = lerp(r.from.y, r.to.y, e) }, { "x", "y" }) end
		end
		local a = (1 - e)
		do return Js.O({ x = ((((a * a) * r.from.x) + (((2 * a) * e) * r.ctrl.x)) + ((e * e) * r.to.x)), y = ((((a * a) * r.from.y) + (((2 * a) * e) * r.ctrl.y)) + ((e * e) * r.to.y)) }, { "x", "y" }) end
	end
	exports.runupPositionAt = runupPositionAt
	runupPoseAt = function(r, t)
		local T = RUNUP_MOTION[r.id].runS
		local run = function(rate, amp)
			return (amp * Math.sin((t * rate)))
		end
		local base = Js.O({ legSwing = 0, armSpread = 0, armLift = -0.55, crouch = 0, lift = 0, lean = 0 }, { "legSwing", "armSpread", "armLift", "crouch", "lift", "lean" })
		local stance = function(breathFrom, breathTo)
			return Js.ospread(base, Js.O({ legSwing = 1.15, armSpread = 0.3, armLift = -0.75, crouch = (0.14 - (0.14 * Math.sin((Math.PI * span(t, breathFrom, breathTo))))) }, { "legSwing", "armSpread", "armLift", "crouch" }))
		end
		local _sw5 = r.id
		local _ci6 = (if _sw5 == "standard" then 1 elseif _sw5 == "fk_standard" then 2 elseif _sw5 == "stroll" then 3 elseif _sw5 == "sprint" then 4 elseif _sw5 == "skip" then 5 elseif _sw5 == "stutter" then 6 elseif _sw5 == "two_step" then 7 elseif _sw5 == "arc" then 8 elseif _sw5 == "fk_power_stance" then 9 elseif _sw5 == "fk_stance_sprint" then 10 elseif _sw5 == "fk_calm_curl" then 11 elseif _sw5 == "fk_stutter_curl" then 12 elseif _sw5 == "fk_angled_whip" then 13 elseif _sw5 == "fk_long_diagonal" then 14 elseif _sw5 == "golden" then 15 elseif _sw5 == "fk_leaf" then 16 else 0)
		local _cont7 = false
		repeat
			if _ci6 ~= 0 and _ci6 <= 2 then
				do return nil end
			end
			if _ci6 ~= 0 and _ci6 <= 3 then
				do
					local settle = (1 - smooth(span(t, (T - 0.3), T)))
					do return Js.ospread(base, Js.O({ legSwing = (run(5.2, 0.35) * settle), armLift = -1, lift = ((0.014 * math.abs(Math.sin((t * 5.2)))) * settle), lean = ((0.07 * Math.sin((t * 5.2))) * settle) }, { "legSwing", "armLift", "lift", "lean" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 4 then
				do
					do return Js.ospread(base, Js.O({ legSwing = run(16, 1.6), crouch = 0.22, armSpread = 0.12, armLift = -0.45, lift = (0.03 * math.abs(Math.sin((t * 16)))) }, { "legSwing", "crouch", "armSpread", "armLift", "lift" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 5 then
				do
					if (t < 1.45) then
						do return Js.ospread(base, Js.O({ legSwing = run(9, 1) }, { "legSwing" })) end
					end
					if (t < 1.65) then
						local g = span(t, 1.45, 1.65)
						do return Js.ospread(base, Js.O({ legSwing = (run(9, 1) * (1 - g)), crouch = (0.5 * g), armSpread = (0.2 * g) }, { "legSwing", "crouch", "armSpread" })) end
					end
					if (t < 2.2) then
						local s = span(t, 1.65, 2.2)
						do return Js.ospread(base, Js.O({ legSwing = 0.7, lift = (0.26 * Math.sin((Math.PI * s))), crouch = (0.15 * (1 - Math.sin((Math.PI * s)))), armSpread = 0.6, armLift = 0.35 }, { "legSwing", "lift", "crouch", "armSpread", "armLift" })) end
					end
					local l = span(t, 2.2, T)
					do return Js.ospread(base, Js.O({ legSwing = -0.4, crouch = ((0.45 * (1 - l)) + 0.15), armSpread = 0.45 }, { "legSwing", "crouch", "armSpread" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 6 then
				do
					if (t < 1.15) then
						do return Js.ospread(base, Js.O({ legSwing = run(9, 1) }, { "legSwing" })) end
					end
					if (t < 2.15) then
						do return Js.ospread(base, Js.O({ legSwing = run(20, 0.2), crouch = (0.28 + (0.12 * Math.sin((t * 11)))), armSpread = 0.35, armLift = -0.3 }, { "legSwing", "crouch", "armSpread", "armLift" })) end
					end
					do return Js.ospread(base, Js.O({ legSwing = run(14, 0.9), crouch = 0.15 }, { "legSwing", "crouch" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 7 then
				do
					if (t < 0.7) then
						do return Js.ospread(base, Js.O({ crouch = 0.4, armSpread = 0.35, armLift = -0.3 }, { "crouch", "armSpread", "armLift" })) end
					end
					local v = span(t, 0.7, T)
					do return Js.ospread(base, Js.O({ legSwing = (1.2 * Math.sin(((2 * Math.PI) * v))), crouch = 0.2, armSpread = 0.15 }, { "legSwing", "crouch", "armSpread" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 8 then
				do
					local u = clamp01((t / T))
					do return Js.ospread(base, Js.O({ legSwing = run(10, 1.05), crouch = 0.15, lean = (((-r.side) * 0.3) * Math.sin((Math.PI * u))) }, { "legSwing", "crouch", "lean" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 9 then
				do
					if (t < 1.3) then
						do return stance(0.15, 1.2) end
					end
					do return Js.ospread(base, Js.O({ legSwing = run(10, 1.15), crouch = 0.12, armSpread = 0.2 }, { "legSwing", "crouch", "armSpread" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 10 then
				do
					if (t < 0.8) then
						do return stance(0.05, 0.75) end
					end
					do return Js.ospread(base, Js.O({ legSwing = run(16, 1.5), crouch = 0.2, armSpread = 0.12, armLift = -0.45, lift = (0.025 * math.abs(Math.sin((t * 16)))) }, { "legSwing", "crouch", "armSpread", "armLift", "lift" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 11 then
				do
					do return Js.ospread(base, Js.O({ legSwing = run(7.5, 0.6), armLift = -0.85 }, { "legSwing", "armLift" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 12 then
				do
					if (t < 0.9) then
						do return Js.ospread(base, Js.O({ legSwing = run(10, 0.9) }, { "legSwing" })) end
					end
					if (t < 1.5) then
						do return Js.ospread(base, Js.O({ legSwing = run(22, 0.25), crouch = 0.2, armSpread = 0.3, lean = (0.14 * Math.sin((t * 14))) }, { "legSwing", "crouch", "armSpread", "lean" })) end
					end
					do return Js.ospread(base, Js.O({ legSwing = run(12, 0.9), crouch = 0.1 }, { "legSwing", "crouch" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 13 then
				do
					do return Js.ospread(base, Js.O({ legSwing = run(10, 0.95), crouch = 0.1, armSpread = 0.2, lean = ((-r.side) * 0.16) }, { "legSwing", "crouch", "armSpread", "lean" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 14 then
				do
					local u = clamp01((t / T))
					do return Js.ospread(base, Js.O({ legSwing = run(11, 1.1), armSpread = 0.15, lean = (((-r.side) * 0.12) * Math.sin((Math.PI * u))) }, { "legSwing", "armSpread", "lean" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 15 then
				do
					local u = clamp01((t / T))
					do return Js.ospread(base, Js.O({ legSwing = run(9.5, 1.05), armSpread = 0.22, armLift = -0.6, crouch = 0.06, lean = (((-r.side) * 0.18) * Math.sin((Math.PI * u))) }, { "legSwing", "armSpread", "armLift", "crouch", "lean" })) end
				end
			end
			if _ci6 ~= 0 and _ci6 <= 16 then
				do
					if (t < 0.5) then
						do return Js.ospread(base, Js.O({ armSpread = 0.35, armLift = -0.25, crouch = 0.05 }, { "armSpread", "armLift", "crouch" })) end
					end
					do return Js.ospread(base, Js.O({ legSwing = run(11, 0.85), crouch = 0.1, armSpread = 0.18 }, { "legSwing", "crouch", "armSpread" })) end
				end
			end
		until true
	end
	exports.runupPoseAt = runupPoseAt
	PENALTY_RUNUPS = Js.alit(Js.O({ id = "standard", name = "Standard", blurb = "A steady jog up to the ball." }, { "id", "name", "blurb" }), Js.O({ id = "stroll", name = "The Stroll", blurb = "Walks slowly up to the ball, then strikes." }, { "id", "name", "blurb" }), Js.O({ id = "skip", name = "The Skip", blurb = "A little skip and a jump into the kick." }, { "id", "name", "blurb" }), Js.O({ id = "sprint", name = "The Sprint", blurb = "Full speed from further back, and smash it." }, { "id", "name", "blurb" }), Js.O({ id = "stutter", name = "Stutter Step", blurb = "Stop, start — a pause just before the ball." }, { "id", "name", "blurb" }), Js.O({ id = "two_step", name = "Two Steps", blurb = "Very short: two steps and strike." }, { "id", "name", "blurb" }), Js.O({ id = "arc", name = "The Arc", blurb = "A wide, curved run in from the side." }, { "id", "name", "blurb" }), Js.O({ id = "golden", name = "Golden Run-up", blurb = "A confident, curving jog-up that leaves a gold trail behind you." }, { "id", "name", "blurb" }))
	exports.PENALTY_RUNUPS = PENALTY_RUNUPS
	FREE_KICK_RUNUPS = Js.alit(Js.O({ id = "fk_standard", name = "Standard", blurb = "A steady jog up to the ball." }, { "id", "name", "blurb" }), Js.O({ id = "fk_power_stance", name = "Power Stance", player = "Ronaldo", blurb = "Ronaldo's knuckleball set-up: legs wide, a deep breath, then a few strong steps." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_stance_sprint", name = "Stance and Sprint", player = "Bale", blurb = "Bale's: the same wide stance, then a short sprint into it." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_calm_curl", name = "The Calm Curl", player = "Messi", blurb = "Messi's: a short, calm run — the set-up for curling it over the wall." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_stutter_curl", name = "Stutter Curl", player = "Neymar", blurb = "Neymar's: a short run, a little stutter, then the curl." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_angled_whip", name = "The Whip", player = "Maddison", blurb = "Maddison's: a short, angled approach for a whipped curl." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_long_diagonal", name = "Long Diagonal", player = "Trent", blurb = "Trent's: a long diagonal run for a whip that dips." }, { "id", "name", "player", "blurb" }), Js.O({ id = "fk_leaf", name = "The Leaf", player = "Juninho", blurb = "Juninho's: the legend's free kick — it dips and swerves late." }, { "id", "name", "player", "blurb" }))
	exports.FREE_KICK_RUNUPS = FREE_KICK_RUNUPS
	REWARD_RUNUPS = Js.Set.new(Js.alit("golden", "fk_leaf"))
	exports.REWARD_RUNUPS = REWARD_RUNUPS
	LEAF_RUNUP = "fk_leaf"
	exports.LEAF_RUNUP = LEAF_RUNUP
	GOLDEN_RUNUP = "golden"
	exports.GOLDEN_RUNUP = GOLDEN_RUNUP
	TAKER_PENALTY_POOL = A.filter(PENALTY_RUNUPS, function(s)
		return (not REWARD_RUNUPS:has(s.id))
	end)
	TAKER_FREE_KICK_POOL = A.filter(FREE_KICK_RUNUPS, function(s)
		return (not REWARD_RUNUPS:has(s.id))
	end)
	DEFAULT_PENALTY_RUNUP = "standard"
	exports.DEFAULT_PENALTY_RUNUP = DEFAULT_PENALTY_RUNUP
	DEFAULT_FREE_KICK_RUNUP = "fk_standard"
	exports.DEFAULT_FREE_KICK_RUNUP = DEFAULT_FREE_KICK_RUNUP
	RUNUP_STYLES = PENALTY_RUNUPS
	exports.RUNUP_STYLES = RUNUP_STYLES
	DEFAULT_RUNUP_STYLE = DEFAULT_PENALTY_RUNUP
	exports.DEFAULT_RUNUP_STYLE = DEFAULT_RUNUP_STYLE
	PEN_IDS = Js.Set.new(A.map(PENALTY_RUNUPS, function(s)
		return s.id
	end))
	FK_IDS = Js.Set.new(A.map(FREE_KICK_RUNUPS, function(s)
		return s.id
	end))
	isRunupStyleId = isPenaltyRunupId
	exports.isRunupStyleId = isRunupStyleId
	runupStyleOf = penaltyRunupOf
	exports.runupStyleOf = runupStyleOf
	ownsRunupStyle = ownsRunup
	exports.ownsRunupStyle = ownsRunupStyle
	takerRunupStyle = takerPenaltyRunup
	exports.takerRunupStyle = takerRunupStyle
	STANDARD_MOTION = Js.O({ runS = M_penaltyRunup.RUNUP.runupS, startBack = M_penaltyRunup.RUNUP.startBack, startAngleDeg = M_penaltyRunup.RUNUP.startAngleDeg, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" })
	RUNUP_MOTION = Js.O({ standard = STANDARD_MOTION, stroll = Js.O({ runS = 3.1, startBack = 3.8, startAngleDeg = 26, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), skip = Js.O({ runS = 2.5, startBack = 3.9, startAngleDeg = 30, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), sprint = Js.O({ runS = 2.3, startBack = 7.2, startAngleDeg = 16, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), stutter = Js.O({ runS = 3, startBack = 4.4, startAngleDeg = 30, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), two_step = Js.O({ runS = 1.7, startBack = 1.6, startAngleDeg = 14, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), arc = Js.O({ runS = 2.8, startBack = 5.4, startAngleDeg = 74, curve = 0.8 }, { "runS", "startBack", "startAngleDeg", "curve" }), golden = Js.O({ runS = 2.6, startBack = 6.2, startAngleDeg = 40, curve = 0.45 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_standard = STANDARD_MOTION, fk_power_stance = Js.O({ runS = 3, startBack = 5.2, startAngleDeg = 6, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_stance_sprint = Js.O({ runS = 2.4, startBack = 5, startAngleDeg = 10, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_calm_curl = Js.O({ runS = 1.9, startBack = 2.4, startAngleDeg = 38, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_stutter_curl = Js.O({ runS = 2.7, startBack = 3.4, startAngleDeg = 34, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_angled_whip = Js.O({ runS = 2.1, startBack = 3.2, startAngleDeg = 55, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_long_diagonal = Js.O({ runS = 3, startBack = 7, startAngleDeg = 42, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }), fk_leaf = Js.O({ runS = 2.3, startBack = 3.6, startAngleDeg = 22, curve = 0 }, { "runS", "startBack", "startAngleDeg", "curve" }) }, { "standard", "stroll", "skip", "sprint", "stutter", "two_step", "arc", "golden", "fk_standard", "fk_power_stance", "fk_stance_sprint", "fk_calm_curl", "fk_stutter_curl", "fk_angled_whip", "fk_long_diagonal", "fk_leaf" })
	exports.RUNUP_MOTION = RUNUP_MOTION
	clamp01 = function(v)
		return Math.max(0, Math.min(1, v))
	end
	smooth = function(u)
		local t = clamp01(u)
		do return ((t * t) * (3 - (2 * t))) end
	end
	span = function(t, a, b)
		return clamp01(((t - a) / (b - a)))
	end
	lerp = function(a, b, u)
		return (a + ((b - a) * u))
	end
	jog = function(u)
		return ((0.18 * clamp01(u)) + (0.82 * smooth(u)))
	end
end
