const path = require('path');
const React = require('/home/user/Tierlist/node_modules/react');
const { renderToStaticMarkup } = require('/home/user/Tierlist/node_modules/react-dom/server');
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...a) {
  if (req === 'react' || req.startsWith('react/')) req = '/home/user/Tierlist/node_modules/' + req;
  return orig.call(this, req, ...a);
};
const Boot = require('./js/BootPicture.js').default;
const SP = require('./js/StylePicture.js');
const Style = SP.default, TILE = SP.LEVEL_TILE;
const items = [];
for (const b of ['speed','starter','power','control','elite','curl','maestro']) for (let l = 1; l <= 5; l++) items.push(['boot-' + b, l, React.createElement(Boot, { base: b, level: l, className: 'pic' })]);
for (let l = 1; l <= 5; l++) items.push(['car', l, React.createElement(Style, { base: 'car-3', level: l, className: 'pic' })]);
for (let l = 1; l <= 5; l++) items.push(['house', l, React.createElement(Style, { base: 'house-1', level: l, className: 'pic' })]);
let html = '<html><body style="margin:0;background:#000">';
for (const [id, l, el] of items) {
  const bg = id.startsWith('boot') ? 'linear-gradient(180deg,#1f2937,#0c111c)' : `linear-gradient(180deg, ${TILE[l][0]}, ${TILE[l][1]})`;
  html += `<div id="${id}-L${l}" style="width:600px;height:450px;display:flex;align-items:center;justify-content:center;background:${bg}">${renderToStaticMarkup(el).replace('class="pic"', 'style="width:600px;height:384px"')}</div>`;
}
require('fs').writeFileSync('cur.html', html + '</body></html>');
console.log(items.length);
