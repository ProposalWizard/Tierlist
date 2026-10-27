--!nocheck
--!nolint
-- Generated from lib/star/realMoments/pickStore.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_picks = import("lib/star/realMoments/picks")
	local KEY, PENDING_KEY, PICKS_ENDPOINT, readJson, writeJson, cleanLayer, pending, loadedLocal, loadLocal, fetched, ensureRealMomentPicks, fetchSharedPicks, savedPicks, isPendingPick, setLocal, saveRealMomentPick, commitRealMomentPicks
	readJson = function(key, fallback)
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = (if (Js.localStorage == nil) then nil else Js.localStorage.getItem(key))
			do return Js.RET, (if Js.T(raw) then Js.JSON.parse(raw) else fallback) end
		end)
		if not _ok1 then
			do return fallback end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	writeJson = function(key, v)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(key, Js.JSON.stringify(v))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	cleanLayer = function(raw)
		local out = Js.O({}, nil)
		if ((not Js.T(raw)) or (type(raw) ~= "table")) then
			do return out end
		end
		do
			local _arr7 = Js.Object.entries(raw)
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local _e9 = _arr7[_i8]
				local id = _e9[1]
				local v = _e9[2]
				if (not M_picks.isMomentId(id)) then
					do continue end
				end
				if (((v == "use") or (v == "dont")) or (v == nil)) then
					out[id] = v
				end
			end
		end
		do return out end
	end
	exports.cleanLayer = cleanLayer
	pending = function()
		local arr = readJson(PENDING_KEY, Js.alit())
		do return Js.Set.new((if Js.Array.isArray(arr) then A.filter(arr, function(x)
			return (type(x) == "string")
		end) else Js.alit())) end
	end
	loadLocal = function()
		if (loadedLocal or (Js.window == nil)) then
			do return end
		end
		loadedLocal = true
		M_picks.setPicksOverlay(cleanLayer(readJson(KEY, Js.O({}, nil))))
	end
	ensureRealMomentPicks = function()
		loadLocal()
		if (Js.window == nil) then
			do return Js.Promise.resolve(Js.O({ shared = false }, { "shared" })) end
		end
		if (not fetched) then
			fetched = fetchSharedPicks()
		end
		do return fetched end
	end
	exports.ensureRealMomentPicks = ensureRealMomentPicks
	fetchSharedPicks = function()
		loadLocal()
		local _ok10, _err11, _rv12 = pcall(function()
			local res = Js.await(Js.fetch(PICKS_ENDPOINT, Js.O({ cache = "no-store" }, { "cache" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if ((not res.ok) or (not body)) then
				do return Js.RET, Js.O({ shared = false, message = ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("Couldn't read the saved marks (" .. Js.numstr(res.status) .. ").")) }, { "shared", "message" }) end
			end
			if body.migrationMissing then
				do return Js.RET, Js.O({ shared = false, migrationMissing = true, message = body.message }, { "shared", "migrationMissing", "message" }) end
			end
			local server = cleanLayer(body.picks)
			local local_ = cleanLayer(readJson(KEY, Js.O({}, nil)))
			do
				local _arr13 = Js.Array.from(pending())
				local _i14 = 0
				while _i14 < Js.alen(_arr13) do
					_i14 += 1
					local id = _arr13[_i14]
					if Js.has(local_, id) then
						server[id] = local_[id]
					end
				end
			end
			writeJson(KEY, server)
			M_picks.setPicksOverlay(server)
			do return Js.RET, Js.O({ shared = true }, { "shared" }) end
		end)
		if not _ok10 then
			do return Js.O({ shared = false, message = "Couldn't reach the server — using this device's marks." }, { "shared", "message" }) end
		elseif _err11 == Js.RET then
			return _rv12
		end
	end
	exports.fetchSharedPicks = fetchSharedPicks
	savedPicks = function()
		loadLocal()
		do return M_picks.picksOverlay() end
	end
	exports.savedPicks = savedPicks
	setLocal = function(id, v, isPending)
		local store = cleanLayer(readJson(KEY, Js.O({}, nil)))
		store[id] = v
		writeJson(KEY, store)
		M_picks.setPicksOverlay(store)
		local p = pending()
		if isPending then
			p:add(id)
		else
			p:delete(id)
		end
		writeJson(PENDING_KEY, Js.Array.from(p))
	end
	saveRealMomentPick = function(id, value)
		if (not M_picks.isMomentId(id)) then
			do return Js.O({ shared = false, message = "That isn't a moment id." }, { "shared", "message" }) end
		end
		local v = (if (value == "auto") then nil else value)
		setLocal(id, v, true)
		local _ok15, _err16, _rv17 = pcall(function()
			local res = Js.await(Js.fetch(PICKS_ENDPOINT, Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.O({ id = id, value = value }, { "id", "value" })) }, { "method", "headers", "body" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if res.ok then
				setLocal(id, v, false)
				do return Js.RET, Js.O({ shared = true, message = "Saved for everyone: every game reads it now." }, { "shared", "message" }) end
			end
			do return Js.RET, Js.O({ shared = false, migrationMissing = (function() local _v = body; if _v == nil then return nil end; _v = _v.migrationMissing; return _v end)(), message = ("Saved on this device only. " .. ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("The server said " .. Js.numstr(res.status) .. "."))) }, { "shared", "migrationMissing", "message" }) end
		end)
		if not _ok15 then
			do return Js.O({ shared = false, message = "Saved on this device only — couldn't reach the server." }, { "shared", "message" }) end
		elseif _err16 == Js.RET then
			return _rv17
		end
	end
	exports.saveRealMomentPick = saveRealMomentPick
	commitRealMomentPicks = function(edits)
		local _ok18, _err19, _rv20 = pcall(function()
			local res = Js.await(Js.fetch((PICKS_ENDPOINT .. "/commit"), Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.O({ picks = edits }, { "picks" })) }, { "method", "headers", "body" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if (res.ok and (function() local _v = body; if _v == nil then return nil end; _v = _v.ok; return _v end)()) then
				do return Js.RET, Js.O({ ok = true, message = (if body.message ~= nil then body.message else "Committed."), commitSha = body.commitSha }, { "ok", "message", "commitSha" }) end
			end
			do return Js.RET, Js.O({ ok = false, message = ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("Nothing was committed (" .. Js.numstr(res.status) .. ").")) }, { "ok", "message" }) end
		end)
		if not _ok18 then
			do return Js.O({ ok = false, message = "Couldn't reach the server. Nothing was committed." }, { "ok", "message" }) end
		elseif _err19 == Js.RET then
			return _rv20
		end
	end
	exports.commitRealMomentPicks = commitRealMomentPicks
	KEY = "star-real-moment-picks-v1"
	PENDING_KEY = "star-real-moment-picks-pending-v1"
	PICKS_ENDPOINT = "/api/star/real-moment-picks"
	exports.PICKS_ENDPOINT = PICKS_ENDPOINT
	loadedLocal = false
	fetched = nil
	isPendingPick = function(id)
		return pending():has(id)
	end
	exports.isPendingPick = isPendingPick
end
