--!nocheck
--!nolint
-- Generated from lib/star/fhr/realMomentHighlights.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_types = import("lib/star/realMoments/types")
	local M_shots = import("lib/star/realMoments/shots")
	local M_pitch = import("lib/star/pitch")
	local M_picks = import("lib/star/realMoments/picks")
	local M_pickStore = import("lib/star/realMoments/pickStore")
	local M_realMomentToggle = import("lib/star/fhr/realMomentToggle")
	local M_track = import("lib/star/realMoments/track")
	local REAL_MOMENT_SHARE_IN, REAL_MOMENT_SHARE, REAL_MOMENT_OF_ALL_IN, REAL_MOMENT_KINDS, REAL_MOMENT_MAX_M, REAL_MOMENT_MEMORY, servedKindOf, autoCheck, buildRealMomentPool, servable, inGameIds, POOL_KEY, LOADING_KEY, g, realMomentPool, setRealMomentPool, loadRealMomentPool, SERVED, realMomentIdOf, RECENT_KEY, recent, resetRealMomentMemory, serveRealMoment, realMomentLeadIn, REAL_MOMENT_LEAD_S, lastSecondsOf, gameStatus
	servedKindOf = function(m)
		if ((m.what ~= "shot") or (not M_types.isFullyReal(m))) then
			do return nil end
		end
		if (M_shots.airKindOf(m) == "high") then
			do return nil end
		end
		local k = M_shots.playKindForShot(m)
		do return (if A.includes(REAL_MOMENT_KINDS, k) then k else nil) end
	end
	exports.servedKindOf = servedKindOf
	autoCheck = function(m, track)
		if (m.what ~= "shot") then
			do return "a corner (only shots are served)" end
		end
		if (not M_types.isFullyReal(m)) then
			do return "not fully real" end
		end
		if (m["type"] ~= "Open Play") then
			do return ("a " .. S.toLowerCase(m["type"]) .. " (open play only)") end
		end
		if (not Js.T(servedKindOf(m))) then
			do return (if (M_shots.airKindOf(m) == "high") then "struck overhead (acrobatics are not built yet)" else "not a kind the game serves") end
		end
		if (Math.hypot((m.ball[1] - M_pitch.CX), m.ball[2]) > REAL_MOMENT_MAX_M) then
			do return ("struck from more than " .. Js.numstr(REAL_MOMENT_MAX_M) .. " m out") end
		end
		local k = M_shots.peopleOf(m).keeper
		if (((not k) or (k.y >= 12)) or (math.abs((k.x - M_pitch.CX)) >= 15)) then
			do return "their keeper is not by his goal" end
		end
		if (((function() local _v = m.ff; if _v == nil then return nil end; _v = Js.len(_v); return _v end)() or 0) < 19) then
			do return "not all 22 on the pitch" end
		end
		if (not track) then
			do return "no build-up" end
		end
		if (((Js.alen(track.ball) / 3) < 21) or (Js.alen(track.men) < 15)) then
			do return "the build-up is not whole" end
		end
		do return nil end
	end
	exports.autoCheck = autoCheck
	buildRealMomentPool = function(tracked, tracks)
		local byKind = Js.Map.new()
		local check = Js.Map.new()
		do
			local _arr1 = tracked.moments
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local m = _arr1[_i2]
				local tr = tracks.tracks[m.id]
				check:set(m.id, autoCheck(m, tr))
				local k = servedKindOf(m)
				if ((not Js.T(k)) or (not tr)) then
					do continue end
				end
				local list = (byKind:get(k) or Js.alit())
				A.push(list, m)
				byKind:set(k, list)
			end
		end
		do return Js.O({ byKind = byKind, tracks = tracks.tracks, check = check }, { "byKind", "tracks", "check" }) end
	end
	exports.buildRealMomentPool = buildRealMomentPool
	servable = function(pool, kind)
		do return A.filter((pool.byKind:get(kind) or Js.alit()), function(m)
			return M_picks.inGame(m.id, (pool.check:get(m.id) == nil))
		end) end
	end
	exports.servable = servable
	inGameIds = function(pool)
		local out = Js.Set.new()
		do
			local _arr3 = REAL_MOMENT_KINDS
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local k = _arr3[_i4]
				do
					local _arr5 = servable(pool, k)
					local _i6 = 0
					while _i6 < Js.alen(_arr5) do
						_i6 += 1
						local m = _arr5[_i6]
						out:add(m.id)
					end
				end
			end
		end
		do return out end
	end
	exports.inGameIds = inGameIds
	setRealMomentPool = function(p)
		g[POOL_KEY] = p
	end
	exports.setRealMomentPool = setRealMomentPool
	loadRealMomentPool = function()
		local have = realMomentPool()
		if have then
			do return Js.Promise.resolve(have) end
		end
		if ((Js.window == nil) or (Js.fetch == nil)) then
			do return Js.Promise.resolve(nil) end
		end
		local busy = g[LOADING_KEY]
		if busy then
			do return busy end
		end
		local get = function(file)
			return Js.fetch(("/api/star/real-moments?file=" .. file)):andThen(function(r)
				return (if r.ok then r.json() else Js.Promise.reject(Js.Error(Js.numstr(r.status))))
			end)
		end
		local p = Js.Promise.all(Js.alit(get("tracked"), get("tracks"), M_pickStore.ensureRealMomentPicks():catch_(function()
			return nil
		end))):andThen(function(_p7)
			local t = _p7[1]
			local tr = _p7[2]
			local pool = buildRealMomentPool(t, tr)
			setRealMomentPool(pool)
			do return pool end
		end):catch_(function()
			g[LOADING_KEY] = nil
			do return nil end
		end)
		g[LOADING_KEY] = p
		do return p end
	end
	exports.loadRealMomentPool = loadRealMomentPool
	recent = function()
		do return (function() if g[RECENT_KEY] == nil then g[RECENT_KEY] = Js.alit() end; return g[RECENT_KEY] end)() end
	end
	resetRealMomentMemory = function()
		g[RECENT_KEY] = Js.alit()
	end
	exports.resetRealMomentMemory = resetRealMomentMemory
	serveRealMoment = function(kind, rng, opts)
		if opts == nil then opts = Js.O({}, nil) end
		if ((not opts.force) and (not M_realMomentToggle.realMomentsOn())) then
			do return nil end
		end
		local pool = realMomentPool()
		if (not pool) then
			loadRealMomentPool()
			do return nil end
		end
		local all = servable(pool, kind)
		if (not Js.T(Js.alen(all))) then
			do return nil end
		end
		if ((not opts.force) and (rng() >= (if M_realMomentToggle.realMomentsEvery() then 1 else REAL_MOMENT_SHARE))) then
			do return nil end
		end
		local seen = Js.Set.new(recent())
		local fresh = A.filter(all, function(m)
			return (not seen:has(m.id))
		end)
		local from = (if Js.T(Js.alen(fresh)) then fresh else all)
		for t = 0, 3 do
			local m = from[math.fmod(math.floor((rng() * Js.alen(from))), Js.alen(from)) + 1]
			local sc = M_shots.scenarioForShot(m, Js.O({ wideFrame = true }, { "wideFrame" }))
			if ((not M_shots.frameHoldsShot(m, sc.viewport)) and (t < 3)) then
				do continue end
			end
			SERVED:set(sc, m.id)
			g.__starLastRealMoment = Js.O({ id = m.id, kind = kind, src = m.src, at = Js.Date.now() }, { "id", "kind", "src", "at" })
			local r = recent()
			A.push(r, m.id)
			if (Js.alen(r) > REAL_MOMENT_MEMORY) then
				A.splice(r, 0, (Js.alen(r) - REAL_MOMENT_MEMORY))
			end
			do return Js.O({ sc = sc, id = m.id, moment = m }, { "sc", "id", "moment" }) end
		end
		do return nil end
	end
	exports.serveRealMoment = serveRealMoment
	realMomentLeadIn = function(sc, moment)
		if (moment and (moment.opening or (not moment.fresh))) then
			do return nil end
		end
		local id = SERVED:get(sc)
		if (not Js.T(id)) then
			do return nil end
		end
		local tr = (function() local _v = realMomentPool(); if _v == nil then return nil end; _v = _v.tracks; _v = _v[id]; return _v end)()
		if (not tr) then
			do return nil end
		end
		local lead = M_track.trackLeadIn(tr, sc)
		do return Js.ospread(lastSecondsOf(lead, REAL_MOMENT_LEAD_S), Js.O({ skippable = true }, { "skippable" })) end
	end
	exports.realMomentLeadIn = realMomentLeadIn
	lastSecondsOf = function(lead, capS, o)
		if o == nil then o = Js.O({}, nil) end
		if (not (lead.durS > (capS + 0.05))) then
			do return lead end
		end
		local ps = (if lead.passStart ~= nil then lead.passStart else Js.alit())
		local pe = (if lead.passEnd ~= nil then lead.passEnd else Js.alit())
		local s = (lead.durS - capS)
		if (o.keepFrom ~= nil) then
			s = Math.min(s, o.keepFrom)
		else
			for i = 0, (Js.alen(ps)) - 1 do
				if ((s > ps[i + 1]) and (s < pe[i + 1])) then
					local back = Math.max(0, (ps[i + 1] - 0.2))
					s = (if ((s - back) <= 1.2) then back else pe[i + 1])
					do break end
				end
			end
		end
		if ((s <= 0.05) or (s >= (lead.durS - 1))) then
			do return lead end
		end
		local dur = (lead.durS - s)
		local T = function(t)
			return (if (t >= (dur - 1e-9)) then (lead.durS + Math.max(0, (t - dur))) else (t + s))
		end
		local keep = A.map(pe, function(e)
			return (e > s)
		end)
		local out = Js.ospread(lead, Js.O({ durS = dur, ballAt = function(t)
			return lead.ballAt(T(t))
		end, posAt = function(key, t)
			return lead.posAt(key, T(t))
		end, passStart = A.map(A.filter(ps, function(_, i)
			return keep[i + 1]
		end), function(t)
			return Math.max(0, (t - s))
		end), passEnd = A.map(A.filter(pe, function(_, i)
			return keep[i + 1]
		end), function(t)
			return (t - s)
		end) }, { "durS", "ballAt", "posAt", "passStart", "passEnd" }))
		if lead.captionAt then
			out.captionAt = function(t)
				return lead.captionAt(T(t))
			end
		end
		if lead.onTick then
			out.onTick = function(t, done)
				return lead.onTick(T(t), done)
			end
		end
		if (lead.whistleAt ~= nil) then
			out.whistleAt = Math.max(0, (lead.whistleAt - s))
		end
		do return out end
	end
	exports.lastSecondsOf = lastSecondsOf
	gameStatus = function(pool, id)
		local check = pool.check:get(id)
		local isServable = false
		do
			local _arr8 = Js.Array.from(pool.byKind:values())
			local _i9 = 0
			while _i9 < Js.alen(_arr8) do
				_i9 += 1
				local list = _arr8[_i9]
				if A.some(list, function(m)
					return (m.id == id)
				end) then
					isServable = true
					do break end
				end
			end
		end
		do return Js.O({ pick = M_picks.pickOf(id), check = check, inGame = (isServable and M_picks.inGame(id, (check == nil))), servable = isServable }, { "pick", "check", "inGame", "servable" }) end
	end
	exports.gameStatus = gameStatus
	REAL_MOMENT_SHARE_IN = 6
	exports.REAL_MOMENT_SHARE_IN = REAL_MOMENT_SHARE_IN
	REAL_MOMENT_SHARE = (1 / REAL_MOMENT_SHARE_IN)
	exports.REAL_MOMENT_SHARE = REAL_MOMENT_SHARE
	REAL_MOMENT_OF_ALL_IN = 10
	exports.REAL_MOMENT_OF_ALL_IN = REAL_MOMENT_OF_ALL_IN
	REAL_MOMENT_KINDS = Js.alit("one_on_one", "tight_angle", "long_range", "header", "volley")
	exports.REAL_MOMENT_KINDS = REAL_MOMENT_KINDS
	REAL_MOMENT_MAX_M = 35
	exports.REAL_MOMENT_MAX_M = REAL_MOMENT_MAX_M
	REAL_MOMENT_MEMORY = 40
	exports.REAL_MOMENT_MEMORY = REAL_MOMENT_MEMORY
	POOL_KEY = "__starRealMomentPool"
	LOADING_KEY = "__starRealMomentPoolLoading"
	g = Js.globalThis
	realMomentPool = function()
		return (if g[POOL_KEY] ~= nil then g[POOL_KEY] else nil)
	end
	exports.realMomentPool = realMomentPool
	if (not Js.T(g.__starRealMomentServed)) then
		g.__starRealMomentServed = Js.Map.new()
	end
	SERVED = g.__starRealMomentServed
	realMomentIdOf = function(sc)
		return SERVED:get(sc)
	end
	exports.realMomentIdOf = realMomentIdOf
	RECENT_KEY = "__starRealMomentRecent"
	REAL_MOMENT_LEAD_S = 3
	exports.REAL_MOMENT_LEAD_S = REAL_MOMENT_LEAD_S
end
