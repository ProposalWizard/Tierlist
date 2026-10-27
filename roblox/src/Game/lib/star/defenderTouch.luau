--!nocheck
--!nolint
-- Generated from lib/star/defenderTouch.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_canvasEngine = import("lib/star/canvasEngine")
	local isSecondPhase, turnAwayFromGoal, steerDeflectionFromOwnGoal, clearLooseWin
	isSecondPhase = function(ball, sc)
		do return (((sc.keeper.saves > 0) or (ball.deflected == "keeper")) or (ball.deflected == "frame")) end
	end
	exports.isSecondPhase = isSecondPhase
	turnAwayFromGoal = function(ball, sc)
		if (ball.vel.y >= 0) then
			do return false end
		end
		ball.vel = Js.O({ x = ball.vel.x, y = (-ball.vel.y) }, { "x", "y" })
		ball.spin = (-ball.spin)
		M_canvasEngine.markLanding(ball, sc)
		do return true end
	end
	exports.turnAwayFromGoal = turnAwayFromGoal
	steerDeflectionFromOwnGoal = function(ball, sc)
		if (not isSecondPhase(ball, sc)) then
			do return false end
		end
		do return turnAwayFromGoal(ball, sc) end
	end
	exports.steerDeflectionFromOwnGoal = steerDeflectionFromOwnGoal
	clearLooseWin = function(ball, sc)
		if ((ball.lastTouch ~= "defence") or (not ball.settling)) then
			do return false end
		end
		do return turnAwayFromGoal(ball, sc) end
	end
	exports.clearLooseWin = clearLooseWin
end
