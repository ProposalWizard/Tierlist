--!nocheck
--!nolint
-- Generated from lib/star/media/detect/result.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local FULL_TIME = function(r)
		return M_kit.ev((if (r.result == "win") then "win" else (if (r.result == "draw") then "draw" else "loss")), M_kit.club(r), (if (r.result == "win") then 34 else (if (r.result == "draw") then 22 else 26)), Js.alit("table"), Js.ospread(M_kit.base(r), Js.O({ margin = math.abs((r.score.us - r.score.them)) }, { "margin" })), "instant")
	end
	local ROUT = function(r)
		local margin = (r.score.us - r.score.them)
		if (margin < 3) then
			do return nil end
		end
		do return M_kit.ev("rout", M_kit.club(r), (54 + (margin * 4)), Js.alit("table", "drama"), Js.ospread(M_kit.base(r), Js.O({ margin = margin }, { "margin" })), "instant") end
	end
	local HAMMERED = function(r)
		local margin = (r.score.them - r.score.us)
		if (margin < 3) then
			do return nil end
		end
		do return M_kit.ev("hammered", M_kit.club(r), (50 + (margin * 5)), Js.alit("shame", "drama"), Js.ospread(M_kit.base(r), Js.O({ margin = margin }, { "margin" })), "instant", "crisis") end
	end
	local COMEBACK = function(r)
		if (r.result ~= "win") then
			do return nil end
		end
		local worst = 0
		do
			local _arr1 = r.goals
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local g = _arr1[_i2]
				if (not g.scoreAfter) then
					do return nil end
				end
				worst = Math.max(worst, (g.scoreAfter.them - g.scoreAfter.us))
			end
		end
		if (worst < 2) then
			do return nil end
		end
		do return M_kit.ev("comeback", M_kit.club(r), (60 + (worst * 8)), Js.alit("drama", "table"), Js.ospread(M_kit.base(r), Js.O({ deficit = worst }, { "deficit" })), "instant") end
	end
	local COLLAPSE = function(r)
		if (r.result == "win") then
			do return nil end
		end
		local best = 0
		do
			local _arr3 = r.goals
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local g = _arr3[_i4]
				if (not g.scoreAfter) then
					do return nil end
				end
				best = Math.max(best, (g.scoreAfter.us - g.scoreAfter.them))
			end
		end
		if (best < 2) then
			do return nil end
		end
		do return M_kit.ev("collapse", M_kit.club(r), (58 + (best * 6)), Js.alit("shame", "drama"), Js.ospread(M_kit.base(r), Js.O({ lead = best }, { "lead" })), "instant", "crisis") end
	end
	local CLEAN_SHEET = function(r)
		if (r.score.them ~= 0) then
			do return nil end
		end
		do return M_kit.ev("clean-sheet", M_kit.club(r), (if (r.result == "win") then 30 else 24), Js.alit("keeper", "stat"), Js.ospread(M_kit.base(r)), "hour", "clean-sheets") end
	end
	local UPSET = function(r)
		local gap = (r.opponentStrength - r.clubStrength)
		if ((r.result == "win") and (gap >= 12)) then
			do return M_kit.ev((if (r.kind == "league") then "upset" else "cup-shock"), M_kit.club(r), Math.min(92, (54 + (gap * 1.6))), Js.alit("drama", "table", (if (r.kind == "league") then "table" else "cup")), Js.ospread(M_kit.base(r), Js.O({ gap = Math.round(gap) }, { "gap" })), "instant") end
		end
		if ((r.result == "loss") and (gap <= -12)) then
			do return M_kit.ev("embarrassed", M_kit.club(r), Math.min(80, (44 + (math.abs(gap) * 1.4))), Js.alit("shame", "drama"), Js.ospread(M_kit.base(r), Js.O({ gap = Math.round(math.abs(gap)) }, { "gap" })), "instant", "crisis") end
		end
		do return nil end
	end
	local RIVALRY_BOOST = Js.O({ R1 = 18, R2 = 10, R3 = 4 }, { "R1", "R2", "R3" })
	local DERBY = function(r)
		if (not r.derby) then
			do return nil end
		end
		local id = (if (r.result == "win") then "derby-win" else (if (r.result == "loss") then "derby-loss" else "derby-draw"))
		local boost = (if Js.T(r.rivalryTier) then RIVALRY_BOOST[r.rivalryTier] else 0)
		do return M_kit.ev(id, M_kit.club(r), Math.min(96, ((if (r.result == "draw") then 52 else 78) + boost)), Js.alit("derby", "drama"), Js.ospread(M_kit.base(r)), "instant", "derby") end
	end
	local THRILLER = function(r)
		local total = (r.score.us + r.score.them)
		if (total < 6) then
			do return nil end
		end
		do return M_kit.ev("thriller", M_kit.club(r), (50 + (total * 3)), Js.alit("drama"), Js.ospread(M_kit.base(r), Js.O({ total = total }, { "total" })), "hour") end
	end
	local GOALLESS = function(r)
		if ((r.score.us ~= 0) or (r.score.them ~= 0)) then
			do return nil end
		end
		do return M_kit.ev("goalless", M_kit.club(r), 20, Js.alit("table"), Js.ospread(M_kit.base(r)), "evening") end
	end
	local RESULT_DETECTORS = Js.alit(FULL_TIME, ROUT, HAMMERED, COMEBACK, COLLAPSE, CLEAN_SHEET, UPSET, DERBY, THRILLER, GOALLESS)
	exports.RESULT_DETECTORS = RESULT_DETECTORS
end
