--!nocheck
--!nolint
-- Generated from lib/star/trainingLevelStore.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_trainingLevelData = import("lib/star/trainingLevelData")
	local KEY, PENDING_KEY, ENDPOINT, readJson, writeJson, cleanStore, pending, loadedLocal, loadLocal, fetched, ensureTrainingLevels, fetchSharedTrainingLevels, savedLevels, isPendingLevel, setLocal, saveTrainingLevel, resetTrainingLevel, commitTrainingLevels
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
	cleanStore = function(raw)
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
				local row = _e9[2]
				local p = M_trainingLevelData.parseLevelId(id)
				if p then
					out[id] = M_trainingLevelData.sanitizeLevel(p.skill, p.level, row)
				end
			end
		end
		do return out end
	end
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
		M_trainingLevelData.setTrainingOverlay(cleanStore(readJson(KEY, Js.O({}, nil))))
	end
	ensureTrainingLevels = function()
		loadLocal()
		if (Js.window == nil) then
			do return Js.Promise.resolve(Js.O({ shared = false }, { "shared" })) end
		end
		if (not fetched) then
			fetched = fetchSharedTrainingLevels()
		end
		do return fetched end
	end
	exports.ensureTrainingLevels = ensureTrainingLevels
	fetchSharedTrainingLevels = function()
		loadLocal()
		local _ok10, _err11, _rv12 = pcall(function()
			local res = Js.await(Js.fetch(ENDPOINT, Js.O({ cache = "no-store" }, { "cache" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if ((not res.ok) or (not body)) then
				do return Js.RET, Js.O({ shared = false, message = ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("Couldn't read the saved levels (" .. Js.numstr(res.status) .. ").")) }, { "shared", "message" }) end
			end
			if body.migrationMissing then
				do return Js.RET, Js.O({ shared = false, migrationMissing = true, message = body.message }, { "shared", "migrationMissing", "message" }) end
			end
			local server = cleanStore(body.levels)
			local local_ = cleanStore(readJson(KEY, Js.O({}, nil)))
			local keep = pending()
			do
				local _arr13 = Js.Array.from(keep)
				local _i14 = 0
				while _i14 < Js.alen(_arr13) do
					_i14 += 1
					local id = _arr13[_i14]
					if Js.T(local_[id]) then
						server[id] = local_[id]
					end
				end
			end
			writeJson(KEY, server)
			M_trainingLevelData.setTrainingOverlay(server)
			do return Js.RET, Js.O({ shared = true }, { "shared" }) end
		end)
		if not _ok10 then
			do return Js.O({ shared = false, message = "Couldn't reach the server — showing this device's copy." }, { "shared", "message" }) end
		elseif _err11 == Js.RET then
			return _rv12
		end
	end
	exports.fetchSharedTrainingLevels = fetchSharedTrainingLevels
	savedLevels = function()
		loadLocal()
		do return M_trainingLevelData.trainingOverlay() end
	end
	exports.savedLevels = savedLevels
	isPendingLevel = function(skill, level)
		do return pending():has(M_trainingLevelData.levelId(skill, level)) end
	end
	exports.isPendingLevel = isPendingLevel
	setLocal = function(id, row, isPending)
		local store = cleanStore(readJson(KEY, Js.O({}, nil)))
		if (row == nil) then
			Js.del(store, id)
		else
			store[id] = row
		end
		writeJson(KEY, store)
		M_trainingLevelData.setTrainingOverlay(store)
		local p = pending()
		if isPending then
			p:add(id)
		else
			p:delete(id)
		end
		writeJson(PENDING_KEY, Js.Array.from(p))
	end
	saveTrainingLevel = function(skill, level, config)
		local id = M_trainingLevelData.levelId(skill, level)
		local row = M_trainingLevelData.sanitizeLevel(skill, level, config)
		setLocal(id, row, true)
		local _ok15, _err16, _rv17 = pcall(function()
			local res = Js.await(Js.fetch(ENDPOINT, Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.O({ skill = skill, level = level, config = row }, { "skill", "level", "config" })) }, { "method", "headers", "body" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if res.ok then
				setLocal(id, row, false)
				do return Js.RET, Js.O({ shared = true, message = ("Saved for everyone — level " .. Js.numstr(level) .. " plays like this in every career now.") }, { "shared", "message" }) end
			end
			do return Js.RET, Js.O({ shared = false, migrationMissing = (function() local _v = body; if _v == nil then return nil end; _v = _v.migrationMissing; return _v end)(), message = ("Saved on this device only. " .. ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("The server said " .. Js.numstr(res.status) .. "."))) }, { "shared", "migrationMissing", "message" }) end
		end)
		if not _ok15 then
			do return Js.O({ shared = false, message = "Saved on this device only — couldn't reach the server." }, { "shared", "message" }) end
		elseif _err16 == Js.RET then
			return _rv17
		end
	end
	exports.saveTrainingLevel = saveTrainingLevel
	resetTrainingLevel = function(skill, level)
		local id = M_trainingLevelData.levelId(skill, level)
		setLocal(id, nil, false)
		local _ok18, _err19, _rv20 = pcall(function()
			local res = Js.await(Js.fetch((ENDPOINT .. "?id=" .. Js.encodeURIComponent(id)), Js.O({ method = "DELETE" }, { "method" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if res.ok then
				do return Js.RET, Js.O({ shared = true, message = ("Level " .. Js.numstr(level) .. " is back to the committed numbers for everyone.") }, { "shared", "message" }) end
			end
			do return Js.RET, Js.O({ shared = false, migrationMissing = (function() local _v = body; if _v == nil then return nil end; _v = _v.migrationMissing; return _v end)(), message = S.trim(("Cleared on this device only. " .. ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ""))) }, { "shared", "migrationMissing", "message" }) end
		end)
		if not _ok18 then
			do return Js.O({ shared = false, message = "Cleared on this device only — couldn't reach the server." }, { "shared", "message" }) end
		elseif _err19 == Js.RET then
			return _rv20
		end
	end
	exports.resetTrainingLevel = resetTrainingLevel
	commitTrainingLevels = function(edits)
		local _ok21, _err22, _rv23 = pcall(function()
			local res = Js.await(Js.fetch((ENDPOINT .. "/commit"), Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.O({ levels = A.map(edits, function(e)
				return Js.ospread(e, Js.O({ config = M_trainingLevelData.sanitizeLevel(e.skill, e.level, e.config) }, { "config" }))
			end) }, { "levels" })) }, { "method", "headers", "body" })))
			local body = Js.await(res.json():catch_(function()
				return nil
			end))
			if (res.ok and (function() local _v = body; if _v == nil then return nil end; _v = _v.ok; return _v end)()) then
				do return Js.RET, Js.O({ ok = true, message = (if body.message ~= nil then body.message else "Committed."), commitSha = body.commitSha }, { "ok", "message", "commitSha" }) end
			end
			do return Js.RET, Js.O({ ok = false, message = ((function() local _v = body; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("Nothing was committed (" .. Js.numstr(res.status) .. ").")) }, { "ok", "message" }) end
		end)
		if not _ok21 then
			do return Js.O({ ok = false, message = "Couldn't reach the server. Nothing was committed." }, { "ok", "message" }) end
		elseif _err22 == Js.RET then
			return _rv23
		end
	end
	exports.commitTrainingLevels = commitTrainingLevels
	KEY = "star-training-levels-v1"
	PENDING_KEY = "star-training-levels-pending-v1"
	ENDPOINT = "/api/star/training-levels"
	loadedLocal = false
	fetched = nil
end
