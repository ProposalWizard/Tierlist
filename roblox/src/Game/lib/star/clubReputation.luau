--!nocheck
--!nolint
-- Generated from lib/star/clubReputation.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_clubProfiles = import("lib/star/data/clubProfiles")
	local M_footballClubDatabase = import("lib/star/data/footballClubDatabase")
	local M_clubs = import("lib/star/clubs")
	local DEFAULT_CLUB_REPUTATION, CLUB_REPUTATION, clubReputation, DIVISION_CLUBS, clubsInDivision, clubStanding
	clubReputation = function(club)
		local given = (function() local _v = M_clubProfiles.profileOf(club); if _v == nil then return nil end; _v = _v.clubSize; return _v end)()
		if (given ~= nil) then
			do return Math.max(1, Math.min(100, given)) end
		end
		local own = CLUB_REPUTATION[club]
		if (own ~= nil) then
			do return own end
		end
		local rated = (function() local _v = M_footballClubDatabase.CLUB_DATABASE[club]; if _v == nil then return nil end; _v = _v.currentReputation; return _v end)()
		if (rated ~= nil) then
			do return Math.round((10 + (((rated - 1) / 9) * 90))) end
		end
		do return DEFAULT_CLUB_REPUTATION end
	end
	exports.clubReputation = clubReputation
	clubsInDivision = function(division)
		do return (if DIVISION_CLUBS[division] ~= nil then DIVISION_CLUBS[division] else M_clubs.PREMIER_LEAGUE_CLUBS) end
	end
	exports.clubsInDivision = clubsInDivision
	clubStanding = function(club, division)
		local clubs = clubsInDivision(division)
		local lo = math.huge
		local hi = (-math.huge)
		do
			local _arr1 = clubs
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local c = _arr1[_i2]
				local r = clubReputation(c)
				if (r < lo) then
					lo = r
				end
				if (r > hi) then
					hi = r
				end
			end
		end
		if ((not Js.NumberNS.isFinite(lo)) or (hi <= lo)) then
			do return 0.5 end
		end
		local raw = ((clubReputation(club) - lo) / (hi - lo))
		do return Math.max(0, Math.min(1, raw)) end
	end
	exports.clubStanding = clubStanding
	DEFAULT_CLUB_REPUTATION = 20
	exports.DEFAULT_CLUB_REPUTATION = DEFAULT_CLUB_REPUTATION
	CLUB_REPUTATION = Js.O({ ["Manchester United"] = 97, Liverpool = 97, ["Manchester City"] = 95, Arsenal = 94, Chelsea = 93, ["Tottenham Hotspur"] = 87, ["Newcastle United"] = 82, ["Aston Villa"] = 78, Everton = 75, ["Leeds United"] = 74, ["Nottingham Forest"] = 70, Sunderland = 70, ["Crystal Palace"] = 68, ["Brighton & Hove Albion"] = 68, ["Fulham FC"] = 66, ["Ipswich Town"] = 64, Brentford = 63, ["AFC Bournemouth"] = 62, ["Hull City"] = 62, ["Coventry City"] = 62, ["West Ham United"] = 78, ["Wolverhampton Wanderers"] = 70, Southampton = 66, ["Norwich City"] = 63, ["Stoke City"] = 60, ["Derby County"] = 60, ["Sheffield United"] = 60, ["West Bromwich Albion"] = 60, Middlesbrough = 58, Burnley = 58, ["Birmingham City"] = 56, Portsmouth = 56, ["Blackburn Rovers"] = 55, Watford = 54, ["Swansea City"] = 53, ["Cardiff City"] = 52, ["Queens Park Rangers"] = 50, ["Bristol City"] = 50, Wrexham = 50, ["Preston North End"] = 48, ["Bolton Wanderers"] = 48, ["Millwall FC"] = 46, ["Charlton Athletic"] = 46, ["Lincoln City"] = 38, ["Leicester City"] = 62, ["Sheffield Wednesday"] = 52, ["Luton Town"] = 46, ["Huddersfield Town"] = 44, ["Reading FC"] = 44, ["Wigan Athletic"] = 42, Blackpool = 42, Barnsley = 40, ["Plymouth Argyle"] = 40, ["Bradford City"] = 40, ["Oxford United"] = 38, ["Notts County"] = 38, ["Peterborough United"] = 36, ["Doncaster Rovers"] = 34, ["AFC Wimbledon"] = 34, ["Stockport County"] = 32, ["Leyton Orient"] = 32, ["Mansfield Town"] = 30, ["Milton Keynes Dons"] = 30, ["Wycombe Wanderers"] = 30, ["Cambridge United"] = 30, Stevenage = 26, ["Burton Albion"] = 26, Bromley = 24, ["Rotherham United"] = 36, ["Bristol Rovers"] = 34, ["Port Vale"] = 32, ["Oldham Athletic"] = 32, ["Swindon Town"] = 32, ["Grimsby Town"] = 30, ["Shrewsbury Town"] = 28, Walsall = 28, Gillingham = 28, ["Northampton Town"] = 28, ["Exeter City"] = 28, ["Crewe Alexandra"] = 28, Chesterfield = 28, ["Tranmere Rovers"] = 28, ["Colchester United"] = 26, Rochdale = 26, ["York City"] = 26, ["Cheltenham Town"] = 24, ["Newport County"] = 24, ["Salford City"] = 24, ["Fleetwood Town"] = 22, ["Crawley Town"] = 22, ["Accrington Stanley"] = 22, Barnet = 20, ["Carlisle United"] = 26, ["Southend United"] = 26, ["Yeovil Town"] = 24, ["Scunthorpe United"] = 24, ["Hartlepool United"] = 24, ["Forest Green Rovers"] = 22, Barrow = 20, Gateshead = 18, Woking = 18, ["FC Halifax Town"] = 18, ["Kidderminster Harriers"] = 18, ["Aldershot Town"] = 18, ["Harrogate Town"] = 18, ["Sutton United"] = 16, Altrincham = 16, ["Solihull Moors"] = 16, ["Boston United"] = 16, Eastleigh = 14, ["AFC Fylde"] = 12, Tamworth = 12, Wealdstone = 12, ["Boreham Wood"] = 12, Worthing = 10, Hornchurch = 8, ["Torquay United"] = 14, Chorley = 8, ["Scarborough Athletic"] = 8, ["Dorking Wanderers"] = 8 }, { "Manchester United", "Liverpool", "Manchester City", "Arsenal", "Chelsea", "Tottenham Hotspur", "Newcastle United", "Aston Villa", "Everton", "Leeds United", "Nottingham Forest", "Sunderland", "Crystal Palace", "Brighton & Hove Albion", "Fulham FC", "Ipswich Town", "Brentford", "AFC Bournemouth", "Hull City", "Coventry City", "West Ham United", "Wolverhampton Wanderers", "Southampton", "Norwich City", "Stoke City", "Derby County", "Sheffield United", "West Bromwich Albion", "Middlesbrough", "Burnley", "Birmingham City", "Portsmouth", "Blackburn Rovers", "Watford", "Swansea City", "Cardiff City", "Queens Park Rangers", "Bristol City", "Wrexham", "Preston North End", "Bolton Wanderers", "Millwall FC", "Charlton Athletic", "Lincoln City", "Leicester City", "Sheffield Wednesday", "Luton Town", "Huddersfield Town", "Reading FC", "Wigan Athletic", "Blackpool", "Barnsley", "Plymouth Argyle", "Bradford City", "Oxford United", "Notts County", "Peterborough United", "Doncaster Rovers", "AFC Wimbledon", "Stockport County", "Leyton Orient", "Mansfield Town", "Milton Keynes Dons", "Wycombe Wanderers", "Cambridge United", "Stevenage", "Burton Albion", "Bromley", "Rotherham United", "Bristol Rovers", "Port Vale", "Oldham Athletic", "Swindon Town", "Grimsby Town", "Shrewsbury Town", "Walsall", "Gillingham", "Northampton Town", "Exeter City", "Crewe Alexandra", "Chesterfield", "Tranmere Rovers", "Colchester United", "Rochdale", "York City", "Cheltenham Town", "Newport County", "Salford City", "Fleetwood Town", "Crawley Town", "Accrington Stanley", "Barnet", "Carlisle United", "Southend United", "Yeovil Town", "Scunthorpe United", "Hartlepool United", "Forest Green Rovers", "Barrow", "Gateshead", "Woking", "FC Halifax Town", "Kidderminster Harriers", "Aldershot Town", "Harrogate Town", "Sutton United", "Altrincham", "Solihull Moors", "Boston United", "Eastleigh", "AFC Fylde", "Tamworth", "Wealdstone", "Boreham Wood", "Worthing", "Hornchurch", "Torquay United", "Chorley", "Scarborough Athletic", "Dorking Wanderers" })
	exports.CLUB_REPUTATION = CLUB_REPUTATION
	DIVISION_CLUBS = Js.O({ premier = M_clubs.PREMIER_LEAGUE_CLUBS, championship = M_clubs.CHAMPIONSHIP_CLUBS, league_one = M_clubs.LEAGUE_ONE_CLUBS, league_two = M_clubs.LEAGUE_TWO_CLUBS, national_league = M_clubs.NATIONAL_LEAGUE_CLUBS, national_league_north = M_clubs.NATIONAL_LEAGUE_NORTH_CLUBS, national_league_south = M_clubs.NATIONAL_LEAGUE_SOUTH_CLUBS }, { "premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south" })
end
