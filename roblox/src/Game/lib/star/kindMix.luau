--!nocheck
--!nolint
-- Generated from lib/star/kindMix.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_switchedOffKinds = import("lib/star/switchedOffKinds")
	local EVEN_KIND_MIX, EVEN_KINDS, newKindBag, REAL_MIX, realMixRound, DECK_STYLE, styledRound, nextEvenKind, GUARD_WINDOW, GUARD_MAX_IN_WINDOW, guardAllows, pickCopies, guardedDeal, noteDealt
	newKindBag = function()
		do return Js.O({ left = Js.alit() }, { "left" }) end
	end
	exports.newKindBag = newKindBag
	realMixRound = function()
		do return A.flatMap(EVEN_KINDS, function(k)
			return A.fill(Js.Array.new((if REAL_MIX[k] ~= nil then REAL_MIX[k] else 1)), k)
		end) end
	end
	exports.realMixRound = realMixRound
	styledRound = function(rules)
		local w = (function() local _l = (if Js.T(rules.style) then DECK_STYLE[rules.style] else rules.style); if Js.T(_l) then return _l end; return Js.O({}, nil) end)()
		local ex = Js.Set.new((if rules.exclude ~= nil then rules.exclude else Js.alit()))
		do return A.flatMap(A.filter(EVEN_KINDS, function(k)
			return (not ex:has(k))
		end), function(k)
			return A.fill(Js.Array.new((if w[k] ~= nil then w[k] else 2)), k)
		end) end
	end
	exports.styledRound = styledRound
	nextEvenKind = function(bag, rng, real, rules)
		if real == nil then real = false end
		if (rules and (not real)) then
			local style = (if rules.style ~= nil then rules.style else "balanced")
			if (bag.style ~= style) then
				bag.left = Js.alit()
				bag.style = style
			end
			local ex = Js.Set.new((if rules.exclude ~= nil then rules.exclude else Js.alit()))
			bag.left = A.filter(bag.left, function(k)
				return (not ex:has(k))
			end)
		end
		if (Js.alen(bag.left) == 0) then
			local round = (if real then realMixRound() else (if rules then styledRound(rules) else Js.aspread(EVEN_KINDS)))
			for i = (Js.alen(round) - 1), 1, -1 do
				local j = math.floor((rng() * (i + 1)))
				local _d1 = Js.alit(round[j + 1], round[i + 1])
				A.set(round, i, _d1[1])
				A.set(round, j, _d1[2])
			end
			if ((Js.alen(round) > 1) and (round[1] == bag.last)) then
				local _d2 = Js.alit(round[2], round[1])
				A.set(round, 0, _d2[1])
				A.set(round, 1, _d2[2])
			end
			bag.left = round
		end
		local k = A.shift(bag.left)
		bag.last = k
		do return k end
	end
	exports.nextEvenKind = nextEvenKind
	guardAllows = function(k, dealt)
		if (Js.T(Js.alen(dealt)) and (dealt[Js.alen(dealt)] == k)) then
			do return false end
		end
		local last = A.slice(dealt, (-(GUARD_WINDOW - 1)))
		do return (Js.alen(A.filter(last, function(x)
			return (x == k)
		end)) < GUARD_MAX_IN_WINDOW) end
	end
	exports.guardAllows = guardAllows
	pickCopies = function(list, rng)
		do return list[Math.min((Js.alen(list) - 1), math.floor((rng() * Js.alen(list)))) + 1] end
	end
	guardedDeal = function(offered, wider, dealt, rng)
		local notLast = function(k)
			return (not (Js.T(Js.alen(dealt)) and (dealt[Js.alen(dealt)] == k)))
		end
		local tiers = Js.aspread(Js.alit(A.filter(offered, function(k)
			return guardAllows(k, dealt)
		end)), A.map(wider, function(w)
			return A.filter(w, function(k)
				return guardAllows(k, dealt)
			end)
		end), Js.alit(A.filter(offered, notLast)), A.map(wider, function(w)
			return A.filter(w, notLast)
		end))
		local pool = (A.find(tiers, function(t)
			return Js.alen(t)
		end) or Js.aspread(offered))
		do return pickCopies(pool, rng) end
	end
	exports.guardedDeal = guardedDeal
	noteDealt = function(dealt, k)
		A.push(dealt, k)
		if (Js.alen(dealt) > GUARD_WINDOW) then
			A.splice(dealt, 0, (Js.alen(dealt) - GUARD_WINDOW))
		end
	end
	exports.noteDealt = noteDealt
	EVEN_KIND_MIX = true
	exports.EVEN_KIND_MIX = EVEN_KIND_MIX
	EVEN_KINDS = A.filter(Js.alit("one_on_one", "tight_angle", "long_range", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "header", "volley"), function(k)
		return (not M_switchedOffKinds.isSwitchedOff(k))
	end)
	exports.EVEN_KINDS = EVEN_KINDS
	REAL_MIX = Js.O({ midfield_pass = 4, buildup = 3, through_ball = 3, long_range = 2, cutback = 2, byline_cross = 1, tight_angle = 1, one_on_one = 1, header = 0, volley = 0 }, { "midfield_pass", "buildup", "through_ball", "long_range", "cutback", "byline_cross", "tight_angle", "one_on_one", "header", "volley" })
	exports.REAL_MIX = REAL_MIX
	DECK_STYLE = Js.O({ attacking = Js.O({ byline_cross = 0, one_on_one = 3, cutback = 3, tight_angle = 3, buildup = 1, midfield_pass = 1 }, { "byline_cross", "one_on_one", "cutback", "tight_angle", "buildup", "midfield_pass" }), balanced = Js.O({ byline_cross = 1 }, { "byline_cross" }), defensive = Js.O({ byline_cross = 3, midfield_pass = 3, buildup = 3, through_ball = 3, long_range = 3, one_on_one = 1, tight_angle = 1 }, { "byline_cross", "midfield_pass", "buildup", "through_ball", "long_range", "one_on_one", "tight_angle" }) }, { "attacking", "balanced", "defensive" })
	exports.DECK_STYLE = DECK_STYLE
	GUARD_WINDOW = 8
	exports.GUARD_WINDOW = GUARD_WINDOW
	GUARD_MAX_IN_WINDOW = 2
	exports.GUARD_MAX_IN_WINDOW = GUARD_MAX_IN_WINDOW
end
