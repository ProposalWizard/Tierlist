/**
 * THE MESHOPT DECODER, IN PLAIN JAVASCRIPT (for the phone).
 *
 * The website's 3D files are packed with meshopt (scripts/perf3d/shrink-models.mjs)
 * and every GLTFLoader reads them through three's decoder, which is
 * WebAssembly. The phone's JavaScript engine (Hermes) has no WebAssembly, so
 * the phone reads the SAME files with this decoder instead: a port of
 * meshoptimizer's reference decoder (meshopt_decoder_reference.js, MIT,
 * Arseny Kapoulkine / Jasper St. Pierre), the drop-in for the WebAssembly one
 * (same `decodeGltfBuffer` shape three's EXT_meshopt_compression calls).
 *
 * phone/tools/three-check.ts decodes every bundled file with this and with
 * three's WebAssembly decoder and checks the bytes are the same.
 */

function dezig(v: number): number {
  return (v & 1) !== 0 ? ~(v >>> 1) : v >>> 1;
}

function decodeVertexBuffer(target: Uint8Array, elementCount: number, byteStride: number, source: Uint8Array, filter?: string) {
  if (source[0] !== 0xa0) throw new Error("meshopt: vertex codec " + source[0].toString(16) + " not supported");
  const maxBlockElements = Math.min((0x2000 / byteStride) & ~0x000f, 0x100);
  const deltas = new Uint8Array(0x10);
  const tailDataOffs = source.length - byteStride;
  const tempData = source.slice(tailDataOffs, tailDataOffs + byteStride);
  let srcOffs = 0x01;
  for (let dstElemBase = 0; dstElemBase < elementCount; dstElemBase += maxBlockElements) {
    const attrBlockElementCount = Math.min(elementCount - dstElemBase, maxBlockElements);
    const groupCount = ((attrBlockElementCount + 0x0f) & ~0x0f) >>> 4;
    const headerByteCount = ((groupCount + 0x03) & ~0x03) >>> 2;
    for (let byte = 0; byte < byteStride; byte++) {
      let headerBitsOffs = srcOffs;
      srcOffs += headerByteCount;
      for (let group = 0; group < groupCount; group++) {
        const mode = (source[headerBitsOffs] >>> ((group & 0x03) << 1)) & 0x03;
        if ((group & 0x03) === 0x03) headerBitsOffs++;
        const dstElemGroup = dstElemBase + (group << 4);
        if (mode === 0) {
          deltas.fill(0);
        } else if (mode === 1) {
          const srcBase = srcOffs;
          srcOffs += 0x04;
          for (let m = 0; m < 0x10; m++) {
            const shift = 6 - ((m & 0x03) << 1);
            let delta = (source[srcBase + (m >>> 2)] >>> shift) & 0x03;
            if (delta === 3) delta = source[srcOffs++];
            deltas[m] = delta;
          }
        } else if (mode === 2) {
          const srcBase = srcOffs;
          srcOffs += 0x08;
          for (let m = 0; m < 0x10; m++) {
            const shift = m & 0x01 ? 0 : 4;
            let delta = (source[srcBase + (m >>> 1)] >>> shift) & 0x0f;
            if (delta === 0xf) delta = source[srcOffs++];
            deltas[m] = delta;
          }
        } else {
          deltas.set(source.subarray(srcOffs, srcOffs + 0x10));
          srcOffs += 0x10;
        }
        const end = Math.min(0x10, elementCount - dstElemGroup);
        let acc = tempData[byte];
        for (let m = 0; m < end; m++) {
          acc = (acc + dezig(deltas[m])) & 0xff;
          target[(dstElemGroup + m) * byteStride + byte] = acc;
        }
        tempData[byte] = acc;
      }
    }
  }
  if (filter === "OCTAHEDRAL") {
    let dst: Int8Array | Int16Array, maxInt: number;
    if (byteStride === 4) { dst = new Int8Array(target.buffer, target.byteOffset, target.byteLength); maxInt = 127; }
    else if (byteStride === 8) { dst = new Int16Array(target.buffer, target.byteOffset, target.byteLength / 2); maxInt = 32767; }
    else throw new Error("meshopt: octahedral stride");
    for (let i = 0; i < 4 * elementCount; i += 4) {
      let x = dst[i], y = dst[i + 1];
      const one = dst[i + 2];
      x /= one;
      y /= one;
      const z = 1.0 - Math.abs(x) - Math.abs(y);
      const t = Math.max(-z, 0.0);
      x -= x >= 0 ? t : -t;
      y -= y >= 0 ? t : -t;
      const h = maxInt / Math.hypot(x, y, z);
      dst[i] = Math.round(x * h);
      dst[i + 1] = Math.round(y * h);
      dst[i + 2] = Math.round(z * h);
    }
  } else if (filter === "QUATERNION") {
    if (byteStride !== 8) throw new Error("meshopt: quaternion stride");
    // in 32-bit floats, w from 1 - (x² + (y² + z²)), rounded half to even by the
    // float "snap": the WebAssembly decoder's own sums (meshoptimizer's
    // decodeFilterQuatSimd, what a browser runs), so the clips' turns are the same to the last bit
    const f = Math.fround;
    const SNAP = 3 << 22;
    const dst = new Int16Array(target.buffer, target.byteOffset, target.byteLength / 2);
    const scale = f(Math.SQRT1_2);
    const rnd = (v: number) => f(f(v * 32767) + SNAP) - SNAP;
    for (let i = 0; i < 4 * elementCount; i += 4) {
      const inputW = dst[i + 3];
      const maxComponent = inputW & 0x03;
      const ss = f(scale / (inputW | 0x03));
      const x = f(dst[i] * ss), y = f(dst[i + 1] * ss), z = f(dst[i + 2] * ss);
      const ww = f(1 - f(f(x * x) + f(f(y * y) + f(z * z))));
      const w = f(Math.sqrt(ww >= 0 ? ww : 0));
      dst[i + ((maxComponent + 1) % 4)] = rnd(x);
      dst[i + ((maxComponent + 2) % 4)] = rnd(y);
      dst[i + ((maxComponent + 3) % 4)] = rnd(z);
      dst[i + ((maxComponent + 0) % 4)] = rnd(w);
    }
  } else if (filter === "EXPONENTIAL") {
    if ((byteStride & 0x03) !== 0) throw new Error("meshopt: exponential stride");
    const n = (byteStride * elementCount) / 4;
    const src = new Int32Array(target.buffer, target.byteOffset, n);
    const dst = new Float32Array(target.buffer, target.byteOffset, n);
    for (let i = 0; i < n; i++) {
      const v = src[i], exp = v >> 24, mantissa = (v << 8) >> 8;
      dst[i] = Math.pow(2, exp) * mantissa;
    }
  }
}

