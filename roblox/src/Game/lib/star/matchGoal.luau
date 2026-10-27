--!nocheck
--!nolint
-- Generated from lib/star/matchGoal.ts by roblox/tools/ts2luau. Do not edit.
return function(exports, import, Js)
	local A, S, N, Math = Js.A, Js.S, Js.N, Js.Math
	local M_pitch = import("lib/star/pitch")
	local drawMatchGoal
	drawMatchGoal = function(ctx, P, unit, heightScale, upright, depth)
		if depth == nil then depth = M_pitch.NET_DEPTH end
		local hpx = (M_pitch.GOAL_H * heightScale)
		local up = function(foot)
			local top = Js.O({ px = foot.px, py = (foot.py - hpx) }, { "px", "py" })
			do return (if upright then upright(foot, top) else top) end
		end
		local bl = P(M_pitch.POST_L, 0)
		local br = P(M_pitch.POST_R, 0)
		local tl = up(bl)
		local tr = up(br)
		local rl = P(M_pitch.POST_L, (-depth))
		local rr = P(M_pitch.POST_R, (-depth))
		local ul = up(rl)
		local ur = up(rr)
		local path = function(q)
			ctx.beginPath()
			ctx.moveTo(q[1].px, q[1].py)
			for i = 1, (Js.alen(q)) - 1 do
				ctx.lineTo(q[i + 1].px, q[i + 1].py)
			end
			ctx.closePath()
		end
		local quad = function(q, fill)
			path(q)
			ctx.fillStyle = fill
			ctx.fill()
		end
		local seg = function(a2, b2)
			ctx.beginPath()
			ctx.moveTo(a2.px, a2.py)
			ctx.lineTo(b2.px, b2.py)
			ctx.stroke()
		end
		local lerp = function(a2, b2, f)
			return Js.O({ px = (a2.px + ((b2.px - a2.px) * f)), py = (a2.py + ((b2.py - a2.py) * f)) }, { "px", "py" })
		end
		local netting = function(q, cols, rows, alpha)
			ctx.save()
			path(q)
			ctx.clip()
			ctx.strokeStyle = ("rgba(255,255,255," .. Js.numstr(alpha) .. ")")
			ctx.lineWidth = Math.max(0.7, (unit * 0.028))
			for i = 0, math.floor(cols) do
				local f = (i / cols)
				seg(lerp(q[1], q[2], f), lerp(q[4], q[3], f))
			end
			for j = 0, math.floor(rows) do
				local f = (j / rows)
				seg(lerp(q[1], q[4], f), lerp(q[2], q[3], f))
			end
			ctx.restore()
		end
		local sh = (unit * 0.5)
		quad(A.map(Js.alit(rl, rr, br, bl), function(q)
			return Js.O({ px = (q.px + sh), py = (q.py + (sh * 0.3)) }, { "px", "py" })
		end), "rgba(0,0,0,0.09)")
		quad(Js.alit(bl, br, rr, rl), "rgba(20,50,32,0.05)")
		quad(Js.alit(rl, rr, ur, ul), "rgba(22,52,34,0.16)")
		netting(Js.alit(rl, rr, ur, ul), 34, 10, 0.42)
		ctx.strokeStyle = "#0f1a14"
		ctx.lineWidth = Math.max(1.8, (unit * 0.15))
		seg(rl, ul)
		seg(rr, ur)
		seg(ul, ur)
		quad(Js.alit(tl, tr, ur, ul), "rgba(236,245,239,0.30)")
		netting(Js.alit(tl, tr, ur, ul), 34, 5, 0.8)
		ctx.lineCap = "round"
		ctx.strokeStyle = "#f6faf7"
		ctx.lineWidth = Math.max(1.8, (unit * 0.12))
		seg(bl, tl)
		seg(br, tr)
		ctx.lineWidth = Math.max(2, (unit * 0.16))
		seg(tl, tr)
		ctx.lineCap = "butt"
		ctx.strokeStyle = "rgba(255,255,255,0.9)"
		ctx.lineWidth = Math.max(1.5, (unit * 0.11))
		seg(bl, br)
	end
	exports.drawMatchGoal = drawMatchGoal
end
