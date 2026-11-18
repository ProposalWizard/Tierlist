// Imported FIRST by the career checks: makes Node look like React Native's
// JavaScript world. React Native has `window` (it is the global object) but
// no localStorage, no document and no navigator.userAgent; code in lib/star
// that reaches for those must still run, as it will on a phone.
const g = globalThis as Record<string, unknown>;
g.window = globalThis;
delete g.localStorage;
delete g.document;
export {};
