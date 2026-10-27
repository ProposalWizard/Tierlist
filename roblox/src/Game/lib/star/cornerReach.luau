--!nocheck
--!nolint
-- Generated from lib/star/cornerReach.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local M_season = import("lib/star/season")
	local M_pitch = import("lib/star/pitch")
	local BOX_MIDDLE, cache, emptyCorner, carryOf, cornerReach, canTakeCorners, withCornerReach
	emptyCorner = function()
		local sc = M_canvasEngine.buildScenario("corner", M_season.mulberry32(7), 70, 50, 60)
		do return Js.ospread(sc, Js.O({ defenders = Js.alit(), teammates = Js.alit(), secondaryRunners = Js.alit(), runner = nil, follower = Js.ospread(sc.follower, Js.O({ x = -200, y = -200 }, { "x", "y" })), keeper = Js.ospread(sc.keeper, Js.O({ x = -100, y = -100 }, { "x", "y" })) }, { "defenders", "teammates", "secondaryRunners", "runner", "follower", "keeper" })) end
	end
	carryOf = function(skills, cy)
		local sc = emptyCorner()
		local dx = (BOX_MIDDLE.x - sc.ball.x)
		local dy = (BOX_MIDDLE.y - sc.ball.y)
		local L = Math.hypot(dx, dy)
		do return M_canvasEngine.airCarry(sc, Js.O({ x = (dx / L), y = (dy / L) }, { "x", "y" }), 1, cy, skills) end
	end
	cornerReach = function(skills)
		local key = (Js.numstr(Math.round(skills.power)) .. ":" .. Js.numstr(Math.round(skills.technique)))
		local hit = cache:get(key)
		if hit then
			do return hit end
		end
		local flag = emptyCorner().ball
		local needed = Math.hypot((BOX_MIDDLE.x - flag.x), (BOX_MIDDLE.y - flag.y))
		local carry = 0
		do
			local cy = 0
			local _first1 = true
			while true do
				if not _first1 then
					cy += 0.1
				end
				_first1 = false
				if not (cy <= 1.0001) then break end
				carry = Math.max(carry, carryOf(skills, cy))
			end
		end
		local out = Js.O({ carry = carry, needed = needed, ok = (carry >= needed) }, { "carry", "needed", "ok" })
		cache:set(key, out)
		do return out end
	end
	exports.cornerReach = cornerReach
	canTakeCorners = function(skills)
		do return cornerReach(skills).ok end
	end
	exports.canTakeCorners = canTakeCorners
	withCornerReach = function(inputs, skills)
		if (inputs.canTakeCorners ~= nil) then
			do return inputs end
		end
		local s = (if skills ~= nil then skills else Js.O({ power = (if inputs.playerSkill ~= nil then inputs.playerSkill else 70), technique = (if inputs.playerSkill ~= nil then inputs.playerSkill else 70) }, { "power", "technique" }))
		do return Js.ospread(inputs, Js.O({ canTakeCorners = canTakeCorners(s) }, { "canTakeCorners" })) end
	end
	exports.withCornerReach = withCornerReach
	BOX_MIDDLE = Js.O({ x = M_pitch.CX, y = (M_pitch.BOX_DEPTH / 2) }, { "x", "y" })
	exports.BOX_MIDDLE = BOX_MIDDLE
	cache = Js.Map.new()
end
