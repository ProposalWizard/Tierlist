// Boots shelf mock at 390 css px: same card CSS as components/star/BootShelf.tsx,
// "before" = the real BootPicture SVG, "after" = the Blender render.
const React = require('/home/user/Tierlist/node_modules/react');
const { renderToStaticMarkup } = require('/home/user/Tierlist/node_modules/react-dom/server');
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) { if (req === 'react' || req.startsWith('react/')) req = '/home/user/Tierlist/node_modules/' + req; return orig.call(this, req, ...a); };
const BP = require('./js/BootPicture.js'); const Boot = BP.default, LOOK = BP.BOOT_LOOK;
const data = JSON.parse(process.argv[2]);
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const pic = (mode, base, lv, w) => mode === 'before'
  ? renderToStaticMarkup(React.createElement(Boot, { base, level: lv })).replace('<svg', `<svg style="width:${w}px;display:block"`)
  : `<img src="file:///dev/shm/blender-shop/shelf/boot-${base}-L${lv}.png" style="width:${w}px;display:block">`;
function card(mode, d, wearing) {
  const look = LOOK[d.base];
  const badge = d.curve ? '<span class="tag" style="background:#0ea5e9">CURVE</span>' : d.touch ? '<span class="tag" style="background:#d946ef">TOUCH</span>' : '';
  return `<div class="card" style="background:radial-gradient(80% 60% at 50% 0%, ${rgba(look.upper, .45)} 0%, transparent 70%), linear-gradient(180deg,#1a2234,#0a0f1a);box-shadow:inset 0 0 0 1px ${wearing ? 'rgba(52,211,153,.8)' : rgba(look.upper, .35)}">
    <div class="spot"></div><div class="plank"></div>
    <div class="pic" style="${mode === 'after' ? 'padding-bottom:9px' : ''}">${pic(mode, d.base, 5, mode === 'after' ? 136 : 142)}</div>
    <div class="txt"><div class="row"><span class="nm">${d.name}</span>${badge}</div>
    <div class="st">Pow +${d.pow} · Tec +${d.tec}</div><div class="pr">★${d.price} <span>L5</span></div></div>
    ${wearing ? '<span class="wear">WEARING</span>' : ''}</div>`;
}
function page(mode) {
  const by = Object.fromEntries(data.map((d) => [d.base, d]));
  const shelf = (title, note, ids) => `<div class="sh"><div class="hd"><span class="t">${title}</span><span class="n">${note}</span></div>
    <div class="shelf"><div class="board"></div><div class="rowc">${ids.map((id) => card(mode, by[id], id === 'starter')).join('')}</div></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:390px;background:#04070e;font-family:'DejaVu Sans',sans-serif;color:#fff;overflow:hidden}
  .top{width:390px;display:block}
  .sh{padding:0 12px;margin-top:6px}.hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
  .t{font-size:11px;font-weight:900;letter-spacing:.2em;color:rgba(255,255,255,.85)}.n{font-size:10px;font-weight:700;color:rgba(255,255,255,.6)}
  .shelf{position:relative}.board{position:absolute;left:0;right:0;top:88px;height:12px;border-radius:2px;background:linear-gradient(180deg,#8b6a4a,#4a3423);box-shadow:0 6px 12px -4px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.25)}
  .rowc{display:flex;gap:10px;overflow:hidden;margin-right:-12px;padding-bottom:4px}
  .card{position:relative;width:150px;flex-shrink:0;border-radius:16px;overflow:hidden}
  .spot{position:absolute;left:50%;top:0;height:96px;width:112px;transform:translateX(-50%);background:radial-gradient(50% 100% at 50% 0%,rgba(255,255,255,.22),transparent 70%)}
  .plank{position:absolute;left:0;right:0;top:88px;height:12px;background:linear-gradient(180deg,#8b6a4a,#4a3423);box-shadow:0 6px 10px -4px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.25)}
  .pic{position:relative;display:flex;height:98px;align-items:flex-end;justify-content:center;padding:0 4px;box-sizing:border-box}
  .txt{position:relative;height:66px;padding:10px 8px 0}.row{display:flex;align-items:center;gap:4px}
  .nm{font-size:13px;font-weight:900;white-space:nowrap}.tag{border-radius:4px;padding:2px 4px;font-size:8px;font-weight:900;line-height:1}
  .st{font-size:10px;font-weight:700;color:rgba(255,255,255,.8)}.pr{font-size:11px;font-weight:900;color:#fde047}.pr span{font-size:9px;font-weight:700;color:rgba(255,255,255,.6)}
  .wear{position:absolute;left:6px;top:6px;border-radius:999px;background:#34d399;padding:2px 6px;font-size:9px;font-weight:900;color:#022c22}
  .now{margin:22px 12px 0;border-radius:16px;padding:10px;display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,#152033,#0c1220);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
  .nowp{width:72px;height:48px;border-radius:12px;background:linear-gradient(180deg,#1e3a5f,#0f1b2d);display:flex;align-items:center;justify-content:center;overflow:hidden}
  .l1{font-size:9px;font-weight:900;letter-spacing:.2em;color:rgba(255,255,255,.6)}.l2{font-size:13px;font-weight:900}
  </style></head><body>
  <img class="top" src="file:///dev/shm/blender-shop/svg/boots-top.png">
  ${shelf('EVERYDAY BOOTS', 'Swipe the shelf →', ['starter', 'speed', 'power', 'control', 'elite'])}
  <div style="height:14px"></div>
  ${shelf('SPECIAL BOOTS', 'A whole new ability in a match', ['curl', 'maestro'])}
  <div class="now"><div class="nowp">${mode === 'before' ? renderToStaticMarkup(React.createElement(Boot, { base: 'starter', level: 1 })).replace('<svg', '<svg style="width:66px"') : '<img src="file:///dev/shm/blender-shop/shelf/boot-starter-L1.png" style="width:64px">'}</div>
  <div><div class="l1">WEARING NOW</div><div class="l2">NS-Pure — 3 matches left</div></div></div>
  </body></html>`;
}
for (const m of ['before', 'after']) require('fs').writeFileSync(`mock-boots-${m}.html`, page(m));
