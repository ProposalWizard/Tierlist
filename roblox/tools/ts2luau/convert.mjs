#!/usr/bin/env node
/**
 * ts2luau: turns the website's TypeScript into Roblox Luau, file for file.
 *
 *   node roblox/tools/ts2luau/convert.mjs lib/star/careerFlow.ts [more entry files]
 *
 * Converts every entry file and everything it imports (not `import type`),
 * writing roblox/src/Game/<same path>.luau. A file with a hand-written
 * replacement in roblox/src/Overrides/<same path>.luau is copied from there
 * instead. Never edit the output: change the website file or this converter,
 * then run it again.
 *
 * The output leans on roblox/src/Runtime/Js.luau for everything JavaScript
 * does differently from Luau (lists from 0, ordered objects, text in UTF-16,
 * number printing, stable sort...).
 */
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const OUT_DIR = path.join(REPO, "roblox/src/Game");
const OVERRIDES = path.join(REPO, "roblox/src/Overrides");

// ───────────────────────────────────────────────────────────── helpers ──

const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
  "continue", "goto", "type", "export", "typeof",
]);
// names the generated code itself uses at file level
const RESERVED = new Set(["Js", "import", "exports", "A", "S", "N", "O", "Math", "JSON", "Object",
  "self", "_ENV", "setmetatable", "getmetatable", "rawget", "rawset", "pcall", "error", "select",
  "tostring", "tonumber", "pairs", "ipairs", "next", "print", "string", "table", "math", "bit32",
  "utf8", "coroutine", "os", "task", "game", "workspace", "script", "require", "unpack", "_G",
  "assert", "warn", "wait", "delay", "spawn", "tick", "time", "debug", "buffer", "vector"]);

function luaName(name) {
  if (LUA_KEYWORDS.has(name) || RESERVED.has(name)) return name + "_";
  if (name.startsWith("$")) return "S_" + name.slice(1);
  return name.replace(/\$/g, "_S_");
}
const isLuaIdent = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !LUA_KEYWORDS.has(s);

function luaString(s) {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 32 || c === 127) out += "\\" + String(c).padStart(3, "0");
    else if (c >= 0xd800 && c <= 0xdfff) out += "\\u{FFFD}";
    else out += ch;
  }
  return out + '"';
}

function luaNumber(n) {
  if (Number.isNaN(n)) return "(0/0)";
  if (n === Infinity) return "math.huge";
  if (n === -Infinity) return "(-math.huge)";
  const s = String(n);
  return s;
}

function modKey(file) {
  if (file.startsWith(PKG)) return "__pkg/" + file.slice(PKG.length);
  // repo-relative path without .ts; JSON keeps a _json suffix
  let rel = path.relative(REPO, file).split(path.sep).join("/");
  if (rel.endsWith(".json")) return rel.slice(0, -5) + "_json";
  return rel.replace(/\.(ts|tsx|mts)$/, "");
}

class ConvertError extends Error {}

// ─────────────────────────────────────────────────────────── the program ──

function makeProgram(entries) {
  const cfgPath = path.join(REPO, "tsconfig.json");
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, REPO);
  const options = { ...parsed.options, noEmit: true, incremental: false, tsBuildInfoFile: undefined };
  return ts.createProgram(entries.map((e) => path.resolve(REPO, e)), options);
}

// A package import (e.g. "react") maps to a hand-written stand-in in
// roblox/src/Overrides/__pkg/<name>.luau; there is none for a package not listed.
const PKG = "\0pkg:";
function resolveImport(program, fromFile, spec) {
  if (!spec.startsWith(".") && !spec.startsWith("@/") && !spec.startsWith("/")) {
    if (fs.existsSync(path.join(OVERRIDES, "__pkg", spec + ".luau"))) return PKG + spec;
  }
  const r = ts.resolveModuleName(spec, fromFile, program.getCompilerOptions(), ts.sys);
  if (r.resolvedModule) return r.resolvedModule.resolvedFileName;
  // JSON with resolveJsonModule
  if (spec.endsWith(".json")) {
    let base = spec.startsWith("@/") ? path.join(REPO, spec.slice(2)) : path.resolve(path.dirname(fromFile), spec);
    if (fs.existsSync(base)) return base;
  }
  return null;
}

// ───────────────────────────────────────────────────────────── the types ──

function typeInfo(checker, type) {
  // what a value of this type can be at run time
  const info = { arr: false, str: false, num: false, bool: false, obj: false, fn: false,
    map: false, set: false, date: false, regex: false, promise: false, any: false, nullish: false, cls: false };
  const seen = new Set();
  const visit = (t) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    const f = t.flags;
    if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) { info.any = true; return; }
    if (f & ts.TypeFlags.Never) return;
    if (f & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) { info.nullish = true; return; }
    if (f & ts.TypeFlags.Union) { t.types.forEach(visit); return; }
    if (f & ts.TypeFlags.Intersection) {
      // a branded primitive (string & {...}) is still that primitive
      t.types.forEach(visit);
      return;
    }
    if (f & ts.TypeFlags.TypeParameter || f & ts.TypeFlags.Index || f & ts.TypeFlags.IndexedAccess || f & ts.TypeFlags.Conditional || f & ts.TypeFlags.Substitution) {
      const c = checker.getBaseConstraintOfType(t);
      if (c && c !== t) visit(c);
      else info.any = true;
      return;
    }
    if (f & ts.TypeFlags.StringLike) { info.str = true; return; }
    if (f & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) { info.num = true; return; }
    if (f & ts.TypeFlags.BooleanLike) { info.bool = true; return; }
    if (f & ts.TypeFlags.ESSymbolLike) { info.obj = true; return; }
    if (f & ts.TypeFlags.Object) {
      if (checker.isArrayType(t) || checker.isTupleType(t)) { info.arr = true; return; }
      const sym = t.getSymbol() || t.aliasSymbol;
      const name = sym && sym.getName();
      if (name === "Map" || name === "ReadonlyMap" || name === "WeakMap") { info.map = true; return; }
      if (name === "Set" || name === "ReadonlySet" || name === "WeakSet") { info.set = true; return; }
      if (name === "Date") { info.date = true; return; }
      if (name === "RegExp" || name === "RegExpMatchArray" || name === "RegExpExecArray") {
        if (name === "RegExp") { info.regex = true; return; }
        info.arr = true; return;
      }
      if (name === "ReadonlyArray" || name === "Array") { info.arr = true; return; }
      if (name === "String") { info.str = true; return; }
      if (name === "Number") { info.num = true; return; }
      if (name === "Promise" || name === "PromiseLike") { info.promise = true; return; }
      if (name === "Generator" || name === "IterableIterator" || name === "Iterator") { info.regex = true; return; }
      if (t.getCallSignatures().length > 0 && t.getProperties().length === 0) { info.fn = true; return; }
      if (sym && sym.flags & ts.SymbolFlags.Class) { info.cls = true; info.obj = true; return; }
      info.obj = true;
      return;
    }
    info.any = true;
  };
  visit(type);
  return info;
}

// exactly one kind (ignoring undefined/null)
function only(info, kind) {
  const kinds = ["arr", "str", "num", "bool", "obj", "fn", "map", "set", "date", "regex", "promise", "any"];
  return info[kind] && kinds.every((k) => k === kind || !info[k]);
}

// ──────────────────────────────────────────────────────────── the emitter ──

class FileEmitter {
  constructor(program, sf, moduleFiles) {
    this.program = program;
    this.checker = program.getTypeChecker();
    this.sf = sf;
    this.file = sf.fileName;
    this.moduleFiles = moduleFiles; // set of files we convert
    this.imports = new Map(); // module key -> local name
    this.importOrder = [];
    this.lines = [];
    this.ind = 1;
    this.tmp = 0;
    this.topNames = new Map(); // symbol -> lua expr
    this.exportedLets = new Set(); // symbol
    this.fnStack = []; // { tryDepth, inTry }
    this.loopStack = []; // { kind:"loop"|"switch", contFlag?, breakFlag? }
    this.errors = [];
    this.renames = new Map(); // symbol -> lua name (for locals that clash)
  }

  err(node, msg) {
    const { line } = this.sf.getLineAndCharacterOfPosition(node.getStart(this.sf));
    throw new ConvertError(`${path.relative(REPO, this.file)}:${line + 1}: ${msg}\n    ${node.getText(this.sf).slice(0, 160)}`);
  }

  t(prefix = "_t") { this.tmp += 1; return `${prefix}${this.tmp}`; }

