/**
 * A LEVELDB WRITER, FOR TESTS ONLY: makes the same bytes Chromium's LevelDB makes (a .log of write batches and .ldb
 * tables with prefix-compressed, snappy-compressed blocks, checksums, footer), so the reader in src/migrate/leveldb.ts
 * is proved against files laid out as the spec says, including every path Chromium's own files take
 * (multi-block tables, log records split over 32 KB blocks, snappy copies, deletes, newer entries shadowing older).
 * Written from leveldb/doc/log_format.md and table_format.md, not from the reader.
 */
import { crc32c, maskCrc } from "../../src/migrate/leveldb";

const cat = (parts: Uint8Array[]) => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
export function varintBytes(n: number): Uint8Array { const o: number[] = []; while (n >= 128) { o.push((n % 128) | 128); n = Math.floor(n / 128); } o.push(n); return Uint8Array.from(o); }
const le32 = (n: number) => Uint8Array.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
const le64 = (n: number) => cat([le32(n % 4294967296), le32(Math.floor(n / 4294967296))]);

// ── snappy compress: greedy, 4-byte hash, emits literals and copies of all three sizes ──
export function snappyCompress(src: Uint8Array): Uint8Array {
  const out: number[] = [...varintBytes(src.length)];
  const emitLiteral = (from: number, to: number) => {
    let len = to - from;
    while (len > 0) {
      const n = Math.min(len, 65536); // one literal element, at most 65536 here
      if (n - 1 < 60) out.push((n - 1) << 2);
      else if (n - 1 < 256) out.push(60 << 2, n - 1);
      else out.push(61 << 2, (n - 1) & 255, (n - 1) >> 8);
      for (let i = 0; i < n; i++) out.push(src[from + i]);
      from += n; len -= n;
    }
  };
  const emitCopy = (off: number, len: number) => {
    while (len > 0) {
      const n = Math.min(len, 64);
      if (n >= 4 && n <= 11 && off < 2048) out.push(1 | ((n - 4) << 2) | ((off >> 8) << 5), off & 255);
      else if (off < 65536) out.push(2 | ((n - 1) << 2), off & 255, off >> 8);
      else out.push(3 | ((n - 1) << 2), ...le32(off));
      len -= n;
    }
  };
  const table = new Map<number, number>();
  let i = 0, lit = 0;
  while (i + 4 <= src.length) {
    const h = src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24);
    const cand = table.get(h);
    table.set(h, i);
    if (cand !== undefined && src[cand] === src[i] && src[cand + 1] === src[i + 1] && src[cand + 2] === src[i + 2] && src[cand + 3] === src[i + 3]) {
      let len = 4;
      while (i + len < src.length && src[cand + len] === src[i + len] && len < 4000) len++;
      emitLiteral(lit, i);
      emitCopy(i - cand, len);
      i += len; lit = i;
    } else i++;
  }
  emitLiteral(lit, src.length);
  return Uint8Array.from(out);
}

// ── the log ──
export interface BatchOp { key: Uint8Array; value: Uint8Array | null }
export function writeBatch(seq: number, ops: BatchOp[]): Uint8Array {
  const parts: Uint8Array[] = [le64(seq), le32(ops.length)];
  for (const op of ops) {
    if (op.value) parts.push(Uint8Array.of(1), varintBytes(op.key.length), op.key, varintBytes(op.value.length), op.value);
    else parts.push(Uint8Array.of(0), varintBytes(op.key.length), op.key);
  }
  return cat(parts);
}
/** A .log file holding these payloads: records of FULL, or FIRST/MIDDLE/LAST when they cross a 32 KB block. */
export function writeLog(payloads: Uint8Array[]): Uint8Array {
  const BLOCK = 32768;
  const out: number[] = [];
  const emit = (type: number, data: Uint8Array) => {
    const crc = maskCrc(crc32c(cat([Uint8Array.of(type), data])));
    out.push(...le32(crc), data.length & 255, data.length >> 8, type, ...data);
  };
  for (const p of payloads) {
    let off = 0, first = true;
    for (;;) {
      let left = BLOCK - (out.length % BLOCK);
      if (left < 7) { for (let i = 0; i < left; i++) out.push(0); left = BLOCK; }
      const room = left - 7;
      const n = Math.min(room, p.length - off);
      const last = off + n === p.length;
      emit(first && last ? 1 : first ? 2 : last ? 4 : 3, p.subarray(off, off + n));
      off += n; first = false;
      if (last) break;
    }
  }
  return Uint8Array.from(out);
}

