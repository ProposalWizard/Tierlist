--!nocheck
--!nolint
-- Generated from lib/star/leoUpdate.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_react = import("__pkg/react")
	local LEO_UPDATE_KEY, EVENT, LEO_FEATURES, NONE, read, write, leoUpdateOn, setLeoUpdate, setLeoFeature, useLeoUpdate
	read = function()
		local _ok1, _err2, _rv3 = pcall(function()
			if (Js.window == nil) then
				do return Js.RET, NONE end
			end
			local raw = Js.window.localStorage.getItem(LEO_UPDATE_KEY)
			if (not Js.T(raw)) then
				do return Js.RET, NONE end
			end
			local s = Js.JSON.parse(raw)
			do return Js.RET, Js.O({ on = (s.on == true), off = (if Js.Array.isArray(s.off) then A.filter(s.off, function(x)
				return A.some(LEO_FEATURES, function(f)
					return (f.id == x)
				end)
			end) else Js.alit()) }, { "on", "off" }) end
		end)
		if not _ok1 then
			do return NONE end
		elseif _err2 == Js.RET then
			return _rv3
		end
	end
	write = function(s)
		local _ok4, _err5, _rv6 = pcall(function()
			Js.window.localStorage.setItem(LEO_UPDATE_KEY, Js.JSON.stringify(s))
		end)
		if not _ok4 then
		elseif _err5 == Js.RET then
			return _rv6
		end
		local _ok7, _err8, _rv9 = pcall(function()
			Js.window.dispatchEvent(Js.Event.new(EVENT))
		end)
		if not _ok7 then
		elseif _err8 == Js.RET then
			return _rv9
		end
	end
	leoUpdateOn = function(f)
		local s = read()
		if (not s.on) then
			do return false end
		end
		do return (if Js.T(f) then (not A.includes(s.off, f)) else true) end
	end
	exports.leoUpdateOn = leoUpdateOn
	setLeoUpdate = function(on)
		write(Js.ospread(read(), Js.O({ on = on }, { "on" })))
	end
	exports.setLeoUpdate = setLeoUpdate
	setLeoFeature = function(f, on)
		local s = read()
		write(Js.ospread(s, Js.O({ off = (if on then A.filter(s.off, function(x)
			return (x ~= f)
		end) else Js.aspread(A.filter(s.off, function(x)
			return (x ~= f)
		end), Js.alit(f))) }, { "off" })))
	end
	exports.setLeoFeature = setLeoFeature
	useLeoUpdate = function(f)
		local _d10 = M_react.useState(false)
		local on = _d10[1]
		local setOn = _d10[2]
		M_react.useEffect(function()
			local sync = function()
				return setOn(leoUpdateOn(f))
			end
			sync()
			Js.window.addEventListener(EVENT, sync)
			Js.window.addEventListener("storage", sync)
			do return function()
				Js.window.removeEventListener(EVENT, sync)
				Js.window.removeEventListener("storage", sync)
			end end
		end, Js.alit(f))
		do return on end
	end
	exports.useLeoUpdate = useLeoUpdate
	LEO_UPDATE_KEY = "kib-update-leo-2026-10-24"
	exports.LEO_UPDATE_KEY = LEO_UPDATE_KEY
	EVENT = "kib-leo-update"
	LEO_FEATURES = Js.alit(Js.O({ id = "celebrations", label = "Goal celebrations", line = "After your goal: run to the corner and your shop celebration; nobody stands on you; tap to skip; in goal videos." }, { "id", "label", "line" }), Js.O({ id = "bigMoments", label = "Big moments", line = "85'+ level or one down: heartbeat, crowd rise, slow motion on a goal, late commentary (no banner)." }, { "id", "label", "line" }), Js.O({ id = "feedSpeed", label = "Fast social feed", line = "Smooth scrolling on slow phones; videos made off the main thread and kept." }, { "id", "label", "line" }), Js.O({ id = "goalVideoNow", label = "Goal videos play at once", line = "Your goal and the highlights play straight away from the recording." }, { "id", "label", "line" }), Js.O({ id = "goalOfMonth", label = "Goal of the Month", line = "A monthly poll in the feed: your 3 best goals v 2 others." }, { "id", "label", "line" }), Js.O({ id = "seasonReel", label = "Season video", line = "Every goal of your season before the Ballon d'Or." }, { "id", "label", "line" }), Js.O({ id = "goalsGallery", label = "Career goals list", line = "Stats → Goals: every goal of your career; best 10 in the Hall of Fame." }, { "id", "label", "line" }), Js.O({ id = "awardsNight", label = "Season awards night", line = "The 3D awards night in place of the awards page." }, { "id", "label", "line" }), Js.O({ id = "weather", label = "Weather and pitch", line = "Wind bends the ball, rain skids it, a poor dry pitch kills it; shown before kick-off and in the match." }, { "id", "label", "line" }), Js.O({ id = "bugFixes", label = "Bug fixes (21)", line = "Refresh comes back where you were, labels, tour once, no sack after promotion, talks back button, signing manager name…" }, { "id", "label", "line" }))
	exports.LEO_FEATURES = LEO_FEATURES
	NONE = Js.O({ on = false, off = Js.alit() }, { "on", "off" })
end
