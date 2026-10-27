--!nocheck
--!nolint
-- Generated from lib/star/expectations.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local M_competitions = import("lib/star/competitions")
	local M_season = import("lib/star/season")
	local clubExpectation, personalDuty, judgeSeason, expectationStatus
	clubExpectation = function(career)
		local table_ = A.sort(Js.aspread(career.league), function(a, b)
			return (b.strength - a.strength)
		end)
		local idx = A.findIndex(table_, function(t)
			return (t.name == career.player.club)
		end)
		local n = Js.alen(career.league)
		local share = (if (idx >= 0) then ((idx + 1) / n) else (function()
			local division = M_clubs.divisionOf(career.player.club)
			do return (if (division == "champions") then 0.1 else (if (division == "europa") then 0.3 else (if (division == "premier") then 0.35 else (if (division == "championship") then 0.6 else (if (division == "pool") then 0.8 else (if (division == "league_one") then 0.85 else (if (division == "league_two") then 0.9 else (if (division == "national_league") then 0.95 else (if ((division == "national_league_north") or (division == "national_league_south")) then 0.97 else 0.5))))))))) end
		end)())
		if (share <= 0.2) then
			do return Js.O({ ambition = "Title", targetPosition = Math.max(1, Math.round((n * 0.1))), crisisPosition = Math.round((n * 0.4)), summary = "The board expect the title. Anything else is a bad season." }, { "ambition", "targetPosition", "crisisPosition", "summary" }) end
		end
		if (share <= 0.45) then
			do return Js.O({ ambition = "Europe", targetPosition = Math.max(2, Math.round((n * 0.4))), crisisPosition = Math.round((n * 0.7)), summary = "The board expect European football." }, { "ambition", "targetPosition", "crisisPosition", "summary" }) end
		end
		if (share <= 0.75) then
			do return Js.O({ ambition = "Mid-table", targetPosition = Math.round((n * 0.7)), crisisPosition = Math.round((n * 0.9)), summary = "The board want a comfortable season in the top half if you can." }, { "ambition", "targetPosition", "crisisPosition", "summary" }) end
		end
		do return Js.O({ ambition = "Survival", targetPosition = Math.round((n * 0.9)), crisisPosition = n, summary = "Staying up is the job. Everything above that is a bonus." }, { "ambition", "targetPosition", "crisisPosition", "summary" }) end
	end
	exports.clubExpectation = clubExpectation
	personalDuty = function(career)
		if (career.starRating >= 4.2) then
			do return Js.O({ duty = "Lead the team", goalTarget = 18, summary = "You are the player this side is built around. They expect you to win them matches." }, { "duty", "goalTarget", "summary" }) end
		end
		if (career.starRating >= 2.8) then
			do return Js.O({ duty = "Perform consistently", goalTarget = 10, summary = "You are established here. They expect you week in, week out." }, { "duty", "goalTarget", "summary" }) end
		end
		do return Js.O({ duty = "Earn a place", goalTarget = 4, summary = "You are still proving you belong. Minutes are the thing to chase." }, { "duty", "goalTarget", "summary" }) end
	end
	exports.personalDuty = personalDuty
	judgeSeason = function(career)
		local exp = clubExpectation(career)
		local duty = personalDuty(career)
		local pos = M_competitions.leaguePosition(career)
		local n = Js.alen(career.league)
		local trophies = Js.alen(A.filter(career.trophies, function(t)
			return (t.season == career.season)
		end))
		local score = ((exp.targetPosition - pos) / Math.max(1, (n * 0.6)))
		if (pos > exp.crisisPosition) then
			score -= 0.5
		end
		if (trophies > 0) then
			score += (0.35 * trophies)
		end
		local goals = career.seasonStats.goals
		score += Math.max(-0.4, Math.min(0.4, ((goals - duty.goalTarget) / (duty.goalTarget * 2.5))))
		score = Math.max(-1, Math.min(1, score))
		local headline = (if (score >= 0.5) then "A season beyond what anyone expected" else (if (score >= 0.12) then "Expectations met, and then some" else (if (score >= -0.12) then "About what was expected" else (if (score >= -0.5) then "Below what the board wanted" else "A bad season, and everybody knows it"))))
		local finish = (Js.numstr(pos) .. (if (pos == 1) then "st" else (if (pos == 2) then "nd" else (if (pos == 3) then "rd" else "th"))))
		do return Js.O({ score = score, bossChange = Math.round((score * 18)), headline = headline, detail = (((exp.ambition .. " was the ask. You finished " .. finish) .. (if (trophies > 0) then (" and won " .. (if (trophies == 1) then "a trophy" else (Js.numstr(trophies) .. " trophies"))) else "")) .. (". " .. Js.numstr(goals) .. " goals against a target of " .. Js.numstr(duty.goalTarget) .. ".")) }, { "score", "bossChange", "headline", "detail" }) end
	end
	exports.judgeSeason = judgeSeason
	expectationStatus = function(career)
		local exp = clubExpectation(career)
		local pos = (A.findIndex(M_season.sortLeague(career.league), function(t)
			return (t.name == career.player.club)
		end) + 1)
		do return Js.O({ pos = pos, exp = exp, onTrack = (pos <= exp.targetPosition) }, { "pos", "exp", "onTrack" }) end
	end
	exports.expectationStatus = expectationStatus
end
