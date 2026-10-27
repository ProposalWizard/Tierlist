--!nocheck
--!nolint
-- Generated from lib/star/media/graphics.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local M_season = import("lib/star/season")
	local M_recognition = import("lib/star/recognition")
	local M_potm = import("lib/star/potm")
	local M_updateFlags = import("lib/star/media/updateFlags")
	local M_calendar = import("lib/star/calendar")
	local M_fakeFaces = import("lib/star/fakeFaces")
	local clipsFor, synthFor, matchReel, buildGraphic, yourFace, matchContext, statRows, present, headlineFor, headlineFrom, pollQuestion, pollOptions
	clipsFor = function(e, r)
		if (not r) then
			do return Js.alit() end
		end
		local f = e.facts
		if ((type(f.club) == "string") and (f.club ~= r.club)) then
			do return Js.alit() end
		end
		if ((A.includes(e.tags, "manager") or (e.id == "cheeky-miss")) or (e.subject.kind == "manager")) then
			do return Js.alit() end
		end
		local seen = A.filter(r.goals, function(g)
			return g.clipId
		end)
		if (Js.alen(seen) == 0) then
			do return Js.alit() end
		end
		local ids = function(gs)
			return A.map(gs, function(g)
				return g.clipId
			end)
		end
		local minute = (if (type(f.minute) == "number") then f.minute else nil)
		if (minute ~= nil) then
			local g = A.find(seen, function(x)
				return ((x.minute == minute) and ((e.subject.kind ~= "you") or x.isUser))
			end)
			do return (if g then ids(Js.alit(g)) else Js.alit()) end
		end
		if (type(f.scorer) == "string") then
			do return ids(A.filter(seen, function(x)
				return (x.scorer == f.scorer)
			end)) end
		end
		if (e.subject.kind == "teammate") then
			do return ids(A.filter(seen, function(x)
				return ((not x.isUser) and (x.scorer == e.subject.name))
			end)) end
		end
		if ((e.subject.kind == "you") and A.includes(e.tags, "goal")) then
			do return ids(A.filter(seen, function(x)
				return x.isUser
			end)) end
		end
		do return ids(seen) end
	end
	exports.clipsFor = clipsFor
	synthFor = function(e, r)
		local raw = e.facts.goalVideos
		if (type(raw) ~= "string") then
			do return Js.alit() end
		end
		if (r and (e.facts.club == r.club)) then
			do return Js.alit() end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			local list = Js.JSON.parse(raw)
			do return Js.RET, (if Js.Array.isArray(list) then A.slice(A.filter(list, function(g)
				return (g and (type(g.seed) == "string"))
			end), 0, 4) else Js.alit()) end
		end)
		if not _ok1 then
			do return Js.alit() end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.synthFor = synthFor
	matchReel = function(r, which, you)
		local home = (if r.home then r.club else r.opponent)
		local away = (if r.home then r.opponent else r.club)
		local last = function(n)
			return (function() local _l = A.pop(S.split(S.trim(n), Js.re("\\s+", ""))); if Js.T(_l) then return _l end; return n end)()
		end
		local clips = Js.alit()
		local synth = Js.alit()
		local ours = A.filter(r.goals, function(g)
			return (((which == "all") or g.isUser) or ((not (not Js.T(you))) and (g.assist == you)))
		end)
		do
			local _arr4 = ours
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local g = _arr4[_i5]
				if Js.T(g.clipId) then
					A.push(clips, g.clipId)
					do continue end
				end
				local sa = g.scoreAfter
				A.push(synth, Js.ospread(Js.O({ home = home, away = away, scorer = g.scorer, scorerShort = last(g.scorer), scorerHome = r.home, minute = g.minute }, { "home", "away", "scorer", "scorerShort", "scorerHome", "minute" }), (if sa then Js.O({ scoreAfter = (if r.home then Js.alit(sa.us, sa.them) else Js.alit(sa.them, sa.us)) }, { "scoreAfter" }) else Js.O({}, nil)), Js.O({ seed = (Js.numstr(r.season) .. "." .. Js.numstr(r.week) .. "u" .. Js.numstr(g.minute) .. last(g.scorer)) }, { "seed" })))
			end
		end
		if (which == "all") then
			do
				local _arr6 = (if r.oppGoals ~= nil then r.oppGoals else Js.alit())
				local _i7 = 0
				while _i7 < Js.alen(_arr6) do
					_i7 += 1
					local g = _arr6[_i7]
					local name = (if Js.T(g.scorer) then g.scorer else r.opponent)
					A.push(synth, Js.O({ home = home, away = away, scorer = name, scorerShort = (if Js.T(g.scorer) then last(g.scorer) else r.opponent), scorerHome = (not r.home), minute = g.minute, seed = (Js.numstr(r.season) .. "." .. Js.numstr(r.week) .. "t" .. Js.numstr(g.minute)) }, { "home", "away", "scorer", "scorerShort", "scorerHome", "minute", "seed" }))
				end
			end
		end
		do return Js.O({ clips = clips, synth = synth }, { "clips", "synth" }) end
	end
	exports.matchReel = matchReel
	buildGraphic = function(kind, e, r, career, memory, rng)
		local f = e.facts
		local you = (career.player.firstName .. " " .. career.player.lastName)
		local _sw8 = kind
		local _ci9 = (if _sw8 == "scoreline" then 1 elseif _sw8 == "breaking" then 2 elseif _sw8 == "playerCard" then 3 elseif _sw8 == "statLine" then 4 elseif _sw8 == "tableSnippet" then 5 elseif _sw8 == "topScorers" then 6 elseif _sw8 == "potmNominees" then 7 elseif _sw8 == "potmWinner" then 8 elseif _sw8 == "hatTrick" then 9 elseif _sw8 == "transfer" then 10 elseif _sw8 == "trophy" then 11 elseif _sw8 == "poll" then 12 elseif _sw8 == "thumbnail" then 13 elseif _sw8 == "goalVideo" then 14 elseif _sw8 == "teamOfTheWeek" then 15 else 0)
		local _cont10 = false
		repeat
			if _ci9 ~= 0 and _ci9 <= 1 then
				do
					if (not r) then
						do return nil end
					end
					local home = (if r.home then r.club else r.opponent)
					local away = (if r.home then r.opponent else r.club)
					local ours = A.map(M_grammar.groupedGoalLines(r.goals, function(g)
						return M_grammar.surname(g.scorer)
					end, function(g)
						return g.minute
					end), function(_p11)
						local scorer = _p11.scorer
						local minutes = _p11.minutes
						return (scorer .. " " .. A.join(A.map(minutes, function(m)
							return (Js.numstr(m) .. "'")
						end), ", "))
					end)
					do return Js.O({ ["type"] = "scoreline", home = home, away = away, hs = (if r.home then r.score.us else r.score.them), as = (if r.home then r.score.them else r.score.us), competition = r.competition, homeScorers = (if r.home then ours else Js.alit()), awayScorers = (if r.home then Js.alit() else ours) }, { "type", "home", "away", "hs", "as", "competition", "homeScorers", "awayScorers" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 2 then
				do return Js.O({ ["type"] = "breaking", strapline = M_grammar.pick(Js.alit("BREAKING", "JUST IN", "CONFIRMED", "DEVELOPING"), rng), headline = Js.str((if f.headline ~= nil then f.headline else headlineFor(e, you))) }, { "type", "strapline", "headline" }) end
			end
			if _ci9 ~= 0 and _ci9 <= 3 then
				do
					local rows = Js.alit(Js.O({ label = "Goals", value = Js.str((function() local _l = (if f.goals ~= nil then f.goals else (function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.goals; return _v end)()); if _l ~= nil then return _l end; return 0 end)()), highlight = (Js.Number((if f.goals ~= nil then f.goals else 0)) > 0) }, { "label", "value", "highlight" }), Js.O({ label = "Assists", value = Js.str((function() local _l = (if f.assists ~= nil then f.assists else (function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.assists; return _v end)()); if _l ~= nil then return _l end; return 0 end)()) }, { "label", "value" }), Js.O({ label = "Season", value = (Js.numstr(((function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.seasonGoals; return _v end)() or career.seasonStats.goals)) .. " G / " .. Js.numstr(((function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.seasonAssists; return _v end)() or career.seasonStats.assists)) .. " A") }, { "label", "value" }))
					do return Js.O({ ["type"] = "playerCard", name = you, number = (if career.squadNumber ~= nil then career.squadNumber else 0), position = career.player.position, rating = ((function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.rating; return _v end)() or 7), rows = rows, context = matchContext(r, e) }, { "type", "name", "number", "position", "rating", "rows", "context" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 4 then
				do
					local rows = statRows(e, r, memory)
					if (not Js.T(Js.alen(rows))) then
						do return nil end
					end
					local aboutYou = ((e.subject.kind == "you") or (e.subject.kind == "teammate"))
					do return Js.O({ ["type"] = "statLine", title = (if aboutYou then Js.str((if f.player ~= nil then f.player else you)) else Js.str((if f.club ~= nil then f.club else you))), rows = rows, context = matchContext(r, e) }, { "type", "title", "rows", "context" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 5 then
				do
					local sorted = M_season.sortLeague(career.league)
					local i = Math.max(0, A.findIndex(sorted, function(t)
						return (t.name == career.player.club)
					end))
					local from = Math.max(0, Math.min((i - 2), (Js.alen(sorted) - 5)))
					do return Js.O({ ["type"] = "tableSnippet", highlight = career.player.club, rows = A.map(A.slice(sorted, from, (from + 5)), function(t, k)
						return Js.O({ pos = ((from + k) + 1), name = t.name, played = t.played, gd = (t.goalsFor - t.goalsAgainst), points = t.points }, { "pos", "name", "played", "gd", "points" })
					end) }, { "type", "highlight", "rows" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 6 then
				do
					local isAssists = (e.id == "assist-king-race")
					local race = A.slice((if isAssists then M_recognition.assistRace(career) else M_recognition.goldenBootRace(career)), 0, 5)
					if (not Js.T(Js.alen(race))) then
						do return nil end
					end
					do return Js.O({ ["type"] = "topScorers", title = (if isAssists then "Assist King" else "Golden Boot"), highlight = you, rows = A.map(race, function(s)
						return Js.O({ label = (if s.isYou then you else s.name), value = Js.numstr(s.goals), highlight = s.isYou }, { "label", "value", "highlight" })
					end) }, { "type", "title", "highlight", "rows" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 7 then
				do
					if (not r) then
						do return nil end
					end
					local month = (function() local _v = r.potmRace; if _v == nil then return nil end; _v = _v.month; return _v end)()
					if (month == nil) then
						do return nil end
					end
					local race = A.slice(M_potm.monthRace(career, month), 0, 8)
					if (Js.alen(race) < 6) then
						do return nil end
					end
					do return Js.ospread(Js.O({ ["type"] = "potmNominees", month = M_potm.MONTH_NAMES[month + 1] }, { "type", "month" }), (if M_updateFlags.labelFixesOn() then Js.O({ league = M_calendar.leagueNameFor(M_calendar.divisionOf(career)) }, { "league" }) else Js.O({}, nil)), Js.O({ nominees = A.map(race, function(c)
						return Js.ospread(Js.O({ name = c.name, club = c.club, goals = c.goals, assists = c.assists, isYou = c.isYou }, { "name", "club", "goals", "assists", "isYou" }), (if c.isYou then yourFace(career) else Js.O({ face = M_potm.faceOf(career, c.name, c.club) }, { "face" })), Js.O({ id = (if c.isYou then "you" else ((function() local _v = M_potm.playerOf(career, c.name, c.club); if _v == nil then return nil end; _v = _v.id; return _v end)() or (c.club .. "|" .. c.name))) }, { "id" }))
					end) }, { "nominees" })) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 8 then
				do
					local month = Js.str((if f.month ~= nil then f.month else ""))
					local isYou = (e.id == "potm-won")
					local filed = (if isYou then career.player.lastName else Js.str((if f.winner ~= nil then f.winner else "")))
					local club = (if isYou then career.player.club else Js.str((if f.winnerClub ~= nil then f.winnerClub else career.player.club)))
					if ((not Js.T(month)) or (not Js.T(filed))) then
						do return nil end
					end
					local known = (if isYou then nil else M_potm.playerOf(career, filed, club))
					local full = (if isYou then (career.player.firstName .. " " .. career.player.lastName) else ((function() local _v = known; if _v == nil then return nil end; _v = _v.name; return _v end)() or filed))
					local parts = S.split(S.trim(full), Js.re("\\s+", ""))
					local lastName = parts[Js.alen(parts)]
					local head = A.join(A.slice(parts, 0, -1), " ")
					local firstName = (if Js.re("^[A-Z]\\.?$", ""):test(head) then "" else head)
					do return Js.ospread(Js.O({ ["type"] = "potmWinner", month = month, firstName = firstName, lastName = lastName, club = club, goals = Js.Number((if f.goals ~= nil then f.goals else 0)), assists = Js.Number((if f.assists ~= nil then f.assists else 0)), isYou = isYou }, { "type", "month", "firstName", "lastName", "club", "goals", "assists", "isYou" }), (if isYou then yourFace(career) else Js.O({ face = (function() local _v = known; if _v == nil then return nil end; _v = _v.image; return _v end)() }, { "face" })), Js.O({ id = (if isYou then "you" else ((function() local _v = known; if _v == nil then return nil end; _v = _v.id; return _v end)() or (club .. "|" .. filed))) }, { "id" }), (if ((not isYou) and (f.place ~= nil)) then Js.O({ yourPlace = Js.Number(f.place) }, { "yourPlace" }) else Js.O({}, nil))) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 9 then
				do
					local minutes = A.map(A.filter(((function() local _v = r; if _v == nil then return nil end; _v = _v.goals; return _v end)() or Js.alit()), function(g)
						return g.isUser
					end), function(g)
						return g.minute
					end)
					if (Js.alen(minutes) < 3) then
						do return nil end
					end
					do return Js.O({ ["type"] = "hatTrick", name = you, minutes = minutes }, { "type", "name", "minutes" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 10 then
				if ((not Js.T(f.to)) and (not Js.T(f.club))) then
					do return nil end
				end
				do return Js.O({ ["type"] = "transfer", player = you, from = Js.str((if f.from ~= nil then f.from else career.player.club)), to = Js.str((function() local _l = (if f.to ~= nil then f.to else f.club); if _l ~= nil then return _l end; return career.player.club end)()), fee = (if Js.T(f.feeText) then Js.str(f.feeText) else nil) }, { "type", "player", "from", "to", "fee" }) end
			end
			if _ci9 ~= 0 and _ci9 <= 11 then
				do return Js.O({ ["type"] = "trophy", competition = Js.str((if f.competition ~= nil then f.competition else (if M_updateFlags.labelFixesOn() then ((function() local _v = r; if _v == nil then return nil end; _v = _v.competition; return _v end)() or M_calendar.leagueNameFor(M_calendar.divisionOf(career))) else "Premier League"))), club = Js.str((if f.club ~= nil then f.club else career.player.club)), season = Js.Number((if f.season ~= nil then f.season else career.season)) }, { "type", "competition", "club", "season" }) end
			end
			if _ci9 ~= 0 and _ci9 <= 12 then
				do
					local options = pollOptions(e, career, rng)
					if (Js.alen(options) < 2) then
						do return nil end
					end
					local votes = A.map(options, function()
						return (5 + math.floor((rng() * 60)))
					end)
					do return Js.O({ ["type"] = "poll", question = pollQuestion(e), options = options, votes = votes }, { "type", "question", "options", "votes" }) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 13 then
				do
					local clips = clipsFor(e, r)
					local synth = (if Js.T(Js.alen(clips)) then Js.alit() else synthFor(e, r))
					local n = (if Js.T(Js.alen(clips)) then Js.alen(clips) else Js.alen(synth))
					do return Js.ospread(Js.O({ ["type"] = "thumbnail", title = S.toUpperCase(headlineFor(e, you)), badge = (if (n > 1) then "HIGHLIGHTS" else (if A.includes(e.tags, "goal") then "GOAL" else (if A.includes(e.tags, "shame") then "REACTION" else "HIGHLIGHTS"))) }, { "type", "title", "badge" }), (if Js.T(Js.alen(clips)) then Js.O({ clips = clips }, { "clips" }) else Js.O({}, nil)), (if Js.T(Js.alen(synth)) then Js.O({ synth = synth }, { "synth" }) else Js.O({}, nil))) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 14 then
				do
					local clips = clipsFor(e, r)
					local synth = (if Js.T(Js.alen(clips)) then Js.alit() else synthFor(e, r))
					if ((not Js.T(Js.alen(clips))) and (not Js.T(Js.alen(synth)))) then
						do return nil end
					end
					do return Js.ospread(Js.O({ ["type"] = "goalVideo", title = S.toUpperCase(headlineFor(e, you)), clips = clips }, { "type", "title", "clips" }), (if Js.T(Js.alen(synth)) then Js.O({ synth = synth }, { "synth" }) else Js.O({}, nil))) end
				end
			end
			if _ci9 ~= 0 and _ci9 <= 15 then
				do
					local squad = (if career.squad ~= nil then career.squad else Js.alit())
					if (Js.alen(squad) < 6) then
						do return nil end
					end
					local picks = A.map(A.slice(squad, 0, 5), function(p)
						return Js.O({ name = p.name, position = p.position, note = (Js.numstr(p.seasonGoals) .. "G " .. Js.numstr(p.seasonAssists) .. "A"), isYou = false }, { "name", "position", "note", "isYou" })
					end)
					do return Js.O({ ["type"] = "teamOfTheWeek", formation = "4-3-3", players = Js.aspread(Js.alit(Js.O({ name = you, position = career.player.position, note = (Js.numstr(((function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.goals; return _v end)() or 0)) .. "G " .. Js.numstr(((function() local _v = r; if _v == nil then return nil end; _v = _v.you; _v = _v.assists; return _v end)() or 0)) .. "A"), isYou = true }, { "name", "position", "note", "isYou" })), picks) }, { "type", "formation", "players" }) end
				end
			end
		until true
		do return nil end
	end
	exports.buildGraphic = buildGraphic
	yourFace = function(career)
		local portrait = career.player.portrait
		if (not Js.T(portrait)) then
			do return Js.O({ number = (if career.squadNumber ~= nil then career.squadNumber else 0) }, { "number" }) end
		end
		do return (if A.includes(M_fakeFaces.FAKE_FACES, portrait) then Js.O({ face = portrait }, { "face" }) else Js.O({ face = portrait, own = true }, { "face", "own" })) end
	end
	exports.yourFace = yourFace
	matchContext = function(r, e)
		local over = (function() local _v = e; if _v == nil then return nil end; _v = _v.facts; _v = _v.matches; return _v end)()
		if (over ~= nil) then
			local n = Js.Number(over)
			do return (if (Js.NumberNS.isFinite(n) and (n > 1)) then ("Last " .. Js.numstr(n) .. " matches") else nil) end
		end
		if (not r) then
			do return nil end
		end
		do return ("v " .. r.opponent .. " (" .. (if r.home then "H" else "A") .. ")") end
	end
	statRows = function(e, r, _memory)
		local f = e.facts
		local rows = Js.alit()
		if (f.goals ~= nil) then
			A.push(rows, Js.O({ label = "Goals", value = Js.str(f.goals), highlight = true }, { "label", "value", "highlight" }))
		end
		if (f.assists ~= nil) then
			A.push(rows, Js.O({ label = "Assists", value = Js.str(f.assists) }, { "label", "value" }))
		end
		if (f.matches ~= nil) then
			A.push(rows, Js.O({ label = "Over", value = (Js.str(f.matches) .. " match" .. (if (Js.Number(f.matches) == 1) then "" else "es")) }, { "label", "value" }))
		end
		if (f.milestone ~= nil) then
			A.push(rows, Js.O({ label = "Milestone", value = Js.str(f.milestone), highlight = true }, { "label", "value", "highlight" }))
		end
		if (f.average ~= nil) then
			A.push(rows, Js.O({ label = "Avg rating", value = Js.str(f.average) }, { "label", "value" }))
		end
		if ((Js.alen(rows) == 1) and (rows[1].label == "Over")) then
			local label = (if S.includes(e.id, "clean-sheet") then "Clean sheets" else (if S.includes(e.id, "drought") then "Without a goal" else (if S.includes(e.id, "losing") then "Without a win" else (if S.includes(e.id, "winning") then "Wins in a row" else "Unbeaten"))))
			A.set(rows, 0, Js.O({ label = label, value = Js.str(f.matches), highlight = true }, { "label", "value", "highlight" }))
		end
		if ((Js.alen(rows) == 0) and r) then
			A.push(rows, Js.O({ label = "Rating", value = N.toFixed(r.you.rating, 1), highlight = (r.you.rating >= 8) }, { "label", "value", "highlight" }))
			A.push(rows, Js.O({ label = "Season", value = (Js.numstr(r.you.seasonGoals) .. " G / " .. Js.numstr(r.you.seasonAssists) .. " A") }, { "label", "value" }))
		end
		do return A.slice(rows, 0, 4) end
	end
	present = function(v)
		do return ((((v ~= nil) and (v ~= nil)) and (v ~= "")) and (not ((type(v) == "number") and (not Js.NumberNS.isFinite(v))))) end
	end
	headlineFor = function(e, you)
		local line = headlineFrom(e, you)
		if (not Js.re("undefined|NaN|null", ""):test(line)) then
			do return line end
		end
		local f = e.facts
		local short = Js.str((if f.short ~= nil then f.short else M_grammar.surname(you)))
		if present(f.headline) then
			do return Js.str(f.headline) end
		end
		if A.includes(e.tags, "goal") then
			do return ((if present(f.scorer) then M_grammar.surname(Js.str(f.scorer)) else short) .. " scores") end
		end
		if A.includes(e.tags, "transfer") then
			do return "Transfer news" end
		end
		if A.includes(e.tags, "manager") then
			do return "Manager news" end
		end
		do return (if present(f.club) then Js.str(f.club) else short) end
	end
	headlineFrom = function(e, you)
		local f = e.facts
		local short = Js.str((if f.short ~= nil then f.short else M_grammar.surname(you)))
		local _sw12 = e.id
		if _sw12 == "hat-trick" then
			do return (short .. " hat-trick") end
		elseif _sw12 == "four-goals" then
			do return (short .. " scores four") end
		elseif _sw12 == "five-goals" then
			do return (short .. " scores five") end
		elseif _sw12 == "late-winner" then
			do return (short .. " wins it at " .. Js.str(f.minute)) end
		elseif _sw12 == "screamer" then
			do return (Js.str(f.distance) .. "-yard strike") end
		elseif _sw12 == "trophy" or _sw12 == "champions" then
			do return (Js.str(f.club) .. " are champions") end
		elseif _sw12 == "relegated" then
			do return (Js.str(f.club) .. " relegated") end
		elseif _sw12 == "transfer-done" then
			do return (short .. " joins " .. Js.str(f.to)) end
		elseif _sw12 == "manager-sacked" then
			do return (Js.str(f.manager) .. " sacked") end
		elseif _sw12 == "derby-win" then
			do return "Derby won" end
		elseif _sw12 == "comeback" then
			do return (Js.str(f.deficit) .. " down and won") end
		elseif _sw12 == "award-won" then
			do return Js.str((if f.award ~= nil then f.award else (short .. " wins an award"))) end
		elseif _sw12 == "ballon-dor" then
			do return (short .. " wins the Ballon d'Or") end
		else
			do return (Js.str(f.club) .. " " .. Js.str(f.us) .. "-" .. Js.str(f.them) .. " " .. Js.str(f.opponent)) end
		end
	end
	pollQuestion = function(e)
		if A.includes(e.tags, "shame") then
			do return "Who's to blame?" end
		end
		if A.includes(e.tags, "manager") then
			do return "Right call?" end
		end
		if A.includes(e.tags, "goal") then
			do return "Goal of the season so far?" end
		end
		do return "Your verdict?" end
	end
	pollOptions = function(e, career, rng)
		local you = career.player.lastName
		if A.includes(e.tags, "shame") then
			do return Js.alit("The manager", "The players", "The board", "All of it") end
		end
		if A.includes(e.tags, "manager") then
			do return Js.alit("Long overdue", "Harsh", "Too late") end
		end
		if A.includes(e.tags, "goal") then
			do return Js.alit(you, "Someone else", "Not even close") end
		end
		do return Js.alit("Deserved it", "Got away with it", "Nothing in it") end
	end
end
