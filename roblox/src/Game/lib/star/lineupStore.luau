--!nocheck
--!nolint
-- Generated from lib/star/lineupStore.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_formations = import("lib/star/formations")
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local KEY, read, loadLineup, managerFor, saveLineup, clearLineup, fetchSharedLineups, pushLineupShared, exportAll, importAll, pushAllShared
	read = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = Js.localStorage.getItem(KEY)
			if (not Js.T(raw)) then
				do return Js.RET, Js.O({}, nil) end
			end
			local parsed = Js.JSON.parse(raw)
			do return Js.RET, (if (parsed and (type(parsed) == "table")) then parsed else Js.O({}, nil)) end
		end)
		if not _ok1 then
			do return Js.O({}, nil) end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	loadLineup = function(club)
		local saved = read()[club]
		if ((not saved) or (not Js.Array.isArray(saved.xi))) then
			do return nil end
		end
		do return Js.O({ formation = (if Js.T(saved.formation) then saved.formation else M_formations.DEFAULT_FORMATION), xi = saved.xi, bench = (if Js.Array.isArray(saved.bench) then saved.bench else nil), manager = (if (type(saved.manager) == "string") then saved.manager else "") }, { "formation", "xi", "bench", "manager" }) end
	end
	exports.loadLineup = loadLineup
	managerFor = function(club)
		do return (function() local _l = (function() local _l = (function() local _v = loadLineup(club); if _v == nil then return nil end; _v = _v.manager; return _v end)(); if Js.T(_l) then return _l end; return (function() local _v = M_clubProfiles.profileOf(club); if _v == nil then return nil end; _v = _v.manager; return _v end)() end)(); if Js.T(_l) then return _l end; return "" end)() end
	end
	exports.managerFor = managerFor
	saveLineup = function(club, lineup)
		local _ok4, _err5, _rv6 = pcall(function()
			local all = read()
			all[club] = lineup
			Js.localStorage.setItem(KEY, Js.JSON.stringify(all))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.saveLineup = saveLineup
	clearLineup = function(club)
		local _ok7, _err8, _rv9 = pcall(function()
			local all = read()
			Js.del(all, club)
			Js.localStorage.setItem(KEY, Js.JSON.stringify(all))
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	exports.clearLineup = clearLineup
	fetchSharedLineups = function()
		local _ok10, _err11, _rv12 = pcall(function()
			local res = Js.await(Js.fetch("/api/star/lineups", Js.O({ cache = "no-store" }, { "cache" })))
			if (not res.ok) then
				do return Js.RET, Js.O({ ok = false }, { "ok" }) end
			end
			local data = Js.await(res.json())
			if (data.lineups and (type(data.lineups) == "table")) then
				local merged = Js.ospread(read(), data.lineups)
				Js.localStorage.setItem(KEY, Js.JSON.stringify(merged))
			end
			do return Js.RET, Js.O({ ok = true }, { "ok" }) end
		end)
		if not _ok10 then
			do return Js.O({ ok = false }, { "ok" }) end
		elseif _err11 == Js.RET then
			return _rv12
		end
	end
	exports.fetchSharedLineups = fetchSharedLineups
	pushLineupShared = function(club, lineup)
		local _ok13, _err14, _rv15 = pcall(function()
			local res = Js.await(Js.fetch("/api/star/lineups", Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.ospread(Js.O({ club = club }, { "club" }), lineup)) }, { "method", "headers", "body" })))
			if (not res.ok) then
				local body = Js.await(res.json():catch_(function()
					return Js.O({}, nil)
				end))
				do return Js.RET, Js.O({ ok = false, error = (if body.error ~= nil then body.error else ("Save failed (" .. Js.numstr(res.status) .. ")")) }, { "ok", "error" }) end
			end
			do return Js.RET, Js.O({ ok = true }, { "ok" }) end
		end)
		if not _ok13 then
			do return Js.O({ ok = false, error = "Network error — the save only landed locally, not on the server." }, { "ok", "error" }) end
		elseif _err14 == Js.RET then
			return _rv15
		end
	end
	exports.pushLineupShared = pushLineupShared
	exportAll = function()
		do return Js.JSON.stringify(read(), nil, 2) end
	end
	exports.exportAll = exportAll
	importAll = function(json)
		local parsed = nil
		local _ok16, _err17, _rv18 = pcall(function()
			parsed = Js.JSON.parse(json)
		end)
		if not _ok16 then
			do return Js.O({ ok = false, error = "That doesn't look like valid JSON — check nothing got cut off when you pasted it." }, { "ok", "error" }) end
		elseif _err17 == Js.RET then
			return _rv18
		end
		if (((not Js.T(parsed)) or (type(parsed) ~= "table")) or Js.Array.isArray(parsed)) then
			do return Js.O({ ok = false, error = "That JSON isn't a lineup backup — expected an object keyed by club name." }, { "ok", "error" }) end
		end
		local entries = A.filter(Js.Object.entries(parsed), function(_p19)
			local v = _p19[2]
			return (function() local _l = (if Js.T(v) then (type(v) == "table") else v); if Js.T(_l) then return Js.Array.isArray(v.xi) end; return _l end)()
		end)
		if (Js.alen(entries) == 0) then
			do return Js.O({ ok = false, error = "No valid lineups found in that JSON." }, { "ok", "error" }) end
		end
		local normalised = A.map(entries, function(_p20)
			local club = _p20[1]
			local lineup = _p20[2]
			return Js.alit(club, Js.O({ formation = (if Js.T(lineup.formation) then lineup.formation else M_formations.DEFAULT_FORMATION), xi = lineup.xi, bench = (if Js.Array.isArray(lineup.bench) then lineup.bench else nil), manager = (if (type(lineup.manager) == "string") then lineup.manager else "") }, { "formation", "xi", "bench", "manager" }))
		end)
		local _ok21, _err22, _rv23 = pcall(function()
			local all = read()
			do
				local _arr24 = normalised
				local _i25 = 0
				while _i25 < Js.alen(_arr24) do
					_i25 += 1
					local _e26 = _arr24[_i25]
					local club = _e26[1]
					local lineup = _e26[2]
					all[club] = lineup
				end
			end
			Js.localStorage.setItem(KEY, Js.JSON.stringify(all))
			do return Js.RET, Js.O({ ok = true, count = Js.alen(normalised), entries = normalised }, { "ok", "count", "entries" }) end
		end)
		if not _ok21 then
			do return Js.O({ ok = false, error = "Couldn't write to this browser's storage." }, { "ok", "error" }) end
		elseif _err22 == Js.RET then
			return _rv23
		end
	end
	exports.importAll = importAll
	pushAllShared = function(entries)
		local succeeded = Js.alit()
		local failed = Js.alit()
		do
			local _arr27 = entries
			local _i28 = 0
			while _i28 < Js.alen(_arr27) do
				_i28 += 1
				local _e29 = _arr27[_i28]
				local club = _e29[1]
				local lineup = _e29[2]
				local r = Js.await(pushLineupShared(club, lineup))
				if r.ok then
					A.push(succeeded, club)
				else
					A.push(failed, Js.O({ club = club, error = (if r.error ~= nil then r.error else "Save failed") }, { "club", "error" }))
				end
			end
		end
		do return Js.O({ succeeded = succeeded, failed = failed }, { "succeeded", "failed" }) end
	end
	exports.pushAllShared = pushAllShared
	KEY = "star-lineups-v1"
end
