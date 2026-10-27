--!nocheck
--!nolint
-- Generated from lib/star/scenarioStore.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_scenarios = import("lib/star/scenarios")
	local KEY, PENDING_KEY, readPending, writePending, ENDPOINT, isMatchScenario, read, write, listScenarios, loadScenario, saveScenario, deleteScenario, fetchSharedScenarios, saveScenarioShared, deleteScenarioShared
	readPending = function()
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = Js.localStorage.getItem(PENDING_KEY)
			local arr = (if Js.T(raw) then Js.JSON.parse(raw) else Js.alit())
			do return Js.RET, Js.Set.new((if Js.Array.isArray(arr) then A.filter(arr, function(x)
				return (type(x) == "string")
			end) else Js.alit())) end
		end)
		if not _ok1 then
			do return Js.Set.new() end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	writePending = function(ids)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(PENDING_KEY, Js.JSON.stringify(Js.Array.from(ids)))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	isMatchScenario = function(s)
		if (((not Js.T(s)) or (type(s) ~= "table")) or Js.Array.isArray(s)) then
			do return false end
		end
		local sc = s
		if ((type(sc.id) ~= "string") or (not Js.T(sc.id))) then
			do return false end
		end
		if (type(sc.name) ~= "string") then
			do return false end
		end
		if ((type(sc.kind) ~= "string") or (not Js.T(sc.kind))) then
			do return false end
		end
		local cam = sc.camera
		if (((((not cam) or (not Js.NumberNS.isFinite(cam.centerX))) or (not Js.NumberNS.isFinite(cam.centerY))) or (not Js.NumberNS.isFinite(cam.viewHeight))) or (type(cam.facing) ~= "string")) then
			do return false end
		end
		local ball = sc.ball
		if (((not ball) or (not Js.NumberNS.isFinite(ball.x))) or (not Js.NumberNS.isFinite(ball.y))) then
			do return false end
		end
		if (not Js.Array.isArray(sc.players)) then
			do return false end
		end
		do return A.every(sc.players, function(p)
			if ((not Js.T(p)) or (type(p) ~= "table")) then
				do return false end
			end
			local pl = p
			do return ((((type(pl.id) == "string") and (type(pl.side) == "string")) and Js.NumberNS.isFinite(pl.x)) and Js.NumberNS.isFinite(pl.y)) end
		end) end
	end
	read = function()
		local _ok7, _err8, _rv9 = pcall(function()
			local raw = Js.localStorage.getItem(KEY)
			if (not Js.T(raw)) then
				do return Js.RET, Js.O({}, nil) end
			end
			local parsed = Js.JSON.parse(raw)
			if (((not parsed) or (type(parsed) ~= "table")) or Js.Array.isArray(parsed)) then
				do return Js.RET, Js.O({}, nil) end
			end
			local out = Js.O({}, nil)
			do
				local _arr10 = Js.Object.entries(parsed)
				local _i11 = 0
				while _i11 < Js.alen(_arr10) do
					_i11 += 1
					local _e12 = _arr10[_i11]
					local id = _e12[1]
					local s = _e12[2]
					if isMatchScenario(s) then
						out[id] = M_scenarios.normaliseScenarioCamera(s)
					end
				end
			end
			do return Js.RET, out end
		end)
		if not _ok7 then
			do return Js.O({}, nil) end
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	write = function(all)
		local _ok13, _err14, _rv15 = pcall(function()
			Js.localStorage.setItem(KEY, Js.JSON.stringify(all))
		end)
		if not _ok13 then
		elseif _err14 == Js.RET then
			return _rv15
		end
	end
	listScenarios = function()
		do return A.sort(Js.Object.values(read()), function(a, b)
			return (b.updatedAt - a.updatedAt)
		end) end
	end
	exports.listScenarios = listScenarios
	loadScenario = function(id)
		do return (read()[id] or nil) end
	end
	exports.loadScenario = loadScenario
	saveScenario = function(scenario)
		local all = read()
		all[scenario.id] = Js.ospread(scenario, Js.O({ updatedAt = Js.Date.now() }, { "updatedAt" }))
		write(all)
	end
	exports.saveScenario = saveScenario
	deleteScenario = function(id)
		local all = read()
		Js.del(all, id)
		write(all)
	end
	exports.deleteScenario = deleteScenario
	fetchSharedScenarios = function()
		local res = nil
		local _ok16, _err17, _rv18 = pcall(function()
			res = Js.await(Js.fetch(ENDPOINT, Js.O({ cache = "no-store" }, { "cache" })))
		end)
		if not _ok16 then
			do return Js.O({ ok = false, message = "Couldn't reach the server — showing this browser's own scenarios." }, { "ok", "message" }) end
		elseif _err17 == Js.RET then
			return _rv18
		end
		local data = nil
		local _ok19, _err20, _rv21 = pcall(function()
			data = Js.await(res.json())
		end)
		if not _ok19 then
			do return Js.O({ ok = false, message = ("Server returned something unreadable (" .. Js.numstr(res.status) .. ").") }, { "ok", "message" }) end
		elseif _err20 == Js.RET then
			return _rv21
		end
		if (not res.ok) then
			do return Js.O({ ok = false, message = ((function() local _v = data; if _v == nil then return nil end; _v = _v.error; return _v end)() or ("Couldn't load shared scenarios (" .. Js.numstr(res.status) .. ").")) }, { "ok", "message" }) end
		end
		local incoming = Js.O({}, nil)
		if ((Js.T(data.scenarios) and (type(data.scenarios) == "table")) and (not Js.Array.isArray(data.scenarios))) then
			do
				local _arr22 = Js.Object.entries(data.scenarios)
				local _i23 = 0
				while _i23 < Js.alen(_arr22) do
					_i23 += 1
					local _e24 = _arr22[_i23]
					local id = _e24[1]
					local s = _e24[2]
					if isMatchScenario(s) then
						incoming[id] = M_scenarios.normaliseScenarioCamera(s)
					end
				end
			end
		end
		if (data.migrationMissing == true) then
			do return Js.O({ ok = true, migrationMissing = true, message = data.message, scenarios = listScenarios() }, { "ok", "migrationMissing", "message", "scenarios" }) end
		end
		local local_ = read()
		local pending = readPending()
		local next_ = Js.ospread(incoming)
		do
			local _arr25 = Js.Array.from(pending)
			local _i26 = 0
			while _i26 < Js.alen(_arr25) do
				_i26 += 1
				local id = _arr25[_i26]
				local mine = local_[id]
				local theirs = incoming[id]
				if (mine and ((not theirs) or ((if mine.updatedAt ~= nil then mine.updatedAt else 0) > (if theirs.updatedAt ~= nil then theirs.updatedAt else 0)))) then
					next_[id] = mine
				else
					pending:delete(id)
				end
			end
		end
		write(next_)
		writePending(pending)
		do return Js.O({ ok = true, message = data.message, scenarios = listScenarios() }, { "ok", "message", "scenarios" }) end
	end
	exports.fetchSharedScenarios = fetchSharedScenarios
	saveScenarioShared = function(scenario)
		local stamped = Js.ospread(scenario, Js.O({ updatedAt = Js.Date.now() }, { "updatedAt" }))
		saveScenario(stamped)
		local pending = readPending()
		pending:add(stamped.id)
		writePending(pending)
		local res = nil
		local _ok27, _err28, _rv29 = pcall(function()
			res = Js.await(Js.fetch(ENDPOINT, Js.O({ method = "POST", headers = Js.O({ ["Content-Type"] = "application/json" }, { "Content-Type" }), body = Js.JSON.stringify(Js.O({ scenario = stamped }, { "scenario" })) }, { "method", "headers", "body" })))
		end)
		if not _ok27 then
			do return Js.O({ ok = false, message = "Network error — saved on this device only." }, { "ok", "message" }) end
		elseif _err28 == Js.RET then
			return _rv29
		end
		if (not res.ok) then
			local body = Js.await(res.json():catch_(function()
				return Js.O({}, nil)
			end))
			do return Js.O({ ok = false, migrationMissing = (body.migrationMissing == true), message = (if body.error ~= nil then body.error else ("Server refused the save (" .. Js.numstr(res.status) .. ").")) }, { "ok", "migrationMissing", "message" }) end
		end
		local confirmed = readPending()
		confirmed:delete(stamped.id)
		writePending(confirmed)
		do return Js.O({ ok = true }, { "ok" }) end
	end
	exports.saveScenarioShared = saveScenarioShared
	deleteScenarioShared = function(id)
		local res = nil
		local _ok30, _err31, _rv32 = pcall(function()
			res = Js.await(Js.fetch((ENDPOINT .. "?id=" .. Js.encodeURIComponent(id)), Js.O({ method = "DELETE" }, { "method" })))
		end)
		if not _ok30 then
			do return Js.O({ ok = false, message = "Network error — nothing was deleted." }, { "ok", "message" }) end
		elseif _err31 == Js.RET then
			return _rv32
		end
		if (not res.ok) then
			local body = Js.await(res.json():catch_(function()
				return Js.O({}, nil)
			end))
			do return Js.O({ ok = false, migrationMissing = (body.migrationMissing == true), message = (if body.error ~= nil then body.error else ("Server refused the delete (" .. Js.numstr(res.status) .. ").")) }, { "ok", "migrationMissing", "message" }) end
		end
		deleteScenario(id)
		local pending = readPending()
		pending:delete(id)
		writePending(pending)
		do return Js.O({ ok = true }, { "ok" }) end
	end
	exports.deleteScenarioShared = deleteScenarioShared
	KEY = "star-scenarios-v1"
	PENDING_KEY = "star-scenarios-pending-v1"
	ENDPOINT = "/api/star/scenarios"
end