function pushfifo(fifo: Uint32Array, n: number) {
  fifo.copyWithin(1, 0, fifo.length - 1);
  fifo[0] = n;
}

function decodeIndexBuffer(target: Uint8Array, count: number, byteStride: number, source: Uint8Array) {
  if (source[0] !== 0xe1) throw new Error("meshopt: index codec " + source[0].toString(16) + " not supported");
  const dst = byteStride === 2 ? new Uint16Array(target.buffer, target.byteOffset, count) : new Uint32Array(target.buffer, target.byteOffset, count);
  const triCount = count / 3;
  let codeOffs = 0x01;
  let dataOffs = codeOffs + triCount;
  const codeauxOffs = source.length - 0x10;
  const readLEB128 = () => {
    let n = 0;
    for (let i = 0; ; i += 7) {
      const b = source[dataOffs++];
      n |= (b & 0x7f) << i;
      if (b < 0x80) return n;
    }
  };
  let next = 0, last = 0;
  const edgefifo = new Uint32Array(32);
  const vertexfifo = new Uint32Array(16);
  const decodeIndex = (v: number) => (last += dezig(v));
  let o = 0;
  for (let i = 0; i < triCount; i++) {
    const code = source[codeOffs++];
    const b0 = code >>> 4, b1 = code & 0x0f;
    if (b0 < 0x0f) {
      const a = edgefifo[(b0 << 1) + 0], b = edgefifo[(b0 << 1) + 1];
      let c = -1;
      if (b1 === 0x00) { c = next++; pushfifo(vertexfifo, c); }
      else if (b1 < 0x0d) { c = vertexfifo[b1]; }
      else if (b1 === 0x0d) { c = --last; pushfifo(vertexfifo, c); }
      else if (b1 === 0x0e) { c = ++last; pushfifo(vertexfifo, c); }
      else { c = decodeIndex(readLEB128()); pushfifo(vertexfifo, c); }
      pushfifo(edgefifo, b); pushfifo(edgefifo, c);
      pushfifo(edgefifo, c); pushfifo(edgefifo, a);
      dst[o++] = a; dst[o++] = b; dst[o++] = c;
    } else {
      let a = -1, b = -1, c = -1;
      if (b1 < 0x0e) {
        const e = source[codeauxOffs + b1];
        const z = e >>> 4, w = e & 0x0f;
        a = next++;
        b = z === 0x00 ? next++ : vertexfifo[z - 1];
        c = w === 0x00 ? next++ : vertexfifo[w - 1];
        pushfifo(vertexfifo, a);
        if (z === 0x00) pushfifo(vertexfifo, b);
        if (w === 0x00) pushfifo(vertexfifo, c);
      } else {
        const e = source[dataOffs++];
        if (e === 0x00) next = 0;
        const z = e >>> 4, w = e & 0x0f;
        a = b1 === 0x0e ? next++ : decodeIndex(readLEB128());
        b = z === 0x00 ? next++ : z === 0x0f ? decodeIndex(readLEB128()) : vertexfifo[z - 1];
        c = w === 0x00 ? next++ : w === 0x0f ? decodeIndex(readLEB128()) : vertexfifo[w - 1];
        pushfifo(vertexfifo, a);
        if (z === 0x00 || z === 0x0f) pushfifo(vertexfifo, b);
        if (w === 0x00 || w === 0x0f) pushfifo(vertexfifo, c);
      }
      pushfifo(edgefifo, a); pushfifo(edgefifo, b);
      pushfifo(edgefifo, b); pushfifo(edgefifo, c);
      pushfifo(edgefifo, c); pushfifo(edgefifo, a);
      dst[o++] = a; dst[o++] = b; dst[o++] = c;
    }
  }
}

