--!nocheck
--!nolint
-- Generated from lib/star/authoredScenarios.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_authoredScenarios_json = import("lib/star/authoredScenarios_json")
	local M_scenarios = import("lib/star/scenarios")
	local isMatchScenario, AUTHORED_SCENARIOS, authoredScenarioList, authoredScenario, mergeAuthoredFile, removeFromAuthoredFile
	isMatchScenario = function(s)
		if (((not Js.T(s)) or (type(s) ~= "table")) or Js.Array.isArray(s)) then
			do return false end
		end
		local sc = s
		if ((type(sc.id) ~= "string") or (not Js.T(S.trim(sc.id)))) then
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
	exports.isMatchScenario = isMatchScenario
	authoredScenarioList = function()
		do return A.sort(Js.Object.values(AUTHORED_SCENARIOS), function(a, b)
			return ((if b.updatedAt ~= nil then b.updatedAt else 0) - (if a.updatedAt ~= nil then a.updatedAt else 0))
		end) end
	end
	exports.authoredScenarioList = authoredScenarioList
	authoredScenario = function(id)
		do return (if AUTHORED_SCENARIOS[id] ~= nil then AUTHORED_SCENARIOS[id] else nil) end
	end
	exports.authoredScenario = authoredScenario
	mergeAuthoredFile = function(currentText, incoming)
		local parsed = nil
		local _ok1, _err2, _rv3 = pcall(function()
			local p = Js.JSON.parse(currentText)
			parsed = (if ((Js.T(p) and (type(p) == "table")) and (not Js.Array.isArray(p))) then p else Js.O({}, nil))
		end)
		if not _ok1 then
			parsed = Js.O({}, nil)
		elseif _err2 == Js.RET then
			return _rv3
		end
		local scenarios = (if ((parsed.scenarios and (type(parsed.scenarios) == "table")) and (not Js.Array.isArray(parsed.scenarios))) then Js.ospread(parsed.scenarios) else Js.O({}, nil))
		local added = Js.alit()
		local replaced = Js.alit()
		do
			local _arr4 = incoming
			local _i5 = 0
			while _i5 < Js.alen(_arr4) do
				_i5 += 1
				local sc = _arr4[_i5]
				if Js.Object.prototype.hasOwnProperty.call(scenarios, sc.id) then
					A.push(replaced, sc.id)
				else
					A.push(added, sc.id)
				end
				scenarios[sc.id] = sc
			end
		end
		local next_ = Js.ospread(parsed, Js.O({ scenarios = scenarios }, { "scenarios" }))
		do return Js.O({ text = (Js.JSON.stringify(next_, nil, 2) .. "\n"), added = added, replaced = replaced }, { "text", "added", "replaced" }) end
	end
	exports.mergeAuthoredFile = mergeAuthoredFile
	removeFromAuthoredFile = function(currentText, ids)
		local parsed = nil
		local _ok6, _err7, _rv8 = pcall(function()
			local p = Js.JSON.parse(currentText)
			parsed = (if ((Js.T(p) and (type(p) == "table")) and (not Js.Array.isArray(p))) then p else Js.O({}, nil))
		end)
		if not _ok6 then
			parsed = Js.O({}, nil)
		elseif _err7 == Js.RET then
			return _rv8
		end
		local scenarios = (if ((parsed.scenarios and (type(parsed.scenarios) == "table")) and (not Js.Array.isArray(parsed.scenarios))) then Js.ospread(parsed.scenarios) else Js.O({}, nil))
		local removed = Js.alit()
		do
			local _arr9 = ids
			local _i10 = 0
			while _i10 < Js.alen(_arr9) do
				_i10 += 1
				local id = _arr9[_i10]
				if Js.Object.prototype.hasOwnProperty.call(scenarios, id) then
					Js.del(scenarios, id)
					A.push(removed, id)
				end
			end
		end
		local next_ = Js.ospread(parsed, Js.O({ scenarios = scenarios }, { "scenarios" }))
		do return Js.O({ text = (Js.JSON.stringify(next_, nil, 2) .. "\n"), removed = removed }, { "text", "removed" }) end
	end
	exports.removeFromAuthoredFile = removeFromAuthoredFile
	AUTHORED_SCENARIOS = (function()
		local out = Js.O({}, nil)
		local src = M_authoredScenarios_json.default.scenarios
		if ((not src) or (type(src) ~= "table")) then
			do return out end
		end
		do
			local _arr11 = Js.Object.entries(src)
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local _e13 = _arr11[_i12]
				local id = _e13[1]
				local value = _e13[2]
				if isMatchScenario(value) then
					out[id] = M_scenarios.normaliseScenarioCamera(value)
				elseif (Js.console ~= nil) then
					Js.console.warn(("authoredScenarios.json: dropping \"" .. id .. "\" — not a MatchScenario"))
				end
			end
		end
		do return out end
	end)()
	exports.AUTHORED_SCENARIOS = AUTHORED_SCENARIOS
end
