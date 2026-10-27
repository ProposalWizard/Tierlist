--!nocheck
--!nolint
-- Generated from lib/star/media/detect/index.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_career = import("lib/star/media/detect/career")
	local M_goals = import("lib/star/media/detect/goals")
	local M_creation = import("lib/star/media/detect/creation")
	local M_result = import("lib/star/media/detect/result")
	local M_personal = import("lib/star/media/detect/personal")
	local M_table = import("lib/star/media/detect/table")
	local M_competition = import("lib/star/media/detect/competition")
	local M_streaks = import("lib/star/media/detect/streaks")
	local MATCH_DETECTORS, flatten, detectMatch, detectCareer, dedupe
	flatten = function(x)
		if (not x) then
			do return Js.alit() end
		end
		do return (if Js.Array.isArray(x) then x else Js.alit(x)) end
	end
	detectMatch = function(r, m)
		local out = Js.alit()
		do
			local _arr1 = MATCH_DETECTORS
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local d = _arr1[_i2]
				local _ok3, _err4, _rv5 = pcall(function()
					A.push(out, Js.unpack(flatten(d(r, m))))
				end)
				if not _ok3 then
				elseif _err4 == Js.RET then
					return _rv5
				end
			end
		end
		do return dedupe(out) end
	end
	exports.detectMatch = detectMatch
	detectCareer = function(r, m)
		local out = Js.alit()
		do
			local _arr6 = M_career.CAREER_DETECTORS
			local _i7 = 0
			while _i7 < Js.alen(_arr6) do
				_i7 += 1
				local d = _arr6[_i7]
				local _ok8, _err9, _rv10 = pcall(function()
					A.push(out, Js.unpack(flatten(d(r, m))))
				end)
				if not _ok8 then
				elseif _err9 == Js.RET then
					return _rv10
				end
			end
		end
		do return dedupe(out) end
	end
	exports.detectCareer = detectCareer
	dedupe = function(events)
		local byId = Js.Map.new()
		do
			local _arr11 = events
			local _i12 = 0
			while _i12 < Js.alen(_arr11) do
				_i12 += 1
				local e = _arr11[_i12]
				local prev = byId:get(e.id)
				if ((not prev) or (e.baseImportance > prev.baseImportance)) then
					byId:set(e.id, e)
				end
			end
		end
		do return Js.Array.from(byId:values()) end
	end
	MATCH_DETECTORS = Js.aspread(M_goals.GOAL_DETECTORS, M_creation.CREATION_DETECTORS, M_result.RESULT_DETECTORS, M_personal.PERSONAL_DETECTORS, M_table.TABLE_DETECTORS, M_competition.COMPETITION_DETECTORS, M_streaks.STREAK_DETECTORS)
	exports.MATCH_DETECTORS = MATCH_DETECTORS
	exports.CAREER_DETECTORS = CAREER_DETECTORS
end
