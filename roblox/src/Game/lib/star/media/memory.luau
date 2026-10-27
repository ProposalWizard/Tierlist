--!nocheck
--!nolint
-- Generated from lib/star/media/memory.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local RECENT_MAX, SAID_MAX, HEAT_DECAY, HEAT_CLOSE, HEAT_MAX, emptyMemory, absorbMatch, digest, goalsInLast, assistsInLast, averageRating, timesSeen, absorbEvents, accumulate, coolThreads, threadFor, hottestThread, markSaid, saidLately
	emptyMemory = function()
		do return Js.O({ recent = Js.alit(), streaks = Js.O({ scoring = 0, assisting = 0, unbeaten = 0, winning = 0, losing = 0, cleanSheets = 0, drought = 0, scoringHome = 0 }, { "scoring", "assisting", "unbeaten", "winning", "losing", "cleanSheets", "drought", "scoringHome" }), threads = Js.alit(), saidRecently = Js.alit(), seen = Js.O({}, nil) }, { "recent", "streaks", "threads", "saidRecently", "seen" }) end
	end
	exports.emptyMemory = emptyMemory
	absorbMatch = function(memory, r)
		local m = Js.ospread(memory, Js.O({ recent = A.slice(Js.aspread(Js.alit(digest(r)), memory.recent), 0, RECENT_MAX), streaks = Js.ospread(memory.streaks), threads = A.map(memory.threads, function(t)
			return Js.ospread(t, Js.O({ facts = Js.ospread(t.facts) }, { "facts" }))
		end), seen = Js.ospread(memory.seen) }, { "recent", "streaks", "threads", "seen" }))
		if (r.kind == "international") then
			do return m end
		end
		local s = m.streaks
		if (r.you.goals > 0) then
			s.scoring += 1
			s.drought = 0
		else
			s.scoring = 0
			s.drought += 1
		end
		s.assisting = (if (r.you.assists > 0) then (s.assisting + 1) else 0)
		s.scoringHome = (if (r.home and (r.you.goals > 0)) then (s.scoringHome + 1) else (if r.home then 0 else s.scoringHome))
		if (r.result == "win") then
			s.winning += 1
			s.unbeaten += 1
			s.losing = 0
		elseif (r.result == "draw") then
			s.winning = 0
			s.unbeaten += 1
			s.losing = 0
		else
			s.winning = 0
			s.unbeaten = 0
			s.losing += 1
		end
		s.cleanSheets = (if (r.score.them == 0) then (s.cleanSheets + 1) else 0)
		do return m end
	end
	exports.absorbMatch = absorbMatch
	digest = function(r)
		do return Js.O({ season = r.season, week = r.week, goals = r.you.goals, assists = r.you.assists, rating = r.you.rating, result = r.result, conceded = r.score.them, scored = r.score.us, opponent = r.opponent, competition = r.competition }, { "season", "week", "goals", "assists", "rating", "result", "conceded", "scored", "opponent", "competition" }) end
	end
	goalsInLast = function(memory, n)
		do return A.reduce(A.slice(memory.recent, 0, n), function(sum, d)
			return (sum + d.goals)
		end, 0) end
	end
	exports.goalsInLast = goalsInLast
	assistsInLast = function(memory, n)
		do return A.reduce(A.slice(memory.recent, 0, n), function(sum, d)
			return (sum + d.assists)
		end, 0) end
	end
	exports.assistsInLast = assistsInLast
	averageRating = function(memory, n)
		local slice = A.slice(memory.recent, 0, n)
		if (not Js.T(Js.alen(slice))) then
			do return 6.5 end
		end
		do return (A.reduce(slice, function(s, d)
			return (s + d.rating)
		end, 0) / Js.alen(slice)) end
	end
	exports.averageRating = averageRating
	timesSeen = function(memory, eventId)
		do return (if memory.seen[eventId] ~= nil then memory.seen[eventId] else 0) end
	end
	exports.timesSeen = timesSeen
	absorbEvents = function(memory, events, at)
		local threads = A.map(memory.threads, function(t)
			return Js.ospread(t, Js.O({ facts = Js.ospread(t.facts) }, { "facts" }))
		end)
		local seen = Js.ospread(memory.seen)
		local out = A.map(events, function(e)
			seen[e.id] = ((if seen[e.id] ~= nil then seen[e.id] else 0) + 1)
			if (not Js.T(e.threadKey)) then
				do return e end
			end
			local t = A.find(threads, function(x)
				return (x.key == e.threadKey)
			end)
			if (not t) then
				t = Js.O({ key = e.threadKey, opened = at, touched = at, heat = 0, facts = Js.O({}, nil) }, { "key", "opened", "touched", "heat", "facts" })
				A.push(threads, t)
			end
			t.touched = at
			t.heat = Math.min(HEAT_MAX, (t.heat + Math.max(14, Math.round((e.baseImportance * 0.45)))))
			t.facts = accumulate(t.facts, e.facts)
			do return Js.ospread(e, Js.O({ thread = Js.O({ key = t.key, facts = Js.ospread(t.facts), heat = t.heat }, { "key", "facts", "heat" }) }, { "thread" })) end
		end)
		do return Js.O({ memory = Js.ospread(memory, Js.O({ threads = threads, seen = seen }, { "threads", "seen" })), events = out }, { "memory", "events" }) end
	end
	exports.absorbEvents = absorbEvents
	accumulate = function(into, from)
		local out = Js.ospread(into)
		local measured = ((type(from.matches) == "number") and (from.matches > 1))
		do
			local _arr1 = Js.Object.entries(from)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local k = _e3[1]
				local v = _e3[2]
				if ((not measured) and (((k == "goals") or (k == "assists")) or (k == "matches"))) then
					do continue end
				end
				out[k] = v
			end
		end
		do return out end
	end
	coolThreads = function(memory)
		local threads = A.filter(A.map(memory.threads, function(t)
			return Js.ospread(t, Js.O({ heat = (t.heat - HEAT_DECAY) }, { "heat" }))
		end), function(t)
			return (t.heat >= HEAT_CLOSE)
		end)
		do return Js.ospread(memory, Js.O({ threads = threads }, { "threads" })) end
	end
	exports.coolThreads = coolThreads
	threadFor = function(memory, key)
		do return A.find(memory.threads, function(t)
			return (t.key == key)
		end) end
	end
	exports.threadFor = threadFor
	hottestThread = function(memory)
		do return A.sort(Js.aspread(memory.threads), function(a, b)
			return (b.heat - a.heat)
		end)[1] end
	end
	exports.hottestThread = hottestThread
	markSaid = function(memory, templateIds)
		do return Js.ospread(memory, Js.O({ saidRecently = A.slice(Js.aspread(templateIds, memory.saidRecently), 0, SAID_MAX) }, { "saidRecently" })) end
	end
	exports.markSaid = markSaid
	saidLately = function(memory, templateId)
		do return A.includes(memory.saidRecently, templateId) end
	end
	exports.saidLately = saidLately
	RECENT_MAX = 12
	SAID_MAX = 40
	HEAT_DECAY = 12
	HEAT_CLOSE = 20
	HEAT_MAX = 100
end
