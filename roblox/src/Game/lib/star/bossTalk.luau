--!nocheck
--!nolint
-- Generated from lib/star/bossTalk.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_playstyle = import("lib/star/playstyle")
	local M_season = import("lib/star/season")
	local M_bossPenalties = import("lib/star/bossPenalties")
	local TALK_ROUNDS, STYLE_VALUE, STYLE_CLASH, GRADE_POINTS, styleFromPlaystyle, managerTalkStyle, OPEN_TOPICS, HINTS, REPLIES, ANSWERS, ALL_VALUES, gradeOf, formTopic, nameHash, buildTalk, talkFor, talkHits, talkGain
	styleFromPlaystyle = function(p)
		if (p == "high-press") then
			do return "press" end
		end
		if (p == "possession") then
			do return "possession" end
		end
		if (p == "mid-block") then
			do return "mid" end
		end
		do return "low" end
	end
	exports.styleFromPlaystyle = styleFromPlaystyle
	managerTalkStyle = function(name)
		local known = M_playstyle.playstyleForManager(name)
		if known then
			do return styleFromPlaystyle(known.id) end
		end
		do return styleFromPlaystyle(M_playstyle.playstyleForClub(("manager:" .. name)).id) end
	end
	exports.managerTalkStyle = managerTalkStyle
	gradeOf = function(style, value)
		if (STYLE_VALUE[style] == value) then
			do return "best" end
		end
		if (STYLE_CLASH[style] == value) then
			do return "clash" end
		end
		do return "neutral" end
	end
	exports.gradeOf = gradeOf
	formTopic = function(lastRating)
		if (((lastRating == nil) or (not Js.NumberNS.isFinite(lastRating))) or (lastRating <= 0)) then
			do return nil end
		end
		if (lastRating < 6) then
			do return "bad-game" end
		end
		if (lastRating >= 7.5) then
			do return "good-game" end
		end
		do return nil end
	end
	exports.formTopic = formTopic
	nameHash = function(s)
		local h = 2166136261
		for i = 0, (S.len(s)) - 1 do
			h = Js.bxor(h, S.charCodeAt(s, i))
			h = Math.imul(h, 16777619)
		end
		do return Js.ushr(h, 0) end
	end
	buildTalk = function(opts)
		local style = managerTalkStyle(opts.managerName)
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(opts.seed, nameHash(opts.managerName)), 0))
		local pool = Js.aspread(OPEN_TOPICS)
		local topics = Js.alit()
		while (Js.alen(topics) < TALK_ROUNDS) do
			A.push(topics, A.splice(pool, math.floor((rng() * Js.alen(pool))), 1)[1])
		end
		local ft = formTopic(opts.lastRating)
		if Js.T(ft) then
			A.set(topics, 1, ft)
		end
		local best = STYLE_VALUE[style]
		local clash = STYLE_CLASH[style]
		local others = A.filter(ALL_VALUES, function(v)
			return ((v ~= best) and (v ~= clash))
		end)
		local rounds = A.map(topics, function(topic)
			local neutral = others[math.floor((rng() * Js.alen(others))) + 1]
			local replies = A.map(Js.alit(best, neutral, clash), function(value)
				local grade = gradeOf(style, value)
				local pair = ANSWERS[style][grade]
				do return Js.O({ text = REPLIES[topic][value], value = value, grade = grade, answer = pair[math.floor((rng() * 2)) + 1] }, { "text", "value", "grade", "answer" }) end
			end)
			for i = (Js.alen(replies) - 1), 1, -1 do
				local j = math.floor((rng() * (i + 1)))
				local _d1 = Js.alit(replies[j + 1], replies[i + 1])
				A.set(replies, i, _d1[1])
				A.set(replies, j, _d1[2])
			end
			local hints = HINTS[topic][style]
			do return Js.O({ topic = topic, line = hints[math.floor((rng() * 2)) + 1], replies = replies }, { "topic", "line", "replies" }) end
		end)
		do return Js.O({ style = style, rounds = rounds }, { "style", "rounds" }) end
	end
	exports.buildTalk = buildTalk
	talkFor = function(career, salt)
		if salt == nil then salt = 0 end
		do return buildTalk(Js.O({ managerName = ((function() local _v = career.manager; if _v == nil then return nil end; _v = _v.name; return _v end)() or "The manager"), lastRating = (function() local _v = career.form; if _v == nil then return nil end; _v = _v[1]; return _v end)(), seed = (((career.season * 7307) + (career.week * 131)) + salt) }, { "managerName", "lastRating", "seed" })) end
	end
	exports.talkFor = talkFor
	talkHits = function(grades)
		do return Math.max(0, A.reduce(grades, function(s, g)
			return (s + GRADE_POINTS[g])
		end, 0)) end
	end
	exports.talkHits = talkHits
	talkGain = function(grades)
		do return M_bossPenalties.bossGain(talkHits(grades)) end
	end
	exports.talkGain = talkGain
	TALK_ROUNDS = M_bossPenalties.BOSS_KICKS
	exports.TALK_ROUNDS = TALK_ROUNDS
	STYLE_VALUE = Js.O({ press = "effort", possession = "ideas", low = "discipline", mid = "professional" }, { "press", "possession", "low", "mid" })
	exports.STYLE_VALUE = STYLE_VALUE
	STYLE_CLASH = Js.O({ press = "ideas", possession = "discipline", low = "effort", mid = "ideas" }, { "press", "possession", "low", "mid" })
	exports.STYLE_CLASH = STYLE_CLASH
	GRADE_POINTS = Js.O({ best = 1, neutral = 0, clash = -1 }, { "best", "neutral", "clash" })
	exports.GRADE_POINTS = GRADE_POINTS
	OPEN_TOPICS = Js.alit("training", "role", "teammate", "tactics", "media")
	HINTS = Js.O({ training = Js.O({ press = Js.alit("I had the running numbers on my desk at seven. Some of them were embarrassing.", "Training was flat today. I want it at a hundred miles an hour."), possession = Js.alit("I stopped the session twice today. Nobody was looking up.", "I don't want robots out there. I want players who think."), low = Js.alit("Somebody wandered out of position in the shape drill. Again.", "We drilled the back line for an hour today. That's how we win games."), mid = Js.alit("It's a long season. I want the same player on a wet Tuesday as on derby day.", "No dramas this week. That's how I like it.") }, { "press", "possession", "low", "mid" }), role = Js.O({ press = Js.alit("When we lose it, I want you first to the ball. Every time.", "Our defending starts with the front players. Remember that."), possession = Js.alit("I want you on the ball more. Show for it, even when it's tight.", "The best players I've had wanted the ball in the hard places."), low = Js.alit("Your job comes first. The fancy stuff can wait.", "When I say hold, you hold. Even when the space looks lovely."), mid = Js.alit("I don't need a hero. I need someone I can count on.", "Do the simple things well, and keep doing them.") }, { "press", "possession", "low", "mid" }), teammate = Js.O({ press = Js.alit("One of the lads stopped running in the second half. I noticed. Did you?", "I want a dressing room that hates losing a sprint."), possession = Js.alit("One of the lads keeps hitting it long. Panic. I hate panic.", "I want the senior lads talking the young ones through games."), low = Js.alit("Somebody was late for the bus. I've fined him. The group needs to see that.", "One player doing his own thing and the whole plan goes."), mid = Js.alit("A couple of the lads are falling out. It needs to calm down.", "The group's been noisy this week. I want it settled.") }, { "press", "possession", "low", "mid" }), tactics = Js.O({ press = Js.alit("They hate being hurried. We hunt them in packs on Saturday.", "Saturday we squeeze them from the first whistle."), possession = Js.alit("Saturday we keep the ball. Fifty passes if that's what it takes.", "They'll sit deep on Saturday. We need to be cleverer than them."), low = Js.alit("Saturday we stay compact and let them come. Patience.", "Keep it tight for an hour and the game comes to us."), mid = Js.alit("Saturday we adapt. Whatever they do, we stay calm.", "No big plan for Saturday. Read the game, play the game.") }, { "press", "possession", "low", "mid" }), media = Js.O({ press = Js.alit("The papers say we fade late on. I want them proved wrong in the last ten minutes.", "Someone wrote that we're tired. Are you tired?"), possession = Js.alit("The papers say we pass it sideways. They don't understand what we're building.", "A pundit called us boring. I call it control."), low = Js.alit("The papers say we're negative. I don't care. Clean sheets win things.", "They called us anti-football. Three points is three points."), mid = Js.alit("The papers want a headline. Don't give them one.", "Say nothing to the press this week. Nothing that makes a story.") }, { "press", "possession", "low", "mid" }), ["bad-game"] = Js.O({ press = Js.alit("Saturday. You stopped running after the hour. Explain that.", "Saturday. I watched you jog back twice. Twice."), possession = Js.alit("Saturday. You kept giving it away. What were you seeing?", "Saturday. Every time you got it, you rushed it. Why?"), low = Js.alit("Saturday. You left your man twice. That's not what we agreed.", "Saturday. You went walkabout. I had to change the shape for you."), mid = Js.alit("Saturday wasn't you. It happens. What now?", "Saturday was a bad day. Everybody has them. How are you taking it?") }, { "press", "possession", "low", "mid" }), ["good-game"] = Js.O({ press = Js.alit("Good Saturday. Now do it again with your lungs burning.", "You were good on Saturday. I still want more legs from you."), possession = Js.alit("Good Saturday. I liked the pass before the goal more than the goal.", "Saturday you saw things early. That's what I want."), low = Js.alit("Good Saturday. And you still tracked back in the ninetieth minute. That's the bit I liked.", "Saturday you did your job and then some. Good."), mid = Js.alit("Good Saturday. Don't get carried away.", "Nice game on Saturday. Let's not make a fuss about it.") }, { "press", "possession", "low", "mid" }) }, { "training", "role", "teammate", "tactics", "media", "bad-game", "good-game" })
	REPLIES = Js.O({ training = Js.O({ effort = "I'll stay out after the session and do the extra running.", ideas = "I've been looking at where the space opens up in the drills.", discipline = "Tell me where you want me and I'll be there, every rep.", professional = "Same as always: eat right, sleep right, turn up ready." }, { "effort", "ideas", "discipline", "professional" }), role = Js.O({ effort = "I'll chase every ball. They won't get a second on it.", ideas = "Give me a bit of freedom and I'll find you something.", discipline = "I'll do the job you set. Nothing more, nothing less.", professional = "I'll keep it steady. You'll always know what you get from me." }, { "effort", "ideas", "discipline", "professional" }), teammate = Js.O({ effort = "I'll set the tone. If I'm running, they'll run.", ideas = "I'll talk him through it and show him the other option.", discipline = "Rules are rules. If he's out of line, he's out of line.", professional = "I'll keep my head down and let my football do the talking." }, { "effort", "ideas", "discipline", "professional" }), tactics = Js.O({ effort = "I'll run them into the ground.", ideas = "I've watched their full-back. He turns slowly. I can use that.", discipline = "I'll stick to the plan, whatever happens in the game.", professional = "I'll be ready for whatever the game needs on the day." }, { "effort", "ideas", "discipline", "professional" }), media = Js.O({ effort = "Then I'll be the one still sprinting at the end.", ideas = "Let them talk. They'll see what we're doing soon enough.", discipline = "I don't read it. I listen to you, not them.", professional = "No comment from me. I'll just get on with it." }, { "effort", "ideas", "discipline", "professional" }), ["bad-game"] = Js.O({ effort = "That's on me. I'll work twice as hard this week to put it right.", ideas = "I was trying things that weren't on. I've watched it back and I know why.", discipline = "I didn't do my job. It won't happen again.", professional = "One bad day. I'll reset and go again, same as always." }, { "effort", "ideas", "discipline", "professional" }), ["good-game"] = Js.O({ effort = "Thanks, boss. I've got more running in me than that.", ideas = "I felt sharp. I could see things a second earlier.", discipline = "I just did what you asked of me.", professional = "Nice to hear. Next game's the one that matters now." }, { "effort", "ideas", "discipline", "professional" }) }, { "training", "role", "teammate", "tactics", "media", "bad-game", "good-game" })
	ANSWERS = Js.O({ press = Js.O({ best = Js.alit("That's what I want. Keep that up.", "Good. Show me on the grass."), neutral = Js.alit("Hm. Fine.", "Right. We'll see."), clash = Js.alit("That's not how we play here.", "Freedom? Earn it by running first.") }, { "best", "neutral", "clash" }), possession = Js.O({ best = Js.alit("Good. That's a footballer talking.", "Yes. Exactly that."), neutral = Js.alit("Okay. Moving on.", "Fine. Let's see it."), clash = Js.alit("I don't need a soldier. I need a footballer.", "Think for yourself out there. Please.") }, { "best", "neutral", "clash" }), low = Js.O({ best = Js.alit("Good lad. That's what this club needs.", "That's the answer. Keep it like that."), neutral = Js.alit("Hm. Okay.", "Right. Fine."), clash = Js.alit("No. You'll do it my way.", "Chasing everything leaves holes. Not in my team.") }, { "best", "neutral", "clash" }), mid = Js.O({ best = Js.alit("Sensible. That's what I wanted to hear.", "Good. Steady does it."), neutral = Js.alit("Okay. Noted.", "Right. We'll see."), clash = Js.alit("Calm down. Nobody needs a hero.", "Keep it simple. That's all I ask.") }, { "best", "neutral", "clash" }) }, { "press", "possession", "low", "mid" })
	ALL_VALUES = Js.alit("effort", "ideas", "discipline", "professional")
end