// ── a table ──
export interface TableEntry { key: Uint8Array; seq: number; value: Uint8Array | null }
const cmpBytes = (a: Uint8Array, b: Uint8Array) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };

function buildBlock(entries: [Uint8Array, Uint8Array][], restartInterval: number): Uint8Array {
  const parts: Uint8Array[] = [];
  const restarts: number[] = [];
  let prev = new Uint8Array(0), size = 0;
  entries.forEach(([k, v], i) => {
    let shared = 0;
    if (i % restartInterval === 0) restarts.push(size); else while (shared < prev.length && shared < k.length && prev[shared] === k[shared]) shared++;
    const head = cat([varintBytes(shared), varintBytes(k.length - shared), varintBytes(v.length)]);
    const piece = cat([head, k.subarray(shared), v]);
    parts.push(piece); size += piece.length; prev = k;
  });
  if (!restarts.length) restarts.push(0);
  return cat([...parts, ...restarts.map(le32), le32(restarts.length)]);
}
function framed(file: number[], block: Uint8Array, compress: boolean): { off: number; size: number } {
  let body = block, type = 0;
  if (compress) { const c = snappyCompress(block); if (c.length < block.length - block.length / 8) { body = c; type = 1; } }
  const off = file.length;
  const crc = maskCrc(crc32c(cat([body, Uint8Array.of(type)])));
  file.push(...body, type, ...le32(crc));
  return { off, size: body.length };
}
/** A .ldb table. Entries may come in any order; they are sorted (user key up, newest sequence first). */
export function writeTable(entries: TableEntry[], opts: { blockSize?: number; compress?: boolean } = {}): Uint8Array {
  const blockSize = opts.blockSize ?? 4096;
  const sorted = [...entries].sort((a, b) => cmpBytes(a.key, b.key) || b.seq - a.seq);
  const file: number[] = [];
  const index: [Uint8Array, Uint8Array][] = [];
  let cur: [Uint8Array, Uint8Array][] = [], curSize = 0, lastKey = new Uint8Array(0);
  const flush = () => {
    if (!cur.length) return;
    const h = framed(file, buildBlock(cur, 16), opts.compress ?? true);
    index.push([lastKey, cat([varintBytes(h.off), varintBytes(h.size)])]);
    cur = []; curSize = 0;
  };
  for (const e of sorted) {
    const ik = cat([e.key, le64(e.seq * 256 + (e.value ? 1 : 0))]);
    cur.push([ik, e.value ?? new Uint8Array(0)]); curSize += ik.length + (e.value?.length ?? 0) + 6; lastKey = ik;
    if (curSize >= blockSize) flush();
  }
  flush();
  const meta = framed(file, buildBlock([], 16), false);
  const idx = framed(file, buildBlock(index, 1), false);
  const footer = cat([varintBytes(meta.off), varintBytes(meta.size), varintBytes(idx.off), varintBytes(idx.size)]);
  const pad = new Uint8Array(40 - footer.length);
  return Uint8Array.from([...file, ...footer, ...pad, 0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb]);
}

// ── Chromium's localStorage encoding on top ──
const enc = (s: string): Uint8Array => {
  let latin = true;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 255) { latin = false; break; }
  if (latin) { const o = new Uint8Array(s.length + 1); o[0] = 1; for (let i = 0; i < s.length; i++) o[i + 1] = s.charCodeAt(i); return o; }
  const o = new Uint8Array(s.length * 2 + 1); o[0] = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o[1 + 2 * i] = c & 255; o[2 + 2 * i] = c >> 8; }
  return o;
};
export const ascii = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
/** The LevelDB key of a localStorage item. */
export const lsKey = (origin: string, key: string) => cat([ascii("_" + origin), Uint8Array.of(0), enc(key)]);
export const lsValue = (value: string) => enc(value);