  emit(line) {
    // a statement starting with "(" would read as a call on the line before
    if (line.startsWith("(") || line.startsWith(";(")) {
      if (line.startsWith(";")) line = line.slice(1);
      const prev = this.lines[this.lines.length - 1];
      if (prev !== undefined && !/(\bthen|\bdo|\belse|\brepeat|^\s*function.*\)|= function\(.*\)|\bfunction\(.*\))\s*$/.test(prev) && !prev.trimEnd().endsWith(";")) {
        this.lines[this.lines.length - 1] = prev + ";";
      }
    }
    this.lines.push("\t".repeat(this.ind) + line);
  }

  typeOf(node) {
    return typeInfo(this.checker, this.checker.getTypeAtLocation(node));
  }

  // ──────────────────────────────────────────────── names and symbols ──

  symbolOf(node) {
    let s = this.checker.getSymbolAtLocation(node);
    if (s && s.flags & ts.SymbolFlags.Alias) {
      // keep the alias itself: we need to know it was imported
      return s;
    }
    return s;
  }

  importLocal(file) {
    const key = modKey(file);
    if (this.imports.has(key)) return this.imports.get(key);
    let base = "M_" + key.split("/").pop().replace(/[^A-Za-z0-9_]/g, "_");
    let name = base;
    let i = 2;
    const used = new Set(this.imports.values());
    while (used.has(name)) name = base + "_" + i++;
    this.imports.set(key, name);
    this.importOrder.push(key);
    return name;
  }

  // The Luau expression for a reference to an identifier.
  identRef(node) {
    const name = node.text;
    if (name === "undefined") return "nil";
    if (name === "NaN") return "(0/0)";
    if (name === "Infinity") return "math.huge";
    const sym = this.symbolOf(node);
    if (!sym) {
      // shorthand property or unresolved global
      return this.globalRef(node, name);
    }
    const decl = sym.declarations && sym.declarations[0];
    if (sym.flags & ts.SymbolFlags.Alias && decl) {
      // an import
      if (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl)) {
        const importDecl = ts.findAncestor(decl, ts.isImportDeclaration);
        const spec = importDecl.moduleSpecifier.text;
        const target = resolveImport(this.program, this.file, spec);
        if (!target) this.err(node, `cannot resolve import ${spec}`);
        const local = this.importLocal(target);
        if (ts.isNamespaceImport(decl)) return local;
        if (ts.isImportClause(decl)) return `${local}.default`;
        const orig = (decl.propertyName || decl.name).text;
        return isLuaIdent(orig) ? `${local}.${orig}` : `${local}[${luaString(orig)}]`;
      }
    }
    if (!decl) return this.globalRef(node, name);
    // `declare const x` only describes a global
    const declStmt = ts.isVariableDeclaration(decl) ? decl.parent?.parent : decl;
    if (declStmt && (ts.getCombinedModifierFlags(declStmt) & ts.ModifierFlags.Ambient)) return this.globalRef(node, name);
    const declFile = decl.getSourceFile().fileName;
    if (declFile !== this.file) {
      return this.globalRef(node, name);
    }
    if (this.topNames.has(sym)) return this.topNames.get(sym);
    if (this.renames.has(sym)) return this.renames.get(sym);
    return luaName(name);
  }

  globalRef(node, name) {
    switch (name) {
      case "Math": return "Math";
      case "JSON": return "Js.JSON";
      case "Object": return "Js.Object";
      case "Number": return "Js.Number";
      case "Array": return "Js.Array";
      case "String": return "Js.String";
      case "Boolean": return "Js.Boolean";
      case "console": return "Js.console";
      case "Map": return "Js.Map";
      case "Set": return "Js.Set";
      case "Date": return "Js.Date";
      case "RegExp": return "Js.RegExp";
      case "Error": return "Js.Error";
      case "TypeError": return "Js.TypeError";
      case "RangeError": return "Js.RangeError";
      case "parseInt": return "Js.parseInt";
      case "parseFloat": return "Js.parseFloat";
      case "isNaN": return "Js.isNaN";
      case "isFinite": return "Js.isFinite";
      case "structuredClone": return "Js.structuredClone";
      case "Promise": return "Js.Promise";
      case "localStorage": return "Js.localStorage";
      case "fetch": return "Js.fetch";
      case "encodeURIComponent": return "Js.encodeURIComponent";
      case "decodeURIComponent": return "Js.decodeURIComponent";
      case "globalThis": return "Js.globalThis";
      case "process": return "Js.process";
      case "setTimeout": return "Js.setTimeout";
      case "clearTimeout": return "Js.clearTimeout";
      case "performance": return "Js.performance";
      case "window": return "Js.window";
      case "document": case "navigator":
      case "location": case "crypto": case "createImageBitmap": case "requestAnimationFrame": return `Js.${name}`; // nil in Roblox
      case "arguments": this.err(node, "`arguments` is not supported");
    }
    this.err(node, `unknown global '${name}'`);
  }

  // ─────────────────────────────────────────────────────────── purity ──

  isSimple(node) {
    node = this.skipParens(node);
    if (ts.isIdentifier(node) || node.kind === ts.SyntaxKind.ThisKeyword) return true;
    if (ts.isLiteralExpression(node) || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword || node.kind === ts.SyntaxKind.NullKeyword) return true;
    if (ts.isPropertyAccessExpression(node) && !node.questionDotToken) return this.isSimple(node.expression);
    if (ts.isNonNullExpression(node)) return this.isSimple(node.expression);
    if (ts.isElementAccessExpression(node) && !node.questionDotToken) return this.isSimple(node.expression) && this.isSimple(node.argumentExpression);
    return false;
  }

  skipParens(node) {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)
      || ts.isTypeAssertionExpression?.(node) || ts.isSatisfiesExpression?.(node)) node = node.expression;
    return node;
  }

  // ─────────────────────────────────────────────────────── conditions ──

  // A Luau boolean expression for JavaScript truthiness of `node`.
  cond(node) {
    node = this.skipParens(node);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      return `(not ${this.cond(node.operand)})`;
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return `(${this.cond(node.left)} and ${this.cond(node.right)})`;
      if (op === ts.SyntaxKind.BarBarToken) return `(${this.cond(node.left)} or ${this.cond(node.right)})`;
      if (isComparison(op)) return this.expr(node);
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
    if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
    const ti = this.typeOf(node);
    const e = this.expr(node);
    if (ti.str || ti.num || ti.any) return `Js.T(${e})`;
    // objects, functions, booleans (maybe undefined): Luau's own truthiness matches
    return e;
  }

  needsT(node) {
    const ti = this.typeOf(node);
    return ti.str || ti.num || ti.any;
  }

  // ──────────────────────────────────────────────────────── expressions ──

  expr(node) {
    const K = ts.SyntaxKind;
    switch (node.kind) {
      case K.Identifier: return this.identRef(node);
      case K.NumericLiteral: return luaNumber(Number(node.text.replace(/_/g, "")));
      case K.StringLiteral:
      case K.NoSubstitutionTemplateLiteral: return luaString(node.text);
      case K.TrueKeyword: return "true";
      case K.FalseKeyword: return "false";
      case K.NullKeyword: return "nil";
      case K.UndefinedKeyword: return "nil";
      case K.ThisKeyword: return "self";
      case K.SuperKeyword: this.err(node, "super is not supported");
      case K.ParenthesizedExpression: {
        const inner = this.expr(node.expression);
        return inner;
      }
      case K.AsExpression:
      case K.NonNullExpression:
      case K.SatisfiesExpression:
      case K.TypeAssertionExpression:
        return this.expr(node.expression);
      case K.TemplateExpression: return this.template(node);
      case K.RegularExpressionLiteral: {
        const m = /^\/(.*)\/([a-z]*)$/s.exec(node.text);
        return `Js.re(${luaString(m[1])}, ${luaString(m[2])})`;
      }
      case K.ArrayLiteralExpression: return this.arrayLit(node);
      case K.ObjectLiteralExpression: return this.objectLit(node);
      case K.PropertyAccessExpression: return this.propAccess(node);
      case K.ElementAccessExpression: return this.elemAccess(node);
      case K.CallExpression: return this.call(node);
      case K.NewExpression: return this.newExpr(node);
      case K.ArrowFunction:
      case K.FunctionExpression: return this.funcExpr(node);
      case K.ConditionalExpression:
        return `(if ${this.cond(node.condition)} then ${this.expr(node.whenTrue)} else ${this.expr(node.whenFalse)})`;
      case K.PrefixUnaryExpression: return this.prefixUnary(node);
      case K.PostfixUnaryExpression: return this.incDecExpr(node, false);
      case K.BinaryExpression: return this.binary(node);
      case K.TypeOfExpression: return `Js.typeof(${this.expr(node.expression)})`;
      case K.VoidExpression: return "nil";
      case K.DeleteExpression: {
        const target = this.skipParens(node.expression);
        if (ts.isPropertyAccessExpression(target)) return `Js.del(${this.expr(target.expression)}, ${luaString(target.name.text)})`;
        if (ts.isElementAccessExpression(target)) return `Js.del(${this.expr(target.expression)}, ${this.keyExpr(target.expression, target.argumentExpression)})`;
        this.err(node, "delete of this kind");
      }
      case K.AwaitExpression: return `Js.await(${this.expr(node.expression)})`;
      case K.YieldExpression:
        if (node.asteriskToken) this.err(node, "yield*");
        return `coroutine.yield(${node.expression ? this.expr(node.expression) : "nil"})`;
      case K.SpreadElement: this.err(node, "spread here");
      case K.ClassExpression: this.err(node, "class expression");
      case K.CommaListExpression: this.err(node, "comma list");
    }
    this.err(node, `expression kind ${ts.SyntaxKind[node.kind]}`);
  }

  template(node) {
    const parts = [];
    if (node.head.text) parts.push(luaString(node.head.text));
    for (const span of node.templateSpans) {
      parts.push(this.toStr(span.expression));
      if (span.literal.text) parts.push(luaString(span.literal.text));
    }
    if (parts.length === 0) return '""';
    if (parts.length === 1 && parts[0].startsWith('"')) return parts[0];
    return "(" + parts.join(" .. ") + ")";
  }

  // String(x), cheaply when x's type allows
  toStr(node) {
    const ti = this.typeOf(node);
    const e = this.expr(node);
    if (only(ti, "str") && !ti.nullish) return e;
    if (only(ti, "num") && !ti.nullish) return `Js.numstr(${e})`;
    return `Js.str(${e})`;
  }

  arrayLit(node) {
    const els = node.elements;
    if (!els.some(ts.isSpreadElement)) {
      return `Js.alit(${els.map((e) => ts.isOmittedExpression(e) ? "nil" : this.expr(e)).join(", ")})`;
    }
    const chunks = [];
    let cur = [];
    for (const e of els) {
      if (ts.isSpreadElement(e)) {
        if (cur.length) { chunks.push(`Js.alit(${cur.join(", ")})`); cur = []; }
        chunks.push(this.expr(e.expression));
      } else cur.push(this.expr(e));
    }
    if (cur.length) chunks.push(`Js.alit(${cur.join(", ")})`);
    return `Js.aspread(${chunks.join(", ")})`;
  }

  propKey(nameNode) {
    // a property name in an object literal or class -> { lua key text, js key }
    if (ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)) return nameNode.text;
    if (ts.isStringLiteral(nameNode) || ts.isNoSubstitutionTemplateLiteral(nameNode)) return nameNode.text;
    if (ts.isNumericLiteral(nameNode)) return String(Number(nameNode.text));
    return null; // computed
  }

  objectLit(node) {
    const props = node.properties;
    const simple = props.every((p) =>
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p))
      && this.propKey(p.name) !== null);
    if (simple) {
      const fields = [];
      const keys = [];
      for (const p of props) {
        const key = this.propKey(p.name);
        let val;
        if (ts.isPropertyAssignment(p)) val = this.expr(p.initializer);
        else if (ts.isShorthandPropertyAssignment(p)) val = this.shorthandRef(p);
        else val = this.funcExpr(p);
        const k = isLuaIdent(key) ? key : `[${luaString(key)}]`;
        // a later duplicate key wins, keeping the first position
        const i = keys.indexOf(key);
        if (i >= 0) fields[i] = `${k} = ${val}`;
        else { fields.push(`${k} = ${val}`); keys.push(key); }
      }
      if (fields.length === 0) return "Js.O({}, nil)";
      return `Js.O({ ${fields.join(", ")} }, { ${keys.map(luaString).join(", ")} })`;
    }
    // spreads or computed keys: build in order
    const chunks = [];
    let cur = null;
    const flush = () => { if (cur) { chunks.push(cur); cur = null; } };
    const parts = [];
    for (const p of props) {
      if (ts.isSpreadAssignment(p)) {
        flush();
        parts.push({ spread: this.expr(p.expression) });
      } else if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p)) {
        let keyExpr;
        const key = this.propKey(p.name);
        if (key !== null) keyExpr = luaString(key);
        else keyExpr = `Js.key(${this.expr(p.name.expression)})`;
        let val;
        if (ts.isPropertyAssignment(p)) val = this.expr(p.initializer);
        else if (ts.isShorthandPropertyAssignment(p)) val = this.shorthandRef(p);
        else val = this.funcExpr(p);
        parts.push({ key: keyExpr, val });
      } else this.err(p, "object literal member");
    }
    // only spreads and simple keys? use ospread with literal chunks
    const out = [];
    let lit = [];
    const flushLit = () => {
      if (!lit.length) return;
      if (lit.every((x) => x.key.startsWith('"'))) {
        const ks = lit.map((x) => x.key);
        out.push(`Js.O({ ${lit.map((x) => { const raw = JSON.parse(x.key.replace(/\\(\d{3})/g, "")); return (isLuaIdent(raw) ? raw : `[${x.key}]`) + " = " + x.val; }).join(", ")} }, { ${ks.join(", ")} })`);
      } else {
        const t = "_o";
        out.push(`(function() local ${t} = Js.O({}, nil); ${lit.map((x) => `${t}[${x.key}] = ${x.val}`).join("; ")}; return ${t} end)()`);
      }
      lit = [];
    };
    for (const p of parts) {
      if (p.spread !== undefined) { flushLit(); out.push(p.spread); }
      else lit.push(p);
    }
    flushLit();
    return `Js.ospread(${out.join(", ")})`;
  }

  shorthandRef(p) {
    const sym = this.checker.getShorthandAssignmentValueSymbol(p);
    if (sym) {
      const fake = p.name;
      // resolve through identRef using the value symbol
      const decl = sym.declarations && sym.declarations[0];
      if (decl && (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl))) {
        return this.identRef(fake);
      }
      if (this.topNames.has(sym)) return this.topNames.get(sym);
      if (this.renames.has(sym)) return this.renames.get(sym);
      if (decl && decl.getSourceFile().fileName !== this.file) return this.globalRef(fake, fake.text);
      return luaName(p.name.text);
    }
    return this.identRef(p.name);
  }

  // ─────────────────────────────────────────────── property and index ──

  isNamespaceObj(node) {
    // Math.x, JSON.x ... (a global namespace, not a value we built)
    node = this.skipParens(node);
    if (!ts.isIdentifier(node)) return null;
    const sym = this.symbolOf(node);
    const decl = sym && sym.declarations && sym.declarations[0];
    if (decl && decl.getSourceFile().fileName === this.file) return null;
    if (decl && (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl))) return null;
    return node.text;
  }

  propAccess(node, forCall = false) {
    const name = node.name.text;
    const ns = this.isNamespaceObj(node.expression);
    if (ns) {
      const r = this.namespaceProp(node, ns, name);
      if (r !== undefined) return r;
    }
    if (node.questionDotToken || this.hasOptionalChain(node.expression)) return this.optionalChain(node);
    const objNode = node.expression;
    const ti = this.typeOf(objNode);
    const obj = this.expr(objNode);
    if (name === "length") {
      if (only(ti, "arr")) return `Js.alen(${obj})`;
      if (only(ti, "str")) return `S.len(${obj})`;
      if (ti.any || ti.arr || ti.str) return `Js.len(${obj})`;
    }
    if (ti.any && !forCall) return `Js.idx(${obj}, ${luaString(name)})`;
    return this.dot(obj, name);
  }

  dot(obj, name) {
    if (/^[A-Za-z_]/.test(obj) || obj.startsWith("(") || obj.endsWith(")") || obj.endsWith("]")) {
      return isLuaIdent(name) ? `${obj}.${name}` : `${obj}[${luaString(name)}]`;
    }
    return isLuaIdent(name) ? `(${obj}).${name}` : `(${obj})[${luaString(name)}]`;
  }

  namespaceProp(node, ns, name) {
    switch (ns) {
      case "Math": return `Math.${name}`;
      case "Number": return `Js.NumberNS.${name}`;
      case "Object": return `Js.Object.${name}`;
      case "JSON": return `Js.JSON.${name}`;
      case "Array": return `Js.Array.${name}`;
      case "console": return `Js.console.${name}`;
      case "Date": return `Js.Date.${name}`;
      case "String":
        if (name === "fromCharCode") return "Js.fromCharCode";
        if (name === "fromCodePoint") return "Js.fromCodePoint";
        break;
      case "Promise": return `Js.Promise.${name}`;
      case "process": return `Js.process.${name}`;
    }
    return undefined;
  }

  hasOptionalChain(node) {
    node = this.skipParens(node);
    while (true) {
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node))) {
        if (node.questionDotToken) return true;
        if (ts.isParenthesizedExpression(node.expression)) return false;
        node = node.expression;
        while (ts.isNonNullExpression(node)) node = node.expression;
      } else return false;
    }
  }

  // a?.b.c(), a.b?.[c] ... the whole chain stops at the first nil
  optionalChain(node) {
    // Build: (function() local v = <base>; if v == nil then return nil end; v = v.b; ... return v end)()
    // Walk down to collect links.
    const links = [];
    let cur = node;
    while (true) {
      while (ts.isNonNullExpression(cur)) cur = cur.expression;
      if (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur) || ts.isCallExpression(cur)) {
        links.unshift(cur);
        if (ts.isParenthesizedExpression(cur.expression)) { cur = cur.expression; break; }
        cur = cur.expression;
      } else break;
    }
    const base = cur;
    // Split: everything before the first `?.` is evaluated normally.
    const firstOpt = links.findIndex((l) => l.questionDotToken);
    const v = "_v";
    const stmts = [];
    let start;
    if (firstOpt <= 0) {
      stmts.push(`local ${v} = ${this.expr(base)}`);
      start = 0;
    } else {
      stmts.push(`local ${v} = ${this.linkValue(links[firstOpt - 1])}`);
      start = firstOpt;
    }
    for (let i = start; i < links.length; i++) {
      const l = links[i];
      const next = links[i + 1];
      if (l.questionDotToken) stmts.push(`if ${v} == nil then return nil end`);
      // a method call: o.m(...) as one step, with o as the receiver
      if (ts.isPropertyAccessExpression(l) && next && ts.isCallExpression(next) && this.skipParens(next.expression) === l) {
        if (next.questionDotToken) {
          stmts.push(`if ${this.dot(v, l.name.text)} == nil then return nil end`);
        }
        stmts.push(`${v} = ${this.methodCall(next, l, v)}`);
        i++;
        continue;
      }
      if (ts.isCallExpression(l)) {
        stmts.push(`${v} = ${v}(${this.args(l.arguments)})`);
      } else if (ts.isPropertyAccessExpression(l)) {
        const name = l.name.text;
        const ti = this.typeOf(l.expression);
        if (name === "length" && (ti.arr || ti.str || ti.any)) stmts.push(`${v} = Js.len(${v})`);
        else stmts.push(`${v} = ${this.dot(v, name)}`);
      } else {
        stmts.push(`${v} = ${this.indexWith(l.expression, v, l.argumentExpression)}`);
      }
    }
    return `(function() ${stmts.join("; ")}; return ${v} end)()`;
  }

  linkValue(l) {
    // the plain (non-optional) value of a chain link
    if (ts.isPropertyAccessExpression(l)) return this.propAccess(l);
    if (ts.isElementAccessExpression(l)) return this.elemAccess(l);
    return this.call(l);
  }

  keyExpr(objNode, keyNode) {
    // a key for object indexing: numbers become their JavaScript text
    const kti = this.typeOf(keyNode);
    const k = this.expr(keyNode);
    if (only(kti, "num") || (kti.num && !kti.str)) {
      if (ts.isNumericLiteral(keyNode)) return luaString(String(Number(keyNode.text)));
      return `Js.key(${k})`;
    }
    if (kti.any || kti.num) return `Js.key(${k})`;
    return k;
  }

  indexWith(objNode, objExpr, keyNode) {
    const ti = this.typeOf(objNode);
    const kti = this.typeOf(keyNode);
    if (only(ti, "arr") && only(kti, "num")) return `${objExpr}[${this.plusOne(keyNode)}]`;
    if (only(ti, "str") && only(kti, "num")) return `S.idx(${objExpr}, ${this.expr(keyNode)})`;
    if (only(ti, "obj") || (ti.obj && !ti.arr && !ti.str && !ti.any)) {
      return `${objExpr}[${this.keyExpr(objNode, keyNode)}]`;
    }
    return `Js.idx(${objExpr}, ${this.expr(keyNode)})`;
  }

  plusOne(keyNode) {
    const k = this.skipParens(keyNode);
    if (ts.isNumericLiteral(k)) return luaNumber(Number(k.text) + 1);
    if (ts.isBinaryExpression(k) && k.operatorToken.kind === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(k.right) && Number(k.right.text) === 1) {
      return this.expr(k.left);
    }
    return `${this.expr(keyNode)} + 1`;
  }

  elemAccess(node) {
    if (node.questionDotToken || this.hasOptionalChain(node.expression)) return this.optionalChain(node);
    const obj = this.expr(node.expression);
    return this.indexWith(node.expression, this.wrapPrefix(obj), node.argumentExpression);
  }

  wrapPrefix(e) {
    // make e usable before [..] or .x
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(e) || e.endsWith(")") || e.endsWith("]")) {
      if (e.startsWith("(") && !e.endsWith(")")) return `(${e})`;
      return e;
    }
    return `(${e})`;
  }

  // ─────────────────────────────────────────────────────────────── calls ──

  args(list) {
    if (!list.some(ts.isSpreadElement)) return list.map((a) => this.expr(a)).join(", ");
    if (list.length === 1) return `Js.unpack(${this.expr(list[0].expression)})`;
    const chunks = [];
    let cur = [];
    for (const a of list) {
      if (ts.isSpreadElement(a)) {
        if (cur.length) { chunks.push(`Js.alit(${cur.join(", ")})`); cur = []; }
        chunks.push(this.expr(a.expression));
      } else cur.push(this.expr(a));
    }
    if (cur.length) chunks.push(`Js.alit(${cur.join(", ")})`);
    return `Js.unpack(Js.aspread(${chunks.join(", ")}))`;
  }

  isClassMethod(propNode) {
    const sym = this.checker.getSymbolAtLocation(propNode.name);
    if (!sym || !sym.declarations) return false;
    return sym.declarations.some((d) => (ts.isMethodDeclaration(d) || ts.isGetAccessor(d)) && ts.isClassLike(d.parent));
  }

  call(node) {
    // import("./x"): Roblox has the whole game at once, so the module is simply
    // loaded with this file and handed back as a finished promise
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = node.arguments[0];
      if (!a || !ts.isStringLiteral(a)) this.err(node, "import() of a computed path");
      const target = resolveImport(this.program, this.file, a.text);
      if (!target) this.err(node, `cannot resolve import(${a.text})`);
      return `Js.Promise.resolve(${this.importLocal(target)})`;
    }
    if (node.questionDotToken || this.hasOptionalChain(node.expression)) {
      const callee = this.skipParens(node.expression);
      // f?.(x) and o.m?.(x)
      if (node.questionDotToken && !this.hasOptionalChain(callee)) {
        if (ts.isPropertyAccessExpression(callee)) {
          const ti = this.typeOf(callee.expression);
          if (ti.obj && !ti.arr && !ti.str && !ti.any && !this.isClassMethod(callee)) {
            const f = this.propAccess(callee, true);
            return `(function() local _f = ${f}; if _f == nil then return nil end; return _f(${this.args(node.arguments)}) end)()`;
          }
        } else {
          const f = this.expr(callee);
          return `(function() local _f = ${f}; if _f == nil then return nil end; return _f(${this.args(node.arguments)}) end)()`;
        }
      }
      // o?.m(x), and o?.m?.(x) (the method may be missing too): evaluate receiver, stop if nil
      const noMethod = node.questionDotToken && ts.isPropertyAccessExpression(callee) ? ` if ${this.dot("_r", callee.name.text)} == nil then return nil end;` : "";
      if (ts.isPropertyAccessExpression(callee) && callee.questionDotToken) {
        const recv = this.expr(callee.expression);
        const fakeCall = this.methodCall(node, callee, "_r");
        return `(function() local _r = ${recv}; if _r == nil then return nil end;${noMethod} return ${fakeCall} end)()`;
      }
      if (ts.isPropertyAccessExpression(callee) && this.hasOptionalChain(callee.expression)) {
        const recv = this.optionalChain(callee.expression);
        const fakeCall = this.methodCall(node, callee, "_r");
        return `(function() local _r = ${recv}; if _r == nil then return nil end;${noMethod} return ${fakeCall} end)()`;
      }
      this.err(node, "optional call of this shape");
    }
    const callee = this.skipParens(node.expression);
    if (ts.isPropertyAccessExpression(callee)) {
      const ns = this.isNamespaceObj(callee.expression);
      if (ns) {
        const special = this.namespaceCall(node, ns, callee.name.text);
        if (special !== undefined) return special;
        const fn = this.namespaceProp(callee, ns, callee.name.text);
        if (fn !== undefined) return `${fn}(${this.args(node.arguments)})`;
      }
      return this.methodCall(node, callee, null);
    }
    if (ts.isIdentifier(callee)) {
      const name = callee.text;
      const sym = this.symbolOf(callee);
      const isGlobal = !sym || !sym.declarations || sym.declarations[0].getSourceFile().fileName !== this.file
        && !(sym.flags & ts.SymbolFlags.Alias);
      if (isGlobal) {
        if (name === "String") return node.arguments.length ? this.toStr(node.arguments[0]) : '""';
        if (name === "Number") return node.arguments.length ? `Js.Number(${this.expr(node.arguments[0])})` : "0";
        if (name === "Boolean") return node.arguments.length ? `Js.T(${this.expr(node.arguments[0])})` : "false";
        if (name === "Array") return `Js.Array.new(${this.args(node.arguments)})`;
        if (name === "Error") return `Js.Error(${this.args(node.arguments)})`;
        if (name === "Symbol") this.err(node, "Symbol");
      }
    }
    if (ts.isElementAccessExpression(callee)) {
      // obj[k](...) — a function stored in a table
      return `${this.wrapPrefix(this.expr(callee))}(${this.args(node.arguments)})`;
    }
    return `${this.wrapPrefix(this.expr(callee))}(${this.args(node.arguments)})`;
  }

  namespaceCall(node, ns, name) {
    const a = node.arguments;
    if (ns === "Math") {
      if (["floor", "ceil", "abs"].includes(name) && a.length === 1) return `math.${name}(${this.expr(a[0])})`;
      if (name === "max" || name === "min") {
        if (a.length === 2 && !a.some(ts.isSpreadElement)) return `Math.${name}(${this.args(a)})`;
      }
      return undefined;
    }
    if (ns === "Object" && name === "keys") return `Js.Object.keys(${this.args(a)})`;
    if (ns === "Object" && name === "prototype") return undefined;
    return undefined;
  }

  // o.m(args) by what o is
  methodCall(node, callee, recvOverride) {
    const name = callee.name.text;
    const objNode = callee.expression;
    const ti = this.typeOf(objNode);
    const recv = recvOverride ?? this.expr(objNode);
    const args = this.args(node.arguments);
    const withRecv = args ? `${recv}, ${args}` : recv;
    if (name === "hasOwnProperty") return `Js.has(${withRecv})`;
    if (name === "toString" && !(only(ti, "num") && node.arguments.length)) {
      if (only(ti, "obj") && this.isClassMethod(callee)) return `${this.wrapPrefix(recv)}:toString()`;
      return `Js.str(${recv})`;
    }
    if (only(ti, "arr")) {
      if (name === "push" && node.arguments.length === 1 && !node.arguments.some(ts.isSpreadElement)) return `A.push(${withRecv})`;
      return `A[${luaString(name)}](${withRecv})`.replace(/^A\["([a-zA-Z_]+)"\]/, "A.$1");
    }
    if (only(ti, "str")) return isLuaIdent(name) ? `S.${name}(${withRecv})` : `S[${luaString(name)}](${withRecv})`;
    if (only(ti, "num")) return `N.${name}(${withRecv})`;
    if (only(ti, "promise")) {
      const m = { then: "andThen", catch: "catch_", finally: "finally_" }[name] || name;
      return `${this.wrapPrefix(recv)}:${m}(${args})`;
    }
    if (only(ti, "map") || only(ti, "set") || only(ti, "date") || only(ti, "regex")) {
      return `${this.wrapPrefix(recv)}:${name}(${args})`;
    }
    if ((ti.obj || ti.fn) && !ti.arr && !ti.str && !ti.num && !ti.any && !ti.map && !ti.set && !ti.date && !ti.regex) {
      if (this.isClassMethod(callee)) return `${this.wrapPrefix(recv)}:${name}(${args})`;
      return `${this.dot(this.wrapPrefix(recv), name)}(${args})`;
    }
    // unknown receiver: decide at run time
    return `Js.call(${recv}, ${luaString(name)}${args ? ", " + args : ""})`;
  }

  newExpr(node) {
    const callee = this.skipParens(node.expression);
    const args = node.arguments ? this.args(node.arguments) : "";
    if (ts.isIdentifier(callee)) {
      const sym = this.symbolOf(callee);
      const local = sym && sym.declarations && sym.declarations[0].getSourceFile().fileName === this.file;
      const imported = sym && (sym.flags & ts.SymbolFlags.Alias);
      if (!local && !imported) {
        switch (callee.text) {
          case "Map": return `Js.Map.new(${args})`;
          case "Set": return `Js.Set.new(${args})`;
          case "Date": return `Js.Date.new(${args})`;
          case "RegExp": return `Js.RegExp.new(${args})`;
          case "Array": return `Js.Array.new(${args})`;
          case "Error": return `Js.Error(${args})`;
          case "TypeError": return `Js.TypeError(${args})`;
          case "RangeError": return `Js.RangeError(${args})`;
          case "Promise": return `Js.Promise.new(${args})`;
          case "WeakMap": return `Js.Map.new(${args})`;
          case "WeakSet": return `Js.Set.new(${args})`;
          case "Event": case "CustomEvent": return `Js.Event.new(${args})`;
          case "URLSearchParams": return `Js.URLSearchParams.new(${args})`;
          case "URL": return `Js.URL.new(${args})`;
          case "Image": return `Js.O({}, {})`; // a picture never loads in Roblox
          case "Uint8Array": case "Uint8ClampedArray": case "Uint16Array": case "Uint32Array":
          case "Int8Array": case "Int16Array": case "Int32Array": case "Float32Array": case "Float64Array":
            return `Js.typedArray(${args})`;
        }
        this.err(node, `new ${callee.text}`);
      }
      return `${this.identRef(callee)}.new(${args})`;
    }
    return `${this.wrapPrefix(this.expr(callee))}.new(${args})`;
  }

  // ─────────────────────────────────────────────────────────── operators ──

  prefixUnary(node) {
    const K = ts.SyntaxKind;
    switch (node.operator) {
      case K.ExclamationToken: return `(not ${this.cond(node.operand)})`;
      case K.MinusToken: {
        const o = this.skipParens(node.operand);
        if (ts.isNumericLiteral(o)) return luaNumber(-Number(o.text.replace(/_/g, "")));
        return `(-${this.numeric(node.operand)})`;
      }
      case K.PlusToken: return `Js.Number(${this.expr(node.operand)})`;
      case K.TildeToken: return `Js.bnot(${this.expr(node.operand)})`;
      case K.PlusPlusToken:
      case K.MinusMinusToken: return this.incDecExpr(node, true);
    }
    this.err(node, "prefix operator");
  }

  numeric(node) {
    const e = this.expr(node);
    return /^[A-Za-z_0-9.]+$/.test(e) || e.startsWith("(") && e.endsWith(")") && balanced(e) ? e : `(${e})`;
  }

  // x++ / ++x used as a value
  incDecExpr(node, prefix) {
    const op = node.operator === ts.SyntaxKind.PlusPlusToken ? "+" : "-";
    const target = node.operand;
    const { read, write } = this.lvalue(target);
    if (prefix) return `(function() local _n = ${read} ${op} 1; ${write("_n")}; return _n end)()`;
    return `(function() local _o = ${read}; ${write(`_o ${op} 1`)}; return _o end)()`;
  }

  // read/write forms for an assignment target
  lvalue(target) {
    target = this.skipParens(target);
    if (ts.isIdentifier(target)) {
      const r = this.identRef(target);
      return { read: r, write: (v) => `${r} = ${v}`, simple: true };
    }
    if (ts.isPropertyAccessExpression(target)) {
      const ti = this.typeOf(target.expression);
      const obj = this.wrapPrefix(this.expr(target.expression));
      const name = target.name.text;
      if (name === "length" && only(ti, "arr")) {
        return { read: `Js.alen(${obj})`, write: (v) => `A.setlen(${obj}, ${v})` };
      }
      const r = this.dot(obj, name);
      return { read: r, write: (v) => `${r} = ${v}`, simple: this.isSimple(target.expression) };
    }
    if (ts.isElementAccessExpression(target)) {
      const ti = this.typeOf(target.expression);
      const kti = this.typeOf(target.argumentExpression);
      const obj = this.wrapPrefix(this.expr(target.expression));
      if (only(ti, "arr") && only(kti, "num")) {
        const k = this.expr(target.argumentExpression);
        return { read: `${obj}[${this.plusOne(target.argumentExpression)}]`, write: (v) => `A.set(${obj}, ${k}, ${v})`, arr: true };
      }
      if (only(ti, "obj") || (ti.obj && !ti.arr && !ti.str && !ti.any)) {
        const k = this.keyExpr(target.expression, target.argumentExpression);
        const r = `${obj}[${k}]`;
        return { read: r, write: (v) => `${r} = ${v}` };
      }
      const k = this.expr(target.argumentExpression);
      return { read: `Js.idx(${obj}, ${k})`, write: (v) => `Js.setidx(${obj}, ${k}, ${v})` };
    }
    this.err(target, "assignment target");
  }

  binary(node) {
    const K = ts.SyntaxKind;
    const op = node.operatorToken.kind;
    const L = node.left, R = node.right;
    switch (op) {
      case K.EqualsToken:
        if (ts.isArrayLiteralExpression(L) || ts.isObjectLiteralExpression(L)) this.err(node, "destructuring assignment as a value");
        {
          const lv = this.lvalue(L);
          return `(function() local _a = ${this.expr(R)}; ${lv.write("_a")}; return _a end)()`;
        }
      case K.PlusEqualsToken: case K.MinusEqualsToken: case K.AsteriskEqualsToken: case K.SlashEqualsToken:
      case K.QuestionQuestionEqualsToken: case K.BarBarEqualsToken: case K.AmpersandAmpersandEqualsToken:
      case K.PercentEqualsToken:
        return `(function() ${this.assignStmt(node)}; return ${this.lvalue(L).read} end)()`;
      case K.AmpersandAmpersandToken: {
        if (!this.needsT(L)) return `(${this.expr(L)} and ${this.expr(R)})`;
        if (this.isSimple(L)) { const l = this.expr(L); return `(if Js.T(${l}) then ${this.expr(R)} else ${l})`; }
        return `(function() local _l = ${this.expr(L)}; if Js.T(_l) then return ${this.expr(R)} end; return _l end)()`;
      }
      case K.BarBarToken: {
        if (!this.needsT(L)) {
          // `a or b` is wrong only when b can be false/nil and a is false — same as JS
          return `(${this.expr(L)} or ${this.expr(R)})`;
        }
        if (this.isSimple(L)) { const l = this.expr(L); return `(if Js.T(${l}) then ${l} else ${this.expr(R)})`; }
        return `(function() local _l = ${this.expr(L)}; if Js.T(_l) then return _l end; return ${this.expr(R)} end)()`;
      }
      case K.QuestionQuestionToken: {
        const l = this.expr(L);
        if (this.isSimple(L)) return `(if ${l} ~= nil then ${l} else ${this.expr(R)})`;
        const ti = this.typeOf(L);
        if (!ti.bool && !ti.any) return `(${l} or ${this.expr(R)})`; // non-boolean: nil is the only falsy Luau value it can be
        return `(function() local _l = ${l}; if _l ~= nil then return _l end; return ${this.expr(R)} end)()`;
      }
      case K.EqualsEqualsEqualsToken: case K.EqualsEqualsToken:
        return this.equality(L, R, false);
      case K.ExclamationEqualsEqualsToken: case K.ExclamationEqualsToken:
        return this.equality(L, R, true);
      case K.LessThanToken: case K.GreaterThanToken: case K.LessThanEqualsToken: case K.GreaterThanEqualsToken: {
        const opText = { [K.LessThanToken]: "<", [K.GreaterThanToken]: ">", [K.LessThanEqualsToken]: "<=", [K.GreaterThanEqualsToken]: ">=" }[op];
        const lt = this.typeOf(L), rt = this.typeOf(R);
        const plain = (x) => (only(x, "num") || only(x, "str")) && !x.nullish;
        if (plain(lt) && plain(rt) && (lt.num === rt.num)) return `(${this.expr(L)} ${opText} ${this.expr(R)})`;
        const name = { "<": "lt", ">": "gt", "<=": "le", ">=": "ge" }[opText];
        return `Js.${name}(${this.expr(L)}, ${this.expr(R)})`;
      }
      case K.PlusToken: {
        const lt = this.typeOf(L), rt = this.typeOf(R);
        if (only(lt, "str") || only(rt, "str")) {
          return `(${this.toStr(L)} .. ${this.toStr(R)})`;
        }
        if (only(lt, "num") && only(rt, "num")) return `(${this.expr(L)} + ${this.expr(R)})`;
        if ((lt.num || lt.bool) && (rt.num || rt.bool) && !lt.str && !rt.str && !lt.any && !rt.any && !lt.obj && !rt.obj && !lt.arr && !rt.arr) {
          return `(${this.expr(L)} + ${this.expr(R)})`;
        }
        return `Js.add(${this.expr(L)}, ${this.expr(R)})`;
      }
      case K.MinusToken: return `(${this.expr(L)} - ${this.expr(R)})`;
      case K.AsteriskToken: return `(${this.expr(L)} * ${this.expr(R)})`;
      case K.SlashToken: return `(${this.expr(L)} / ${this.expr(R)})`;
      case K.PercentToken: return `math.fmod(${this.expr(L)}, ${this.expr(R)})`;
      case K.AsteriskAsteriskToken: return `(${this.expr(L)} ^ ${this.expr(R)})`;
      case K.BarToken: return `Js.bor(${this.expr(L)}, ${this.expr(R)})`;
      case K.AmpersandToken: return `Js.band(${this.expr(L)}, ${this.expr(R)})`;
      case K.CaretToken: return `Js.bxor(${this.expr(L)}, ${this.expr(R)})`;
      case K.LessThanLessThanToken: return `Js.shl(${this.expr(L)}, ${this.expr(R)})`;
      case K.GreaterThanGreaterThanToken: return `Js.shr(${this.expr(L)}, ${this.expr(R)})`;
      case K.GreaterThanGreaterThanGreaterThanToken: return `Js.ushr(${this.expr(L)}, ${this.expr(R)})`;
      case K.InKeyword: return `Js.has(${this.expr(R)}, ${this.expr(L)})`;
      case K.InstanceOfKeyword: return `Js.instanceof(${this.expr(L)}, ${this.expr(R)})`;
      case K.CommaToken: return `(function() local _ = ${this.expr(L)}; return ${this.expr(R)} end)()`;
    }
    this.err(node, `binary operator ${ts.SyntaxKind[op]}`);
  }

  equality(L, R, negate) {
    const eq = negate ? "~=" : "==";
    // typeof x === "..."
    const l = this.skipParens(L), r = this.skipParens(R);
    const tyof = (a, b) => ts.isTypeOfExpression(a) && ts.isStringLiteral(b) ? [a, b] : null;
    const pair = tyof(l, r) || tyof(r, l);
    if (pair) {
      const [t, s] = pair;
      const v = this.expr(t.expression);
      const map = { number: "number", string: "string", boolean: "boolean", function: "function", object: "table" };
      if (s.text === "undefined") return `(${v} ${eq} nil)`;
      if (map[s.text]) return `(type(${v}) ${eq} ${luaString(map[s.text])})`;
      return negate ? "true" : "false";
    }
    return `(${this.expr(L)} ${eq} ${this.expr(R)})`;
  }

  // ───────────────────────────────────────────────────────────── functions ──

  params(fn) {
    // returns { list: "a, b", prologue: [lines] }
    const names = [];
    const pro = [];
    for (const p of fn.parameters) {
      if (p.name.kind === ts.SyntaxKind.Identifier && p.name.text === "this") continue;
      if (p.dotDotDotToken) {
        const n = ts.isIdentifier(p.name) ? this.declName(p.name) : this.t("_rest");
        names.push("...");
        pro.push(`local ${n} = Js.alit(...)`);
        if (!ts.isIdentifier(p.name)) pro.push(...this.destructure(p.name, n, true));
        continue;
      }
      if (ts.isIdentifier(p.name)) {
        const n = this.declName(p.name);
        names.push(n);
        if (p.initializer) pro.push(`if ${n} == nil then ${n} = ${this.expr(p.initializer)} end`);
      } else {
        const n = this.t("_p");
        names.push(n);
        if (p.initializer) pro.push(`if ${n} == nil then ${n} = ${this.expr(p.initializer)} end`);
        pro.push(...this.destructure(p.name, n, true));
      }
    }
    return { list: names.join(", "), prologue: pro };
  }

  // a local name for a declaration (renamed if it clashes)
  declName(id) {
    const sym = this.checker.getSymbolAtLocation(id);
    const n = luaName(id.text);
    if (sym && this.topNames.has(sym)) return this.topNames.get(sym);
    return n;
  }

  funcExpr(fn, selfParam = false) {
    const { list, prologue } = this.params(fn);
    const saved = { lines: this.lines, ind: this.ind, loopStack: this.loopStack };
    this.lines = [];
    this.loopStack = [];
    this.ind = saved.ind + 1;
    this.fnStack.push({ async: !!(fn.modifiers || []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword), inTry: 0 });
    for (const l of prologue) this.emit(l);
    if (fn.body && ts.isBlock(fn.body)) this.block(fn.body.statements);
    else if (fn.body) this.emit(`return ${this.expr(fn.body)}`);
    this.fnStack.pop();
    const body = this.lines;
    this.lines = saved.lines;
    this.ind = saved.ind;
    this.loopStack = saved.loopStack;
    const plist = selfParam ? (list ? `self, ${list}` : "self") : list;
    if (fn.asteriskToken) {
      // a generator: calling it makes an iterator that runs the body as a coroutine
      const pad = "\t".repeat(this.ind);
      return `function(${plist})\n${pad}\treturn Js.gen(function()\n${body.map((l) => "\t" + l).join("\n")}\n${pad}\tend)\n${pad}end`;
    }
    if (body.length === 0) return `function(${plist}) end`;
    return `function(${plist})\n${body.join("\n")}\n${"\t".repeat(this.ind)}end`;
  }

  // ──────────────────────────────────────────────────────────── destructuring ──

  destructure(pattern, src, declare) {
    // returns lines; src is a simple Luau expression
    const out = [];
    const kw = declare ? "local " : "";
    if (ts.isObjectBindingPattern(pattern)) {
      const used = [];
      for (const el of pattern.elements) {
        if (el.dotDotDotToken) {
          const n = this.declName(el.name);
          out.push(`${kw}${n} = Js.ospread(${src})`);
          for (const u of used) out.push(`Js.del(${n}, ${luaString(u)})`);
          continue;
        }
        const keyNode = el.propertyName || el.name;
        let key;
        if (ts.isIdentifier(keyNode) || ts.isStringLiteral(keyNode)) key = keyNode.text;
        else if (ts.isNumericLiteral(keyNode)) key = String(Number(keyNode.text));
        else this.err(el, "computed key in destructuring");
        used.push(key);
        const access = isLuaIdent(key) ? `${src}.${key}` : `${src}[${luaString(key)}]`;
        if (ts.isIdentifier(el.name)) {
          const n = this.declName(el.name);
          out.push(`${kw}${n} = ${access}`);
          if (el.initializer) out.push(`if ${n} == nil then ${n} = ${this.expr(el.initializer)} end`);
        } else {
          const t = this.t("_d");
          out.push(`local ${t} = ${access}`);
          if (el.initializer) out.push(`if ${t} == nil then ${t} = ${this.expr(el.initializer)} end`);
          out.push(...this.destructure(el.name, t, declare));
        }
      }
    } else if (ts.isArrayBindingPattern(pattern)) {
      pattern.elements.forEach((el, i) => {
        if (ts.isOmittedExpression(el)) return;
        if (el.dotDotDotToken) {
          const n = this.declName(el.name);
          out.push(`${kw}${n} = A.slice(${src}, ${i})`);
          return;
        }
        const access = `Js.idx(${src}, ${i})`;
        const fast = `${src}[${i + 1}]`;
        if (ts.isIdentifier(el.name)) {
          const n = this.declName(el.name);
          out.push(`${kw}${n} = ${fast}`);
          if (el.initializer) out.push(`if ${n} == nil then ${n} = ${this.expr(el.initializer)} end`);
        } else {
          const t = this.t("_d");
          out.push(`local ${t} = ${fast}`);
          if (el.initializer) out.push(`if ${t} == nil then ${t} = ${this.expr(el.initializer)} end`);
          out.push(...this.destructure(el.name, t, declare));
        }
        void access;
      });
    } else this.err(pattern, "binding pattern");
    return out;
  }

  // assignment-pattern destructuring: [a, b] = [b, a]; ({x} = obj)
  destructureAssign(pattern, src) {
    const out = [];
    if (ts.isArrayLiteralExpression(pattern)) {
      pattern.elements.forEach((el, i) => {
        if (ts.isOmittedExpression(el)) return;
        if (ts.isSpreadElement(el)) { out.push(this.lvalue(el.expression).write(`A.slice(${src}, ${i})`)); return; }
        let target = el, init = null;
        if (ts.isBinaryExpression(el) && el.operatorToken.kind === ts.SyntaxKind.EqualsToken) { target = el.left; init = el.right; }
        const v = `${src}[${i + 1}]`;
        if (ts.isArrayLiteralExpression(target) || ts.isObjectLiteralExpression(target)) {
          const t = this.t("_d");
          out.push(`local ${t} = ${v}`);
          out.push(...this.destructureAssign(target, t));
        } else if (init) {
          const t = this.t("_d");
          out.push(`local ${t} = ${v}`);
          out.push(`if ${t} == nil then ${t} = ${this.expr(init)} end`);
          out.push(this.lvalue(target).write(t));
        } else out.push(this.lvalue(target).write(v));
      });
    } else if (ts.isObjectLiteralExpression(pattern)) {
      for (const p of pattern.properties) {
        if (ts.isShorthandPropertyAssignment(p)) {
          const key = p.name.text;
          out.push(this.lvalue(p.name).write(isLuaIdent(key) ? `${src}.${key}` : `${src}[${luaString(key)}]`));
        } else if (ts.isPropertyAssignment(p)) {
          const key = this.propKey(p.name);
          const v = isLuaIdent(key) ? `${src}.${key}` : `${src}[${luaString(key)}]`;
          out.push(this.lvalue(p.initializer).write(v));
        } else this.err(p, "destructuring assignment member");
      }
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────── statements ──

  // Emit a block's statements. Function declarations are hoisted.
  block(stmts) {
    this.fwdStack = this.fwdStack || [];
    this.fwdStack.push(new Set());
    try { this.blockInner(stmts); } finally { this.fwdStack.pop(); }
  }

  // mark these declaration-name nodes as forward-declared in this block
  markForward(nameNodes) {
    const set = this.fwdStack[this.fwdStack.length - 1];
    const names = [];
    for (const id of nameNodes) {
      const sym = this.checker.getSymbolAtLocation(id);
      const n = this.declName(id);
      if (n.includes(".")) continue;
      if (sym) set.add(sym);
      if (!names.includes(n)) names.push(n);
    }
    for (let i = 0; i < names.length; i += 60) this.emit(`local ${names.slice(i, i + 60).join(", ")}`);
  }

  isForwardId(id) {
    const sym = this.checker.getSymbolAtLocation(id);
    const set = this.fwdStack && this.fwdStack[this.fwdStack.length - 1];
    return !!(sym && set && set.has(sym));
  }

  blockInner(stmts) {
    const fnDecls = stmts.filter((s) => ts.isFunctionDeclaration(s) && s.body);
    const classDecls = stmts.filter(ts.isClassDeclaration);
    // names used (inside a function) before the line that declares them
    const early = this.usedBeforeDeclared(stmts);
    if (early.length && !(fnDecls.length || classDecls.length)) this.markForward(early);
    if (fnDecls.length || classDecls.length) {
      // forward-declare every name in this block so hoisted functions see them
      const ids = [];
      for (const s of stmts) {
        if (ts.isFunctionDeclaration(s) && s.name && s.body) ids.push(s.name);
        if ((ts.isClassDeclaration(s) || ts.isEnumDeclaration(s)) && s.name) ids.push(s.name);
        if (ts.isVariableStatement(s) && !(ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Ambient)) {
          for (const d of s.declarationList.declarations) ids.push(...this.bindingIds(d.name));
        }
      }
      this.markForward(ids);
      for (const f of fnDecls) this.stmt(f, true);
    }
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (ts.isFunctionDeclaration(s) && s.body && (fnDecls.length || classDecls.length)) continue;
      this.stmt(s, false);
      if (isTerminator(s)) break;
    }
  }

  usedBeforeDeclared(stmts) {
    const declAt = new Map(); // symbol -> [stmt index, lua name]
    stmts.forEach((st, i) => {
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          const walk = (nm) => {
            if (ts.isIdentifier(nm)) {
              const sym = this.checker.getSymbolAtLocation(nm);
              if (sym) declAt.set(sym, [i, nm, d]);
            } else nm.elements.forEach((e) => { if (!ts.isOmittedExpression(e)) walk(e.name); });
          };
          walk(d.name);
        }
      }
    });
    if (!declAt.size) return [];
    const out = new Set();
    stmts.forEach((st, i) => {
      const visit = (n, inFn) => {
        if (ts.isIdentifier(n)) {
          const sym = this.checker.getSymbolAtLocation(n);
          const hit = sym && declAt.get(sym);
          if (hit) {
            // used by a function written at or before the declaration
            if (inFn && hit[0] >= i) out.add(hit[1]);
          }
        }
        ts.forEachChild(n, (c) => visit(c, inFn || ts.isFunctionLike(c)));
      };
      visit(st, false);
    });
    return [...out];
  }

  bindingIds(name) {
    if (ts.isIdentifier(name)) return [name];
    const out = [];
    for (const el of name.elements) {
      if (ts.isOmittedExpression(el)) continue;
      out.push(...this.bindingIds(el.name));
    }
    return out;
  }

  bindingNames(name) {
    if (ts.isIdentifier(name)) return [this.declName(name)];
    const out = [];
    for (const el of name.elements) {
      if (ts.isOmittedExpression(el)) continue;
      out.push(...this.bindingNames(el.name));
    }
    return out;
  }


  stmt(s, hoisted) {
    const K = ts.SyntaxKind;
    switch (s.kind) {
      case K.InterfaceDeclaration:
      case K.TypeAliasDeclaration:
      case K.ImportDeclaration:
      case K.EmptyStatement:
      case K.ModuleDeclaration:
        return;
      case K.ExportDeclaration: return this.exportDecl(s);
      case K.ExportAssignment: {
        this.emit(`exports.default = ${this.expr(s.expression)}`);
        return;
      }
      case K.EnumDeclaration: return this.enumDecl(s);
      case K.FunctionDeclaration: {
        if (!s.body) return; // overload signature
        const n = this.declName(s.name);
        const f = this.funcExpr(s);
        if (this.isForwardId(s.name) || n.includes(".")) this.emit(`${n} = ${f}`);
        else this.emit(`local function ${n}${f.slice("function".length)}`);
        this.afterDecl(s.name, n);
        return;
      }
      case K.ClassDeclaration: return this.classDecl(s);
      case K.VariableStatement:
        if (ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Ambient) return;
        return this.varStmt(s);
      case K.ExpressionStatement: return this.exprStmt(s.expression);
      case K.ReturnStatement: {
        const fn = this.fnStack[this.fnStack.length - 1];
        const v = s.expression ? this.expr(s.expression) : "";
        if (fn && fn.inTry) this.emit(`do return Js.RET, ${v || "nil"} end`);
        else this.emit(v ? `do return ${v} end` : "do return end");
        return;
      }
      case K.IfStatement: return this.ifStmt(s);
      case K.Block: {
        this.emit("do");
        this.ind++;
        this.block(s.statements);
        this.ind--;
        this.emit("end");
        return;
      }
      case K.ForStatement: this.forStmt(s); return this.labelChecks();
      case K.ForOfStatement: this.forOfStmt(s); return this.labelChecks();
      case K.ForInStatement: this.forInStmt(s); return this.labelChecks();
      case K.WhileStatement: {
        this.emit(`while ${this.cond(s.expression)} do`);
        this.loopBody(s.statement);
        this.emit("end");
        return this.labelChecks();
      }
      case K.DoStatement: {
        this.doStmt(s);
        return this.labelChecks();
      }
      case K.BreakStatement: {
        if (s.label) { this.labelJump(s, "brk"); return; }
        const top = this.loopStack[this.loopStack.length - 1];
        if (this.fnStack.length && this.fnStack[this.fnStack.length - 1].inTry && !top?.insideTry) this.err(s, "break inside try");
        this.emit("do break end");
        return;
      }
      case K.ContinueStatement: {
        if (s.label) { this.labelJump(s, "cont"); return; }
        // a continue inside a switch-as-repeat must leave the repeat first
        const sw = [...this.loopStack].reverse().find((x) => x.kind === "loop" || x.kind === "switch-repeat");
        if (sw && sw.kind === "switch-repeat") {
          this.emit(`${sw.contFlag} = true`);
          this.emit("do break end");
          sw.usedContinue = true;
          return;
        }
        this.emit("do continue end");
        return;
      }
      case K.ThrowStatement: {
        this.emit(`error(${this.expr(s.expression)}, 0)`);
        return;
      }
      case K.TryStatement: return this.tryStmt(s);
      case K.SwitchStatement: return this.switchStmt(s);
      case K.LabeledStatement: return this.labelled(s);
    }
    this.err(s, `statement kind ${ts.SyntaxKind[s.kind]}`);
  }

  // after a top-level declaration: copy to exports
  afterDecl(nameNode, luaN) {
    if (!this.isTopLevel(nameNode)) return;
    const decl = nameNode.parent;
    const stmt = ts.isVariableDeclaration(decl) ? decl.parent.parent : decl;
    const exported = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0;
    if (exported) {
      const def = (ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Default) !== 0;
      this.emit(`exports.${def ? "default" : nameNode.text} = ${luaN}`);
    }
  }

  isTopLevel(nameNode) {
    let d = nameNode.parent;
    while (d && !ts.isSourceFile(d)) {
      if (ts.isFunctionLike(d) || ts.isBlock(d) || ts.isClassLike(d) && d !== nameNode.parent) {
        if (d === nameNode.parent) { d = d.parent; continue; }
        return false;
      }
      d = d.parent;
    }
    return true;
  }

  varStmt(s) {
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) {
        const sym = this.checker.getSymbolAtLocation(d.name);
        const n = this.declName(d.name);
        const init = d.initializer ? this.expr(d.initializer) : "nil";
        if (this.exportedLets.has(sym)) this.emit(`${n} = ${init}`);
        else if (this.isForwardId(d.name) || n.includes(".")) this.emit(`${n} = ${init}`);
        else this.emit(`local ${n} = ${init}`);
        this.afterDecl(d.name, n);
      } else {
        const t = this.t("_d");
        this.emit(`local ${t} = ${this.expr(d.initializer)}`);
        const names = this.bindingNames(d.name);
        const declare = !this.bindingIds(d.name).some((id) => this.isForwardId(id) || this.declName(id).includes("."));
        for (const l of this.destructure(d.name, t, declare)) this.emit(l);
        if (this.isTopLevel(d.name)) {
          const exported = (ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Export) !== 0;
          if (exported) for (const n of names) this.emit(`exports.${n} = ${n}`);
        }
      }
    }
  }

  exprStmt(e) {
    e = this.skipParens(e);
    const K = ts.SyntaxKind;
    if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind;
      if (op === K.EqualsToken) {
        if (ts.isArrayLiteralExpression(e.left) || ts.isObjectLiteralExpression(e.left)) {
          const t = this.t("_d");
          this.emit(`local ${t} = ${this.expr(e.right)}`);
          for (const l of this.destructureAssign(e.left, t)) this.emit(l);
          return;
        }
        // chained a = b = c
        if (ts.isBinaryExpression(this.skipParens(e.right)) && this.skipParens(e.right).operatorToken.kind === K.EqualsToken) {
          const t = this.t("_a");
          const inner = this.skipParens(e.right);
          this.exprStmt(inner);
          this.emit(this.lvalue(e.left).write(this.lvalue(inner.left).read));
          void t;
          return;
        }
        this.emit(this.lvalue(e.left).write(this.expr(e.right)));
        return;
      }
      if (isCompoundAssign(op)) { this.emit(this.assignStmt(e)); return; }
      if (op === K.AmpersandAmpersandToken) {
        this.emit(`if ${this.cond(e.left)} then`);
        this.ind++; this.exprStmt(e.right); this.ind--;
        this.emit("end");
        return;
      }
      if (op === K.BarBarToken) {
        this.emit(`if not ${this.cond(e.left)} then`);
        this.ind++; this.exprStmt(e.right); this.ind--;
        this.emit("end");
        return;
      }
      if (op === K.QuestionQuestionToken) {
        this.emit(`if ${this.expr(e.left)} == nil then`);
        this.ind++; this.exprStmt(e.right); this.ind--;
        this.emit("end");
        return;
      }
      if (op === K.CommaToken) { this.exprStmt(e.left); this.exprStmt(e.right); return; }
    }
    if (ts.isConditionalExpression(e)) {
      this.emit(`if ${this.cond(e.condition)} then`);
      this.ind++; this.exprStmt(e.whenTrue); this.ind--;
      this.emit("else");
      this.ind++; this.exprStmt(e.whenFalse); this.ind--;
      this.emit("end");
      return;
    }
    if ((ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) &&
      (e.operator === K.PlusPlusToken || e.operator === K.MinusMinusToken)) {
      const lv = this.lvalue(e.operand);
      const op = e.operator === K.PlusPlusToken ? "+" : "-";
      if (lv.write && !lv.arr && lv.read.indexOf("Js.idx") < 0) {
        this.emit(`${lv.read} ${op}= 1`);
      } else this.emit(lv.write(`${lv.read} ${op} 1`));
      return;
    }
    if (ts.isCallExpression(e) || ts.isNewExpression(e) || ts.isAwaitExpression(e)) {
      let inner = ts.isAwaitExpression(e) ? this.skipParens(e.expression) : e;
      const code = this.expr(inner);
      if (/\)$/.test(code) && !code.startsWith("(if ")) {
        this.emit(code.startsWith("(") ? ";" + code : code);
      } else this.emit(`local _ = ${code}`);
      return;
    }
    if (ts.isDeleteExpression(e)) { this.emit(this.expr(e)); return; }
    if (ts.isVoidExpression(e)) { this.exprStmt(e.expression); return; }
    // anything else: evaluate for side effects
    this.emit(`local _ = ${this.expr(e)}`);
  }

  assignStmt(e) {
    const K = ts.SyntaxKind;
    const op = e.operatorToken.kind;
    const lv = this.lvalue(e.left);
    const r = e.right;
    switch (op) {
      case K.PlusEqualsToken: {
        const lt = this.typeOf(e.left), rt = this.typeOf(r);
        if (only(lt, "str") || only(rt, "str")) return lv.write(`${lv.read} .. ${this.toStr(r)}`);
        if (only(lt, "num") && (only(rt, "num") || rt.bool)) {
          if (lv.arr || lv.read.startsWith("Js.")) return lv.write(`${lv.read} + ${this.numeric(r)}`);
          return `${lv.read} += ${this.expr(r)}`;
        }
        return lv.write(`Js.add(${lv.read}, ${this.expr(r)})`);
      }
      case K.MinusEqualsToken: return lv.arr || lv.read.startsWith("Js.") ? lv.write(`${lv.read} - ${this.numeric(r)}`) : `${lv.read} -= ${this.expr(r)}`;
      case K.AsteriskEqualsToken: return lv.arr || lv.read.startsWith("Js.") ? lv.write(`${lv.read} * ${this.numeric(r)}`) : `${lv.read} *= ${this.expr(r)}`;
      case K.SlashEqualsToken: return lv.arr || lv.read.startsWith("Js.") ? lv.write(`${lv.read} / ${this.numeric(r)}`) : `${lv.read} /= ${this.expr(r)}`;
      case K.PercentEqualsToken: return lv.write(`math.fmod(${lv.read}, ${this.expr(r)})`);
      case K.QuestionQuestionEqualsToken: return `if ${lv.read} == nil then ${lv.write(this.expr(r))} end`;
      case K.BarBarEqualsToken: return `if not ${this.needsT(e.left) ? `Js.T(${lv.read})` : lv.read} then ${lv.write(this.expr(r))} end`;
      case K.AmpersandAmpersandEqualsToken: return `if ${this.needsT(e.left) ? `Js.T(${lv.read})` : lv.read} then ${lv.write(this.expr(r))} end`;
      case K.BarEqualsToken: return lv.write(`Js.bor(${lv.read}, ${this.expr(r)})`);
      case K.AmpersandEqualsToken: return lv.write(`Js.band(${lv.read}, ${this.expr(r)})`);
      case K.CaretEqualsToken: return lv.write(`Js.bxor(${lv.read}, ${this.expr(r)})`);
      case K.LessThanLessThanEqualsToken: return lv.write(`Js.shl(${lv.read}, ${this.expr(r)})`);
      case K.GreaterThanGreaterThanEqualsToken: return lv.write(`Js.shr(${lv.read}, ${this.expr(r)})`);
      case K.GreaterThanGreaterThanGreaterThanEqualsToken: return lv.write(`Js.ushr(${lv.read}, ${this.expr(r)})`);
      case K.AsteriskAsteriskEqualsToken: return lv.write(`${lv.read} ^ ${this.numeric(r)}`);
    }
    this.err(e, "compound assignment");
  }

  ifStmt(s) {
    this.emit(`if ${this.cond(s.expression)} then`);
    this.subBlock(s.thenStatement);
    let els = s.elseStatement;
    while (els && ts.isIfStatement(els)) {
      this.emit(`elseif ${this.cond(els.expression)} then`);
      this.subBlock(els.thenStatement);
      els = els.elseStatement;
    }
    if (els) {
      this.emit("else");
      this.subBlock(els);
    }
    this.emit("end");
  }

  subBlock(st) {
    this.ind++;
    if (ts.isBlock(st)) this.block(st.statements);
    else this.block([st]);
    this.ind--;
  }

  loopBody(st) {
    const frame = { kind: "loop", label: this.pendingLabel || null };
    this.pendingLabel = null;
    this.loopStack.push(frame);
    this.subBlock(st);
    this.loopStack.pop();
    // after an inner loop ends: pass a labelled break/continue outwards
    this.afterLoop = frame;
  }

  doStmt(s) {
    const f = this.t("_first");
    this.emit(`local ${f} = true`);
    this.emit(`while ${f} or ${this.cond(s.expression)} do`);
    this.ind++;
    this.emit(`${f} = false`);
    this.ind--;
    this.loopBody(s.statement);
    this.emit("end");
  }

  // after a loop that a labelled break/continue passed out of
  labelChecks() {
    const inner = this.afterLoop;
    this.afterLoop = null;
    if (!inner || !inner.passOut) return;
    const top = this.loopStack[this.loopStack.length - 1];
    for (const f of this.labels || []) {
      if (!this.loopStack.some((x) => x.label === f.label)) continue;
      if (top && top.label === f.label) {
        this.emit(`if ${f.brk} then break end`);
        this.emit(`if ${f.cont} then ${f.cont} = false; continue end`);
      } else {
        this.emit(`if ${f.brk} or ${f.cont} then break end`);
      }
    }
  }

  // outer: for (...) { ... break outer / continue outer ... }
  labelled(s) {
    const label = s.label.text;
    const L = this.labels || (this.labels = []);
    const flags = { label, brk: `_brk_${label}`, cont: `_cont_${label}` };
    this.emit(`local ${flags.brk}, ${flags.cont} = false, false`);
    L.push(flags);
    this.pendingLabel = label;
    this.stmt(s.statement, false);
    L.pop();
  }

  labelJump(s, kind) {
    const label = s.label.text;
    const f = (this.labels || []).find((x) => x.label === label);
    if (!f) this.err(s, "unknown label");
    // the loop that carries this label
    const idx = this.loopStack.findIndex((x) => x.label === label);
    const top = this.loopStack.length - 1;
    if (idx === top) {
      this.emit(kind === "brk" ? "do break end" : "do continue end");
      return;
    }
    this.emit(`${kind === "brk" ? f.brk : f.cont} = true`);
    this.emit("do break end");
    // every loop between here and the labelled one checks the flag on exit
    for (let i = idx + 1; i <= top; i++) this.loopStack[i].passOut = true;
  }

  forStmt(s) {
    // for (init; cond; incr) body  ->  do init; local first=true; while true do ... end end
    // fast path: for (let i = a; i < b; i++) where i is not changed in the body
    const fast = this.simpleNumericFor(s);
    if (fast) {
      this.emit(fast.header);
      this.loopBody(s.statement);
      this.emit("end");
      return;
    }
    this.emit("do");
    this.ind++;
    if (s.initializer) {
      if (ts.isVariableDeclarationList(s.initializer)) {
        for (const d of s.initializer.declarations) {
          if (ts.isIdentifier(d.name)) this.emit(`local ${this.declName(d.name)} = ${d.initializer ? this.expr(d.initializer) : "nil"}`);
          else {
            const t = this.t("_d");
            this.emit(`local ${t} = ${this.expr(d.initializer)}`);
            for (const l of this.destructure(d.name, t, true)) this.emit(l);
          }
        }
      } else this.exprStmt(s.initializer);
    }
    {
      const f = this.t("_first");
      this.emit(`local ${f} = true`);
      this.emit("while true do");
      this.ind++;
      if (s.incrementor) {
        this.emit(`if not ${f} then`);
        this.ind++;
        this.exprStmt(s.incrementor);
        this.ind--;
        this.emit("end");
      }
      this.emit(`${f} = false`);
      if (s.condition) this.emit(`if not ${this.cond(s.condition)} then break end`);
      this.ind--;
      this.loopBody(s.statement);
      this.emit("end");
    }
    this.ind--;
    this.emit("end");
  }

  // for (let i = A; i < B; i++) with i untouched in the body and B a
  // constant-ish expression (a literal, or a local never assigned in the loop)
  simpleNumericFor(s) {
    const init = s.initializer;
    if (!init || !ts.isVariableDeclarationList(init) || init.declarations.length !== 1) return null;
    const d = init.declarations[0];
    if (!ts.isIdentifier(d.name) || !d.initializer) return null;
    const iname = d.name.text;
    const c = s.condition && this.skipParens(s.condition);
    if (!c || !ts.isBinaryExpression(c) || !ts.isIdentifier(c.left) || c.left.text !== iname) return null;
    const op = c.operatorToken.kind;
    const inc = s.incrementor && this.skipParens(s.incrementor);
    if (!inc) return null;
    let step = null;
    if ((ts.isPostfixUnaryExpression(inc) || ts.isPrefixUnaryExpression(inc)) && ts.isIdentifier(inc.operand) && inc.operand.text === iname) {
      step = inc.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1;
    }
    if (step === null) return null;
    if (step === 1 && op !== ts.SyntaxKind.LessThanToken && op !== ts.SyntaxKind.LessThanEqualsToken) return null;
    if (step === -1 && op !== ts.SyntaxKind.GreaterThanEqualsToken && op !== ts.SyntaxKind.GreaterThanToken) return null;
    // i must not be assigned in the body, nor captured by a function in it
    let touched = false;
    const iSym = this.checker.getSymbolAtLocation(d.name);
    const visit = (n) => {
      if (touched) return;
      if ((ts.isBinaryExpression(n) && isAssignOp(n.operatorToken.kind) && ts.isIdentifier(this.skipParens(n.left)) && this.checker.getSymbolAtLocation(this.skipParens(n.left)) === iSym)
        || ((ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken) && ts.isIdentifier(n.operand) && this.checker.getSymbolAtLocation(n.operand) === iSym)) touched = true;
      // closures capturing i: JavaScript gives each pass its own i; a numeric for does too
      ts.forEachChild(n, visit);
    };
    visit(s.statement);
    if (touched) return null;
    // the bound must be stable: a literal, or array length / identifier not changed in the loop
    const B = c.right;
    if (!this.stableBound(B, s.statement)) return null;
    const n = this.declName(d.name);
    const a = this.expr(d.initializer);
    let b = this.expr(B);
    if (step === 1) {
      if (op === ts.SyntaxKind.LessThanToken) b = ts.isNumericLiteral(this.skipParens(B)) ? luaNumber(Number(this.skipParens(B).text) - 1) : `${this.numeric(B)} - 1`;
      // JavaScript compares i < b each pass with b fractional: use math.ceil(b) - 1
      if (op === ts.SyntaxKind.LessThanToken && !this.isIntegerish(B)) b = `math.ceil(${this.expr(B)}) - 1`;
      if (op === ts.SyntaxKind.LessThanEqualsToken && !this.isIntegerish(B)) b = `math.floor(${this.expr(B)})`;
      if (!this.isIntegerish(d.initializer)) return null;
      return { header: `for ${n} = ${a}, ${b} do` };
    }
    if (op === ts.SyntaxKind.GreaterThanToken) b = ts.isNumericLiteral(this.skipParens(B)) ? luaNumber(Number(this.skipParens(B).text) + 1) : `${this.numeric(B)} + 1`;
    if (!this.isIntegerish(B) || !this.isIntegerish(d.initializer)) return null;
    return { header: `for ${n} = ${a}, ${b}, -1 do` };
  }

  isIntegerish(node) {
    node = this.skipParens(node);
    if (ts.isNumericLiteral(node)) return Number.isInteger(Number(node.text));
    if (ts.isPropertyAccessExpression(node) && node.name.text === "length") return true;
    if (ts.isIdentifier(node)) {
      // an integer constant or a loop counter we can't prove: accept identifiers
      // only when declared from .length, a literal or Math.floor/round/ceil/trunc
      const sym = this.checker.getSymbolAtLocation(node);
      const decl = sym && sym.valueDeclaration;
      if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
        return this.isIntegerish(decl.initializer);
      }
      if (decl && ts.isParameter(decl)) return false;
      return false;
    }
    if (ts.isCallExpression(node)) {
      const t = node.expression.getText(this.sf);
      return /^Math\.(floor|ceil|round|trunc)$/.test(t);
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken || op === ts.SyntaxKind.MinusToken || op === ts.SyntaxKind.AsteriskToken) {
        return this.isIntegerish(node.left) && this.isIntegerish(node.right);
      }
    }
    return false;
  }

  stableBound(B, body) {
    B = this.skipParens(B);
    if (ts.isNumericLiteral(B)) return true;
    const syms = new Set();
    const collect = (n) => { if (ts.isIdentifier(n)) { const s = this.checker.getSymbolAtLocation(n); if (s) syms.add(s); } ts.forEachChild(n, collect); };
    collect(B);
    if (ts.isCallExpression(B)) {
      if (!/^Math\.(floor|ceil|round|trunc|min|max)$/.test(B.expression.getText(this.sf))) return false;
    }
    // any write to those symbols, or any call that might push to an array whose .length we read
    let bad = false;
    const readsLength = ts.isPropertyAccessExpression(B) && B.name.text === "length";
    const visit = (n) => {
      if (bad) return;
      if (ts.isBinaryExpression(n) && isAssignOp(n.operatorToken.kind)) {
        const l = this.skipParens(n.left);
        const root = rootIdent(l);
        if (root && syms.has(this.checker.getSymbolAtLocation(root))) bad = true;
      }
      if ((ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) && ts.isIdentifier(n.operand) && syms.has(this.checker.getSymbolAtLocation(n.operand))) bad = true;
      if (readsLength && ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const m = n.expression.name.text;
        if (["push", "pop", "shift", "unshift", "splice", "length"].includes(m)) {
          const root = rootIdent(n.expression.expression);
          if (!root || syms.has(this.checker.getSymbolAtLocation(root))) bad = true;
        }
      }
      if (readsLength && ts.isCallExpression(n) && !ts.isPropertyAccessExpression(n.expression)) {
        // a call that might change the array: only safe if the array is a local not passed in
        for (const a of n.arguments) {
          const root = rootIdent(this.skipParens(a));
          if (root && syms.has(this.checker.getSymbolAtLocation(root))) bad = true;
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    if (!ts.isIdentifier(B) && !readsLength && !ts.isCallExpression(B) && !ts.isBinaryExpression(B)) return false;
    return !bad;
  }

  forOfStmt(s) {
    const init = s.initializer;
    let decl = null;
    if (ts.isVariableDeclarationList(init)) decl = init.declarations[0].name;
    const itNode = s.expression;
    const ti = this.typeOf(itNode);
    const bindLines = (valueExpr) => {
      if (decl && ts.isIdentifier(decl)) return [`local ${this.declName(decl)} = ${valueExpr}`];
      if (decl) {
        const t = this.t("_e");
        return [`local ${t} = ${valueExpr}`, ...this.destructure(decl, t, true)];
      }
      // for (x of ...) with an existing variable
      return [this.lvalue(init).write(valueExpr)];
    };
    if (only(ti, "map")) {
      const k = this.t("_k"), v = this.t("_v");
      this.emit(`for ${k}, ${v} in ${this.wrapPrefix(this.expr(itNode))}:iter() do`);
      this.ind++;
      if (decl && ts.isArrayBindingPattern(decl)) {
        const els = decl.elements;
        if (els[0] && !ts.isOmittedExpression(els[0])) this.emit(`local ${this.declName(els[0].name)} = ${k}`);
        if (els[1] && !ts.isOmittedExpression(els[1])) this.emit(`local ${this.declName(els[1].name)} = ${v}`);
      } else for (const l of bindLines(`Js.alit(${k}, ${v})`)) this.emit(l);
      this.ind--;
      this.loopBody(s.statement);
      this.emit("end");
      return;
    }
    if (only(ti, "set")) {
      const v = this.t("_v");
      this.emit(`for ${v} in ${this.wrapPrefix(this.expr(itNode))}:iter() do`);
      this.ind++;
      for (const l of bindLines(v)) this.emit(l);
      this.ind--;
      this.loopBody(s.statement);
      this.emit("end");
      return;
    }
    if (only(ti, "arr")) {
      // live length, like JavaScript
      const a = this.t("_arr"), i = this.t("_i");
      this.emit("do");
      this.ind++;
      this.emit(`local ${a} = ${this.expr(itNode)}`);
      this.emit(`local ${i} = 0`);
      this.emit(`while ${i} < Js.alen(${a}) do`);
      this.ind++;
      this.emit(`${i} += 1`);
      // fast destructure of [k, v] pairs
      if (decl && ts.isArrayBindingPattern(decl) && decl.elements.every((e) => ts.isOmittedExpression(e) || (ts.isIdentifier(e.name) && !e.initializer && !e.dotDotDotToken))) {
        const e = this.t("_e");
        this.emit(`local ${e} = ${a}[${i}]`);
        decl.elements.forEach((el, j) => { if (!ts.isOmittedExpression(el)) this.emit(`local ${this.declName(el.name)} = ${e}[${j + 1}]`); });
      } else for (const l of bindLines(`${a}[${i}]`)) this.emit(l);
      this.ind--;
      this.loopBody(s.statement);
      this.emit("end");
      this.ind--;
      this.emit("end");
      return;
    }
    const ok = this.t("_ok"), v = this.t("_v");
    this.emit(`for ${ok}, ${v} in Js.iter(${this.expr(itNode)}) do`);
    this.ind++;
    for (const l of bindLines(v)) this.emit(l);
    this.ind--;
    this.loopBody(s.statement);
    this.emit("end");
  }

  forInStmt(s) {
    const init = s.initializer;
    const name = ts.isVariableDeclarationList(init) ? this.declName(init.declarations[0].name) : null;
    const ks = this.t("_ks"), i = this.t("_i");
    this.emit("do");
    this.ind++;
    this.emit(`local ${ks} = Js.Object.keys(${this.expr(s.expression)})`);
    this.emit(`for ${i} = 1, Js.alen(${ks}) do`);
    this.ind++;
    if (name) this.emit(`local ${name} = ${ks}[${i}]`);
    else this.emit(this.lvalue(init).write(`${ks}[${i}]`));
    this.ind--;
    this.loopBody(s.statement);
    this.emit("end");
    this.ind--;
    this.emit("end");
  }

  tryStmt(s) {
    const fn = this.fnStack[this.fnStack.length - 1] || { inTry: 0 };
    if (!this.fnStack.length) this.fnStack.push(fn);
    const ok = this.t("_ok"), e = this.t("_err"), rv = this.t("_rv");
    // does the try block contain return (not in nested functions)?
    this.emit(`local ${ok}, ${e}, ${rv} = pcall(function()`);
    fn.inTry++;
    const savedLoops = this.loopStack;
    this.loopStack = [{ kind: "try" }];
    this.subBlock(s.tryBlock);
    this.loopStack = savedLoops;
    fn.inTry--;
    this.emit("end)");
    // a return inside the try
    const outerTry = fn.inTry > 0;
    if (s.catchClause && !s.finallyBlock) {
      this.emit(`if not ${ok} then`);
      this.ind++;
      if (s.catchClause.variableDeclaration) {
        const v = s.catchClause.variableDeclaration.name;
        if (ts.isIdentifier(v)) this.emit(`local ${this.declName(v)} = Js.caught(${e})`);
      }
      this.block(s.catchClause.block.statements);
      this.ind--;
      this.emit(`elseif ${e} == Js.RET then`);
      this.ind++;
      this.emit(outerTry ? `return Js.RET, ${rv}` : `return ${rv}`);
      this.ind--;
      this.emit("end");
      return;
    }
    // with finally: the catch runs protected too, so finally always runs
    const cok = this.t("_cok"), ce = this.t("_cerr"), crv = this.t("_crv");
    this.emit(`local ${cok}, ${ce}, ${crv} = true, nil, nil`);
    if (s.catchClause) {
      this.emit(`if not ${ok} then`);
      this.ind++;
      this.emit(`${cok}, ${ce}, ${crv} = pcall(function(${e})`);
      fn.inTry++;
      this.ind++;
      if (s.catchClause.variableDeclaration) {
        const v = s.catchClause.variableDeclaration.name;
        if (ts.isIdentifier(v)) this.emit(`local ${this.declName(v)} = Js.caught(${e})`);
      }
      this.block(s.catchClause.block.statements);
      this.ind--;
      fn.inTry--;
      this.emit(`end, ${e})`);
      this.emit(`${ok} = true`);
      this.emit(`${e}, ${rv} = nil, nil`);
      this.ind--;
      this.emit("end");
    }
    this.block(s.finallyBlock.statements);
    this.emit(`if not ${ok} then error(${e}, 0) end`);
    this.emit(`if not ${cok} then error(${ce}, 0) end`);
    this.emit(`if ${ce} == Js.RET then return ${outerTry ? "Js.RET, " : ""}${crv} end`);
    this.emit(`if ${e} == Js.RET then return ${outerTry ? "Js.RET, " : ""}${rv} end`);
  }

  switchStmt(s) {
    const clauses = s.caseBlock.clauses;
    const sw = this.t("_sw");
    this.emit(`local ${sw} = ${this.expr(s.expression)}`);
    // simple shape: every non-empty clause ends with break/return/throw/continue,
    // and no other `break` targets the switch
    const terminates = (stmts) => stmts.length > 0 && isTerminator(stmts[stmts.length - 1]);
    let simple = true;
    clauses.forEach((c, i) => {
      if (c.statements.length && !terminates(c.statements) && i < clauses.length - 1) simple = false;
      const body = c.statements.slice(0, -1);
      if (body.some((st) => containsSwitchBreak(st))) simple = false;
      if (c.statements.length && !isTerminator(c.statements[c.statements.length - 1]) && containsSwitchBreak(c.statements[c.statements.length - 1])) simple = false;
    });
    const defaultIdx = clauses.findIndex(ts.isDefaultClause);
    if (defaultIdx >= 0 && defaultIdx !== clauses.length - 1) {
      // default in the middle: fine for the simple shape only if it doesn't fall through
      if (clauses[defaultIdx].statements.length === 0) simple = false;
    }
    if (simple) {
      // group empty clauses with the next one
      const groups = [];
      let cur = [];
      for (const c of clauses) {
        cur.push(c);
        if (c.statements.length) { groups.push(cur); cur = []; }
      }
      if (cur.length) groups.push(cur);
      let first = true;
      let defaultGroup = null;
      for (const g of groups) {
        const conds = g.filter(ts.isCaseClause).map((c) => `${sw} == ${this.expr(c.expression)}`);
        if (g.some(ts.isDefaultClause)) { defaultGroup = g; if (conds.length === 0) continue; }
        this.emit(`${first ? "if" : "elseif"} ${conds.join(" or ")} then`);
        first = false;
        this.switchBody(g[g.length - 1].statements);
      }
      if (defaultGroup) {
        if (first) { this.emit("do"); } else this.emit("else");
        this.switchBody(defaultGroup[defaultGroup.length - 1].statements);
      }
      if (!first || defaultGroup) this.emit("end");
      return;
    }
    // general shape: pick the starting clause, then run on (fallthrough) until break
    const idx = this.t("_ci");
    const conds = [];
    clauses.forEach((c, i) => { if (ts.isCaseClause(c)) conds.push(`${sw} == ${this.expr(c.expression)} then ${i + 1}`); });
    const dflt = defaultIdx >= 0 ? defaultIdx + 1 : 0;
    this.emit(`local ${idx} = ${conds.length ? `(if ${conds.join(" elseif ")} else ${dflt})` : dflt}`);
    const cont = this.t("_cont");
    this.emit(`local ${cont} = false`);
    this.emit("repeat");
    this.ind++;
    const frame = { kind: "switch-repeat", contFlag: cont };
    this.loopStack.push(frame);
    clauses.forEach((c, i) => {
      if (!c.statements.length) return;
      this.emit(`if ${idx} ~= 0 and ${idx} <= ${i + 1} then`);
      this.ind++;
      this.block(c.statements);
      this.ind--;
      this.emit("end");
    });
    this.loopStack.pop();
    this.ind--;
    this.emit("until true");
    if (frame.usedContinue) this.emit(`if ${cont} then continue end`);
  }

  switchBody(stmts) {
    this.ind++;
    const body = stmts.length && stmts[stmts.length - 1].kind === ts.SyntaxKind.BreakStatement && !stmts[stmts.length - 1].label
      ? stmts.slice(0, -1) : stmts;
    // a `{ ... }` block as the whole body
    if (body.length === 1 && ts.isBlock(body[0])) {
      const inner = body[0].statements;
      const trimmed = inner.length && inner[inner.length - 1].kind === ts.SyntaxKind.BreakStatement ? inner.slice(0, -1) : inner;
      this.block(trimmed);
    } else this.block(body);
    this.ind--;
  }

  enumDecl(s) {
    const n = this.declName(s.name);
    this.emit(`${this.isForwardId(s.name) || n.includes(".") ? "" : "local "}${n} = Js.O({}, nil)`);
    let next = 0;
    for (const m of s.members) {
      const key = this.propKey(m.name);
      let v;
      if (m.initializer) {
        const c = this.checker.getConstantValue(m);
        v = typeof c === "string" ? luaString(c) : luaNumber(c);
        if (typeof c === "number") next = c + 1;
      } else { v = luaNumber(next); next++; }
      this.emit(`${n}[${luaString(key)}] = ${v}`);
      if (!v.startsWith('"')) this.emit(`${n}[${luaString(String(Number(v)))}] = ${luaString(key)}`);
    }
    this.afterDecl(s.name, n);
  }

  classDecl(s) {
    const n = this.declName(s.name);
    if (s.heritageClauses && s.heritageClauses.some((h) => h.token === ts.SyntaxKind.ExtendsKeyword)) this.err(s, "class extends");
    this.emit(`${this.isForwardId(s.name) || n.includes(".") ? "" : "local "}${n} = {}`);
    this.emit(`${n}.__jsclass = true`);
    const getters = s.members.filter((m) => ts.isGetAccessor(m) && !hasStatic(m));
    const setters = s.members.filter((m) => ts.isSetAccessor(m) && !hasStatic(m));
    if (getters.length) {
      this.emit(`${n}.__getters = {}`);
      this.emit(`${n}.__index = function(t, k) local g = ${n}.__getters[k]; if g then return g(t) end; return ${n}[k] end`);
    } else this.emit(`${n}.__index = ${n}`);
    if (setters.length) {
      this.emit(`${n}.__setters = {}`);
      this.emit(`${n}.__newindex = function(t, k, v) local f = ${n}.__setters[k]; if f then f(t, v) else rawset(t, k, v) end end`);
    }
    // constructor
    const ctor = s.members.find(ts.isConstructorDeclaration);
    const fields = s.members.filter((m) => ts.isPropertyDeclaration(m) && !hasStatic(m));
    {
      const saved = { lines: this.lines, ind: this.ind };
      this.lines = [];
      this.ind = saved.ind + 1;
      this.fnStack.push({ inTry: 0 });
      let plist = "";
      if (ctor) {
        const { list, prologue } = this.params(ctor);
        plist = list;
        this.emit(`local self = setmetatable({}, ${n})`);
        for (const l of prologue) this.emit(l);
        // parameter properties: constructor(private x: number)
        for (const p of ctor.parameters) {
          if (p.modifiers && p.modifiers.some((m) => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(m.kind))) {
            this.emit(`self.${p.name.text} = ${this.declName(p.name)}`);
          }
        }
      } else this.emit(`local self = setmetatable({}, ${n})`);
      for (const f of fields) {
        const key = this.propKey(f.name);
        if (f.initializer) this.emit(`self[${luaString(key)}] = ${this.expr(f.initializer)}`);
      }
      if (ctor && ctor.body) this.block(ctor.body.statements);
      this.emit("return self");
      this.fnStack.pop();
      const body = this.lines;
      this.lines = saved.lines;
      this.ind = saved.ind;
      this.emit(`${n}.new = function(${plist})`);
      this.lines.push(...body);
      this.emit("end");
    }
    for (const m of s.members) {
      if (ts.isMethodDeclaration(m)) {
        const key = this.propKey(m.name);
        if (hasStatic(m)) this.emit(`${n}[${luaString(key)}] = ${this.funcExpr(m)}`);
        else this.emit(`${n}[${luaString(key)}] = ${this.funcExpr(m, true)}`);
      } else if (ts.isGetAccessor(m) && !hasStatic(m)) {
        this.emit(`${n}.__getters[${luaString(this.propKey(m.name))}] = ${this.funcExpr(m, true)}`);
      } else if (ts.isSetAccessor(m) && !hasStatic(m)) {
        this.emit(`${n}.__setters[${luaString(this.propKey(m.name))}] = ${this.funcExpr(m, true)}`);
      } else if (ts.isPropertyDeclaration(m) && hasStatic(m)) {
        this.emit(`${n}[${luaString(this.propKey(m.name))}] = ${m.initializer ? this.expr(m.initializer) : "nil"}`);
      }
    }
    this.afterDecl(s.name, n);
  }

  exportDecl(s) {
    // export { a, b as c }; export { x } from "./y"; export * from "./y"
    if (s.isTypeOnly) return;
    if (s.moduleSpecifier) {
      const target = resolveImport(this.program, this.file, s.moduleSpecifier.text);
      if (!target) this.err(s, "cannot resolve re-export");
      // skip re-exports that are only types
      const local = this.importLocal(target);
      if (!s.exportClause) { this.emit(`Js.reexport(exports, ${local}, nil)`); return; }
      if (ts.isNamedExports(s.exportClause)) {
        const pairs = [];
        for (const el of s.exportClause.elements) {
          if (el.isTypeOnly) continue;
          const sym = this.checker.getSymbolAtLocation(el.name);
          const target2 = sym && this.checker.getAliasedSymbol(sym);
          if (target2 && !(target2.flags & ts.SymbolFlags.Value)) continue;
          pairs.push(`[${luaString(el.name.text)}] = ${luaString((el.propertyName || el.name).text)}`);
        }
        if (pairs.length) this.emit(`Js.reexport(exports, ${local}, { ${pairs.join(", ")} })`);
        return;
      }
      this.err(s, "export * as");
    }
    if (s.exportClause && ts.isNamedExports(s.exportClause)) {
      for (const el of s.exportClause.elements) {
        if (el.isTypeOnly) continue;
        const localId = el.propertyName || el.name;
        const sym = this.checker.getExportSpecifierLocalTargetSymbol(el);
        if (sym && !(sym.flags & ts.SymbolFlags.Value) && !(sym.flags & ts.SymbolFlags.Alias)) continue;
        if (sym && sym.flags & ts.SymbolFlags.Alias) {
          const aliased = this.checker.getAliasedSymbol(sym);
          if (aliased && !(aliased.flags & ts.SymbolFlags.Value)) continue;
        }
        // an imported name passed on (import { A } ...; export { A }): read it from its module
        const decl = sym && sym.declarations && sym.declarations[0];
        const ref = decl && (ts.isImportSpecifier(decl) || ts.isImportClause(decl) || ts.isNamespaceImport(decl)) && decl.name
          ? this.identRef(decl.name) : this.identRef(localId);
        // deferred: written at the end of the file so later declarations exist
        this.deferredExports.push(`exports.${el.name.text} = ${ref}`);
      }
    }
  }

  // ───────────────────────────────────────────────────────────── the file ──

  run() {
    this.deferredExports = [];
    // top-level names: export let/var that are reassigned live in `exports`
    for (const st of this.sf.statements) {
      if (ts.isVariableStatement(st)) {
        const exported = (ts.getCombinedModifierFlags(st) & ts.ModifierFlags.Export) !== 0;
        const isConst = (st.declarationList.flags & ts.NodeFlags.Const) !== 0;
        if (exported && !isConst) {
          for (const d of st.declarationList.declarations) {
            if (ts.isIdentifier(d.name)) {
              const sym = this.checker.getSymbolAtLocation(d.name);
              this.exportedLets.add(sym);
              this.topNames.set(sym, `exports.${d.name.text}`);
            }
          }
        }
      }
    }
    // too many top-level names for Luau's 200 locals: keep them in a table
    const tops = [];
    for (const st of this.sf.statements) {
      if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name && (st.body || !ts.isFunctionDeclaration(st))) tops.push(st.name);
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
        const walk = (nm) => { if (ts.isIdentifier(nm)) tops.push(nm); else nm.elements.forEach((e) => { if (!ts.isOmittedExpression(e)) walk(e.name); }); };
        walk(d.name);
      }
    }
    const SPILL = tops.length > 150;
    if (SPILL) {
      for (const id of tops) {
        const sym = this.checker.getSymbolAtLocation(id);
        if (sym && !this.topNames.has(sym)) this.topNames.set(sym, `_T.${luaName(id.text)}`);
      }
    }
    this.ind = 1;
    if (SPILL) this.emit("local _T = {}");
    this.block(this.sf.statements.filter((s) => !ts.isImportDeclaration(s)));
    for (const l of this.deferredExports) this.emit(l);
    const header = [
      "--!nocheck",
      "--!nolint",
      `-- Generated from ${path.relative(REPO, this.file)} by roblox/tools/ts2luau. Do not edit.`,
      "return function(exports, import, Js)",
      "\tlocal A, S, N, Math = Js.A, Js.S, Js.N, Js.Math",
    ];
    for (const key of this.importOrder) header.push(`\tlocal ${this.imports.get(key)} = import(${luaString(key)})`);
    return [...header, ...this.lines, "end", ""].join("\n");
  }
}

