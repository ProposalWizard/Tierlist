--!nocheck
--!nolint
-- Generated from lib/star/kindRules/index.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_freeKick = import("lib/star/kindRules/freeKick")
	local M_penalty = import("lib/star/kindRules/penalty")
	local RULES, ruleFor, setupKind, enforceHardRules, strikeKind, replayStrike, stepKind
	ruleFor = function(kind)
		do return (if Js.T(kind) then RULES[kind] else nil) end
	end
	exports.ruleFor = ruleFor
	setupKind = function(sc, rng, ctx)
		(function() local _r = ruleFor(sc.kind); if _r == nil then return nil end; if _r.setup == nil then return nil end; return _r.setup(sc, rng, ctx) end)()
	end
	exports.setupKind = setupKind
	enforceHardRules = function(sc)
		(function() local _r = ruleFor(sc.kind); if _r == nil then return nil end; if _r.enforce == nil then return nil end; return _r.enforce(sc) end)()
	end
	exports.enforceHardRules = enforceHardRules
	strikeKind = function(sc, ball, rand, ctx)
		local r = ruleFor(sc.kind)
		if (not (function() local _v = r; if _v == nil then return nil end; _v = _v.decide; return _v end)()) then
			do return nil end
		end
		local draws = Js.Array.from(Js.O({ length = (if r.draws ~= nil then r.draws else 4) }, { "length" }), function()
			return rand()
		end)
		local d = r.decide(sc, ball, draws, ctx)
		if d then
			(function() local _f = r.apply; if _f == nil then return nil end; return _f(sc, ball, d) end)()
		end
		do return d end
	end
	exports.strikeKind = strikeKind
	replayStrike = function(sc, ball, d)
		(function() local _r = ruleFor(d.kind); if _r == nil then return nil end; if _r.apply == nil then return nil end; return _r.apply(sc, ball, d) end)()
	end
	exports.replayStrike = replayStrike
	stepKind = function(sc, ball, dt, d)
		if (not d) then
			do return end
		end;
		(function() local _r = ruleFor(d.kind); if _r == nil then return nil end; if _r.step == nil then return nil end; return _r.step(sc, ball, dt, d) end)()
	end
	exports.stepKind = stepKind
	Js.reexport(exports, M_freeKick, { ["isMatchFreeKick"] = "isMatchFreeKick", ["freeKickReaction"] = "freeKickReaction" })
	RULES = Js.O({ free_kick = M_freeKick.freeKickRules, penalty = M_penalty.penaltyRules }, { "free_kick", "penalty" })
end
