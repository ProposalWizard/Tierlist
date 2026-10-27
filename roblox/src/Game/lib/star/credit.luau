--!nocheck
--!nolint
-- Generated from lib/star/credit.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local NO_CREDIT, creditChance, probeMatePlays, keyOf, noteMatePlays, assistFor
	creditChance = function(res, ctx)
		local isGoal = (M_canvasEngine.OUTCOME_TEXT[res].kind == "goal")
		if (res == "touchOn") then
			do return NO_CREDIT end
		end
		if (res == "delivered") then
			do return Js.ospread(NO_CREDIT, Js.O({ passes = 1, passesCompleted = 1 }, { "passes", "passesCompleted" })) end
		end
		if ctx.youShot then
			do return Js.ospread(NO_CREDIT, Js.O({ shots = 1, goals = (if isGoal then 1 else 0) }, { "shots", "goals" })) end
		end
		if ctx.receiverShot then
			local yours = (ctx.assistYours ~= false)
			do return Js.ospread(NO_CREDIT, Js.O({ passes = 1, passesCompleted = 1, assists = (if (isGoal and yours) then 1 else 0) }, { "passes", "passesCompleted", "assists" })) end
		end
		if ctx.isSimplePass then
			do return Js.ospread(NO_CREDIT, Js.O({ passes = 1, goals = (if isGoal then 1 else 0) }, { "passes", "goals" })) end
		end
		do return Js.ospread(NO_CREDIT, Js.O({ shots = 1, goals = (if isGoal then 1 else 0) }, { "shots", "goals" })) end
	end
	exports.creditChance = creditChance
	probeMatePlays = function(sc)
		do return Js.O({ receivedBy = sc.receivedBy, receiverShots = (if sc.receiverShots ~= nil then sc.receiverShots else 0), relayed = (sc.relayed == true), followerShot = (sc.follower.shot == true) }, { "receivedBy", "receiverShots", "relayed", "followerShot" }) end
	end
	exports.probeMatePlays = probeMatePlays
	keyOf = function(sc, r)
		if (not r) then
			do return Js.O({ key = "unknown" }, { "key" }) end
		end
		if r.who then
			do return Js.O({ key = ("id:" .. r.who.id), who = r.who }, { "key", "who" }) end
		end
		if (r == sc.runner) then
			do return Js.O({ key = "runner" }, { "key" }) end
		end
		local i = A.indexOf(sc.secondaryRunners, r)
		if (i >= 0) then
			do return Js.O({ key = ("support" .. Js.numstr(i)) }, { "key" }) end
		end
		do return Js.O({ key = (if sc.follower.who then ("id:" .. sc.follower.who.id) else "follower"), who = sc.follower.who }, { "key", "who" }) end
	end
	noteMatePlays = function(plays, before, sc)
		if ((not before.relayed) and (sc.relayed == true)) then
			A.push(plays, Js.ospread(Js.O({ kind = "layoff" }, { "kind" }), keyOf(sc, (if before.receivedBy ~= nil then before.receivedBy else sc.receivedBy))))
		end
		if ((if sc.receiverShots ~= nil then sc.receiverShots else 0) > before.receiverShots) then
			if ((not before.followerShot) and (sc.follower.shot == true)) then
				local who = sc.follower.who
				A.push(plays, Js.O({ kind = "shot", key = (if who then ("id:" .. who.id) else "follower"), who = who }, { "kind", "key", "who" }))
			else
				A.push(plays, Js.ospread(Js.O({ kind = "shot" }, { "kind" }), keyOf(sc, sc.receivedBy)))
			end
		end
	end
	exports.noteMatePlays = noteMatePlays
	assistFor = function(plays)
		local last = -1
		for i = (Js.alen(plays) - 1), 0, -1 do
			if (plays[i + 1].kind == "shot") then
				last = i
				do break end
			end
		end
		if (last < 0) then
			do return Js.O({ yours = true }, { "yours" }) end
		end
		local scorer = plays[last + 1].key
		do
			local i = (last - 1)
			local _first1 = true
			while true do
				if not _first1 then
					i -= 1
				end
				_first1 = false
				if not (i >= 0) then break end
				if (plays[i + 1].key ~= scorer) then
					do return Js.O({ yours = false, by = plays[i + 1] }, { "yours", "by" }) end
				end
			end
		end
		do return Js.O({ yours = true }, { "yours" }) end
	end
	exports.assistFor = assistFor
	NO_CREDIT = Js.O({ shots = 0, goals = 0, passes = 0, passesCompleted = 0, chances = 0, assists = 0 }, { "shots", "goals", "passes", "passesCompleted", "chances", "assists" })
	exports.NO_CREDIT = NO_CREDIT
end
