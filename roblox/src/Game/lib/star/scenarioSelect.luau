--!nocheck
--!nolint
-- Generated from lib/star/scenarioSelect.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_chanceFormula = import("lib/star/chanceFormula")
	local M_canvasEngine = import("lib/star/canvasEngine")
	local RECENT_MEMORY, newSelectionMemory, rememberChance, FREQ, freqKey, selectChance
	newSelectionMemory = function()
		do return Js.O({ recent = Js.alit() }, { "recent" }) end
	end
	exports.newSelectionMemory = newSelectionMemory
	rememberChance = function(mem, plan)
		A.unshift(mem.recent, plan.signature)
		if (Js.alen(mem.recent) > RECENT_MEMORY) then
			A.setlen(mem.recent, RECENT_MEMORY)
		end
	end
	exports.rememberChance = rememberChance
	freqKey = function(zone, lane)
		do return (zone .. "|" .. (if (lane == "centre") then "centre" else "wide")) end
	end
	selectChance = function(opts)
		local _d1 = opts
		local request = _d1.request
		local position = _d1.position
		local rng = _d1.rng
		local memory = _d1.memory
		if request.dribble then
			do return nil end
		end
		local bands = (if M_chanceFormula.ZONE_BANDS[request.zone] ~= nil then M_chanceFormula.ZONE_BANDS[request.zone] else Js.alit())
		if (Js.alen(bands) == 0) then
			do return nil end
		end
		local lane = (if request.lane ~= nil then request.lane else "centre")
		local prior = (FREQ[freqKey(request.zone, lane)] or Js.O({}, nil))
		local pool = Js.alit()
		do
			local _arr2 = request.kinds
			local _i3 = 0
			while _i3 < Js.alen(_arr2) do
				_i3 += 1
				local k = _arr2[_i3]
				local entries = Math.max(1, Math.round(((if prior[k] ~= nil then prior[k] else 0.5) * 4)))
				for i = 0, math.ceil(entries) - 1 do
					A.push(pool, k)
				end
			end
		end
		local kind = M_canvasEngine.pickScenarioKindFrom(position, rng, pool)
		local plan = M_chanceFormula.generateChance(Js.O({ zone = request.zone, kinds = Js.alit(kind), lane = lane, pattern = request.pattern }, { "zone", "kinds", "lane", "pattern" }), Js.O({ position = position }, { "position" }), rng, memory.recent)
		if (not plan) then
			do return nil end
		end
		rememberChance(memory, plan)
		do return M_chanceFormula.withShape(plan, opts.shape) end
	end
	exports.selectChance = selectChance
	RECENT_MEMORY = 8
	exports.RECENT_MEMORY = RECENT_MEMORY
	FREQ = Js.O({ ["box|centre"] = Js.O({ one_on_one = 1, volley = 0.8, header = 0.9, tight_angle = 0.8 }, { "one_on_one", "volley", "header", "tight_angle" }), ["box|wide"] = Js.O({ cutback = 1, tight_angle = 0.9, byline_cross = 0.9, header = 0.6, volley = 0.5 }, { "cutback", "tight_angle", "byline_cross", "header", "volley" }), ["attacking|centre"] = Js.O({ through_ball = 0.6, long_range = 0.5, one_on_one = 0.5, cutback = 0.4 }, { "through_ball", "long_range", "one_on_one", "cutback" }), ["attacking|wide"] = Js.O({ byline_cross = 1, cutback = 0.9, through_ball = 0.4, long_range = 0.3 }, { "byline_cross", "cutback", "through_ball", "long_range" }), ["middle|centre"] = Js.O({ buildup = 1, midfield_pass = 0.85, through_ball = 0.45, long_range = 0.35 }, { "buildup", "midfield_pass", "through_ball", "long_range" }), ["middle|wide"] = Js.O({ buildup = 1, midfield_pass = 0.85, through_ball = 0.45, long_range = 0.35 }, { "buildup", "midfield_pass", "through_ball", "long_range" }) }, { "box|centre", "box|wide", "attacking|centre", "attacking|wide", "middle|centre", "middle|wide" })
	exports.FREQ = FREQ
end
