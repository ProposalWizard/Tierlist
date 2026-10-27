--!nocheck
--!nolint
-- Generated from lib/star/media/detect/personal.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_kit = import("lib/star/media/detect/kit")
	local M_memory = import("lib/star/media/memory")
	local DEBUT = function(r)
		if (r.you.careerAppearances == 1) then
			do return M_kit.ev("debut", M_kit.you(r), 66, Js.alit("debut", "milestone"), Js.ospread(M_kit.base(r)), "instant") end
		end
		if (r.you.clubAppearances == 1) then
			do return M_kit.ev("club-debut", M_kit.you(r), 58, Js.alit("debut", "milestone"), Js.ospread(M_kit.base(r)), "instant") end
		end
		do return nil end
	end
	local APPEARANCE_MILESTONE = function(r)
		local marks = Js.alit(50, 100, 150, 200, 250, 300, 400, 500)
		local hit = A.find(marks, function(m)
			return (r.you.careerAppearances == m)
		end)
		local clubHit = A.find(marks, function(m)
			return (r.you.clubAppearances == m)
		end)
		if Js.T(hit) then
			do return M_kit.ev("appearance-milestone", M_kit.you(r), (if (hit >= 200) then 74 else 52), Js.alit("milestone", "record"), Js.ospread(M_kit.base(r), Js.O({ milestone = hit, goals = r.you.careerGoals }, { "milestone", "goals" })), "hour") end
		end
		if Js.T(clubHit) then
			do return M_kit.ev("club-appearance-milestone", M_kit.you(r), (if (clubHit >= 200) then 68 else 46), Js.alit("milestone"), Js.ospread(M_kit.base(r), Js.O({ milestone = clubHit }, { "milestone" })), "hour") end
		end
		do return nil end
	end
	local STAR_MAN = function(r)
		if (not r.you.starMan) then
			do return nil end
		end
		do return M_kit.ev("star-man", M_kit.you(r), 44, Js.alit("award", "opinion"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, assists = r.you.assists }, { "goals", "assists" })), "hour") end
	end
	local MASTERCLASS = function(r)
		if (r.you.rating < 8.8) then
			do return nil end
		end
		do return M_kit.ev("masterclass", M_kit.you(r), Math.min(84, (50 + ((r.you.rating - 8.8) * 40))), Js.alit("opinion", "stat"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, assists = r.you.assists }, { "goals", "assists" })), "hour", "form-hot") end
	end
	local ANONYMOUS = function(r)
		if ((r.you.rating > 5.6) or (r.you.minutes < 45)) then
			do return nil end
		end
		do return M_kit.ev("anonymous", M_kit.you(r), 40, Js.alit("shame", "opinion"), Js.ospread(M_kit.base(r)), "evening", "form-cold") end
	end
	local HOOKED = function(r)
		if (r.you.hooked ~= "form") then
			do return nil end
		end
		do return M_kit.ev("hooked", M_kit.you(r), 48, Js.alit("shame", "manager", "drama"), Js.ospread(M_kit.base(r), Js.O({ minutes = r.you.minutes }, { "minutes" })), "evening", "form-cold") end
	end
	local CAPTAIN_PERFORMANCE = function(r)
		if ((not r.you.captain) or (r.you.rating < 8)) then
			do return nil end
		end
		do return M_kit.ev("captain-leads", M_kit.you(r), 46, Js.alit("opinion"), Js.ospread(M_kit.base(r)), "evening") end
	end
	local FORM_SWING = function(r, m)
		if (Js.alen(m.recent) < 4) then
			do return nil end
		end
		local avg = M_memory.averageRating(m, 4)
		if (avg >= 7.9) then
			do return M_kit.ev("in-form", M_kit.you(r), 54, Js.alit("form", "stat"), Js.ospread(M_kit.base(r), Js.O({ average = N.toFixed(avg, 2), matches = 4 }, { "average", "matches" })), "evening", "form-hot") end
		end
		if (avg <= 5.9) then
			do return M_kit.ev("out-of-form", M_kit.you(r), 48, Js.alit("form", "shame", "stat"), Js.ospread(M_kit.base(r), Js.O({ average = N.toFixed(avg, 2), matches = 4 }, { "average", "matches" })), "evening", "form-cold") end
		end
		do return nil end
	end
	local SUBSTITUTE_IMPACT = function(r)
		if ((r.you.minutes >= 60) or ((r.you.goals + r.you.assists) == 0)) then
			do return nil end
		end
		do return M_kit.ev("impact-sub", M_kit.you(r), 56, Js.alit("goal", "drama"), Js.ospread(M_kit.base(r), Js.O({ minutes = r.you.minutes, goals = r.you.goals, assists = r.you.assists }, { "minutes", "goals", "assists" })), "hour") end
	end
	local POOR_SHOWING = function(r)
		if (r.you.minutes <= 0) then
			do return nil end
		end
		if ((r.you.goals > 0) or (r.you.assists > 0)) then
			do return nil end
		end
		if (r.you.rating >= 6) then
			do return nil end
		end
		do return M_kit.ev("poor-showing", M_kit.you(r), 34, Js.alit("shame"), Js.ospread(M_kit.base(r), Js.O({ goals = r.you.goals, goalsN = r.you.goals, assists = r.you.assists, minutes = r.you.minutes }, { "goals", "goalsN", "assists", "minutes" })), "hour", "form-cold") end
	end
	local CHEEKY_MISS = function(r)
		if (not Js.T(r.you.cheekyMisses)) then
			do return nil end
		end
		local chip = (r.you.cheekyKind == "chip")
		do return M_kit.ev("cheeky-miss", M_kit.you(r), 62, Js.alit("shame", "drama"), Js.ospread(M_kit.base(r), (if chip then Js.O({ chip = true }, { "chip" }) else Js.O({ middle = true }, { "middle" })), (if (r.you.cheekyMinute ~= nil) then Js.O({ minute = r.you.cheekyMinute }, { "minute" }) else Js.O({}, nil))), "instant", "form-cold") end
	end
	local PERSONAL_DETECTORS = Js.alit(DEBUT, APPEARANCE_MILESTONE, STAR_MAN, MASTERCLASS, ANONYMOUS, HOOKED, CAPTAIN_PERFORMANCE, FORM_SWING, SUBSTITUTE_IMPACT, POOR_SHOWING, CHEEKY_MISS)
	exports.PERSONAL_DETECTORS = PERSONAL_DETECTORS
end
