--!nocheck
--!nolint
-- Generated from lib/star/media/detect/career.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_money = import("lib/star/money")
	local base, make, TRANSFER, CONTRACT, AWARD, BALLON_DOR, MANAGER, CALL_UP, CAPTAIN, TESTIMONIAL, RETIREMENT, HALL_RECORD, CASINO_SCANDAL, SEASON_REVIEW, CAREER_DETECTORS
	base = function(r)
		do return Js.O({ player = r.you.name, short = r.you.shortName, club = r.club, season = r.season, week = r.week, number = r.you.squadNumber, role = r.you.position }, { "player", "short", "club", "season", "week", "number", "role" }) end
	end
	make = function(id, subject, importance, tags, facts, window, threadKey)
		do return Js.O({ id = id, subject = subject, baseImportance = importance, tags = tags, facts = facts, window = window, threadKey = threadKey }, { "id", "subject", "baseImportance", "tags", "facts", "window", "threadKey" }) end
	end
	TRANSFER = function(r)
		if (r.moment.kind ~= "transfer") then
			do return nil end
		end
		local m = r.moment
		do return Js.alit(make("transfer-done", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 96, Js.alit("transfer", "rumour"), Js.ospread(base(r), Js.O({ from = m.from, to = m.to, fee = m.fee, feeText = ("£" .. M_money.formatMoney(m.fee)) }, { "from", "to", "fee", "feeText" })), "instant", ("transfer:" .. m.to)), make("farewell", Js.O({ kind = "club", name = m.from }, { "kind", "name" }), 62, Js.alit("transfer"), Js.ospread(base(r), Js.O({ from = m.from, to = m.to }, { "from", "to" })), "hour"), make("unveiling", Js.O({ kind = "club", name = m.to }, { "kind", "name" }), 74, Js.alit("transfer"), Js.ospread(base(r), Js.O({ from = m.from, to = m.to, feeText = ("£" .. M_money.formatMoney(m.fee)) }, { "from", "to", "feeText" })), "hour")) end
	end
	CONTRACT = function(r)
		if (r.moment.kind ~= "contract") then
			do return nil end
		end
		local m = r.moment
		do return make("contract-signed", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 68, Js.alit("contract", "transfer"), Js.ospread(base(r), Js.O({ club = m.club, seasons = m.seasons, wage = m.wage }, { "club", "seasons", "wage" })), "instant", ("contract:" .. m.club)) end
	end
	AWARD = function(r)
		if (r.moment.kind ~= "award") then
			do return nil end
		end
		local m = r.moment
		if (not m.won) then
			do return nil end
		end
		local big = Js.re("Season|Golden Boot", "i"):test(m.award)
		do return make("award-won", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), (if big then 88 else 64), Js.alit("award", "trophy"), Js.ospread(base(r), Js.O({ award = m.award, detail = m.detail }, { "award", "detail" })), "instant", "awards") end
	end
	BALLON_DOR = function(r)
		if (r.moment.kind ~= "ballon-dor") then
			do return nil end
		end
		local m = r.moment
		if (not m.won) then
			do return make("ballon-dor-missed", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 58, Js.alit("award", "opinion"), Js.ospread(base(r)), "instant") end
		end
		do return make("ballon-dor", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 100, Js.alit("award", "trophy", "record"), Js.ospread(base(r), Js.O({ total = m.total }, { "total" })), "instant", "awards") end
	end
	MANAGER = function(r)
		if (r.moment.kind ~= "manager-out") then
			do return nil end
		end
		local m = r.moment
		do return Js.alit(make("manager-sacked", Js.O({ kind = "manager", name = m.name }, { "kind", "name" }), 84, Js.alit("manager", "drama"), Js.ospread(base(r), Js.O({ manager = m.name, reason = m.reason }, { "manager", "reason" })), "instant", "manager"), make("manager-in", Js.O({ kind = "manager", name = m.incoming }, { "kind", "name" }), 70, Js.alit("manager"), Js.ospread(base(r), Js.O({ manager = m.incoming, previous = m.name }, { "manager", "previous" })), "hour", "manager")) end
	end
	CALL_UP = function(r)
		if (r.moment.kind ~= "call-up") then
			do return nil end
		end
		local m = r.moment
		do return make((if (m.caps <= 1) then "first-call-up" else "call-up"), Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), (if (m.caps <= 1) then 82 else 46), Js.alit("international", "award"), Js.ospread(base(r), Js.O({ nation = m.nation, caps = m.caps }, { "nation", "caps" })), "instant") end
	end
	CAPTAIN = function(r)
		if (r.moment.kind ~= "captain") then
			do return nil end
		end
		do return make("armband", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 76, Js.alit("award", "milestone"), Js.ospread(base(r)), "instant") end
	end
	TESTIMONIAL = function(r)
		if (r.moment.kind ~= "testimonial") then
			do return nil end
		end
		do return make("testimonial", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 72, Js.alit("milestone", "trophy"), Js.ospread(base(r)), "instant") end
	end
	RETIREMENT = function(r)
		if (r.moment.kind ~= "retirement") then
			do return nil end
		end
		local m = r.moment
		do return make("retirement", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 100, Js.alit("milestone", "record"), Js.ospread(base(r), Js.O({ goals = m.goals, apps = m.apps, trophies = m.trophies }, { "goals", "apps", "trophies" })), "instant") end
	end
	HALL_RECORD = function(r)
		if (r.moment.kind ~= "hall-record") then
			do return nil end
		end
		local m = r.moment
		local parts = S.split(S.trim(m.holder), Js.re("\\s+", ""))
		do return make("hall-record", Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), 90, Js.alit("record", "milestone"), Js.ospread(base(r), Js.O({ record = m.record, recordLower = (S.toLowerCase(S.charAt(m.record, 0)) .. S.slice(m.record, 1)), holder = m.holder, holderShort = (if (Js.alen(parts) > 1) then A.join(A.slice(parts, 1), " ") else m.holder), was = m.was, now = m.now, unit = m.unit }, { "record", "recordLower", "holder", "holderShort", "was", "now", "unit" })), "instant") end
	end
	CASINO_SCANDAL = function(r)
		if (r.moment.kind ~= "casino-scandal") then
			do return nil end
		end
		local m = r.moment
		local id = (if (m.step >= 4) then "casino-ban" else (if (m.step == 3) then "casino-expose" else ("casino-" .. m.story)))
		do return make(id, Js.O({ kind = "you", name = r.you.name }, { "kind", "name" }), (50 + (m.step * 10)), Js.alit("shame", "drama"), Js.ospread(base(r), Js.O({ bets = m.bets, step = m.step }, { "bets", "step" })), "instant") end
	end
	SEASON_REVIEW = function(r)
		if (r.moment.kind ~= "season-end") then
			do return nil end
		end
		local m = r.moment
		do return make("season-review", Js.O({ kind = "club", name = r.club }, { "kind", "name" }), 62, Js.alit("table", "opinion"), Js.ospread(base(r), Js.O({ position = m.position, headline = m.headline, detail = m.detail }, { "position", "headline", "detail" })), "weekly") end
	end
	CAREER_DETECTORS = Js.alit(TRANSFER, CONTRACT, AWARD, BALLON_DOR, MANAGER, CALL_UP, CAPTAIN, TESTIMONIAL, RETIREMENT, HALL_RECORD, CASINO_SCANDAL, SEASON_REVIEW)
	exports.CAREER_DETECTORS = CAREER_DETECTORS
end
