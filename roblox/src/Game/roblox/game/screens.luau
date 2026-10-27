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
	local M_trialFlow = import("roblox/game/trialFlow")
	local M_flow = import("roblox/game/flow")
	local M_trial = import("lib/star/trial")
	local M_grammar = import("lib/star/media/grammar")
	local M_week = import("lib/star/week")
	local M_trainingFlow = import("roblox/game/trainingFlow")
	local M_unlocks = import("lib/star/unlocks")
	local M_lifeFlow = import("roblox/game/lifeFlow")
	local M_achievements = import("lib/star/achievements")
	local M_rating = import("lib/star/rating")
	local M_relgamePlay = import("roblox/game/relgamePlay")
	local M_season = import("lib/star/season")
	local M_story = import("lib/star/story")
	local M_careerFlow = import("lib/star/careerFlow")
	local M_negotiation = import("lib/star/negotiation")
	local money, hud, fixtureLine, dateOf, score, ordinal, TABS, TAB_FEATURE, tabOpen, BEAT_GOES, DIVISIONS, setupScreen, divisionByName, clubScreen, startGame, startWithoutTrial, simTrial, trialDone, trialScreen, managerTalkScreen, trialRewardScreen, screen, trainTab, lifePageNeeds, lifeTab, settle, REL_KIND, relgameDone, trainingDone, dashboard, youthScreen, postMatch, renewalScreen, windowScreen, talkScreen, niceStep, act, actInner
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
		do return Js.O({ career = M_trialFlow.newTrialCareer(player, div), phase = "trial", koShown = Js.alit(), ui = Js.O({ tab = "home" }, { "tab" }) }, { "career", "phase", "koShown", "ui" }) end
	end
	exports.startGame = startGame
	startWithoutTrial = function(choice)
		local div = divisionByName(choice.division)
		local clubs = M_scoutOffers.clubsForDivision(div)
		local player = Js.O({ firstName = S.trim((if Js.T(choice.firstName) then choice.firstName else "Kai")), lastName = S.trim((if Js.T(choice.lastName) then choice.lastName else "Ball")), age = 17, skinTone = "tan", club = choice.club, clubBadge = nil, position = "ST", nationality = (if Js.T(choice.nationality) then choice.nationality else "England"), startYear = M_edition.STAR_FIFA_YEAR }, { "firstName", "lastName", "age", "skinTone", "club", "clubBadge", "position", "nationality", "startYear" })
		do return Js.ospread(M_flow.newGame(player, Js.aspread(clubs), div), Js.O({ ui = Js.O({ tab = "home" }, { "tab" }) }, { "ui" })) end
	end
	exports.startWithoutTrial = startWithoutTrial
	simTrial = function(g)
		local t = g.career.trial
		if (not t) then
			do return g end
		end
		local results = A.map(A.filter(M_trial.TRIAL_STAGES, function(stage)
			return (not t.results[stage])
		end), function(stage)
			return Js.O({ stage = stage, quality = 0.5 }, { "stage", "quality" })
		end)
		do return (trialDone(g, Js.O({ results = results, finalPenScored = false }, { "results", "finalPenScored" })) or g) end
	end
	trialDone = function(g, back)
		local recorded = M_trialFlow.recordTrialReturn(g.career, back)
		if (not recorded) then
			do return nil end
		end
		if M_trialFlow.managerTalk(recorded) then
			do return Js.ospread(g, Js.O({ career = recorded, phase = "manager-talk" }, { "career", "phase" })) end
		end
		local youth = M_trialFlow.youthAfterTrial(recorded)
		do return (if youth then Js.ospread(M_flow.afterSigning(Js.ospread(g, Js.O({ career = youth }, { "career" }))), Js.O({ ui = g.ui }, { "ui" })) else Js.ospread(g, Js.O({ career = recorded, phase = "manager-talk" }, { "career", "phase" }))) end
	end
	exports.trialDone = trialDone
	trialScreen = function(g)
		local c = g.career
		local t = c.trial
		local done = (if t then A.filter(M_trialFlow.trialSummary(t), function(r)
			return (r.score ~= nil)
		end) else Js.alit())
		do return Js.O({ id = "trial", hud = hud(c), title = ("Your trial at " .. c.player.club), blocks = Js.alit(Js.O({ kind = "text", text = "Five tests. A scout is watching every one." }, { "kind", "text" }), Js.O({ kind = "list", items = A.map((if t then M_trialFlow.trialSummary(t) else Js.alit()), function(r, i)
			return Js.O({ text = (Js.numstr((i + 1)) .. ". " .. M_trial.STAGE_LABEL[r.stage]), sub = (if (r.score == nil) then nil else (Js.numstr(r.score) .. " / 100")), tone = (if (r.score == nil) then "normal" else "good") }, { "text", "sub", "tone" })
		end) }, { "kind", "items" }), Js.O({ kind = "text", text = "Free kicks, the gate and the shootout are played on the pitch: drag back from the ball, then tap the ball where you want to strike it. Take him on: W A S D or the stick. Find the pass: tap the free man.", tone = "dim" }, { "kind", "text", "tone" })), buttons = Js.alit(Js.O({ label = (if Js.T(Js.alen(done)) then "Carry on with the trial ⚽" else "Start the trial ⚽"), action = "play-trial", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	managerTalkScreen = function(g)
		local c = g.career
		local mt = M_trialFlow.managerTalk(c)
		if (not mt) then
			do return Js.O({ id = "manager-talk", hud = hud(c), title = "Nobody came in", blocks = Js.alit(Js.O({ kind = "text", text = "No club made an offer." }, { "kind", "text" })), buttons = Js.alit(Js.O({ label = "Continue", action = "trial-sign", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
		end
		do return Js.O({ id = "manager-talk", hud = hud(c), title = (mt.offer.club .. " want you"), blocks = Js.aspread(Js.alit(Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Trial score", value = (Js.numstr((if c.trial then M_trial.trialScore(c.trial) else 0))) }, { "label", "value" }), Js.O({ label = "Club", value = M_grammar.shortClub(mt.offer.club) }, { "label", "value" }), Js.O({ label = "League", value = M_calendar.leagueNameFor(mt.offer.division) }, { "label", "value" }), Js.O({ label = "Wage", value = (money(mt.talk.openingWeekly) .. " a week"), tone = "gold" }, { "label", "value", "tone" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "The manager" }, { "kind", "text" })), A.map(mt.talk.lines, function(l)
			return Js.O({ kind = "text", text = ("“" .. l .. "”") }, { "kind", "text" })
		end), Js.alit(Js.O({ kind = "text", text = (Js.numstr(mt.offer.seasons) .. " seasons. Your first contract is fixed: sign it, no haggling."), tone = "dim" }, { "kind", "text", "tone" }))), buttons = Js.alit(Js.O({ label = "Accept & sign ✍️", action = "trial-sign", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	trialRewardScreen = function(g)
		local c = g.career
		do return Js.O({ id = "trial-reward", hud = hud(c), title = ("Welcome to " .. c.contract.club), blocks = Js.aspread(Js.alit(Js.O({ kind = "text", text = (c.player.firstName .. " " .. c.player.lastName .. " signs for " .. c.contract.club .. "."), tone = "gold" }, { "kind", "text", "tone" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Wage", value = (money(c.contract.wage) .. " a week") }, { "label", "value" }), Js.O({ label = "Seasons", value = Js.numstr(c.contract.seasonsRemaining) }, { "label", "value" }), Js.O({ label = "Goal bonus", value = money(c.contract.goalBonus) }, { "label", "value" }), Js.O({ label = "League", value = M_calendar.leagueNameFor(M_calendar.divisionOf(c)) }, { "label", "value" })) }, { "kind", "items" })), (if ((function() local _v = c.placement; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "loan") then Js.alit(Js.O({ kind = "text", text = ("On loan to " .. c.player.club .. "."), tone = "gold" }, { "kind", "text", "tone" })) else Js.alit())), buttons = Js.alit(Js.O({ label = "Let's go", action = "trial-reward-done", style = "primary" }, { "label", "action", "style" })) }, { "id", "hud", "title", "blocks", "buttons" }) end
	end
	screen = function(g)
		local c = g.career
		local base = Js.O({ hud = hud(c), tabs = nil }, { "hud", "tabs" })
		local _sw4 = g.phase
		local _ci5 = (if _sw4 == "dashboard" then 1 elseif _sw4 == "youth" then 2 elseif _sw4 == "post-match" then 3 elseif _sw4 == "draw" then 4 elseif _sw4 == "knockout-roundup" then 5 elseif _sw4 == "playoff-roundup" then 6 elseif _sw4 == "deadline-day" then 7 elseif _sw4 == "intl-callup" then 8 elseif _sw4 == "intl-watched" then 9 elseif _sw4 == "intl-tournament-table" then 10 elseif _sw4 == "contract-renewal" then 11 elseif _sw4 == "ballon-dor" then 12 elseif _sw4 == "final-season" then 13 elseif _sw4 == "retirement" then 14 elseif _sw4 == "season-transfer" then 15 elseif _sw4 == "transfer-request-talk" then 16 elseif _sw4 == "transfer-signing" then 17 elseif _sw4 == "relegation-move" then 18 elseif _sw4 == "season-awards" then 19 elseif _sw4 == "ladder" then 20 elseif _sw4 == "trial" then 21 elseif _sw4 == "manager-talk" then 22 elseif _sw4 == "trial-reward" then 23 elseif _sw4 == "legacy" then 24 else 0)
		local _cont6 = false
		repeat
			if _ci5 ~= 0 and _ci5 <= 1 then
				do return dashboard(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 2 then
				do return (if ((function() local _v = g.ui; if _v == nil then return nil end; _v = _v.tab; return _v end)() == "train") then trainTab(g, Js.O({ id = "youth-train", hud = hud(c), title = "", blocks = Js.alit(), buttons = Js.alit(Js.O({ label = "Back to the youth team", action = "tab", arg = "home", style = "secondary" }, { "label", "action", "arg", "style" })) }, { "id", "hud", "title", "blocks", "buttons" })) else youthScreen(g)) end
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
				do return trialScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 22 then
				do return managerTalkScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 23 then
				do return trialRewardScreen(g) end
			end
			if _ci5 ~= 0 and _ci5 <= 24 then
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
	trainTab = function(g, s)
		local c = g.career
		local ui = (if g.ui ~= nil then g.ui else Js.O({}, nil))
		local left = M_week.trainingLeft(c)
		s.title = "Training"
		if Js.T(ui.trainResult) then
			A.push(s.blocks, Js.O({ kind = "text", text = ui.trainResult, tone = "gold" }, { "kind", "text", "tone" }))
		end
		local skill = ui.trainSkill
		local label = (if Js.T(skill) then A.find(M_trainingFlow.SKILL_LABELS, function(l)
			return (l[1] == skill)
		end) else nil)
		if (Js.T(skill) and label) then
			local card = M_trainingFlow.skillCard(c, skill)
			s.title = (label[3] .. " " .. label[2])
			A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = label[2], value = Js.numstr(Math.round(card.value)) }, { "label", "value" }), Js.O({ label = "Stars", value = (Js.numstr(card.stars) .. " / 90") }, { "label", "value" }), Js.O({ label = "Sessions left", value = (Js.numstr(left) .. " / " .. Js.numstr(M_trainingFlow.TRAINING_SESSIONS_PER_WEEK)), tone = (if (left > 0) then "normal" else "bad") }, { "label", "value", "tone" }), Js.O({ label = "Energy", value = (Js.numstr(Math.round(c.energy)) .. "%"), tone = (if (c.energy < M_trainingFlow.trainingEnergyCost()) then "bad" else "normal") }, { "label", "value", "tone" })) }, { "kind", "items" }))
			if Js.T(card.why) then
				A.push(s.blocks, Js.O({ kind = "text", text = card.why, tone = "bad" }, { "kind", "text", "tone" }))
			end
			A.push(s.blocks, Js.O({ kind = "text", text = "Three tries a level: in first time is ★★★, second ★★, third ★. Every new star adds to the skill.", tone = "dim" }, { "kind", "text", "tone" }))
			local levels = A.filter(M_trainingFlow.levelList(c, skill), function(l)
				return l.open
			end)
			A.push(s.blocks, Js.O({ kind = "list", items = A.reverse(A.map(levels, function(l)
				return Js.ospread(Js.O({ text = ("Level " .. Js.numstr(l.level)), sub = (if Js.T(l.stars) then (S["repeat"]("★", l.stars) .. S["repeat"]("☆", (3 - l.stars))) else "Not played yet"), tone = (if (l.stars == 3) then "good" else "normal") }, { "text", "sub", "tone" }), (if card.canTrain then Js.O({ action = "play-training", arg = (skill .. ":" .. Js.numstr(l.level)) }, { "action", "arg" }) else Js.O({}, nil)))
			end)) }, { "kind", "items" }))
			A.push(s.buttons, Js.O({ label = "Back to skills", action = "train-back", style = "secondary" }, { "label", "action", "style" }))
			do return s end
		end
		A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Sessions left", value = (Js.numstr(left) .. " / " .. Js.numstr(M_trainingFlow.TRAINING_SESSIONS_PER_WEEK)), tone = (if (left > 0) then "normal" else "bad") }, { "label", "value", "tone" }), Js.O({ label = "A session costs", value = (Js.numstr(M_trainingFlow.trainingEnergyCost()) .. " energy") }, { "label", "value" })) }, { "kind", "items" }))
		if (left <= 0) then
			A.push(s.blocks, Js.O({ kind = "text", text = "No more sessions this week. They come back after a Saturday match.", tone = "dim" }, { "kind", "text", "tone" }))
		end
		A.push(s.blocks, Js.O({ kind = "list", items = A.map(M_trainingFlow.SKILL_LABELS, function(_p14)
			local key = _p14[1]
			local name = _p14[2]
			local icon = _p14[3]
			local desc = _p14[4]
			local card = M_trainingFlow.skillCard(c, key)
			do return Js.ospread(Js.O({ text = (icon .. " " .. name .. ": " .. Js.numstr(Math.round(card.value))), sub = (if card.shutWhy ~= nil then card.shutWhy else (Js.numstr(card.stars) .. "/90 stars · " .. desc)), tone = (if card.shut then "dim" else "normal") }, { "text", "sub", "tone" }), (if card.shut then Js.O({}, nil) else Js.O({ action = "train-skill", arg = key }, { "action", "arg" }))) end
		end) }, { "kind", "items" }))
		do return s end
	end
	lifePageNeeds = function(page)
		if (((page == "cans") or (page == "boots")) or (page == "style")) then
			do return "shop" end
		end
		if (((page == "sponsors") or S.startsWith(page, "offer:")) or S.startsWith(page, "deal:")) then
			do return "sponsors" end
		end
		do return "relations" end
	end
	lifeTab = function(g, s)
		local c = g.career
		local ui = (if g.ui ~= nil then g.ui else Js.O({}, nil))
		local page = (if (Js.T(ui.life) and M_unlocks.isOpen(c, lifePageNeeds(ui.life))) then ui.life else nil)
		if Js.T(ui.lifeNote) then
			A.push(s.blocks, Js.O({ kind = "text", text = ui.lifeNote, tone = "gold" }, { "kind", "text", "tone" }))
		end
		local back = Js.O({ label = "Back", action = "life", style = "secondary" }, { "label", "action", "style" })
		if (page == "cans") then
			s.title = "🥤 KIB energy cans"
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(M_lifeFlow.cans(c), function(k)
				return Js.O({ text = (k.can.name .. ": " .. k.label), sub = (money(k.price) .. " · you have " .. Js.numstr(k.owned)), tone = (if (c.money < k.price) then "dim" else "normal"), action = "buy-can", arg = k.can.id }, { "text", "sub", "tone", "action", "arg" })
			end) }, { "kind", "items" }))
			A.push(s.buttons, back)
			do return s end
		end
		if (page == "boots") then
			s.title = "👟 Boots"
			local cb = c.currentBoot
			A.push(s.blocks, Js.O({ kind = "text", text = (if (cb.matches > 0) then ("Wearing: " .. cb.name .. " (+" .. Js.numstr(cb.power) .. " power, +" .. Js.numstr(cb.technique) .. " technique), " .. Js.numstr(cb.matches) .. " matches left.") else "No boots on. A pair adds power and technique for its matches.") }, { "kind", "text" }))
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(M_lifeFlow.boots(c), function(b)
				return Js.O({ text = (b.name .. ": +" .. Js.numstr(b.power) .. " power, +" .. Js.numstr(b.technique) .. " technique" .. (if b.curve then ", curve" else "") .. (if b.extraTouch then ", Touch Mode" else "")), sub = (money(b.price) .. " · " .. Js.numstr(b.matches) .. " matches" .. (if (cb.id == b.id) then " · adds to yours" else "")), tone = (if (c.money < b.price) then "dim" else "normal"), action = "buy-boot", arg = b.id }, { "text", "sub", "tone", "action", "arg" })
			end) }, { "kind", "items" }))
			A.push(s.buttons, back)
			do return s end
		end
		if (page == "style") then
			s.title = "🏠 Lifestyle"
			A.push(s.blocks, Js.O({ kind = "text", text = "Things you own raise your fame. Some wear out after a few seasons.", tone = "dim" }, { "kind", "text", "tone" }))
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(M_lifeFlow.lifestyle(c), function(_p15)
				local item = _p15.item
				local status = _p15.status
				local needStars = _p15.needStars
				return Js.ospread(Js.O({ text = (item.name .. (if Js.T(item.level) then (" (level " .. Js.numstr(item.level) .. ")") else "")), sub = (if (status == "locked") then ("Opens at ★" .. Js.numstr(needStars)) else (if (status == "owned") then "Yours" else (if (status == "lower") then "You own a better one" else (money(item.price) .. " · +" .. Js.numstr(item.lifestyleValue) .. " fame" .. (if (status == "worn") then " · yours is worn out" else ""))))), tone = (if (status == "owned") then "good" else (if (((status == "locked") or (status == "lower")) or (c.money < item.price)) then "dim" else "normal")) }, { "text", "sub", "tone" }), (if ((status == "buy") or (status == "worn")) then Js.O({ action = "buy-item", arg = item.id }, { "action", "arg" }) else Js.O({}, nil)))
			end) }, { "kind", "items" }))
			A.push(s.buttons, back)
			do return s end
		end
		if (page == "boss") then
			s.title = "👔 Your manager"
			A.push(s.blocks, Js.O({ kind = "text", text = "All three move the Manager bar the same amount: up to +6, or −2 if it goes badly." }, { "kind", "text" }))
			A.push(s.blocks, Js.O({ kind = "list", items = Js.alit(Js.O({ text = "🎯 Penalties", sub = "He names a spot. Hit it. Three kicks.", action = "play-relgame", arg = "penalties" }, { "text", "sub", "action", "arg" }), Js.O({ text = "💬 Office talk", sub = "Three questions. Say what he wants to hear.", action = "rel-boss" }, { "text", "sub", "action" }), Js.O({ text = "⚽ Extra session", sub = "Four shots while he watches. Each one harder.", action = "play-relgame", arg = "session" }, { "text", "sub", "action", "arg" })) }, { "kind", "items" }))
			A.push(s.buttons, back)
			do return s end
		end
		if (page == "dayoff") then
			s.title = "🌴 Day off"
			A.push(s.blocks, Js.O({ kind = "text", text = "How do you want to spend it? Happier players get more energy back when they rest." }, { "kind", "text" }))
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(M_lifeFlow.dayOffOptions(c), function(o)
				return Js.O({ text = (o.icon .. " " .. o.name), sub = ("+" .. Js.numstr(o.gain) .. " happiness" .. (if Js.T(o.cost) then (" · " .. money(o.cost)) else " · free")), tone = (if (c.money < o.cost) then "dim" else "normal"), action = "dayoff", arg = o.id }, { "text", "sub", "tone", "action", "arg" })
			end) }, { "kind", "items" }))
			A.push(s.buttons, back)
			do return s end
		end
		if ((page == "talk") and ui.bossTalk) then
			local t = ui.bossTalk
			local r = t.talk.rounds[Math.min(t.round, (M_lifeFlow.TALK_ROUNDS - 1)) + 1]
			s.title = "💬 Office talk"
			A.push(s.blocks, Js.O({ kind = "text", text = ("Question " .. Js.numstr((t.round + 1)) .. " of " .. Js.numstr(M_lifeFlow.TALK_ROUNDS) .. ". Say what he wants to hear: his lines are the only clue."), tone = "dim" }, { "kind", "text", "tone" }))
			if t.last then
				A.push(s.blocks, Js.O({ kind = "text", text = ("You: “" .. t.last.you .. "”") }, { "kind", "text" }), Js.O({ kind = "text", text = (((function() local _v = c.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager") .. ": “" .. t.last.him .. "”"), tone = "gold" }, { "kind", "text", "tone" }))
			end
			A.push(s.blocks, Js.O({ kind = "heading", text = (((function() local _v = c.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager") .. ": “" .. r.line .. "”") }, { "kind", "text" }))
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(r.replies, function(rep, i)
				return Js.O({ text = rep.text, action = "talk-pick", arg = Js.numstr(i) }, { "text", "action", "arg" })
			end) }, { "kind", "items" }))
			do return s end
		end
		if (((page == "sponsors") or S.startsWith((if page ~= nil then page else ""), "offer:")) or S.startsWith((if page ~= nil then page else ""), "deal:")) then
			local b = M_lifeFlow.brandsOf(c)
			s.title = "🤝 Sponsors"
			if S.startsWith((if page ~= nil then page else ""), "offer:") then
				local o = A.find(b.offers, function(x)
					return (x.id == S.slice(page, 6))
				end)
				if o then
					s.title = (o.brand .. " (" .. o.category .. ")")
					A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "A week", value = money(o.weekly), tone = "gold" }, { "label", "value", "tone" }), Js.O({ label = "Seasons", value = Js.numstr(o.seasons) }, { "label", "value" }), Js.O({ label = "On signing", value = money(o.signingOn) }, { "label", "value" })) }, { "kind", "items" }))
					A.push(s.blocks, Js.O({ kind = "list", items = A.map(o.targets, function(t)
						return Js.O({ text = M_lifeFlow.targetLabel(t), sub = ("Bonus " .. money(t.bonus)) }, { "text", "sub" })
					end) }, { "kind", "items" }))
					A.push(s.buttons, Js.unpack(Js.aspread(Js.alit(Js.O({ label = "Sign ✍️", action = "sponsor", arg = ("sign:" .. o.id), style = "primary" }, { "label", "action", "arg", "style" }), Js.O({ label = "Ask for a longer deal", action = "sponsor", arg = ("longer:" .. o.id) }, { "label", "action", "arg" }), Js.O({ label = "Ask for easier targets", action = "sponsor", arg = ("easier:" .. o.id) }, { "label", "action", "arg" })), (if Js.T(o.replaces) then Js.alit(Js.O({ label = "Ask your sponsor to match it", action = "sponsor", arg = ("counter:" .. o.id) }, { "label", "action", "arg" })) else Js.alit()), Js.alit(Js.O({ label = "Decline", action = "sponsor", arg = ("decline:" .. o.id), style = "danger" }, { "label", "action", "arg", "style" })))))
				end
				A.push(s.buttons, Js.O({ label = "Back", action = "life", arg = "sponsors", style = "secondary" }, { "label", "action", "arg", "style" }))
				do return s end
			end
			if S.startsWith((if page ~= nil then page else ""), "deal:") then
				local d = A.find(b.deals, function(x)
					return (x.id == S.slice(page, 5))
				end)
				if d then
					s.title = (d.brand .. " (" .. d.category .. ")")
					A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "A week", value = money(d.weekly), tone = "gold" }, { "label", "value", "tone" }), Js.O({ label = "Seasons left", value = Js.numstr(d.seasonsLeft) }, { "label", "value" }), Js.O({ label = "Their mood", value = (Js.numstr(Math.round(d.happiness)) .. "%") }, { "label", "value" })) }, { "kind", "items" }))
					A.push(s.blocks, Js.O({ kind = "list", items = A.map(d.targets, function(t)
						return Js.O({ text = M_lifeFlow.targetLabel(t), sub = (Js.numstr(t.progress) .. " of " .. Js.numstr(t.target) .. " · bonus " .. money(t.bonus)), tone = (if t.done then "good" else "normal") }, { "text", "sub", "tone" })
					end) }, { "kind", "items" }))
					A.push(s.buttons, Js.O({ label = ("Walk away (costs " .. money(d.guaranteed) .. ")"), action = "sponsor", arg = ("walk:" .. d.id), style = "danger" }, { "label", "action", "arg", "style" }))
				end
				A.push(s.buttons, Js.O({ label = "Back", action = "life", arg = "sponsors", style = "secondary" }, { "label", "action", "arg", "style" }))
				do return s end
			end
			A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Deals", value = (Js.numstr(Js.alen(b.deals)) .. " / " .. Js.numstr(M_lifeFlow.slotsFor(c))) }, { "label", "value" }), Js.O({ label = "Offers", value = Js.numstr(Js.alen(b.offers)) }, { "label", "value" })) }, { "kind", "items" }))
			A.push(s.blocks, Js.O({ kind = "heading", text = "Your deals" }, { "kind", "text" }))
			A.push(s.blocks, (if Js.T(Js.alen(b.deals)) then Js.O({ kind = "list", items = A.map(b.deals, function(d)
				return Js.O({ text = (d.brand .. " (" .. d.category .. ")"), sub = (money(d.weekly) .. " a week · " .. Js.numstr(d.seasonsLeft) .. " seasons left"), action = "life", arg = ("deal:" .. d.id) }, { "text", "sub", "action", "arg" })
			end) }, { "kind", "items" }) else Js.O({ kind = "text", text = "No deals yet. Play well and get famous: the brands come to you.", tone = "dim" }, { "kind", "text", "tone" })))
			if Js.T(Js.alen(b.offers)) then
				A.push(s.blocks, Js.O({ kind = "heading", text = "Offers" }, { "kind", "text" }))
				A.push(s.blocks, Js.O({ kind = "list", items = A.map(b.offers, function(o)
					return Js.O({ text = (o.brand .. " (" .. o.category .. ")"), sub = (money(o.weekly) .. " a week · " .. Js.numstr(o.seasons) .. " seasons"), tone = "gold", action = "life", arg = ("offer:" .. o.id) }, { "text", "sub", "tone", "action", "arg" })
				end) }, { "kind", "items" }))
			end
			if Js.T(Js.alen(b.news)) then
				A.push(s.blocks, Js.O({ kind = "list", items = A.map(A.slice(b.news, 0, 4), function(n)
					return Js.O({ text = n, tone = "dim" }, { "text", "tone" })
				end) }, { "kind", "items" }))
			end
			A.push(s.buttons, back)
			do return s end
		end
		s.title = "Life"
		local left = M_lifeFlow.actionsLeft(c)
		A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Energy", value = (Js.numstr(Math.round(c.energy)) .. "%"), tone = (if (c.energy < 40) then "bad" else "normal") }, { "label", "value", "tone" }), Js.O({ label = "Happiness", value = (Js.numstr(Math.round(c.happiness)) .. "%") }, { "label", "value" }), Js.O({ label = "Days left this week", value = Js.numstr(left), tone = (if (left > 0) then "normal" else "bad") }, { "label", "value", "tone" }), Js.O({ label = "Money", value = money(c.money), tone = "gold" }, { "label", "value", "tone" })) }, { "kind", "items" }))
		local rel = function(k, icon, name, value, action)
			local st = M_lifeFlow.relGame(c, k)
			do return Js.ospread(Js.O({ text = (icon .. " " .. name .. ": " .. Js.numstr(Math.round(value))), sub = (M_lifeFlow.REL_GAME_LABEL[k] .. " · " .. (if st.why ~= nil then st.why else ("1 day, " .. Js.numstr(M_trainingFlow.trainingEnergyCost()) .. " energy"))), tone = (if (st.canPlay and Js.T(action)) then "normal" else "dim") }, { "text", "sub", "tone" }), (if (st.canPlay and Js.T(action)) then Js.O({ action = action }, { "action" }) else Js.O({}, nil))) end
		end
		A.push(s.blocks, Js.O({ kind = "heading", text = "Relationships" }, { "kind", "text" }))
		if (not M_unlocks.isOpen(c, "relations")) then
			A.push(s.blocks, Js.O({ kind = "text", text = ("🔒 " .. M_unlocks.lockHint(c, "relations")), tone = "dim" }, { "kind", "text", "tone" }))
		else
			A.push(s.blocks, Js.O({ kind = "list", items = Js.alit(rel("boss", "👔", "Manager", c.relationships.boss, "life-boss"), Js.ospread(rel("team", "🤝", "Team-mates", c.relationships.team, "play-relgame"), (if M_lifeFlow.relGame(c, "team").canPlay then Js.O({ arg = "woodwork" }, { "arg" }) else Js.O({}, nil))), Js.ospread(rel("fans", "📣", "Fans", c.relationships.fans, "play-relgame"), (if M_lifeFlow.relGame(c, "fans").canPlay then Js.O({ arg = "signing" }, { "arg" }) else Js.O({}, nil))), rel("happiness", "🌴", "Happiness", c.happiness, "life-dayoff")) }, { "kind", "items" }))
		end
		local owned = A.filter(M_lifeFlow.cans(c), function(k)
			return (k.owned > 0)
		end)
		if Js.T(Js.alen(owned)) then
			A.push(s.blocks, Js.O({ kind = "heading", text = "Your cans" }, { "kind", "text" }))
			A.push(s.blocks, Js.O({ kind = "list", items = A.map(owned, function(k)
				return Js.O({ text = ("Drink " .. k.can.name .. " (" .. Js.numstr(k.owned) .. ")"), sub = k.label, action = "use-can", arg = k.can.id }, { "text", "sub", "action", "arg" })
			end) }, { "kind", "items" }))
		end
		local offers = Js.alen(M_lifeFlow.brandsOf(c).offers)
		A.push(s.blocks, Js.O({ kind = "heading", text = "Shop" }, { "kind", "text" }))
		local shop = M_unlocks.isOpen(c, "shop")
		local sponsors = M_unlocks.isOpen(c, "sponsors")
		A.push(s.blocks, Js.O({ kind = "list", items = Js.aspread((if shop then Js.alit(Js.O({ text = "🥤 KIB energy cans", action = "life", arg = "cans" }, { "text", "action", "arg" }), Js.O({ text = "👟 Boots", sub = (if (c.currentBoot.matches > 0) then (c.currentBoot.name .. ": " .. Js.numstr(c.currentBoot.matches) .. " matches left") else "No boots on"), action = "life", arg = "boots" }, { "text", "sub", "action", "arg" }), Js.O({ text = "🏠 Lifestyle", sub = "Cars, homes, watches: fame", action = "life", arg = "style" }, { "text", "sub", "action", "arg" })) else Js.alit(Js.O({ text = "🔒 Cans, boots and lifestyle", sub = M_unlocks.lockHint(c, "shop"), tone = "dim" }, { "text", "sub", "tone" }))), Js.alit((if sponsors then Js.O({ text = ("🤝 Sponsors" .. (if Js.T(offers) then (" (" .. Js.numstr(offers) .. " new offer" .. (if (offers == 1) then "" else "s") .. ")") else "")), tone = (if Js.T(offers) then "gold" else "normal"), action = "life", arg = "sponsors" }, { "text", "tone", "action", "arg" }) else Js.O({ text = "🔒 Sponsors", sub = M_unlocks.lockHint(c, "sponsors"), tone = "dim" }, { "text", "sub", "tone" })))) }, { "kind", "items" }))
		if M_lifeFlow.canAct(c) then
			A.push(s.buttons, Js.O({ label = ("😴 Rest (+" .. Js.numstr(M_lifeFlow.restGain(c)) .. " energy, 1 day)"), action = "rest", style = "secondary" }, { "label", "action", "style" }))
		end
		do return s end
	end
	settle = function(g)
		local ids = M_achievements.checkNewAchievements(g.career)
		if (not Js.T(Js.alen(ids))) then
			do return g end
		end
		local unlocked = Js.ospread(g.career, Js.O({ achievements = Js.aspread(g.career.achievements, ids) }, { "achievements" }))
		local next_ = M_starPoints.withStars(Js.ospread(unlocked, Js.O({ starRating = M_rating.computeStarRating(unlocked) }, { "starRating" })))
		do return Js.ospread(g, Js.O({ career = next_, ui = Js.ospread((if g.ui ~= nil then g.ui else Js.O({}, nil)), Js.O({ achieved = ids }, { "achieved" })) }, { "career", "ui" })) end
	end
	relgameDone = function(g, game_, count, roll)
		local kind = REL_KIND[game_]
		if ((not Js.T(kind)) or (not M_lifeFlow.relGame(g.career, kind).canPlay)) then
			do return nil end
		end
		local r = M_relgamePlay.relgameGain(g.career, game_, count, roll)
		if (not r) then
			do return nil end
		end
		local who = (if (kind == "boss") then "Manager" else (if (kind == "team") then "Team-mates" else "Fans"))
		do return settle(Js.ospread(g, Js.O({ career = M_lifeFlow.relGameComplete(g.career, kind, Js.O({ gain = r.gain }, { "gain" })), ui = Js.ospread((if g.ui ~= nil then g.ui else Js.O({}, nil)), Js.O({ achieved = nil, tab = "life", life = nil, lifeNote = (r.line .. " " .. who .. " " .. (if (r.gain >= 0) then "+" else "") .. Js.numstr(r.gain) .. ".") }, { "achieved", "tab", "life", "lifeNote" })) }, { "career", "ui" }))) end
	end
	exports.relgameDone = relgameDone
	trainingDone = function(g, skill, level, stars)
		local label = A.find(M_trainingFlow.SKILL_LABELS, function(l)
			return (l[1] == skill)
		end)
		if ((not label) or (not M_trainingFlow.mayPlayLevel(g.career, label[1], level))) then
			do return nil end
		end
		if ((((type(stars) ~= "number") or (not Js.NumberNS.isFinite(stars))) or (stars < 0)) or (stars > 3)) then
			do return nil end
		end
		local res = M_trainingFlow.trainingComplete(g.career, label[1], level, stars)
		local line = (if (stars > 0) then ("Level " .. Js.numstr(level) .. ": " .. S["repeat"]("★", stars) .. ". " .. label[2] .. " " .. (if (res.gained > 0) then ("+" .. Js.numstr(res.gained)) else "unchanged") .. (if (res.newStars > 0) then (" (" .. Js.numstr(res.newStars) .. " new star" .. (if (res.newStars == 1) then "" else "s") .. ")") else "") .. ".") else ("Level " .. Js.numstr(level) .. ": no stars this time."))
		do return settle(Js.ospread(g, Js.O({ career = res.career, ui = Js.ospread((if g.ui ~= nil then g.ui else Js.O({}, nil)), Js.O({ achieved = nil, tab = "train", trainSkill = label[1], trainResult = line }, { "achieved", "tab", "trainSkill", "trainResult" })) }, { "career", "ui" }))) end
	end
	exports.trainingDone = trainingDone
	dashboard = function(g)
		local c = g.career
		local tab = ((function() local _v = g.ui; if _v == nil then return nil end; _v = _v.tab; return _v end)() or "home")
		local tabs = A.map(TABS, function(_p16)
			local id = _p16[1]
			local label = _p16[2]
			return Js.O({ id = id, label = (if tabOpen(c, id) then label else (label .. " 🔒")), active = (id == tab) }, { "id", "label", "active" })
		end)
		local s = Js.O({ id = "dashboard", hud = hud(c), title = c.player.club, tabs = tabs, blocks = Js.alit(), buttons = Js.alit() }, { "id", "hud", "title", "tabs", "blocks", "buttons" })
		do
			local _arr17 = ((function() local _v = g.ui; if _v == nil then return nil end; _v = _v.achieved; return _v end)() or Js.alit())
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local id = _arr17[_i18]
				local a = A.find(M_achievements.ACHIEVEMENTS, function(x)
					return (x.id == id)
				end)
				if a then
					A.push(s.blocks, Js.O({ kind = "text", text = ("⭐ Achievement: " .. a.label .. ". " .. a.description .. "."), tone = "gold" }, { "kind", "text", "tone" }))
				end
			end
		end
		if (not tabOpen(c, tab)) then
			s.title = ("🔒 " .. ((function() local _v = A.find(TABS, function(t)
				return (t[1] == tab)
			end); if _v == nil then return nil end; _v = _v[2]; return _v end)() or ""))
			A.push(s.blocks, Js.O({ kind = "text", text = M_unlocks.lockHint(c, TAB_FEATURE[tab]), tone = "dim" }, { "kind", "text", "tone" }))
			do return s end
		end
		if (tab == "train") then
			do return trainTab(g, s) end
		end
		if (tab == "life") then
			do return lifeTab(g, s) end
		end
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
			A.push(s.blocks, Js.O({ kind = "heading", text = "This season" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Apps", value = Js.numstr(ss.appearances) }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(ss.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(ss.assists) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Career" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Apps", value = Js.numstr(cs.appearances) }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(cs.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(cs.assists) }, { "label", "value" }), Js.O({ label = "Trophies", value = Js.numstr(Js.alen(c.trophies)) }, { "label", "value" }), Js.O({ label = "Ballon d'Ors", value = Js.numstr((if c.ballonDorWins ~= nil then c.ballonDorWins else 0)) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Skills" }, { "kind", "text" }), Js.O({ kind = "stats", items = A.map(Js.Object.entries(c.skills), function(_p19)
				local k = _p19[1]
				local v = _p19[2]
				return Js.O({ label = (S.toUpperCase(S.idx(k, 0)) .. S.slice(k, 1)), value = Js.numstr(Math.round(v)) }, { "label", "value" })
			end) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Contract" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Wage a week", value = money(c.contract.wage) }, { "label", "value" }), Js.O({ label = "Seasons left", value = Js.numstr(c.contract.seasonsRemaining) }, { "label", "value" }), Js.O({ label = "Goal bonus", value = money(c.contract.goalBonus) }, { "label", "value" })) }, { "kind", "items" }), Js.O({ kind = "heading", text = "Relationships" }, { "kind", "text" }), Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "Manager", value = Js.numstr(Math.round(c.relationships.boss)) }, { "label", "value" }), Js.O({ label = "Team-mates", value = Js.numstr(Math.round(c.relationships.team)) }, { "label", "value" }), Js.O({ label = "Fans", value = Js.numstr(Math.round(c.relationships.fans)) }, { "label", "value" })) }, { "kind", "items" }))
			if M_unlocks.isOpen(c, "achievements") then
				local got = A.filter(M_achievements.ACHIEVEMENTS, function(a)
					return A.includes(c.achievements, a.id)
				end)
				A.push(s.blocks, Js.O({ kind = "heading", text = ("Achievements: " .. Js.numstr(Js.alen(got)) .. " of " .. Js.numstr(Js.alen(M_achievements.ACHIEVEMENTS))) }, { "kind", "text" }))
				if Js.T(Js.alen(got)) then
					A.push(s.blocks, Js.O({ kind = "list", items = A.map(got, function(a)
						return Js.O({ text = ("⭐ " .. a.label), sub = a.description, tone = (if ((a.tier == "legendary") or (a.tier == "hard")) then "gold" else "normal") }, { "text", "sub", "tone" })
					end) }, { "kind", "items" }))
				end
			end
			A.push(s.buttons, Js.O({ label = "Ask for a new contract", action = "ask-contract", style = "secondary" }, { "label", "action", "style" }))
			do return s end
		end
		local m = M_flow.matchday(g)
		local pos = (if Js.T(Js.alen(c.league)) then M_competitions.leaguePosition(c) else 0)
		A.push(s.blocks, Js.O({ kind = "stats", items = Js.alit(Js.O({ label = "League", value = (if Js.T(pos) then (ordinal(pos) .. " of " .. Js.numstr(Js.alen(c.league))) else "-") }, { "label", "value" }), Js.O({ label = "Goals", value = Js.numstr(c.seasonStats.goals) }, { "label", "value" }), Js.O({ label = "Assists", value = Js.numstr(c.seasonStats.assists) }, { "label", "value" }), Js.O({ label = "Energy", value = (Js.numstr(Math.round(c.energy)) .. "%"), tone = (if (c.energy < 40) then "bad" else "normal") }, { "label", "value", "tone" })) }, { "kind", "items" }))
		if Js.T(c.managerNews) then
			A.push(s.blocks, Js.O({ kind = "text", text = c.managerNews, tone = "gold" }, { "kind", "text", "tone" }))
		end
		local beat = M_story.storyBeat(c, M_starPoints.starsNow(c))
		if Js.T(beat) then
			local t = M_story.beatText(c, beat)
			A.push(s.blocks, Js.O({ kind = "heading", text = (t.icon .. " " .. t.title) }, { "kind", "text" }), Js.O({ kind = "text", text = t.who, tone = "dim" }, { "kind", "text", "tone" }))
			if Js.T(t.line) then
				A.push(s.blocks, Js.O({ kind = "text", text = ("“" .. t.line .. "”"), tone = "gold" }, { "kind", "text", "tone" }))
			end
			if (beat == "starpass") then
				A.push(s.blocks, Js.O({ kind = "text", text = ("You are a ★" .. Js.numstr(M_starPoints.starsNow(c)) .. " player now. Every new star in training and every good game moves you up.") }, { "kind", "text" }))
			end
			if t.boot then
				A.push(s.blocks, Js.O({ kind = "stats", items = Js.aspread(A.map(t.boot.stats, function(x)
					return Js.O({ label = S.split(x, " ")[1], value = S.split(x, " ")[2] }, { "label", "value" })
				end), Js.alit(Js.O({ label = "Games", value = Js.numstr(t.boot.games) }, { "label", "value" }))) }, { "kind", "items" }))
			end
			A.push(s.buttons, Js.O({ label = t.button, action = "beat", arg = beat, style = "primary" }, { "label", "action", "arg", "style" }))
			do return s end
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
		A.push(buttons, Js.O({ label = "🏋️ Train", action = "tab", arg = "train", style = "secondary" }, { "label", "action", "arg", "style" }))
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
				local _arr20 = A.slice(t.log, -4)
				local _i21 = 0
				while _i21 < Js.alen(_arr20) do
					_i21 += 1
					local line = _arr20[_i21]
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
		do return settle(actInner((if (function() local _v = g.ui; if _v == nil then return nil end; _v = _v.achieved; return _v end)() then Js.ospread(g, Js.O({ ui = Js.ospread(g.ui, Js.O({ achieved = nil }, { "achieved" })) }, { "ui" })) else g), action, arg, rng)) end
	end
	exports.act = act
	actInner = function(g, action, arg, rng)
		local ui = (if g.ui ~= nil then g.ui else Js.O({}, nil))
		local _sw22 = action
		local _ci23 = (if _sw22 == "tab" then 1 elseif _sw22 == "home" then 2 elseif _sw22 == "beat" then 3 elseif _sw22 == "life" then 4 elseif _sw22 == "rest" then 5 elseif _sw22 == "use-can" then 6 elseif _sw22 == "buy-can" then 7 elseif _sw22 == "buy-boot" then 8 elseif _sw22 == "buy-item" then 9 elseif _sw22 == "life-boss" then 10 elseif _sw22 == "play-relgame" then 11 elseif _sw22 == "life-dayoff" then 12 elseif _sw22 == "dayoff" then 13 elseif _sw22 == "rel-boss" then 14 elseif _sw22 == "talk-pick" then 15 elseif _sw22 == "sponsor" then 16 elseif _sw22 == "train-skill" then 17 elseif _sw22 == "train-back" then 18 elseif _sw22 == "play-training" then 19 elseif _sw22 == "sim" then 20 elseif _sw22 == "play-match" then 21 elseif _sw22 == "watch" then 22 elseif _sw22 == "youth-week" then 23 elseif _sw22 == "youth-promote" then 24 elseif _sw22 == "post-continue" then 25 elseif _sw22 == "draw-continue" then 26 elseif _sw22 == "ko-continue" then 27 elseif _sw22 == "playoff-continue" then 28 elseif _sw22 == "deadline-continue" then 29 elseif _sw22 == "callup-continue" then 30 elseif _sw22 == "end-season" then 31 elseif _sw22 == "ballon-continue" then 32 elseif _sw22 == "play-on" then 33 elseif _sw22 == "retire" then 34 elseif _sw22 == "play-trial" then 35 elseif _sw22 == "trial-sign" then 36 elseif _sw22 == "trial-reward-done" then 37 elseif _sw22 == "awards-continue" then 38 elseif _sw22 == "ladder-continue" then 39 elseif _sw22 == "stay" then 40 elseif _sw22 == "sign" then 41 elseif _sw22 == "relegation-pick" then 42 elseif _sw22 == "ask-contract" then 43 elseif _sw22 == "renewal-start" then 44 elseif _sw22 == "renewal-guess" then 45 elseif _sw22 == "renewal-sign" then 46 elseif _sw22 == "renewal-cancel" then 47 elseif _sw22 == "window-talk" then 48 elseif _sw22 == "talk-nudge" then 49 elseif _sw22 == "talk-offer" then 50 elseif _sw22 == "talk-done" then 51 elseif _sw22 == "talk-walk" then 52 else 0)
		local _cont24 = false
		repeat
			if _ci23 ~= 0 and _ci23 <= 1 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = (if arg ~= nil then arg else "home"), trainResult = nil, life = nil, lifeNote = nil, bossTalk = nil }, { "tab", "trainResult", "life", "lifeNote", "bossTalk" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 2 then
				do return Js.ospread(M_flow.backToDashboard(g), Js.O({ ui = Js.ospread(ui, Js.O({ tab = "home" }, { "tab" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 3 then
				do
					local b = M_story.storyBeat(g.career, M_starPoints.starsNow(g.career))
					if ((not Js.T(b)) or (b ~= arg)) then
						do return g end
					end
					local go = BEAT_GOES[b]
					do return Js.ospread(g, Js.O({ career = M_story.ackBeat(g.career, b), ui = (if go then Js.ospread(ui, Js.O({ tab = go.tab, life = go.life, lifeNote = nil, trainSkill = nil, trainResult = nil }, { "tab", "life", "lifeNote", "trainSkill", "trainResult" })) else ui) }, { "career", "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 4 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "life", life = arg, lifeNote = nil }, { "tab", "life", "lifeNote" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 5 then
				do return Js.ospread(g, Js.O({ career = M_lifeFlow.rest(g.career), ui = Js.ospread(ui, Js.O({ lifeNote = "You put your feet up." }, { "lifeNote" })) }, { "career", "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 9 then
				do
					local f = (if (action == "use-can") then M_lifeFlow.useCan else (if (action == "buy-can") then M_lifeFlow.buyKib else (if (action == "buy-boot") then M_lifeFlow.buyBoot else M_lifeFlow.buyItem)))
					local next_ = f(g.career, (if arg ~= nil then arg else ""))
					do return (if next_ then Js.ospread(g, Js.O({ career = next_, ui = Js.ospread(ui, Js.O({ lifeNote = (if (action == "use-can") then "Drunk." else "Bought.") }, { "lifeNote" })) }, { "career", "ui" })) else Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ lifeNote = (if (action == "use-can") then "That can would do nothing now." else "Not enough money for that.") }, { "lifeNote" })) }, { "ui" }))) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 10 then
				do return (if M_lifeFlow.relGame(g.career, "boss").canPlay then Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "life", life = "boss", lifeNote = nil }, { "tab", "life", "lifeNote" })) }, { "ui" })) else g) end
			end
			if _ci23 ~= 0 and _ci23 <= 11 then
				do return (relgameDone(g, (if arg ~= nil then arg else ""), (if (arg == "signing") then 6 else 2), rng()) or g) end
			end
			if _ci23 ~= 0 and _ci23 <= 12 then
				do return (if M_lifeFlow.relGame(g.career, "happiness").canPlay then Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "life", life = "dayoff", lifeNote = nil }, { "tab", "life", "lifeNote" })) }, { "ui" })) else g) end
			end
			if _ci23 ~= 0 and _ci23 <= 13 then
				do
					if (not M_lifeFlow.relGame(g.career, "happiness").canPlay) then
						do return g end
					end
					local r = M_lifeFlow.dayOff(g.career, (if arg ~= nil then arg else ""))
					if (not r) then
						do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ lifeNote = "Not enough money for that." }, { "lifeNote" })) }, { "ui" })) end
					end
					do return Js.ospread(g, Js.O({ career = M_lifeFlow.relGameComplete(g.career, "happiness", r), ui = Js.ospread(ui, Js.O({ life = nil, lifeNote = (r.line .. " Happiness +" .. Js.numstr(r.gain) .. ".") }, { "life", "lifeNote" })) }, { "career", "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 14 then
				do
					if (not M_lifeFlow.relGame(g.career, "boss").canPlay) then
						do return g end
					end
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "life", life = "talk", lifeNote = nil, bossTalk = M_lifeFlow.startTalk(g.career, math.floor((rng() * 100000))) }, { "tab", "life", "lifeNote", "bossTalk" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 15 then
				do
					local t = ui.bossTalk
					if ((not t) or (not M_lifeFlow.relGame(g.career, "boss").canPlay)) then
						do return g end
					end
					local next_ = M_lifeFlow.talkPick(t, Js.Number(arg))
					if (not M_lifeFlow.talkOver(next_)) then
						do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ bossTalk = next_ }, { "bossTalk" })) }, { "ui" })) end
					end
					local r = M_lifeFlow.talkResult(next_)
					do return Js.ospread(g, Js.O({ career = M_lifeFlow.relGameComplete(g.career, "boss", r), ui = Js.ospread(ui, Js.O({ life = nil, bossTalk = nil, lifeNote = (r.line .. " Manager " .. (if (r.gain >= 0) then "+" else "") .. Js.numstr(r.gain) .. ".") }, { "life", "bossTalk", "lifeNote" })) }, { "career", "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 16 then
				do
					local _d25 = S.split((if arg ~= nil then arg else ""), ":")
					local what = _d25[1]
					local id = _d25[2]
					local r = M_lifeFlow.sponsorAction(g.career, what, (if id ~= nil then id else ""), rng())
					do return Js.ospread(g, Js.O({ career = r.career, ui = Js.ospread(ui, Js.O({ life = (if (((what == "sign") or (what == "decline")) or (what == "walk")) then "sponsors" else ui.life), lifeNote = r.note }, { "life", "lifeNote" })) }, { "career", "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 17 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "train", trainSkill = arg, trainResult = nil }, { "tab", "trainSkill", "trainResult" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 18 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ tab = "train", trainSkill = nil, trainResult = nil }, { "tab", "trainSkill", "trainResult" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 19 then
				do
					local _d26 = S.split((if arg ~= nil then arg else ""), ":")
					local sk = _d26[1]
					local lv = _d26[2]
					do return (trainingDone(g, sk, Js.Number(lv), 2) or g) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 20 then
				do return M_flow.simMatch(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 21 then
				do return M_flow.simMatch(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 22 then
				do return M_flow.watchFromStands(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 23 then
				do return M_flow.youthWeek(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 24 then
				do return M_flow.youthPromotion(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 25 then
				do return M_flow.postMatchContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 26 then
				do return M_flow.drawContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 27 then
				do return M_flow.knockoutContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 28 then
				do return M_flow.playoffContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 29 then
				do return M_flow.deadlineDayContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 30 then
				do return M_flow.callUpContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 31 then
				do return M_flow.endSeason(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 32 then
				do return M_flow.ballonDorContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 33 then
				do return M_flow.playOn(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 34 then
				do return M_flow.retireNow(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 35 then
				do return (if (g.phase == "trial") then simTrial(g) else g) end
			end
			if _ci23 ~= 0 and _ci23 <= 36 then
				do
					if (g.phase ~= "manager-talk") then
						do return g end
					end
					local signed = M_trialFlow.acceptManagerOffer(g.career)
					if signed then
						do return Js.ospread(g, Js.O({ career = signed, phase = "trial-reward" }, { "career", "phase" })) end
					end
					local youth = M_trialFlow.youthAfterTrial(g.career)
					do return (if youth then Js.ospread(M_flow.afterSigning(Js.ospread(g, Js.O({ career = youth }, { "career" }))), Js.O({ ui = ui }, { "ui" })) else g) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 37 then
				do return (if (g.phase == "trial-reward") then Js.ospread(M_flow.afterSigning(g), Js.O({ ui = Js.ospread(ui, Js.O({ tab = "home" }, { "tab" })) }, { "ui" })) else g) end
			end
			if _ci23 ~= 0 and _ci23 <= 38 then
				do return M_flow.seasonAwardsContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 39 then
				do return M_flow.ladderContinue(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 40 then
				do return M_flow.stayPut(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 41 then
				do return M_flow.signingDone(g) end
			end
			if _ci23 ~= 0 and _ci23 <= 42 then
				do return M_flow.chooseTransfer(g, (if g.transferOffers ~= nil then g.transferOffers else Js.alit())[Js.Number(arg) + 1]) end
			end
			if _ci23 ~= 0 and _ci23 <= 43 then
				do return Js.ospread(g, Js.O({ phase = "contract-renewal", contractOfferReason = nil, ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "phase", "contractOfferReason", "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 44 then
				do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ renewal = Js.O({ current = (3 + math.floor((rng() * 8))), next = nil, wins = 0, locked = false, rounds = 0, message = "", started = true }, { "current", "next", "wins", "locked", "rounds", "message", "started" }) }, { "renewal" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 45 then
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
			if _ci23 ~= 0 and _ci23 <= 46 then
				do
					local r = ui.renewal
					local offer = M_flow.renewalOffer(g, ((function() local _v = r; if _v == nil then return nil end; _v = _v.wins; return _v end)() or 0), (function() local _l = (function() local _v = r; if _v == nil then return nil end; _v = _v.locked; return _v end)(); if _l ~= nil then return _l end; return false end)(), ((function() local _v = r; if _v == nil then return nil end; _v = _v.rounds; return _v end)() or 0))
					do return Js.ospread(M_flow.contractComplete(g, offer), Js.O({ ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 47 then
				do return Js.ospread(M_flow.contractComplete(g, nil), Js.O({ ui = Js.ospread(ui, Js.O({ renewal = nil }, { "renewal" })) }, { "ui" })) end
			end
			if _ci23 ~= 0 and _ci23 <= 48 then
				do
					local _d27 = A.map(S.split((if arg ~= nil then arg else "0:0"), ":"), Js.Number)
					local li = _d27[1]
					local ci = _d27[2]
					local offer = ((M_flow.transferInterest(g).leagues)[li + 1].clubs)[ci + 1].offer
					local talk = M_negotiation.startNegotiation(offer.wage, "selling", rng)
					do return Js.ospread(M_flow.transferNegotiate(g, offer), Js.O({ ui = Js.ospread(ui, Js.O({ talk = talk, ask = talk.yourPosition }, { "talk", "ask" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 49 then
				do
					local a = ((if ui.ask ~= nil then ui.ask else (function() local _v = ui.talk; if _v == nil then return nil end; _v = _v.yourPosition; return _v end)()) or 0)
					local dir = (if (Js.Number(arg) < 0) then -1 else 1)
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ ask = Math.max(1, (a + (dir * niceStep((if (dir < 0) then (a - 1) else a))))) }, { "ask" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 50 then
				do
					if (not ui.talk) then
						do return g end
					end
					local t = M_negotiation.makeOffer(ui.talk, Math.max(1, Math.round((if ui.ask ~= nil then ui.ask else ui.talk.yourPosition))), rng)
					do return Js.ospread(g, Js.O({ ui = Js.ospread(ui, Js.O({ talk = t }, { "talk" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 51 then
				do
					local t = ui.talk
					local r = M_flow.transferTalkDone(g, (if (t and (t.status == "accepted")) then (if t.finalPrice ~= nil then t.finalPrice else nil) else nil))
					do return Js.ospread(r, Js.O({ ui = Js.ospread(ui, Js.O({ talk = nil }, { "talk" })) }, { "ui" })) end
				end
			end
			if _ci23 ~= 0 and _ci23 <= 52 then
				do return Js.ospread(M_flow.transferTalkDone(g, nil), Js.O({ ui = Js.ospread(ui, Js.O({ talk = nil }, { "talk" })) }, { "ui" })) end
			end
		until true
		do return g end
	end
	TABS = Js.alit(Js.alit("home", "Home"), Js.alit("train", "Train"), Js.alit("life", "Life"), Js.alit("league", "League"), Js.alit("fixtures", "Fixtures"), Js.alit("stats", "Stats"))
	TAB_FEATURE = Js.O({ train = "training", league = "league", fixtures = "league", stats = "stats" }, { "train", "league", "fixtures", "stats" })
	tabOpen = function(c, id)
		return ((not Js.T(TAB_FEATURE[id])) or M_unlocks.isOpen(c, TAB_FEATURE[id]))
	end
	BEAT_GOES = Js.O({ training = Js.O({ tab = "train" }, { "tab" }), can = Js.O({ tab = "life" }, { "tab" }), phone = Js.O({ tab = "life" }, { "tab" }), shop = Js.O({ tab = "life", life = "cans" }, { "tab", "life" }), stats = Js.O({ tab = "stats" }, { "tab" }), sponsor = Js.O({ tab = "life", life = "sponsors" }, { "tab", "life" }) }, { "training", "can", "phone", "shop", "stats", "sponsor" })
	DIVISIONS = Js.alit("premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south")
	exports.DIVISIONS = DIVISIONS
	REL_KIND = Js.O({ woodwork = "team", penalties = "boss", session = "boss", signing = "fans" }, { "woodwork", "penalties", "session", "signing" })
end