function decodeIndexSequence(target: Uint8Array, count: number, byteStride: number, source: Uint8Array) {
  if (source[0] !== 0xd1) throw new Error("meshopt: sequence codec " + source[0].toString(16) + " not supported");
  const dst = byteStride === 2 ? new Uint16Array(target.buffer, target.byteOffset, count) : new Uint32Array(target.buffer, target.byteOffset, count);
  let dataOffs = 0x01;
  const readLEB128 = () => {
    let n = 0;
    for (let i = 0; ; i += 7) {
      const b = source[dataOffs++];
      n |= (b & 0x7f) << i;
      if (b < 0x80) return n;
    }
  };
  const last = new Uint32Array(2);
  for (let i = 0; i < count; i++) {
    const v = readLEB128();
    const b = v & 0x01;
    dst[i] = last[b] += dezig(v >>> 1);
  }
}

/** How much unpacking this run has done (the headless check and the frame meter read it). */
export const meshoptStats = { parts: 0, bytes: 0, ms: 0 };

/** The decoder object three's GLTFLoader takes (setMeshoptDecoder). */
export const MeshoptDecoderJS = {
  supported: true,
  ready: Promise.resolve(),
  decodeVertexBuffer,
  decodeIndexBuffer,
  decodeIndexSequence,
  decodeGltfBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string) {
    const t0 = Date.now();
    if (mode === "ATTRIBUTES") decodeVertexBuffer(target, count, size, source, filter);
    else if (mode === "TRIANGLES") decodeIndexBuffer(target, count, size, source);
    else if (mode === "INDICES") decodeIndexSequence(target, count, size, source);
    else throw new Error("meshopt: mode " + mode);
    meshoptStats.parts++;
    meshoptStats.bytes += target.length;
    meshoptStats.ms += Date.now() - t0;
  },
};