// ─────────────────────────────────────────────────────────────── helpers ──

function isComparison(op) {
  const K = ts.SyntaxKind;
  return [K.EqualsEqualsEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken,
    K.LessThanToken, K.GreaterThanToken, K.LessThanEqualsToken, K.GreaterThanEqualsToken, K.InKeyword, K.InstanceOfKeyword].includes(op);
}
function isCompoundAssign(op) {
  const K = ts.SyntaxKind;
  return op >= K.FirstCompoundAssignment && op <= K.LastCompoundAssignment;
}
function isAssignOp(op) {
  return op === ts.SyntaxKind.EqualsToken || isCompoundAssign(op);
}
function isTerminator(s) {
  const K = ts.SyntaxKind;
  return [K.ReturnStatement, K.BreakStatement, K.ContinueStatement, K.ThrowStatement].includes(s.kind);
}
function hasStatic(m) {
  return (ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Static) !== 0;
}
function rootIdent(n) {
  while (n && (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n))) n = n.expression;
  return n && ts.isIdentifier(n) ? n : null;
}
// a `break` that would exit the switch (not one inside an inner loop or switch)
function containsSwitchBreak(st) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (n.kind === ts.SyntaxKind.BreakStatement && !n.label) { found = true; return; }
    if (ts.isIterationStatement(n, false) || ts.isSwitchStatement(n) || ts.isFunctionLike(n)) return;
    ts.forEachChild(n, visit);
  };
  visit(st);
  return found;
}
function balanced(e) {
  let d = 0;
  for (let i = 0; i < e.length; i++) {
    if (e[i] === "(") d++;
    else if (e[i] === ")") { d--; if (d === 0 && i < e.length - 1) return false; }
  }
  return d === 0;
}

