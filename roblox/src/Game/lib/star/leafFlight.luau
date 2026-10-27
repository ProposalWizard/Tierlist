--!nocheck
--!nolint
-- Generated from lib/star/leafFlight.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local LEAF, startLeaf, leafExtra, leafProgress, leafActive, stepLeaf
	startLeaf = function(ball, goalY)
		if goalY == nil then goalY = 0 end
		do return Js.O({ y0 = ball.pos.y, goalY = goalY }, { "y0", "goalY" }) end
	end
	exports.startLeaf = startLeaf
	leafExtra = function(u, shape)
		if shape == nil then shape = LEAF.shape end
		if (not ((u >= 0) and (u <= 1))) then
			do return 0 end
		end
		do return (shape * ((u * u) - LEAF.balance)) end
	end
	exports.leafExtra = leafExtra
	leafProgress = function(st, ball)
		local span = (st.y0 - st.goalY)
		do return (if (math.abs(span) < 0.000001) then 1 else ((st.y0 - ball.pos.y) / span)) end
	end
	exports.leafProgress = leafProgress
	leafActive = function(st, ball)
		if ((ball.lastTouch ~= nil) and (ball.lastTouch ~= "attack")) then
			do return false end
		end
		if (((ball.loose or ball.inNet) or ball.resting) or (ball.z <= LEAF.minZ)) then
			do return false end
		end
		local u = leafProgress(st, ball)
		do return ((u >= 0) and (u <= 1)) end
	end
	exports.leafActive = leafActive
	stepLeaf = function(st, ball, dt, shape)
		if shape == nil then shape = LEAF.shape end
		if (not leafActive(st, ball)) then
			do return end
		end
		local e = leafExtra(leafProgress(st, ball), shape)
		if (e == 0) then
			do return end
		end
		local vx = ball.vel.x
		local vy = ball.vel.y
		if ((Math.hypot(vx, vy) > 0.01) and (math.abs(ball.spin) > 0.0001)) then
			local k = (((e * ball.spin) * LEAF.curlK) * dt)
			ball.vel.x = (vx + (k * vy))
			ball.vel.y = (vy - (k * vx))
		end
		ball.vz -= ((e * LEAF.g) * dt)
	end
	exports.stepLeaf = stepLeaf
	LEAF = Js.O({ shape = 1.8, balance = 0.195, curlK = 0.48, g = 9.8, minZ = 0.05 }, { "shape", "balance", "curlK", "g", "minZ" })
	exports.LEAF = LEAF
end
