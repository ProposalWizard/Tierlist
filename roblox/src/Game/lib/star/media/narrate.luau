--!nocheck
--!nolint
-- Generated from lib/star/media/narrate.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_grammar = import("lib/star/media/grammar")
	local FRAMES, NEGATIVE_TAGS, LEAD_PREFERENCE, chooseAngle
	chooseAngle = function(event, account, memory, cycleId)
		local rng = M_grammar.rngFor("angle", cycleId, event.id, account.id)
		local negative = A.some(event.tags, function(t)
			return NEGATIVE_TAGS:has(t)
		end)
		local hostile = ((function() local _v = account.allegiance; if _v == nil then return nil end; _v = _v.polarity; return _v end)() == -1)
		local sentiment = (if hostile then (if negative then 1 else -1) else (if negative then -1 else (if (A.includes(event.tags, "goal") or A.includes(event.tags, "trophy")) then 1 else 0)))
		local frames = FRAMES[account.archetype]
		if ((not hostile) and negative) then
			frames = A.filter(frames, function(f)
				return (f ~= "celebrate")
			end)
		end
		if (not Js.T(Js.alen(frames))) then
			frames = Js.alit("report")
		end
		local frame = M_grammar.pick(frames, rng)
		local prefs = (if LEAD_PREFERENCE[account.archetype] ~= nil then LEAD_PREFERENCE[account.archetype] else Js.alit("score"))
		local lead = (A.find(prefs, function(k)
			return ((event.facts[k] ~= nil) and (event.facts[k] ~= ""))
		end) or "score")
		local secondary = A.find(prefs, function(k)
			return (((k ~= lead) and (event.facts[k] ~= nil)) and (event.facts[k] ~= ""))
		end)
		local threadish = Js.alit("stats", "broadsheet", "pundit", "tabloid", "league")
		local useThread = (((((not (not event.thread)) and (event.thread.heat >= 45)) and (Js.Number((if event.thread.facts.matches ~= nil then event.thread.facts.matches else 0)) >= 2)) and A.includes(threadish, account.archetype)) and (rng() < 0.8))
		do return Js.O({ lead = lead, secondary = secondary, sentiment = sentiment, frame = frame, useThread = useThread }, { "lead", "secondary", "sentiment", "frame", "useThread" }) end
	end
	exports.chooseAngle = chooseAngle
	FRAMES = Js.O({ club = Js.alit("celebrate", "report"), league = Js.alit("report"), competition = Js.alit("report", "celebrate"), broadsheet = Js.alit("analyse", "report"), tabloid = Js.alit("hype", "mock"), insider = Js.alit("report"), stats = Js.alit("report"), aggregator = Js.alit("hype", "report"), pundit = Js.alit("analyse", "question", "lament"), fan = Js.alit("celebrate", "hype", "lament"), rivalFan = Js.alit("mock", "joke"), teammate = Js.alit("celebrate"), meme = Js.alit("joke", "mock") }, { "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme" })
	NEGATIVE_TAGS = Js.Set.new(Js.alit("shame", "relegation"))
	LEAD_PREFERENCE = Js.O({ club = Js.alit("goals", "minute", "score", "player", "round"), league = Js.alit("score", "goals", "position", "points"), competition = Js.alit("round", "score", "goals"), broadsheet = Js.alit("score", "position", "gap", "average", "matches"), tabloid = Js.alit("minute", "goals", "margin", "deficit", "player"), insider = Js.alit("fee", "to", "seasons", "club"), stats = Js.alit("goals", "matches", "average", "total", "milestone", "assists"), aggregator = Js.alit("goals", "minute", "how", "score"), pundit = Js.alit("average", "matches", "rating", "position", "player"), fan = Js.alit("minute", "goals", "player", "score"), rivalFan = Js.alit("opponent", "score", "margin", "position"), teammate = Js.alit("player", "goals", "score"), meme = Js.alit("margin", "score", "opponent", "matches") }, { "club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme" })
end
