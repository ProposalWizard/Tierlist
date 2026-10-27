--!nocheck
--!nolint
-- Generated from roblox/twin/flow.twin.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_flow = import("roblox/game/flow")
	local M__out = import("roblox/twin/_out")
	local SEASONS, ONLY, DIVS0, DIVS, r2, line
	line = function(g, what)
		local c = g.career
		local me = A.find(c.league, function(t)
			return (t.name == c.player.club)
		end)
		local s = g.lastMatchStats
		Js.console.log(A.join(Js.alit(what, g.phase, ("s" .. Js.numstr(c.season) .. "w" .. Js.numstr(c.week)), c.player.club, (if me then (Js.numstr(me.played) .. "/" .. Js.numstr(me.points)) else "-"), (if s then (Js.numstr(s.homeScore) .. "-" .. Js.numstr(s.awayScore) .. " g" .. Js.numstr(s.goals) .. " a" .. Js.numstr(s.assists) .. " r" .. Js.numstr(r2(s.rating))) else ""), r2(c.money), r2(c.fame), r2(c.starRating), ("e" .. Js.numstr(r2(c.energy))), c.contract.club, c.contract.wage), " | "))
	end
	SEASONS = Js.Number((if Js.process.env.TWIN_FLOW_SEASONS ~= nil then Js.process.env.TWIN_FLOW_SEASONS else 2))
	ONLY = (function() local _r = Js.process.env.TWIN_FLOW_DIVS; if _r == nil then return nil end; return S.split(_r, ",") end)()
	DIVS0 = Js.alit(Js.alit("premier", M_clubs.PREMIER_LEAGUE_CLUBS, 3), Js.alit("championship", M_clubs.CHAMPIONSHIP_CLUBS, 7), Js.alit("league_two", M_clubs.LEAGUE_TWO_CLUBS, 2), Js.alit("national_league_north", M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS, 20))
	DIVS = (if ONLY then A.filter(DIVS0, function(_p1)
		local d = _p1[1]
		return A.includes(ONLY, d)
	end) else DIVS0)
	r2 = function(n)
		return (Math.round((n * 100)) / 100)
	end
	do
		local _arr2 = DIVS
		local _i3 = 0
		while _i3 < Js.alen(_arr2) do
			_i3 += 1
			local _e4 = _arr2[_i3]
			local div = _e4[1]
			local clubs = _e4[2]
			local pick = _e4[3]
			local club = clubs[math.fmod(pick, Js.alen(clubs)) + 1]
			local p = Js.O({ firstName = "Flow", lastName = "Robot", age = 18, skinTone = "light", club = club, clubBadge = nil, position = "ST", nationality = "England", startYear = 2027 }, { "firstName", "lastName", "age", "skinTone", "club", "clubBadge", "position", "nationality", "startYear" })
			local g = M_flow.newGame(p, Js.aspread(clubs), div)
			line(g, ("== " .. div .. " start"))
			local steps = 0
			local seasonsDone = 0
			local talked = false
			while (((function() local _o = steps; steps = _o + 1; return _o end)() < 4000) and (seasonsDone < SEASONS)) do
				local ph = g.phase
				local _sw5 = ph
				local _ci6 = (if _sw5 == "dashboard" then 1 elseif _sw5 == "youth" then 2 elseif _sw5 == "post-match" then 3 elseif _sw5 == "draw" then 4 elseif _sw5 == "knockout-roundup" then 5 elseif _sw5 == "playoff-roundup" then 6 elseif _sw5 == "deadline-day" then 7 elseif _sw5 == "intl-callup" then 8 elseif _sw5 == "intl-watched" then 9 elseif _sw5 == "intl-tournament-table" then 10 elseif _sw5 == "contract-renewal" then 11 elseif _sw5 == "ballon-dor" then 12 elseif _sw5 == "final-season" then 13 elseif _sw5 == "retirement" then 14 elseif _sw5 == "season-transfer" then 15 elseif _sw5 == "transfer-request-talk" then 16 elseif _sw5 == "transfer-signing" then 17 elseif _sw5 == "relegation-move" then 18 elseif _sw5 == "season-awards" then 19 elseif _sw5 == "ladder" then 20 elseif _sw5 == "legacy" then 21 else 0)
				local _cont7 = false
				repeat
					if _ci6 ~= 0 and _ci6 <= 1 then
						do
							local m = M_flow.matchday(g)
							if m.seasonOver then
								g = M_flow.endSeason(g)
								line(g, "end season")
								do break end
							end
							g = (if m.canPlay then M_flow.simMatch(g) else M_flow.watchFromStands(g))
							line(g, (if m.canPlay then ("sim v " .. Js.str((function() local _v = m.fixture; if _v == nil then return nil end; _v = _v.opponent; return _v end)())) else ("watch v " .. Js.str((function() local _v = m.fixture; if _v == nil then return nil end; _v = _v.opponent; return _v end)()) .. " (" .. Js.str(m.status) .. ")")))
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 2 then
						do
							local m = M_flow.matchday(g)
							if m.seasonOver then
								g = M_flow.endSeason(g)
								do break end
							end
							local before = g
							g = M_flow.youthPromotion(g)
							if (g == before) then
								g = M_flow.youthWeek(g)
							end
							line(g, "youth")
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 3 then
						g = M_flow.postMatchContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 4 then
						Js.console.log(("draw " .. Js.str((function() local _v = g.pendingDraw; if _v == nil then return nil end; _v = _v.competition; return _v end)()) .. " " .. Js.str((function() local _v = g.pendingDraw; if _v == nil then return nil end; _v = _v.round; _v = _v.name; return _v end)()) .. " " .. M__out.show((function() local _v = g.pendingDraw; if _v == nil then return nil end; _v = _v.round; _v = _v.ties; return _v end)())))
						g = M_flow.drawContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 5 then
						Js.console.log(("ko " .. Js.str((function() local _v = g.pendingKo; if _v == nil then return nil end; _v = _v.key; return _v end)())))
						g = M_flow.knockoutContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 6 then
						g = M_flow.playoffContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 7 then
						Js.console.log(("deadline " .. Js.str(g.career.lastTransferWindowKey)))
						g = M_flow.deadlineDayContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 8 then
						do
							local d = M_flow.callUp(g)
							Js.console.log(("callup " .. M__out.show((d and Js.O({ called = d.called, nation = d.nation }, { "called", "nation" })))))
							g = M_flow.callUpContinue(g)
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 10 then
						g = M_flow.backToDashboard(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 11 then
						do
							local offer = M_flow.renewalOffer(g, 1, false, 1)
							Js.console.log(("renewal " .. M__out.show(offer)))
							g = M_flow.contractComplete(g, offer)
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 12 then
						do
							local r = M_flow.ballonDor(g)
							Js.console.log(("ballon d'or rank " .. Js.numstr(r.playerRank) .. " top " .. M__out.show(A.map(A.slice(r.entries, 0, 3), function(e)
								return e.name
							end))))
							g = M_flow.ballonDorContinue(g)
							line(g, "after ballon d'or")
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 13 then
						g = M_flow.playOn(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 14 then
						g = M_flow.retireNow(g)
						seasonsDone = SEASONS
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 15 then
						do
							local interest = M_flow.transferInterest(g)
							local offers = A.flatMap(interest.leagues, function(l)
								return A.map(l.clubs, function(c)
									return c.offer
								end)
							end)
							Js.console.log(("window " .. Js.numstr(Js.alen(offers)) .. " clubs: " .. A.join(A.map(A.slice(offers, 0, 5), function(o)
								return (o.club .. "@" .. Js.numstr(o.wage))
							end), ", ")))
							if ((not talked) and Js.T(Js.alen(offers))) then
								talked = true
								g = M_flow.transferNegotiate(g, offers[1])
								g = M_flow.transferTalkDone(g, offers[1].wage)
							else
								g = M_flow.stayPut(g)
							end
							do break end
						end
					end
					if _ci6 ~= 0 and _ci6 <= 16 then
						g = M_flow.transferTalkDone(g, nil)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 17 then
						g = M_flow.signingDone(g)
						line(g, "signed")
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 18 then
						g = M_flow.chooseTransfer(g, g.transferOffers[1])
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 19 then
						g = M_flow.seasonAwardsContinue(g)
						seasonsDone += 1
						line(g, "== new season")
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 20 then
						g = M_flow.ladderContinue(g)
						do break end
					end
					if _ci6 ~= 0 and _ci6 <= 21 then
						seasonsDone = SEASONS
						do break end
					end
				until true
			end
			line(g, ("== " .. div .. " end"))
		end
	end
end
