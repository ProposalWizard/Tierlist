/**
 * A SMALL, READ-ONLY LEVELDB READER (for the old app's saved game).
 *
 * The packed app (Capacitor) keeps the player's save in the WebView's localStorage. Chromium keeps that in a LevelDB
 * folder in the app's own data (`app_webview/Default/Local Storage/leveldb`), and that folder is still there after the
 * new app replaces the old one at the same package. This file reads it. No native code, no dependency: plain bytes in,
 * key/value pairs out. It only READS; nothing here ever writes, deletes or moves a file.
 *
 * What it reads (the LevelDB file format, see leveldb/doc/log_format.md and table_format.md):
 *   - `*.log`  the write-ahead log: 32 KB blocks of records, each record a "write batch" of puts and deletes.
 *   - `*.ldb` / `*.sst`  sorted tables: data blocks (prefix-compressed keys, optionally snappy-compressed), an index
 *     block, a 48-byte footer.
 *   Every entry carries a sequence number; for a key, the entry with the HIGHEST sequence number wins, and a delete
 *   (type 0) at the top means the key is gone. The files' checksums (CRC32C) are checked; a damaged block or a torn
 *   log tail is skipped, never trusted.
 * It does NOT read MANIFEST/CURRENT (not needed: sequence numbers settle which entry is newest).
 *
 * Never throws out of readLevelDb: it returns what it could read and a list of notes about what it could not.
 */

/** A value or key as raw bytes. */
export type Bytes = Uint8Array;

// ── CRC32C (Castagnoli), as LevelDB masks it ─────────────────────────────────────
let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1;
    t[i] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}
