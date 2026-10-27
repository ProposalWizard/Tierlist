--!nocheck
--!nolint
-- Generated from lib/star/media/feed.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_memory = import("lib/star/media/memory")
	local M_record = import("lib/star/media/record")
	local M_index = import("lib/star/media/detect/index")
	local M_importance = import("lib/star/media/importance")
	local M_schedule = import("lib/star/media/schedule")
	local M_updateFlags = import("lib/star/media/updateFlags")
	local M_goalOfMonth = import("lib/star/media/goalOfMonth")
	local M_fame = import("lib/star/fame")
	local M_accounts = import("lib/star/media/accounts")
	local M_grammar = import("lib/star/media/grammar")
	local M_money = import("lib/star/money")
	local M_calendar = import("lib/star/calendar")
	local M_league = import("lib/star/media/detect/league")
	local M_season = import("lib/star/season")
	local M_wonderkids = import("lib/star/media/detect/wonderkids")
	local M_tuningStore = import("lib/star/tuningStore")
	local M_retirements = import("lib/star/media/detect/retirements")
	local M_retirementNews = import("lib/star/retirementNews")
	local M_select = import("lib/star/media/select")
	local M_trending = import("lib/star/media/trending")
	local M_graphics = import("lib/star/media/graphics")
	local M_narrate = import("lib/star/media/narrate")
	local M_index_2 = import("lib/star/media/templates/index")
	local POST_CAP, emptyMedia, mediaOf, toggleLike, alreadySeen, SEEN_CAP, withSeen, generateForMatch, generateForCareer, CAP_MILESTONES, generateForInternational, generateForCallUp, generateForBoardroomSale, generateForLeagueWeek, generateForRollover, commit, MAX_VIDEOS_PER_MATCH, hasVideo, capVideos, highlightPosts, render, feedFor, WEEK_SPAN, pinHighlights, hasFreshMedia, unreadCount
	emptyMedia = function()
		do return Js.O({ posts = Js.alit(), memory = M_memory.emptyMemory(), trends = Js.alit(), lastCycleId = "", lastCycleClock = 0, seenCycleIds = Js.alit() }, { "posts", "memory", "trends", "lastCycleId", "lastCycleClock", "seenCycleIds" }) end
	end
	exports.emptyMedia = emptyMedia
	mediaOf = function(career)
		do return (if career.media ~= nil then career.media else emptyMedia()) end
	end
	exports.mediaOf = mediaOf
	toggleLike = function(career, postId)
		if (not career.media) then
			do return career end
		end
		local posts = A.map(career.media.posts, function(p)
			return (if (p.id == postId) then Js.ospread(p, Js.O({ liked = (not p.liked) }, { "liked" })) else p)
		end)
		do return Js.ospread(career, Js.O({ media = Js.ospread(career.media, Js.O({ posts = posts }, { "posts" })) }, { "media" })) end
	end
	exports.toggleLike = toggleLike
	alreadySeen = function(state, id)
		do return A.includes((if state.seenCycleIds ~= nil then state.seenCycleIds else Js.alit()), id) end
	end
	withSeen = function(state, id)
		do return A.slice(Js.aspread((if state.seenCycleIds ~= nil then state.seenCycleIds else Js.alit()), Js.alit(id)), (-SEEN_CAP)) end
	end
	generateForMatch = function(before, after, fixture, stats)
		local state = mediaOf(before)
		local record = M_record.buildMatchRecord(before, after, fixture, stats)
		if ((state.lastCycleId == record.id) or alreadySeen(state, record.id)) then
			do return state end
		end
		local withMatch = M_memory.absorbMatch(M_memory.coolThreads(state.memory), record)
		local detected = M_index.detectMatch(record, withMatch)
		local scored = M_importance.scoreMatchEvents(detected, record, withMatch)
		local _d1 = M_memory.absorbEvents(withMatch, scored, Js.O({ season = record.season, week = record.week }, { "season", "week" }))
		local withEvents = _d1.memory
		local events = _d1.events
		local clock = M_schedule.clockAt(record.season, record.week, 0)
		local committed = commit(after, state, record, events, withEvents, record.id, clock)
		do return (if M_updateFlags.goalOfMonthOn() then M_goalOfMonth.goalOfMonthAfterMatch(committed, before, after, fixture, stats, record, clock) else committed) end
	end
	exports.generateForMatch = generateForMatch
	generateForCareer = function(career, moment, key)
		local state = mediaOf(career)
		local id = ("s" .. Js.numstr(career.season) .. "-w" .. Js.numstr(career.week) .. "-" .. key)
		if ((state.lastCycleId == id) or alreadySeen(state, id)) then
			do return state end
		end
		local record = Js.O({ id = id, season = career.season, week = career.week, club = career.player.club, you = Js.O({ name = (career.player.firstName .. " " .. career.player.lastName), shortName = career.player.lastName, position = career.player.position, squadNumber = (if career.squadNumber ~= nil then career.squadNumber else 0) }, { "name", "shortName", "position", "squadNumber" }), context = Js.O({ fame = M_fame.fameOf(career), starRating = career.starRating, fansStanding = career.relationships.fans }, { "fame", "starRating", "fansStanding" }), moment = moment }, { "id", "season", "week", "club", "you", "context", "moment" })
		local cooled = M_memory.coolThreads(state.memory)
		local detected = M_index.detectCareer(record, cooled)
		local scored = M_importance.scoreCareerEvents(detected, cooled, M_fame.fameOf(career))
		local _d2 = M_memory.absorbEvents(cooled, scored, Js.O({ season = career.season, week = career.week }, { "season", "week" }))
		local memory = _d2.memory
		local events = _d2.events
		do return commit(career, state, nil, events, memory, id, M_schedule.clockAt(career.season, career.week, 0)) end
	end
	exports.generateForCareer = generateForCareer
	generateForInternational = function(before, after, fixture, stats, nation, nationKit, nationStrength)
		if nationStrength == nil then nationStrength = 75 end
		local state = mediaOf(before)
		local table_ = function(name, strength)
			return Js.O({ name = name, strength = strength, played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }, { "name", "strength", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "points" })
		end
		local league = Js.alit(table_(nation, nationStrength), table_(fixture.opponent, (if fixture.opponentStrength ~= nil then fixture.opponentStrength else 70)))
		local stand = function(c)
			return Js.ospread(c, Js.O({ player = Js.ospread(c.player, Js.O({ club = nation }, { "club" })), league = league }, { "player", "league" }))
		end
		local record = M_record.buildMatchRecord(stand(before), stand(after), fixture, stats)
		if ((state.lastCycleId == record.id) or alreadySeen(state, record.id)) then
			do return state end
		end
		local us = stats.homeScore
		local them = stats.awayScore
		local home = (if fixture.home then nation else fixture.opponent)
		local away = (if fixture.home then fixture.opponent else nation)
		local hs = (if fixture.home then us else them)
		local as = (if fixture.home then them else us)
		local pens = (if stats.shootout then (" (" .. Js.numstr(stats.shootout.home) .. "-" .. Js.numstr(stats.shootout.away) .. " pens)") else (if stats.wentToExtraTime then " (aet)" else ""))
		local name = (after.player.firstName .. " " .. after.player.lastName)
		local competition = (if Js.T(fixture.round) then (Js.str(fixture.competition) .. " " .. S.replace(fixture.round, Js.re(" · Match \\d", ""), "")) else (if fixture.competition ~= nil then fixture.competition else "International"))
		local shared = Js.O({ club = nation, nation = nation, opponent = fixture.opponent, competition = competition, scoreline = (home .. " " .. Js.numstr(hs) .. "-" .. Js.numstr(as) .. " " .. away .. pens), player = name, short = after.player.lastName, season = after.season, week = fixture.week }, { "club", "nation", "opponent", "competition", "scoreline", "player", "short", "season", "week" })
		local won = ((us > them) or (((us == them) and (not (not stats.shootout))) and (if fixture.home then (stats.shootout.home > stats.shootout.away) else (stats.shootout.away > stats.shootout.home))))
		local result = (if won then "win" else (if ((us == them) and (not stats.shootout)) then "draw" else "loss"))
		local caps = (if after.caps ~= nil then after.caps else 0)
		local goalsBefore = (if before.internationalGoals ~= nil then before.internationalGoals else 0)
		local intlGoals = (if after.internationalGoals ~= nil then after.internationalGoals else goalsBefore)
		local you = Js.O({ kind = "you", name = name }, { "kind", "name" })
		local events = Js.alit(Js.O({ id = ("intl-" .. result), subject = Js.O({ kind = "club", name = nation }, { "kind", "name" }), baseImportance = 56, tags = Js.alit("international", "stat", "opinion"), facts = Js.ospread(shared, Js.O({ result = result }, { "result" })), window = "instant" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		if (((fixture.round == "Final") and ((function() local _v = after.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == after.season)) and (after.tournament.yourExit == "Winners")) then
			A.push(events, Js.O({ id = "intl-trophy", subject = Js.O({ kind = "club", name = nation }, { "kind", "name" }), baseImportance = 100, tags = Js.alit("international", "trophy"), facts = Js.ospread(shared, Js.O({ tournament = (if fixture.competition ~= nil then fixture.competition else "tournament") }, { "tournament" })), window = "instant" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		end
		if (caps == 1) then
			A.push(events, Js.O({ id = "intl-debut", subject = you, baseImportance = 74, tags = Js.alit("international", "debut", "milestone"), facts = Js.ospread(shared, Js.O({ caps = caps }, { "caps" })), window = "hour" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		elseif A.includes(CAP_MILESTONES, caps) then
			A.push(events, Js.O({ id = "intl-cap-milestone", subject = you, baseImportance = 70, tags = Js.alit("international", "milestone", "stat"), facts = Js.ospread(shared, Js.O({ caps = caps }, { "caps" })), window = "hour" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		elseif (caps > 1) then
			A.push(events, Js.O({ id = "intl-cap", subject = you, baseImportance = 30, tags = Js.alit("international", "stat"), facts = Js.ospread(shared, Js.O({ caps = caps }, { "caps" })), window = "hour" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		end
		if (stats.goals > 0) then
			A.push(events, Js.O({ id = (if (goalsBefore == 0) then "intl-first-goal" else "intl-goal"), subject = you, baseImportance = (if (goalsBefore == 0) then 80 else 64), tags = Js.alit("international", "goal", "stat"), facts = Js.ospread(shared, Js.O({ intlGoals = intlGoals }, { "intlGoals" })), window = "instant" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		end
		local cooled = M_memory.coolThreads(state.memory)
		local scored = M_importance.scoreCareerEvents(events, cooled, M_fame.fameOf(after))
		local _d3 = M_memory.absorbEvents(cooled, scored, Js.O({ season = after.season, week = fixture.week }, { "season", "week" }))
		local memory = _d3.memory
		local absorbed = _d3.events
		local world = A.map(A.filter(A.filter(Js.aspread(M_accounts.buildRoster(after), Js.alit(M_accounts.selfAccount(after))), function(a)
			return (((not a.allegiance) or (a.archetype == "fan")) or (a.id == "@self"))
		end), function(a)
			return (((a.archetype ~= "league") and (a.archetype ~= "competition")) and (a.archetype ~= "insider"))
		end), function(a)
			return (if a.allegiance then Js.ospread(a, Js.O({ allegiance = Js.O({ club = nation, polarity = 1 }, { "club", "polarity" }) }, { "allegiance" })) else a)
		end)
		local cast = Js.aspread(Js.alit(M_accounts.nationalTeamAccount(nation, nationKit, nationStrength)), world)
		do return commit(Js.ospread(after, Js.O({ player = Js.ospread(after.player, Js.O({ club = nation }, { "club" })) }, { "player" })), state, record, absorbed, memory, record.id, M_schedule.clockAt(record.season, record.week, 0), "club", nil, nil, cast) end
	end
	exports.generateForInternational = generateForInternational
	generateForCallUp = function(career, nation, callUps, month, key)
		local state = mediaOf(career)
		local id = ("s" .. Js.numstr(career.season) .. "-w" .. Js.numstr(career.week) .. "-" .. key)
		if ((state.lastCycleId == id) or alreadySeen(state, id)) then
			do return state end
		end
		local name = (career.player.firstName .. " " .. career.player.lastName)
		local event = Js.O({ id = (if (callUps <= 1) then "first-call-up" else "call-up"), subject = Js.O({ kind = "you", name = name }, { "kind", "name" }), baseImportance = (if (callUps <= 1) then 82 else 40), tags = Js.alit("international", "award"), facts = Js.O({ player = name, short = career.player.lastName, club = career.player.club, nation = nation, month = month, season = career.season, week = career.week }, { "player", "short", "club", "nation", "month", "season", "week" }), window = "instant" }, { "id", "subject", "baseImportance", "tags", "facts", "window" })
		local cooled = M_memory.coolThreads(state.memory)
		local scored = M_importance.scoreCareerEvents(Js.alit(event), cooled, M_fame.fameOf(career))
		local _d4 = M_memory.absorbEvents(cooled, scored, Js.O({ season = career.season, week = career.week }, { "season", "week" }))
		local memory = _d4.memory
		local events = _d4.events
		local allowed = Js.Set.new(Js.alit("club", "stats", "fan", "tabloid", "aggregator", "teammate"))
		do return commit(career, state, nil, events, memory, id, M_schedule.clockAt(career.season, career.week, 0), "club", allowed) end
	end
	exports.generateForCallUp = generateForCallUp
	generateForBoardroomSale = function(career, sellingClub, buyerClub, playerName, fee, key)
		local state = mediaOf(career)
		local id = ("s" .. Js.numstr(career.season) .. "-w" .. Js.numstr(career.week) .. "-" .. key)
		if ((state.lastCycleId == id) or alreadySeen(state, id)) then
			do return state end
		end
		local sellerFacts = Js.O({ player = playerName, short = M_grammar.surname(playerName), from = sellingClub, to = buyerClub, feeText = ("£" .. M_money.formatMoney(fee)), club = sellingClub, season = career.season, week = career.week }, { "player", "short", "from", "to", "feeText", "club", "season", "week" })
		local buyerFacts = Js.ospread(sellerFacts, Js.O({ club = buyerClub }, { "club" }))
		local events = Js.alit(Js.O({ id = "farewell", subject = Js.O({ kind = "club", name = sellingClub }, { "kind", "name" }), baseImportance = 62, tags = Js.alit("transfer"), facts = sellerFacts, window = "hour" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }), Js.O({ id = "unveiling", subject = Js.O({ kind = "club", name = buyerClub }, { "kind", "name" }), baseImportance = 74, tags = Js.alit("transfer"), facts = buyerFacts, window = "hour" }, { "id", "subject", "baseImportance", "tags", "facts", "window" }))
		local cooled = M_memory.coolThreads(state.memory)
		local scored = M_importance.scoreCareerEvents(events, cooled, M_fame.fameOf(career))
		local _d5 = M_memory.absorbEvents(cooled, scored, Js.O({ season = career.season, week = career.week }, { "season", "week" }))
		local memory = _d5.memory
		local absorbed = _d5.events
		do return commit(career, state, nil, absorbed, memory, id, M_schedule.clockAt(career.season, career.week, 0)) end
	end
	exports.generateForBoardroomSale = generateForBoardroomSale
	generateForLeagueWeek = function(career, weekResults, competitionName)
		local competition = (if competitionName ~= nil then competitionName else M_calendar.leagueNameFor(M_calendar.divisionOf(career)))
		local state = mediaOf(career)
		local week = ((function() local _v = weekResults[1]; if _v == nil then return nil end; _v = _v.week; return _v end)() or career.week)
		local id = ("s" .. Js.numstr(career.season) .. "-w" .. Js.numstr(week) .. "-leagueweek")
		if ((state.lastLeagueCycleId == id) or alreadySeen(state, id)) then
			do return state end
		end
		local events = M_league.detectLeagueWeek(weekResults, career.player.club, week, competition, career.season)
		local wonderkidRng = M_season.mulberry32(((career.season * 52631) + (week * 977)))
		local wonderkidPool = Js.aspread((if career.leagueSquads ~= nil then career.leagueSquads else Js.alit()), (if career.externalSquads ~= nil then career.externalSquads else Js.alit()))
		A.push(events, Js.unpack(M_wonderkids.detectWonderkidHype(wonderkidPool, week, career.season, wonderkidRng, M_tuningStore.getTuning("wonderkids.mediaChance"))))
		do return commit(career, state, nil, events, state.memory, id, M_schedule.clockAt(career.season, week, 0), "league") end
	end
	exports.generateForLeagueWeek = generateForLeagueWeek
	generateForRollover = function(career)
		local media = mediaOf(career)
		local finished = (career.season - 1)
		local own = career.player.club
		local division = Js.Set.new(A.map(career.league, function(t)
			return t.name
		end))
		local allowed = function(club)
			return Js.Set.new((if division:has(club) then Js.alit("club", "league", "stats", "fan", "teammate", "tabloid", "insider") else Js.alit("club", "stats", "fan", "teammate", "tabloid", "insider")))
		end
		local run = function(event, key, scope, maxPosts)
			local state = media
			local id = ("s" .. Js.numstr(career.season) .. "-w" .. Js.numstr(career.week) .. "-" .. key)
			if ((state.lastCycleId == id) or alreadySeen(state, id)) then
				do return end
			end
			local cooled = M_memory.coolThreads(state.memory)
			local scored = M_importance.scoreCareerEvents(Js.alit(event), cooled, M_fame.fameOf(career))
			media = commit(Js.ospread(career, Js.O({ media = state }, { "media" })), state, nil, scored, cooled, id, M_schedule.clockAt(career.season, career.week, 0), scope, allowed(Js.str((if event.facts.club ~= nil then event.facts.club else own))), maxPosts)
		end
		do
			local _arr6 = (if career.lastRetirements ~= nil then career.lastRetirements else Js.alit())
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local n = _arr6[_i7]
				run(M_retirements.retirementEvent(n, finished), ("retire-" .. n.id), (if n.own then "club" else "league"), (if n.own then 4 else 3))
			end
		end
		do
			local _arr8 = M_retirementNews.promisingRegens(career, own, finished)
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local n = _arr8[_i9]
				run(M_retirements.regenEvent(n, finished), ("regen-" .. n.id), (if n.own then "club" else "league"), 2)
			end
		end
		do return media end
	end
	exports.generateForRollover = generateForRollover
	commit = function(career, state, record, events, memory, cycleId, cycleClock, scope, onlyArchetypes, maxPosts, accountsOverride)
		if scope == nil then scope = "club" end
		local world = function()
			return (if accountsOverride ~= nil then accountsOverride else Js.aspread(M_accounts.buildRoster(career), Js.alit(M_accounts.selfAccount(career))))
		end
		local matchCycle = (if ((scope == "club") and record) then Js.O({ lastMatchCycleId = cycleId, lastMatchCycleClock = cycleClock }, { "lastMatchCycleId", "lastMatchCycleClock" }) else Js.O({}, nil))
		if (not Js.T(Js.alen(events))) then
			local seenCycleIds = withSeen(state, cycleId)
			if (scope == "league") then
				do return Js.ospread(state, Js.O({ memory = memory, lastLeagueCycleId = cycleId, seenCycleIds = seenCycleIds }, { "memory", "lastLeagueCycleId", "seenCycleIds" })) end
			end
			local extra = (if record then highlightPosts(career, record, world(), cycleId, cycleClock) else Js.alit())
			capVideos(extra, cycleId)
			local posts = (if Js.T(Js.alen(extra)) then A.slice(A.sort(Js.aspread(state.posts, extra), function(a, b)
				return (a.at - b.at)
			end), (-POST_CAP)) else state.posts)
			do return Js.ospread(state, Js.O({ posts = posts, memory = memory, lastCycleId = cycleId, lastCycleClock = cycleClock, seenCycleIds = seenCycleIds }, { "posts", "memory", "lastCycleId", "lastCycleClock", "seenCycleIds" }), matchCycle) end
		end
		local accounts = A.filter(world(), function(a)
			return ((not onlyArchetypes) or onlyArchetypes:has(a.archetype))
		end)
		local pairings = A.slice(M_select.selectPairings(events, accounts, cycleId, career.player.club), 0, (if maxPosts ~= nil then maxPosts else Js.NumberNS.POSITIVE_INFINITY))
		local posts = Js.alit()
		local used = Js.alit()
		local usedThisCycle = Js.Set.new()
		local recentText = Js.Set.new(A.map(A.slice(state.posts, -24), function(p)
			return p.text
		end))
		local graphicKinds = Js.Set.new()
		local polls = 0
		for slot = 0, (Js.alen(pairings)) - 1 do
			local p = pairings[slot + 1]
			local made = render(p, career, record, memory, cycleId, usedThisCycle, slot)
			if (not made) then
				do continue end
			end
			if recentText:has(made.post.text) then
				do continue end
			end
			local gType = (function() local _v = made.post.graphic; if _v == nil then return nil end; _v = _v["type"]; return _v end)()
			if Js.T(gType) then
				local isPoll = ((gType == "poll") or (gType == "gotmPoll"))
				if (isPoll and (polls >= 1)) then
					do continue end
				end
				local key = (if isPoll then "poll" else (gType .. "|" .. (if made.post.eventId ~= nil then made.post.eventId else "")))
				if graphicKinds:has(key) then
					do continue end
				end
				graphicKinds:add(key)
				if isPoll then
					polls += 1
				end
			end
			recentText:add(made.post.text)
			usedThisCycle:add(made.templateId)
			A.push(posts, Js.ospread(made.post, Js.O({ scope = scope }, { "scope" })))
			A.push(used, made.templateId)
		end
		if ((scope == "club") and record) then
			A.push(posts, Js.unpack(highlightPosts(career, record, accounts, cycleId, cycleClock)))
		end
		capVideos(posts, cycleId)
		local trends = M_trending.buildTrends(events, posts, cycleId, M_fame.fameOf(career))
		local all = A.slice(A.sort(Js.aspread(state.posts, posts), function(a, b)
			return (a.at - b.at)
		end), (-POST_CAP))
		do return Js.ospread(Js.O({ posts = all, memory = M_memory.markSaid(memory, used), trends = (if Js.T(Js.alen(trends)) then trends else state.trends), seenCycleIds = withSeen(state, cycleId), lastMatchCycleId = state.lastMatchCycleId, lastMatchCycleClock = state.lastMatchCycleClock }, { "posts", "memory", "trends", "seenCycleIds", "lastMatchCycleId", "lastMatchCycleClock" }), (if state.gotm then Js.O({ gotm = state.gotm }, { "gotm" }) else Js.O({}, nil)), (if (scope == "league") then Js.O({ lastCycleId = state.lastCycleId, lastCycleClock = state.lastCycleClock, lastLeagueCycleId = cycleId }, { "lastCycleId", "lastCycleClock", "lastLeagueCycleId" }) else Js.ospread(Js.O({ lastCycleId = cycleId, lastCycleClock = cycleClock, lastLeagueCycleId = state.lastLeagueCycleId }, { "lastCycleId", "lastCycleClock", "lastLeagueCycleId" }), matchCycle))) end
	end
	capVideos = function(posts, cycleId)
		local vids = A.filter(posts, hasVideo)
		if (not Js.T(Js.alen(vids))) then
			do return end
		end
		local rng = M_grammar.rngFor("videos", cycleId)
		local max = (if (rng() < 0.5) then 1 else MAX_VIDEOS_PER_MATCH)
		if ((M_updateFlags.yourGoalVideoOn() and A.some(vids, function(p)
			return (p.eventId == "your-highlights")
		end)) and A.some(vids, function(p)
			return (p.eventId == "match-highlights")
		end)) then
			max = Math.max(max, 2)
		end
		if (Js.alen(vids) <= max) then
			do return end
		end
		local keep = Js.Set.new(Js.aspread(A.slice(A.filter(vids, function(p)
			return (p.eventId == "match-highlights")
		end), 0, 1), A.slice(A.filter(vids, function(p)
			return (p.eventId == "your-highlights")
		end), 0, 1)))
		local rest = A.filter(vids, function(p)
			return (not keep:has(p))
		end)
		do
			local _arr10 = A.reverse(Js.Array.from(keep))
			local _i11 = 0
			while _i11 < Js.alen(_arr10) do
				_i11 += 1
				local p = _arr10[_i11]
				if (keep.size > max) then
					keep:delete(p)
				end
			end
		end
		while ((keep.size < max) and Js.T(Js.alen(rest))) do
			keep:add(A.splice(rest, math.floor((rng() * Js.alen(rest))), 1)[1])
		end
		do
			local i = 0
			local _first12 = true
			while true do
				if not _first12 then
					i += 1
				end
				_first12 = false
				if not (i < Js.alen(posts)) then break end
				if (hasVideo(posts[i + 1]) and (not keep:has(posts[i + 1]))) then
					A.set(posts, i, Js.ospread(posts[i + 1], Js.O({ graphic = nil }, { "graphic" })))
				end
			end
		end
	end
	highlightPosts = function(career, r, accounts, cycleId, cycleClock)
		local out = Js.alit()
		local clubAcc = A.find(accounts, function(a)
			return ((a.archetype == "club") and ((function() local _v = a.allegiance; if _v == nil then return nil end; _v = _v.club; return _v end)() == r.club))
		end)
		local compAcc = (A.find(accounts, function(a)
			return ((a.archetype == "competition") and (a.name == r.competition))
		end) or A.find(accounts, function(a)
			return ((a.archetype == "league") and (a.name == r.competition))
		end))
		local home = (if r.home then r.club else r.opponent)
		local away = (if r.home then r.opponent else r.club)
		local hs = (if r.home then r.score.us else r.score.them)
		local as = (if r.home then r.score.them else r.score.us)
		local post = function(acc, key, minutes, text, title, reel)
			local rng = M_grammar.rngFor("post", cycleId, key, acc.id)
			do return Js.O({ id = (cycleId .. ":" .. key .. ":" .. acc.id), at = (cycleClock + minutes), author = Js.O({ handle = acc.handle, name = acc.name, archetype = acc.archetype, platform = acc.platform, verified = acc.verified, initials = acc.avatar.initials, tint = acc.avatar.tint, tint2 = acc.avatar.tint2, glyph = acc.avatar.glyph }, { "handle", "name", "archetype", "platform", "verified", "initials", "tint", "tint2", "glyph" }), text = text, graphic = Js.ospread(Js.O({ ["type"] = "goalVideo", title = title, clips = reel.clips }, { "type", "title", "clips" }), (if Js.T(Js.alen(reel.synth)) then Js.O({ synth = reel.synth }, { "synth" }) else Js.O({}, nil)), Js.O({ priority = true }, { "priority" })), metrics = M_grammar.metricsFor(acc.followers, 80, rng), eventId = key, tags = Js.alit("goal"), scope = "club" }, { "id", "at", "author", "text", "graphic", "metrics", "eventId", "tags", "scope" }) end
		end
		if ((hs + as) > 0) then
			local all = M_graphics.matchReel(r, "all")
			local acc = (if compAcc ~= nil then compAcc else clubAcc)
			if (acc and ((Js.alen(all.clips) + Js.alen(all.synth)) > 0)) then
				A.push(out, post(acc, "match-highlights", 3, ("HIGHLIGHTS | " .. home .. " " .. Js.numstr(hs) .. "-" .. Js.numstr(as) .. " " .. away .. " · " .. (if r.round ~= nil then r.round else (if (r.kind == "international") then r.competition else ("Week " .. Js.numstr(r.week))))), "HIGHLIGHTS", all))
			end
		end
		local yours = M_graphics.matchReel(r, "yours", r.you.name)
		if (clubAcc and ((Js.alen(yours.clips) + Js.alen(yours.synth)) > 0)) then
			local g = Js.alen(A.filter(r.goals, function(x)
				return x.isUser
			end))
			local a = Js.alen(A.filter(r.goals, function(x)
				return ((not x.isUser) and (x.assist == r.you.name))
			end))
			local what = A.join(A.filter(Js.alit((if Js.T(g) then (Js.numstr(g) .. " goal" .. (if (g > 1) then "s" else "")) else ""), (if Js.T(a) then (Js.numstr(a) .. " assist" .. (if (a > 1) then "s" else "")) else "")), Js.Boolean), ", ")
			A.push(out, post(clubAcc, "your-highlights", 5, (r.you.shortName .. " v " .. r.opponent .. ": " .. what .. " 🎥 (" .. (if r.round ~= nil then r.round else (if (r.kind == "international") then r.competition else ("Week " .. Js.numstr(r.week)))) .. ")"), (S.toUpperCase(r.you.shortName) .. " | " .. S.toUpperCase(what)), yours))
		end
		do return out end
	end
	render = function(p, career, record, memory, cycleId, usedThisCycle, slot)
		local _d13 = p
		local event = _d13.event
		local account = _d13.account
		local rng = M_grammar.rngFor("post", cycleId, event.id, account.id)
		local angle = M_narrate.chooseAngle(event, account, memory, cycleId)
		local template = M_index_2.chooseTemplate(event, account.archetype, angle.frame, memory, rng, angle.useThread, usedThisCycle)
		if (not template) then
			do return nil end
		end
		local wantThread = (angle.useThread and (not (not Js.T(template.threadBody))))
		local body = (if wantThread then template.threadBody else template.body)
		local facts = Js.ospread(event.facts)
		if event.thread then
			do
				local _arr14 = Js.Object.entries(event.thread.facts)
				local _i15 = 0
				while _i15 < Js.alen(_arr14) do
					_i15 += 1
					local _e16 = _arr14[_i15]
					local k = _e16[1]
					local v = _e16[2]
					facts[("thread." .. k)] = v
				end
			end
		end
		local raw = M_grammar.resolve(body, facts, account.voice, rng)
		if ((not Js.T(S.trim(raw))) or Js.re("\\{|\\}", ""):test(raw)) then
			do return nil end
		end
		local hashtag = (if template.hashtag then ("#" .. S.replace(Js.str((if facts.club ~= nil then facts.club else career.player.club)), Js.re("[^A-Za-z]", "g"), "")) else nil)
		local text = M_grammar.speak(raw, account.voice, event.tags, rng, hashtag)
		local graphic = (if Js.T(template.graphic) then M_graphics.buildGraphic(template.graphic, event, record, career, memory, rng) else nil)
		local importance = (if event.importance ~= nil then event.importance else event.baseImportance)
		local season = ((function() local _v = record; if _v == nil then return nil end; _v = _v.season; return _v end)() or career.season)
		local week = ((function() local _v = record; if _v == nil then return nil end; _v = _v.week; return _v end)() or career.week)
		do return Js.O({ templateId = template.id, post = Js.O({ id = (cycleId .. ":" .. event.id .. ":" .. account.id .. ":" .. Js.numstr(slot)), at = M_schedule.timeFor(season, week, event.window, rng()), author = Js.O({ handle = account.handle, name = account.name, archetype = account.archetype, platform = account.platform, verified = account.verified, initials = account.avatar.initials, tint = account.avatar.tint, tint2 = account.avatar.tint2, glyph = account.avatar.glyph }, { "handle", "name", "archetype", "platform", "verified", "initials", "tint", "tint2", "glyph" }), text = text, graphic = graphic, metrics = M_grammar.metricsFor(account.followers, importance, rng), eventId = event.id, tags = event.tags }, { "id", "at", "author", "text", "graphic", "metrics", "eventId", "tags" }) }, { "templateId", "post" }) end
	end
	feedFor = function(career, stage)
		if stage == nil then stage = "settled" end
		local state = mediaOf(career)
		if (stage == "settled") then
			local now = M_schedule.clockAt(career.season, career.week, 9999)
			do return Js.O({ posts = pinHighlights(M_schedule.visible(state.posts, now, (now - M_schedule.FEED_HORIZON)), (if state.lastMatchCycleId ~= nil then state.lastMatchCycleId else state.lastCycleId)), trends = state.trends, now = now }, { "posts", "trends", "now" }) end
		end
		local match = state.lastMatchCycleClock
		local since = (if (((match ~= nil) and (match <= state.lastCycleClock)) and ((state.lastCycleClock - match) <= WEEK_SPAN)) then match else state.lastCycleClock)
		local now = (state.lastCycleClock + M_schedule.FIRST_WAVE)
		local shown = A.map(A.filter(M_schedule.visible(state.posts, now, since), function(p)
			return ((p.at >= state.lastCycleClock) or (p.at <= (since + M_schedule.FIRST_WAVE)))
		end), function(p)
			return (if ((p.scope == "league") and hasVideo(p)) then Js.ospread(p, Js.O({ graphic = nil }, { "graphic" })) else p)
		end)
		do return Js.O({ posts = pinHighlights(shown, (if state.lastMatchCycleId ~= nil then state.lastMatchCycleId else state.lastCycleId)), trends = state.trends, now = now }, { "posts", "trends", "now" }) end
	end
	exports.feedFor = feedFor
	pinHighlights = function(posts, cycleId)
		if (not Js.T(cycleId)) then
			do return posts end
		end
		local rank = function(p)
			return (if (not S.startsWith(p.id, (cycleId .. ":"))) then 2 else (if (p.eventId == "match-highlights") then 0 else (if (p.eventId == "your-highlights") then 1 else 2)))
		end
		local top = A.sort(A.filter(posts, function(p)
			return (rank(p) < 2)
		end), function(a, b)
			return (rank(a) - rank(b))
		end)
		if (not Js.T(Js.alen(top))) then
			do return posts end
		end
		local out = A.filter(posts, function(p)
			return (rank(p) == 2)
		end)
		local rng = M_grammar.rngFor("pin", cycleId)
		local lo = Math.min(2, Js.alen(out))
		local hi = Math.max(lo, Math.min(5, ((Js.alen(out) + Js.alen(top)) - 1)))
		local placed = Js.alit()
		do
			local _arr17 = top
			local _i18 = 0
			while _i18 < Js.alen(_arr17) do
				_i18 += 1
				local p = _arr17[_i18]
				local at = (lo + math.floor((rng() * ((hi - lo) + 1))))
				do
					local t = 0
					local _first19 = true
					while true do
						if not _first19 then
							t += 1
						end
						_first19 = false
						if not ((t < 6) and A.some(placed, function(x)
							return (x.at == at)
						end)) then break end
						at = (lo + math.floor((rng() * ((hi - lo) + 1))))
					end
				end
				A.push(placed, Js.O({ p = p, at = at }, { "p", "at" }))
			end
		end
		do
			local _arr20 = A.sort(placed, function(a, b)
				return (a.at - b.at)
			end)
			local _i21 = 0
			while _i21 < Js.alen(_arr20) do
				_i21 += 1
				local _e22 = _arr20[_i21]
				local p = _e22.p
				local at = _e22.at
				A.splice(out, Math.min(Js.alen(out), at), 0, p)
			end
		end
		do return out end
	end
	exports.pinHighlights = pinHighlights
	hasFreshMedia = function(career)
		local state = mediaOf(career)
		if (not Js.T(state.lastCycleClock)) then
			do return false end
		end
		do return (Js.alen(feedFor(career, "moment").posts) > 0) end
	end
	exports.hasFreshMedia = hasFreshMedia
	unreadCount = function(career, lastSeen)
		do return Js.alen(A.filter(mediaOf(career).posts, function(p)
			return (p.at > lastSeen)
		end)) end
	end
	exports.unreadCount = unreadCount
	Js.reexport(exports, M_goalOfMonth, { ["voteGoalOfMonth"] = "voteGoalOfMonth", ["applyGoalOfMonthBoost"] = "applyGoalOfMonthBoost" })
	POST_CAP = 150
	SEEN_CAP = 400
	CAP_MILESTONES = Js.alit(10, 25, 50, 75, 100, 125, 150)
	exports.CAP_MILESTONES = CAP_MILESTONES
	MAX_VIDEOS_PER_MATCH = 2
	exports.MAX_VIDEOS_PER_MATCH = MAX_VIDEOS_PER_MATCH
	hasVideo = function(p)
		local g = p.graphic
		do return ((not (not g)) and ((g["type"] == "goalVideo") or ((g["type"] == "thumbnail") and ((((function() local _v = g.clips; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or 0) + ((function() local _v = g.synth; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or 0)) > 0)))) end
	end
	WEEK_SPAN = (M_schedule.clockAt(1, 2, 0) - M_schedule.clockAt(1, 1, 0))
	exports.surname = surname
end
