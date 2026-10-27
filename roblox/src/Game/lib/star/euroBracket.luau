--!nocheck
--!nolint
-- Generated from lib/star/euroBracket.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_shootout = import("lib/star/shootout")
	local EURO_KO_ROUNDS, openEuroBracket, playTie, ordered, advanceEuroBracket, yourKoTie, euroTieFromBracket, settleYourKoTie, koAggregate
	openEuroBracket = function(table_, rng)
		local pos = function(n)
			return table_[n]
		end
		local finish = Js.O({}, nil)
		A.forEach(A.slice(table_, 0, 24), function(c, i)
			finish[c] = (i + 1)
		end)
		local swap = function(p)
			return (if (rng() < 0.5) then p else Js.alit(p[2], p[1]))
		end
		local seedPairFor = Js.alit(Js.alit(7, 8), Js.alit(5, 6), Js.alit(3, 4), Js.alit(1, 2))
		local band = function(k)
			local _d1 = swap(Js.alit((23 - (2 * k)), (24 - (2 * k))))
			local u0 = _d1[1]
			local u1 = _d1[2]
			local ties = Js.alit(Js.alit((9 + (2 * k)), u0), Js.alit((10 + (2 * k)), u1))
			local seeds = swap(Js.alit(seedPairFor[k + 1][1], seedPairFor[k + 1][2]))
			do return Js.O({ ties = swap(ties), seeds = seeds }, { "ties", "seeds" }) end
		end
		local b = A.map(Js.alit(0, 1, 2, 3), band)
		local order = Js.alit(3, 0, 2, 1)
		local seeds = Js.alit()
		local playOff = Js.alit()
		do
			local _arr2 = Js.alit(0, 1)
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local half = _arr2[_i3]
				do
					local _arr4 = order
					local _i5 = 0
					while _i5 < Js.alen(_arr4) do
						_i5 += 1
						local k = _arr4[_i5]
						A.push(seeds, pos((b[k + 1].seeds)[half + 1]))
						local _d6 = (b[k + 1].ties)[half + 1]
						local hi = _d6[1]
						local lo = _d6[2]
						A.push(playOff, Js.O({ a = pos(hi), b = pos(lo), legs = Js.alit() }, { "a", "b", "legs" }))
					end
				end
			end
		end
		local empty = function(n)
			return Js.Array.from(Js.O({ length = n }, { "length" }), function()
				return Js.O({ legs = Js.alit() }, { "legs" })
			end)
		end
		do return Js.O({ finish = finish, seeds = seeds, rounds = Js.alit(Js.O({ name = EURO_KO_ROUNDS[1], ties = playOff }, { "name", "ties" }), Js.O({ name = EURO_KO_ROUNDS[2], ties = A.map(seeds, function(s)
			return Js.O({ a = s, legs = Js.alit() }, { "a", "legs" })
		end) }, { "name", "ties" }), Js.O({ name = EURO_KO_ROUNDS[3], ties = empty(4) }, { "name", "ties" }), Js.O({ name = EURO_KO_ROUNDS[4], ties = empty(2) }, { "name", "ties" }), Js.O({ name = EURO_KO_ROUNDS[5], ties = empty(1) }, { "name", "ties" })) }, { "finish", "seeds", "rounds" }) end
	end
	exports.openEuroBracket = openEuroBracket
	playTie = function(t, single, str, sim, rng)
		local sa = str(t.a)
		local sb = str(t.b)
		local legs = Js.alit()
		if single then
			local _d7 = sim(sa, sb, rng)
			local x = _d7[1]
			local y = _d7[2]
			A.push(legs, Js.O({ a = x, b = y, aHome = true }, { "a", "b", "aHome" }))
		else
			local _d8 = sim(sb, sa, rng)
			local h1 = _d8[1]
			local a1 = _d8[2]
			A.push(legs, Js.O({ a = a1, b = h1, aHome = false }, { "a", "b", "aHome" }))
			local _d9 = sim(sa, sb, rng)
			local h2 = _d9[1]
			local a2 = _d9[2]
			A.push(legs, Js.O({ a = h2, b = a2, aHome = true }, { "a", "b", "aHome" }))
		end
		local ta = A.reduce(legs, function(s, l)
			return (s + l.a)
		end, 0)
		local tb = A.reduce(legs, function(s, l)
			return (s + l.b)
		end, 0)
		local out = Js.ospread(t, Js.O({ legs = legs }, { "legs" }))
		if (ta == tb) then
			local et = M_shootout.extraTimeScore(sa, sb, rng)
			out.et = Js.O({ a = et.hs, b = et.as }, { "a", "b" })
			local last = legs[Js.alen(legs)]
			A.set(legs, (Js.alen(legs) - 1), Js.ospread(last, Js.O({ a = (last.a + et.hs), b = (last.b + et.as) }, { "a", "b" })))
			ta += et.hs
			tb += et.as
			if (ta == tb) then
				local p = M_shootout.simulateShootout(sa, sb, rng)
				out.pens = Js.O({ a = p.home, b = p.away }, { "a", "b" })
			end
		end
		out.winner = (if (ta ~= tb) then (if (ta > tb) then t.a else t.b) else (if (out.pens.a > out.pens.b) then t.a else t.b))
		do return out end
	end
	ordered = function(br, x, y)
		local fx = (if br.finish[x] ~= nil then br.finish[x] else 99)
		local fy = (if br.finish[y] ~= nil then br.finish[y] else 99)
		do return (if (fx <= fy) then Js.alit(x, y) else Js.alit(y, x)) end
	end
	advanceEuroBracket = function(br, you, str, sim, rng, upToRound)
		if upToRound == nil then upToRound = math.huge end
		local rounds = A.map(br.rounds, function(r)
			return Js.ospread(r, Js.O({ ties = A.map(r.ties, function(t)
				return Js.ospread(t, Js.O({ legs = Js.aspread(t.legs) }, { "legs" }))
			end) }, { "ties" }))
		end)
		local winner = br.winner
		for guard = 0, 11 do
			local changed = false
			A.forEach(rounds, function(r, ri)
				A.forEach(r.ties, function(t, ti)
					if ((((((ri <= upToRound) and Js.T(t.a)) and Js.T(t.b)) and (not Js.T(t.winner))) and (t.a ~= you)) and (t.b ~= you)) then
						A.set(r.ties, ti, playTie(t, (r.name == "Final"), str, sim, rng))
						changed = true
					end
				end)
				local next_ = rounds[(ri + 1) + 1]
				if (not next_) then
					do return end
				end
				A.forEach(next_.ties, function(nt, j)
					if (Js.T(nt.a) and Js.T(nt.b)) then
						do return end
					end
					if (ri == 0) then
						local w = (function() local _v = r.ties[j + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)()
						if (Js.T(w) and Js.T(nt.a)) then
							local _d10 = ordered(br, nt.a, w)
							local x = _d10[1]
							local y = _d10[2]
							A.set(next_.ties, j, Js.ospread(nt, Js.O({ a = x, b = y }, { "a", "b" })))
							changed = true
						end
						do return end
					end
					local w1 = (function() local _v = r.ties[(2 * j) + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)()
					local w2 = (function() local _v = r.ties[((2 * j) + 1) + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)()
					if (Js.T(w1) and Js.T(w2)) then
						local _d11 = ordered(br, w1, w2)
						local x = _d11[1]
						local y = _d11[2]
						A.set(next_.ties, j, Js.ospread(nt, Js.O({ a = x, b = y }, { "a", "b" })))
						changed = true
					end
				end)
			end)
			local fin = (rounds[Js.alen(rounds)].ties)[1]
			if (Js.T(fin.winner) and (fin.winner ~= winner)) then
				winner = fin.winner
				changed = true
			end
			if (not changed) then
				do break end
			end
		end
		do return Js.ospread(br, Js.O({ rounds = rounds, winner = winner }, { "rounds", "winner" })) end
	end
	exports.advanceEuroBracket = advanceEuroBracket
	yourKoTie = function(br, you)
		do
			local _arr12 = br.rounds
			local _i13 = 0
			while _i13 < Js.alen(_arr12) do
				_i13 += 1
				local r = _arr12[_i13]
				local t = A.find(r.ties, function(x)
					return (function() local _l = (function() local _l = ((not Js.T(x.winner)) and x.a); if Js.T(_l) then return x.b end; return _l end)(); if Js.T(_l) then return ((x.a == you) or (x.b == you)) end; return _l end)()
				end)
				if t then
					do return Js.O({ round = r.name, tie = t }, { "round", "tie" }) end
				end
			end
		end
		do return nil end
	end
	exports.yourKoTie = yourKoTie
	euroTieFromBracket = function(br, you, str)
		local mine = yourKoTie(br, you)
		if (not mine) then
			do return nil end
		end
		local opponent = (if (mine.tie.a == you) then mine.tie.b else mine.tie.a)
		local youHigher = (mine.tie.a == you)
		local single = (mine.round == "Final")
		do return Js.O({ round = mine.round, opponent = opponent, opponentStrength = str(opponent), legs = (if single then Js.alit(Js.O({ home = false }, { "home" })) else Js.alit(Js.O({ home = (not youHigher) }, { "home" }), Js.O({ home = youHigher }, { "home" }))) }, { "round", "opponent", "opponentStrength", "legs" }) end
	end
	exports.euroTieFromBracket = euroTieFromBracket
	settleYourKoTie = function(br, you, decided, str, sim, rng)
		local rounds = A.map(br.rounds, function(r)
			return Js.ospread(r, Js.O({ ties = Js.aspread(r.ties) }, { "ties" }))
		end)
		do
			local _arr14 = rounds
			local _i15 = 0
			while _i15 < Js.alen(_arr14) do
				_i15 += 1
				local r = _arr14[_i15]
				local i = A.findIndex(r.ties, function(x)
					return (function() local _l = (function() local _l = ((not Js.T(x.winner)) and x.a); if Js.T(_l) then return x.b end; return _l end)(); if Js.T(_l) then return ((x.a == you) or (x.b == you)) end; return _l end)()
				end)
				if ((i < 0) or (r.name ~= decided.round)) then
					do continue end
				end
				local t = r.ties[i + 1]
				local youA = (t.a == you)
				local legs = A.map(decided.legs, function(l)
					local us = (if l.us ~= nil then l.us else 0)
					local them = (if l.them ~= nil then l.them else 0)
					do return (if youA then Js.O({ a = us, b = them, aHome = l.home }, { "a", "b", "aHome" }) else Js.O({ a = them, b = us, aHome = (not l.home) }, { "a", "b", "aHome" })) end
				end)
				local flip = function(p)
					return (p and (if youA then Js.O({ a = p.us, b = p.them }, { "a", "b" }) else Js.O({ a = p.them, b = p.us }, { "a", "b" })))
				end
				A.set(r.ties, i, Js.ospread(t, Js.O({ legs = legs, et = flip(decided.extraTime), pens = flip(decided.pens), winner = (if (decided.result == "W") then you else decided.opponent) }, { "legs", "et", "pens", "winner" })))
				do break end
			end
		end
		do return advanceEuroBracket(Js.ospread(br, Js.O({ rounds = rounds }, { "rounds" })), you, str, sim, rng) end
	end
	exports.settleYourKoTie = settleYourKoTie
	koAggregate = function(t)
		if (not Js.T(Js.alen(t.legs))) then
			do return nil end
		end
		do return Js.O({ a = A.reduce(t.legs, function(s, l)
			return (s + l.a)
		end, 0), b = A.reduce(t.legs, function(s, l)
			return (s + l.b)
		end, 0) }, { "a", "b" }) end
	end
	exports.koAggregate = koAggregate
	EURO_KO_ROUNDS = Js.alit("Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final")
	exports.EURO_KO_ROUNDS = EURO_KO_ROUNDS
end