/** CRC32C of the bytes (seeded with `seed`, 0 for a fresh one). */
export function crc32c(data: Bytes, start = 0, end = data.length, seed = 0): number {
  const t = crcTable();
  let c = ~seed >>> 0;
  for (let i = start; i < end; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
/** LevelDB stores checksums "masked", so a checksum of a checksum does not collide. */
export function maskCrc(crc: number): number {
  return ((((crc >>> 15) | (crc << 17)) >>> 0) + 0xa282ead8) >>> 0;
}
const u32 = (b: Bytes, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

// ── varints ────────────────────────────────────────────────────────────────────
/** Reads a varint at `o`; returns [value, nextOffset] (value is exact up to 2^53). Throws on a cut-off one. */
function varint(b: Bytes, o: number): [number, number] {
  let result = 0, mul = 1;
  for (let i = 0; i < 10; i++) {
    if (o >= b.length) throw new Error("varint ran off the end");
    const byte = b[o++];
    result += (byte & 0x7f) * mul;
    if (!(byte & 0x80)) return [result, o];
    mul *= 128;
  }
  throw new Error("varint too long");
}

// ── snappy (decompress only; LevelDB tables use it per block) ─────────────────────
export function snappyDecompress(src: Bytes): Bytes {
  const [outLen, p0] = varint(src, 0);
  if (outLen > 64 * 1024 * 1024) throw new Error("snappy: block too large");
  const out = new Uint8Array(outLen);
  let o = 0, p = p0;
  while (p < src.length) {
    const tag = src[p++];
    const kind = tag & 3;
    if (kind === 0) {
      let len = tag >>> 2;
      if (len >= 60) {
        const extra = len - 59; // 1..4 length bytes
        len = 0;
        for (let i = 0; i < extra; i++) len += src[p++] * 2 ** (8 * i);
      }
      len += 1;
      if (p + len > src.length || o + len > outLen) throw new Error("snappy: literal runs past the end");
      out.set(src.subarray(p, p + len), o);
      p += len; o += len;
    } else {
      let len: number, off: number;
      if (kind === 1) { len = 4 + ((tag >>> 2) & 7); off = ((tag >>> 5) << 8) | src[p++]; }
      else if (kind === 2) { len = 1 + (tag >>> 2); off = src[p] | (src[p + 1] << 8); p += 2; }
      else { len = 1 + (tag >>> 2); off = u32(src, p); p += 4; }
      if (off === 0 || off > o || o + len > outLen) throw new Error("snappy: bad copy");
      for (let i = 0; i < len; i++) { out[o] = out[o - off]; o++; } // may overlap: byte by byte
    }
  }
  if (o !== outLen) throw new Error("snappy: wrong length");
  return out;
}

// ── entries ────────────────────────────────────────────────────────────────────
interface Entry { key: string; seq: number; del: boolean; value: Bytes | null }
/** A key's bytes as a "binary string" (one char per byte), so it works as a Map key and sorts bytewise. */
export function bin(b: Bytes, s = 0, e = b.length): string {
  let out = "";
  for (let i = s; i < e; i += 8192) out += String.fromCharCode.apply(null, Array.prototype.slice.call(b, i, Math.min(e, i + 8192)) as number[]);
  return out;
}

// ── the write-ahead log ───────────────────────────────────────────────────────────
const LOG_BLOCK = 32768;
/** Every record's payload in a .log file, in order. A torn or damaged tail ends the list (noted). */
export function readLogPayloads(b: Bytes, notes: string[] = []): Bytes[] {
  const out: Bytes[] = [];
  let pos = 0;
  let pending: Bytes[] | null = null;
  while (pos + 7 <= b.length) {
    const left = LOG_BLOCK - (pos % LOG_BLOCK);
    if (left < 7) { pos += left; continue; } // block trailer padding
    const stored = u32(b, pos);
    const len = b[pos + 4] | (b[pos + 5] << 8);
    const type = b[pos + 6];
    if (type === 0 && len === 0) { pos += left; continue; } // zero fill
    if (7 + len > left || pos + 7 + len > b.length) { notes.push("log: a record is cut off at the end (ignored)"); break; }
    if (maskCrc(crc32c(b, pos + 6, pos + 7 + len)) !== stored) { notes.push("log: a record failed its checksum (rest of file ignored)"); break; }
    const payload = b.subarray(pos + 7, pos + 7 + len);
    pos += 7 + len;
    if (type === 1) { out.push(payload); pending = null; }
    else if (type === 2) pending = [payload];
    else if (type === 3) { if (pending) pending.push(payload); }
    else if (type === 4) {
      if (pending) {
        pending.push(payload);
        let total = 0;
        for (const p of pending) total += p.length;
        const whole = new Uint8Array(total);
        let o = 0;
        for (const p of pending) { whole.set(p, o); o += p.length; }
        out.push(whole);
      }
      pending = null;
    } else { notes.push("log: unknown record type " + type); break; }
  }
  return out;
}

/** The puts and deletes in one write batch: 8-byte sequence, 4-byte count, then the operations. */
export function readWriteBatch(p: Bytes): Entry[] {
  if (p.length < 12) return [];
  const seq0 = u32(p, 0) + u32(p, 4) * 4294967296;
  const count = u32(p, 8);
  const out: Entry[] = [];
  let o = 12;
  for (let i = 0; i < count && o < p.length; i++) {
    const tag = p[o++];
    const [kl, o1] = varint(p, o);
    const key = bin(p, o1, o1 + kl);
    o = o1 + kl;
    if (tag === 1) {
      const [vl, o2] = varint(p, o);
      out.push({ key, seq: seq0 + i, del: false, value: p.subarray(o2, o2 + vl) });
      o = o2 + vl;
    } else if (tag === 0) out.push({ key, seq: seq0 + i, del: true, value: null });
    else throw new Error("write batch: unknown tag " + tag);
  }
  return out;
}

// ── tables ──────────────────────────────────────────────────────────────────────
const TABLE_MAGIC = [0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb];

/** The entries of one block's (already decompressed) bytes, as [key bytes, value bytes]. */
function blockEntries(blk: Bytes): [Bytes, Bytes][] {
  if (blk.length < 4) return [];
  const restarts = u32(blk, blk.length - 4);
  const end = blk.length - 4 - restarts * 4;
  if (end < 0) throw new Error("block: bad restart count");
  const out: [Bytes, Bytes][] = [];
  let o = 0;
  let prev: Bytes = new Uint8Array(0);
  while (o < end) {
    let shared: number, nonShared: number, vlen: number;
    [shared, o] = varint(blk, o);
    [nonShared, o] = varint(blk, o);
    [vlen, o] = varint(blk, o);
    if (shared > prev.length || o + nonShared + vlen > end) throw new Error("block: entry runs past the end");
    const key = new Uint8Array(shared + nonShared);
    key.set(prev.subarray(0, shared), 0);
    key.set(blk.subarray(o, o + nonShared), shared);
    o += nonShared;
    out.push([key, blk.subarray(o, o + vlen)]);
    o += vlen;
    prev = key;
  }
  return out;
}

function readBlock(file: Bytes, offset: number, size: number): Bytes {
  if (offset + size + 5 > file.length) throw new Error("block: cut off");
  const type = file[offset + size];
  const stored = u32(file, offset + size + 1);
  if (maskCrc(crc32c(file, offset, offset + size + 1)) !== stored) throw new Error("block: checksum failed");
  const raw = file.subarray(offset, offset + size);
  if (type === 0) return raw;
  if (type === 1) return snappyDecompress(raw);
  throw new Error("block: unknown compression " + type);
}

/** Every entry of a table file. A damaged data block is skipped (noted); a damaged footer or index gives nothing. */
export function readTable(file: Bytes, notes: string[] = []): Entry[] {
  const out: Entry[] = [];
  if (file.length < 48) throw new Error("table: too small");
  for (let i = 0; i < 8; i++) if (file[file.length - 8 + i] !== TABLE_MAGIC[i]) throw new Error("table: not a LevelDB table");
  let o = file.length - 48;
  let metaOff: number, metaSize: number, idxOff: number, idxSize: number;
  [metaOff, o] = varint(file, o);
  [metaSize, o] = varint(file, o);
  [idxOff, o] = varint(file, o);
  [idxSize, o] = varint(file, o);
  void metaOff; void metaSize;
  const index = blockEntries(readBlock(file, idxOff, idxSize));
  for (const [, handle] of index) {
    try {
      const [off, p1] = varint(handle, 0);
      const [size] = varint(handle, p1);
      for (const [ik, v] of blockEntries(readBlock(file, off, size))) {
        if (ik.length < 8) continue;
        const lo = u32(ik, ik.length - 8), hi = u32(ik, ik.length - 4);
        const type = lo & 0xff;
        const seq = (lo >>> 8) + hi * 16777216;
        out.push({ key: bin(ik, 0, ik.length - 8), seq, del: type === 0, value: type === 0 ? null : v });
      }
    } catch (e) { notes.push("table: one block skipped (" + (e instanceof Error ? e.message : String(e)) + ")"); }
  }
  return out;
}

// ── the whole folder ─────────────────────────────────────────────────────────────
export interface LevelDbFile { name: string; bytes: Bytes }
export interface LevelDbRead {
  /** key (binary string) → value bytes, for every key that is alive at the newest sequence number. */
  live: Map<string, Bytes>;
  notes: string[];
  filesRead: number;
}

/** Reads every `.log`, `.ldb` and `.sst` file given and settles each key by its highest sequence number. */
export function readLevelDb(files: LevelDbFile[]): LevelDbRead {
  const notes: string[] = [];
  const newest = new Map<string, Entry>();
  let filesRead = 0;
  const take = (e: Entry) => {
    const cur = newest.get(e.key);
    if (!cur || e.seq >= cur.seq) newest.set(e.key, e);
  };
  for (const f of files) {
    const n: string[] = [];
    try {
      if (/\.log$/i.test(f.name)) {
        for (const p of readLogPayloads(f.bytes, n)) { try { for (const e of readWriteBatch(p)) take(e); } catch (e) { n.push("log: a batch could not be read (" + (e instanceof Error ? e.message : String(e)) + ")"); } }
      } else if (/\.(ldb|sst)$/i.test(f.name)) {
        for (const e of readTable(f.bytes, n)) take(e);
      } else continue;
      filesRead++;
    } catch (e) { n.push("could not read (" + (e instanceof Error ? e.message : String(e)) + ")"); }
    for (const m of n) notes.push(f.name + ": " + m);
  }
  const live = new Map<string, Bytes>();
  for (const [k, e] of newest) if (!e.del && e.value) live.set(k, e.value);
  return { live, notes, filesRead };
}

// ── Chromium's localStorage on top of LevelDB ────────────────────────────────────────
/** One byte says how Chromium stored a string: 1 = Latin-1 (one byte a character), 0 = UTF-16 little-endian. */
export function decodeChromiumString(b: Bytes, start = 0): string | null {
  if (b.length <= start) return "";
  const fmt = b[start];
  const s = start + 1;
  if (fmt === 1) return bin(b, s, b.length);
  if (fmt === 0) {
    if ((b.length - s) % 2) return null;
    let out = "";
    for (let i = s; i < b.length; i += 2 * 4096) {
      const codes: number[] = [];
      for (let j = i; j < Math.min(b.length, i + 2 * 4096); j += 2) codes.push(b[j] | (b[j + 1] << 8));
      out += String.fromCharCode.apply(null, codes);
    }
    return out;
  }
  return null;
}

export interface LocalStorageRead {
  /** localStorage, for the packed app's own page (https://localhost, Capacitor's), key → value. */
  entries: Map<string, string>;
  /** The origin the entries came from, e.g. "https://localhost/". */
  origin: string | null;
  notes: string[];
}

/**
 * Chromium's localStorage keys are `_` + origin + 0x00 + (format byte + key), values are (format byte + value).
 * Older Chromium writes the origin without a closing slash, newer with one. Only the packed app's own page
 * (localhost, any scheme or port) is taken; if there are several, the one holding the most entries.
 */
export function chromiumLocalStorage(read: LevelDbRead): LocalStorageRead {
  const byOrigin = new Map<string, Map<string, string>>();
  const notes = [...read.notes];
  for (const [k, v] of read.live) {
    if (k.charCodeAt(0) !== 0x5f) continue; // "_"
    const z = k.indexOf("\0");
    if (z < 0) continue;
    const origin = k.slice(1, z);
    if (!/^https?:\/\/localhost(:\d+)?\/?$/i.test(origin)) continue;
    const kb = new Uint8Array(k.length - z - 1);
    for (let i = 0; i < kb.length; i++) kb[i] = k.charCodeAt(z + 1 + i);
    const key = decodeChromiumString(kb), value = decodeChromiumString(v);
    if (key === null || value === null) { notes.push("a localStorage entry has an unknown text format (skipped)"); continue; }
    let m = byOrigin.get(origin);
    if (!m) byOrigin.set(origin, (m = new Map()));
    m.set(key, value);
  }
  let best: string | null = null;
  for (const [o, m] of byOrigin) if (best === null || m.size > byOrigin.get(best)!.size) best = o;
  return { entries: best ? byOrigin.get(best)! : new Map(), origin: best, notes };
}
