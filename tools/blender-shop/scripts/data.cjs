const Module = require('module'); const path = require('path');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...a) {
  if (req.startsWith('@/lib/')) req = path.join(__dirname, 'jslib', req.slice(6));
  return orig.call(this, req, parent, ...a);
};
const sd = require('./jslib/star/shopDefaults.js');
const { formatMoney } = require('./jslib/star/money.js');
const out = sd.BOOT_LEVELS.filter(b => b.level === 5).map(b => ({ base: b.baseId, name: b.name, pow: b.power, tec: b.technique, price: formatMoney(b.price), curve: !!b.curve, touch: !!b.extraTouch }));
console.log(JSON.stringify(out));
const speed = sd.BOOT_LEVELS.filter(b => b.baseId === 'speed').map(b => ({ l: b.level, price: formatMoney(b.price), pow: b.power, tec: b.technique, pace: b.pace }));
console.log(JSON.stringify(speed));
