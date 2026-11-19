// A do-nothing stand-in for any native package (boot-sim.mjs).
const fn = function () { return P; };
const P = new Proxy(fn, {
  get(_t, k) {
    if (k === "__get") return (kk) => P[kk];
    if (k === "__esModule") return true;
    if (k === "default") return P;
    if (k === Symbol.toPrimitive) return () => "";
    if (k === "then") return undefined;
    if (k === "OS") return "android";
    if (k === "select") return (o) => (o && (o.android ?? o.native ?? o.default));
    if (k === "create" || k === "flatten") return (x) => x;
    return P;
  },
  apply() { return P; }, construct() { return P; },
  getPrototypeOf() { return protoP; },
});
var protoP = new Proxy({}, { get(_t, k) { return k === "then" ? undefined : P.__get(k); } });
module.exports = P;
