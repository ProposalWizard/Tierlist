--!nocheck
--!nolint
-- Generated from lib/star/world/history.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local historyRowsFromSummary, withSeasonHistory, compHistoryFor
	historyRowsFromSummary = function(s)
		local out = Js.alit()
		do
			local _arr1 = s.tables
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local t = _arr1[_i2]
				if ((not Js.T(t.division)) or (Js.alen(t.rows) < 2)) then
					do continue end
				end
				A.push(out, Js.O({ season = s.season, comp = t.name, winner = t.rows[1].name, runnerUp = t.rows[2].name }, { "season", "comp", "winner", "runnerUp" }))
			end
		end
		do
			local _arr3 = (if s.finals ~= nil then s.finals else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local f = _arr3[_i4]
				if (not Js.T(f.winner)) then
					do continue end
				end
				local winHome = (f.winner == f.home)
				local score = (if ((f.hs ~= nil) and (f.as ~= nil)) then (Js.numstr((if winHome then f.hs else f.as)) .. "-" .. Js.numstr((if winHome then f.as else f.hs)) .. (if f.pens then (" (" .. Js.numstr((if winHome then f.pens.home else f.pens.away)) .. "-" .. Js.numstr((if winHome then f.pens.away else f.pens.home)) .. " pens)") else "")) else nil)
				A.push(out, Js.ospread(Js.O({ season = s.season, comp = f.competition, winner = f.winner, runnerUp = (if winHome then f.away else f.home) }, { "season", "comp", "winner", "runnerUp" }), (if Js.T(score) then Js.O({ score = score }, { "score" }) else Js.O({}, nil))))
			end
		end
		do return out end
	end
	exports.historyRowsFromSummary = historyRowsFromSummary
	withSeasonHistory = function(rows, s)
		local have = (if rows ~= nil then rows else Js.alit())
		if (not s) then
			do return have end
		end
		local seen = Js.Set.new(A.map(have, function(r)
			return (Js.numstr(r.season) .. "|" .. r.comp)
		end))
		do return Js.aspread(have, A.filter(historyRowsFromSummary(s), function(r)
			return (not seen:has((Js.numstr(r.season) .. "|" .. r.comp)))
		end)) end
	end
	exports.withSeasonHistory = withSeasonHistory
	compHistoryFor = function(career, comp)
		local rows = A.filter(withSeasonHistory(career.compHistory, career.lastWorld), function(r)
			return (r.comp == comp)
		end)
		local have = Js.Set.new(A.map(rows, function(r)
			return r.season
		end))
		do
			local _arr5 = (if career.seasonHistory ~= nil then career.seasonHistory else Js.alit())
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local h = _arr5[_i6]
				if have:has(h.season) then
					do continue end
				end
				local w = h.winners
				local winner = (if (comp == M_calendar.leagueNameFor(h.division)) then w.league else (if (comp == "FA Cup") then w.faCup else (if (comp == "League Cup") then w.leagueCup else (if (comp == "Champions League") then w.championsLeague else (if (comp == "Europa League") then w.europaLeague else nil)))))
				if Js.T(winner) then
					A.push(rows, Js.O({ season = h.season, comp = comp, winner = winner }, { "season", "comp", "winner" }))
				end
			end
		end
		do return A.sort(rows, function(a, b)
			return (b.season - a.season)
		end) end
	end
	exports.compHistoryFor = compHistoryFor
end
