--!nocheck
--!nolint
-- Generated from lib/star/media/goalOfMonth.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_goalOfMonth = import("lib/star/media/detect/goalOfMonth")
	local M_grammar = import("lib/star/media/grammar")
	local M_potm = import("lib/star/potm")
	local M_accounts = import("lib/star/media/accounts")
	local M_calendar = import("lib/star/calendar")
	local M_fame = import("lib/star/fame")
	local POST_CAP, POLLS_KEPT, emptyGotm, keyOf, rivalKey, authorOf, yourEntries, replacePost, goalOfMonthAfterMatch, voteGoalOfMonth, applyGoalOfMonthBoost
	emptyGotm = function()
		do return Js.O({ goals = Js.alit(), rivals = Js.O({}, nil), polls = Js.alit() }, { "goals", "rivals", "polls" }) end
	end
	exports.emptyGotm = emptyGotm
	authorOf = function(acc)
		do return Js.O({ handle = acc.handle, name = acc.name, archetype = acc.archetype, platform = acc.platform, verified = acc.verified, initials = acc.avatar.initials, tint = acc.avatar.tint, tint2 = acc.avatar.tint2, glyph = acc.avatar.glyph }, { "handle", "name", "archetype", "platform", "verified", "initials", "tint", "tint2", "glyph" }) end
	end
	yourEntries = function(before, fixture, stats, record)
		local you = (before.player.firstName .. " " .. before.player.lastName)
		local club = before.player.club
		local home = (if fixture.home then club else fixture.opponent)
		local away = (if fixture.home then fixture.opponent else club)
		local events = (if stats.goalEvents ~= nil then stats.goalEvents else Js.alit())
		local out = Js.alit()
		do
			local _arr1 = record.goals
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				if (not g.isUser) then
					do continue end
				end
				local ev = A.find(events, function(e)
					return ((e.isUserGoal and (e.minute == g.minute)) and (e.scorer == g.scorer))
				end)
				local judged = Js.O({ how = g.how, distance = g.distance, finish = (function() local _v = ev; if _v == nil then return nil end; _v = _v.finish; return _v end)() }, { "how", "distance", "finish" })
				local sa = g.scoreAfter
				A.push(out, Js.ospread(Js.O({ scorer = you, scorerShort = before.player.lastName, club = club, isYou = true, detail = M_goalOfMonth.describeGoal(judged, M_grammar.shortClub(fixture.opponent)), quality = M_goalOfMonth.goalQuality(judged) }, { "scorer", "scorerShort", "club", "isYou", "detail", "quality" }), (if Js.T(g.clipId) then Js.O({ clipId = g.clipId }, { "clipId" }) else Js.O({ synth = Js.ospread(Js.O({ home = home, away = away, scorerHome = fixture.home, minute = g.minute }, { "home", "away", "scorerHome", "minute" }), (if sa then Js.O({ scoreAfter = (if fixture.home then Js.alit(sa.us, sa.them) else Js.alit(sa.them, sa.us)) }, { "scoreAfter" }) else Js.O({}, nil)), Js.O({ seed = ("gu" .. Js.numstr(record.season) .. "." .. Js.numstr(record.week) .. "." .. Js.numstr(g.minute)), kind = M_goalOfMonth.synthKindFor(g.how) }, { "seed", "kind" })) }, { "synth" }))))
			end
		end
		do return out end
	end
	replacePost = function(posts, id, f)
		do return A.map(posts, function(p)
			return (if (p.id == id) then f(p) else p)
		end) end
	end
	goalOfMonthAfterMatch = function(media, before, after, fixture, stats, record, cycleClock)
		if (fixture.kind == "international") then
			do return media end
		end
		local g0 = (if media.gotm ~= nil then media.gotm else emptyGotm())
		local gotm = Js.O({ goals = Js.aspread((if g0.goals ~= nil then g0.goals else Js.alit())), rivals = Js.ospread((if g0.rivals ~= nil then g0.rivals else Js.O({}, nil))), polls = Js.aspread((if g0.polls ~= nil then g0.polls else Js.alit())), boostDue = g0.boostDue }, { "goals", "rivals", "polls", "boostDue" })
		local posts = media.posts
		local added = Js.alit()
		local season = record.season
		local month = M_potm.monthOfCareer(before, fixture.week)
		local now = keyOf(season, month)
		local roster = M_accounts.buildRoster(after)
		local competition = M_calendar.leagueNameFor(M_calendar.divisionOf(before))
		local acc = (((A.find(roster, function(a)
			return ((a.archetype == "league") and (a.name == competition))
		end) or A.find(roster, function(a)
			return (a.archetype == "league")
		end)) or A.find(roster, function(a)
			return ((a.archetype == "club") and ((function() local _v = a.allegiance; if _v == nil then return nil end; _v = _v.club; return _v end)() == before.player.club))
		end)) or roster[1])
		gotm.polls = A.map(gotm.polls, function(p)
			if ((p.closed or (p.openedAt >= cycleClock)) or (not acc)) then
				do return p end
			end
			local winner = M_goalOfMonth.winnerOf(p)
			local w = p.entries[winner + 1]
			local closed = Js.ospread(p, Js.O({ closed = true, winner = winner, winnerIsYou = (not (not (function() local _v = w; if _v == nil then return nil end; _v = _v.isYou; return _v end)())), entries = Js.alit(), fanVotes = Js.alit() }, { "closed", "winner", "winnerIsYou", "entries", "fanVotes" }))
			posts = replacePost(posts, p.postId, function(post)
				return (if ((function() local _v = post.graphic; if _v == nil then return nil end; _v = _v["type"]; return _v end)() == "gotmPoll") then Js.ospread(post, Js.O({ graphic = Js.ospread(post.graphic, Js.O({ closed = true, winner = winner, userVote = p.userVote }, { "closed", "winner", "userVote" })) }, { "graphic" })) else post)
			end)
			if w then
				local rng = M_grammar.rngFor("gotm-winner", p.id)
				A.push(added, Js.O({ id = (p.id .. ":winner"), at = (cycleClock + 20), author = authorOf(acc), text = (if w.isYou then ("🏆 " .. p.monthName .. " Goal of the Month: " .. w.scorer .. "! " .. w.detail .. ". The fans have spoken.") else ("🏆 " .. p.monthName .. " Goal of the Month: " .. w.scorer .. " (" .. M_grammar.shortClub(w.club) .. "). " .. w.detail .. ".")), graphic = Js.ospread(Js.O({ ["type"] = "goalVideo", title = ("GOAL OF THE MONTH | " .. S.toUpperCase(w.scorerShort)), clips = (if Js.T(w.clipId) then Js.alit(w.clipId) else Js.alit()) }, { "type", "title", "clips" }), (if w.synth then Js.O({ synth = Js.alit(M_goalOfMonth.synthOf(w)) }, { "synth" }) else Js.O({}, nil))), metrics = M_grammar.metricsFor(acc.followers, (if w.isYou then 75 else 55), rng), eventId = "gotm-winner", tags = Js.alit("goal", "award"), scope = (if w.isYou then "club" else "league") }, { "id", "at", "author", "text", "graphic", "metrics", "eventId", "tags", "scope" }))
				if w.isYou then
					gotm.boostDue = ((if gotm.boostDue ~= nil then gotm.boostDue else 0) + M_goalOfMonth.GOTM_FANS_BOOST)
				end
			end
			do return closed end
		end)
		do
			local _arr3 = yourEntries(before, fixture, stats, record)
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local e = _arr3[_i4]
				A.push(gotm.goals, Js.ospread(e, Js.O({ season = season, month = month }, { "season", "month" })))
			end
		end
		local rk = rivalKey(season, month)
		local rivals = M_goalOfMonth.pickRivalGoals((if after.results ~= nil then after.results else Js.alit()), before.player.club, function(w)
			return (M_potm.monthOfCareer(before, w) == month)
		end, (Js.numstr(season) .. "-" .. Js.numstr(month) .. "-" .. before.player.club), competition, season, 2, M_grammar.shortClub)
		if (Js.alen(rivals) >= ((function() local _v = gotm.rivals[rk]; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or 0)) then
			gotm.rivals[rk] = rivals
		end
		local done = A.filter(gotm.goals, function(g)
			return (keyOf(g.season, g.month) < now)
		end)
		if (Js.T(Js.alen(done)) and acc) then
			local last = A.reduce(done, function(m, g)
				return Math.max(m, keyOf(g.season, g.month))
			end, 0)
			local pSeason = math.floor((last / 100))
			local pMonth = math.fmod(last, 100)
			local id = ("gotm-" .. Js.numstr(pSeason) .. "-" .. Js.numstr(pMonth))
			if (not A.some(gotm.polls, function(p)
				return (p.id == id)
			end)) then
				local mine = A.map(M_goalOfMonth.bestOf(A.filter(done, function(g)
					return (keyOf(g.season, g.month) == last)
				end), 3), function(_p5)
					local _s = _p5.season
					local _m = _p5.month
					local e = Js.ospread(_p5)
					Js.del(e, "season")
					Js.del(e, "month")
					return e
				end)
				local theirs = (gotm.rivals[rivalKey(pSeason, pMonth)] or Js.alit())
				if ((Js.alen(mine) + Js.alen(theirs)) >= 2) then
					local entries = A.sort(Js.aspread(mine, theirs), function(a, b)
						return (b.quality - a.quality)
					end)
					local seed = (before.player.firstName .. before.player.lastName .. "-" .. id)
					local votes = M_goalOfMonth.fanVotes(entries, M_fame.fameOf(after), seed)
					local userWeight = M_goalOfMonth.userWeightFor(votes)
					local monthName = (if M_potm.MONTH_NAMES[pMonth + 1] ~= nil then M_potm.MONTH_NAMES[pMonth + 1] else "This month")
					local postId = (id .. ":poll")
					local rng = M_grammar.rngFor("gotm-poll", id)
					A.push(gotm.polls, Js.O({ id = id, season = pSeason, month = pMonth, monthName = monthName, postId = postId, openedAt = cycleClock, entries = entries, fanVotes = votes, userWeight = userWeight }, { "id", "season", "month", "monthName", "postId", "openedAt", "entries", "fanVotes", "userWeight" }))
					A.push(added, Js.O({ id = postId, at = (cycleClock + 30), author = authorOf(acc), text = (if Js.T(Js.alen(theirs)) then ("🗳️ " .. monthName .. " Goal of the Month. " .. (if (Js.alen(mine) == 1) then (mine[1].scorerShort .. "'s goal is") else (mine[1].scorerShort .. " has " .. Js.numstr(Js.alen(mine)))) .. " up against the best of the rest. Which one gets your vote?") else ("🗳️ " .. monthName .. " Goal of the Month. Which of " .. mine[1].scorerShort .. "'s " .. Js.numstr(Js.alen(mine)) .. " goals was the best? Your vote counts.")), graphic = Js.O({ ["type"] = "gotmPoll", pollId = id, monthName = monthName, entries = entries, fanVotes = votes, userWeight = userWeight }, { "type", "pollId", "monthName", "entries", "fanVotes", "userWeight" }), metrics = M_grammar.metricsFor(acc.followers, 70, rng), eventId = "gotm-poll", tags = Js.alit("goal", "award"), scope = "club" }, { "id", "at", "author", "text", "graphic", "metrics", "eventId", "tags", "scope" }))
				end
			end
		end
		gotm.goals = A.filter(gotm.goals, function(g)
			return (keyOf(g.season, g.month) >= now)
		end)
		do
			local _arr6 = Js.Object.keys(gotm.rivals)
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local k = _arr6[_i7]
				local _d8 = A.map(S.split(k, "-"), Js.Number)
				local s = _d8[1]
				local m = _d8[2]
				if ((keyOf(s, m) < now) and (not A.some(gotm.polls, function(p)
					return (((not p.closed) and (p.season == s)) and (p.month == m))
				end))) then
					Js.del(gotm.rivals, k)
				end
			end
		end
		local open = A.filter(gotm.polls, function(p)
			return (not p.closed)
		end)
		gotm.polls = Js.aspread(A.slice(A.filter(gotm.polls, function(p)
			return p.closed
		end), (-POLLS_KEPT)), open)
		if Js.T(Js.alen(added)) then
			posts = A.slice(A.sort(Js.aspread(posts, added), function(a, b)
				return (a.at - b.at)
			end), (-POST_CAP))
		end
		do return Js.ospread(media, Js.O({ posts = posts, gotm = gotm }, { "posts", "gotm" })) end
	end
	exports.goalOfMonthAfterMatch = goalOfMonthAfterMatch
	voteGoalOfMonth = function(career, postId, index)
		local media = career.media
		if (not media) then
			do return career end
		end
		local post = A.find(media.posts, function(p)
			return (p.id == postId)
		end)
		local g = (function() local _v = post; if _v == nil then return nil end; _v = _v.graphic; return _v end)()
		if ((((not g) or (g["type"] ~= "gotmPoll")) or g.closed) or (g.userVote ~= nil)) then
			do return career end
		end
		if (((not Js.NumberNS.isInteger(index)) or (index < 0)) or (index >= Js.alen(g.entries))) then
			do return career end
		end
		local posts = replacePost(media.posts, postId, function(p)
			return (if ((function() local _v = p.graphic; if _v == nil then return nil end; _v = _v["type"]; return _v end)() == "gotmPoll") then Js.ospread(p, Js.O({ graphic = Js.ospread(p.graphic, Js.O({ userVote = index }, { "userVote" })) }, { "graphic" })) else p)
		end)
		local gotm = (if media.gotm then Js.ospread(media.gotm, Js.O({ polls = A.map(media.gotm.polls, function(p)
			return (if ((p.id == g.pollId) and (not p.closed)) then Js.ospread(p, Js.O({ userVote = index }, { "userVote" })) else p)
		end) }, { "polls" })) else media.gotm)
		do return Js.ospread(career, Js.O({ media = Js.ospread(media, Js.O({ posts = posts }, { "posts" }), (if gotm then Js.O({ gotm = gotm }, { "gotm" }) else Js.O({}, nil))) }, { "media" })) end
	end
	exports.voteGoalOfMonth = voteGoalOfMonth
	applyGoalOfMonthBoost = function(career)
		local due = ((function() local _v = career.media; if _v == nil then return nil end; _v = _v.gotm; if _v == nil then return nil end; _v = _v.boostDue; return _v end)() or 0)
		if ((not Js.T(due)) or (not (function() local _v = career.media; if _v == nil then return nil end; _v = _v.gotm; return _v end)())) then
			do return career end
		end
		local fans = Math.max(0, Math.min(100, (((function() local _v = career.relationships; if _v == nil then return nil end; _v = _v.fans; return _v end)() or 50) + due)))
		do return Js.ospread(career, Js.O({ relationships = Js.ospread(career.relationships, Js.O({ fans = fans }, { "fans" })), media = Js.ospread(career.media, Js.O({ gotm = Js.ospread(career.media.gotm, Js.O({ boostDue = 0 }, { "boostDue" })) }, { "gotm" })) }, { "relationships", "media" })) end
	end
	exports.applyGoalOfMonthBoost = applyGoalOfMonthBoost
	POST_CAP = 150
	POLLS_KEPT = 2
	keyOf = function(season, month)
		return ((season * 100) + month)
	end
	rivalKey = function(season, month)
		return (Js.numstr(season) .. "-" .. Js.numstr(month))
	end
end
