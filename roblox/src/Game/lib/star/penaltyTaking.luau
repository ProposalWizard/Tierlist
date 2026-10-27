--!nocheck
--!nolint
-- Generated from lib/star/penaltyTaking.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_pitch = import("lib/star/pitch")
	local M_setPieces = import("lib/star/setPieces")
	local takerRating, yourPenaltyRating, YOU_WITHIN_FIRST, shootoutOrder, designatedTaker, planPenalty, sameHeight, takerSkills, aimFor, attachAutoKick, autoKickOf, AUTO_STAND_MS, clearForShootout, OFF_PITCH_PEN_CONVERT
	takerRating = function(p)
		local r = ((if p.shooting ~= nil then p.shooting else p.overall) or 62)
		do return Math.max(25, Math.min(99, (if Js.NumberNS.isFinite(r) then r else 62))) end
	end
	exports.takerRating = takerRating
	yourPenaltyRating = function(skills, stars)
		local strike = ((skills.technique * 0.4) + (skills.freeKick * 0.6))
		do return Math.max(25, Math.min(99, (strike + (Math.max(0, stars) * 3)))) end
	end
	exports.yourPenaltyRating = yourPenaltyRating
	shootoutOrder = function(mates, you, youBy)
		if youBy == nil then youBy = YOU_WITHIN_FIRST end
		local outfield = A.filter(mates, function(p)
			return (not p.isGK)
		end)
		local keepers = A.filter(mates, function(p)
			return p.isGK
		end)
		local all = (if you then Js.aspread(outfield, Js.alit(you)) else outfield)
		local ranked = A.map(A.sort(A.map(all, function(p, i)
			return Js.O({ p = p, i = i }, { "p", "i" })
		end), function(a, b)
			return (function() local _l = (b.p.rating - a.p.rating); if Js.T(_l) then return _l end; return (a.i - b.i) end)()
		end), function(x)
			return x.p
		end)
		if you then
			local at = A.indexOf(ranked, you)
			local latest = Math.max(0, (youBy - 1))
			if (at > latest) then
				A.splice(ranked, at, 1)
				A.splice(ranked, latest, 0, you)
			end
		end
		do return Js.aspread(ranked, keepers) end
	end
	exports.shootoutOrder = shootoutOrder
	designatedTaker = function(mates)
		local outfield = A.filter(mates, function(p)
			return (not p.isGK)
		end)
		if (Js.alen(outfield) == 0) then
			do return nil end
		end
		do return A.reduce(outfield, function(best, p)
			return (if (p.rating > best.rating) then p else best)
		end, outfield[1]) end
	end
	exports.designatedTaker = designatedTaker
	planPenalty = function(rating, rng)
		local q = Math.max(0, Math.min(1, ((rating - 45) / 50)))
		local tech = takerSkills(rating).technique
		local u = rng()
		local middleShare = 0.16
		local chipShare = 0.05
		local side = (if (rng() < 0.5) then -1 else 1)
		local power = function()
			return Math.min(0.94, ((0.6 + (0.2 * q)) + (rng() * 0.14)))
		end
		if (u < chipShare) then
			do return Js.O({ style = "chip", off = ((rng() - 0.5) * 0.6), power = (0.4 + (rng() * 0.05)), cy = sameHeight((0.3 + (rng() * 0.45)), tech) }, { "style", "off", "power", "cy" }) end
		end
		if (u < (chipShare + middleShare)) then
			do return Js.O({ style = "middle", off = ((rng() - 0.5) * 0.8), power = power(), cy = sameHeight((-1 + (rng() * 1.2)), tech) }, { "style", "off", "power", "cy" }) end
		end
		local reach = Math.pow(rng(), (0.5 - (0.12 * q)))
		do return Js.O({ style = "placed", off = (side * (1.4 + (2 * reach))), power = power(), cy = sameHeight((-1 + (rng() * 1.2)), tech) }, { "style", "off", "power", "cy" }) end
	end
	exports.planPenalty = planPenalty
	sameHeight = function(cy60, tech)
		local L60 = M_canvasEngine.loftRange(60)
		local LT = M_canvasEngine.loftRange(tech)
		local target = ((((cy60 * L60) + 1) / 2) * ((L60 + 1) / 2))
		local cy = ((((target / ((LT + 1) / 2)) * 2) - 1) / LT)
		do return Math.max(-1, Math.min(1, cy)) end
	end
	exports.sameHeight = sameHeight
	takerSkills = function(rating)
		do return Js.O({ power = 60, technique = Math.round(Math.max(25, Math.min(99, rating))) }, { "power", "technique" }) end
	end
	exports.takerSkills = takerSkills
	aimFor = function(sc, plan)
		local cx = (if sc.goal then ((sc.goal.x1 + sc.goal.x2) / 2) else M_pitch.CX)
		local tx = Math.max((M_pitch.POST_L - 1.5), Math.min((M_pitch.POST_R + 1.5), (cx + plan.off)))
		local dx = (tx - sc.ball.x)
		local dy = (0 - sc.ball.y)
		local L = (function() local _l = Math.hypot(dx, dy); if Js.T(_l) then return _l end; return 1 end)()
		do return Js.O({ dir = Js.O({ x = (dx / L), y = (dy / L) }, { "x", "y" }), power = plan.power, contact = Js.O({ cx = 0, cy = plan.cy }, { "cx", "cy" }) }, { "dir", "power", "contact" }) end
	end
	exports.aimFor = aimFor
	attachAutoKick = function(sc, k)
		sc.autoKick = k
		do return sc end
	end
	exports.attachAutoKick = attachAutoKick
	autoKickOf = function(sc)
		do return (function() local _v = sc; if _v == nil then return nil end; _v = _v.autoKick; return _v end)() end
	end
	exports.autoKickOf = autoKickOf
	clearForShootout = function(sc)
		sc.defenders = Js.alit()
	end
	exports.clearForShootout = clearForShootout
	YOU_WITHIN_FIRST = 5
	exports.YOU_WITHIN_FIRST = YOU_WITHIN_FIRST
	Js.reexport(exports, M_setPieces, { ["PENALTY_STAR_WEIGHT"] = "PENALTY_STAR_WEIGHT" })
	AUTO_STAND_MS = 700
	exports.AUTO_STAND_MS = AUTO_STAND_MS
	OFF_PITCH_PEN_CONVERT = 0.76
	exports.OFF_PITCH_PEN_CONVERT = OFF_PITCH_PEN_CONVERT
end
