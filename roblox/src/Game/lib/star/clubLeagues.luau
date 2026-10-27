--!nocheck
--!nolint
-- Generated from lib/star/clubLeagues.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubs = import("lib/star/clubs")
	local BIG_FIVE_EUROPEAN_CLUBS, isBigFiveLeagueClub, BIG_FIVE_MULTIPLIER, OTHER_LEAGUE_MULTIPLIER, leagueMultiplierFor
	isBigFiveLeagueClub = function(club)
		do return (A.includes(M_clubs.PREMIER_LEAGUE_CLUBS, club) or BIG_FIVE_EUROPEAN_CLUBS:has(club)) end
	end
	exports.isBigFiveLeagueClub = isBigFiveLeagueClub
	leagueMultiplierFor = function(club)
		do return (if isBigFiveLeagueClub(club) then BIG_FIVE_MULTIPLIER else OTHER_LEAGUE_MULTIPLIER) end
	end
	exports.leagueMultiplierFor = leagueMultiplierFor
	BIG_FIVE_EUROPEAN_CLUBS = Js.Set.new(Js.alit("Atlético Madrid", "FC Barcelona", "Real Betis Balompié", "Real Madrid", "Villarreal CF", "RC Celta", "Real Sociedad", "Sevilla FC", "Borussia Dortmund", "FC Bayern München", "RB Leipzig", "VfB Stuttgart", "TSG 1899 Hoffenheim", "Bayer 04 Leverkusen", "Eintracht Frankfurt", "FC Schalke 04", "Paris Saint-Germain", "RC Lens", "Lille OSC", "Olympique Lyonnais", "Olympique de Marseille", "Stade Rennais FC", "AS Monaco", "RC Strasbourg Alsace", "Como", "Inter", "Napoli", "Roma", "Juventus", "AC Milan", "Atalanta", "Lazio"))
	BIG_FIVE_MULTIPLIER = 1
	exports.BIG_FIVE_MULTIPLIER = BIG_FIVE_MULTIPLIER
	OTHER_LEAGUE_MULTIPLIER = 0.75
	exports.OTHER_LEAGUE_MULTIPLIER = OTHER_LEAGUE_MULTIPLIER
end
