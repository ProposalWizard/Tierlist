--!nocheck
--!nolint
-- Generated from lib/star/gameplayVersion.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local GAMEPLAY_SWITCHES, KEY, defaultVersion, gameplayVersion, setGameplayVersion, oldKeepers, oldKeeperPro, oldBallPhysics, oldShots, oldMatchFlow, oldKeeperFeel, oldHitboxes, oldKeeperFinish
	defaultVersion = function(s)
		local d = GAMEPLAY_SWITCHES[s].defaultVersion
		do return (if d ~= nil then d else "new") end
	end
	exports.defaultVersion = defaultVersion
	gameplayVersion = function(s)
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.localStorage == nil) then
				do return Js.RET, defaultVersion(s) end
			end
			local v = Js.localStorage.getItem(KEY(s))
			do return Js.RET, (if ((v == "old") or (v == "new")) then v else defaultVersion(s)) end
		end)
		if not _ok1 then
			do return defaultVersion(s) end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	exports.gameplayVersion = gameplayVersion
	setGameplayVersion = function(s, v)
		local _ok4, _err5, _rv6 = pcall(function()
			if (v == defaultVersion(s)) then
				Js.localStorage.removeItem(KEY(s))
			else
				Js.localStorage.setItem(KEY(s), v)
			end
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
	end
	exports.setGameplayVersion = setGameplayVersion
	GAMEPLAY_SWITCHES = Js.O({ keepers = Js.O({ label = "Keepers", newText = "Top corners beat them more, weaker keepers are slower, players in front block their view, trial free kicks and penalties easier.", oldText = "The keepers from before 5 Oct 2026." }, { "label", "newText", "oldText" }), keeperPro = Js.O({ label = "Keeper pro (testing)", defaultVersion = "old", newText = "Keepers hold the gentle ones and parry the hard ones somewhere believable, rush out at one-on-ones, come for crosses and overhit through balls, read long shots, and can be chipped or nutmegged.", oldText = "The keepers from before 11 Oct 2026." }, { "label", "defaultVersion", "newText", "oldText" }), ballPhysics = Js.O({ label = "Ball physics (testing)", defaultVersion = "old", newText = "A real football: air drag that grows with speed, a bounce and roll like cut grass, spin that dies away, round posts and a bar that send it off at the true angle (sometimes in), a net that catches it, and the same result at every frame rate.", oldText = "The ball from before 11 Oct 2026." }, { "label", "defaultVersion", "newText", "oldText" }), shotsPro = Js.O({ label = "Shots (testing)", defaultVersion = "old", newText = "Where you hit the ball sets how high it arrives (top = low, middle = hip height, below = top corner). Real spread off your aim, shown as a cone on the arrow; harder, volleys, headers, long shots and a man in your face spread more. Clean contact is truer, a sliced or scuffed one is punished.", oldText = "Shots from before 11 Oct 2026: a tap in the middle of the ball often flies at the bar, and almost no spread off the arrow." }, { "label", "defaultVersion", "newText", "oldText" }), knucklePower = Js.O({ label = "Knuckleball & power shot (testing)", defaultVersion = "old", newText = "Hit a hard shot through the dead centre of the ball and it knuckles (wobbles late). A ⚡ Power shot button on the aim screen: wind up, then hit the green circle fast for up to 1.5x pace.", oldText = "No knuckleball and no power shot (test match only)." }, { "label", "defaultVersion", "newText", "oldText" }), matchFlow = Js.O({ label = "Match flow (testing)", defaultVersion = "old", newText = "The match around you plays like a real one: about 25 shots, 10 corners and 2.8 goals a game, much less of the ball against a far better side, the side behind pushing after a goal, and more happening late.", oldText = "The unseen match from before 11 Oct 2026: about 13 shots a game, no corners but yours." }, { "label", "defaultVersion", "newText", "oldText" }), shotPower = Js.O({ label = "Shot power (testing)", defaultVersion = "old", newText = "Shots at goal leave the boot slower: a 60 hits it like a 40 used to, a 100 like a 70 (96 km/h, not 103). A 100 rarely blazes it over the bar. Passes and crosses keep their pace.", oldText = "Shot pace from before 13 Oct 2026: 79 km/h at power 40, 103 at 100." }, { "label", "defaultVersion", "newText", "oldText" }), contactField = Js.O({ label = "Contact field (testing)", defaultVersion = "old", newText = "Hit the ball on its side for a low curler along the floor: toward the edges, up/down barely matters. The middle is the same (top = low drive, bottom = lifted); the bottom corners give curl and some lift.", oldText = "Contact from before 13 Oct 2026: the side of the ball at mid-height curls AND lifts it." }, { "label", "defaultVersion", "newText", "oldText" }), mateShots = Js.O({ label = "Team-mate shots (testing)", defaultVersion = "old", newText = "A team-mate who gets the ball in space far from goal runs on with it first (about 1-2 seconds), then shoots from nearer — unless a defender or the keeper comes to him.", oldText = "Team-mates from before 13 Oct 2026: whoever gets it shoots from right there after one touch, even 25 m out with nobody near him." }, { "label", "defaultVersion", "newText", "oldText" }), keeperFeel = Js.O({ label = "Keeper feel (testing)", defaultVersion = "old", newText = "Builds on Keeper pro (turns it on too). Keepers read a shot better the nearer it gets, take a ball coming at them on their feet instead of lunging, hold more of the soft ones, and fewer parries drop back in front of goal.", oldText = "Keepers' dives and hands from before 13 Oct 2026." }, { "label", "defaultVersion", "newText", "oldText" }), hitboxes = Js.O({ label = "Hitboxes & jumping (Leo)", newText = "Players are the shape of a man: widest at the feet, narrow at the head, nothing above the head unless they jump. Men really jump for a ball in the air (a team-mate for a ball played to him gets a little extra). A shot or chip over a team-mate's head goes over him; a chip over a keeper off his line has a real chance.", oldText = "Hitboxes from before 14 Oct 2026: a tall cylinder as wide at the head as at the feet; any team-mate within 2 m took a ball below 2.6 m, whoever it was for." }, { "label", "newText", "oldText" }), keeperFinish = Js.O({ label = "Keeper realism (Leo)", newText = "A low ball across the keeper to the far post (the Henry finish) beats him far more often, a harder top-corner shot is harder to reach, and the bottom corners from distance go in at real rates. Shots at him stay his.", oldText = "The keeper's reach from before 14 Oct 2026." }, { "label", "newText", "oldText" }) }, { "keepers", "keeperPro", "ballPhysics", "shotsPro", "knucklePower", "matchFlow", "shotPower", "contactField", "mateShots", "keeperFeel", "hitboxes", "keeperFinish" })
	exports.GAMEPLAY_SWITCHES = GAMEPLAY_SWITCHES
	KEY = function(s)
		return ("star-gameplay-" .. s)
	end
	oldKeepers = function()
		return (gameplayVersion("keepers") == "old")
	end
	exports.oldKeepers = oldKeepers
	oldKeeperPro = function()
		return (gameplayVersion("keeperPro") == "old")
	end
	exports.oldKeeperPro = oldKeeperPro
	oldBallPhysics = function()
		return (gameplayVersion("ballPhysics") == "old")
	end
	exports.oldBallPhysics = oldBallPhysics
	oldShots = function()
		return (gameplayVersion("shotsPro") == "old")
	end
	exports.oldShots = oldShots
	oldMatchFlow = function()
		return (gameplayVersion("matchFlow") == "old")
	end
	exports.oldMatchFlow = oldMatchFlow
	oldKeeperFeel = function()
		return (gameplayVersion("keeperFeel") == "old")
	end
	exports.oldKeeperFeel = oldKeeperFeel
	oldHitboxes = function()
		return (gameplayVersion("hitboxes") == "old")
	end
	exports.oldHitboxes = oldHitboxes
	oldKeeperFinish = function()
		return (gameplayVersion("keeperFinish") == "old")
	end
	exports.oldKeeperFinish = oldKeeperFinish
end
