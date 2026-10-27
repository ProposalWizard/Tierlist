--!nocheck
--!nolint
-- Generated from lib/star/tuningStore.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_tuning = import("lib/star/tuning")
	local SCALAR_KEY, PRICE_KEY, hasLocalStorage, readJson, writeJson, DEFAULTS, getTuning, getTuningOverrides, setTuningOverride, resetTuning, resetAllTuning, getPriceOverride, setPriceOverride, resetPriceOverride, getCataloguePriceOverrides, applyPriceOverrides
	hasLocalStorage = function()
		do return (Js.localStorage ~= nil) end
	end
	readJson = function(key, fallback)
		if (not hasLocalStorage()) then
			do return fallback end
		end
		local _ok1, _err2, _rv3 = pcall(function()
			local raw = Js.localStorage.getItem(key)
			if (not Js.T(raw)) then
				do return Js.RET, fallback end
			end
			local parsed = Js.JSON.parse(raw)
			do return Js.RET, (if (Js.T(parsed) and (type(parsed) == "table")) then parsed else fallback) end
		end)
		if not _ok1 then
			do return fallback end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	writeJson = function(key, value)
		if (not hasLocalStorage()) then
			do return end
		end
		local _ok4, _err5, _rv6 = pcall(function()
			Js.localStorage.setItem(key, Js.JSON.stringify(value))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	getTuning = function(key)
		local fallback = DEFAULTS:get(key)
		if (fallback == nil) then
			if (Js.idx(Js.process.env, "NODE_ENV") ~= "production") then
				Js.console.error(("getTuning: no registry entry for \"" .. key .. "\""))
			end
			do return 0 end
		end
		local v = readJson(SCALAR_KEY, Js.O({}, nil))[key]
		do return (if ((type(v) == "number") and Js.NumberNS.isFinite(v)) then v else fallback) end
	end
	exports.getTuning = getTuning
	getTuningOverrides = function()
		do return readJson(SCALAR_KEY, Js.O({}, nil)) end
	end
	exports.getTuningOverrides = getTuningOverrides
	setTuningOverride = function(key, value)
		local all = readJson(SCALAR_KEY, Js.O({}, nil))
		all[key] = value
		writeJson(SCALAR_KEY, all)
	end
	exports.setTuningOverride = setTuningOverride
	resetTuning = function(key)
		local all = readJson(SCALAR_KEY, Js.O({}, nil))
		Js.del(all, key)
		writeJson(SCALAR_KEY, all)
	end
	exports.resetTuning = resetTuning
	resetAllTuning = function()
		writeJson(SCALAR_KEY, Js.O({}, nil))
		writeJson(PRICE_KEY, Js.O({}, nil))
	end
	exports.resetAllTuning = resetAllTuning
	getPriceOverride = function(catalogue, itemId, field)
		local all = readJson(PRICE_KEY, Js.O({}, nil))
		local v = (function() local _v = all[catalogue]; if _v == nil then return nil end; _v = _v[itemId]; if _v == nil then return nil end; _v = _v[field]; return _v end)()
		do return (if ((type(v) == "number") and Js.NumberNS.isFinite(v)) then v else nil) end
	end
	exports.getPriceOverride = getPriceOverride
	setPriceOverride = function(catalogue, itemId, field, value)
		local all = readJson(PRICE_KEY, Js.O({}, nil))
		if all[catalogue] == nil then all[catalogue] = Js.O({}, nil) end
		if all[catalogue][itemId] == nil then all[catalogue][itemId] = Js.O({}, nil) end
		all[catalogue][itemId][field] = value
		writeJson(PRICE_KEY, all)
	end
	exports.setPriceOverride = setPriceOverride
	resetPriceOverride = function(catalogue, itemId, field)
		local all = readJson(PRICE_KEY, Js.O({}, nil))
		if (function() local _v = all[catalogue]; if _v == nil then return nil end; _v = _v[itemId]; return _v end)() then
			Js.del(all[catalogue][itemId], field)
		end
		writeJson(PRICE_KEY, all)
	end
	exports.resetPriceOverride = resetPriceOverride
	getCataloguePriceOverrides = function(catalogue)
		do return (readJson(PRICE_KEY, Js.O({}, nil))[catalogue] or Js.O({}, nil)) end
	end
	exports.getCataloguePriceOverrides = getCataloguePriceOverrides
	applyPriceOverrides = function(catalogue, rows)
		local overrides = getCataloguePriceOverrides(catalogue)
		if (Js.alen(Js.Object.keys(overrides)) == 0) then
			do return Js.aspread(rows) end
		end
		do return A.map(rows, function(row)
			local fields = overrides[row.id]
			if (not fields) then
				do return row end
			end
			do return Js.ospread(row, fields) end
		end) end
	end
	exports.applyPriceOverrides = applyPriceOverrides
	SCALAR_KEY = "star-tuning-v1"
	PRICE_KEY = "star-tuning-prices-v1"
	DEFAULTS = Js.Map.new(A.map(M_tuning.TUNABLES, function(t)
		return Js.alit(t.key, t.default)
	end))
end
