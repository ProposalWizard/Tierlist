--!nocheck
--!nolint
-- Generated from lib/star/knockoutView.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_cups = import("lib/star/cups")
	local M_euroBracket = import("lib/star/euroBracket")
	local M_grammar = import("lib/star/media/grammar")
	local M_index = import("lib/star/world/index")
	local BRACKET_ROUNDS, boardFromCupTie, cupBoard, cupNote, cupBracket, koNote, euroDoneRound, euroBoard, euroBracketView, EURO_ROUND_LABEL, nextLineFor, knockoutRoundupFor
	boardFromCupTie = function(t, you, str, show)
		local w = (if show then (M_cups.tieWinner(t) or nil) else nil)
		local out = Js.O({ home = t.home, away = t.away, yours = ((t.home == you) or (t.away == you)) }, { "home", "away", "yours" })
		if ((show and (t.hs ~= nil)) and (t.as ~= nil)) then
			out.hs = t.hs
			out.as = t.as
			out.winner = w
			if t.legs then
				out.legs = t.legs
			end
			if t.pens then
				out.pens = Js.O({ hs = t.pens.home, as = t.pens.away }, { "hs", "as" })
			end
			if t.wentToExtraTime then
				out.aet = true
			end
			if Js.T(w) then
				local l = (if (w == t.home) then t.away else t.home)
				out.upset = (str(w) <= (str(l) - 8))
			end
		end
		do return out end
	end
	cupBoard = function(state, roundIndex, you, str)
		local r = state.rounds[roundIndex + 1]
		if (not r) then
			do return Js.alit() end
		end
		local rows = A.map(r.ties, function(t)
			return boardFromCupTie(t, you, str, true)
		end)
		do return Js.aspread(A.filter(rows, function(x)
			return x.yours
		end), A.filter(rows, function(x)
			return (not x.yours)
		end)) end
	end
	exports.cupBoard = cupBoard
	cupNote = function(t)
		if t.pens then
			do return Js.O({ note = ("pens " .. Js.numstr(t.pens.home) .. "–" .. Js.numstr(t.pens.away)), pensWinner = (if (t.pens.home > t.pens.away) then "home" else "away") }, { "note", "pensWinner" }) end
		end
		if (t.legs and (Js.alen(t.legs) > 1)) then
			do return Js.O({ note = "agg." }, { "note" }) end
		end
		if t.wentToExtraTime then
			do return Js.O({ note = "aet" }, { "note" }) end
		end
		do return Js.O({}, nil) end
	end
	cupBracket = function(state, roundIndex, you)
		local r16 = M_cups.lastSixteenIndex(state)
		if (((r16 < 0) or (roundIndex < r16)) or (not state.rounds[r16 + 1])) then
			do return nil end
		end
		local drawn = A.slice(state.rounds, r16)
		local ordered = A.map(drawn, function(r)
			return Js.aspread(r.ties)
		end)
		for i = (Js.alen(ordered) - 2), 0, -1 do
			local next_ = ordered[(i + 1) + 1]
			local pool = Js.aspread(ordered[i + 1])
			local out = Js.alit()
			do
				local _arr1 = next_
				local _i2 = 0
				while _i2 < Js.alen(_arr1) do
					_i2 += 1
					local nt = _arr1[_i2]
					do
						local _arr3 = Js.alit(nt.home, nt.away)
						local _i4 = 0
						while _i4 < Js.alen(_arr3) do
							_i4 += 1
							local club = _arr3[_i4]
							local k = A.findIndex(pool, function(t)
								return (M_cups.tieWinner(t) == club)
							end)
							if (k >= 0) then
								A.push(out, A.splice(pool, k, 1)[1])
							end
						end
					end
				end
			end
			A.set(ordered, i, Js.aspread(out, pool))
		end
		local done = (roundIndex - r16)
		local rounds = A.map(BRACKET_ROUNDS, function(_, bi)
			local size = Js.shr(8, bi)
			local ties = (if ordered[bi + 1] ~= nil then ordered[bi + 1] else Js.alit())
			do return Js.Array.from(Js.O({ length = size }, { "length" }), function(_, j)
				local t = ties[j + 1]
				local v = Js.O({ yours = false }, { "yours" })
				if (t and ((bi == 0) or ((bi - 1) <= done))) then
					v.top = t.home
					v.bottom = t.away
					v.yours = ((t.home == you) or (t.away == you))
					if ((bi <= done) and (t.hs ~= nil)) then
						v.topScore = t.hs
						v.bottomScore = t.as
						v.winner = (M_cups.tieWinner(t) or nil)
						local n = cupNote(t)
						v.note = n.note
						if Js.T(n.pensWinner) then
							v.pensWinner = (if (n.pensWinner == "home") then "top" else "bottom")
						end
					end
				end
				do return v end
			end) end
		end)
		local champion = (if (done >= 3) then state.winner else nil)
		do return Js.O({ rounds = rounds, champion = champion, animate = (if (done >= 0) then done else nil) }, { "rounds", "champion", "animate" }) end
	end
	exports.cupBracket = cupBracket
	koNote = function(t)
		if t.pens then
			do return Js.O({ note = ("pens " .. Js.numstr(t.pens.a) .. "–" .. Js.numstr(t.pens.b)), pensA = (t.pens.a > t.pens.b) }, { "note", "pensA" }) end
		end
		if t.et then
			do return Js.O({ note = (if (Js.alen(t.legs) > 1) then "agg. aet" else "aet") }, { "note" }) end
		end
		if (Js.alen(t.legs) > 1) then
			do return Js.O({ note = "agg." }, { "note" }) end
		end
		do return Js.O({}, nil) end
	end
	euroDoneRound = function(state, you)
		local done = -1;
		(function() local _r = (function() local _v = state.bracket; if _v == nil then return nil end; _v = _v.rounds; return _v end)(); if _r == nil then return nil end; return A.forEach(_r, function(r, i)
			if A.some(r.ties, function(t)
				return (if Js.T(t.winner) then ((t.a == you) or (t.b == you)) else t.winner)
			end) then
				done = i
			end
		end) end)()
		do return done end
	end
	exports.euroDoneRound = euroDoneRound
	euroBoard = function(state, round, you, show)
		local r = (function() local _v = state.bracket; if _v == nil then return nil end; _v = _v.rounds; _v = _v[round + 1]; return _v end)()
		if (not r) then
			do return Js.alit() end
		end
		local str = Js.Map.new(A.map(state.clubs, function(c)
			return Js.alit(c.name, c.strength)
		end))
		local rows = A.map(A.filter(r.ties, function(t)
			return (if Js.T(t.a) then t.b else t.a)
		end), function(t)
			local out = Js.O({ home = t.a, away = t.b, yours = ((t.a == you) or (t.b == you)) }, { "home", "away", "yours" })
			if (show and Js.T(t.winner)) then
				local agg = M_euroBracket.koAggregate(t)
				out.hs = agg.a
				out.as = agg.b
				out.winner = t.winner
				if (Js.alen(t.legs) > 1) then
					out.legs = A.map(t.legs, function(l)
						return Js.O({ hs = l.a, as = l.b }, { "hs", "as" })
					end)
				end
				if t.pens then
					out.pens = Js.O({ hs = t.pens.a, as = t.pens.b }, { "hs", "as" })
				end
				if t.et then
					out.aet = true
				end
				local l = (if (t.winner == t.a) then t.b else t.a)
				out.upset = ((str:get(t.winner) or 75) <= ((str:get(l) or 75) - 8))
			end
			do return out end
		end)
		do return Js.aspread(A.filter(rows, function(x)
			return x.yours
		end), A.filter(rows, function(x)
			return (not x.yours)
		end)) end
	end
	exports.euroBoard = euroBoard
	euroBracketView = function(state, you, done)
		local br = state.bracket
		if (not br) then
			do return nil end
		end
		local rounds = A.map(Js.alit(1, 2, 3, 4), function(ri, bi)
			local r = br.rounds[ri + 1]
			local prev = br.rounds[ri]
			do return A.map(r.ties, function(t, j)
				local v = Js.O({ yours = false }, { "yours" })
				local top = nil
				local bottom = nil
				if (ri == 1) then
					top = br.seeds[j + 1]
					bottom = (if (done >= 0) then (function() local _v = prev.ties[j + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)() else nil)
				elseif ((ri - 1) <= done) then
					top = (function() local _v = prev.ties[(2 * j) + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)()
					bottom = (function() local _v = prev.ties[((2 * j) + 1) + 1]; if _v == nil then return nil end; _v = _v.winner; return _v end)()
				end
				v.top = top
				v.bottom = bottom
				v.yours = ((top == you) or (bottom == you))
				if ((((ri <= done) and Js.T(t.winner)) and Js.T(top)) and Js.T(bottom)) then
					local agg = M_euroBracket.koAggregate(t)
					local topIsA = (t.a == top)
					v.topScore = (if topIsA then agg.a else agg.b)
					v.bottomScore = (if topIsA then agg.b else agg.a)
					v.winner = t.winner
					local n = koNote(t)
					v.note = n.note
					if (n.pensA ~= nil) then
						v.pensWinner = (if (n.pensA == topIsA) then "top" else "bottom")
					end
				end
				do return v end
			end) end
		end)
		do return Js.O({ rounds = rounds, champion = (if (done >= 4) then br.winner else nil), animate = (if (done >= 1) then (done - 1) else (if (done == 0) then -1 else nil)) }, { "rounds", "champion", "animate" }) end
	end
	exports.euroBracketView = euroBracketView
	nextLineFor = function(next_, label)
		if (not next_) then
			do return nil end
		end
		local where = (if next_.home then "home to" else "away at")
		do return (label((if next_.round ~= nil then next_.round else "")) .. (if (next_.leg == 1) then " · 1st leg" else (if (next_.leg == 2) then " · 2nd leg" else "")) .. " · " .. where .. " " .. M_grammar.shortClub(next_.opponent)) end
	end
	knockoutRoundupFor = function(c, f)
		local you = c.player.club
		if ((f.kind == "cup") and (((f.competition == "FA Cup") or (f.competition == "League Cup")) or (f.competition == "Lower League Trophy"))) then
			if (f.leg == 1) then
				do return nil end
			end
			local st = (function() local _r = c.cupState; if _r == nil then return nil end; return A.find(_r, function(x)
				return (x.competition == f.competition)
			end) end)()
			if (not st) then
				do return nil end
			end
			local k = -1
			A.forEach(st.rounds, function(r, i)
				local t = A.find(r.ties, function(x)
					return ((x.home == you) or (x.away == you))
				end)
				if (t and (t.hs ~= nil)) then
					k = i
				end
			end)
			if (k < 0) then
				do return nil end
			end
			local stages = Js.alit(Js.O({ kind = "board", title = st.rounds[k + 1].name, ties = cupBoard(st, k, you, function(x)
				return M_cups.cupStrength(x, M_index.ratedTeams(c))
			end) }, { "kind", "title", "ties" }))
			local br = cupBracket(st, k, you)
			if br then
				A.push(stages, Js.O({ kind = "bracket", title = "Road to the Final", view = br }, { "kind", "title", "view" }))
			end
			local next_ = A.find(c.fixtures, function(x)
				return (((not x.played) and (x.kind == "cup")) and (x.competition == f.competition))
			end)
			local nextLine = (if (st.winner == you) then "Winners!" else (nextLineFor(next_, function(r)
				return r
			end) or ("Out of the " .. f.competition)))
			do return Js.O({ key = (Js.numstr(c.season) .. ":" .. f.competition .. ":" .. Js.numstr(k)), competition = f.competition, stages = stages, nextLine = nextLine }, { "key", "competition", "stages", "nextLine" }) end
		end
		local es = c.euroState
		if ((((f.kind == "europe") and es) and es.bracket) and (f.competition == es.competition)) then
			local done = euroDoneRound(es, you)
			local next_ = A.find(c.fixtures, function(x)
				return (((not x.played) and (x.kind == "europe")) and (x.competition == es.competition))
			end)
			local nextLine = (if es.won then "Winners!" else (nextLineFor(next_, function(r)
				return (if EURO_ROUND_LABEL[r] ~= nil then EURO_ROUND_LABEL[r] else r)
			end) or (if es.eliminated then ("Out of the " .. es.competition) else "")))
			if (done == -1) then
				if (not es.table) then
					do return nil end
				end
				local stages = Js.alit(Js.O({ kind = "table", title = "League phase", rows = A.map(es.table, function(r)
					return Js.O({ name = r.name, pts = r.points, gd = (r.goalsFor - r.goalsAgainst), yours = r.isYou }, { "name", "pts", "gd", "yours" })
				end) }, { "kind", "title", "rows" }))
				if ((if es.position ~= nil then es.position else 99) <= 24) then
					A.push(stages, Js.O({ kind = "board", title = "Knockout play-off", ties = euroBoard(es, 0, you, false) }, { "kind", "title", "ties" }))
					local v = euroBracketView(es, you, -1)
					if v then
						A.push(stages, Js.O({ kind = "bracket", title = "Road to the Final", view = v }, { "kind", "title", "view" }))
					end
				end
				do return Js.O({ key = (Js.numstr(c.season) .. ":" .. es.competition .. ":phase"), competition = es.competition, stages = stages, nextLine = nextLine }, { "key", "competition", "stages", "nextLine" }) end
			end
			local name = es.bracket.rounds[done + 1].name
			local stages = Js.alit(Js.O({ kind = "board", title = (if EURO_ROUND_LABEL[name] ~= nil then EURO_ROUND_LABEL[name] else name), ties = euroBoard(es, done, you, true) }, { "kind", "title", "ties" }))
			local v = euroBracketView(es, you, done)
			if v then
				A.push(stages, Js.O({ kind = "bracket", title = "Road to the Final", view = v }, { "kind", "title", "view" }))
			end
			do return Js.O({ key = (Js.numstr(c.season) .. ":" .. es.competition .. ":" .. Js.numstr(done)), competition = es.competition, stages = stages, nextLine = nextLine }, { "key", "competition", "stages", "nextLine" }) end
		end
		do return nil end
	end
	exports.knockoutRoundupFor = knockoutRoundupFor
	BRACKET_ROUNDS = Js.alit("Round of 16", "Quarter-Final", "Semi-Final", "Final")
	EURO_ROUND_LABEL = Js.O({ ["Round of 32"] = "Knockout play-off", ["Round of 16"] = "Round of 16", ["Quarter-Final"] = "Quarter-finals", ["Semi-Final"] = "Semi-finals", Final = "Final" }, { "Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final" })
	exports.EURO_ROUND_LABEL = EURO_ROUND_LABEL
end
