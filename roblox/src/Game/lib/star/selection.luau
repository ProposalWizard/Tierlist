--!nocheck
--!nolint
-- Generated from lib/star/selection.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_season = import("lib/star/season")
	local M_rating = import("lib/star/rating")
	local M_competitions = import("lib/star/competitions")
	local M_career = import("lib/star/intl/career")
	local M_manager = import("lib/star/manager")
	local M_tuningStore = import("lib/star/tuningStore")
	local NEUTRAL_FORM, FORM_WINDOW, recentForm, START_AT, BENCH_AT, SUB_LADDER, subLadderMinute, MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, selectionStanding, rivalWeek, shirtRival, shirtWon, recordAppearance, CUP_ROTATION_CHANCE, earlyCupRound, selectionFor, subComesOnNow, MISSED_WEEK, HOOK_LEGS_FLOOR, HOOK_EARLIEST, SUB_OFF_ENERGY, SUB_TIRED_FROM, HOOK_SETTLE_IN, hookCheck
	recentForm = function(form)
		local recent = A.slice(form, 0, FORM_WINDOW)
		local sum = (A.reduce(recent, function(s, r)
			return (s + r)
		end, 0) + (NEUTRAL_FORM * (FORM_WINDOW - Js.alen(recent))))
		do return (sum / FORM_WINDOW) end
	end
	exports.recentForm = recentForm
	subLadderMinute = function(standing, start, bench)
		if start == nil then start = START_AT end
		if bench == nil then bench = BENCH_AT end
		local p = ((standing - bench) / Math.max(1, (start - bench)))
		do return (if (p < 0.25) then 80 else (if (p < 0.5) then 70 else (if (p < 0.75) then 60 else 50))) end
	end
	exports.subLadderMinute = subLadderMinute
	selectionStanding = function(career)
		local form = recentForm(career.form)
		do return Math.max(0, Math.min(100, ((((career.relationships.boss * 0.4) + (((form / 10) * 100) * 0.35)) + (((career.starRating / 5) * 100) * 0.15)) + (career.matchFitness * 0.1)))) end
	end
	exports.selectionStanding = selectionStanding
	rivalWeek = function(overall, id, season, week)
		local h = 0
		for _ok1, _v2 in Js.iter(id) do
			local ch = _v2
			h = Math.imul(Js.bxor(h, S.charCodeAt(ch, 0)), 16777619)
		end
		local rng = M_season.mulberry32(Js.ushr(Js.bxor(Js.bxor(h, (season * 7919)), (week * 104729)), 0))
		local noise = ((((rng() + rng()) + rng()) - 1.5) * 1.1)
		do return Math.max(4.5, Math.min(9.5, ((6.6 + ((overall - 75) * 0.02)) + noise))) end
	end
	shirtRival = function(career)
		local pos = career.player.position
		local best = nil
		do
			local _arr3 = (if career.squad ~= nil then career.squad else Js.alit())
			local _i4 = 0
			while _i4 < Js.alen(_arr3) do
				_i4 += 1
				local p = _arr3[_i4]
				if ((p.position ~= pos) or (type(p.overall) ~= "number")) then
					do continue end
				end
				if ((not best) or ((if p.overall ~= nil then p.overall else 0) > (if best.overall ~= nil then best.overall else 0))) then
					best = p
				end
			end
		end
		if ((not best) or (type(best.overall) ~= "number")) then
			do return nil end
		end
		local w = career.week
		local weeks = A.map(Js.alit((w - 1), (w - 2), (w - 3)), function(k)
			return rivalWeek(best.overall, best.id, career.season, k)
		end)
		do return Js.O({ name = (if Js.T(best.shortName) then best.shortName else best.name), overall = best.overall, form = (A.reduce(weeks, function(a, b)
			return (a + b)
		end, 0) / Js.alen(weeks)), lastRating = weeks[1] }, { "name", "overall", "form", "lastRating" }) end
	end
	exports.shirtRival = shirtRival
	shirtWon = function(career)
		local here = (if (career.shirt and (career.shirt.club == career.player.club)) then career.shirt else nil)
		if (function() local _v = here; if _v == nil then return nil end; _v = _v.won; return _v end)() then
			do return true end
		end
		if ((not career.shirt) and (Js.alen(career.form) > 0)) then
			do return true end
		end
		local rival = shirtRival(career)
		if (not rival) then
			do return true end
		end
		if (M_rating.attributeOverall(career.skills) > rival.overall) then
			do return true end
		end
		local mine = recentForm((if Js.T((function() local _v = career.rawForm; if _v == nil then return nil end; _v = Js.len(_v); return _v end)()) then career.rawForm else career.form))
		if ((((function() local _v = here; if _v == nil then return nil end; _v = _v.apps; return _v end)() or 0) >= 2) and (mine >= 6.8)) then
			do return true end
		end
		if ((rival.form < 6) and (mine >= 6.3)) then
			do return true end
		end
		do return false end
	end
	exports.shirtWon = shirtWon
	recordAppearance = function(career)
		local club = career.player.club
		local here = (if (career.shirt and (career.shirt.club == club)) then career.shirt else Js.O({ club = club, won = false, apps = 0 }, { "club", "won", "apps" }))
		local next_ = Js.ospread(here, Js.O({ apps = (here.apps + 1) }, { "apps" }))
		do return Js.ospread(next_, Js.O({ won = (next_.won or shirtWon(Js.ospread(career, Js.O({ shirt = next_ }, { "shirt" })))) }, { "won" })) end
	end
	exports.recordAppearance = recordAppearance
	earlyCupRound = function(career)
		local f = M_competitions.nextFixtureFor(career)
		if ((not f) or (f.kind ~= "cup")) then
			do return false end
		end
		local r = (if f.round ~= nil then f.round else "")
		do return (not Js.re("Quarter|Semi|Final", "i"):test(r)) end
	end
	selectionFor = function(career)
		if career.injury then
			local weeks = career.injury.weeksRemaining
			do return Js.O({ status = "Injured", onAt = 90, standing = 0, reason = (career.injury.note .. ". Out for " .. Js.numstr(weeks) .. " more week" .. (if (weeks == 1) then "" else "s") .. ".") }, { "status", "onAt", "standing", "reason" }) end
		end
		do
			local f = M_competitions.nextFixtureFor(career)
			if (function() local _v = f; if _v == nil then return nil end; _v = _v.watch; return _v end)() then
				local nation = (((function() local _v = career.intl; if _v == nil then return nil end; _v = _v.nation; return _v end)() or career.player.nationality) or "your country")
				do return Js.O({ status = "Squad", onAt = 90, standing = selectionStanding(career), watch = true, reason = ("Not in the " .. nation .. " squad this time. Watch them on TV; the break is yours to train and rest.") }, { "status", "onAt", "standing", "watch", "reason" }) end
			end
			if (((function() local _v = f; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "international") and Js.T(f.intlId)) then
				local v = M_career.intlSelection(career, f)
				do return Js.ospread(Js.O({ status = v.status, onAt = v.onAt }, { "status", "onAt" }), (if Js.T(v.offAt) then Js.O({ offAt = v.offAt }, { "offAt" }) else Js.O({}, nil)), Js.O({ standing = selectionStanding(career), reason = v.reason }, { "standing", "reason" })) end
			end
			if (f and (f.kind ~= "international")) then
				local away = M_career.awayOnDuty(career, f)
				if Js.T(away) then
					do return Js.O({ status = "Squad", onAt = 90, standing = selectionStanding(career), reason = away, away = true }, { "status", "onAt", "standing", "reason", "away" }) end
				end
			end
			if (((function() local _v = f; if _v == nil then return nil end; _v = _v.kind; return _v end)() == "international") and ((not Js.T(f.round)) or ((function() local _v = career.tournament; if _v == nil then return nil end; _v = _v.season; return _v end)() == career.season))) then
				do return Js.O({ status = "1st Team", onAt = 0, standing = selectionStanding(career), reason = (if Js.T(f.round) then ("In the " .. (if Js.T(career.player.nationality) then career.player.nationality else "national") .. " squad for the " .. Js.str(f.competition) .. " — you start.") else ("Called up by " .. (if Js.T(career.player.nationality) then career.player.nationality else "your country") .. " — you start.")) }, { "status", "onAt", "standing", "reason" }) end
			end
		end
		local standing = selectionStanding(career)
		local form = recentForm(career.form)
		local bend = (if career.manager then M_manager.STYLE_SELECTION[career.manager.style] else Js.O({ start = 0, bench = 0 }, { "start", "bench" }))
		local START = (START_AT + bend.start)
		local BENCH = (BENCH_AT + bend.bench)
		local status = (if (standing >= START) then "1st Team" else (if (standing >= BENCH) then "Substitute" else "Squad"))
		local why = nil
		if ((status == "1st Team") and (not shirtWon(career))) then
			local rival = shirtRival(career)
			status = "Substitute"
			why = (rival.name .. " (" .. Js.numstr(rival.overall) .. ") starts ahead of you — his last 3 average " .. N.toFixed(rival.form, 1) .. ", yours " .. N.toFixed(form, 1) .. ". Play well when you come on to take his place.")
		end
		if ((status ~= "1st Team") and earlyCupRound(career)) then
			local roll = M_season.mulberry32(Js.ushr(((career.season * 131) + (career.week * 977)), 0))()
			if (roll < CUP_ROTATION_CHANCE) then
				status = "1st Team"
				why = "Cup game — the manager rests some regulars and you start."
			end
		end
		if ((status == "1st Team") and (career.energy < MIN_ENERGY_TO_START)) then
			status = "Substitute"
		end
		if ((status == "Substitute") and (career.energy < MIN_ENERGY_TO_SUB)) then
			status = "Squad"
		end
		if (status == "1st Team") then
			do return Js.O({ status = status, onAt = 0, standing = standing, reason = (if why ~= nil then why else (if (standing >= 78) then "First name on the team sheet." else "You start.")) }, { "status", "onAt", "standing", "reason" }) end
		end
		if (status == "Substitute") then
			local onAt = subLadderMinute(standing, START, BENCH)
			do return Js.O({ status = status, onAt = onAt, standing = standing, reason = (if (career.energy < MIN_ENERGY_TO_START) then "Too fatigued to start — fit enough for the bench, not for ninety minutes." else (if Js.T(why) then why else (if (career.relationships.boss < 40) then "The manager has left you out. You are on the bench." else ("Form has dipped (" .. N.toFixed(form, 1) .. " avg). You start on the bench.")))) }, { "status", "onAt", "standing", "reason" }) end
		end
		do return Js.O({ status = status, onAt = 90, standing = standing, reason = (if (career.energy < MIN_ENERGY_TO_SUB) then "Running on empty — not fit enough to risk, even off the bench." else (if (career.relationships.boss < 30) then "You are not in the squad. The manager has made his feelings clear." else "You are not in the squad this week.")) }, { "status", "onAt", "standing", "reason" }) end
	end
	exports.selectionFor = selectionFor
	subComesOnNow = function(minute, scoreDiff, jitter, rung)
		if jitter == nil then jitter = 0 end
		if (rung ~= nil) then
			local at = Math.max(50, (rung - (if (scoreDiff <= -2) then 10 else (if (scoreDiff == -1) then 5 else 0))))
			do return (minute >= (at + jitter)) end
		end
		local at = (if (scoreDiff <= -2) then 50 else (if (scoreDiff == -1) then 56 else (if (scoreDiff == 0) then 64 else (if (scoreDiff == 1) then 72 else 80))))
		do return (minute >= (at + jitter)) end
	end
	exports.subComesOnNow = subComesOnNow
	hookCheck = function(args)
		local none = Js.O({ hooked = false, reason = nil, message = "" }, { "hooked", "reason", "message" })
		if args.cameo then
			local energy = (if args.liveEnergy ~= nil then args.liveEnergy else 100)
			local off = Js.O({ hooked = true, reason = "legs", message = ("Out on your feet at " .. Js.numstr(Math.round(energy)) .. "% energy — you are taken off.") }, { "hooked", "reason", "message" })
			if (energy <= SUB_OFF_ENERGY) then
				do return off end
			end
			if ((energy < SUB_TIRED_FROM) and (args.rng() < (0.5 * (1 - (energy / SUB_TIRED_FROM))))) then
				do return off end
			end
			do return none end
		end
		if (args.minute < HOOK_EARLIEST) then
			do return none end
		end
		if ((args.minute - args.startMinute) < HOOK_SETTLE_IN) then
			do return none end
		end
		local late = Math.max(0, Math.min(1, ((args.minute - HOOK_EARLIEST) / 30)))
		local liveEnergy = (if args.liveEnergy ~= nil then args.liveEnergy else 100)
		if (liveEnergy < HOOK_LEGS_FLOOR) then
			local p = ((0.16 + (late * 0.3)) * (1 - (liveEnergy / HOOK_LEGS_FLOOR)))
			if (args.rng() < p) then
				do return Js.O({ hooked = true, reason = "legs", message = "Legs gone — you are withdrawn before you get injured." }, { "hooked", "reason", "message" }) end
			end
		end
		if (args.liveRating < 6.05) then
			local p = ((0.1 + (late * 0.22)) * Math.min(1, ((6.05 - args.liveRating) / 0.4)))
			if (args.rng() < p) then
				do return Js.O({ hooked = true, reason = "form", message = "Your number is up. You are replaced." }, { "hooked", "reason", "message" }) end
			end
		end
		if ((args.scoreDiff >= 3) and (args.minute >= 72)) then
			if (args.rng() < (0.14 + (late * 0.2))) then
				do return Js.O({ hooked = true, reason = "rested", message = "Job done — you get a standing ovation as you come off." }, { "hooked", "reason", "message" }) end
			end
		end
		do return none end
	end
	exports.hookCheck = hookCheck
	NEUTRAL_FORM = 6.5
	FORM_WINDOW = 3
	START_AT = 55
	BENCH_AT = 34
	SUB_LADDER = Js.alit(80, 70, 60, 50)
	exports.SUB_LADDER = SUB_LADDER
	MIN_ENERGY_TO_START = M_tuningStore.getTuning("energy.minToStart")
	exports.MIN_ENERGY_TO_START = MIN_ENERGY_TO_START
	MIN_ENERGY_TO_SUB = M_tuningStore.getTuning("energy.minToSub")
	exports.MIN_ENERGY_TO_SUB = MIN_ENERGY_TO_SUB
	CUP_ROTATION_CHANCE = 0.6
	MISSED_WEEK = Js.O({ matchFitness = -7, boss = Js.Number(3), energy = M_tuningStore.getTuning("energy.missedWeekEnergy") }, { "matchFitness", "boss", "energy" })
	exports.MISSED_WEEK = MISSED_WEEK
	HOOK_LEGS_FLOOR = M_tuningStore.getTuning("energy.hookLegsFloor")
	HOOK_EARLIEST = 60
	SUB_OFF_ENERGY = 0
	exports.SUB_OFF_ENERGY = SUB_OFF_ENERGY
	SUB_TIRED_FROM = 10
	exports.SUB_TIRED_FROM = SUB_TIRED_FROM
	HOOK_SETTLE_IN = 15
end
