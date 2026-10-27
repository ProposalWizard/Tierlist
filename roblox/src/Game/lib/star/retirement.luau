--!nocheck
--!nolint
-- Generated from lib/star/retirement.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fame = import("lib/star/fame")
	local M_economy = import("lib/star/economy")
	local M_careerFlow = import("lib/star/careerFlow")
	local CAREER_SEASONS, retirementCheck, isFinalSeason, careerVerdict, TESTIMONIAL_APPEARANCES, TESTIMONIAL_WEEKS_PER_POINT, testimonialFor, retire
	retirementCheck = function(career, cap)
		if cap == nil then cap = CAREER_SEASONS end
		if ((cap ~= nil) and (career.season >= cap)) then
			do return Js.O({ canRetire = true, mustRetire = true, finalSeasonNext = false, reason = (Js.numstr(cap) .. " seasons. Time to hang them up.") }, { "canRetire", "mustRetire", "finalSeasonNext", "reason" }) end
		end
		do return Js.O({ canRetire = false, mustRetire = false, finalSeasonNext = ((cap ~= nil) and (career.season == (cap - 1))), reason = "" }, { "canRetire", "mustRetire", "finalSeasonNext", "reason" }) end
	end
	exports.retirementCheck = retirementCheck
	isFinalSeason = function(career, cap)
		if cap == nil then cap = CAREER_SEASONS end
		do return ((cap ~= nil) and (career.season >= cap)) end
	end
	exports.isFinalSeason = isFinalSeason
	careerVerdict = function(career)
		local s = career.careerStats
		local trophies = Js.alen(career.trophies)
		local majors = Js.alen(A.filter(career.trophies, function(t)
			return (((t.competition == "Champions League") or (t.competition == "World Cup")) or (t.competition == "European Championship"))
		end))
		local score = Math.max(0, Math.min(100, ((((((((Math.min(1, (s.goals / 250)) * 100) * 0.24) + ((Math.min(1, (s.assists / 140)) * 100) * 0.1)) + ((Math.min(1, (trophies / 12)) * 100) * 0.22)) + ((Math.min(1, (majors / 4)) * 100) * 0.14)) + ((Math.min(1, (career.ballonDorWins / 3)) * 100) * 0.18)) + ((Math.min(1, ((if career.caps ~= nil then career.caps else 0) / 90)) * 100) * 0.06)) + ((Math.min(1, (s.appearances / 450)) * 100) * 0.06))))
		local clubs = Js.Array.from(Js.Set.new(Js.aspread(Js.alit(career.player.club), A.flatMap((if career.transfers ~= nil then career.transfers else Js.alit()), function(t)
			return Js.alit(t.from, t.to)
		end))))
		local seasons = Math.max(1, career.season)
		local title = (if (score >= 82) then "One of the Greats" else (if (score >= 64) then "A Modern Legend" else (if (score >= 46) then "Club Legend" else (if (score >= 28) then "A Fine Career" else (if (score >= 12) then "A Solid Professional" else "A Career in the Game")))))
		local won = (if (trophies == 1) then "1 trophy" else (Js.numstr(trophies) .. " trophies"))
		local summary = (if (career.ballonDorWins > 0) then (Js.numstr(career.ballonDorWins) .. " Ballon d'Or" .. (if (career.ballonDorWins > 1) then "s" else "") .. ", " .. Js.numstr(s.goals) .. " goals and " .. won .. " across " .. Js.numstr(seasons) .. " seasons.") else (if (trophies > 0) then (Js.numstr(s.goals) .. " goals and " .. won .. " across " .. Js.numstr(seasons) .. " seasons.") else (Js.numstr(s.goals) .. " goals in " .. Js.numstr(s.appearances) .. " appearances across " .. Js.numstr(seasons) .. " seasons.")))
		do return Js.O({ title = title, summary = summary, score = score, seasons = seasons, clubs = clubs }, { "title", "summary", "score", "seasons", "clubs" }) end
	end
	exports.careerVerdict = careerVerdict
	testimonialFor = function(career)
		local apps = (if career.clubAppearances ~= nil then career.clubAppearances else 0)
		if (apps < TESTIMONIAL_APPEARANCES) then
			do return nil end
		end
		local score = (((apps * 0.9) + (M_fame.fameOf(career) * 1.6)) + (career.starRating * 22))
		local payout = Math.round(((score * TESTIMONIAL_WEEKS_PER_POINT) * M_economy.tierWeeklyIncome("world_class")))
		do return Js.O({ club = career.player.club, season = career.season, payout = payout }, { "club", "season", "payout" }) end
	end
	exports.testimonialFor = testimonialFor
	retire = function(career, wonBallonDor)
		if wonBallonDor == nil then wonBallonDor = false end
		if career.retired then
			do return career end
		end
		local closed = nil
		local _ok1, _err2, _rv3 = pcall(function()
			closed = M_careerFlow.closeFinalSeason(career, wonBallonDor)
		end)
		if not _ok1 then
			closed = Js.ospread(career, Js.O({ ballonDorWins = (career.ballonDorWins + (if wonBallonDor then 1 else 0)) }, { "ballonDorWins" }))
		elseif _err2 == Js.RET then
			return _rv3
		end
		local testimonial = testimonialFor(closed)
		do return Js.ospread(closed, Js.O({ retired = true, testimonial = testimonial, money = (closed.money + ((function() local _v = testimonial; if _v == nil then return nil end; _v = _v.payout; return _v end)() or 0)) }, { "retired", "testimonial", "money" })) end
	end
	exports.retire = retire
	CAREER_SEASONS = 20
	exports.CAREER_SEASONS = CAREER_SEASONS
	TESTIMONIAL_APPEARANCES = 120
	exports.TESTIMONIAL_APPEARANCES = TESTIMONIAL_APPEARANCES
	TESTIMONIAL_WEEKS_PER_POINT = 0.06
	exports.TESTIMONIAL_WEEKS_PER_POINT = TESTIMONIAL_WEEKS_PER_POINT
end
