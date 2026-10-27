--!nocheck
--!nolint
-- Generated from roblox/game/screens.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_calendar = import("lib/star/calendar")
	local M_starPoints = import("lib/star/starPoints")
	local M_competitions = import("lib/star/competitions")
	local M_nationalities = import("lib/nationalities")
	local M_scoutOffers = import("lib/star/scoutOffers")
	local M_edition = import("lib/star/edition")
	local M_flow = import("roblox/game/flow")
	local M_grammar = import("lib/star/media/grammar")
	local M_season = import("lib/star/season")
	local M_careerFlow = import("lib/star/careerFlow")
	local M_negotiation = import("lib/star/negotiation")
	local money, hud, fixtureLine, dateOf, score, ordinal, TABS, DIVISIONS, setupScreen, divisionByName, clubScreen, startGame, screen, dashboard, youthScreen, postMatch, renewalScreen, windowScreen, talkScreen, niceStep, act
	money = function(n)
		local sign = (if (n < 0) then "-" else "")
		local a = math.abs(Math.round(n))
		if (a >= 1000000) then
			do return (sign .. "£" .. N.toFixed((a / 1000000), (if (a >= 10000000) then 0 else 1)) .. "m") end
		end
		if (a >= 10000) then
			do return (sign .. "£" .. Js.numstr(Math.round((a / 1000))) .. "k") end
		end
		do return (sign .. "£" .. N.toLocaleString(a, "en-GB")) end
	end
	exports.money = money
	hud = function(c)
		local start = M_calendar.seasonStartYear(c.player.startYear, c.season)
		do return Js.O({ name = (c.player.firstName .. " " .. c.player.lastName), club = c.player.club, league = (if Js.T(c.player.club) then M_calendar.leagueNameFor(M_calendar.divisionOf(c)) else ""), season = (Js.numstr(start) .. "/" .. S.padStart(Js.numstr(math.fmod((start + 1), 100)), 2, "0") .. " · age " .. Js.numstr(c.player.age)), money = money(c.money), stars = M_starPoints.starStatus(c).stars, energy = Math.round(c.energy) }, { "name", "club", "league", "season", "money", "stars", "energy" }) end
	end
	fixtureLine = function(c, f)
		local where = (if f.home then "v" else "at")
		local comp = (if (Js.T(f.kind) and (f.kind ~= "league")) then M_competitions.fixtureLabel(f) else M_calendar.leagueNameFor(M_calendar.divisionOf(c)))
		do return (comp .. ": " .. where .. " " .. f.opponent) end
	end
	dateOf = function(c, f)
		local _ok1, _err2, _rv3 = pcall(function()
			do return Js.RET, M_calendar.fixtureDateLabel(c.player.startYear, c.season, f.week, f.kind, M_calendar.divisionOf(c)) end
		end)
		if not _ok1 then
			do return ("Week " .. Js.numstr(f.week)) end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	score = function(f)
		if (((not f.played) or (f.homeScore == nil)) or (f.awayScore == nil)) then
			do return nil end
		end
		do return (if f.home then Js.O({ us = f.homeScore, them = f.awayScore }, { "us", "them" }) else Js.O({ us = f.awayScore, them = f.homeScore }, { "us", "them" })) end
	end
	ordinal = function(n)
		local s = Js.alit("th", "st", "nd", "rd")
		local v = math.fmod(n, 100)
		do return (Js.numstr(n) .. ((s[math.fmod((v - 20), 10) + 1] or s[v + 1]) or s[1])) end
	end
	setupScreen = function()
		do return Js.O({ id = "setup", hud = nil, title = "Road to Ballon d'Or", blocks = Js.alit(Js.O({ kind = "text", text = "A new career. You are a striker, 17, at the start of the season." }, { "kind", "text" }), Js.O({ kind = "input", id = "firstName", label = "First name", value = "" }, { "kind", "id", "label", "value" }), Js.O({ kind = "input", id = "lastName", label = "Last name", value = "" }, { "kind", "id", "label", "value" }), Js.O({ kind = "choice", id = "nationality", label = "Nationality", options = M_nationalities.ALL_NATIONALITIES, value = "England" }, { "kind", "id", "label", "options", "value" }), Js.O({ kind = "choice", id = "division", label = "League", options = A.map(DIVISIONS, M_calendar.leagueNameFor), value = M_calendar.leagueNameFor("league_two") }, { "kind", "id", "label", "options", "value" }), Js.O({ kind = "text", text = "Next, pick your club in that league.", tone = "dim" }, { "kind", "text", "tone" })), buttons = Js.alit(Js.O({ label = "Choose a club", action = "setup-clubs", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	exports.setupScreen = setupScreen
	divisionByName = function(name)
		do return (A.find(DIVISIONS, function(d)
			return (M_calendar.leagueNameFor(d) == name)
		end) or "league_two") end
	end
	exports.divisionByName = divisionByName
	clubScreen = function(divisionName)
		local div = divisionByName(divisionName)
		do return Js.O({ id = "setup-clubs", hud = nil, title = M_calendar.leagueNameFor(div), blocks = Js.alit(Js.O({ kind = "list", items = A.map(A.sort(A.slice(M_scoutOffers.clubsForDivision(div)), function(a, b)
			return S.localeCompare(a, b)
		end), function(c)
			return Js.O({ text = c, action = "start", arg = c }, { "text", "action", "arg" })
		end) }, { "kind", "items" })), buttons = Js.alit(Js.O({ label = "Back", action = "setup", style = "secondary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	exports.clubScreen = clubScreen
	startGame = function(choice)
		local div = divisionByName(choice.division)
		local clubs = M_scoutOffers.clubsForDivision(div)
		if (not A.includes(clubs, choice.club)) then
			error(Js.Error((choice.club .. " is not in " .. M_calendar.leagueNameFor(div))), 0)
		end
		local player = Js.O({ firstName = S.trim((if Js.T(choice.firstName) then choice.firstName else "Kai")), lastName = S.trim((if Js.T(choice.lastName) then choice.lastName else "Ball")), age = 17, skinTone = "tan", club = choice.club, clubBadge = nil, position = "ST", nationality = (if Js.T(choice.nationality) then choice.nationality else "England"), startYear = M_edition.STAR_FIFA_YEAR }, { "firstName", "lastName", "age", "skinTone", "club", "clubBadge", "position", "nationality", "startYear" })
		do return Js.ospread(M_flow.newGame(player, Js.aspread(clubs), div), Js.O({ ui = Js.O({ tab = "home" }, { "tab" }) }, { "ui" })) end
	end
	exports.startGame = startGame
	screen = function(g)
		local c = g.career
		local base = Js.O({ hud = hud(c), tabs = nil }, { "hud", "tabs" })
		local _sw4 = g.phase
		local _ci5 = (if _sw4 == "dashboard" then 1 elseif _sw4 == "youth" then 2 elseif _sw4 == "post-match" then 3 elseif _sw4 == "draw" then 4 elseif _sw4 == "knockout-roundup" then 5 elseif _sw4 == "playoff-roundup" then 6 elseif _sw4 == "deadline-day" then 7 elseif _sw4 == "intl-callup" then 8 elseif _sw4 == "intl-watched" then 9 elseif _sw4 == "intl-tournament-table" then 10 elseif _sw4 == "contract-renewal" then 11 elseif _sw4 == "ballon-dor" then 12 elseif _sw4 == "final-season" then 13 elseif _sw4 == "retirement" then 14 elseif _sw4 == "season-transfer" then 15 elseif _sw4 == "transfer-request-talk" then 16 elseif _sw4 == "transfer-signing" then 17 elseif _sw4 == "relegation-move" then 18 elseif _sw4 == "season-awards" then 19 elseif _sw4 == "ladder" then 20 elseif _sw4 == "legacy" then 21 else 0)
		local _cont6 = false
		repeat
			if _ci5 ~= 0 and _ci5 <= 1 then
				do return dashboard(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 2 then
				do return youthScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 3 then
				do return postMatch(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 4 then
				do
					local d = g.pendingDraw
					do return Js.ospread(base, Js.O({ id = "draw", title = (d.competition .. ": " .. d.round.name), blocks = Js.alit(Js.O({ kind = "heading", text = "The draw" }, { "kind", "text" }), Js.O({ kind = "list", items = A.map(d.round.ties, function(t)
						return Js.O({ text = (t.home .. " v " .. t.away), tone = (if ((t.home == c.player.club) or (t.away == c.player.club)) then "gold" else "normal") }, { "text", "tone" })
					end) }, { "kind", "items" })), buttons = Js.alit(Js.O({ label = "Continue", action = "draw-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 5 then
				do
					local k = g.pendingKo
					local items = Js.alit()
					do
						local _arr7 = (if k.stages ~= nil then k.stages else Js.alit())
						local _i8 = 0
						while _i8 < Js.alen(_arr7) do
							_i8 += 1
							local st = _arr7[_i8]
							if (Js.T(st.title) or Js.T(st.label)) then
								A.push(items, Js.O({ text = Js.str((if st.title ~= nil then st.title else st.label)), tone = "gold" }, { "text", "tone" }))
							end
							do
								local _arr9 = (if st.ties ~= nil then st.ties else Js.alit())
								local _i10 = 0
								while _i10 < Js.alen(_arr9) do
									_i10 += 1
									local t = _arr9[_i10]
									A.push(items, Js.O({ text = (t.home .. " " .. (if t.score ~= nil then t.score else "v") .. " " .. t.away) }, { "text" }))
								end
							end
						end
					end
					do return Js.ospread(base, Js.O({ id = "knockout-roundup", title = k.competition, blocks = Js.aspread((if Js.T(Js.alen(items)) then Js.alit(Js.O({ kind = "list", items = items }, { "kind", "items" })) else Js.alit()), (if Js.T(k.nextLine) then Js.alit(Js.O({ kind = "text", text = k.nextLine, tone = "gold" }, { "kind", "text", "tone" })) else Js.alit())), buttons = Js.alit(Js.O({ label = "Continue", action = "ko-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 6 then
				do
					local up = M_competitions.nextFixtureFor(c)
					local po = c.playOffState
					local line = (if ((function() local _v = up; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "playoff") then (Js.str(up.round) .. ": " .. (if up.home then "home to" else "away at") .. " " .. M_grammar.shortClub(up.opponent)) else (if (po.promoted == c.player.club) then "Promoted!" else (if Js.T(po.promoted) then (M_grammar.shortClub(po.promoted) .. " go up") else "Out of the play-offs")))
					do return Js.ospread(base, Js.O({ id = "playoff-roundup", title = (M_calendar.leagueNameFor(M_calendar.divisionOf(c)) .. " play-offs"), blocks = Js.alit(Js.O({ kind = "text", text = line, tone = "gold" }, { "kind", "text", "tone" })), buttons = Js.alit(Js.O({ label = "Continue", action = "playoff-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 7 then
				do return Js.ospread(base, Js.O({ id = "deadline-day", title = "Deadline day", blocks = Js.alit(Js.O({ kind = "text", text = "The transfer window has shut. Every club's business is done." }, { "kind", "text" })), buttons = Js.alit(Js.O({ label = "Continue", action = "deadline-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
			end
			if _ci5 ~= 0 and _ci5 <= 8 then
				do
					local d = M_flow.callUp(g)
					do return Js.ospread(base, Js.O({ id = "intl-callup", title = (if d then (d.nation .. ": " .. d.period.label) else "International break"), blocks = (if d then Js.aspread(Js.alit(Js.O({ kind = "text", text = (if d.called then "You're in the squad!" else "Not this time. The manager has left you out."), tone = (if d.called then "good" else "dim") }, { "kind", "text", "tone" })), (if Js.T(d.reason) then Js.alit(Js.O({ kind = "text", text = Js.str(d.reason), tone = "dim" }, { "kind", "text", "tone" })) else Js.alit())) else Js.alit()), buttons = Js.alit(Js.O({ label = "Continue", action = "callup-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 9 then
				do
					local f = g.watchedFixture
					do return Js.ospread(base, Js.O({ id = "intl-watched", title = "On the TV", blocks = (if f then Js.alit(Js.O({ kind = "text", text = ((if f.competition ~= nil then f.competition else "International") .. ": " .. (if f.home then "v" else "at") .. " " .. f.opponent) }, { "kind", "text" }), Js.O({ kind = "text", text = (if score(f) then (Js.numstr(score(f).us) .. "-" .. Js.numstr(score(f).them)) else "Played"), tone = "gold" }, { "kind", "text", "tone" })) else Js.alit()), buttons = Js.alit(Js.O({ label = "Continue", action = "home", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 10 then
				do return Js.ospread(base, Js.O({ id = "intl-tournament-table", title = ((function() local _v = c.tournament; if _v == nil then return nil end; _v = _v.competition; return _v end)() or "The tournament"), blocks = (if Js.T(c.knockoutMessage) then Js.alit(Js.O({ kind = "text", text = c.knockoutMessage }, { "kind", "text" })) else Js.alit()), buttons = Js.alit(Js.O({ label = "Continue", action = "home", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
			end
			if _ci5 ~= 0 and _ci5 <= 11 then
				do return renewalScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 12 then
				do
					local r = M_flow.ballonDor(g)
					local rows = A.map(A.slice(r.entries, 0, 10), function(e, i)
						return Js.alit(Js.numstr((i + 1)), e.name, M_grammar.shortClub((if e.club ~= nil then e.club else "")), Js.numstr(e.goals), Js.numstr(e.assists))
					end)
					local youAt = A.findIndex(r.entries, function(e)
						return e.isPlayer
					end)
					do return Js.ospread(base, Js.O({ id = "ballon-dor", title = "The Ballon d'Or", blocks = Js.alit(Js.O({ kind = "text", text = (if (r.playerRank == 1) then "You have won the Ballon d'Or!" else (if r.playerNominated then ("You finished " .. ordinal(r.playerRank) .. ".") else "You were not on the shortlist this year.")), tone = (if (r.playerRank == 1) then "gold" else "normal") }, { "kind", "text", "tone" }), Js.O({ kind = "table", columns = Js.alit("", "Player", "Club", "G", "A"), rows = rows, highlight = (if ((youAt >= 0) and (youAt < 10)) then youAt else nil) }, { "kind", "columns", "rows", "highlight" })), buttons = Js.alit(Js.O({ label = "Continue", action = "ballon-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 13 then
				do return Js.ospread(base, Js.O({ id = "final-season", title = "Your final season", blocks = Js.alit(Js.O({ kind = "text", text = "This is your final season before retirement. End your career in the right way." }, { "kind", "text" })), buttons = Js.alit(Js.O({ label = "Play on", action = "play-on", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
			end
			if _ci5 ~= 0 and _ci5 <= 14 then
				do return Js.ospread(base, Js.O({ id = "retirement", title = "The final whistle", blocks = Js.alit(Js.O({ kind = "text", text = "Your body has had enough. It's time to hang up the boots." }, { "kind", "text" })), buttons = Js.alit(Js.O({ label = "Hang them up", action = "retire", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
			end
			if _ci5 ~= 0 and _ci5 <= 15 then
				do return windowScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 16 then
				do return talkScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 17 then
				do
					local o = g.pendingSignOffer.offer
					do return Js.ospread(base, Js.O({ id = "transfer-signing", title = ("Sign for " .. o.club), blocks = Js.alit(Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Weekly wage", value = money(o.wage) }, { "label", "value" }), Js.O({ label = "Seasons", value = Js.numstr(o.seasons) }, { "label", "value" }), Js.O({ label = "Goal bonus", value = money(o.goalBonus) }, { "label", "value" }), Js.O({ label = "Assist bonus", value = money(o.assistBonus) }, { "label", "value" }), Js.O({ label = "Signing fee", value = money(o.signingFee) }, { "label", "value" })) }, { "kind", "items" })), buttons = Js.alit(Js.O({ label = "Sign it", action = "sign", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 18 then
				do return Js.ospread(base, Js.O({ id = "relegation-move", title = "Your club is going down", blocks = Js.alit(Js.O({ kind = "text", text = "Step 3 has no fixtures for you. Choose your next club." }, { "kind", "text" }), Js.O({ kind = "list", items = A.map((if g.transferOffers ~= nil then g.transferOffers else Js.alit()), function(o, i)
					return Js.O({ text = o.club, sub = (money(o.wage) .. " a week · " .. Js.numstr(o.seasons) .. " seasons"), action = "relegation-pick", arg = Js.numstr(i) }, { "text", "sub", "action", "arg" })
				end) }, { "kind", "items" })), buttons = Js.alit() }, { "id", "title", "blocks", "buttons" })) end
			end
			if _ci5 ~= 0 and _ci5 <= 19 then
				do
					local a = c.lastSeasonAwardStats
					local items = Js.alit()
					if a then
						do
							local _arr11 = Js.Object.entries(a)
							local _i12 = 0
							while _i12 < Js.alen(_arr11) do
								_i12 += 1
								local _e13 = _arr11[_i12]
								local k = _e13[1]
								local v = _e13[2]
								if ((type(v) == "number") or (type(v) == "string")) then
									A.push(items, Js.O({ label = k, value = Js.str(v) }, { "label", "value" }))
								end
							end
						end
					end
					local won = A.filter((if c.trophies ~= nil then c.trophies else Js.alit()), function(t)
						return (t.season == (c.season - 1))
					end)
					do return Js.ospread(base, Js.O({ id = "season-awards", title = "End of season awards", blocks = Js.aspread((if Js.T(Js.alen(won)) then Js.alit(Js.O({ kind = "list", items = A.map(won, function(t)
						return Js.O({ text = ("🏆 " .. t.competition), tone = "gold" }, { "text", "tone" })
					end) }, { "kind", "items" })) else Js.alit()), A.map(A.filter((if c.awards ~= nil then c.awards else Js.alit()), function(x)
						return (x.season == (c.season - 1))
					end), function(x)
						return Js.O({ kind = "text", text = ("🏅 " .. x.kind .. ": " .. x.detail), tone = "gold" }, { "kind", "text", "tone" })
					end), Js.alit(Js.O({ kind = "stats", items = A.slice(items, 0, 12) }, { "kind", "items" }))), buttons = Js.alit(Js.O({ label = "Continue", action = "awards-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 20 then
				do
					local n = c.ladderNews
					do return Js.ospread(base, Js.O({ id = "ladder", title = "Promotion and relegation", blocks = Js.aspread((if Js.T((function() local _v = n; if _v == nil then return nil end; _v = _v.yourMove; return _v end)()) then Js.alit(Js.O({ kind = "text", text = n.yourMove, tone = "gold" }, { "kind", "text", "tone" })) else Js.alit()), A.map(((function() local _v = n; if _v == nil then return nil end; _v = _v.lines; return _v end)() or Js.alit()), function(l)
						return Js.O({ kind = "text", text = l }, { "kind", "text" })
					end)), buttons = Js.alit(Js.O({ label = "Continue", action = "ladder-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
			if _ci5 ~= 0 and _ci5 <= 21 then
				do
					local s = c.careerStats
					do return Js.ospread(base, Js.O({ id = "legacy", title = "Career over", blocks = Js.alit(Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Appearances", value = Js.numstr(s.appearances) }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(s.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(s.assists) }, { "label", "value" }), Js.O({ label = "Trophies", value = Js.numstr(Js.alen(c.trophies)) }, { "label", "value" }), Js.O({ label = "Ballon d'Ors", value = Js.numstr((if c.ballonDorWins ~= nil then c.ballonDorWins else 0)), tone = "gold" }, { "label", "value", "tone" })) }, { "kind", "items" }), Js.O({ kind = "list", items = A.map(c.trophies, function(t)
						return Js.O({ text = ("🏆 " .. t.competition), sub = (t.club .. ", season " .. Js.numstr(t.season)) }, { "text", "sub" })
					end) }, { "kind", "items" })), buttons = Js.alit(Js.O({ label = "New career", action = "new-career", style = "primary" }, { "label", "action", "style" })) }, { "id", "title", "blocks", "buttons" })) end
				end
			end
		until true
		do return dashboard(g) end
	end
	exports.screen = screen
	dashboard = function(g)
		local c = g.career
		local tab = ((function() local _v = g.ui; if _v == nil then return nil end; _v = _v.tab; return _v end)() or "home")
		local tabs = A.map(TABS, function(_p14)
			local id = _p14[1]
			local label = _p14[2]
			return Js.O({ id = id, label = label, active = (id == tab) }, { "id", "label", "active" })
		end)
		local s = Js.O({ id = "dashboard", hud = hud(c), title = c.player.club, tabs = tabs, blocks = Js.alit(), buttons = Js.alit() }, { "id", "hud", "title", "tabs", "blocks", "buttons" })
		if (tab == "league") then
			local table_ = M_season.sortLeague(c.league)
			s.title = M_calendar.leagueNameFor(M_calendar.divisionOf(c))
			A.push(s.blocks, Js.O({ kind = "table", columns = Js.alit("", "Club", "P", "W", "D", "L", "GD", "Pts"), rows = A.map(table_, function(t, i)
				return Js.alit(Js.numstr((i + 1)), M_grammar.shortClub(t.name), Js.numstr(t.played), Js.numstr(t.won), Js.numstr(t.drawn), Js.numstr(t.lost), Js.numstr((t.goalsFor - t.goalsAgainst)), Js.numstr(t.points))
			end), highlight = A.findIndex(table_, function(t)
				return (t.name == c.player.club)
			end) }, { "kind", "columns", "rows", "highlight" }))
			do return s end
		end
		if (tab == "fixtures") then
			s.title = "Fixtures and results"
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(c.fixtures, function(f)
				local sc = score(f)
				local g = (if f.userGoals ~= nil then f.userGoals else 0)
				do return Js.O({ text = fixtureLine(c, f), sub = (if sc then (Js.numstr(sc.us) .. "-" .. Js.numstr(sc.them) .. (if Js.T(g) then (" · you scored " .. Js.numstr(g)) else "")) else (if f.played then "Played" else dateOf(c, f))), tone = (if sc then (if (sc.us > sc.them) then "good" else (if (sc.us < sc.them) then "bad" else "normal")) else "dim") }, { "text", "sub", "tone" }) end
			end) }, { "kind", "items" }))
			do return s end
		end
		if (tab == "stats") then
			local ss = c.seasonStats
			local cs = c.careerStats
			s.title = "Your numbers"
			A.push(s.blocks, Js.O({ kind = "heading", text = "This season" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Apps", value = Js.numstr(ss.appearances) }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(ss.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(ss.assists) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Career" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Apps", value = Js.numstr(cs.appearances) }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(cs.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(cs.assists) }, { "label", "value" }), Js.O({ label = "Trophies", value = Js.numstr(Js.alen(c.trophies)) }, { "label", "value" }), Js.O({ label = "Ballon d'Ors", value = Js.numstr((if c.ballonDorWins ~= nil then c.ballonDorWins else 0)) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Skills" }, { "kind", "text" }), Js.O({ kind = "stats", items = A.map(Js.Object.entries(c.skills), function(_p15)
				local k = _p15[1]
				local v = _p15[2]
				return Js.O({ label = (S.toUpperCase(S.idx(k, 0)) .. S.slice(k, 1)), value = Js.numstr(Math.round(v)) }, { "label", "value" })
			end) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Contract" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Wage a week", value = money(c.contract.wage) }, { "label", "value" }), Js.O({ label = "Seasons left", value = Js.numstr(c.contract.seasonsRemaining) }, { "label", "value" }), Js.O({ label = "Goal bonus", value = money(c.contract.goalBonus) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Relationships" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Manager", value = Js.numstr(Math.round(c.relationships.boss)) }, { "label", "value" }), Js.O({ label = "Team-mates", value = Js.numstr(Math.round(c.relationships.team)) }, { "label", "value" }), Js.O({ label = "Fans", value = Js.numstr(Math.round(c.relationships.fans)) }, { "label", "value" })) }, { "kind", "items" }))
			A.push(s.buttons, Js.O({ label = "Ask for a new contract", action = "ask-contract", style = "secondary" }, { "label", "action", "style" }))
			do return s end
		end
		local m = M_flow.matchday(g)
		local pos = (if Js.T(Js.alen(c.league)) then M_competitions.leaguePosition(c) else 0)
		A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "League", value = (if Js.T(pos) then (ordinal(pos) .. " of " .. Js.numstr(Js.alen(c.league))) else "-") }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(c.seasonStats.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(c.seasonStats.assists) }, { "label", "value" }), Js.O({ label = "Energy", value = (Js.numstr(Math.round(c.energy)) .. "%"), tone = (if (c.energy < 40) then "bad" else "normal") }, { "label", "value", "tone" })) }, { "kind", "items" }))
		if Js.T(c.managerNews) then
			A.push(s.blocks, Js.O({ kind = "text", text = c.managerNews, tone = "gold" }, { "kind", "text", "tone" }))
		end
		if m.seasonOver then
			A.push(s.blocks, Js.O({ kind = "heading", text = "The season is over" }, { "kind", "text" }), Js.O({ kind = "text", text = "Every match is played. Time for the awards." }, { "kind", "text" }))
			A.push(s.buttons, Js.O({ label = "End of season 🏆", action = "end-season", style = "primary" }, { "label", "action", "style" }))
			do return s end
		end
		if m.fixture then
			A.push(s.blocks, Js.O({ kind = "heading", text = "Next match" }, { "kind", "text" }), Js.O({ kind = "text", text = fixtureLine(c, m.fixture) }, { "kind", "text" }), Js.O({ kind = "text", text = dateOf(c, m.fixture), tone = "dim" }, { "kind", "text", "tone" }))
			if m.canPlay then
				A.push(s.buttons, Js.O({ label = "Play match ⚽", action = "play-match", style = "primary" }, { "label", "action", "style" }))
				A.push(s.buttons, Js.O({ label = "Sim it", action = "sim" }, { "label", "action" }))
			else
				local why = (if (m.status == "Injured") then "You're injured." else (if m.fixture.watch then "Your country plays. Watch it on TV." else (if m.reason ~= nil then m.reason else "You're not in the squad this week.")))
				A.push(s.blocks, Js.O({ kind = "text", text = why, tone = "bad" }, { "kind", "text", "tone" }))
				A.push(s.buttons, Js.O({ label = "🏟️ Watch from the stands", action = "watch", style = "primary" }, { "label", "action", "style" }))
			end
		end
		do return s end
	end
	youthScreen = function(g)
		local c = g.career
		local m = M_flow.matchday(g)
		local buttons = Js.alit()
		if m.seasonOver then
			A.push(buttons, Js.O({ label = "End of season 🏆", action = "end-season", style = "primary" }, { "label", "action", "style" }))
		else
			A.push(buttons, Js.O({ label = "Play the youth week", action = "youth-week", style = "primary" }, { "label", "action", "style" }))
		end
		A.push(buttons, Js.O({ label = "Ask for promotion", action = "youth-promote", style = "secondary" }, { "label", "action", "style" }))
		do return Js.O({ id = "youth", hud = hud(c), title = (c.player.club .. " youth team"), blocks = Js.alit(Js.O({ kind = "text", text = "Your form dropped you to the youth team. Play well and the first team will call." }, { "kind", "text" })), buttons = buttons }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	postMatch = function(g)
		local c = g.career
		local st = g.lastMatchStats
		local f = g.playedFixture
		local home = (f.home ~= false)
		local me = c.player.club
		do return Js.O({ id = "post-match", hud = hud(c), title = "Full time", blocks = Js.aspread(Js.alit(Js.O({ kind = "heading", text = ((if home then me else f.opponent) .. " " .. Js.numstr(st.homeScore) .. " - " .. Js.numstr(st.awayScore) .. " " .. (if home then f.opponent else me)) }, { "kind", "text" })), (if (Js.T(f.kind) and (f.kind ~= "league")) then Js.alit(Js.O({ kind = "text", text = M_competitions.fixtureLabel(f), tone = "dim" }, { "kind", "text", "tone" })) else Js.alit()), Js.alit(Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Goals", value = Js.numstr(st.goals), tone = (if Js.T(st.goals) then "good" else "normal") }, { "label", "value", "tone" }), Js.O({ label = "Assists", value = Js.numstr(st.assists) }, { "label", "value" }), Js.O({ label = "Rating", value = N.toFixed(st.rating, 1), tone = (if (st.rating >= 7.5) then "good" else (if (st.rating < 6) then "bad" else "normal")) }, { "label", "value", "tone" }), Js.O({ label = "Earned", value = money((if st.totalCash ~= nil then st.totalCash else 0)) }, { "label", "value" })) }, { "kind", "items" })), (if Js.T(c.knockoutMessage) then Js.alit(Js.O({ kind = "text", text = c.knockoutMessage, tone = "gold" }, { "kind", "text", "tone" })) else Js.alit())), buttons = Js.alit(Js.O({ label = "Continue", action = "post-continue", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	renewalScreen = function(g)
		local c = g.career
		local r = (function() local _v = g.ui; if _v == nil then return nil end; _v = _v.renewal; return _v end)()
		local willing = ((not (not Js.T(g.contractOfferReason))) or M_careerFlow.willingToRenegotiate(c))
		local base = Js.O({ id = "contract-renewal", hud = hud(c), title = ("Contract talks: " .. c.contract.club) }, { "id", "hud", "title" })
		if (not willing) then
			do return Js.ospread(base, Js.O({ blocks = Js.alit(Js.O({ kind = "text", text = "Not interested in renegotiating right now." }, { "kind", "text" }), Js.O({ kind = "text", text = "You haven't done enough lately to earn a better deal. A hot streak of form, or a real jump in your game, and they'll talk.", tone = "dim" }, { "kind", "text", "tone" })), buttons = Js.alit(Js.O({ label = "Back", action = "renewal-cancel", style = "primary" }, { "label", "action", "style" })) }, { "blocks", "buttons" })) end
		end
		local offer = M_flow.renewalOffer(g, ((function() local _v = r; if _v == nil then return nil end; _v = _v.wins; return _v end)() or 0), (function() local _l = (function() local _v = r; if _v == nil then return nil end; _v = _v.locked; return _v end)(); if _l ~= nil then return _l end; return false end)(), ((function() local _v = r; if _v == nil then return nil end; _v = _v.rounds; return _v end)() or 0))
		local blocks = Js.alit()
		if (g.contractOfferReason == "form") then
			A.push(blocks, Js.O({ kind = "text", text = ("Outstanding form! " .. c.contract.club .. " want to lock you in early."), tone = "good" }, { "kind", "text", "tone" }))
		end
		if (g.contractOfferReason == "star") then
			A.push(blocks, Js.O({ kind = "text", text = ("Your rise has been noticed. " .. c.contract.club .. " want to reward it."), tone = "good" }, { "kind", "text", "tone" }))
		end
		A.push(blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Now", value = (money(c.contract.wage) .. " a week") }, { "label", "value" }), Js.O({ label = "Their offer", value = (money(offer.wage) .. " a week"), tone = "gold" }, { "label", "value", "tone" }), Js.O({ label = "Seasons", value = Js.numstr(offer.seasonsRemaining) }, { "label", "value" })) }, { "kind", "items" }))
		if (not (function() local _v = r; if _v == nil then return nil end; _v = _v.started; return _v end)()) then
			A.push(blocks, Js.O({ kind = "text", text = "Higher or lower: each right guess raises the offer by 8%. One wrong guess and talks sour: the offer drops 15% and that's final." }, { "kind", "text" }))
			do return Js.ospread(base, Js.O({ blocks = blocks, buttons = Js.alit(Js.O({ label = "Play higher or lower", action = "renewal-start", style = "primary" }, { "label", "action", "style" }), Js.O({ label = "Sign now", action = "renewal-sign", style = "secondary" }, { "label", "action", "style" })) }, { "blocks", "buttons" })) end
		end
		A.push(blocks, Js.O({ kind = "heading", text = ("Card: " .. Js.numstr(r.current)) }, { "kind", "text" }))
		if Js.T(r.message) then
			A.push(blocks, Js.O({ kind = "text", text = r.message, tone = (if r.locked then "bad" else "good") }, { "kind", "text", "tone" }))
		end
		local buttons = (if r.locked then Js.alit() else Js.alit(Js.O({ label = "Higher ⬆", action = "renewal-guess", arg = "higher", style = "primary" }, { "label", "action", "arg", "style" }), Js.O({ label = "Lower ⬇", action = "renewal-guess", arg = "lower", style = "primary" }, { "label", "action", "arg", "style" })))
		A.push(buttons, Js.O({ label = "Sign it", action = "renewal-sign", style = "secondary" }, { "label", "action", "style" }))
		do return Js.ospread(base, Js.O({ blocks = blocks, buttons = buttons }, { "blocks", "buttons" })) end
	end
	windowScreen = function(g)
		local c = g.career
		local interest = M_flow.transferInterest(g)
		local blocks = Js.alit(Js.O({ kind = "text", text = ("Your season: " .. Js.numstr(interest.report.apps) .. " apps, " .. Js.numstr(interest.report.goals) .. " goals, " .. Js.numstr(interest.report.assists) .. " assists.") }, { "kind", "text" }))
		A.forEach(interest.leagues, function(l, li)
			A.push(blocks, Js.O({ kind = "heading", text = M_calendar.leagueNameFor(l.division) }, { "kind", "text" }))
			A.push(blocks, Js.O({ kind = "list", items = A.map(A.sort(A.slice(l.clubs), function(a, b)
				return S.localeCompare(a.club, b.club)
			end), function(k)
				return Js.O({ text = k.club, sub = (k.interest .. " · finished " .. ordinal(k.position) .. " · " .. k.why), action = "window-talk", arg = (Js.numstr(li) .. ":" .. Js.numstr(A.indexOf(l.clubs, k))) }, { "text", "sub", "action", "arg" })
			end) }, { "kind", "items" }))
		end)
		do return Js.O({ id = "season-transfer", hud = hud(c), title = "The summer window", blocks = blocks, buttons = Js.alit(Js.O({ label = ("Stay at " .. M_grammar.shortClub(c.player.club)), action = "stay", style = "secondary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	talkScreen = function(g)
		local c = g.career
		local o = g.talkOffer
		local t = (function() local _v = g.ui; if _v == nil then return nil end; _v = _v.talk; return _v end)()
		local blocks = Js.alit(Js.O({ kind = "text", text = ("Contract talks with " .. o.club .. ". Every number is a weekly wage.") }, { "kind", "text" }))
		if t then
			A.push(blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Their offer", value = money(t.theirPosition), tone = "gold" }, { "label", "value", "tone" }), Js.O({ label = "You're asking", value = money(((function() local _v = g.ui; if _v == nil then return nil end; _v = _v.ask; return _v end)() or t.yourPosition)) }, { "label", "value" }), Js.O({ label = "Mood", value = (Js.numstr(Math.round(t.moodScore)) .. "/100"), tone = (if (t.moodScore < 35) then "bad" else "normal") }, { "label", "value", "tone" })) }, { "kind", "items" }))
			do
				local _arr16 = A.slice(t.log, -4)
				local _i17 = 0
				while _i17 < Js.alen(_arr16) do
					_i17 += 1
					local line = _arr16[_i17]
					A.push(blocks, Js.O({ kind = "text", text = line, tone = "dim" }, { "kind", "text", "tone" }))
				end
			end
		end
		local buttons = Js.alit()
		if (t and (t.status == "negotiating")) then
			A.push(buttons, Js.O({ label = "Ask less", action = "talk-nudge", arg = "-1", style = "secondary" }, { "label", "action", "arg", "style" }), Js.O({ label = "Ask more", action = "talk-nudge", arg = "1", style = "secondary" }, { "label", "action", "arg", "style" }), Js.O({ label = "Make the offer", action = "talk-offer", style = "primary" }, { "label", "action", "style" }), Js.O({ label = "Walk away", action = "talk-walk", style = "danger" }, { "label", "action", "style" }))
		elseif (t and (t.status == "accepted")) then
			A.push(blocks, Js.O({ kind = "text", text = ("Agreed at " .. money((if t.finalPrice ~= nil then t.finalPrice else t.theirPosition)) .. " a week."), tone = "good" }, { "kind", "text", "tone" }))
			A.push(buttons, Js.O({ label = "Continue", action = "talk-done", style = "primary" }, { "label", "action", "style" }))
		else
			A.push(blocks, Js.O({ kind = "text", text = "Talks have broken down.", tone = "bad" }, { "kind", "text", "tone" }))
			A.push(buttons, Js.O({ label = "Back", action = "talk-walk", style = "primary" }, { "label", "action", "style" }))
		end
		do return Js.O({ id = "transfer-request-talk", hud = hud(c), title = o.club, blocks = blocks, buttons = buttons }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	niceStep = function(n)
		if (n < 100) then
			do return 1 end
		end
		if (n < 1000) then
			do return 10 end
		end
		if (n < 10000) then
			do return 100 end
		end
		do return 1000 end
	end
	act = function(g, action, arg, rng)
		if rng == nil then rng = Math.random end
		local ui = (if g.ui ~= nil then g.ui else Js.O({}, nil))
		local _sw18 = action
		local _ci19 = (if _sw18 == "tab" then 1 elseif _sw18 == "home" then 2 elseif _sw18 == "sim" then 3 elseif _sw18 == "play-match" then 4 elseif _sw18 == "watch" then 5 elseif _sw18 == "youth-week" then 6 elseif _sw18 == "youth-promote" then 7 elseif _sw18 == "post-continue" then 8 elseif _sw18 == "draw-continue" then 9 elseif _sw18 == "ko-continue" then 10 elseif _sw18 == "playoff-continue" then 11 elseif _sw18 == "deadline-continue" then 12 elseif _sw18 == "callup-continue" then 13 elseif _sw18 == "end-season" then 14 elseif _sw18 == "ballon-continue" then 15 elseif _sw18 == "play-on" then 16 elseif _sw18 == "retire" then 17 elseif _sw18 == "awards-continue" then 18 elseif _sw18 == "ladder-continue" then 19 elseif _sw18 == "stay" then 20 elseif _sw18 == "sign" then 21 elseif _sw18 == "relegation-pick" then 22 elseif _sw18 == "ask-contract" then 23 elseif _sw18 == "renewal-start" then 24 elseif _sw18 == "renewal-guess" then 25 elseif _sw18 == "renewal-sign" then 26 elseif _sw18 == "renewal-cancel" then 27 elseif _sw18 == "window-talk" then 28 elseif _sw18 == "talk-nudge" then 29 elseif _sw18 == "talk-offer" then 30 elseif _sw18 == "talk-done" then 31 elseif _sw18 == "talk-walk" then 32 else 0)
		local _cont20 = false
		repeat
			if _ci19 ~= 0 and _ci19 <= 1 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = (if arg ~= nil then arg else "home") }, { "tab" })) }, { "ui" })) end
			end
			if _ci19 ~= 0 and _ci19 <= 2 then
				do return Js.ospread(M_flow.backToDashboard(g), Js.O({ ui = Js.ospread(ui, Js.O({ tab = "home" }, { "tab" })) }, { "ui" })) end
			end
			if _ci19 ~= 0 and _ci19 <= 3 then
				do return M_flow.simMatch(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 4 then
				do return M_flow.simMatch(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 5 then
				do return M_flow.watchFromStands(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 6 then
				do return M_flow.youthWeek(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 7 then
				do return M_flow.youthPromotion(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 8 then
				do return M_flow.postMatchContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 9 then
				do return M_flow.drawContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 10 then
				do return M_flow.knockoutContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 11 then
				do return M_flow.playoffContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 12 then
				do return M_flow.deadlineDayContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 13 then
				do return M_flow.callUpContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 14 then
				do return M_flow.endSeason(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 15 then
				do return M_flow.ballonDorContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 16 then
				do return M_flow.playOn(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 17 then
				do return M_flow.retireNow(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 18 then
				do return M_flow.seasonAwardsContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 19 then
				do return M_flow.ladderContinue(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 20 then
				do return M_flow.stayPut(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 21 then
				do return M_flow.signingDone(g) end
			end
			if _ci19 ~= 0 and _ci19 <= 22 then
				do return M_flow.chooseTransfer(g, (if g.transferOffers ~= nil then g.transferOffers else Js.alit())[Js.Number(arg) + 1]) end
			end
			if _ci19 ~= 0 and _ci19 <= 23 then
				do return Js.ospread(g, Js.O({ phase = "contract-renewal", contractOfferReason = nil, ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "phase", "contractOfferReason", "ui" })) end
			end
			if _ci19 ~= 0 and _ci19 <= 24 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ renewal = Js.O({ current = (3 + math.floor((rng() * 8))), next = nil, wins = 0, locked = false, rounds = 0, message = "", started = true }, { "current", "next", "wins", "locked", "rounds", "message", "started" }) }, { "renewal" })) }, { "ui" })) end
			end
			if _ci19 ~= 0 and _ci19 <= 25 then
				do
					local r = ui.renewal
					if ((not r) or r.locked) then
						do return g end
					end
					local n = (1 + math.floor((rng() * 13)))
					while (n == r.current) do
						n = (1 + math.floor((rng() * 13)))
					end
					local correct = (if (arg == "higher") then (n > r.current) else (n < r.current))
					local next_ = (if correct then Js.ospread(r, Js.O({ current = n, rounds = (r.rounds + 1), wins = (r.wins + 1), message = ("✓ " .. Js.numstr(n) .. ". Correct! Your offer just improved. Take it, or push again.") }, { "current", "rounds", "wins", "message" })) else Js.ospread(r, Js.O({ current = n, rounds = (r.rounds + 1), locked = true, message = ("✗ " .. Js.numstr(n) .. ". Wrong. Talks sour and the offer drops. This is their final position.") }, { "current", "rounds", "locked", "message" })))
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ renewal = next_ }, { "renewal" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 26 then
				do
					local r = ui.renewal
					local offer = M_flow.renewalOffer(g, ((function() local _v = r; if _v == nil then return nil end; _v = _v.wins; return _v end)() or 0), (function() local _l = (function() local _v = r; if _v == nil then return nil end; _v = _v.locked; return _v end)(); if _l ~= nil then return _l end; return false end)(), ((function() local _v = r; if _v == nil then return nil end; _v = _v.rounds; return _v end)() or 0))
					do return Js.ospread(M_flow.contractComplete(g, offer), Js.O({ ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 27 then
				do return Js.ospread(M_flow.contractComplete(g, nil), Js.O({ ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "ui" })) end
			end
			if _ci19 ~= 0 and _ci19 <= 28 then
				do
					local _d21 = A.map(S.split((if arg ~= nil then arg else "0:0"), ":"), Js.Number)
					local li = _d21[1]
					local ci = _d21[2]
					local offer = ((M_flow.transferInterest(g).leagues)[li + 1].clubs)[ci + 1].offer
					local talk = M_negotiation.startNegotiation(offer.wage, "selling", rng)
					do return Js.ospread(M_flow.transferNegotiate(g, offer), Js.O({ ui = Js.ospread(ui, Js.O({ talk = talk, ask = talk.yourPosition }, { "talk", "ask" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 29 then
				do
					local a = ((if ui.ask ~= nil then ui.ask else (function() local _v = ui.talk; if _v == nil then return nil end; _v = _v.yourPosition; return _v end)()) or 0)
					local dir = (if (Js.Number(arg) < 0) then -1 else 1)
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ ask = Math.max(1, (a + (dir * niceStep((if (dir < 0) then (a - 1) else a))))) }, { "ask" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 30 then
				do
					if (not ui.talk) then
						do return g end
					end
					local t = M_negotiation.makeOffer(ui.talk, Math.max(1, Math.round((if ui.ask ~= nil then ui.ask else ui.talk.yourPosition))), rng)
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ talk = t }, { "talk" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 31 then
				do
					local t = ui.talk
					local r = M_flow.transferTalkDone(g, (if (t and (t.status == "accepted")) then (if t.finalPrice ~= nil then t.finalPrice else nil) else nil))
					do return Js.ospread(r, Js.O({ ui = Js.ospread(ui, Js.O({ talk = nil }, { "talk" })) }, { "ui" })) end
				end
			end
			if _ci19 ~= 0 and _ci19 <= 32 then
				do return Js.ospread(M_flow.transferTalkDone(g, nil), Js.O({ ui = Js.ospread(ui, Js.O({ talk = nil }, { "talk" })) }, { "ui" })) end
			end
		until true
		do return g end
	end
	exports.act = act
	TABS = Js.alit(Js.alit("home", "Home"), Js.alit("league", "League"), Js.alit("fixtures", "Fixtures"), Js.alit("stats", "Stats"))
	DIVISIONS = Js.alit("premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south")
	exports.DIVISIONS = DIVISIONS
end