// ───────────────────────────────────────────────────────────── JSON data ──

function luaValue(v, ind = "") {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return luaNumber(v);
  if (typeof v === "string") return luaString(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "Js.alit()";
    return `Js.mkarr({${v.map((x) => luaValue(x, ind)).join(", ")}}, ${v.length})`;
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return "Js.O({}, nil)";
  const f = keys.map((k) => `${isLuaIdent(k) ? k : `[${luaString(k)}]`}=${luaValue(v[k], ind)}`);
  return `Js.O({${f.join(", ")}}, {${keys.map(luaString).join(", ")}})`;
}

function convertJson(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return [
    "--!nocheck",
    "--!nolint",
    `-- Generated from ${path.relative(REPO, file)} by roblox/tools/ts2luau. Do not edit.`,
    "return function(exports, import, Js)",
    `\texports.default = ${luaValue(data)}`,
    "end",
    "",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────── main ──

function collect(program, entries) {
  const files = new Set();
  const queue = entries.map((e) => path.resolve(REPO, e));
  while (queue.length) {
    const f = queue.pop();
    if (files.has(f)) continue;
    files.add(f);
    if (f.endsWith(".json") || f.startsWith(PKG)) continue;
    const sf = program.getSourceFile(f);
    if (!sf) throw new Error(`not in program: ${f}`);
    for (const st of sf.statements) {
      let spec = null;
      if (ts.isImportDeclaration(st)) {
        if (st.importClause && st.importClause.isTypeOnly) continue;
        // `import { type A, type B }` only types
        const ic = st.importClause;
        if (ic && !ic.name && ic.namedBindings && ts.isNamedImports(ic.namedBindings) && ic.namedBindings.elements.length && ic.namedBindings.elements.every((e) => e.isTypeOnly)) continue;
        if (ic && !ic.name && ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
          // all imported names are types?
          const checker = program.getTypeChecker();
          const allTypes = ic.namedBindings.elements.length > 0 && ic.namedBindings.elements.every((e) => {
            if (e.isTypeOnly) return true;
            const s = checker.getSymbolAtLocation(e.name);
            const a = s && checker.getAliasedSymbol(s);
            return a && !(a.flags & ts.SymbolFlags.Value);
          });
          if (allTypes) continue;
        }
        spec = st.moduleSpecifier.text;
      } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && !st.isTypeOnly) {
        spec = st.moduleSpecifier.text;
      }
      if (!spec) continue;
      const target = resolveImport(program, f, spec);
      if (!target) throw new Error(`${path.relative(REPO, f)}: cannot resolve ${spec} (a package needs roblox/src/Overrides/__pkg/${spec}.luau)`);
      if (target.includes("node_modules")) throw new Error(`${path.relative(REPO, f)}: imports a package (${spec}); needs an override`);
      queue.push(target);
    }
    // import("./x.json"): the module is loaded with the file (see call())
    const walk = (n) => {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])) {
        const target = resolveImport(program, f, n.arguments[0].text);
        if (target && !target.includes("node_modules")) queue.push(target);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return files;
}

/**
 * SPEED-UPS (Roblox only; the website's code is unchanged). A function listed
 * here gives the same answer for the same argument for the whole game in
 * Roblox, so its answer is kept per argument and a copy is handed back each
 * time (callers may change their list). Measured 27 Oct 2026: the drawn-chance
 * pools were rescanned and re-sorted many times per chance (up to 0.9 s a
 * chance in Luau). Only list a function whose inputs cannot change in Roblox.
 *   authoredPool / playPool: the drawn chances. They change only through the
 *   website's dev tools (setLiveScenarioPool, showSavedScenarios), which
 *   Roblox never calls.
 */
const REMEMBER = {
  "lib/star/authoredChance": ["authoredPool", "playPool"],
};
function rememberAnswers(key, code) {
  for (const name of REMEMBER[key] ?? []) {
    const line = `\texports.${name} = ${name}\n`;
    if (!code.includes(line)) throw new Error(`${key}: cannot remember ${name} (its export line moved)`);
    code = code.replace(line, line +
      `\tdo local _orig, _kept = ${name}, {}; ${name} = function(k) local c = _kept[k]; if c == nil then c = _orig(k); _kept[k] = c end; return A.slice(c) end; exports.${name} = ${name} end\n`);
  }
  return code;
}

function commitOf() {
  try { return execSync("git rev-parse --short HEAD", { cwd: REPO }).toString().trim(); } catch { return "?"; }
}

export function convert(entries, { quiet = false, outDir = OUT_DIR, manifestPath = path.join(REPO, "roblox/tools/manifest.json"), clean = false } = {}) {
  if (clean) fs.rmSync(outDir, { recursive: true, force: true });
  const program = makeProgram(entries.filter((e) => !e.endsWith(".json")));
  const files = collect(program, entries);
  const failures = [];
  const written = [];
  for (const f of [...files].sort()) {
    const key = modKey(f);
    const outFile = path.join(outDir, key + ".luau");
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const override = path.join(OVERRIDES, key + ".luau");
    if (f.startsWith(PKG) && !fs.existsSync(override)) { failures.push(`no stand-in for package ${key}`); continue; }
    try {
      let code;
      if (fs.existsSync(override)) code = fs.readFileSync(override, "utf8");
      else if (f.endsWith(".json")) code = convertJson(f);
      else code = rememberAnswers(key, new FileEmitter(program, program.getSourceFile(f), files).run());
      fs.writeFileSync(outFile, code);
      written.push(key);
    } catch (e) {
      if (e instanceof ConvertError) failures.push(e.message);
      else failures.push(`${path.relative(REPO, f)}: ${e.stack}`);
    }
  }
  // the list of converted modules and where they came from
  const manifest = { commit: commitOf(), modules: written };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
  if (!quiet) {
    console.log(`converted ${written.length} of ${files.size} files`);
    for (const f of failures) console.log("FAIL " + f);
  }
  return { written, failures };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const entries = process.argv.slice(2);
  if (!entries.length) { console.error("usage: convert.mjs <entry.ts> ..."); process.exit(2); }
  const { failures } = convert(entries);
  process.exit(failures.length ? 1 : 0);
}
