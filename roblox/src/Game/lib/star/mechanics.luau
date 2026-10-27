--!nocheck
--!nolint
-- Generated from lib/star/mechanics.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local games, skill, AERIAL_AFTER_GAMES, DRIBBLE_AFTER_GAMES, MECHANICS, BY_ID, mechanicDef, isStory, mechanicOpen, mechanicsFor, aerialIntroGame, mechanicGuideDue
	mechanicOpen = function(c, id)
		if ((not c) or (not isStory(c))) then
			do return true end
		end
		local m = BY_ID[id]
		do return (m.released and m.opens(c)) end
	end
	exports.mechanicOpen = mechanicOpen
	mechanicsFor = function(c)
		local out = Js.O({}, nil)
		do
			local _arr1 = MECHANICS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				out[m.id] = mechanicOpen(c, m.id)
			end
		end
		do return out end
	end
	exports.mechanicsFor = mechanicsFor
	aerialIntroGame = function(c)
		do return (((not (not c)) and isStory(c)) and (games(c) == AERIAL_AFTER_GAMES)) end
	end
	exports.aerialIntroGame = aerialIntroGame
	mechanicGuideDue = function(c)
		if (not isStory(c)) then
			do return nil end
		end
		do
			local _arr3 = MECHANICS
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local m = _arr3[_i4]
				if ((m.released and m.opens(c)) and (not A.includes(c.unlocks.seen, ("mech-" .. m.id)))) then
					do return m.id end
				end
			end
		end
		do return nil end
	end
	exports.mechanicGuideDue = mechanicGuideDue
	games = function(c)
		return ((function() local _v = c.careerStats; if _v == nil then return nil end; _v = _v.appearances; return _v end)() or 0)
	end
	skill = function(c, k)
		return ((function() local _v = c.skills; if _v == nil then return nil end; _v = _v[k]; return _v end)() or 0)
	end
	AERIAL_AFTER_GAMES = 3
	exports.AERIAL_AFTER_GAMES = AERIAL_AFTER_GAMES
	DRIBBLE_AFTER_GAMES = 4
	exports.DRIBBLE_AFTER_GAMES = DRIBBLE_AFTER_GAMES
	MECHANICS = Js.alit(Js.O({ id = "aerial", released = true, when = "After your third game", opens = function(c)
		return (games(c) >= AERIAL_AFTER_GAMES)
	end, guide = Js.O({ icon = "🤸", title = "Headers and volleys", line = "Crosses can come to you in the air now. When one does, tap the ball before the ring runs out. Its left side sends it right. Your Aerial drill is open in Training." }, { "icon", "title", "line" }), firstUse = nil }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "steer", released = true, when = "Pace 60", opens = function(c)
		return (skill(c, "pace") >= 60)
	end, guide = Js.O({ icon = "🧭", title = "Steer your run", line = "After you pass, you can steer where you run. Hold your thumb on the left of the screen and push, or use W A S D on a computer. Let go and you run on your own." }, { "icon", "title", "line" }), firstUse = "Steer your run: thumb on the left and push, or W A S D" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "sprint", released = true, when = "Pace 65", opens = function(c)
		return (skill(c, "pace") >= 65)
	end, guide = Js.O({ icon = "💨", title = "Sprint", line = "Push the stick all the way, or hold Shift, to sprint. It drains the stamina bar, and the bar never fills past your match energy." }, { "icon", "title", "line" }), firstUse = "Push all the way, or hold Shift, to sprint. Watch your stamina" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "dribble", released = true, when = "After your fourth game", opens = function(c)
		return (games(c) >= DRIBBLE_AFTER_GAMES)
	end, guide = Js.O({ icon = "⚽", title = "Moving with the ball", line = "Sometimes the ball comes to you with space to run into. Flick to run with it, tap a team-mate to pass, and shoot when you're through." }, { "icon", "title", "line" }), firstUse = "Space to run into! Flick to run with the ball, tap a team-mate to pass" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "powerShot", released = false, when = "Power 60", opens = function(c)
		return (skill(c, "power") >= 60)
	end, guide = Js.O({ icon = "⚡", title = "Power shot", line = "Tap ⚡ Power shot on the aim screen. You wind up, then hit the green circle fast for up to one and a half times the pace. The defence closes while you wind up." }, { "icon", "title", "line" }), firstUse = "New: ⚡ Power shot. Tap it, then hit the circle fast" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "knuckle", released = false, when = "Power 70 and Technique 60", opens = function(c)
		return ((skill(c, "power") >= 70) and (skill(c, "technique") >= 60))
	end, guide = Js.O({ icon = "🌀", title = "Knuckleball", line = "Hit a hard shot through the dead centre of the ball and it wobbles late. Keepers hate it." }, { "icon", "title", "line" }), firstUse = "Knuckleball: a hard shot through the dead centre of the ball" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "skillMoves", released = false, when = "Technique 65", opens = function(c)
		return (skill(c, "technique") >= 65)
	end, guide = Js.O({ icon = "🪄", title = "Skill moves", line = "When a defender backs off, swipe down on a side to sell a step-over, then go the other way." }, { "icon", "title", "line" }), firstUse = "Swipe down on a side: step-over" }, { "id", "released", "when", "opens", "guide", "firstUse" }), Js.O({ id = "oneTwo", released = false, when = "Vision 60", opens = function(c)
		return (skill(c, "vision") >= 60)
	end, guide = Js.O({ icon = "🔁", title = "One-twos", line = "Pass, then call for it back: tap Call for it while your team-mate has the ball and he plays it straight back into your run." }, { "icon", "title", "line" }), firstUse = "Call for it to get the ball straight back" }, { "id", "released", "when", "opens", "guide", "firstUse" }))
	exports.MECHANICS = MECHANICS
	BY_ID = Js.Object.fromEntries(A.map(MECHANICS, function(m)
		return Js.alit(m.id, m)
	end))
	mechanicDef = function(id)
		return BY_ID[id]
	end
	exports.mechanicDef = mechanicDef
	isStory = function(c)
		return (not (not (function() local _v = c.unlocks; if _v == nil then return nil end; _v = _v.story; return _v end)()))
	end
end
