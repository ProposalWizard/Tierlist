--!nocheck
--!nolint
-- Generated from lib/star/matchCommentary.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_commentaryExtra = import("lib/star/commentaryExtra")
	local RECENT, pick, withExtra, BUILDUP, STRIKE, RECEIVED, RECEIVER_SHOT, RESULT_SELF, RESULT_TEAMMATE_TEMPLATES, RESULT_PASS_FAIL, RESULT_PASS_OK, BUILDUP_NAMED, STRIKE_NAMED, commentaryBuildup, commentaryStrike, startSentences, commentaryReceived, commentaryReceiverShot, commentaryResult
	pick = function(pool, rng)
		if (Js.T(Js.alen(pool)) and (type(pool[1]) == "string")) then
			do return M_commentaryExtra.pickFresh(pool, rng, RECENT, 120) end
		end
		do return pool[Math.min((Js.alen(pool) - 1), math.floor((rng() * Js.alen(pool)))) + 1] end
	end
	withExtra = function(base, extra)
		do
			local _arr1 = Js.Object.keys(extra)
			local _i2 = 0
			while _i2 < Js.alen(_arr1) do
				_i2 += 1
				local k = _arr1[_i2]
				base[k] = Js.aspread((if base[k] ~= nil then base[k] else Js.alit()), extra[k])
			end
		end
	end
	commentaryBuildup = function(kind, rng, name)
		local named = (if Js.T(name) then BUILDUP_NAMED[kind] else nil)
		do return (if named then S.replace(pick(named, rng), Js.re("\\{name\\}", "g"), name) else pick(BUILDUP[kind], rng)) end
	end
	exports.commentaryBuildup = commentaryBuildup
	commentaryStrike = function(kind, rng, name)
		local named = (if Js.T(name) then STRIKE_NAMED[kind] else nil)
		do return (if named then S.replace(pick(named, rng), Js.re("\\{name\\}", "g"), name) else pick(STRIKE[kind], rng)) end
	end
	exports.commentaryStrike = commentaryStrike
	startSentences = function(line)
		do return S.replace(line, Js.re("(^|[.!?]\\s+)([a-z])", "g"), function(_m, lead, c)
			return (lead .. S.toUpperCase(c))
		end) end
	end
	commentaryReceived = function(roleLabel, rng)
		local label = (S.toUpperCase(S.charAt(roleLabel, 0)) .. S.slice(roleLabel, 1))
		do return (label .. " " .. pick(RECEIVED, rng)) end
	end
	exports.commentaryReceived = commentaryReceived
	commentaryReceiverShot = function(roleLabel, rng)
		local label = (S.toUpperCase(S.charAt(roleLabel, 0)) .. S.slice(roleLabel, 1))
		do return ("..." .. label .. " " .. pick(RECEIVER_SHOT, rng)) end
	end
	exports.commentaryReceiverShot = commentaryReceiverShot
	commentaryResult = function(outcome, rng, opts)
		if (opts.chain and (not opts.receiverReached)) then
			local pool = ((if RESULT_PASS_FAIL[outcome] ~= nil then RESULT_PASS_FAIL[outcome] else RESULT_SELF[outcome]) or Js.alit("The move breaks down."))
			do return pick(pool, rng) end
		end
		if (opts.chain and opts.receiverReached) then
			local template = pick((if RESULT_TEAMMATE_TEMPLATES[outcome] ~= nil then RESULT_TEAMMATE_TEMPLATES[outcome] else Js.alit("The chance goes begging for {role}.")), rng)
			do return startSentences(S.replace(template, Js.re("\\{role\\}", "g"), (if opts.roleLabel ~= nil then opts.roleLabel else "your team-mate"))) end
		end
		if (outcome == "delivered") then
			do return pick(RESULT_PASS_OK.delivered, rng) end
		end
		if opts.isPass then
			do return pick(((if RESULT_PASS_FAIL[outcome] ~= nil then RESULT_PASS_FAIL[outcome] else RESULT_SELF[outcome]) or Js.alit("The move breaks down.")), rng) end
		end
		do return pick((if RESULT_SELF[outcome] ~= nil then RESULT_SELF[outcome] else Js.alit("Play continues.")), rng) end
	end
	exports.commentaryResult = commentaryResult
	RECENT = Js.alit()
	BUILDUP = Js.O({ one_on_one = Js.alit("Clean through! It's just you and the keeper now.", "The last defender's beaten — one on one!", "Through on goal — this is a big chance."), tight_angle = Js.alit("Squeezed to the byline — needs a precise finish here.", "Tight angle out on the touchline — can he find the corner?", "Not much of an angle to work with."), long_range = Js.alit("Nobody closing him down — he fancies his chance from distance.", "Room to shoot from way out.", "Sees the keeper off his line and thinks about it from long range."), volley = Js.alit("The ball's whipped in — get up and meet it first time!", "Here comes a cross — first-time effort on!", "Flashed across the box — volley chance!"), header = Js.alit("In the mixer! Rises highest for the header.", "The delivery's in — attacks it with his head.", "Great ball into the box — header on target?"), cutback = Js.alit("Bursts to the byline — looking to cut it back into the box.", "Gets to the line — a team-mate is arriving in the middle.", "Byline reached — pulls it back across the six-yard box."), byline_cross = Js.alit("Out wide by the corner flag — about to whip one in.", "Reaches the byline — delivery incoming.", "Down the line and to the byline — crossing position."), through_ball = Js.alit("Spots the run in behind — can he thread it through?", "The defense is stepping up — a ball over the top could be lethal.", "Eyes are up, looking to split the back line."), midfield_pass = Js.alit("Keeping it simple, recycling possession.", "No rush here — just needs to find a team-mate.", "Patient build-up play in midfield."), penalty = Js.alit("Penalty! Steps up to the spot — everything on this.", "It's a penalty kick! The stadium holds its breath.", "Points to the spot — a chance to make it count from twelve yards."), free_kick = Js.alit("Free kick in a dangerous position — the wall is set.", "Lines up the free kick — can he bend it over the wall?", "A set-piece opportunity — this is in his range."), corner = Js.alit("Corner kick — the delivery is everything here.", "Swinging in a corner — bodies in the box.", "Corner from the flag — who wants it most?"), buildup = Js.alit("Deep in midfield — needs to find the right pass here.", "On the ball with options ahead — can he pick the right one?", "Building from the back — time to play through the lines.") }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" })
	STRIKE = Js.O({ one_on_one = Js.alit("He goes for it!", "Strikes it first time!", "Here's the finish..."), tight_angle = Js.alit("Goes near post!", "Tries to squeeze it in!", "Attempts the finish from the tightest of angles!"), long_range = Js.alit("He lets fly!", "Unleashes a strike from distance!", "Hits it clean from way out!"), volley = Js.alit("Connects! What a strike on the volley!", "Meets it flush!", "Gets his whole body into it!"), header = Js.alit("Powers a header goalward!", "Glances it on!", "Gets up well and heads it!"), cutback = Js.alit("Slides the ball back across goal!", "Cuts it back into the danger area!", "Squares it into the box!"), byline_cross = Js.alit("Whips the cross in!", "Delivers it into the box!", "Floats one in from the byline!"), through_ball = Js.alit("Plays it through!", "Threads the pass into the gap!", "Slips it through the lines!"), midfield_pass = Js.alit("Rolls it across.", "Finds his team-mate.", "Plays it simple and safe."), penalty = Js.alit("Steps up and strikes it!", "Hits it hard and low!", "Goes for the corner!"), free_kick = Js.alit("Bends it over the wall!", "Strikes it with venom!", "Curls one toward the top corner!"), corner = Js.alit("Whips the corner in!", "Delivers it right into the danger zone!", "A teasing delivery from the flag!"), buildup = Js.alit("Plays it forward!", "Tries to thread it through!", "Sprays it out wide!") }, { "one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "penalty", "free_kick", "corner", "buildup" })
	RECEIVED = Js.alit("gets there and takes a touch to set it up...", "controls it in one motion...", "brings it down under pressure...", "takes a touch to shift it onto his favoured foot...")
	RECEIVER_SHOT = Js.alit("doesn't need a second invitation!", "goes for goal!", "takes it on first time!", "picks his spot and swings a leg at it!")
	RESULT_SELF = Js.O({ goal = Js.alit("GOAL! What a finish!", "IT'S IN! Brilliant strike!", "GOALLL! He's done it!"), rebound = Js.alit("He follows it in — GOAL from the rebound!", "Pounces on the loose ball — GOAL!"), saved = Js.alit("Saved! Big stop from the keeper.", "The keeper says no!", "Denied by a fine save!"), caught = Js.alit("Comfortable take for the keeper.", "Gathered safely by the keeper."), tipped = Js.alit("Tipped away! Great reactions from the keeper.", "Pushed clear — not to be beaten there."), over = Js.alit("Blazes it over the bar!", "Drags it high and wide of the target!"), post = Js.alit("Off the woodwork! So close!", "Cannons back off the post!"), wide = Js.alit("Wide of the mark!", "Just can't find the target."), blocked = Js.alit("Blocked! A defender gets across in time.", "Charged down before it can trouble the keeper."), tackled = Js.alit("Cut out! A defender reads it and steps in.", "Intercepted — the defence saw that coming."), out = Js.alit("Runs out of play.", "That one's gone out."), short = Js.alit("Doesn't have the legs on it.", "Comes up just short."), offside = Js.alit("The flag is up — offside!", "Offside! The linesman's flag is raised.", "Caught offside — the run was timed too early."), touchOn = Js.alit("Takes it away from trouble — and he's straight onto it!", "A touch into space, and he's still got it!", "Rolls it clear of danger and picks it back up!") }, { "goal", "rebound", "saved", "caught", "tipped", "over", "post", "wide", "blocked", "tackled", "out", "short", "offside", "touchOn" })
	RESULT_TEAMMATE_TEMPLATES = Js.O({ goal = Js.alit("GOAL! {role} makes no mistake — that's an assist for you!", "IT'S THERE! {role} finishes it off — quality from you to set that up!", "GOALLL! {role} buries it!"), rebound = Js.alit("{role} follows in the rebound — GOAL! Still your assist in the build-up!"), saved = Js.alit("Great save! {role}'s effort is kept out.", "The keeper denies {role}!"), caught = Js.alit("Comfortable take — {role}'s shot was straight at the keeper."), tipped = Js.alit("Tipped over! {role} almost got the finish he deserved."), over = Js.alit("{role} blazes it over — that chance has gone begging."), post = Js.alit("Off the post! {role} will be gutted with that."), wide = Js.alit("{role} drags it wide — so close to rewarding your pass."), blocked = Js.alit("Blocked! A defender recovers just in time to deny {role}."), tackled = Js.alit("Taken off {role} before he can get his shot away."), offside = Js.alit("The flag is up — {role} had gone too early.", "Offside against {role}. The ball was perfect; the run was not."), out = Js.alit("{role}'s effort balloons out of play."), short = Js.alit("{role} can't quite get enough on it.") }, { "goal", "rebound", "saved", "caught", "tipped", "over", "post", "wide", "blocked", "tackled", "offside", "out", "short" })
	RESULT_PASS_FAIL = Js.O({ wide = Js.alit("Overhit — nobody could get on the end of that.", "Runs away from everyone — too much on it."), short = Js.alit("Under-hit — cut out before it reaches anyone.", "Doesn't have the legs to find him."), blocked = Js.alit("Charged down on its way through.", "A defender throws himself in front of it."), tackled = Js.alit("Cut out! A defender reads it well.", "Intercepted before it can find its man."), out = Js.alit("Runs out of play — possession lost.", "Overhit and out of play."), saved = Js.alit("Claimed by the keeper before it can find its man."), caught = Js.alit("The keeper comes to collect it first."), tipped = Js.alit("The keeper gets there first and knocks it clear.") }, { "wide", "short", "blocked", "tackled", "out", "saved", "caught", "tipped" })
	RESULT_PASS_OK = Js.O({ delivered = Js.alit("Picks him out perfectly — nice bit of play.", "Finds his team-mate — simple and effective.") }, { "delivered" })
	BUILDUP_NAMED = Js.O({ volley = Js.alit("{name} whips it across — get up and meet it first time!", "Here comes the ball from {name} — first-time effort on!", "{name} flashes it across the box — volley chance!"), header = Js.alit("{name} floats it in — rise and meet it.", "The delivery is in from {name} — attack it with your head.", "Great ball from {name} — header on target?"), cutback = Js.alit("Bursts to the byline — {name} is arriving in the middle.", "Gets to the line, and {name} has found the space behind them.", "Byline reached — {name} is screaming for it across the six-yard box."), byline_cross = Js.alit("Out by the corner flag — {name} is attacking the far post.", "Reaches the byline, {name} peeling off his marker.", "Down the line and to the byline — {name} is the target."), through_ball = Js.alit("{name} is making the run in behind — can you thread it through?", "The defence is stepping up and {name} is away — a ball over the top could be lethal.", "Eyes up: {name} has split the back line with his run."), midfield_pass = Js.alit("{name} shows for it — keep it simple.", "No rush here — {name} is the free man.", "Patient build-up, and {name} has come short."), corner = Js.alit("Corner kick — {name} is the one to find.", "Swinging one in, and {name} is attacking it.", "Corner from the flag — {name} wants it most."), buildup = Js.alit("Deep in midfield — {name} has pulled off the front.", "On the ball, and {name} is the pass that breaks the line.", "Building from the back — {name} is showing between the lines.") }, { "volley", "header", "cutback", "byline_cross", "through_ball", "midfield_pass", "corner", "buildup" })
	STRIKE_NAMED = Js.O({ cutback = Js.alit("Cuts it back for {name}!", "Pulls it back into {name}!", "Squares it for {name}!"), byline_cross = Js.alit("Whips it in towards {name}!", "Delivers it onto {name}!", "Hangs one up for {name}!"), through_ball = Js.alit("Threads it through for {name}!", "Slips {name} in behind!", "Splits them open for {name}!"), midfield_pass = Js.alit("Rolls it into {name}.", "Finds {name}.", "Plays it simple, into {name}."), corner = Js.alit("Swings it in towards {name}!", "Picks out {name} in the crowd!", "A teasing delivery onto {name}!"), buildup = Js.alit("Picks out {name}!", "Plays it forward into {name}!", "Threads it up to {name}!") }, { "cutback", "byline_cross", "through_ball", "midfield_pass", "corner", "buildup" })
	withExtra(BUILDUP, M_commentaryExtra.EXTRA_BUILDUP)
	withExtra(STRIKE, M_commentaryExtra.EXTRA_STRIKE)
	withExtra(RESULT_SELF, M_commentaryExtra.EXTRA_RESULT_SELF)
	withExtra(RESULT_TEAMMATE_TEMPLATES, M_commentaryExtra.EXTRA_RESULT_TEAMMATE)
	A.push(RECEIVED, Js.unpack(M_commentaryExtra.EXTRA_RECEIVED))
	A.push(RECEIVER_SHOT, Js.unpack(M_commentaryExtra.EXTRA_RECEIVER_SHOT))
end
