--!nocheck
--!nolint
-- Generated from lib/star/seasonStanding.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_fame = import("lib/star/fame")
	local M_reputation = import("lib/star/reputation")
	local M_seasonAwards = import("lib/star/seasonAwards")
	local M_ballonDor = import("lib/star/ballonDor")
	local M_investments = import("lib/star/investments")
	local M_season = import("lib/star/season")
	local seasonStanding
	seasonStanding = function(career, ladder, nextDivision, userWonBallonDor, qualifiedForEurope, winners)
		local news = Js.alit()
		local fame = (if career.fame ~= nil then career.fame else 0)
		local rep = career.reputation
		local gain = function(n, why)
			if (not Js.T(n)) then
				do return end
			end
			fame = M_fame.addFame(fame, n)
			A.push(news, ((if (n > 0) then "+" else "") .. Js.numstr(n) .. " fame — " .. why))
		end
		local trust = function(n, why)
			if (not Js.T(n)) then
				do return end
			end
			rep = M_reputation.clampReputation((rep + n))
			A.push(news, ((if (n > 0) then "+" else "") .. Js.numstr(n) .. " reputation — " .. why))
		end
		local won = A.filter(career.trophies, function(t)
			return (t.season == career.season)
		end)
		do
			local _arr1 = won
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local t = _arr1[_i2]
				gain((if M_fame.FAME_FOR_TROPHY[t.competition] ~= nil then M_fame.FAME_FOR_TROPHY[t.competition] else 2), ("won the " .. t.competition))
				trust(M_reputation.REPUTATION_EVENTS.personalTrophy, ("won the " .. t.competition))
			end
		end
		if (ladder.yourMove == "promoted") then
			gain((if M_fame.FAME_FOR_PROMOTION_TO[nextDivision] ~= nil then M_fame.FAME_FOR_PROMOTION_TO[nextDivision] else 0), "promoted")
		elseif (ladder.yourMove == "relegated") then
			gain(M_fame.FAME_EVENTS.relegated, "relegated")
		end
		if qualifiedForEurope then
			gain(M_fame.FAME_EVENTS.qualifiedForEurope, "qualified for Europe")
		end
		local awards = M_seasonAwards.computeSeasonAwardStats(career)
		if (function() local _v = awards.playerOfSeason; if _v == nil then return nil end; _v = _v.isYou; return _v end)() then
			gain(M_fame.FAME_EVENTS.playerOfSeason, "Player of the Season")
		end
		if (function() local _v = awards.youngPlayerOfSeason; if _v == nil then return nil end; _v = _v.isYou; return _v end)() then
			gain(M_fame.FAME_EVENTS.youngPlayerOfSeason, "Young Player of the Season")
		end
		if (function() local _v = awards.goldenBoot; if _v == nil then return nil end; _v = _v.isYou; return _v end)() then
			gain(M_fame.FAME_EVENTS.goldenBoot, "Golden Boot")
		end
		if A.some(awards.teamOfSeason, function(m)
			return m.isYou
		end) then
			gain(M_fame.FAME_EVENTS.teamOfSeason, "Team of the Season")
		end
		if userWonBallonDor then
			gain(M_fame.FAME_EVENTS.ballonDorWin, "won the Ballon d'Or")
		else
			local rank = M_ballonDor.computeBallonDorShortlist(career).playerRank
			if ((rank == 2) or (rank == 3)) then
				gain(M_fame.FAME_EVENTS.ballonDorTopThree, ("finished " .. (if (rank == 2) then "2nd" else "3rd") .. " in the Ballon d'Or"))
			end
		end
		local leagueGames = Math.max(1, ((Js.alen(career.league) - 1) * 2))
		if (career.seasonStats.appearances < (leagueGames / 2)) then
			gain(M_fame.FAME_EVENTS.benchedSeason, "a season mostly out of the side")
		end
		local before = fame
		fame = M_fame.fadedFame(fame, nextDivision)
		local faded = (Math.round(((before - fame) * 10)) / 10)
		if (faded >= 0.5) then
			A.push(news, ("−" .. Js.numstr(Math.round(faded)) .. " fame — fading at this level"))
		end
		if (career.lastScandalSeason ~= career.season) then
			trust(M_reputation.REPUTATION_EVENTS.cleanSeason, "a season without scandal")
		end
		local owned = A.map(A.filter((if career.investments ~= nil then career.investments else Js.alit()), function(s)
			return (s.percent >= M_investments.MAJORITY_THRESHOLD)
		end), function(s)
			return s.club
		end)
		local promotedLists = Js.alit(ladder.promotedToPremier, ladder.promotedToChampionship, ladder.promotedToLeagueOne, ladder.promotedToLeagueTwo)
		local relegatedLists = Js.alit(ladder.relegatedFromPremier, ladder.relegatedFromChampionship, ladder.relegatedFromLeagueOne, ladder.relegatedFromLeagueTwo, ladder.relegatedFromNationalLeague)
		local winnerClubs = A.filter(A.map(A.filter(Js.Object.entries((if winners ~= nil then winners else Js.O({}, nil))), function(_p3)
			local k = _p3[1]
			return (k ~= "leagueRunnerUp")
		end), function(_p4)
			local v = _p4[2]
			return v
		end), Js.Boolean)
		local table_ = M_season.sortLeague(career.league)
		local byStrength = A.sort(Js.aspread(career.league), function(a, b)
			return (b.strength - a.strength)
		end)
		do
			local _arr5 = owned
			local _i6 = 0
			while _i6 < Js.alen(_arr5) do
				_i6 += 1
				local club = _arr5[_i6]
				if (A.includes(winnerClubs, club) or A.some(promotedLists, function(l)
					return (function() local _r = l; if _r == nil then return nil end; return A.includes(_r, club) end)()
				end)) then
					trust(M_reputation.REPUTATION_EVENTS.ownedClubTrophyOrPromotion, (club .. " (your club) won something or went up"))
				elseif A.some(relegatedLists, function(l)
					return (function() local _r = l; if _r == nil then return nil end; return A.includes(_r, club) end)()
				end) then
					trust(M_reputation.REPUTATION_EVENTS.ownedClubRelegated, (club .. " (your club) went down"))
				else
					local pos = A.findIndex(table_, function(t)
						return (t.name == club)
					end)
					local expected = A.findIndex(byStrength, function(t)
						return (t.name == club)
					end)
					if (((pos >= 0) and (expected >= 0)) and ((expected - pos) >= 3)) then
						trust(M_reputation.REPUTATION_EVENTS.ownedClubBeatExpectations, (club .. " (your club) beat expectations"))
					end
				end
			end
		end
		do return Js.O({ fame = fame, reputation = rep, news = news }, { "fame", "reputation", "news" }) end
	end
	exports.seasonStanding = seasonStanding
end
