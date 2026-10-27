--!nocheck
--!nolint
-- Generated from lib/star/realMoments/picks.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_picks_json = import("data/realmoments/picks_json")
	local PICK_WORDS, isMomentId, cleanPicks, COMMITTED, committedPicks, LAYER_KEY, G, setPicksOverlay, picksOverlay, pickOf, inGame, mergePicksFile
	cleanPicks = function(raw)
		local out = Js.O({}, nil)
		if ((not Js.T(raw)) or (type(raw) ~= "table")) then
			do return out end
		end
		do
			local _arr1 = Js.Object.entries(raw)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local _e3 = _arr1[_i2]
				local id = _e3[1]
				local v = _e3[2]
				if (isMomentId(id) and ((v == "use") or (v == "dont"))) then
					out[id] = v
				end
			end
		end
		do return out end
	end
	exports.cleanPicks = cleanPicks
	setPicksOverlay = function(next_)
		G[LAYER_KEY] = Js.ospread(next_)
	end
	exports.setPicksOverlay = setPicksOverlay
	picksOverlay = function()
		do return (if G[LAYER_KEY] ~= nil then G[LAYER_KEY] else Js.O({}, nil)) end
	end
	exports.picksOverlay = picksOverlay
	pickOf = function(id, layer)
		if layer == nil then layer = picksOverlay() end
		if Js.has(layer, id) then
			do return (if layer[id] ~= nil then layer[id] else "auto") end
		end
		do return (if COMMITTED[id] ~= nil then COMMITTED[id] else "auto") end
	end
	exports.pickOf = pickOf
	inGame = function(id, passes, layer)
		local p = pickOf(id, layer)
		do return ((p == "use") or ((p == "auto") and passes)) end
	end
	exports.inGame = inGame
	mergePicksFile = function(text, edits)
		local file = nil
		local _ok4, _err5, _rv6 = pcall(function()
			file = Js.JSON.parse(text)
		end)
		if not _ok4 then
			file = Js.O({ picks = Js.O({}, nil) }, { "picks" })
		elseif _err5 == Js.RET then
			return _rv6
		end
		local picks = cleanPicks(file.picks)
		local ids = Js.alit()
		do
			local _arr7 = edits
			local _i8 = 0
			while _i8 < Js.alen(_arr7) do
				_i8 += 1
				local e = _arr7[_i8]
				if (not isMomentId(e.id)) then
					do continue end
				end
				if (e.value == "auto") then
					Js.del(picks, e.id)
				elseif ((e.value == "use") or (e.value == "dont")) then
					picks[e.id] = e.value
				else
					do continue end
				end
				A.push(ids, e.id)
			end
		end
		local sorted = Js.Object.fromEntries(A.map(A.sort(Js.Object.keys(picks)), function(k)
			return Js.alit(k, picks[k])
		end))
		local out = Js.O({ what = (if file.what ~= nil then file.what else M_picks_json.default.what), picks = sorted }, { "what", "picks" })
		do return Js.O({ text = (Js.JSON.stringify(out, nil, 2) .. "\n"), ids = ids }, { "text", "ids" }) end
	end
	exports.mergePicksFile = mergePicksFile
	PICK_WORDS = Js.O({ auto = "Automatic (in if it passes the checks)", use = "Use in game", dont = "Don't use" }, { "auto", "use", "dont" })
	exports.PICK_WORDS = PICK_WORDS
	isMomentId = function(id)
		return ((type(id) == "string") and Js.re("^[a-z]{2,4}[A-Za-z0-9_-]{1,60}$", ""):test(id))
	end
	exports.isMomentId = isMomentId
	COMMITTED = cleanPicks(M_picks_json.default.picks)
	committedPicks = function()
		return COMMITTED
	end
	exports.committedPicks = committedPicks
	LAYER_KEY = "__starRealMomentPicks"
	G = Js.globalThis
end
